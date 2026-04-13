#include "pwm.h"

TIM_HandleTypeDef g_tim1_pwm_handle;

/**
 * @brief       PWM初始化函数
 * @param       arr: 自动重装载值
 * @param       psc: 预分频器值
 * @retval      无
 */
void pwm_init(uint16_t arr, uint16_t psc)
{
    TIM_OC_InitTypeDef tim_oc_init;
    GPIO_InitTypeDef gpio_init_struct;
    
    /* 使能TIM1时钟 */
    PWM_TIMx_CLK_ENABLE();
    
    /* 使能GPIOE时钟 */
    PWM1_GPIO_CLK_ENABLE();
    PWM2_GPIO_CLK_ENABLE();
    
    /* 配置PE9引脚 */
    gpio_init_struct.Pin = PWM1_GPIO_PIN;
    gpio_init_struct.Mode = GPIO_MODE_AF_PP;
    gpio_init_struct.Pull = GPIO_PULLUP;  /* 硬件上拉 */
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio_init_struct.Alternate = PWM1_GPIO_AF;
    HAL_GPIO_Init(PWM1_GPIO_PORT, &gpio_init_struct);
    
    /* 配置PE11引脚 */
    gpio_init_struct.Pin = PWM2_GPIO_PIN;
    gpio_init_struct.Mode = GPIO_MODE_AF_PP;
    gpio_init_struct.Pull = GPIO_PULLUP;  /* 硬件上拉 */
    gpio_init_struct.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio_init_struct.Alternate = PWM2_GPIO_AF;
    HAL_GPIO_Init(PWM2_GPIO_PORT, &gpio_init_struct);
    
    /* 初始化TIM1 */
    g_tim1_pwm_handle.Instance = PWM_TIMx;
    g_tim1_pwm_handle.Init.Prescaler = psc;
    g_tim1_pwm_handle.Init.CounterMode = TIM_COUNTERMODE_UP;
    g_tim1_pwm_handle.Init.Period = arr;
    g_tim1_pwm_handle.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    g_tim1_pwm_handle.Init.RepetitionCounter = 0;
    HAL_TIM_PWM_Init(&g_tim1_pwm_handle);
    
    /* 配置CH1 */
    tim_oc_init.OCMode = TIM_OCMODE_PWM1;
    tim_oc_init.Pulse = 0;
    tim_oc_init.OCPolarity = TIM_OCPOLARITY_HIGH;
    tim_oc_init.OCNPolarity = TIM_OCNPOLARITY_HIGH;
    tim_oc_init.OCFastMode = TIM_OCFAST_DISABLE;
    tim_oc_init.OCIdleState = TIM_OCIDLESTATE_RESET;
    tim_oc_init.OCNIdleState = TIM_OCNIDLESTATE_RESET;
    HAL_TIM_PWM_ConfigChannel(&g_tim1_pwm_handle, &tim_oc_init, TIM_CHANNEL_1);
    
    /* 配置CH2 */
    HAL_TIM_PWM_ConfigChannel(&g_tim1_pwm_handle, &tim_oc_init, TIM_CHANNEL_2);
    
    /* 启动PWM */
    HAL_TIM_PWM_Start(&g_tim1_pwm_handle, TIM_CHANNEL_1);
    HAL_TIM_PWM_Start(&g_tim1_pwm_handle, TIM_CHANNEL_2);
}

/**
 * @brief       设置PWM占空比
 * @param       ch: 通道号 (1-2)
 * @param       duty: 占空比 (0-arr)
 * @retval      无
 */
void pwm_set_duty(uint8_t ch, uint16_t duty)
{
    switch(ch)
    {
        case 1:
            __HAL_TIM_SET_COMPARE(&g_tim1_pwm_handle, TIM_CHANNEL_1, duty);
            break;
        case 2:
            __HAL_TIM_SET_COMPARE(&g_tim1_pwm_handle, TIM_CHANNEL_2, duty);
            break;
        default:
            break;
    }
}