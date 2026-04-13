#ifndef _PWM_H
#define _PWM_H

#include "sys.h"

/* PWM引脚定义 */
#define PWM_TIMx                       TIM1
#define PWM_TIMx_CLK_ENABLE()          do{ __HAL_RCC_TIM1_CLK_ENABLE(); }while(0)

/* PE9 - TIM1_CH1 */
#define PWM1_GPIO_PORT                 GPIOE
#define PWM1_GPIO_PIN                  GPIO_PIN_9
#define PWM1_GPIO_AF                   GPIO_AF1_TIM1
#define PWM1_GPIO_CLK_ENABLE()         do{ __HAL_RCC_GPIOE_CLK_ENABLE(); }while(0)

/* PE11 - TIM1_CH2 */
#define PWM2_GPIO_PORT                 GPIOE
#define PWM2_GPIO_PIN                  GPIO_PIN_11
#define PWM2_GPIO_AF                   GPIO_AF1_TIM1
#define PWM2_GPIO_CLK_ENABLE()         do{ __HAL_RCC_GPIOE_CLK_ENABLE(); }while(0)

extern TIM_HandleTypeDef g_tim1_pwm_handle;

void pwm_init(uint16_t arr, uint16_t psc);
void pwm_set_duty(uint8_t ch, uint16_t duty);

#endif