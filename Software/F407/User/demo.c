/**
 ****************************************************************************************************
 * @file        demo.c
 * @author      chenfukun
 * @version     V3.0
 * @date        2026-04-14
 * @brief       Underwater Intelligent Steering System - Modbus Mode
 * @license     Copyright (c) 2025-2026, Graduation Project
 ****************************************************************************************************
 * @attention
 *
 * Project Name: Underwater Intelligent Steering System
 * Test Platform: STM32F407
 *
 * Mode: Modbus Mode (Using FreeModbus)
 *
 ****************************************************************************************************
 */

#include "demo.h"
#include "usart.h"
#include "delay.h"
#include "modbus.h"
#include "adc.h"
#include "pwm.h"
#include "atk_ms901m.h"
#include <string.h>

/**
 * @brief       Demo Main Function - Modbus Mode
 * @param       None
 * @retval      None
 */
void demo_run(void)
{
    
    /* Print startup info */
    printf("\r\n\r\n");
    printf("========================================\r\n");
    printf("  Underwater Intelligent Steering System\r\n");
    printf("           MODBUS MODE\r\n");
    printf("========================================\r\n\r\n");
    
    printf("[INFO] Initializing system...\r\n\r\n");
    
    /* Initialize ADC */
    printf("[INFO] Initializing ADC...\r\n");
    adc_init();
    printf("[OK] ADC initialized!\r\n\n");

    /* Initialize PWM: 50Hz for servo (84MHz / 84 / 20000 = 50Hz) */
    printf("[INFO] Initializing PWM...\r\n");
    pwm_init(19999, 83);
    printf("[OK] PWM initialized!\r\n\n");

    /* Initialize MS901M attitude sensor (USART3, 115200) */
    printf("[INFO] Initializing MS901M...\r\n");
    if (atk_ms901m_init(115200) == ATK_MS901M_EOK)
    {
        printf("[OK] MS901M initialized!\r\n\n");
    }
    else
    {
        printf("[WARN] MS901M init failed (sensor not connected?)\r\n\n");
    }

    /* Initialize Modbus */
    printf("[INFO] Initializing Modbus...\r\n");
    modbus_init();
    printf("[OK] Modbus initialized!\r\n\n");
    
    printf("\r\n");
    printf("========================================\r\n");
    printf("         SYSTEM READY!\r\n");
    printf("========================================\r\n");
    printf("\r\n");
    printf("[INFO] System is running in Modbus mode\r\n");
    printf("[INFO] Modbus RTU slave is ready\r\n");
    printf("[INFO] Waiting for Modbus requests...\r\n");
    printf("\r\n");
    
    while (1) {
        /* Read MS901M attitude (non-blocking: 5ms timeout) */
        {
            atk_ms901m_attitude_data_t att;
            atk_ms901m_gyro_data_t gyro;

            if (atk_ms901m_get_attitude(&att, 5) == ATK_MS901M_EOK)
            {
                modbus_set_register_float(REG_ROLL,  att.roll);
                modbus_set_register_float(REG_PITCH, att.pitch);
                modbus_set_register_float(REG_YAW,   att.yaw);
            }

            if (atk_ms901m_get_gyro_accelerometer(&gyro, NULL, 5) == ATK_MS901M_EOK)
            {
                modbus_set_register_float(REG_GYRO_X, gyro.x);
                modbus_set_register_float(REG_GYRO_Y, gyro.y);
                modbus_set_register_float(REG_GYRO_Z, gyro.z);
            }
        }

        /* Read MS901M barometer (non-blocking: 5ms timeout) */
        {
            atk_ms901m_barometer_data_t baro;

            if (atk_ms901m_get_barometer(&baro, 5) == ATK_MS901M_EOK)
            {
                modbus_set_register_int32(REG_PRESSURE_H, baro.pressure);
                modbus_set_register_int32(REG_ALTITUDE_H, baro.altitude);
                modbus_set_register_float(REG_BARO_TEMP,  baro.temperature);
            }
        }

        /* Process Modbus (includes sensor register update + eMBPoll) */
        modbus_process();

        /* Small delay */
        delay_ms(5);
    }
}
