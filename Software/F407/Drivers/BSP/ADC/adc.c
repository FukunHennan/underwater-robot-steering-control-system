/**
 ****************************************************************************************************
 * @file        adc.c
 * @author      chenfukun
 * @version     V1.1
 * @date        2026-04-14
 * @brief       水下智能转向系统 - ADC 驱动代码
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 * 硬件电路说明:
 *   - 4个 NTC 温度传感器 (ADC-R1~ADC-R4)
 *   - 每个传感器配 10K 上拉电阻 (R42~R45)
 *   - LM324 四运放作为电压跟随器，提高输入阻抗
 *
 ****************************************************************************************************
 */

#include "adc.h"
#include "delay.h"
#include <math.h>

/* ADC 句柄 */
ADC_HandleTypeDef g_adc1_handle;

/* ADC 通道对应关系表 - 与电路图一致: ADC-R1~ADC-R4 */
static const uint32_t g_adc_channel_table[ADC_CHANNEL_COUNT] = {
    ADC_CHANNEL_13,  /* ADC-R1 (Temperature1) - PC3 */
    ADC_CHANNEL_11,  /* ADC-R2 (Temperature2) - PC1 */
    ADC_CHANNEL_12,  /* ADC-R3 (Temperature3) - PC2 */
    ADC_CHANNEL_10,  /* ADC-R4 (Temperature4) - PC0 */
    ADC_CHANNEL_1    /* Voltage - PA1 */
};

/**
 * @brief       配置单个 ADC GPIO 引脚
 * @param       port: GPIO 端口
 * @param       pin: GPIO 引脚
 * @retval      无
 */
static void adc_gpio_config(GPIO_TypeDef *port, uint16_t pin)
{
    GPIO_InitTypeDef gpio_init_struct;

    gpio_init_struct.Pin = pin;
    gpio_init_struct.Mode = GPIO_MODE_ANALOG;
    gpio_init_struct.Pull = GPIO_NOPULL;
    HAL_GPIO_Init(port, &gpio_init_struct);
}

/**
 * @brief       ADC 初始化函数
 * @param       无
 * @retval      无
 */
void adc_init(void)
{
    ADC_ChannelConfTypeDef adc_channel_config;

    /* 使能时钟 */
    __HAL_RCC_ADC1_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    /* 配置 GPIO */
    adc_gpio_config(GPIOC, GPIO_PIN_0);  /* PC0 - Temperature4 */
    adc_gpio_config(GPIOC, GPIO_PIN_1);  /* PC1 - Temperature2 */
    adc_gpio_config(GPIOC, GPIO_PIN_2);  /* PC2 - Temperature3 */
    adc_gpio_config(GPIOC, GPIO_PIN_3);  /* PC3 - Temperature1 */
    adc_gpio_config(GPIOA, GPIO_PIN_1);  /* PA1 - Voltage */

    /* 配置 ADC */
    g_adc1_handle.Instance = ADC1;
    g_adc1_handle.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV4;
    g_adc1_handle.Init.Resolution = ADC_RESOLUTION_12B;
    g_adc1_handle.Init.ScanConvMode = DISABLE;
    g_adc1_handle.Init.ContinuousConvMode = DISABLE;
    g_adc1_handle.Init.DiscontinuousConvMode = DISABLE;
    g_adc1_handle.Init.NbrOfDiscConversion = 0;
    g_adc1_handle.Init.ExternalTrigConvEdge = ADC_EXTERNALTRIGCONVEDGE_NONE;
    g_adc1_handle.Init.ExternalTrigConv = ADC_SOFTWARE_START;
    g_adc1_handle.Init.DataAlign = ADC_DATAALIGN_RIGHT;
    g_adc1_handle.Init.NbrOfConversion = 1;
    g_adc1_handle.Init.DMAContinuousRequests = DISABLE;
    g_adc1_handle.Init.EOCSelection = ADC_EOC_SINGLE_CONV;
    HAL_ADC_Init(&g_adc1_handle);

    /* 配置 ADC 通道（默认配置第一个通道） */
    adc_channel_config.Channel = ADC_CHANNEL_13;
    adc_channel_config.Rank = 1;
    adc_channel_config.SamplingTime = ADC_SAMPLETIME_480CYCLES;
    adc_channel_config.Offset = 0;
    HAL_ADC_ConfigChannel(&g_adc1_handle, &adc_channel_config);
}

/**
 * @brief       获取单个 ADC 通道的原始值
 * @param       ch: 通道编号 (0-4)
 * @retval      ADC 原始值 (0-4095)
 */
uint16_t adc_get_channel_value(uint8_t ch)
{
    ADC_ChannelConfTypeDef adc_channel_config;

    if (ch >= ADC_CHANNEL_COUNT) {
        return 0;
    }

    /* 配置通道 */
    adc_channel_config.Channel = g_adc_channel_table[ch];
    adc_channel_config.Rank = 1;
    adc_channel_config.SamplingTime = ADC_SAMPLETIME_480CYCLES;
    adc_channel_config.Offset = 0;
    HAL_ADC_ConfigChannel(&g_adc1_handle, &adc_channel_config);

    /* 启动 ADC 转换 */
    HAL_ADC_Start(&g_adc1_handle);

    /* 等待转换完成 */
    HAL_ADC_PollForConversion(&g_adc1_handle, 10);

    /* 获取转换结果 */
    return HAL_ADC_GetValue(&g_adc1_handle);
}

/**
 * @brief       获取 ADC 通道的平均值（多次采样取平均）
 * @param       ch: 通道编号 (0-4)
 * @param       times: 采样次数
 * @retval      ADC 平均值 (0-4095)
 */
uint16_t adc_get_channel_average(uint8_t ch, uint8_t times)
{
    uint32_t sum = 0;
    uint8_t i;

    if (ch >= ADC_CHANNEL_COUNT || times == 0) {
        return 0;
    }

    for (i = 0; i < times; i++) {
        sum += adc_get_channel_value(ch);
        delay_us(10);
    }

    return (uint16_t)(sum / times);
}

/**
 * @brief       获取 ADC 通道的电压值
 * @param       ch: 通道编号 (0-4)
 * @retval      电压值 (V)
 */
float adc_get_voltage(uint8_t ch)
{
    uint16_t value;

    if (ch >= ADC_CHANNEL_COUNT) {
        return 0.0f;
    }

    value = adc_get_channel_average(ch, 10);
    return ((float)value / ADC_MAX_VALUE) * ADC_REF_VOLTAGE;
}

/**
 * @brief       获取温度值（基于 NTC 热敏电阻）
 * @param       ch: 通道编号 (0-3，对应温度传感器1-4)
 * @retval      温度值 (°C)
 */
float adc_get_temperature(uint8_t ch)
{
    float voltage;
    float ntc_resistance;
    float temp_kelvin;
    float temp_celsius;
    const float t0_kelvin = 298.15f; /* 25°C in Kelvin */

    if (ch > ADC_CH_TEMP4) {
        return 0.0f;
    }

    /* 读取电压 */
    voltage = adc_get_voltage(ch);

    /* 计算 NTC 电阻值 */
    if (voltage > 0.01f && voltage < (ADC_REF_VOLTAGE - 0.01f)) {
        ntc_resistance = ADC_PULLUP_RESISTOR * voltage / (ADC_REF_VOLTAGE - voltage);

        /* 使用 B 方程计算温度 */
        temp_kelvin = 1.0f / (1.0f / t0_kelvin + (1.0f / ADC_NTC_B_VALUE) * logf(ntc_resistance / ADC_NTC_R25));
        temp_celsius = temp_kelvin - 273.15f;

        return temp_celsius;
    }

    return 0.0f;
}

/**
 * @brief       获取电源电压值（带有分压电路）
 * @param       无
 * @retval      电源电压值 (V)
 */
float adc_get_power_voltage(void)
{
    float voltage;

    voltage = adc_get_voltage(ADC_CH_VOLTAGE);
    return voltage * ADC_VOLTAGE_DIVIDE_RATIO;
}
