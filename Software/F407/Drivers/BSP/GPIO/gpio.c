/**
 ****************************************************************************************************
 * @file        gpio.c
 * @author      chenfukun
 * @version     V1.1
 * @date        2026-04-14
 * @brief       水下智能转向系统 - GPIO 驱动代码
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 ****************************************************************************************************
 */

#include "gpio.h"

/* GPIO 引脚数量 */
#define GPIO_COUNT            4

/* GPIO 引脚配置表 */
typedef struct
{
    GPIO_TypeDef *port;
    uint16_t pin;
} gpio_pin_config_t;

static const gpio_pin_config_t g_gpio_pin_table[GPIO_COUNT] = {
    {GPIOB, GPIO_PIN_12},   /* MY_GPIO_PIN_0 - PB12 */
    {GPIOE, GPIO_PIN_6},    /* MY_GPIO_PIN_2 - PE6 */
    {GPIOE, GPIO_PIN_5},    /* MY_GPIO_PIN_3 - PE5 */
    {GPIOC, GPIO_PIN_4}     /* MY_GPIO_PIN_4 - PC4 */
};

/**
 * @brief       GPIO 初始化函数
 * @param       无
 * @retval      无
 */
void gpio_init(void)
{
    GPIO_InitTypeDef gpio_init_struct;
    uint8_t i;

    /* 使能 GPIO 时钟 */
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
    __HAL_RCC_GPIOE_CLK_ENABLE();

    /* 配置所有 GPIO 为默认输出模式 */
    gpio_init_struct.Mode = GPIO_MODE_OUTPUT_PP;
    gpio_init_struct.Pull = GPIO_NOPULL;
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;

    for (i = 0; i < GPIO_COUNT; i++) {
        gpio_init_struct.Pin = g_gpio_pin_table[i].pin;
        HAL_GPIO_Init(g_gpio_pin_table[i].port, &gpio_init_struct);

        /* 默认输出低电平 */
        HAL_GPIO_WritePin(g_gpio_pin_table[i].port, g_gpio_pin_table[i].pin, GPIO_PIN_RESET);
    }
}

/**
 * @brief       设置 GPIO 引脚模式
 * @param       pin: 引脚编号 (MY_GPIO_PIN_0 ~ MY_GPIO_PIN_4)
 * @param       mode: 模式 (MY_GPIO_MODE_INPUT 或 MY_GPIO_MODE_OUTPUT)
 * @retval      无
 */
void gpio_set_mode(uint8_t pin, uint8_t mode)
{
    GPIO_InitTypeDef gpio_init_struct;

    if (pin >= GPIO_COUNT) {
        return;
    }

    /* 先取消初始化该引脚 */
    HAL_GPIO_DeInit(g_gpio_pin_table[pin].port, g_gpio_pin_table[pin].pin);

    /* 配置引脚 */
    if (mode == MY_GPIO_MODE_INPUT) {
        gpio_init_struct.Mode = GPIO_MODE_INPUT;
        gpio_init_struct.Pull = GPIO_NOPULL;
    } else {
        gpio_init_struct.Mode = GPIO_MODE_OUTPUT_PP;
        gpio_init_struct.Pull = GPIO_NOPULL;
        gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    }

    gpio_init_struct.Pin = g_gpio_pin_table[pin].pin;
    HAL_GPIO_Init(g_gpio_pin_table[pin].port, &gpio_init_struct);
}

/**
 * @brief       写入 GPIO 引脚状态
 * @param       pin: 引脚编号 (MY_GPIO_PIN_0 ~ MY_GPIO_PIN_4)
 * @param       state: 状态 (MY_GPIO_LOW 或 MY_GPIO_HIGH)
 * @retval      无
 */
void gpio_write(uint8_t pin, uint8_t state)
{
    if (pin >= GPIO_COUNT) {
        return;
    }

    HAL_GPIO_WritePin(
        g_gpio_pin_table[pin].port,
        g_gpio_pin_table[pin].pin,
        (state == MY_GPIO_HIGH) ? GPIO_PIN_SET : GPIO_PIN_RESET
    );
}

/**
 * @brief       读取 GPIO 引脚状态
 * @param       pin: 引脚编号 (MY_GPIO_PIN_0 ~ MY_GPIO_PIN_4)
 * @retval      引脚状态 (MY_GPIO_LOW 或 MY_GPIO_HIGH)
 */
uint8_t gpio_read(uint8_t pin)
{
    if (pin >= GPIO_COUNT) {
        return MY_GPIO_LOW;
    }

    GPIO_PinState state = HAL_GPIO_ReadPin(
        g_gpio_pin_table[pin].port,
        g_gpio_pin_table[pin].pin
    );

    return (state == GPIO_PIN_SET) ? MY_GPIO_HIGH : MY_GPIO_LOW;
}

/**
 * @brief       翻转 GPIO 引脚状态
 * @param       pin: 引脚编号 (MY_GPIO_PIN_0 ~ MY_GPIO_PIN_4)
 * @retval      无
 */
void gpio_toggle(uint8_t pin)
{
    if (pin >= GPIO_COUNT) {
        return;
    }

    HAL_GPIO_TogglePin(
        g_gpio_pin_table[pin].port,
        g_gpio_pin_table[pin].pin
    );
}
