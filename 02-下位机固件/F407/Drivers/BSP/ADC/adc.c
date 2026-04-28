/**
 ****************************************************************************************************
 * @file        adc.c
 * @author      chenfukun
 * @version     V2.0
 * @date        2026-04-22
 * @brief       水下智能转向系统 - ADC 驱动代码 (DMA多通道扫描模式)
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 * 硬件电路说明:
 *   - 4路模拟信号输入 (ADC-R1~ADC-R4)
 *   - LM324 四运放作为电压跟随器，提高输入阻抗
 *
 * DMA 工作方式:
 *   - ADC1 配置为扫描模式 + 连续转换
 *   - DMA2_Stream0_Channel0 循环传输
 *   - 缓冲区大小 = ADC_CHANNEL_COUNT * ADC_AVG_COUNT
 *   - 每轮扫描自动覆盖旧数据，读取时取平均值
 *
 ****************************************************************************************************
 */

#include "adc.h"
#include "delay.h"

/* ADC & DMA 句柄 */
ADC_HandleTypeDef  g_adc1_handle;
DMA_HandleTypeDef  g_dma_adc1_handle;

/* DMA 循环缓冲区: ADC_AVG_COUNT 轮 x ADC_CHANNEL_COUNT 通道 */
static volatile uint16_t g_adc_dma_buf[ADC_AVG_COUNT * ADC_CHANNEL_COUNT];

/* ADC 通道对应关系表 - 与电路图一致: ADC-R1~ADC-R4, Voltage */
static const uint32_t g_adc_channel_table[ADC_CHANNEL_COUNT] = {
    ADC_CHANNEL_13,  /* ADC-R1 (Analog1) - PC3 */
    ADC_CHANNEL_11,  /* ADC-R2 (Analog2) - PC1 */
    ADC_CHANNEL_12,  /* ADC-R3 (Analog3) - PC2 */
    ADC_CHANNEL_10,  /* ADC-R4 (Analog4) - PC0 */
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
 * @brief       ADC 初始化函数 (DMA多通道扫描)
 * @param       无
 * @retval      无
 */
void adc_init(void)
{
    ADC_ChannelConfTypeDef adc_channel_config;
    uint8_t i;

    /* 使能时钟 */
    __HAL_RCC_ADC1_CLK_ENABLE();
    __HAL_RCC_DMA2_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    /* 配置 GPIO */
    adc_gpio_config(GPIOC, GPIO_PIN_0);  /* PC0 - Analog4 */
    adc_gpio_config(GPIOC, GPIO_PIN_1);  /* PC1 - Analog2 */
    adc_gpio_config(GPIOC, GPIO_PIN_2);  /* PC2 - Analog3 */
    adc_gpio_config(GPIOC, GPIO_PIN_3);  /* PC3 - Analog1 */
    adc_gpio_config(GPIOA, GPIO_PIN_1);  /* PA1 - Voltage */

    /* ---- 配置 DMA2 Stream0 Channel0 (ADC1) ---- */
    g_dma_adc1_handle.Instance                 = DMA2_Stream0;
    g_dma_adc1_handle.Init.Channel             = DMA_CHANNEL_0;
    g_dma_adc1_handle.Init.Direction            = DMA_PERIPH_TO_MEMORY;
    g_dma_adc1_handle.Init.PeriphInc           = DMA_PINC_DISABLE;
    g_dma_adc1_handle.Init.MemInc              = DMA_MINC_ENABLE;
    g_dma_adc1_handle.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    g_dma_adc1_handle.Init.MemDataAlignment    = DMA_MDATAALIGN_HALFWORD;
    g_dma_adc1_handle.Init.Mode                = DMA_CIRCULAR;
    g_dma_adc1_handle.Init.Priority            = DMA_PRIORITY_MEDIUM;
    g_dma_adc1_handle.Init.FIFOMode            = DMA_FIFOMODE_DISABLE;
    HAL_DMA_Init(&g_dma_adc1_handle);

    /* 关联 DMA 到 ADC */
    __HAL_LINKDMA(&g_adc1_handle, DMA_Handle, g_dma_adc1_handle);

    /* ---- 配置 ADC1: 扫描 + 连续 + DMA ---- */
    g_adc1_handle.Instance = ADC1;
    g_adc1_handle.Init.ClockPrescaler          = ADC_CLOCK_SYNC_PCLK_DIV4;
    g_adc1_handle.Init.Resolution              = ADC_RESOLUTION_12B;
    g_adc1_handle.Init.ScanConvMode            = ENABLE;
    g_adc1_handle.Init.ContinuousConvMode      = ENABLE;
    g_adc1_handle.Init.DiscontinuousConvMode   = DISABLE;
    g_adc1_handle.Init.NbrOfDiscConversion     = 0;
    g_adc1_handle.Init.ExternalTrigConvEdge    = ADC_EXTERNALTRIGCONVEDGE_NONE;
    g_adc1_handle.Init.ExternalTrigConv        = ADC_SOFTWARE_START;
    g_adc1_handle.Init.DataAlign               = ADC_DATAALIGN_RIGHT;
    g_adc1_handle.Init.NbrOfConversion         = ADC_CHANNEL_COUNT;
    g_adc1_handle.Init.DMAContinuousRequests   = ENABLE;
    g_adc1_handle.Init.EOCSelection            = ADC_EOC_SEQ_CONV;
    HAL_ADC_Init(&g_adc1_handle);

    /* 配置 5 个扫描通道 (Rank 1~5) */
    for (i = 0; i < ADC_CHANNEL_COUNT; i++)
    {
        adc_channel_config.Channel      = g_adc_channel_table[i];
        adc_channel_config.Rank         = i + 1;
        adc_channel_config.SamplingTime = ADC_SAMPLETIME_480CYCLES;
        adc_channel_config.Offset       = 0;
        HAL_ADC_ConfigChannel(&g_adc1_handle, &adc_channel_config);
    }

    /* 启动 ADC + DMA */
    HAL_ADC_Start_DMA(&g_adc1_handle,
                       (uint32_t *)g_adc_dma_buf,
                       ADC_AVG_COUNT * ADC_CHANNEL_COUNT);
}

/**
 * @brief       获取单个 ADC 通道的原始值 (DMA缓冲区最新一轮)
 * @param       ch: 通道编号 (0-4)
 * @retval      ADC 原始值 (0-4095)
 */
uint16_t adc_get_channel_value(uint8_t ch)
{
    if (ch >= ADC_CHANNEL_COUNT) {
        return 0;
    }

    /* 返回缓冲区中最近一轮的对应通道值 */
    return g_adc_dma_buf[(ADC_AVG_COUNT - 1) * ADC_CHANNEL_COUNT + ch];
}

/**
 * @brief       获取 ADC 通道的平均值（从DMA缓冲区多轮取平均）
 * @param       ch: 通道编号 (0-4)
 * @param       times: 采样次数 (最大 ADC_AVG_COUNT)
 * @retval      ADC 平均值 (0-4095)
 */
uint16_t adc_get_channel_average(uint8_t ch, uint8_t times)
{
    uint32_t sum = 0;
    uint8_t i;
    uint8_t count;

    if (ch >= ADC_CHANNEL_COUNT || times == 0) {
        return 0;
    }

    count = (times > ADC_AVG_COUNT) ? ADC_AVG_COUNT : times;

    for (i = 0; i < count; i++) {
        sum += g_adc_dma_buf[i * ADC_CHANNEL_COUNT + ch];
    }

    return (uint16_t)(sum / count);
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

    value = adc_get_channel_average(ch, ADC_AVG_COUNT);
    return ((float)value / ADC_MAX_VALUE) * ADC_REF_VOLTAGE;
}

/**
 * @brief       获取模拟输入通道的采样值（DMA多轮平均）
 * @param       ch: 通道编号 (0-3，对应模拟输入通道1-4)
 * @retval      ADC 平均值 (0-4095)
 */
uint16_t adc_get_analog_value(uint8_t ch)
{
    if (ch > ADC_CH_ANALOG4) {
        return 0;
    }

    return adc_get_channel_average(ch, ADC_AVG_COUNT);
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
