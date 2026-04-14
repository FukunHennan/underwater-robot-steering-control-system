/**
 ****************************************************************************************************
 * @file        modbus.h
 * @author      chenfukun
 * @version     V3.0
 * @date        2026-04-14
 * @brief       Modbus RTU Slave Header for STM32F407
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 * @attention
 *
 * Project Name: Underwater Intelligent Steering System
 * Test Platform: STM32F407
 *
 * Modbus RTU Slave Header based on FreeModbus
 *
 ****************************************************************************************************
 */

#ifndef __MODBUS_H
#define __MODBUS_H

#include "stdint.h"

/* ============================================================
 *  Modbus Holding Register Address Map
 *  Slave: 0x01 | Baud: 9600 | 8N1 | Modbus RTU
 * ============================================================
 *
 *  Addr   Name          R/W   Unit / Description
 *  ------ ------------- ----- ----------------------------
 *  System (0x0000 - 0x0005)
 *  0x0000 DEVICE_ID      R    Fixed 0x0407
 *  0x0001 FW_VERSION     R    Fixed 0x0300 (V3.0)
 *  0x0002 RUN_MODE       R/W  0=idle 1=manual 2=auto
 *  0x0003 FAULT_CODE     R    Bitmap
 *  0x0004 SYS_TICK_L     R    ms low  16-bit
 *  0x0005 SYS_TICK_H     R    ms high 16-bit
 *
 *  Attitude / MS901M (0x0010 - 0x001B) IEEE 754 float, 2 regs each
 *  0x0010 ROLL_H/L       R    Roll  (deg)  float = [H]<<16 | [L]
 *  0x0012 PITCH_H/L      R    Pitch (deg)
 *  0x0014 YAW_H/L        R    Yaw   (deg)
 *  0x0016 GYRO_X_H/L     R    Gyro X (dps)
 *  0x0018 GYRO_Y_H/L     R    Gyro Y (dps)
 *  0x001A GYRO_Z_H/L     R    Gyro Z (dps)
 *
 *  PWM Control (0x0020 - 0x0029)
 *  0x0020 SERVO1         R/W  PWM us (500-2500)
 *  0x0021 SERVO2         R/W
 *  0x0022 SERVO3         R/W
 *  0x0023 SERVO4         R/W
 *  0x0024 SERVO5         R/W
 *  0x0025 SERVO6         R/W
 *  0x0026 SERVO7         R/W
 *  0x0027 SERVO8         R/W
 *  0x0028 LED1           R/W  PWM duty (0-1000)
 *  0x0029 LED2           R/W  PWM duty (0-1000)
 *
 *  ADC Sensors (0x0030 - 0x0039)
 *  0x0030 TEMP1          R    x10 deg-C (int16)
 *  0x0031 TEMP2          R    x10 deg-C (int16)
 *  0x0032 TEMP3          R    x10 deg-C (int16)
 *  0x0033 TEMP4          R    x10 deg-C (int16)
 *  0x0034 VOLTAGE        R    x100 V
 *  0x0035 ADC_RAW0       R    12-bit raw
 *  0x0036 ADC_RAW1       R    12-bit raw
 *  0x0037 ADC_RAW2       R    12-bit raw
 *  0x0038 ADC_RAW3       R    12-bit raw
 *  0x0039 ADC_RAW4       R    12-bit raw
 * ============================================================ */

/* System registers: 0x0000 - 0x0005 */
#define REG_DEVICE_ID         0
#define REG_FW_VERSION        1
#define REG_RUN_MODE          2
#define REG_FAULT_CODE        3
#define REG_SYS_TICK_L        4
#define REG_SYS_TICK_H        5

/* Attitude registers: 0x0010 - 0x001B (float = 2 regs, Big-Endian word order) */
#define REG_ROLL              16     /* 0x0010-0x0011 */
#define REG_PITCH             18     /* 0x0012-0x0013 */
#define REG_YAW               20     /* 0x0014-0x0015 */
#define REG_GYRO_X            22     /* 0x0016-0x0017 */
#define REG_GYRO_Y            24     /* 0x0018-0x0019 */
#define REG_GYRO_Z            26     /* 0x001A-0x001B */

/* PWM control registers: 0x0020 - 0x0029 */
#define REG_SERVO1            32
#define REG_SERVO2            33
#define REG_SERVO3            34
#define REG_SERVO4            35
#define REG_SERVO5            36
#define REG_SERVO6            37
#define REG_SERVO7            38
#define REG_SERVO8            39
#define REG_LED1              40
#define REG_LED2              41

/* ADC sensor registers: 0x0030 - 0x0039 */
#define REG_TEMP1             48
#define REG_TEMP2             49
#define REG_TEMP3             50
#define REG_TEMP4             51
#define REG_VOLTAGE           52
#define REG_ADC_RAW0          53
#define REG_ADC_RAW1          54
#define REG_ADC_RAW2          55
#define REG_ADC_RAW3          56
#define REG_ADC_RAW4          57

/* Total register count */
#define REG_HOLDING_MAX       58

void modbus_init(void);
void modbus_process(void);
void modbus_update_sensors(void);

uint16_t modbus_get_register(uint16_t addr);
void modbus_set_register(uint16_t addr, uint16_t value);
void modbus_set_register_float(uint16_t addr, float value);
float modbus_get_register_float(uint16_t addr);

#endif
