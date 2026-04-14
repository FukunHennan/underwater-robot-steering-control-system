/**
 ****************************************************************************************************
 * @file        pwm.h
 * @author      chenfukun
 * @version     V1.0
 * @date        2026-04-14
 * @brief       水下智能转向系统 - PWM 驱动头文件
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 * PWM 配置:
 *   - 8 个 PWM 通道（舵机/电调控制）
 *   - 2 个 PWM-LED 通道（LED 灯板控制）
 *   总计: 10 个 PWM 通道
 *
 * 引脚分配:
 *   - 舵机1: PD13 (TIM4_CH2)
 *   - 舵机2: PD15 (TIM4_CH4)
 *   - 舵机3: PD12 (TIM4_CH1)
 *   - 舵机4: PD14 (TIM4_CH3)
 *   - 舵机5: PC6 (TIM8_CH1)
 *   - 舵机6: PC7 (TIM8_CH2)
 *   - 舵机7: PB0 (TIM3_CH3)
 *   - 舵机8: PB1 (TIM3_CH4)
 *   - LED1: PE9 (TIM1_CH1)
 *   - LED2: PE11 (TIM1_CH2)
 *
 ****************************************************************************************************
 */

#ifndef _PWM_H
#define _PWM_H

#include "sys.h"

/* PWM 通道数量定义 */
#define PWM_TOTAL_CHANNELS        10    /* 总通道数：8+2 */
#define PWM_SERVO_ESC_CHANNELS    8     /* 舵机/电调通道数 */
#define PWM_LED_CHANNELS          2     /* LED 通道数 */

/* 通道编号定义 */
#define PWM_CH_SERVO_1            1
#define PWM_CH_SERVO_2            2
#define PWM_CH_SERVO_3            3
#define PWM_CH_SERVO_4            4
#define PWM_CH_SERVO_5            5
#define PWM_CH_SERVO_6            6
#define PWM_CH_SERVO_7            7
#define PWM_CH_SERVO_8            8
#define PWM_CH_LED_1              9
#define PWM_CH_LED_2              10

/* TIM1 配置 - 用于 LED (2通道: PE9, PE11) */
#define PWM_TIM1                   TIM1
#define PWM_TIM1_CLK_ENABLE()      do{ __HAL_RCC_TIM1_CLK_ENABLE(); }while(0)

/* TIM3 配置 - 用于舵机7-8 (2通道: PB0, PB1) */
#define PWM_TIM3                   TIM3
#define PWM_TIM3_CLK_ENABLE()      do{ __HAL_RCC_TIM3_CLK_ENABLE(); }while(0)

/* TIM4 配置 - 用于舵机1-4 (4通道: PD12, PD13, PD14, PD15) */
#define PWM_TIM4                   TIM4
#define PWM_TIM4_CLK_ENABLE()      do{ __HAL_RCC_TIM4_CLK_ENABLE(); }while(0)

/* TIM8 配置 - 用于舵机5-6 (2通道: PC6, PC7) */
#define PWM_TIM8                   TIM8
#define PWM_TIM8_CLK_ENABLE()      do{ __HAL_RCC_TIM8_CLK_ENABLE(); }while(0)

/* ========================================
 * TIM1 通道配置 (LED 2通道)
 * TIM1_CH1 - PE9
 * TIM1_CH2 - PE11
 * ======================================== */

/* TIM1_CH1 - PE9 (LED1) */
#define PWM9_GPIO_PORT             GPIOE
#define PWM9_GPIO_PIN              GPIO_PIN_9
#define PWM9_GPIO_AF               GPIO_AF1_TIM1
#define PWM9_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOE_CLK_ENABLE(); }while(0)

/* TIM1_CH2 - PE11 (LED2) */
#define PWM10_GPIO_PORT            GPIOE
#define PWM10_GPIO_PIN             GPIO_PIN_11
#define PWM10_GPIO_AF              GPIO_AF1_TIM1
#define PWM10_GPIO_CLK_ENABLE()    do{ __HAL_RCC_GPIOE_CLK_ENABLE(); }while(0)

/* ========================================
 * TIM3 通道配置 (舵机7-8 2通道)
 * TIM3_CH3 - PB0
 * TIM3_CH4 - PB1
 * ======================================== */

/* TIM3_CH3 - PB0 (舵机7) */
#define PWM7_GPIO_PORT             GPIOB
#define PWM7_GPIO_PIN              GPIO_PIN_0
#define PWM7_GPIO_AF               GPIO_AF2_TIM3
#define PWM7_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOB_CLK_ENABLE(); }while(0)

/* TIM3_CH4 - PB1 (舵机8) */
#define PWM8_GPIO_PORT             GPIOB
#define PWM8_GPIO_PIN              GPIO_PIN_1
#define PWM8_GPIO_AF               GPIO_AF2_TIM3
#define PWM8_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOB_CLK_ENABLE(); }while(0)

/* ========================================
 * TIM4 通道配置 (舵机1-4 4通道)
 * TIM4_CH1 - PD12
 * TIM4_CH2 - PD13
 * TIM4_CH3 - PD14
 * TIM4_CH4 - PD15
 * ======================================== */

/* TIM4_CH1 - PD12 (舵机3) */
#define PWM3_GPIO_PORT             GPIOD
#define PWM3_GPIO_PIN              GPIO_PIN_12
#define PWM3_GPIO_AF               GPIO_AF2_TIM4
#define PWM3_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOD_CLK_ENABLE(); }while(0)

/* TIM4_CH2 - PD13 (舵机1) */
#define PWM1_GPIO_PORT             GPIOD
#define PWM1_GPIO_PIN              GPIO_PIN_13
#define PWM1_GPIO_AF               GPIO_AF2_TIM4
#define PWM1_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOD_CLK_ENABLE(); }while(0)

/* TIM4_CH3 - PD14 (舵机4) */
#define PWM4_GPIO_PORT             GPIOD
#define PWM4_GPIO_PIN              GPIO_PIN_14
#define PWM4_GPIO_AF               GPIO_AF2_TIM4
#define PWM4_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOD_CLK_ENABLE(); }while(0)

/* TIM4_CH4 - PD15 (舵机2) */
#define PWM2_GPIO_PORT             GPIOD
#define PWM2_GPIO_PIN              GPIO_PIN_15
#define PWM2_GPIO_AF               GPIO_AF2_TIM4
#define PWM2_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOD_CLK_ENABLE(); }while(0)

/* ========================================
 * TIM8 通道配置 (舵机5-6 2通道)
 * TIM8_CH1 - PC6
 * TIM8_CH2 - PC7
 * ======================================== */

/* TIM8_CH1 - PC6 (舵机5) */
#define PWM5_GPIO_PORT             GPIOC
#define PWM5_GPIO_PIN              GPIO_PIN_6
#define PWM5_GPIO_AF               GPIO_AF3_TIM8
#define PWM5_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOC_CLK_ENABLE(); }while(0)

/* TIM8_CH2 - PC7 (舵机6) */
#define PWM6_GPIO_PORT             GPIOC
#define PWM6_GPIO_PIN              GPIO_PIN_7
#define PWM6_GPIO_AF               GPIO_AF3_TIM8
#define PWM6_GPIO_CLK_ENABLE()     do{ __HAL_RCC_GPIOC_CLK_ENABLE(); }while(0)

/* PWM 句柄 */
extern TIM_HandleTypeDef g_tim1_pwm_handle;
extern TIM_HandleTypeDef g_tim3_pwm_handle;
extern TIM_HandleTypeDef g_tim4_pwm_handle;
extern TIM_HandleTypeDef g_tim8_pwm_handle;

/* 函数声明 */
void pwm_init(uint16_t arr, uint16_t psc);
void pwm_set_duty(uint8_t ch, uint16_t duty);
void pwm_set_all_servo_duty(uint16_t duty);
void pwm_set_all_led_duty(uint16_t duty);

#endif
