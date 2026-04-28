/**
 ****************************************************************************************************
 * @file        gpio.h
 * @author      chenfukun
 * @version     V1.1
 * @date        2026-04-14
 * @brief       水下智能转向系统 - GPIO 驱动头文件
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 * GPIO 配置:
 *   - GPIO0: PB12
 *   - GPIO2: PE6
 *   - GPIO3: PE5
 *   - GPIO4: PC4
 *
 ****************************************************************************************************
 */

#ifndef _GPIO_H
#define _GPIO_H

#include "sys.h"

/* GPIO 编号定义 - 避免与 HAL 库 GPIO_PIN_x 冲突 */
#define MY_GPIO_PIN_0            0    /* PB12 */
#define MY_GPIO_PIN_2            1    /* PE6 */
#define MY_GPIO_PIN_3            2    /* PE5 */
#define MY_GPIO_PIN_4            3    /* PC4 */

/* GPIO 模式定义 - 避免与 HAL 库 GPIO_MODE_x 冲突 */
#define MY_GPIO_MODE_INPUT       0
#define MY_GPIO_MODE_OUTPUT      1

/* GPIO 状态定义 */
#define MY_GPIO_LOW              0
#define MY_GPIO_HIGH             1

/* 函数声明 */
void gpio_init(void);
void gpio_set_mode(uint8_t pin, uint8_t mode);
void gpio_write(uint8_t pin, uint8_t state);
uint8_t gpio_read(uint8_t pin);
void gpio_toggle(uint8_t pin);

#endif
