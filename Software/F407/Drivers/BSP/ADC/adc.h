/**
 ****************************************************************************************************
 * @file        adc.h
 * @author      chenfukun
 * @version     V1.1
 * @date        2026-04-14
 * @brief       水下智能转向系统 - ADC 驱动头文件
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 * ADC 配置:
 *   - 使用 ADC1，5个通道
 *   - 12位分辨率，单端输入模式
 *   - 参考电压: 3.3V
 *
 * 硬件电路:
 *   - 4个 NTC 温度传感器 (ADC-R1~ADC-R4)
 *   - 每个传感器配 10K 上拉电阻 (R42~R45)
 *   - LM324 四运放作为信号缓冲/电压跟随
 *
 * 引脚分配:
 *   - ADC-R1 (Temperature1): PC3 (ADC1_IN13)
 *   - ADC-R2 (Temperature2): PC1 (ADC1_IN11)
 *   - ADC-R3 (Temperature3): PC2 (ADC1_IN12)
 *   - ADC-R4 (Temperature4): PC0 (ADC1_IN10)
 *   - Voltage: PA1 (ADC1_IN1)
 *
 ****************************************************************************************************
 */

#ifndef _ADC_H
#define _ADC_H

#include "sys.h"

/* ADC 通道定义 */
#define ADC_CHANNEL_COUNT         5

#define ADC_CH_TEMP1              0
#define ADC_CH_TEMP2              1
#define ADC_CH_TEMP3              2
#define ADC_CH_TEMP4              3
#define ADC_CH_VOLTAGE            4

/* ADC 参数配置 */
#define ADC_REF_VOLTAGE           3.3f
#define ADC_MAX_VALUE             4095
#define ADC_NTC_R25               10000.0f   /* NTC 25°C 时的电阻值 */
#define ADC_NTC_B_VALUE           3950.0f    /* NTC B 值 */
#define ADC_PULLUP_RESISTOR       10000.0f   /* 上拉电阻值 */
#define ADC_VOLTAGE_DIVIDE_RATIO  3.0f       /* 电压检测分压比 */

/* ADC 句柄 */
extern ADC_HandleTypeDef g_adc1_handle;

/* 函数声明 */
void adc_init(void);
uint16_t adc_get_channel_value(uint8_t ch);
uint16_t adc_get_channel_average(uint8_t ch, uint8_t times);
float adc_get_voltage(uint8_t ch);
float adc_get_temperature(uint8_t ch);
float adc_get_power_voltage(void);

#endif
