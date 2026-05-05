/**
 ****************************************************************************************************
 * @file        kalman_persist.c
 * @author      chenfukun
 * @brief       Kalman Q/R parameter Flash persistence (Sector 4)
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 */

#include "kalman_persist.h"
#include "kalman.h"
#include <string.h>

/* ---- CRC ----------------------------------------------------------------- */

static uint32_t kalman_persist_crc(const kalman_persist_data_t *p)
{
    uint32_t crc = 0;
    const uint8_t *d = (const uint8_t *)p;
    uint32_t len = (uint32_t)((const uint8_t *)&p->crc - (const uint8_t *)p);
    for (uint32_t i = 0; i < len; i++)
        crc = (crc << 1) ^ d[i];
    return crc;
}

/* ---- Public API ---------------------------------------------------------- */

void kalman_persist_init(void)
{
    kalman_persist_data_t tmp;
    memcpy(&tmp, (const void *)KALMAN_PERSIST_FLASH_ADDR, sizeof(kalman_persist_data_t));
    if (tmp.magic == KALMAN_PERSIST_MAGIC && kalman_persist_crc(&tmp) == tmp.crc)
    {
        uint8_t ch;
        for (ch = 0; ch < 6; ch++)
            kalman_set_params(ch, tmp.q[ch], tmp.r[ch]);
    }
    /* If invalid: keep defaults already set by kalman_init() in demo.c */
}

HAL_StatusTypeDef kalman_persist_save(void)
{
    kalman_persist_data_t data;
    FLASH_EraseInitTypeDef erase;
    uint32_t err = 0;
    HAL_StatusTypeDef st;
    uint8_t ch;

    data.magic = KALMAN_PERSIST_MAGIC;
    for (ch = 0; ch < 6; ch++)
    {
        data.q[ch] = g_kalman[ch].q;
        data.r[ch] = g_kalman[ch].r;
    }
    data.crc = kalman_persist_crc(&data);

    HAL_FLASH_Unlock();
    erase.TypeErase    = FLASH_TYPEERASE_SECTORS;
    erase.VoltageRange = FLASH_VOLTAGE_RANGE_3;
    erase.Sector       = KALMAN_PERSIST_FLASH_SECTOR;
    erase.NbSectors    = 1;
    st = HAL_FLASHEx_Erase(&erase, &err);

    if (st == HAL_OK)
    {
        uint32_t *src = (uint32_t *)&data;
        uint32_t cnt  = (sizeof(kalman_persist_data_t) + 3u) / 4u;
        for (uint32_t j = 0; j < cnt && st == HAL_OK; j++)
            st = HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD,
                                   KALMAN_PERSIST_FLASH_ADDR + j * 4u, src[j]);
    }

    HAL_FLASH_Lock();
    return st;
}
