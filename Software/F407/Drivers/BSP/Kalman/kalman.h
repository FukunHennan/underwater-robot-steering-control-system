/**
 * @file    kalman.h
 * @brief   一维卡尔曼滤波器 — 用于姿态角 / 角速度平滑
 *
 *  状态模型（以 Roll 轴为例）：
 *      x_k = x_{k-1} + gyro * dt      （预测：上一时刻角度 + 角速度×时间步长）
 *      z_k = attitude_angle            （观测：传感器输出的姿态角）
 *
 *  滤波参数：
 *      Q  — 过程噪声协方差（越大越信任观测）
 *      R  — 观测噪声协方差（越大越信任预测）
 */

#ifndef __KALMAN_H
#define __KALMAN_H

#include <stdint.h>

/**
 * @brief  一维卡尔曼滤波器结构体
 */
typedef struct
{
    float x;        /* 状态估计值 (角度 / 角速度) */
    float p;        /* 估计误差协方差 */
    float q;        /* 过程噪声协方差 Q */
    float r;        /* 观测噪声协方差 R */
    float k;        /* 卡尔曼增益 K（内部使用） */
} kalman_filter_t;

/**
 * @brief  6通道卡尔曼滤波器实例（全局可访问，供 Modbus 读写参数）
 *
 * 通道索引定义：
 *   KALMAN_CH_ROLL = 0,   KALMAN_CH_PITCH = 1,   KALMAN_CH_YAW = 2,
 *   KALMAN_CH_GYRO_X = 3, KALMAN_CH_GYRO_Y = 4,  KALMAN_CH_GYRO_Z = 5
 */
#define KALMAN_CH_COUNT  6
#define KALMAN_CH_ROLL   0
#define KALMAN_CH_PITCH  1
#define KALMAN_CH_YAW    2
#define KALMAN_CH_GYRO_X 3
#define KALMAN_CH_GYRO_Y 4
#define KALMAN_CH_GYRO_Z 5

extern kalman_filter_t g_kalman[KALMAN_CH_COUNT];

/**
 * @brief  初始化卡尔曼滤波器
 * @param  kf       滤波器实例
 * @param  q        过程噪声 Q（推荐 0.001 ~ 0.01）
 * @param  r        观测噪声 R（推荐 0.01 ~ 0.5）
 * @param  init_val 初始状态估计值
 */
void kalman_init(kalman_filter_t *kf, float q, float r, float init_val);

/**
 * @brief  卡尔曼滤波更新（带预测模型）
 * @param  kf        滤波器实例
 * @param  measure   观测值（传感器输出的姿态角）
 * @param  gyro_rate 陀螺仪角速度 (deg/s)，用于预测步
 * @param  dt        时间步长 (s)
 * @return 滤波后的估计值
 */
float kalman_update(kalman_filter_t *kf, float measure, float gyro_rate, float dt);

/**
 * @brief  简化卡尔曼滤波更新（无预测模型，纯观测滤波）
 * @param  kf        滤波器实例
 * @param  measure   观测值
 * @return 滤波后的估计值
 */
float kalman_update_simple(kalman_filter_t *kf, float measure);

/**
 * @brief  设置指定通道的 Q/R 参数
 * @param  ch   通道索引 (0-5)
 * @param  q    过程噪声
 * @param  r    观测噪声
 */
void kalman_set_params(uint8_t ch, float q, float r);

/**
 * @brief  复位所有滤波器状态（重新初始化）
 */
void kalman_reset_all(void);

#endif
