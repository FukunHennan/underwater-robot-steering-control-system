/**
 ****************************************************************************************************
 * @file        servo_comp.c
 * @author      chenfukun
 * @brief       Servo attitude compensation - Flash persistence (Sector 3)
 ****************************************************************************************************
 */

#include "servo_comp.h"
#include "modbus.h"
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
