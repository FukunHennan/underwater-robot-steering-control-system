/**
 ****************************************************************************************************
 * @file        servo_comp.c
 * @author      chenfukun
 * @brief       Servo attitude compensation - Flash persistence (Sector 3)
 ****************************************************************************************************
 */

#include "servo_comp.h"
#include "modbus.h"
#include "pwm.h"
#include <string.h>

static servo_comp_data_t g_servo_comp;

/* ---- CRC ----------------------------------------------------------------- */

static uint32_t servo_comp_crc(const servo_comp_data_t *p)
{
    uint32_t crc = 0;
    const uint8_t *d = (const uint8_t *)p;
    uint32_t len = (uint32_t)((const uint8_t *)&p->crc - (const uint8_t *)p);
    for (uint32_t i = 0; i < len; i++)
        crc = (crc << 1) ^ d[i];
    return crc;
}

/* ---- Default ---------------------------------------------------------------- */

static void servo_comp_reset_default(void)
{
    uint8_t i;
    g_servo_comp.magic = SERVO_COMP_MAGIC;
    for (i = 0; i < SERVO_COMP_CH_COUNT; i++) {
        g_servo_comp.base_angle[i] = 0.0f;
        g_servo_comp.k_roll[i]     = 0.0f;
        g_servo_comp.k_pitch[i]    = 0.0f;
        g_servo_comp.k_yaw[i]      = 0.0f;
        g_servo_comp.auto_en[i]    = 0;
    }
    memset(g_servo_comp._pad, 0, sizeof(g_servo_comp._pad));
    g_servo_comp.crc = servo_comp_crc(&g_servo_comp);
}

/* ---- Public API ----------------------------------------------------------- */

void servo_comp_init(void)
{
    servo_comp_data_t tmp;
    memcpy(&tmp, (const void *)SERVO_COMP_FLASH_ADDR, sizeof(servo_comp_data_t));
    if (tmp.magic == SERVO_COMP_MAGIC && servo_comp_crc(&tmp) == tmp.crc)
        memcpy(&g_servo_comp, &tmp, sizeof(servo_comp_data_t));
    else
        servo_comp_reset_default();
}

void servo_comp_apply(uint16_t *regs)
{
    uint8_t i;
    for (i = 0; i < SERVO_COMP_CH_COUNT; i++) {
        uint16_t base = (uint16_t)(REG_SERVO1_BASE + (uint16_t)i * 8u);
        uint32_t raw;

        memcpy(&raw, &g_servo_comp.base_angle[i], 4);
        regs[base]     = (uint16_t)(raw >> 16);
        regs[base + 1] = (uint16_t)(raw & 0xFFFFu);

        memcpy(&raw, &g_servo_comp.k_roll[i], 4);
        regs[base + 2] = (uint16_t)(raw >> 16);
        regs[base + 3] = (uint16_t)(raw & 0xFFFFu);

        memcpy(&raw, &g_servo_comp.k_pitch[i], 4);
        regs[base + 4] = (uint16_t)(raw >> 16);
        regs[base + 5] = (uint16_t)(raw & 0xFFFFu);

        memcpy(&raw, &g_servo_comp.k_yaw[i], 4);
        regs[base + 6] = (uint16_t)(raw >> 16);
        regs[base + 7] = (uint16_t)(raw & 0xFFFFu);

        regs[REG_SERVO1_AUTO_EN + i] = g_servo_comp.auto_en[i];
    }
}

void servo_comp_set_data(const servo_comp_data_t *src, uint16_t *regs)
{
    memcpy(&g_servo_comp, src, sizeof(servo_comp_data_t));
    servo_comp_apply(regs);
}

void servo_comp_update(float roll, float pitch, float yaw)
{
    static uint32_t s_last_tick          = 0;
    static uint16_t s_last_duty[SERVO_COMP_CH_COUNT] = {0};
    uint8_t i;

    /* Rate-limit: update servos at most every 20 ms (50 Hz) */
    uint32_t now = HAL_GetTick();
    if ((now - s_last_tick) < 20u) return;
    s_last_tick = now;

    for (i = 0; i < SERVO_COMP_CH_COUNT; i++)
    {
        /* Read enable flag directly from Modbus register so upper-computer
         * writes take effect immediately without needing g_servo_comp sync. */
        if (!modbus_get_register(REG_SERVO1_AUTO_EN + i)) continue;

        /* Read compensation coefficients from Modbus registers (always current) */
        uint16_t base = (uint16_t)(REG_SERVO1_BASE + i * 8);
        float base_angle = modbus_get_register_float(base);
        float k_roll     = modbus_get_register_float((uint16_t)(base + 2));
        float k_pitch    = modbus_get_register_float((uint16_t)(base + 4));
        float k_yaw      = modbus_get_register_float((uint16_t)(base + 6));

        float angle = base_angle
                    + k_roll  * roll
                    + k_pitch * pitch
                    + k_yaw   * yaw;

        /* PWM formula matches upper-computer convention:
         *   SERVO_ZERO = 500 µs, SERVO_US_PER_DEG = 10 µs/°
         *   duty = 500 + angle * 10  →  0°=500µs  90°=1400µs  180°=2300µs */
        int32_t duty = (int32_t)(500.0f + angle * 10.0f);
        if (duty < 500)  duty = 500;
        if (duty > 2500) duty = 2500;

        /* Deadband: skip update if change < 5 µs (~0.9°) to suppress noise jitter */
        int32_t diff = duty - (int32_t)s_last_duty[i];
        if (diff > -5 && diff < 5) continue;
        s_last_duty[i] = (uint16_t)duty;

        modbus_set_register(REG_SERVO1 + i, (uint16_t)duty);
        pwm_set_duty((uint8_t)(PWM_CH_SERVO_1 + i), (uint16_t)duty);
    }
}

HAL_StatusTypeDef servo_comp_save(const uint16_t *regs)
{
    FLASH_EraseInitTypeDef erase;
    uint32_t err = 0;
    HAL_StatusTypeDef st;
    uint8_t i;

    /* Build struct from current Modbus register values */
    g_servo_comp.magic = SERVO_COMP_MAGIC;
    for (i = 0; i < SERVO_COMP_CH_COUNT; i++) {
        uint16_t base = (uint16_t)(REG_SERVO1_BASE + (uint16_t)i * 8u);
        uint32_t raw;

        raw = ((uint32_t)regs[base] << 16) | regs[base + 1];
        memcpy(&g_servo_comp.base_angle[i], &raw, 4);

        raw = ((uint32_t)regs[base + 2] << 16) | regs[base + 3];
        memcpy(&g_servo_comp.k_roll[i], &raw, 4);

        raw = ((uint32_t)regs[base + 4] << 16) | regs[base + 5];
        memcpy(&g_servo_comp.k_pitch[i], &raw, 4);

        raw = ((uint32_t)regs[base + 6] << 16) | regs[base + 7];
        memcpy(&g_servo_comp.k_yaw[i], &raw, 4);

        g_servo_comp.auto_en[i] = (uint8_t)regs[REG_SERVO1_AUTO_EN + i];
    }
    memset(g_servo_comp._pad, 0, sizeof(g_servo_comp._pad));
    g_servo_comp.crc = servo_comp_crc(&g_servo_comp);

    /* Erase Sector 3 */
    HAL_FLASH_Unlock();
    erase.TypeErase    = FLASH_TYPEERASE_SECTORS;
    erase.VoltageRange = FLASH_VOLTAGE_RANGE_3;
    erase.Sector       = SERVO_COMP_FLASH_SECTOR;
    erase.NbSectors    = 1;
    st = HAL_FLASHEx_Erase(&erase, &err);

    /* Program word-by-word */
    if (st == HAL_OK) {
        uint32_t *src = (uint32_t *)&g_servo_comp;
        uint32_t cnt  = (sizeof(servo_comp_data_t) + 3u) / 4u;
        for (uint32_t j = 0; j < cnt && st == HAL_OK; j++) {
            st = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD,
                                   SERVO_COMP_FLASH_ADDR + j * 4u, src[j]);
        }
    }
    HAL_FLASH_Lock();
    return st;
}
