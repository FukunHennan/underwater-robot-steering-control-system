/**
 * @file    kalman.c
 * @brief   六通道一维卡尔曼滤波器实现
 */

#include "kalman.h"

/**
 * @brief  全局6通道卡尔曼滤波器实例
 *         供 Modbus 协议层直接读写 Q/R 参数
 */
kalman_filter_t g_kalman[KALMAN_CH_COUNT];

/**
 * @brief  初始化卡尔曼滤波器
 */
void kalman_init(kalman_filter_t *kf, float q, float r, float init_val)
{
    kf->x = init_val;
    kf->p = 1.0f;          /* 初始误差协方差，设为较大值表示初始不确定 */
    kf->q = q;
    kf->r = r;
    kf->k = 0.0f;
}

/**
 * @brief  设置指定通道的 Q/R 参数（运行时可调）
 * @param  ch   通道索引 (0-5)
 * @param  q    过程噪声
 * @param  r    观测噪声
 */
void kalman_set_params(uint8_t ch, float q, float r)
{
    if (ch < KALMAN_CH_COUNT)
    {
        g_kalman[ch].q = q;
        g_kalman[ch].r = r;
    }
}

/**
 * @brief  复位所有滤波器状态（重新初始化）
 */
void kalman_reset_all(void)
{
    uint8_t i;
    for (i = 0; i < KALMAN_CH_COUNT; i++)
    {
        float old_q = g_kalman[i].q;
        float old_r = g_kalman[i].r;
        kalman_init(&g_kalman[i], old_q, old_r, g_kalman[i].x);
    }
}

/**
 * @brief  卡尔曼滤波更新（带陀螺仪预测模型）
 *
 *  预测步 (Predict)：
 *      x_hat = x + gyro_rate * dt
 *      p_hat = p + Q
 *
 *  更新步 (Update)：
 *      K = p_hat / (p_hat + R)
 *      x = x_hat + K * (measure - x_hat)
 *      p = (1 - K) * p_hat
 */
float kalman_update(kalman_filter_t *kf, float measure, float gyro_rate, float dt)
{
    /* ---- Predict ---- */
    kf->x = kf->x + gyro_rate * dt;        /* 状态预测：角度 += 角速度 × 时间 */
    kf->p = kf->p + kf->q;                 /* 协方差预测 */

    /* ---- Update ---- */
    kf->k = kf->p / (kf->p + kf->r);       /* 卡尔曼增益 */
    kf->x = kf->x + kf->k * (measure - kf->x);  /* 状态校正 */
    kf->p = (1.0f - kf->k) * kf->p;        /* 协方差校正 */

    return kf->x;
}

/**
 * @brief  简化卡尔曼滤波更新（纯观测，无预测模型）
 *
 *  适用于角速度等无明确状态转移模型的信号平滑。
 *
 *  预测步：x_hat = x（保持不变），p_hat = p + Q
 *  更新步：同上
 */
float kalman_update_simple(kalman_filter_t *kf, float measure)
{
    /* ---- Predict ---- */
    /* x 不变 */
    kf->p = kf->p + kf->q;

    /* ---- Update ---- */
    kf->k = kf->p / (kf->p + kf->r);
    kf->x = kf->x + kf->k * (measure - kf->x);
    kf->p = (1.0f - kf->k) * kf->p;

    return kf->x;
}
