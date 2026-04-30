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
#include "servo_comp.h"
#include "mb.h"
#include "mbport.h"
#include "usart.h"
#include "delay.h"
#include "adc.h"
#include "pwm.h"
#include "calib.h"
#include "gpio.h"
#include "kalman.h"
#include "atk_ms901m.h"
#include <string.h>

/* Debug output – disabled by default; enable via REG_DBG_EN or USART1 "DBG 1" */
volatile uint8_t g_debug_en = 0;
#define DBG(fmt, ...) do { if (g_debug_en) printf(fmt, ##__VA_ARGS__); } while(0)

/* Forward declaration for internal helper */
static void modbus_sync_calib_to_regs(void);
static void modbus_ir_init(void);
static void modbus_ir_reset(void);
static void modbus_ir_on_edge(uint8_t level, uint32_t now_us);
static void modbus_sync_kalman_to_regs(void);

/* Modbus holding register array */
static USHORT g_modbus_registers[REG_HOLDING_MAX];

/* Pending calibration command - processed outside eMBPoll() to avoid
 * blocking the Modbus response (Flash sector erase takes ~1-3 s which
 * would cause the master to time out and see a stale frame with bad CRC). */
static volatile uint16_t g_pending_calib_cmd  = 0;
static volatile uint8_t  g_pending_servo_save = 0;

/* IR receive (DI2 = PE4, NEC protocol) */
#define IR_RX_GPIO_PORT              GPIOE
#define IR_RX_GPIO_PIN               GPIO_PIN_4
#define IR_RX_EXTI_IRQn              EXTI4_IRQn

/* IR transmit (DI1 = PC5) */
#define IR_TX_GPIO_PORT              GPIOC
#define IR_TX_GPIO_PIN               GPIO_PIN_5
#define IR_TX_HIGH()                 HAL_GPIO_WritePin(IR_TX_GPIO_PORT, IR_TX_GPIO_PIN, GPIO_PIN_SET)
#define IR_TX_LOW()                  HAL_GPIO_WritePin(IR_TX_GPIO_PORT, IR_TX_GPIO_PIN, GPIO_PIN_RESET)
#define IR_TX_TOGGLE()               HAL_GPIO_TogglePin(IR_TX_GPIO_PORT, IR_TX_GPIO_PIN)

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

/* IR transmit: send NEC protocol frame
 * NEC protocol:
 *   - Leader: 9ms high, 4.5ms low
 *   - 8-bit address, 8-bit address inverse
 *   - 8-bit command, 8-bit command inverse
 *   - End bit: 560us high
 *   - '0': 560us high, 560us low
 *   - '1': 560us high, 1690us low
 */
static void ir_send_nec(uint8_t addr, uint8_t cmd)
{
    uint8_t i;
    uint32_t nec_addr_inv = (~addr) & 0xFF;
    uint8_t nec_cmd_inv = (~cmd) & 0xFF;

    /* Initialize PC5 as output if not already */
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    GPIO_InitStruct.Pin = IR_TX_GPIO_PIN;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(IR_TX_GPIO_PORT, &GPIO_InitStruct);
    IR_TX_LOW();

    /* Leader: 9ms high (38kHz modulated) */
    for (i = 0; i < 168; i++) {   /* 9ms / 53.57us ≈ 168 cycles */
        IR_TX_TOGGLE();
        delay_us(26);              /* 38kHz: 13us high + 13us low ≈ 26us per toggle */
    }

    /* Leader gap: 4.5ms low */
    IR_TX_LOW();
    delay_us(4500);

    /* Send 8-bit address */
    for (i = 0; i < 8; i++) {
        IR_TX_HIGH();
        delay_us(560);
        IR_TX_LOW();
        if (addr & 0x01) delay_us(1690);  /* '1': 560us + 1690us = 2250us */
        else delay_us(560);                 /* '0': 560us + 560us = 1120us */
        addr >>= 1;
    }

    /* Send 8-bit address inverse */
    for (i = 0; i < 8; i++) {
        IR_TX_HIGH();
        delay_us(560);
        IR_TX_LOW();
        if (nec_addr_inv & 0x01) delay_us(1690);
        else delay_us(560);
        nec_addr_inv >>= 1;
    }

    /* Send 8-bit command */
    for (i = 0; i < 8; i++) {
        IR_TX_HIGH();
        delay_us(560);
        IR_TX_LOW();
        if (cmd & 0x01) delay_us(1690);
        else delay_us(560);
        cmd >>= 1;
    }

    /* Send 8-bit command inverse */
    for (i = 0; i < 8; i++) {
        IR_TX_HIGH();
        delay_us(560);
        IR_TX_LOW();
        if (nec_cmd_inv & 0x01) delay_us(1690);
        else delay_us(560);
        nec_cmd_inv >>= 1;
    }

    /* End bit */
    IR_TX_HIGH();
    delay_us(560);
    IR_TX_LOW();
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
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_SYSCFG_CLK_ENABLE();

    /* IR RX pin (PE4) - interrupt for receive.
     * Use internal pull-up: most NEC IR receiver modules idle HIGH and
     * actively pull LOW; without a pull-up a weak/open-drain output can
     * fail to produce clean digital edges into EXTI. */
    gpio_init_struct.Pin = IR_RX_GPIO_PIN;
    gpio_init_struct.Mode = GPIO_MODE_IT_RISING_FALLING;
    gpio_init_struct.Pull = GPIO_PULLUP;
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(IR_RX_GPIO_PORT, &gpio_init_struct);

    /* IR TX pin (PC5) - output for transmit */
    gpio_init_struct.Pin = IR_TX_GPIO_PIN;
    gpio_init_struct.Mode = GPIO_MODE_OUTPUT_PP;
    gpio_init_struct.Pull = GPIO_NOPULL;
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(IR_TX_GPIO_PORT, &gpio_init_struct);
    IR_TX_LOW();

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
    if (addr >= REG_KALMAN_Q_ROLL && addr <= REG_KALMAN_CMD) return TRUE;
    /* Servo compensation coefficients and enable flags */
    if (addr >= REG_SERVO1_BASE && addr <= REG_SERVO8_K_YAW) return TRUE;
    if (addr >= REG_SERVO1_AUTO_EN && addr <= REG_SERVO8_AUTO_EN) return TRUE;
    /* Servo comp Flash save command */
    if (addr == REG_SERVO_SAVE_CMD) return TRUE;
    /* Debug enable control */
    if (addr == REG_DBG_EN) return TRUE;
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
        /* Write to REG_IR_TX_CMD triggers IR NEC transmission
         * Address: From REG_IR_TX_CMD register
         * Command: From REG_IR_TX_DATA register
         */
        uint8_t ir_addr = (uint8_t)(g_modbus_registers[REG_IR_TX_CMD] & 0xFF);
        uint8_t ir_cmd = (uint8_t)(g_modbus_registers[REG_IR_TX_DATA] & 0xFF);
        ir_send_nec(ir_addr, ir_cmd);
        g_modbus_registers[REG_IR_TX_CMD] = 0;
    }
    else if (addr == REG_IR_TX_DATA)
    {
        /* TX path remains reserved; register is reused as pulse-width debug mirror. */
    }
    else if (addr >= REG_KALMAN_Q_ROLL && addr <= REG_KALMAN_R_GYRO_Z)
    {
        /* Kalman Q/R parameter write: sync kalman instance on high-word (even addr) write */
        if ((addr & 1) == 0)
        {
            uint8_t ch = (addr - REG_KALMAN_Q_ROLL) / 2;
            float q = modbus_get_register_float(REG_KALMAN_Q_ROLL + ch * 2);
            float r = modbus_get_register_float(REG_KALMAN_R_ROLL + ch * 2);
            if (ch < KALMAN_CH_COUNT)
            {
                kalman_set_params(ch, q, r);
            }
        }
    }
    else if (addr == REG_KALMAN_CMD)
    {
        uint16_t cmd = g_modbus_registers[REG_KALMAN_CMD];
        if (cmd == 1)
        {
            kalman_reset_all();
            modbus_sync_kalman_to_regs();
            DBG("[KALMAN] reset\r\n");
        }
        g_modbus_registers[REG_KALMAN_CMD] = 0;
    }
    else if (addr == REG_SERVO_SAVE_CMD)
    {
        uint16_t cmd = g_modbus_registers[REG_SERVO_SAVE_CMD];
        if (cmd == SERVO_COMP_CMD_SAVE)
        {
            g_pending_servo_save = 1;
        }
        g_modbus_registers[REG_SERVO_SAVE_CMD] = 0;
    }
    else if (addr == REG_DBG_EN)
    {
        g_debug_en = (g_modbus_registers[REG_DBG_EN] != 0) ? 1u : 0u;
    }
}

/**
 * @brief  Deferred servo comp Flash save – must run outside eMBRegHoldingCB.
 */
static void modbus_process_pending_servo_save(void)
{
    if (!g_pending_servo_save) return;
    g_pending_servo_save = 0;

    eMBDisable();
    HAL_Delay(10);

    HAL_StatusTypeDef st = servo_comp_save(g_modbus_registers);
    g_modbus_registers[REG_CAL_STATUS] = (st == HAL_OK) ? CALIB_STATUS_OK : CALIB_STATUS_ERROR;
    DBG("[SCOMP] save: %s\r\n", (st == HAL_OK) ? "OK" : "FAIL");

    eMBInit(MB_RTU, 0x01, 2, 9600, MB_PAR_NONE, 1);
    eMBEnable();
}

/**
 * @brief  Execute any pending calibration command deferred from
 *         eMBRegHoldingCB. Called from main loop after eMBPoll() returns.
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

        st = calib_save_to_flash();
        g_modbus_registers[REG_CAL_STATUS] = (st == HAL_OK) ? CALIB_STATUS_OK : CALIB_STATUS_ERROR;
        DBG("[CALIB] save: %s\r\n", (st == HAL_OK) ? "OK" : "FAIL");

        eMBInit(MB_RTU, 0x01, 2, 9600, MB_PAR_NONE, 1);
        eMBEnable();
    }
    else if (cmd == CALIB_CMD_RESET)
    {
        calib_reset_default();
        modbus_sync_calib_to_regs();
        g_modbus_registers[REG_CAL_STATUS] = CALIB_STATUS_OK;
        DBG("[CALIB] reset\r\n");
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

/**
 * @brief  Copy g_kalman RAM values into Modbus register mirror
 */
static void modbus_sync_kalman_to_regs(void)
{
    uint8_t ch;
    for (ch = 0; ch < KALMAN_CH_COUNT; ch++)
    {
        modbus_set_register_float(REG_KALMAN_Q_ROLL + ch * 4,     g_kalman[ch].q);
        modbus_set_register_float(REG_KALMAN_R_ROLL + ch * 4,     g_kalman[ch].r);
    }
    g_modbus_registers[REG_KALMAN_CMD] = 0;
}

/**
 * @brief  Calculate servo angle with attitude compensation
 * @param  servo_index: Servo index (0-7)
 * @retval Calculated PWM pulse width in microseconds
 */
static uint16_t calculate_servo_with_compensation(uint8_t servo_index)
{
    float roll, pitch, yaw;
    float base_angle, k_roll, k_pitch, k_yaw;
    float compensated_angle;
    int16_t pwm_us;
    
    /* Get current attitude data */
    roll = modbus_get_register_float(REG_ROLL);
    pitch = modbus_get_register_float(REG_PITCH);
    yaw = modbus_get_register_float(REG_YAW);
    
    /* Get compensation coefficients for this servo */
    uint16_t base_reg = REG_SERVO1_BASE + servo_index * 8;
    base_angle = modbus_get_register_float(base_reg);
    k_roll = modbus_get_register_float(base_reg + 2);
    k_pitch = modbus_get_register_float(base_reg + 4);
    k_yaw = modbus_get_register_float(base_reg + 6);
    
    /* Calculate compensated angle: BASE + K_ROLL*Roll + K_PITCH*Pitch + K_YAW*Yaw */
    compensated_angle = base_angle + k_roll * roll + k_pitch * pitch + k_yaw * yaw;
    
    /* Convert angle to PWM pulse width (500-2500us for ±90° range) */
    /* Formula: PWM = 1500 + angle * 10 (center at 1500us, 10us/degree) */
    pwm_us = (int16_t)(1500.0f + compensated_angle * 10.0f);
    
    /* Clamp to valid range */
    if (pwm_us < 500) pwm_us = 500;
    if (pwm_us > 2500) pwm_us = 2500;
    
    return (uint16_t)pwm_us;
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

    /* Initialize Kalman filter registers with default Q/R values */
    modbus_sync_kalman_to_regs();

    /* Initialize servo compensation coefficients (default: no compensation) */
    for (i = 0; i < 8; i++)
    {
        uint16_t base_reg = REG_SERVO1_BASE + i * 8;
        
        /* Default base angle: 0 degrees (center position) */
        modbus_set_register_float(base_reg, 0.0f);
        
        /* Default compensation coefficients: all zero (no compensation) */
        modbus_set_register_float(base_reg + 2, 0.0f);  /* K_ROLL */
        modbus_set_register_float(base_reg + 4, 0.0f);  /* K_PITCH */
        modbus_set_register_float(base_reg + 6, 0.0f);  /* K_YAW */
        
        /* Disable auto-compensation by default */
        g_modbus_registers[REG_SERVO1_AUTO_EN + i] = 0;
    }

    /* Load servo compensation parameters saved to Flash */
    servo_comp_init();
    servo_comp_apply(g_modbus_registers);

    /* Initialize Modbus RTU slave */
    eStatus = eMBInit(MB_RTU, 0x01, 2, 9600, MB_PAR_NONE, 1);
    eStatus = eMBEnable();
    printf("[MODBUS] ready regs=%d\r\n", REG_HOLDING_MAX); /* always visible on boot */
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

    /* Magnetometer data */
    atk_ms901m_magnetometer_data_t mag;
    if (atk_ms901m_get_magnetometer(&mag, 100) == ATK_MS901M_EOK)
    {
        /* Convert raw magnetometer data to float in uT */
        float mag_x = (float)mag.x * 0.1f;  // Example conversion factor, adjust based on sensor specs
        float mag_y = (float)mag.y * 0.1f;
        float mag_z = (float)mag.z * 0.1f;
        modbus_set_register_float(REG_MAG_X, mag_x);
        modbus_set_register_float(REG_MAG_Y, mag_y);
        modbus_set_register_float(REG_MAG_Z, mag_z);
        modbus_set_register_float(REG_MAG_TEMP, mag.temperature);
    }

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

    /* Servo attitude compensation: auto-update PWM if enabled */
    for (i = 0; i < 8; i++)
    {
        uint16_t auto_en_reg = REG_SERVO1_AUTO_EN + i;
        if (g_modbus_registers[auto_en_reg] == 1)
        {
            /* Auto-compensation enabled, calculate compensated angle */
            uint16_t pwm_us = calculate_servo_with_compensation((uint8_t)i);
            
            /* Update the servo register and apply to PWM hardware */
            uint16_t servo_reg = REG_SERVO1 + i;
            g_modbus_registers[servo_reg] = pwm_us;
            pwm_set_duty((pwm_channel_t)(PWM_CH_SERVO_1 + i), pwm_us);
        }
    }
}

void modbus_process(void)
{
    modbus_update_sensors();

    eMBErrorCode eStatus = eMBPoll();
    if (eStatus != MB_ENOERR)
    {
        DBG("[MODBUS] poll err=%d\r\n", eStatus);
    }

    /* Deferred Flash saves – must run after eMBPoll() has sent the response */
    modbus_process_pending_calib();
    modbus_process_pending_servo_save();
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

    DBG("[MB] CB a=%d n=%d m=%d\r\n", usAddress, usNRegs, eMode);

    usAddress--;  /* FreeModbus passes 1-based address, convert to 0-based */

    if ((usAddress + usNRegs) > REG_HOLDING_MAX)
    {
        return MB_ENOREG;
    }

    usRegAddr = usAddress;

    if (eMode == MB_REG_WRITE)
    {
        /* Pre-validate the entire address range before touching any register.
         * Prevents partial writes when a batch spans writable + read-only regs. */
        for (i = 0; i < usNRegs; i++)
        {
            if (!is_reg_writable(usRegAddr + i))
                return MB_ENOREG;
        }
    }

    for (i = 0; i < usNRegs; i++)
    {
        if (eMode == MB_REG_READ)
        {
            *pucRegBuffer++ = (UCHAR)(g_modbus_registers[usRegAddr] >> 8);
            *pucRegBuffer++ = (UCHAR)(g_modbus_registers[usRegAddr] & 0xFF);
        }
        else
        {
            UCHAR hi = *pucRegBuffer++;
            UCHAR lo = *pucRegBuffer++;
            g_modbus_registers[usRegAddr] = (hi << 8) | lo;
            apply_register(usRegAddr);
            DBG("[MB] W[%X]=%d\r\n", usRegAddr, g_modbus_registers[usRegAddr]);
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
