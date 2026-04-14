/**
 ****************************************************************************************************
 * @file        atk_ms901m.h
 * @author      chenfukun
 * @version     V1.0
 * @date        2026-04-14
 * @brief       水下智能转向系统 - ATK-MS901M 模块头文件
 * @license     Copyright (c) 2025-2026, 毕业设计项目
 ****************************************************************************************************
 * @attention
 *
 * 项目名称: 水下智能转向系统
 * 实验平台: STM32F407
 *
 ****************************************************************************************************
 */

#ifndef __ATM_MS901M_H
#define __ATM_MS901M_H

#include "sys.h"
#include "atk_ms901m_uart.h"

/* ATK-MS901M UART communication frame maximum data length */
#define ATK_MS901M_FRAME_DAT_MAX_SIZE       28

/* ATK-MS901M data upload frame ID */
#define ATK_MS901M_FRAME_ID_ATTITUDE        0x01    /* Attitude */
#define ATK_MS901M_FRAME_ID_QUAT            0x02    /* Quaternion */
#define ATK_MS901M_FRAME_ID_GYRO_ACCE       0x03    /* Gyroscope and accelerometer */
#define ATK_MS901M_FRAME_ID_MAG             0x04    /* Magnetometer */
#define ATK_MS901M_FRAME_ID_BARO            0x05    /* Barometer */
#define ATK_MS901M_FRAME_ID_PORT            0x06    /* Port */

/* ATK-MS901M command frame ID */
#define ATK_MS901M_FRAME_ID_REG_SAVE        0x00    /* W  Save current settings to Flash */
#define ATK_MS901M_FRAME_ID_REG_SENCAL      0x01    /* W  Perform sensor calibration */
#define ATK_MS901M_FRAME_ID_REG_SENSTA      0x02    /* R  Read sensor calibration status */
#define ATK_MS901M_FRAME_ID_REG_GYROFSR     0x03    /* R/W Set gyroscope range */
#define ATK_MS901M_FRAME_ID_REG_ACCFSR      0x04    /* R/W Set accelerometer range */
#define ATK_MS901M_FRAME_ID_REG_GYROBW      0x05    /* R/W Set gyroscope bandwidth */
#define ATK_MS901M_FRAME_ID_REG_ACCBW       0x06    /* R/W Set accelerometer bandwidth */
#define ATK_MS901M_FRAME_ID_REG_BAUD        0x07    /* R/W Set UART communication baud rate */
#define ATK_MS901M_FRAME_ID_REG_RETURNSET   0x08    /* R/W Set return data */
#define ATK_MS901M_FRAME_ID_REG_RETURNSET2  0x09    /* R/W Set return data 2 (Extended) */
#define ATK_MS901M_FRAME_ID_REG_RETURNRATE  0x0A    /* R/W Set return rate */
#define ATK_MS901M_FRAME_ID_REG_ALG         0x0B    /* R/W Set algorithm */
#define ATK_MS901M_FRAME_ID_REG_ASM         0x0C    /* R/W Set mounting position */
#define ATK_MS901M_FRAME_ID_REG_GAUCAL      0x0D    /* R/W Set gyroscope and accelerometer calibration parameters */
#define ATK_MS901M_FRAME_ID_REG_BAUCAL      0x0E    /* R/W Set barometer calibration parameters */
#define ATK_MS901M_FRAME_ID_REG_LEDOFF      0x0F    /* R/W Set LED switch */
#define ATK_MS901M_FRAME_ID_REG_D0MODE      0x10    /* R/W Set port D0 mode */
#define ATK_MS901M_FRAME_ID_REG_D1MODE      0x11    /* R/W Set port D1 mode */
#define ATK_MS901M_FRAME_ID_REG_D2MODE      0x12    /* R/W Set port D2 mode */
#define ATK_MS901M_FRAME_ID_REG_D3MODE      0x13    /* R/W Set port D3 mode */
#define ATK_MS901M_FRAME_ID_REG_D1PULSE     0x16    /* R/W Set port D1 PWM high level time */
#define ATK_MS901M_FRAME_ID_REG_D3PULSE     0x1A    /* R/W Set port D3 PWM high level time */
#define ATK_MS901M_FRAME_ID_REG_D1PERIOD    0x1F    /* R/W Set port D1 PWM period */
#define ATK_MS901M_FRAME_ID_REG_D3PERIOD    0x23    /* R/W Set port D3 PWM period */
#define ATK_MS901M_FRAME_ID_REG_RESET       0x7F    /* W  Restore default settings */

/* ATK-MS901M frame type */
#define ATK_MS901M_FRAME_ID_TYPE_UPLOAD     0       /* ATK-MS901M data upload frame ID */
#define ATK_MS901M_FRAME_ID_TYPE_ACK        1       /* ATK-MS901M command response frame ID */

/* Attitude data structure */
typedef struct
{
    float roll;                                     /* Roll angle, unit: degrees */
    float pitch;                                    /* Pitch angle, unit: degrees */
    float yaw;                                      /* Yaw angle, unit: degrees */
} atk_ms901m_attitude_data_t;

/* Quaternion data structure */
typedef struct
{
    float q0;                                       /* Q0 */
    float q1;                                       /* Q1 */
    float q2;                                       /* Q2 */
    float q3;                                       /* Q3 */
} atk_ms901m_quaternion_data_t;

/* Gyroscope data structure */
typedef struct
{
    struct
    {
        int16_t x;                                  /* X-axis raw data */
        int16_t y;                                  /* Y-axis raw data */
        int16_t z;                                  /* Z-axis raw data */
    } raw;
    float x;                                        /* X-axis angular velocity, unit: dps */
    float y;                                        /* Y-axis angular velocity, unit: dps */
    float z;                                        /* Z-axis angular velocity, unit: dps */
} atk_ms901m_gyro_data_t;

/* Accelerometer data structure */
typedef struct
{
    struct
    {
        int16_t x;                                  /* X-axis raw data */
        int16_t y;                                  /* Y-axis raw data */
        int16_t z;                                  /* Z-axis raw data */
    } raw;
    float x;                                        /* X-axis acceleration, unit: G */
    float y;                                        /* Y-axis acceleration, unit: G */
    float z;                                        /* Z-axis acceleration, unit: G */
} atk_ms901m_accelerometer_data_t;

/* Magnetometer data structure */
typedef struct
{
    int16_t x;                                      /* X-axis magnetic field strength */
    int16_t y;                                      /* Y-axis magnetic field strength */
    int16_t z;                                      /* Z-axis magnetic field strength */
    float temperature;                              /* Temperature, unit: degrees Celsius */
} atk_ms901m_magnetometer_data_t;

/* Barometer data structure */
typedef struct
{
    int32_t pressure;                               /* Pressure, unit: Pa */
    int32_t altitude;                               /* Altitude, unit: cm */
    float temperature;                              /* Temperature, unit: degrees Celsius */
} atk_ms901m_barometer_data_t;

/* Port data structure */
typedef struct
{
    uint16_t d0;                                    /* Port D0 value */
    uint16_t d1;                                    /* Port D1 value */
    uint16_t d2;                                    /* Port D2 value */
    uint16_t d3;                                    /* Port D3 value */
} atk_ms901m_port_data_t;

/* ATK-MS901M LED state definition */
typedef enum
{
    ATK_MS901M_LED_STATE_ON  = 0x00,                /* LED on */
    ATK_MS901M_LED_STATE_OFF = 0x01,                /* LED off */
} atk_ms901m_led_state_t;

/* ATK-MS901M port definition */
typedef enum
{
    ATK_MS901M_PORT_D0 = 0x00,                      /* Port D0 */
    ATK_MS901M_PORT_D1 = 0x01,                      /* Port D1 */
    ATK_MS901M_PORT_D2 = 0x02,                      /* Port D2 */
    ATK_MS901M_PORT_D3 = 0x03,                      /* Port D3 */
} atk_ms901m_port_t;

/* ATK-MS901M port mode definition */
typedef enum
{
    ATK_MS901M_PORT_MODE_ANALOG_INPUT   = 0x00,     /* Analog input */
    ATK_MS901M_PORT_MODE_INPUT          = 0x01,     /* Digital input */
    ATK_MS901M_PORT_MODE_OUTPUT_HIGH    = 0x02,     /* Digital output high */
    ATK_MS901M_PORT_MODE_OUTPUT_LOW     = 0x03,     /* Digital output low */
    ATK_MS901M_PORT_MODE_OUTPUT_PWM     = 0x04,     /* PWM output */
} atk_ms901m_port_mode_t;

/* Error codes */
#define ATK_MS901M_EOK      0                       /* No error */
#define ATK_MS901M_ERROR    1                       /* Error */
#define ATK_MS901M_EINVAL   2                       /* Invalid parameter */
#define ATK_MS901M_ETIMEOUT 3                       /* Timeout error */

/* Function declarations */
uint8_t atk_ms901m_read_reg_by_id(uint8_t id, uint8_t *dat, uint32_t timeout);                                                                      /* Read ATK-MS901M register by frame ID */
uint8_t atk_ms901m_write_reg_by_id(uint8_t id, uint8_t len, uint8_t *dat);                                                                          /* Write ATK-MS901M register by frame ID */
uint8_t atk_ms901m_init(uint32_t baudrate);                                                                                                         /* ATK-MS901M initialization */
uint8_t atk_ms901m_get_attitude(atk_ms901m_attitude_data_t *attitude_dat, uint32_t timeout);                                                        /* Get ATK-MS901M attitude data */
uint8_t atk_ms901m_get_quaternion(atk_ms901m_quaternion_data_t *quaternion_dat, uint32_t timeout);                                                  /* Get ATK-MS901M quaternion data */
uint8_t atk_ms901m_get_gyro_accelerometer(atk_ms901m_gyro_data_t *gyro_dat, atk_ms901m_accelerometer_data_t *accelerometer_dat, uint32_t timeout);  /* Get ATK-MS901M gyroscope and accelerometer data */
uint8_t atk_ms901m_get_magnetometer(atk_ms901m_magnetometer_data_t *magnetometer_dat, uint32_t timeout);                                            /* Get ATK-MS901M magnetometer data */
uint8_t atk_ms901m_get_barometer(atk_ms901m_barometer_data_t *barometer_dat, uint32_t timeout);                                                     /* Get ATK-MS901M barometer data */
uint8_t atk_ms901m_get_port(atk_ms901m_port_data_t *port_dat, uint32_t timeout);                                                                    /* Get ATK-MS901M port data */
uint8_t atk_ms901m_get_led_state(atk_ms901m_led_state_t *state, uint32_t timeout);                                                                  /* Get ATK-MS901M LED state */
uint8_t atk_ms901m_set_led_state(atk_ms901m_led_state_t state, uint32_t timeout);                                                                   /* Set ATK-MS901M LED state */
uint8_t atk_ms901m_get_port_mode(atk_ms901m_port_t port, atk_ms901m_port_mode_t *mode, uint32_t timeout);                                           /* Get ATK-MS901M specified port mode */
uint8_t atk_ms901m_set_port_mode(atk_ms901m_port_t port, atk_ms901m_port_mode_t mode, uint32_t timeout);                                            /* Set ATK-MS901M specified port mode */
uint8_t atk_ms901m_get_port_pwm_pulse(atk_ms901m_port_t port, uint16_t *pulse, uint32_t timeout);                                                   /* Get ATK-MS901M specified port PWM high level time */
uint8_t atk_ms901m_set_port_pwm_pulse(atk_ms901m_port_t port, uint16_t pulse, uint32_t timeout);                                                    /* Set ATK-MS901M specified port PWM high level time */
uint8_t atk_ms901m_get_port_pwm_period(atk_ms901m_port_t port, uint16_t *period, uint32_t timeout);                                                 /* Get ATK-MS901M specified port PWM period */
uint8_t atk_ms901m_set_port_pwm_period(atk_ms901m_port_t port, uint16_t period, uint32_t timeout);                                                  /* Set ATK-MS901M specified port PWM period */

#endif
