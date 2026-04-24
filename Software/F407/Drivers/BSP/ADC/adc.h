/**
 ****************************************************************************************************
 * @file        adc.h
 * @author      chenfukun
 * @version     V2.0
 * @date        2026-04-22
 * @brief       水下智能转向系统 - ADC 驱动头文件 (DMA多通道扫描模式)
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 * ADC 配置:
 *   - 使用 ADC1，5个通道，DMA2_Stream0
 *   - 扫描模式 + 连续转换 + DMA循环传输
 *   - 12位分辨率，参考电压: 3.3V
 *
 * 硬件电路:
 *   - 4路模拟信号输入 (ADC-R1~ADC-R4)
 *   - LM324 四运放作为信号缓冲/电压跟随
 *
 * 引脚分配:
 *   - ADC-R1 (Analog1): PC3 (ADC1_IN13)
 *   - ADC-R2 (Analog2): PC1 (ADC1_IN11)
 *   - ADC-R3 (Analog3): PC2 (ADC1_IN12)
 *   - ADC-R4 (Analog4): PC0 (ADC1_IN10)
 *   - Voltage: PA1 (ADC1_IN1)
 *
 ****************************************************************************************************
 */

#ifndef _ADC_H
#define _ADC_H

#include "sys.h"

/* ADC 通道定义 */
#define ADC_CHANNEL_COUNT         5

#define ADC_CH_ANALOG1            0
#define ADC_CH_ANALOG2            1
#define ADC_CH_ANALOG3            2
#define ADC_CH_ANALOG4            3
#define ADC_CH_VOLTAGE            4

/* ADC 参数配置 */
#define ADC_REF_VOLTAGE           3.3f
#define ADC_MAX_VALUE             4095
#define ADC_VOLTAGE_DIVIDE_RATIO  4.0f       /* 电压检测分压比 (R17=30K, R18=10K) */
#define ADC_AVG_COUNT             10         /* DMA缓冲区平均采样次数 */

/* ADC 句柄 */
extern ADC_HandleTypeDef g_adc1_handle;
extern DMA_HandleTypeDef g_dma_adc1_handle;

/* 函数声明 */
void adc_init(void);
uint16_t adc_get_channel_value(uint8_t ch);
uint16_t adc_get_channel_average(uint8_t ch, uint8_t times);
float adc_get_voltage(uint8_t ch);
uint16_t adc_get_analog_value(uint8_t ch);
float adc_get_power_voltage(void);

#endif
