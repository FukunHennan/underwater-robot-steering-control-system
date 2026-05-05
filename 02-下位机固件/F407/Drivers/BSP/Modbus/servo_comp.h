/**
 ****************************************************************************************************
 * @file        servo_comp.h
 * @author      chenfukun
 * @brief       Servo attitude compensation - Flash persistence (Sector 3, 0x0800C000)
 ****************************************************************************************************
 */

#ifndef __SERVO_COMP_H
#define __SERVO_COMP_H

#include "stdint.h"
#include "stm32f4xx_hal.h"

#define SERVO_COMP_CH_COUNT      8
#define SERVO_COMP_FLASH_ADDR    0x0800C000U   /* Sector 3, 16 KB */
#define SERVO_COMP_FLASH_SECTOR  FLASH_SECTOR_3
#define SERVO_COMP_MAGIC         0x5C04B17AU
#define SERVO_COMP_CMD_SAVE      0x5A5A

/**
 * @brief  Servo compensation RAM/Flash layout.
 *         All float fields are stored in big-endian word order (high word first)
 *         matching the Modbus register layout so memcpy to/from regs is trivial.
 */
typedef struct {
    uint32_t magic;
    float    base_angle[SERVO_COMP_CH_COUNT];
    float    k_roll    [SERVO_COMP_CH_COUNT];
    float    k_pitch   [SERVO_COMP_CH_COUNT];
    float    k_yaw     [SERVO_COMP_CH_COUNT];
    uint8_t  auto_en   [SERVO_COMP_CH_COUNT];
    uint8_t  _pad[4];
    uint32_t crc;
} servo_comp_data_t;

/**
 * @brief  Load from Flash; if invalid use zero-init defaults.
 *         Superseded by device_config_load() but kept for first-boot migration.
 */
void servo_comp_init(void);

/**
 * @brief  Copy g_servo_comp back into modbus register array.
 *         Called after servo_comp_init() to restore saved values.
 * @param  regs  Pointer to g_modbus_registers[0]
 */
void servo_comp_apply(uint16_t *regs);

/**
 * @brief  Read current values from modbus registers, build struct, write to Flash.
 *         Superseded by device_config_save(); kept for reference.
 * @param  regs  Pointer to g_modbus_registers[0]
 * @return HAL_OK on success
 */
HAL_StatusTypeDef servo_comp_save(const uint16_t *regs);

/**
 * @brief  Load servo compensation data from an external source into g_servo_comp
 *         and mirror to Modbus registers. Used by device_config_load().
 * @param  src   Source data (all fields except crc are copied)
 * @param  regs  Pointer to g_modbus_registers[0]
 */
void servo_comp_set_data(const servo_comp_data_t *src, uint16_t *regs);

/**
 * @brief  Apply real-time attitude compensation to all enabled servo channels.
 *         Call from main loop after Kalman-filtered attitude is updated.
 *         For servo i with auto_en[i] != 0:
 *           duty_us = clamp(1500 + (base + kR*roll + kP*pitch + kY*yaw) * (500/90), 500, 2500)
 * @param  roll   Filtered roll  angle (deg)
 * @param  pitch  Filtered pitch angle (deg)
 * @param  yaw    Filtered yaw   angle (deg)
 */
void servo_comp_update(float roll, float pitch, float yaw);

#endif /* __SERVO_COMP_H */
