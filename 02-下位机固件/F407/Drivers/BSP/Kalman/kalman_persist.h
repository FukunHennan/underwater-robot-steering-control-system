/**
 ****************************************************************************************************
 * @file        kalman_persist.h
 * @author      chenfukun
 * @brief       Kalman Q/R parameter Flash persistence (Sector 4, 0x08010000)
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 *
 *  存储位置: Flash Sector 4, 0x08010000 (64KB)
 *            Sector 2 = calib (16KB), Sector 3 = servo_comp (16KB), Sector 4 = kalman (64KB)
 *
 ****************************************************************************************************
 */

#ifndef __KALMAN_PERSIST_H
#define __KALMAN_PERSIST_H

#include "stdint.h"
#include "stm32f4xx_hal.h"

/* Flash 存储参数 */
#define KALMAN_PERSIST_FLASH_ADDR    0x08010000U   /* Sector 4 起始地址 (64KB) */
#define KALMAN_PERSIST_FLASH_SECTOR  FLASH_SECTOR_4
#define KALMAN_PERSIST_MAGIC         0x4B514C4DU   /* 'K','Q','L','M' */

/* KALMAN_CMD 寄存器命令值 */
#define KALMAN_CMD_SAVE              0x5A5A        /* 保存 Q/R 到 Flash */
#define KALMAN_CMD_RESET             0x0001        /* 复位滤波器状态 */

/**
 * @brief  Kalman Q/R 参数 Flash 存储结构
 */
typedef struct
{
    uint32_t magic;       /* KALMAN_PERSIST_MAGIC 有效标记 */
    float    q[6];        /* 过程噪声: Roll/Pitch/Yaw/GyroX/GyroY/GyroZ */
    float    r[6];        /* 观测噪声: Roll/Pitch/Yaw/GyroX/GyroY/GyroZ */
    uint32_t crc;         /* 简单累加校验 */
} kalman_persist_data_t;

/**
 * @brief  初始化: 从 Flash 加载 Q/R, 若无效则保持 kalman_init() 设置的默认值.
 *         必须在 demo.c 的 kalman_init() 之后、modbus_sync_kalman_to_regs() 之前调用.
 */
void kalman_persist_init(void);

/**
 * @brief  将当前 g_kalman[] 的 Q/R 保存到 Flash.
 *         只能在主循环中调用 (不能在 eMBRegHoldingCB 中调用).
 * @return HAL_OK 成功
 */
HAL_StatusTypeDef kalman_persist_save(void);

#endif /* __KALMAN_PERSIST_H */
