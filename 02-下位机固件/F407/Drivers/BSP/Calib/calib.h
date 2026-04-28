/**
 ****************************************************************************************************
 * @file        calib.h
 * @author      chenfukun
 * @brief       ADC 校准模块 - Flash 持久化
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 *
 *  校准模型: y = gain * x + offset
 *    - x: 原始物理量 (VOLTAGE=V, ANALOG1-4=0~4095 原始ADC值)
 *    - y: 校准后输出值
 *
 *  存储位置: Flash Sector 2, 0x08008000 (16KB)
 *            F407VET6 共 512KB Flash, 固件仅占 Sector 0-1 (~25KB)
 *            选用小扇区 (Sector 2 = 16KB, 擦除 ~300ms) 以减小对 Modbus 的干扰;
 *            相比 Sector 7 (128KB, ~1.5s) 擦除时间缩短约 5 倍。
 *
 ****************************************************************************************************
 */

#ifndef __CALIB_H
#define __CALIB_H

#include "stdint.h"
#include "stm32f4xx_hal.h"

/* 通道数量: VOLTAGE + ANALOG1-4 */
#define CALIB_CH_COUNT        5

/* 通道索引 */
#define CALIB_CH_VOLTAGE      0
#define CALIB_CH_ANALOG1      1
#define CALIB_CH_ANALOG2      2
#define CALIB_CH_ANALOG3      3
#define CALIB_CH_ANALOG4      4

/* Flash 存储参数 */
#define CALIB_FLASH_ADDR      0x08008000U   /* Sector 2 起始地址 (16KB) */
#define CALIB_FLASH_SECTOR    FLASH_SECTOR_2
#define CALIB_MAGIC           0xC41BA71CU   /* 魔数标记 */

/* 命令寄存器值 */
#define CALIB_CMD_SAVE        0x5A5A        /* 保存到 Flash */
#define CALIB_CMD_RESET       0xA5A5        /* 恢复默认 */

/* 状态寄存器值 */
#define CALIB_STATUS_IDLE     0x0000
#define CALIB_STATUS_OK       0x0001
#define CALIB_STATUS_ERROR    0x00FF

/**
 * @brief  校准数据结构 (必须 4 字节对齐)
 */
typedef struct
{
    uint32_t magic;                      /* 0xC41BA71C 有效标记 */
    float    gain[CALIB_CH_COUNT];       /* 增益系数, 默认 1.0 */
    float    offset[CALIB_CH_COUNT];     /* 偏移量, 默认 0.0 */
    uint32_t crc;                        /* 简单累加校验 */
} calib_data_t;

/* 全局校准数据 (RAM 镜像) */
extern calib_data_t g_calib;

/**
 * @brief  初始化校准模块, 上电时调用
 *         尝试从 Flash 加载, 若无效则使用默认值
 */
void calib_init(void);

/**
 * @brief  恢复所有通道为默认值 (gain=1.0, offset=0.0), 仅改 RAM
 */
void calib_reset_default(void);

/**
 * @brief  把当前 RAM 中的校准值保存到 Flash (整扇区擦除 + 写入)
 * @return HAL_OK 成功, 其他失败
 */
HAL_StatusTypeDef calib_save_to_flash(void);

/**
 * @brief  对指定通道的原始值应用校准
 * @param  ch   通道索引 CALIB_CH_xxx
 * @param  raw  原始值
 * @return 校准后的值 = gain * raw + offset
 */
float calib_apply(uint8_t ch, float raw);

#endif
