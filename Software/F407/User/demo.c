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
#include "kalman.h"
#include "calib.h"
#include "gpio.h"

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

    /* Initialize Calibration (load from Flash or defaults) */
    printf("[INFO] Loading ADC calibration...\r\n");
    calib_init();
    printf("[OK] Calibration loaded (magic=0x%08X)\r\n\n", (unsigned int)g_calib.magic);

    /* Initialize GPIO expansion pins */
    printf("[INFO] Initializing GPIO...\r\n");
    gpio_init();
    printf("[OK] GPIO initialized!\r\n\n");

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
    
    /* Initialize Kalman filters for attitude angles (Q=0.001, R=0.1) */
    kalman_filter_t kf_roll, kf_pitch, kf_yaw;
    kalman_init(&kf_roll,  0.001f, 0.1f, 0.0f);
    kalman_init(&kf_pitch, 0.001f, 0.1f, 0.0f);
    kalman_init(&kf_yaw,   0.001f, 0.1f, 0.0f);

    /* Initialize Kalman filters for gyroscope (Q=0.01, R=0.05) */
    kalman_filter_t kf_gyro_x, kf_gyro_y, kf_gyro_z;
    kalman_init(&kf_gyro_x, 0.01f, 0.05f, 0.0f);
    kalman_init(&kf_gyro_y, 0.01f, 0.05f, 0.0f);
    kalman_init(&kf_gyro_z, 0.01f, 0.05f, 0.0f);

    uint32_t last_tick = HAL_GetTick();
    printf("[OK] Kalman filters initialized!\r\n\n");

    while (1) {
        /* Calculate dt (seconds) */
        uint32_t now = HAL_GetTick();
        float dt = (now - last_tick) / 1000.0f;
        if (dt < 0.001f) dt = 0.005f;  /* Safeguard: minimum 1ms */
        last_tick = now;

        /* Read MS901M attitude + gyro, apply Kalman filter */
        {
            atk_ms901m_attitude_data_t att;
            atk_ms901m_gyro_data_t gyro;
            float filtered_roll, filtered_pitch, filtered_yaw;
            float filtered_gx, filtered_gy, filtered_gz;

            if (atk_ms901m_get_gyro_accelerometer(&gyro, NULL, 5) == ATK_MS901M_EOK)
            {
                filtered_gx = kalman_update_simple(&kf_gyro_x, gyro.x);
                filtered_gy = kalman_update_simple(&kf_gyro_y, gyro.y);
                filtered_gz = kalman_update_simple(&kf_gyro_z, gyro.z);

                modbus_set_register_float(REG_GYRO_X, filtered_gx);
                modbus_set_register_float(REG_GYRO_Y, filtered_gy);
                modbus_set_register_float(REG_GYRO_Z, filtered_gz);
            }

            if (atk_ms901m_get_attitude(&att, 5) == ATK_MS901M_EOK)
            {
                /* Use gyro as prediction model, attitude angle as observation */
                filtered_roll  = kalman_update(&kf_roll,  att.roll,  filtered_gx, dt);
                filtered_pitch = kalman_update(&kf_pitch, att.pitch, filtered_gy, dt);
                filtered_yaw   = kalman_update(&kf_yaw,   att.yaw,   filtered_gz, dt);

                modbus_set_register_float(REG_ROLL,  filtered_roll);
                modbus_set_register_float(REG_PITCH, filtered_pitch);
                modbus_set_register_float(REG_YAW,   filtered_yaw);
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
