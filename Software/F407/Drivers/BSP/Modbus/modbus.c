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
#include <string.h>

/* Forward declaration for internal helper */
static void modbus_sync_calib_to_regs(void);

/* Modbus holding register array */
static USHORT g_modbus_registers[REG_HOLDING_MAX];

/* Pending calibration command - processed outside eMBPoll() to avoid
 * blocking the Modbus response (Flash sector erase takes ~1-3 s which
 * would cause the master to time out and see a stale frame with bad CRC). */
static volatile uint16_t g_pending_calib_cmd = 0;

/* ----------------------- Static helper functions -------------------------*/

static BOOL is_reg_writable(USHORT addr)
{
    if (addr == REG_RUN_MODE) return TRUE;
    if (addr >= REG_SERVO1 && addr <= REG_LED2) return TRUE;
    if (addr >= REG_PWM_ARR_G1 && addr <= REG_PWM_PSC_G4) return TRUE;
    if (addr >= REG_CAL_VOLT_GAIN && addr <= REG_CAL_CMD) return TRUE;
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
