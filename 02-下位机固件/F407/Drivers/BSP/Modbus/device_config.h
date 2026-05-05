/**
 ****************************************************************************************************
 * @file        device_config.h
 * @author      chenfukun
 * @brief       统一设备配置 Flash 持久化 (Sector 2, 0x08008000, 16KB)
 *
 *  将 ADC 校准 + 卡尔曼 Q/R + 舵机姿态补偿三组参数合并为一个配置块，
 *  单次擦除（~300ms）完成所有数据持久化，比三次分开擦除快约 10 倍。
 *
 *  Flash 布局 (Sector 2, 16KB):
 *    0x08008000: device_config_t  (~260 B, 远小于 16KB)
 *
 *  与旧格式兼容说明:
 *    首次烧录新固件时 Sector 2 可能存有旧的 calib_data_t。
 *    由于 magic 不同（DEVICE_CONFIG_MAGIC ≠ CALIB_MAGIC），
 *    device_config_load() 会返回 0 并保留 calib_init() 的默认/旧值，
 *    用户执行任意一次"保存到 Flash"后即迁移到统一格式。
 *
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 */

#ifndef __DEVICE_CONFIG_H
#define __DEVICE_CONFIG_H

#include "stdint.h"
#include "stm32f4xx_hal.h"
#include "calib.h"   /* CALIB_CH_COUNT, calib_data_t */
#include "kalman.h"  /* KALMAN_CH_COUNT */

/* Flash 存储参数 */
#define DEVICE_CONFIG_FLASH_ADDR    0x08008000U   /* Sector 2 起始地址 (16KB) */
#define DEVICE_CONFIG_FLASH_SECTOR  FLASH_SECTOR_2
#define DEVICE_CONFIG_MAGIC         0xCF9A12E7U   /* 统一配置魔数 */

/**
 * @brief  统一设备配置结构体
 *         ADC 校准 (5ch) + 卡尔曼 Q/R (6ch) + 舵机补偿 (8ch) 合并存储
 */
typedef struct
{
    uint32_t magic;

    /* ADC 校准 */
    float    calib_gain [CALIB_CH_COUNT];   /* 增益 × 5 */
    float    calib_off  [CALIB_CH_COUNT];   /* 偏移 × 5 */

    /* 卡尔曼滤波参数 */
    float    kalman_q   [KALMAN_CH_COUNT];  /* 过程噪声 Q × 6 */
    float    kalman_r   [KALMAN_CH_COUNT];  /* 观测噪声 R × 6 */

    /* 舵机姿态补偿系数 */
    float    servo_base [8];               /* 基础角度 (deg) × 8 */
    float    servo_roll [8];               /* Roll  系数 × 8 */
    float    servo_pitch[8];               /* Pitch 系数 × 8 */
    float    servo_yaw  [8];               /* Yaw   系数 × 8 */
    uint8_t  servo_en   [8];               /* 自动补偿使能标志 × 8 */
    uint8_t  _pad[4];                      /* 4 字节对齐填充 */

    uint32_t crc;
} device_config_t;

/**
 * @brief  从 Flash 加载统一配置，写入 g_calib / g_kalman[] / 舵机 Modbus 寄存器。
 *         在 modbus_init() 中调用；若 Flash 数据无效则保持各模块的默认值不变。
 * @param  regs  指向 g_modbus_registers[0]
 * @return 1 = Flash 数据有效并已加载; 0 = Flash 数据无效，使用默认值
 */
uint8_t device_config_load(uint16_t *regs);

/**
 * @brief  一次性将 g_calib / g_kalman[] / 舵机 Modbus 寄存器保存到 Flash。
 *         单次擦除 Sector 2 (~300ms) 完成全部持久化。
 *         只能从主循环调用（不能在 eMBRegHoldingCB 中调用）。
 * @param  regs  指向 g_modbus_registers[0]（只读）
 * @return HAL_OK 成功
 */
HAL_StatusTypeDef device_config_save(const uint16_t *regs);

#endif /* __DEVICE_CONFIG_H */
