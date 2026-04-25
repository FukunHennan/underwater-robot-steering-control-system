/**
 ****************************************************************************************************
 * @file        modbus.c
 * @author      chenfukun
 * @version     V3.0
 * @date        2026-04-14
 * @brief       Modbus RTU Slave Implementation for STM32F407
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 * @attention
 *
 * Project Name: Underwater Intelligent Steering System
 * Test Platform: STM32F407
 *
 * Modbus RTU Slave Implementation based on FreeModbus
 *
 ****************************************************************************************************
 */

#include "modbus.h"
#include "mb.h"
#include "mbport.h"
#include "usart.h"
#include "delay.h"
#include "adc.h"
#include "pwm.h"
#include "calib.h"
#include "gpio.h"
#include <string.h>

/* Forward declaration for internal helper */
static void modbus_sync_calib_to_regs(void);
static void modbus_ir_init(void);
static void modbus_ir_reset(void);
static void modbus_ir_on_edge(uint8_t level, uint32_t now_us);

/* Modbus holding register array */
static USHORT g_modbus_registers[REG_HOLDING_MAX];

/* Pending calibration command - processed outside eMBPoll() to avoid
 * blocking the Modbus response (Flash sector erase takes ~1-3 s which
 * would cause the master to time out and see a stale frame with bad CRC). */
static volatile uint16_t g_pending_calib_cmd = 0;

/* IR receive (DI2 = PE4, NEC protocol) */
#define IR_RX_GPIO_PORT              GPIOE
#define IR_RX_GPIO_PIN               GPIO_PIN_4
#define IR_RX_EXTI_IRQn              EXTI4_IRQn
#define IR_STATUS_IDLE               0
#define IR_STATUS_FRAME              1
#define IR_STATUS_REPEAT             2
#define IR_STATUS_EDGE               3
#define IR_LATCH_MS                  300U

typedef enum
{
    IR_STATE_IDLE = 0,
    IR_STATE_LEAD_LOW,
    IR_STATE_LEAD_HIGH,
    IR_STATE_DATA_LOW,
    IR_STATE_DATA_HIGH,
    IR_STATE_REPEAT_LOW
} ir_state_t;

static volatile ir_state_t g_ir_state = IR_STATE_IDLE;
static volatile uint32_t g_ir_last_falling_us = 0;
static volatile uint32_t g_ir_last_rising_us = 0;
static volatile uint32_t g_ir_data = 0;
static volatile uint8_t g_ir_bit_index = 0;
static volatile uint32_t g_ir_last_frame_tick = 0;
static volatile uint32_t g_ir_edge_count = 0;
static uint32_t g_ir_ticks_per_us = 168;

/* IR timing parameters (adjustable via Modbus) */
static uint32_t g_ir_lead_low_lo = 8500U;
static uint32_t g_ir_lead_low_hi = 9500U;
static uint32_t g_ir_lead_high_lo = 4000U;
static uint32_t g_ir_lead_high_hi = 5000U;
static uint32_t g_ir_bit0_lo = 400U;
static uint32_t g_ir_bit0_hi = 700U;
static uint32_t g_ir_bit1_lo = 1500U;
static uint32_t g_ir_bit1_hi = 1900U;

static uint32_t ir_time_diff_us(uint32_t now, uint32_t before)
{
    return now - before;
}

static uint8_t ir_in_range(uint32_t v, uint32_t lo, uint32_t hi)
{
    return (v >= lo && v <= hi) ? 1U : 0U;
}

static void modbus_ir_sync_params_from_regs(void)
{
    g_ir_lead_low_lo  = g_modbus_registers[REG_IR_LEAD_LOW_LO];
    g_ir_lead_low_hi  = g_modbus_registers[REG_IR_LEAD_LOW_HI];
    g_ir_lead_high_lo = g_modbus_registers[REG_IR_LEAD_HIGH_LO];
    g_ir_lead_high_hi = g_modbus_registers[REG_IR_LEAD_HIGH_HI];
    g_ir_bit0_lo      = g_modbus_registers[REG_IR_BIT0_LO];
    g_ir_bit0_hi      = g_modbus_registers[REG_IR_BIT0_HI];
    g_ir_bit1_lo      = g_modbus_registers[REG_IR_BIT1_LO];
    g_ir_bit1_hi      = g_modbus_registers[REG_IR_BIT1_HI];
    if (g_ir_lead_low_lo == 0) g_ir_lead_low_lo = 8500U;
    if (g_ir_lead_low_hi == 0) g_ir_lead_low_hi = 9500U;
    if (g_ir_lead_high_lo == 0) g_ir_lead_high_lo = 4000U;
    if (g_ir_lead_high_hi == 0) g_ir_lead_high_hi = 5000U;
    if (g_ir_bit0_lo == 0) g_ir_bit0_lo = 400U;
    if (g_ir_bit0_hi == 0) g_ir_bit0_hi = 700U;
    if (g_ir_bit1_lo == 0) g_ir_bit1_lo = 1500U;
    if (g_ir_bit1_hi == 0) g_ir_bit1_hi = 1900U;
}

static uint32_t ir_now_us(void)
{
    return DWT->CYCCNT / g_ir_ticks_per_us;
}

static void modbus_ir_commit_frame(uint32_t raw)
{
    uint8_t addr = (uint8_t)(raw & 0xFFU);
    uint8_t addr_inv = (uint8_t)((raw >> 8) & 0xFFU);
    uint8_t cmd = (uint8_t)((raw >> 16) & 0xFFU);
    uint8_t cmd_inv = (uint8_t)((raw >> 24) & 0xFFU);

    if ((uint8_t)(addr ^ addr_inv) == 0xFFU && (uint8_t)(cmd ^ cmd_inv) == 0xFFU)
    {
        g_modbus_registers[REG_IR_RX_DATA] = ((uint16_t)addr << 8) | cmd;
        g_modbus_registers[REG_IR_RX_STATUS] = IR_STATUS_FRAME;
        g_ir_last_frame_tick = HAL_GetTick();
        printf("[IR] NEC frame addr=0x%02X cmd=0x%02X\r\n", addr, cmd);
    }
}

static void modbus_ir_reset(void)
{
    g_ir_state = IR_STATE_IDLE;
    g_ir_data = 0;
    g_ir_bit_index = 0;
}

static void modbus_ir_on_edge(uint8_t level, uint32_t now_us)
{
    uint32_t dt;

    modbus_ir_sync_params_from_regs();
    g_ir_edge_count++;
    g_modbus_registers[REG_IR_RX_STATUS] = IR_STATUS_EDGE;
    g_ir_last_frame_tick = HAL_GetTick();

    if (level == 0U)
    {
        dt = ir_time_diff_us(now_us, g_ir_last_rising_us);
        g_ir_last_falling_us = now_us;
        g_modbus_registers[REG_IR_TX_DATA] = (uint16_t)((dt > 0xFFFFU) ? 0xFFFFU : dt);

        if (g_ir_state == IR_STATE_LEAD_HIGH)
        {
            if (ir_in_range(dt, g_ir_lead_high_lo, g_ir_lead_high_hi))
            {
                g_ir_state = IR_STATE_DATA_LOW;
                g_ir_data = 0;
                g_ir_bit_index = 0;
            }
            else
            {
                modbus_ir_reset();
            }
        }
        else if (g_ir_state == IR_STATE_DATA_HIGH)
        {
            if (ir_in_range(dt, g_ir_bit0_lo, g_ir_bit0_hi))
            {
                g_ir_data |= (0UL << g_ir_bit_index);
                g_ir_bit_index++;
            }
            else if (ir_in_range(dt, g_ir_bit1_lo, g_ir_bit1_hi))
            {
                g_ir_data |= (1UL << g_ir_bit_index);
                g_ir_bit_index++;
            }
            else
            {
                modbus_ir_reset();
                return;
            }

            if (g_ir_bit_index >= 32U)
            {
                modbus_ir_commit_frame(g_ir_data);
                modbus_ir_reset();
            }
            else
            {
                g_ir_state = IR_STATE_DATA_LOW;
            }
        }
        else if (g_ir_state == IR_STATE_IDLE)
        {
            g_ir_state = IR_STATE_LEAD_LOW;
        }
    }
    else
    {
        dt = ir_time_diff_us(now_us, g_ir_last_falling_us);
        g_ir_last_rising_us = now_us;
        g_modbus_registers[REG_IR_TX_DATA] = (uint16_t)((dt > 0xFFFFU) ? 0xFFFFU : dt);

        if (g_ir_state == IR_STATE_LEAD_LOW)
        {
            if (ir_in_range(dt, g_ir_lead_low_lo, g_ir_lead_low_hi))
            {
                g_ir_state = IR_STATE_LEAD_HIGH;
            }
            else
            {
                modbus_ir_reset();
            }
        }
        else if (g_ir_state == IR_STATE_DATA_LOW)
        {
            if (ir_in_range(dt, g_ir_bit0_lo, g_ir_bit0_hi))
            {
                g_ir_state = IR_STATE_DATA_HIGH;
            }
            else
            {
                modbus_ir_reset();
            }
        }
        else if (g_ir_state == IR_STATE_REPEAT_LOW)
        {
            if (ir_in_range(dt, g_ir_bit0_lo, g_ir_bit0_hi))
            {
                g_modbus_registers[REG_IR_RX_STATUS] = IR_STATUS_REPEAT;
                g_ir_last_frame_tick = HAL_GetTick();
            }
            modbus_ir_reset();
        }
    }
}

static void modbus_ir_init(void)
{
    GPIO_InitTypeDef gpio_init_struct;

    __HAL_RCC_GPIOE_CLK_ENABLE();
    __HAL_RCC_SYSCFG_CLK_ENABLE();

    gpio_init_struct.Pin = IR_RX_GPIO_PIN;
    gpio_init_struct.Mode = GPIO_MODE_IT_RISING_FALLING;
    gpio_init_struct.Pull = GPIO_NOPULL;
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(IR_RX_GPIO_PORT, &gpio_init_struct);

    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CYCCNT = 0;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
    g_ir_ticks_per_us = HAL_RCC_GetHCLKFreq() / 1000000U;
    if (g_ir_ticks_per_us == 0U) g_ir_ticks_per_us = 168U;

    HAL_NVIC_SetPriority(IR_RX_EXTI_IRQn, 4, 0);
    HAL_NVIC_EnableIRQ(IR_RX_EXTI_IRQn);

    modbus_ir_reset();
    g_ir_edge_count = 0;
    g_modbus_registers[REG_IR_RX_STATUS] = IR_STATUS_IDLE;
    g_modbus_registers[REG_IR_RX_DATA] = 0;
}

void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
    if (GPIO_Pin == IR_RX_GPIO_PIN)
    {
        uint8_t level = (HAL_GPIO_ReadPin(IR_RX_GPIO_PORT, IR_RX_GPIO_PIN) == GPIO_PIN_SET) ? 1U : 0U;
        modbus_ir_on_edge(level, ir_now_us());
    }
}

/* ----------------------- Static helper functions -------------------------*/

static BOOL is_reg_writable(USHORT addr)
{
    if (addr == REG_RUN_MODE) return TRUE;
    if (addr >= REG_SERVO1 && addr <= REG_LED2) return TRUE;
    if (addr >= REG_PWM_ARR_G1 && addr <= REG_PWM_PSC_G4) return TRUE;
    if (addr >= REG_CAL_VOLT_GAIN && addr <= REG_CAL_CMD) return TRUE;
    if (addr >= REG_GPIO_MODE0 && addr <= REG_GPIO_OUT3) return TRUE;
    if (addr >= REG_IR_TX_CMD && addr <= REG_IR_TX_DATA) return TRUE;
    if (addr >= REG_IR_LEAD_LOW_LO && addr <= REG_IR_BIT1_HI) return TRUE;
    return FALSE;
}

static void apply_register(USHORT addr)
{
    if (addr >= REG_SERVO1 && addr <= REG_SERVO8)
    {
        pwm_set_duty(addr - REG_SERVO1 + PWM_CH_SERVO_1, g_modbus_registers[addr]);
    }
    else if (addr == REG_LED1)
    {
        pwm_set_duty(PWM_CH_LED_1, g_modbus_registers[addr]);
    }
    else if (addr == REG_LED2)
    {
        pwm_set_duty(PWM_CH_LED_2, g_modbus_registers[addr]);
    }
    else if (addr >= REG_PWM_ARR_G1 && addr <= REG_PWM_PSC_G4)
    {
        /* Apply frequency change: ARR and PSC come in pairs, apply on either write */
        uint8_t group = (addr - REG_PWM_ARR_G1) / 2 + PWM_GROUP_1;
        uint16_t arr_reg = REG_PWM_ARR_G1 + (group - PWM_GROUP_1) * 2;
        uint16_t psc_reg = arr_reg + 1;
        pwm_set_frequency(group, g_modbus_registers[arr_reg], g_modbus_registers[psc_reg]);
    }
    else if (addr >= REG_CAL_VOLT_GAIN && addr <= REG_CAL_AN4_OFF)
    {
        /* Calibration float pair write: sync RAM<-register on low-word write (addr is odd) */
        if ((addr & 1) == 1)
        {
            uint16_t base = addr - 1;
            uint8_t ch    = (base - REG_CAL_VOLT_GAIN) / 4;
            uint8_t is_off = ((base - REG_CAL_VOLT_GAIN) / 2) & 1;
            float v = modbus_get_register_float(base);
            if (ch < CALIB_CH_COUNT)
            {
                if (is_off) g_calib.offset[ch] = v;
                else        g_calib.gain[ch]   = v;
            }
        }
    }
    else if (addr == REG_CAL_CMD)
    {
        /* Defer execution to main loop: Flash erase blocks for 1-3 s and must
         * NOT run inside eMBRegHoldingCB (would delay the Modbus response
         * beyond the master's timeout and break the next request's CRC). */
        uint16_t cmd = g_modbus_registers[REG_CAL_CMD];
        if (cmd == CALIB_CMD_SAVE || cmd == CALIB_CMD_RESET)
        {
            g_pending_calib_cmd = cmd;
            /* Mark as busy so master sees status != idle while operation runs */
            g_modbus_registers[REG_CAL_STATUS] = CALIB_STATUS_IDLE;
        }
        /* Auto-clear CMD register immediately so the response echoes 0 and the
         * next write (even identical value) re-triggers the command. */
        g_modbus_registers[REG_CAL_CMD] = 0;
    }
    else if (addr >= REG_GPIO_MODE0 && addr <= REG_GPIO_MODE3)
    {
        uint8_t pin = (uint8_t)(addr - REG_GPIO_MODE0);
        uint16_t mode = g_modbus_registers[addr] ? MY_GPIO_MODE_OUTPUT : MY_GPIO_MODE_INPUT;
        g_modbus_registers[addr] = (mode == MY_GPIO_MODE_OUTPUT) ? 1 : 0;
        gpio_set_mode(pin, (uint8_t)mode);
    }
    else if (addr >= REG_GPIO_OUT0 && addr <= REG_GPIO_OUT3)
    {
        uint8_t pin = (uint8_t)(addr - REG_GPIO_OUT0);
        uint16_t state = g_modbus_registers[addr] ? MY_GPIO_HIGH : MY_GPIO_LOW;
        g_modbus_registers[addr] = (state == MY_GPIO_HIGH) ? 1 : 0;
        gpio_write(pin, (uint8_t)state);
    }
    else if (addr == REG_IR_TX_CMD)
    {
        g_modbus_registers[REG_IR_TX_CMD] = 0;
    }
    else if (addr == REG_IR_TX_DATA)
    {
        /* TX path remains reserved; register is reused as pulse-width debug mirror. */
    }
}

/**
 * @brief  Execute any pending calibration command deferred from
 *         eMBRegHoldingCB. Called from main loop after eMBPoll() returns,
 *         which guarantees the Modbus response has already been sent.
 */
static void modbus_process_pending_calib(void)
{
    uint16_t cmd = g_pending_calib_cmd;
    if (cmd == 0) return;
    g_pending_calib_cmd = 0;

    if (cmd == CALIB_CMD_SAVE)
    {
        HAL_StatusTypeDef st;

        /* 1) 关 Modbus 接收，等 T3.5 残帧结束 (>4ms @9600 baud) */
        eMBDisable();
        HAL_Delay(10);

        /* 2) 执行 Flash 擦写 (Sector 2, 约 300ms) */
        st = calib_save_to_flash();
        g_modbus_registers[REG_CAL_STATUS] = (st == HAL_OK) ? CALIB_STATUS_OK : CALIB_STATUS_ERROR;
        printf("[CALIB] save_to_flash (deferred): %s\r\n", (st == HAL_OK) ? "OK" : "FAIL");

        /* 3) 重建 Modbus 协议栈 (清 RX 缓冲 + T3.5 定时器复位) */
        eMBInit(MB_RTU, 0x01, 2, 9600, MB_PAR_NONE, 1);
        eMBEnable();
    }
    else if (cmd == CALIB_CMD_RESET)
    {
        calib_reset_default();
        modbus_sync_calib_to_regs();
        g_modbus_registers[REG_CAL_STATUS] = CALIB_STATUS_OK;
        printf("[CALIB] reset to default (deferred)\r\n");
    }
}

/**
 * @brief  Copy g_calib RAM values into Modbus register mirror
 */
static void modbus_sync_calib_to_regs(void)
{
    uint8_t ch;
    for (ch = 0; ch < CALIB_CH_COUNT; ch++)
    {
        modbus_set_register_float(REG_CAL_VOLT_GAIN + ch * 4,     g_calib.gain[ch]);
        modbus_set_register_float(REG_CAL_VOLT_GAIN + ch * 4 + 2, g_calib.offset[ch]);
    }
    g_modbus_registers[REG_CAL_CMD]    = 0;
    g_modbus_registers[REG_CAL_STATUS] = CALIB_STATUS_IDLE;
}

/* ----------------------- Public functions ---------------------------------*/

void modbus_init(void)
{
    eMBErrorCode eStatus;
    int i;

    /* Clear all registers */
    for (i = 0; i < REG_HOLDING_MAX; i++)
    {
        g_modbus_registers[i] = 0;
    }

    /* Initialize constant registers */
    g_modbus_registers[REG_DEVICE_ID]  = 0x0407;
    g_modbus_registers[REG_FW_VERSION] = 0x0300;

    /* Default servo positions: 1500us (center) */
    for (i = REG_SERVO1; i <= REG_SERVO8; i++)
    {
        g_modbus_registers[i] = 1500;
    }

    /* Default PWM frequency: 50Hz (arr=19999, psc=83 for 84MHz timers) */
    g_modbus_registers[REG_PWM_ARR_G1] = 19999;
    g_modbus_registers[REG_PWM_PSC_G1] = 83;
    g_modbus_registers[REG_PWM_ARR_G2] = 19999;
    g_modbus_registers[REG_PWM_PSC_G2] = 83;
    g_modbus_registers[REG_PWM_ARR_G3] = 19999;
    g_modbus_registers[REG_PWM_PSC_G3] = 83;
    g_modbus_registers[REG_PWM_ARR_G4] = 19999;
    g_modbus_registers[REG_PWM_PSC_G4] = 83;

    /* Expose calibration RAM to Modbus registers (calib_init() must be called before this) */
    modbus_sync_calib_to_regs();

    /* Default GPIO state: all input, outputs cleared */
    for (i = 0; i < 4; i++)
    {
        g_modbus_registers[REG_GPIO_MODE0 + i] = 0;
        g_modbus_registers[REG_GPIO_OUT0 + i] = 0;
        g_modbus_registers[REG_GPIO_IN0 + i] = 0;
        gpio_set_mode((uint8_t)i, MY_GPIO_MODE_INPUT);
    }

    /* IR registers */
    g_modbus_registers[REG_IR_TX_CMD] = 0;
    g_modbus_registers[REG_IR_TX_DATA] = 0;
    g_modbus_registers[REG_IR_RX_STATUS] = 0;
    g_modbus_registers[REG_IR_RX_DATA] = 0;

    /* IR timing parameters (adjustable) */
    g_modbus_registers[REG_IR_LEAD_LOW_LO]  = 8500U;
    g_modbus_registers[REG_IR_LEAD_LOW_HI]  = 9500U;
    g_modbus_registers[REG_IR_LEAD_HIGH_LO] = 4000U;
    g_modbus_registers[REG_IR_LEAD_HIGH_HI] = 5000U;
    g_modbus_registers[REG_IR_BIT0_LO]      = 400U;
    g_modbus_registers[REG_IR_BIT0_HI]      = 700U;
    g_modbus_registers[REG_IR_BIT1_LO]      = 1500U;
    g_modbus_registers[REG_IR_BIT1_HI]      = 1900U;
    modbus_ir_init();

    /* Initialize Modbus RTU slave */
    eStatus = eMBInit(MB_RTU, 0x01, 2, 9600, MB_PAR_NONE, 1);
    printf("[MODBUS] eMBInit result: %d\r\n", eStatus);

    eStatus = eMBEnable();
    printf("[MODBUS] eMBEnable result: %d\r\n", eStatus);

    printf("[MODBUS] Addr=0x01 Baud=9600 8N1 Regs=%d\r\n", REG_HOLDING_MAX);
    printf("[MODBUS] Modbus RTU slave started\r\n");
}

void modbus_update_sensors(void)
{
    uint32_t tick = HAL_GetTick();
    int i;

    /* System tick */
    g_modbus_registers[REG_SYS_TICK_L] = (uint16_t)(tick & 0xFFFF);
    g_modbus_registers[REG_SYS_TICK_H] = (uint16_t)(tick >> 16);

    /* ADC analog inputs: apply calibration (y = gain * raw + offset) */
    g_modbus_registers[REG_ANALOG1] = (uint16_t)calib_apply(CALIB_CH_ANALOG1, (float)adc_get_analog_value(ADC_CH_ANALOG1));
    g_modbus_registers[REG_ANALOG2] = (uint16_t)calib_apply(CALIB_CH_ANALOG2, (float)adc_get_analog_value(ADC_CH_ANALOG2));
    g_modbus_registers[REG_ANALOG3] = (uint16_t)calib_apply(CALIB_CH_ANALOG3, (float)adc_get_analog_value(ADC_CH_ANALOG3));
    g_modbus_registers[REG_ANALOG4] = (uint16_t)calib_apply(CALIB_CH_ANALOG4, (float)adc_get_analog_value(ADC_CH_ANALOG4));

    /* ADC power voltage: apply calibration then x100 V */
    g_modbus_registers[REG_VOLTAGE] = (uint16_t)(calib_apply(CALIB_CH_VOLTAGE, adc_get_power_voltage()) * 100.0f);

    /* ADC raw values */
    g_modbus_registers[REG_ADC_RAW0] = adc_get_channel_value(ADC_CH_ANALOG1);
    g_modbus_registers[REG_ADC_RAW1] = adc_get_channel_value(ADC_CH_ANALOG2);
    g_modbus_registers[REG_ADC_RAW2] = adc_get_channel_value(ADC_CH_ANALOG3);
    g_modbus_registers[REG_ADC_RAW3] = adc_get_channel_value(ADC_CH_ANALOG4);
    g_modbus_registers[REG_ADC_RAW4] = adc_get_channel_value(ADC_CH_VOLTAGE);

    /* GPIO snapshot */
    for (i = 0; i < 4; i++)
    {
        g_modbus_registers[REG_GPIO_IN0 + i] = gpio_read((uint8_t)i) ? 1 : 0;
    }

    g_modbus_registers[REG_IR_TX_CMD] = (uint16_t)(g_ir_edge_count & 0xFFFFU);

    if (g_modbus_registers[REG_IR_RX_STATUS] != IR_STATUS_IDLE &&
        (tick - g_ir_last_frame_tick) > IR_LATCH_MS)
    {
        g_modbus_registers[REG_IR_RX_STATUS] = IR_STATUS_IDLE;
    }
}

void modbus_process(void)
{
    modbus_update_sensors();

    eMBErrorCode eStatus = eMBPoll();
    if (eStatus != MB_ENOERR)
    {
        printf("[MODBUS] eMBPoll err=%d\r\n", eStatus);
    }

    /* Execute deferred calibration commands AFTER eMBPoll() has finished
     * sending the response frame. Flash erase (1-3 s) inside the holding
     * register callback would cause the master to time out. */
    modbus_process_pending_calib();
}

uint16_t modbus_get_register(uint16_t addr)
{
    if (addr < REG_HOLDING_MAX)
    {
        return g_modbus_registers[addr];
    }
    return 0;
}

void modbus_set_register(uint16_t addr, uint16_t value)
{
    if (addr < REG_HOLDING_MAX)
    {
        g_modbus_registers[addr] = value;
    }
}

void modbus_set_register_float(uint16_t addr, float value)
{
    uint32_t raw;
    memcpy(&raw, &value, sizeof(float));
    /* Big-Endian word order (ABCD): high word at addr, low word at addr+1 */
    if ((addr + 1) < REG_HOLDING_MAX)
    {
        g_modbus_registers[addr]     = (uint16_t)(raw >> 16);
        g_modbus_registers[addr + 1] = (uint16_t)(raw & 0xFFFF);
    }
}

float modbus_get_register_float(uint16_t addr)
{
    float value;
    uint32_t raw;
    if ((addr + 1) < REG_HOLDING_MAX)
    {
        raw = ((uint32_t)g_modbus_registers[addr] << 16) | g_modbus_registers[addr + 1];
        memcpy(&value, &raw, sizeof(float));
        return value;
    }
    return 0.0f;
}

void modbus_set_register_int32(uint16_t addr, int32_t value)
{
    if ((addr + 1) < REG_HOLDING_MAX)
    {
        g_modbus_registers[addr]     = (uint16_t)((uint32_t)value >> 16);
        g_modbus_registers[addr + 1] = (uint16_t)((uint32_t)value & 0xFFFF);
    }
}

/* ----------------------- Modbus callback functions ------------------------*/

eMBErrorCode eMBRegHoldingCB(UCHAR *pucRegBuffer, USHORT usAddress, USHORT usNRegs, eMBRegisterMode eMode)
{
    USHORT usRegAddr;
    int i;

    printf("[MODBUS] HoldingCB addr=%d nregs=%d mode=%d\r\n", usAddress, usNRegs, eMode);

    usAddress--;  /* FreeModbus passes 1-based address, convert to 0-based */

    if ((usAddress + usNRegs) > REG_HOLDING_MAX)
    {
        return MB_ENOREG;
    }

    usRegAddr = usAddress;

    for (i = 0; i < usNRegs; i++)
    {
        if (eMode == MB_REG_READ)
        {
            *pucRegBuffer++ = (UCHAR)(g_modbus_registers[usRegAddr] >> 8);
            *pucRegBuffer++ = (UCHAR)(g_modbus_registers[usRegAddr] & 0xFF);
        }
        else
        {
            if (!is_reg_writable(usRegAddr))
            {
                return MB_ENOREG;
            }
            UCHAR hi = *pucRegBuffer++;
            UCHAR lo = *pucRegBuffer++;
            g_modbus_registers[usRegAddr] = (hi << 8) | lo;
            apply_register(usRegAddr);
            printf("[MODBUS] WRITE reg[0x%04X]=%d\r\n", usRegAddr, g_modbus_registers[usRegAddr]);
        }
        usRegAddr++;
    }

    return MB_ENOERR;
}

eMBErrorCode eMBRegInputCB(UCHAR *pucRegBuffer, USHORT usAddress, USHORT usNRegs)
{
    return MB_ENOREG;
}

eMBErrorCode eMBRegCoilsCB(UCHAR *pucRegBuffer, USHORT usAddress, USHORT usNCoils, eMBRegisterMode eMode)
{
    return MB_ENOREG;
}

eMBErrorCode eMBRegDiscreteCB(UCHAR *pucRegBuffer, USHORT usAddress, USHORT usNDiscrete)
{
    return MB_ENOREG;
}
