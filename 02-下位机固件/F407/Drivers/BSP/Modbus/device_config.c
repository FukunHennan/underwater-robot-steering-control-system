/**
 ****************************************************************************************************
 * @file        device_config.c
 * @author      chenfukun
 * @brief       统一设备配置 Flash 持久化实现
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 */

#include "device_config.h"
#include "servo_comp.h"
#include "modbus.h"
#include <string.h>

/* ---- CRC ----------------------------------------------------------------- */

static uint32_t dcfg_crc(const device_config_t *p)
{
    uint32_t crc = 0;
    const uint8_t *d = (const uint8_t *)p;
    uint32_t len = (uint32_t)((const uint8_t *)&p->crc - (const uint8_t *)p);
    for (uint32_t i = 0; i < len; i++)
        crc = (crc << 1) ^ d[i];
    return crc;
}

/* ---- Float <-> register pair helpers ------------------------------------- */

static float dcfg_regs_to_float(const uint16_t *regs, uint16_t addr)
{
    uint32_t raw = ((uint32_t)regs[addr] << 16) | regs[addr + 1];
    float v;
    memcpy(&v, &raw, 4);
    return v;
}

static void dcfg_float_to_regs(uint16_t *regs, uint16_t addr, float v)
{
    uint32_t raw;
    memcpy(&raw, &v, 4);
    regs[addr]     = (uint16_t)(raw >> 16);
    regs[addr + 1] = (uint16_t)(raw & 0xFFFFu);
}

/* ---- Public API ---------------------------------------------------------- */

uint8_t device_config_load(uint16_t *regs)
{
    device_config_t tmp;
    servo_comp_data_t sc;
    uint8_t ch, i;

    memcpy(&tmp, (const void *)DEVICE_CONFIG_FLASH_ADDR, sizeof(device_config_t));
    if (tmp.magic != DEVICE_CONFIG_MAGIC || dcfg_crc(&tmp) != tmp.crc)
        return 0;

    /* 1. ADC 校准 → g_calib + Modbus 寄存器 */
    g_calib.magic = CALIB_MAGIC;
    for (ch = 0; ch < CALIB_CH_COUNT; ch++)
    {
        g_calib.gain  [ch] = tmp.calib_gain[ch];
        g_calib.offset[ch] = tmp.calib_off [ch];
        dcfg_float_to_regs(regs, (uint16_t)(REG_CAL_VOLT_GAIN + ch * 4),     tmp.calib_gain[ch]);
        dcfg_float_to_regs(regs, (uint16_t)(REG_CAL_VOLT_GAIN + ch * 4 + 2), tmp.calib_off [ch]);
    }

    /* 2. 卡尔曼 Q/R → g_kalman[]
     *    寄存器镜像由 modbus_init() 随后调用的 modbus_sync_kalman_to_regs() 完成 */
    for (ch = 0; ch < KALMAN_CH_COUNT; ch++)
        kalman_set_params(ch, tmp.kalman_q[ch], tmp.kalman_r[ch]);

    /* 3. 舵机补偿系数 → g_servo_comp + Modbus 寄存器 (经 servo_comp_set_data) */
    sc.magic = SERVO_COMP_MAGIC;
    for (i = 0; i < 8; i++)
    {
        sc.base_angle[i] = tmp.servo_base [i];
        sc.k_roll    [i] = tmp.servo_roll [i];
        sc.k_pitch   [i] = tmp.servo_pitch[i];
        sc.k_yaw     [i] = tmp.servo_yaw  [i];
        sc.auto_en   [i] = tmp.servo_en   [i];
    }
    memset(sc._pad, 0, sizeof(sc._pad));
    sc.crc = 0;
    servo_comp_set_data(&sc, regs);   /* 同步 g_servo_comp 并镜像到寄存器 */

    return 1;
}

HAL_StatusTypeDef device_config_save(const uint16_t *regs)
{
    device_config_t data;
    FLASH_EraseInitTypeDef erase;
    uint32_t err = 0;
    HAL_StatusTypeDef st;
    uint8_t ch, i;

    data.magic = DEVICE_CONFIG_MAGIC;

    /* 1. 从 g_calib 读取校准参数 */
    for (ch = 0; ch < CALIB_CH_COUNT; ch++)
    {
        data.calib_gain[ch] = g_calib.gain  [ch];
        data.calib_off [ch] = g_calib.offset[ch];
    }

    /* 2. 从 g_kalman[] 读取卡尔曼参数 */
    for (ch = 0; ch < KALMAN_CH_COUNT; ch++)
    {
        data.kalman_q[ch] = g_kalman[ch].q;
        data.kalman_r[ch] = g_kalman[ch].r;
    }

    /* 3. 从 Modbus 寄存器读取舵机补偿系数 */
    for (i = 0; i < 8; i++)
    {
        uint16_t base = (uint16_t)(REG_SERVO1_BASE + i * 8);
        data.servo_base [i] = dcfg_regs_to_float(regs, base);
        data.servo_roll [i] = dcfg_regs_to_float(regs, (uint16_t)(base + 2));
        data.servo_pitch[i] = dcfg_regs_to_float(regs, (uint16_t)(base + 4));
        data.servo_yaw  [i] = dcfg_regs_to_float(regs, (uint16_t)(base + 6));
        data.servo_en   [i] = (uint8_t)regs[REG_SERVO1_AUTO_EN + i];
    }
    memset(data._pad, 0, sizeof(data._pad));
    data.crc = dcfg_crc(&data);

    /* 单次擦除 Sector 2 (~300ms) + 写入 */
    HAL_FLASH_Unlock();
    erase.TypeErase    = FLASH_TYPEERASE_SECTORS;
    erase.VoltageRange = FLASH_VOLTAGE_RANGE_3;
    erase.Sector       = DEVICE_CONFIG_FLASH_SECTOR;
    erase.NbSectors    = 1;
    st = HAL_FLASHEx_Erase(&erase, &err);

    if (st == HAL_OK)
    {
        uint32_t *src = (uint32_t *)&data;
        uint32_t  cnt = (sizeof(device_config_t) + 3u) / 4u;
        for (uint32_t j = 0; j < cnt && st == HAL_OK; j++)
            st = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD,
                                   DEVICE_CONFIG_FLASH_ADDR + j * 4u, src[j]);
    }

    HAL_FLASH_Lock();
    return st;
}
