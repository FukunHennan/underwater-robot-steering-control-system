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
 *  0x0030 ANALOG1        R    Analog input CH0 (uint16)
 *  0x0031 ANALOG2        R    Analog input CH1 (uint16)
 *  0x0032 ANALOG3        R    Analog input CH2 (uint16)
 *  0x0033 ANALOG4        R    Analog input CH3 (uint16)
 *  0x0034 VOLTAGE        R    x100 V
 *  0x0035 ADC_RAW0       R    12-bit raw
 *  0x0036 ADC_RAW1       R    12-bit raw
 *  0x0037 ADC_RAW2       R    12-bit raw
 *  0x0038 ADC_RAW3       R    12-bit raw
 *  0x0039 ADC_RAW4       R    12-bit raw
 *
 *  PWM Frequency (0x0040 - 0x0047)  freq = TIM_CLK/(psc+1)/(arr+1)
 *  0x0040 PWM_ARR_G1     R/W  TIM4 period   (CH1-4,  84MHz)
 *  0x0041 PWM_PSC_G1     R/W  TIM4 prescaler
 *  0x0042 PWM_ARR_G2     R/W  TIM8 period   (CH5-6, 168MHz)
 *  0x0043 PWM_PSC_G2     R/W  TIM8 prescaler
 *  0x0044 PWM_ARR_G3     R/W  TIM3 period   (CH7-8,  84MHz)
 *  0x0045 PWM_PSC_G3     R/W  TIM3 prescaler
 *  0x0046 PWM_ARR_G4     R/W  TIM1 period   (LED1-2,168MHz)
 *  0x0047 PWM_PSC_G4     R/W  TIM1 prescaler
 *
 *  Barometer / MS901M (0x0048 - 0x004D)
 *  0x0048 PRESSURE_H     R    Pressure high 16-bit (int32, Pa)
 *  0x0049 PRESSURE_L     R    Pressure low  16-bit
 *  0x004A ALTITUDE_H     R    Altitude high 16-bit (int32, cm)
 *  0x004B ALTITUDE_L     R    Altitude low  16-bit
 *  0x004C BARO_TEMP_H    R    Temperature float high (IEEE 754, deg C)
 *  0x004D BARO_TEMP_L    R    Temperature float low
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
#define REG_ANALOG1           48
#define REG_ANALOG2           49
#define REG_ANALOG3           50
#define REG_ANALOG4           51
#define REG_VOLTAGE           52
#define REG_ADC_RAW0          53
#define REG_ADC_RAW1          54
#define REG_ADC_RAW2          55
#define REG_ADC_RAW3          56
#define REG_ADC_RAW4          57

/* PWM frequency registers: 0x0040 - 0x0047 (ARR + PSC per timer group) */
#define REG_PWM_ARR_G1        64     /* 0x0040 TIM4 period   (CH1-4)  */
#define REG_PWM_PSC_G1        65     /* 0x0041 TIM4 prescaler         */
#define REG_PWM_ARR_G2        66     /* 0x0042 TIM8 period   (CH5-6)  */
#define REG_PWM_PSC_G2        67     /* 0x0043 TIM8 prescaler         */
#define REG_PWM_ARR_G3        68     /* 0x0044 TIM3 period   (CH7-8)  */
#define REG_PWM_PSC_G3        69     /* 0x0045 TIM3 prescaler         */
#define REG_PWM_ARR_G4        70     /* 0x0046 TIM1 period   (LED1-2) */
#define REG_PWM_PSC_G4        71     /* 0x0047 TIM1 prescaler         */

/* Barometer registers: 0x0048 - 0x004D */
#define REG_PRESSURE_H        72     /* 0x0048 Pressure high (int32, Pa) */
#define REG_PRESSURE_L        73     /* 0x0049 Pressure low              */
#define REG_ALTITUDE_H        74     /* 0x004A Altitude high (int32, cm) */
#define REG_ALTITUDE_L        75     /* 0x004B Altitude low              */
#define REG_BARO_TEMP         76     /* 0x004C-0x004D Temperature (float, deg C) */

/* Total register count */
#define REG_HOLDING_MAX       78

void modbus_init(void);
void modbus_process(void);
void modbus_update_sensors(void);

uint16_t modbus_get_register(uint16_t addr);
void modbus_set_register(uint16_t addr, uint16_t value);
void modbus_set_register_float(uint16_t addr, float value);
float modbus_get_register_float(uint16_t addr);
void modbus_set_register_int32(uint16_t addr, int32_t value);

#endif
