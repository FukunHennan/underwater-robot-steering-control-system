/**
 ****************************************************************************************************
 * @file        calib.c
 * @author      chenfukun
 * @brief       ADC 校准模块 - Flash 持久化实现
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 */

#include "calib.h"
#include <string.h>

/* ---------- 全局校准数据 ---------- */
calib_data_t g_calib;

/* ---------- 内部函数 ---------- */

/**
 * @brief  计算 calib_data_t 的校验和 (不含 crc 字段本身)
 */
static uint32_t calib_calc_crc(const calib_data_t *p)
{
    uint32_t sum = 0;
    const uint8_t *data = (const uint8_t *)p;
    uint32_t len = (uint32_t)((const uint8_t *)&p->crc - (const uint8_t *)p);
    uint32_t i;
    for (i = 0; i < len; i++)
    {
        sum = (sum << 1) ^ data[i];
    }
    return sum;
}

/**
 * @brief  校验从 Flash 读出的数据是否合法
 */
static uint8_t calib_is_valid(const calib_data_t *p)
{
    if (p->magic != CALIB_MAGIC) {
        return 0;
    }
    if (calib_calc_crc(p) != p->crc) {
        return 0;
    }
    return 1;
}

/**
 * @brief  从 Flash 读取校准数据到目标缓冲区
 */
static void calib_read_flash(calib_data_t *dst)
{
    memcpy(dst, (const void *)CALIB_FLASH_ADDR, sizeof(calib_data_t));
}

/* ---------- 公开接口 ---------- */

void calib_reset_default(void)
{
    uint8_t i;
    g_calib.magic = CALIB_MAGIC;
    for (i = 0; i < CALIB_CH_COUNT; i++)
    {
        g_calib.gain[i]   = 1.0f;
        g_calib.offset[i] = 0.0f;
    }
    g_calib.crc = calib_calc_crc(&g_calib);
}

void calib_init(void)
{
    calib_data_t tmp;
    calib_read_flash(&tmp);
    if (calib_is_valid(&tmp))
    {
        /* Flash 数据合法, 加载到 RAM */
        memcpy(&g_calib, &tmp, sizeof(calib_data_t));
    }
    else
    {
        /* Flash 数据无效或首次上电, 使用默认值 */
        calib_reset_default();
    }
}

HAL_StatusTypeDef calib_save_to_flash(void)
{
    HAL_StatusTypeDef status;
    FLASH_EraseInitTypeDef erase;
    uint32_t err = 0;
    uint32_t i;
    uint32_t *src;
    uint32_t word_count;

    /* 更新 CRC */
    g_calib.magic = CALIB_MAGIC;
    g_calib.crc   = calib_calc_crc(&g_calib);

    HAL_FLASH_Unlock();

    /* 擦除 Sector 7 */
    erase.TypeErase    = FLASH_TYPEERASE_SECTORS;
    erase.VoltageRange = FLASH_VOLTAGE_RANGE_3;  /* 2.7V-3.6V, word 编程 */
    erase.Sector       = CALIB_FLASH_SECTOR;
    erase.NbSectors    = 1;
    status = HAL_FLASHEx_Erase(&erase, &err);
    if (status != HAL_OK)
    {
        HAL_FLASH_Lock();
        return status;
    }

    /* 按 word (32-bit) 写入 */
    src        = (uint32_t *)&g_calib;
    word_count = (sizeof(calib_data_t) + 3U) / 4U;
    for (i = 0; i < word_count; i++)
    {
        status = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD,
                                   CALIB_FLASH_ADDR + i * 4U,
                                   src[i]);
        if (status != HAL_OK)
        {
            HAL_FLASH_Lock();
            return status;
        }
    }

    HAL_FLASH_Lock();
    return HAL_OK;
}

float calib_apply(uint8_t ch, float raw)
{
    if (ch >= CALIB_CH_COUNT)
    {
        return raw;
    }
    return g_calib.gain[ch] * raw + g_calib.offset[ch];
}
