/**
 ****************************************************************************************************
 * @file        demo.c
 * @author      ALIENTEK
 * @version     V1.0
 * @date        2022-06-21
 * @brief       ATK-MS901M module usage example
 * @license     Copyright (c) 2020-2032, ALIENTEK
 ****************************************************************************************************
 * @attention
 *
 * Test platform: ALIENTEK F407 motor control board
 * Website: www.yuanzige.com
 * Forum: www.openedv.com
 * Company website: www.alientek.com
 * Taobao: openedv.taobao.com
 *
 ****************************************************************************************************
 */

#include "demo.h"
#include "./BSP/ATK_MS901M/atk_ms901m.h"
#include "./BSP/PWM/pwm.h"
#include "./SYSTEM/usart/usart.h"
#include "./SYSTEM/delay/delay.h"

/**
 * @brief       Read and display ATK-MS901M data
 * @param       None
 * @retval      None
 */
static void demo_get_data(void)
{
    atk_ms901m_attitude_data_t attitude_dat;           /* Attitude data */
    atk_ms901m_gyro_data_t gyro_dat;                   /* Gyroscope data */
    atk_ms901m_accelerometer_data_t accelerometer_dat; /* Accelerometer data */
    atk_ms901m_magnetometer_data_t magnetometer_dat;   /* Magnetometer data */
    atk_ms901m_barometer_data_t barometer_dat;         /* Barometer data */
    uint8_t ret;
    
    /* Read ATK-MS901 data */
    ret = atk_ms901m_get_attitude(&attitude_dat, 100);                            /* Read attitude data */
    if (ret != ATK_MS901M_EOK) {
        printf("Failed to read attitude data!\r\n");
    }
    
    ret = atk_ms901m_get_gyro_accelerometer(&gyro_dat, &accelerometer_dat, 100);  /* Read gyroscope and accelerometer data */
    if (ret != ATK_MS901M_EOK) {
        printf("Failed to read gyro/accelerometer data!\r\n");
    }
    
    ret = atk_ms901m_get_magnetometer(&magnetometer_dat, 100);                    /* Read magnetometer data */
    if (ret != ATK_MS901M_EOK) {
        printf("Failed to read magnetometer data!\r\n");
    }
    
    ret = atk_ms901m_get_barometer(&barometer_dat, 100);                          /* Read barometer data */
    if (ret != ATK_MS901M_EOK) {
        printf("Failed to read barometer data!\r\n");
    }
    
    /* Print data via serial port */
    printf("Roll: %.02f° Pitch: %.02f° Yaw: %.02f°\r\n", attitude_dat.roll, attitude_dat.pitch, attitude_dat.yaw);
    printf("Gx: %.02f°/s Gy: %.02f°/s Gz: %.02f°/s\r\n", gyro_dat.x, gyro_dat.y, gyro_dat.z);
    printf("Ax: %.02fG Ay: %.02fG Az: %.02fG\r\n", accelerometer_dat.x, accelerometer_dat.y, accelerometer_dat.z);
    printf("Mx: %d My: %d Mz: %d, Temp: %.02f°C\r\n", magnetometer_dat.x, magnetometer_dat.y, magnetometer_dat.z, magnetometer_dat.temperature);
    printf("Pres: %dPa Alt: %dcm Temp: %.02f°C\r\n", barometer_dat.pressure, barometer_dat.altitude, barometer_dat.temperature);
    printf("****************************************\r\n\r\n");
}

/**
 * @brief       Demo main function
 * @param       None
 * @retval      None
 */
void demo_run(void)
{
    uint8_t ret;
    uint16_t duty = 0;
    uint8_t dir = 1;
    
    /* Initialize PWM */
    pwm_init(999, 167); /* 168MHz / (167+1) / (999+1) = 1kHz */
    printf("PWM initialized!\r\n");
    printf("PE9 (TIM1_CH1) and PE11 (TIM1_CH2) configured as PWM output\r\n");
    printf("Hardware pull-up enabled\r\n\n");
    
    /* Initialize ATK-MS901M */
    ret = atk_ms901m_init(115200);
    if (ret != 0)
    {
        printf("ATK-MS901M init failed!\r\n");
        while (1)
        {
            delay_ms(200);
        }
    }
    
    printf("ATK-MS901M init success!\r\n\n");
    printf("Starting to read data...\r\n\n");
    
    while (1)
    {
        /* Read and display ATK-MS901 data */
        demo_get_data();
        
        /* Test PWM */
        if (dir)
        {
            duty += 10;
            if (duty > 999)
            {
                duty = 999;
                dir = 0;
            }
        }
        else
        {
            duty -= 10;
            if (duty < 0)
            {
                duty = 0;
                dir = 1;
            }
        }
        
        pwm_set_duty(1, duty); /* Set PE9 duty cycle */
        pwm_set_duty(2, 999 - duty); /* Set PE11 duty cycle (complementary) */
        printf("PWM Duty: PE9=%d%%, PE11=%d%%\r\n", duty / 10, (999 - duty) / 10);
        
        delay_ms(1000); /* Read once every 1 second */
    }
}
