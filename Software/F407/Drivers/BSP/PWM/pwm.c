/**
 ****************************************************************************************************
 * @file        pwm.c
 * @author      chenfukun
 * @version     V1.0
 * @date        2026-04-14
 * @brief       水下智能转向系统 - PWM 驱动代码
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 * PWM 配置:
 *   - TIM1: 2 个通道 (LED 灯板 - PE9, PE11)
 *   - TIM3: 2 个通道 (舵机7-8 - PB0, PB1)
 *   - TIM4: 4 个通道 (舵机1-4 - PD12, PD13, PD14, PD15)
 *   - TIM8: 2 个通道 (舵机5-6 - PC6, PC7)
 *   总计: 10 个 PWM 通道
 *
 ****************************************************************************************************
 */

#include "pwm.h"

/* PWM 句柄 */
TIM_HandleTypeDef g_tim1_pwm_handle;
TIM_HandleTypeDef g_tim3_pwm_handle;
TIM_HandleTypeDef g_tim4_pwm_handle;
TIM_HandleTypeDef g_tim8_pwm_handle;

/**
 * @brief       配置单个 PWM GPIO 引脚
 * @param       port: GPIO 端口
 * @param       pin: GPIO 引脚
 * @param       af: 复用功能
 * @retval      无
 */
static void pwm_gpio_config(GPIO_TypeDef *port, uint16_t pin, uint8_t af)
{
    GPIO_InitTypeDef gpio_init_struct;

    gpio_init_struct.Pin = pin;
    gpio_init_struct.Mode = GPIO_MODE_AF_PP;
    gpio_init_struct.Pull = GPIO_PULLUP;
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio_init_struct.Alternate = af;
    HAL_GPIO_Init(port, &gpio_init_struct);
}

/**
 * @brief       配置并启动单个 PWM 通道
 * @param       tim_handle: TIM 句柄指针
 * @param       channel: TIM 通道 (TIM_CHANNEL_x)
 * @param       tim_oc_init: 输出比较配置结构体指针
 * @retval      无
 */
static void pwm_config_channel(TIM_HandleTypeDef *tim_handle,
                                uint32_t channel,
                                TIM_OC_InitTypeDef *tim_oc_init)
{
    HAL_TIM_PWM_ConfigChannel(tim_handle, tim_oc_init, channel);
    HAL_TIM_PWM_Start(tim_handle, channel);
}

/**
 * @brief       初始化 TIM1 (LED 2通道 - PE9, PE11)
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
static void pwm_tim1_init(uint16_t arr, uint16_t psc)
{
    TIM_OC_InitTypeDef tim_oc_init;

    /* 使能时钟 */
    PWM_TIM1_CLK_ENABLE();
    PWM9_GPIO_CLK_ENABLE();

    /* 配置 GPIO */
    pwm_gpio_config(PWM9_GPIO_PORT, PWM9_GPIO_PIN, PWM9_GPIO_AF);
    pwm_gpio_config(PWM10_GPIO_PORT, PWM10_GPIO_PIN, PWM10_GPIO_AF);

    /* 配置 TIM1 基本参数 */
    g_tim1_pwm_handle.Instance = PWM_TIM1;
    g_tim1_pwm_handle.Init.Prescaler = psc;
    g_tim1_pwm_handle.Init.CounterMode = TIM_COUNTERMODE_UP;
    g_tim1_pwm_handle.Init.Period = arr;
    g_tim1_pwm_handle.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    g_tim1_pwm_handle.Init.RepetitionCounter = 0;
    HAL_TIM_PWM_Init(&g_tim1_pwm_handle);

    /* 配置 PWM 输出比较参数 */
    tim_oc_init.OCMode = TIM_OCMODE_PWM1;
    tim_oc_init.Pulse = 0;
    tim_oc_init.OCPolarity = TIM_OCPOLARITY_HIGH;
    tim_oc_init.OCNPolarity = TIM_OCNPOLARITY_HIGH;
    tim_oc_init.OCFastMode = TIM_OCFAST_DISABLE;
    tim_oc_init.OCIdleState = TIM_OCIDLESTATE_RESET;
    tim_oc_init.OCNIdleState = TIM_OCNIDLESTATE_RESET;

    /* 配置并启动 LED 通道 */
    pwm_config_channel(&g_tim1_pwm_handle, TIM_CHANNEL_1, &tim_oc_init);
    pwm_config_channel(&g_tim1_pwm_handle, TIM_CHANNEL_2, &tim_oc_init);
}

/**
 * @brief       初始化 TIM3 (舵机7-8 2通道 - PB0, PB1)
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
static void pwm_tim3_init(uint16_t arr, uint16_t psc)
{
    TIM_OC_InitTypeDef tim_oc_init;

    /* 使能时钟 */
    PWM_TIM3_CLK_ENABLE();
    PWM7_GPIO_CLK_ENABLE();

    /* 配置 GPIO */
    pwm_gpio_config(PWM7_GPIO_PORT, PWM7_GPIO_PIN, PWM7_GPIO_AF);
    pwm_gpio_config(PWM8_GPIO_PORT, PWM8_GPIO_PIN, PWM8_GPIO_AF);

    /* 配置 TIM3 基本参数 */
    g_tim3_pwm_handle.Instance = PWM_TIM3;
    g_tim3_pwm_handle.Init.Prescaler = psc;
    g_tim3_pwm_handle.Init.CounterMode = TIM_COUNTERMODE_UP;
    g_tim3_pwm_handle.Init.Period = arr;
    g_tim3_pwm_handle.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    HAL_TIM_PWM_Init(&g_tim3_pwm_handle);

    /* 配置 PWM 输出比较参数 */
    tim_oc_init.OCMode = TIM_OCMODE_PWM1;
    tim_oc_init.Pulse = 0;
    tim_oc_init.OCPolarity = TIM_OCPOLARITY_HIGH;
    tim_oc_init.OCFastMode = TIM_OCFAST_DISABLE;
    tim_oc_init.OCIdleState = TIM_OCIDLESTATE_RESET;

    /* 配置并启动舵机7-8 通道 */
    pwm_config_channel(&g_tim3_pwm_handle, TIM_CHANNEL_3, &tim_oc_init);
    pwm_config_channel(&g_tim3_pwm_handle, TIM_CHANNEL_4, &tim_oc_init);
}

/**
 * @brief       初始化 TIM4 (舵机1-4 4通道 - PD12, PD13, PD14, PD15)
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
static void pwm_tim4_init(uint16_t arr, uint16_t psc)
{
    TIM_OC_InitTypeDef tim_oc_init;

    /* 使能时钟 */
    PWM_TIM4_CLK_ENABLE();
    PWM1_GPIO_CLK_ENABLE();

    /* 配置 GPIO */
    pwm_gpio_config(PWM3_GPIO_PORT, PWM3_GPIO_PIN, PWM3_GPIO_AF);
    pwm_gpio_config(PWM1_GPIO_PORT, PWM1_GPIO_PIN, PWM1_GPIO_AF);
    pwm_gpio_config(PWM4_GPIO_PORT, PWM4_GPIO_PIN, PWM4_GPIO_AF);
    pwm_gpio_config(PWM2_GPIO_PORT, PWM2_GPIO_PIN, PWM2_GPIO_AF);

    /* 配置 TIM4 基本参数 */
    g_tim4_pwm_handle.Instance = PWM_TIM4;
    g_tim4_pwm_handle.Init.Prescaler = psc;
    g_tim4_pwm_handle.Init.CounterMode = TIM_COUNTERMODE_UP;
    g_tim4_pwm_handle.Init.Period = arr;
    g_tim4_pwm_handle.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    HAL_TIM_PWM_Init(&g_tim4_pwm_handle);

    /* 配置 PWM 输出比较参数 */
    tim_oc_init.OCMode = TIM_OCMODE_PWM1;
    tim_oc_init.Pulse = 0;
    tim_oc_init.OCPolarity = TIM_OCPOLARITY_HIGH;
    tim_oc_init.OCFastMode = TIM_OCFAST_DISABLE;
    tim_oc_init.OCIdleState = TIM_OCIDLESTATE_RESET;

    /* 配置并启动舵机1-4 通道 */
    pwm_config_channel(&g_tim4_pwm_handle, TIM_CHANNEL_1, &tim_oc_init);
    pwm_config_channel(&g_tim4_pwm_handle, TIM_CHANNEL_2, &tim_oc_init);
    pwm_config_channel(&g_tim4_pwm_handle, TIM_CHANNEL_3, &tim_oc_init);
    pwm_config_channel(&g_tim4_pwm_handle, TIM_CHANNEL_4, &tim_oc_init);
}

/**
 * @brief       初始化 TIM8 (舵机5-6 2通道 - PC6, PC7)
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
static void pwm_tim8_init(uint16_t arr, uint16_t psc)
{
    TIM_OC_InitTypeDef tim_oc_init;

    /* 使能时钟 */
    PWM_TIM8_CLK_ENABLE();
    PWM5_GPIO_CLK_ENABLE();

    /* 配置 GPIO */
    pwm_gpio_config(PWM5_GPIO_PORT, PWM5_GPIO_PIN, PWM5_GPIO_AF);
    pwm_gpio_config(PWM6_GPIO_PORT, PWM6_GPIO_PIN, PWM6_GPIO_AF);

    /* 配置 TIM8 基本参数 */
    g_tim8_pwm_handle.Instance = PWM_TIM8;
    g_tim8_pwm_handle.Init.Prescaler = psc;
    g_tim8_pwm_handle.Init.CounterMode = TIM_COUNTERMODE_UP;
    g_tim8_pwm_handle.Init.Period = arr;
    g_tim8_pwm_handle.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    g_tim8_pwm_handle.Init.RepetitionCounter = 0;
    HAL_TIM_PWM_Init(&g_tim8_pwm_handle);

    /* 配置 PWM 输出比较参数 */
    tim_oc_init.OCMode = TIM_OCMODE_PWM1;
    tim_oc_init.Pulse = 0;
    tim_oc_init.OCPolarity = TIM_OCPOLARITY_HIGH;
    tim_oc_init.OCNPolarity = TIM_OCNPOLARITY_HIGH;
    tim_oc_init.OCFastMode = TIM_OCFAST_DISABLE;
    tim_oc_init.OCIdleState = TIM_OCIDLESTATE_RESET;
    tim_oc_init.OCNIdleState = TIM_OCNIDLESTATE_RESET;

    /* 配置并启动舵机5-6 通道 */
    pwm_config_channel(&g_tim8_pwm_handle, TIM_CHANNEL_1, &tim_oc_init);
    pwm_config_channel(&g_tim8_pwm_handle, TIM_CHANNEL_2, &tim_oc_init);
}

/**
 * @brief       PWM 初始化函数
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
void pwm_init(uint16_t arr, uint16_t psc)
{
    pwm_tim1_init(arr, psc);
    pwm_tim3_init(arr, psc);
    pwm_tim4_init(arr, psc);
    pwm_tim8_init(arr, psc);
}

/**
 * @brief       设置单个 PWM 通道占空比
 * @param       ch: 通道号 (1-10)
 * @param       duty: 占空比 (0-arr)
 * @retval      无
 */
void pwm_set_duty(uint8_t ch, uint16_t duty)
{
    switch (ch) {
        /* 舵机/电调通道 1-8 */
        case PWM_CH_SERVO_1:
            __HAL_TIM_SET_COMPARE(&g_tim4_pwm_handle, TIM_CHANNEL_2, duty);
            break;
        case PWM_CH_SERVO_2:
            __HAL_TIM_SET_COMPARE(&g_tim4_pwm_handle, TIM_CHANNEL_4, duty);
            break;
        case PWM_CH_SERVO_3:
            __HAL_TIM_SET_COMPARE(&g_tim4_pwm_handle, TIM_CHANNEL_1, duty);
            break;
        case PWM_CH_SERVO_4:
            __HAL_TIM_SET_COMPARE(&g_tim4_pwm_handle, TIM_CHANNEL_3, duty);
            break;
        case PWM_CH_SERVO_5:
            __HAL_TIM_SET_COMPARE(&g_tim8_pwm_handle, TIM_CHANNEL_1, duty);
            break;
        case PWM_CH_SERVO_6:
            __HAL_TIM_SET_COMPARE(&g_tim8_pwm_handle, TIM_CHANNEL_2, duty);
            break;
        case PWM_CH_SERVO_7:
            __HAL_TIM_SET_COMPARE(&g_tim3_pwm_handle, TIM_CHANNEL_3, duty);
            break;
        case PWM_CH_SERVO_8:
            __HAL_TIM_SET_COMPARE(&g_tim3_pwm_handle, TIM_CHANNEL_4, duty);
            break;

        /* LED 通道 9-10 */
        case PWM_CH_LED_1:
            __HAL_TIM_SET_COMPARE(&g_tim1_pwm_handle, TIM_CHANNEL_1, duty);
            break;
        case PWM_CH_LED_2:
            __HAL_TIM_SET_COMPARE(&g_tim1_pwm_handle, TIM_CHANNEL_2, duty);
            break;

        default:
            break;
    }
}

/**
 * @brief       设置所有舵机/电调通道占空比
 * @param       duty: 占空比 (0-arr)
 * @retval      无
 */
void pwm_set_all_servo_duty(uint16_t duty)
{
    for (uint8_t ch = PWM_CH_SERVO_1; ch <= PWM_CH_SERVO_8; ch++) {
        pwm_set_duty(ch, duty);
    }
}

/**
 * @brief       设置所有 LED 通道占空比
 * @param       duty: 占空比 (0-arr)
 * @retval      无
 */
void pwm_set_all_led_duty(uint16_t duty)
{
    pwm_set_duty(PWM_CH_LED_1, duty);
    pwm_set_duty(PWM_CH_LED_2, duty);
}
