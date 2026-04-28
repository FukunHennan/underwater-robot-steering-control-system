# PWM 控制逻辑

STM32F407 的 10 路 PWM 输出控制实现，支持 8 路舵机和 2 路 LED 调光。

---

## 概述

系统使用 4 个定时器产生 10 路 PWM 信号，频率和占空比均可通过 Modbus 寄存器运行时调节。

---

## 硬件配置

### 舵机控制 (8 路)

| 通道 | 引脚 | 定时器 | 默认频率 | 脉宽范围 |
|------|------|--------|---------|---------|
| SERVO1 | PA8 | TIM1_CH1 | 50Hz | 500-2500μs |
| SERVO2 | PA9 | TIM1_CH2 | 50Hz | 500-2500μs |
| SERVO3 | PA10 | TIM1_CH3 | 50Hz | 500-2500μs |
| SERVO4 | PA11 | TIM1_CH4 | 50Hz | 500-2500μs |
| SERVO5 | PC6 | TIM8_CH1 | 50Hz | 500-2500μs |
| SERVO6 | PC7 | TIM8_CH2 | 50Hz | 500-2500μs |
| SERVO7 | PC8 | TIM8_CH3 | 50Hz | 500-2500μs |
| SERVO8 | PC9 | TIM8_CH4 | 50Hz | 500-2500μs |

### LED 调光 (2 路)

| 通道 | 引脚 | 定时器 | 占空比范围 | 说明 |
|------|------|--------|-----------|------|
| LED1 | PA15 | TIM2_CH1 | 0-1000 | LED1 亮度 |
| LED2 | PC10 | TIM2_CH2 | 0-1000 | LED2 亮度 |

---

## 定时器分组

| 组 | 定时器 | 通道 | 频率独立 | 说明 |
|----|--------|------|---------|------|
| 1 | TIM1 | CH1-4 | ✅ | SERVO1-4 |
| 2 | TIM8 | CH1-4 | ✅ | SERVO5-8 |
| 3 | TIM2 | CH1-2 | ✅ | LED1-2 |
| 4 | TIM3 | - | ✅ | 预留 |

**注意**: 同组内通道共享频率，但占空比独立可调。

---

## 频率计算

```
PWM 频率 = TIMx_CLK / [(PSC+1) × (ARR+1)]
```

默认配置：
- TIMx_CLK = 84 MHz (APB2)
- PSC = 83
- ARR = 19999
- 频率 = 84MHz / 84 / 20000 = 50 Hz

---

## 舵机角度转换

```
angle (°) = (pulse_width - 1500) / 10
```

| 脉宽 (μs) | 角度 (°) | 说明 |
|-----------|---------|------|
| 500 | -100° | 最小角度 |
| 1500 | 0° | 中点 |
| 2500 | +100° | 最大角度 |

---

## 控制流程

### 1. Modbus 写入流程

```
上位机写入 PWM 寄存器 (0x0020-0x0029)
        ↓
下位机 Modbus 回调处理
        ↓
更新 CCR 寄存器值
        ↓
PWM 输出更新
```

### 2. 脉宽设置函数

```c
void pwm_set_servo_pulse(uint8_t channel, uint16_t pulse_us)
{
    // 限制范围
    if (pulse_us < 500) pulse_us = 500;
    if (pulse_us > 2500) pulse_us = 2500;
    
    // 转换为 CCR 值
    uint16_t ccr = (pulse_us * (ARR+1)) / 20000;
    
    // 根据通道更新 CCR
    switch(channel) {
        case 0: __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, ccr); break;
        case 1: __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_2, ccr); break;
        // ...
    }
}
```

### 3. LED 亮度设置

```c
void pwm_set_led_brightness(uint8_t led, uint16_t brightness)
{
    if (brightness > 1000) brightness = 1000;
    
    // 线性映射到 ARR 范围
    uint16_t ccr = (brightness * 20000) / 1000;
    
    if (led == 0) {
        __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, ccr);
    } else {
        __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_2, ccr);
    }
}
```

---

## Modbus 寄存器映射

### PWM 控制寄存器

| 地址 | 名称 | 类型 | 范围 | 说明 |
|------|------|------|------|------|
| 0x0020 | SERVO1 | RW | 500-2500 | 舵机 1 脉宽 (μs) |
| 0x0021 | SERVO2 | RW | 500-2500 | 舵机 2 脉宽 (μs) |
| 0x0022 | SERVO3 | RW | 500-2500 | 舵机 3 脉宽 (μs) |
| 0x0023 | SERVO4 | RW | 500-2500 | 舵机 4 脉宽 (μs) |
| 0x0024 | SERVO5 | RW | 500-2500 | 舵机 5 脉宽 (μs) |
| 0x0025 | SERVO6 | RW | 500-2500 | 舵机 6 脉宽 (μs) |
| 0x0026 | SERVO7 | RW | 500-2500 | 舵机 7 脉宽 (μs) |
| 0x0027 | SERVO8 | RW | 500-2500 | 舵机 8 脉宽 (μs) |
| 0x0028 | LED1 | RW | 0-1000 | LED1 亮度 |
| 0x0029 | LED2 | RW | 0-1000 | LED2 亮度 |

### PWM 频率配置寄存器

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0040 | PWM_ARR_G1 | RW | 组 1 ARR 值 |
| 0x0041 | PWM_PSC_G1 | RW | 组 1 PSC 值 |
| 0x0042 | PWM_ARR_G2 | RW | 组 2 ARR 值 |
| 0x0043 | PWM_PSC_G2 | RW | 组 2 PSC 值 |
| 0x0044 | PWM_ARR_G3 | RW | 组 3 ARR 值 |
| 0045 | PWM_PSC_G3 | RW | 组 3 PSC 值 |
| 0x0046 | PWM_ARR_G4 | RW | 组 4 ARR 值 |
| 0x0047 | PWM_PSC_G4 | RW | 组 4 PSC 值 |

---

## 频率更新流程

```c
void pwm_update_frequency(uint8_t group, uint16_t arr, uint16_t psc)
{
    TIM_HandleTypeDef *htim;
    
    // 选择定时器
    switch(group) {
        case 0: htim = &htim1; break;
        case 1: htim = &htim8; break;
        case 2: htim = &htim2; break;
        case 3: htim = &htim3; break;
        default: return;
    }
    
    // 停止 PWM
    HAL_TIM_PWM_Stop(htim, ALL_CHANNELS);
    
    // 更新 ARR 和 PSC
    __HAL_TIM_SET_AUTORELOAD(htim, arr);
    __HAL_TIM_SET_PRESCALER(htim, psc);
    
    // 重新启动 PWM
    HAL_TIM_PWM_Start(htim, ALL_CHANNELS);
}
```

---

## 初始化代码

```c
void pwm_init(void)
{
    // TIM1 初始化
    htim1.Instance = TIM1;
    htim1.Init.Prescaler = 83;
    htim1.Init.CounterMode = TIM_COUNTERMODE_UP;
    htim1.Init.Period = 19999;
    htim1.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    HAL_TIM_PWM_Init(&htim1);
    
    // TIM8 初始化
    htim8.Instance = TIM8;
    htim8.Init.Prescaler = 83;
    htim8.Init.Period = 19999;
    HAL_TIM_PWM_Init(&htim8);
    
    // TIM2 初始化
    htim2.Instance = TIM2;
    htim2.Init.Prescaler = 83;
    htim2.Init.Period = 19999;
    HAL_TIM_PWM_Init(&htim2);
    
    // 启动所有 PWM 通道
    HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1 | TIM_CHANNEL_2 | 
                              TIM_CHANNEL_3 | TIM_CHANNEL_4);
    HAL_TIM_PWM_Start(&htim8, TIM_CHANNEL_1 | TIM_CHANNEL_2 | 
                              TIM_CHANNEL_3 | TIM_CHANNEL_4);
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1 | TIM_CHANNEL_2);
}
```

---

## 性能指标

| 指标 | 值 | 说明 |
|------|-----|------|
| PWM 分辨率 | 16 位 | CCR 寄存器宽度 |
| 最小脉宽步进 | 1μs | 在 50Hz 时 |
| 频率范围 | 1Hz-1MHz | 取决于 PSC/ARR |
| 舵机响应时间 | <20ms | 50Hz 周期 |

---

## 注意事项

1. **同组频率共享** - 修改组 1 (TIM1) 频率会影响 SERVO1-4
2. **舵机供电** - 确保舵机电源电压稳定 (通常 5-6V)
3. **信号电平** - STM32 输出 3.3V，舵机通常兼容
4. **ARR 更新** - 修改 ARR 后需重新计算 CCR 值以保持相同脉宽

---

## 故障排除

| 现象 | 可能原因 | 解决方案 |
|------|---------|---------|
| 舵机不动 | 脉宽超出范围 | 检查寄存器值 500-2500 |
| 舵机抖动 | 电源不稳定 | 增加滤波电容 |
| LED 不亮 | CCR 值为 0 | 检查亮度设置 |
| 频率不更新 | 未重启定时器 | 确保调用 Stop/Start |

---

## 更新记录

### 2026-04-26
- 初始创建文档
- 记录 10 路 PWM 控制实现
