# Modbus 寄存器映射

**总计**: 159 个保持寄存器 (0x0000 – 0x009E)  
**从机地址**: 0x01 | **波特率**: 9600 | **格式**: 8N1

---

## 系统寄存器 (0x0000–0x0005)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0000 | DEVICE_ID | RO | 设备 ID: 0x0407 |
| 0x0001 | FW_VERSION | RO | 固件版本号 |
| 0x0002 | RUN_MODE | RW | 运行模式 (0=停止, 1=运行, 2=调试) |
| 0x0003 | FAULT_CODE | RO | 故障状态位 |
| 0x0004 | SYS_TICK_L | RO | 系统运行时间 低16位 (ms) |
| 0x0005 | SYS_TICK_H | RO | 系统运行时间 高16位 (ms) |

---

## 姿态数据 (0x0010–0x001B)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0010 | ROLL | RO | 横滚角 (float, °) |
| 0x0012 | PITCH | RO | 俯仰角 (float, °) |
| 0x0014 | YAW | RO | 偏航角 (float, °) |
| 0x0016 | GYRO_X | RO | 陀螺仪 X 轴 (float, °/s) |
| 0x0018 | GYRO_Y | RO | 陀螺仪 Y 轴 (float, °/s) |
| 0x001A | GYRO_Z | RO | 陀螺仪 Z 轴 (float, °/s) |

> 数据格式: IEEE 754 单精度浮点，大端字序 (ABCD)

---

## PWM 控制 (0x0020–0x0029)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0020 | SERVO1 | RW | 舵机1 脉宽 (500–2500 μs) |
| 0x0021 | SERVO2 | RW | 舵机2 脉宽 |
| 0x0022 | SERVO3 | RW | 舵机3 脉宽 |
| 0x0023 | SERVO4 | RW | 舵机4 脉宽 |
| 0x0024 | SERVO5 | RW | 舵机5 脉宽 |
| 0x0025 | SERVO6 | RW | 舵机6 脉宽 |
| 0x0026 | SERVO7 | RW | 舵机7 脉宽 |
| 0x0027 | SERVO8 | RW | 舵机8 脉宽 |
| 0x0028 | LED1 | RW | LED1 亮度 (0–1000) |
| 0x0029 | LED2 | RW | LED2 亮度 (0–1000) |

> 角度换算: `angle = (pulse_width - 1500) / 10` (±50°)

---

## ADC 数据 (0x0030–0x0039)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0030 | TEMP1 | RO | 模拟通道1 校准值 (mV×10) |
| 0x0031 | TEMP2 | RO | 模拟通道2 校准值 |
| 0x0032 | TEMP3 | RO | 模拟通道3 校准值 |
| 0x0033 | TEMP4 | RO | 模拟通道4 校准值 |
| 0x0034 | VOLTAGE | RO | 系统电压 (mV×100) |
| 0x0035 | ADC_RAW0 | RO | ADC 原始值 CH0 |
| 0x0036 | ADC_RAW1 | RO | ADC 原始值 CH1 |
| 0x0037 | ADC_RAW2 | RO | ADC 原始值 CH2 |
| 0x0038 | ADC_RAW3 | RO | ADC 原始值 CH3 |
| 0x0039 | ADC_RAW4 | RO | ADC 原始值 CH4 |

---

## PWM 频率配置 (0x0040–0x0047)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0040 | PWM_ARR_G1 | RW | TIM1/TIM8 ARR 值 |
| 0x0041 | PWM_PSC_G1 | RW | TIM1/TIM8 PSC 值 |
| 0x0042 | PWM_ARR_G2 | RW | TIM2 ARR 值 |
| 0x0043 | PWM_PSC_G2 | RW | TIM2 PSC 值 |
| 0x0044 | PWM_ARR_G3 | RW | TIM3 ARR 值 |
| 0x0045 | PWM_PSC_G3 | RW | TIM3 PSC 值 |
| 0x0046 | PWM_ARR_G4 | RW | TIM4 ARR 值 |
| 0x0047 | PWM_PSC_G4 | RW | TIM4 PSC 值 |

> 频率计算: `f = 84MHz / (PSC+1) / (ARR+1)`，默认 50Hz (ARR=19999, PSC=83)

---

## 气压计数据 (0x0048–0x004D)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0048 | PRESSURE_H | RO | 气压 高16位 (int32, Pa) |
| 0x0049 | PRESSURE_L | RO | 气压 低16位 |
| 0x004A | ALTITUDE_H | RO | 海拔 高16位 (int32, cm) |
| 0x004B | ALTITUDE_L | RO | 海拔 低16位 |
| 0x004C | BARO_TEMP | RO | 温度 高16位 (float, °C) |

---

## 磁力计数据 (0x004E–0x0055)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x004E | MAG_X | RO | 磁场 X 轴 (float, μT) |
| 0x0050 | MAG_Y | RO | 磁场 Y 轴 (float, μT) |
| 0x0052 | MAG_Z | RO | 磁场 Z 轴 (float, μT) |
| 0x0054 | MAG_TEMP | RO | 磁力计温度 (float, °C) |

---

## ADC 校准参数 (0x0056–0x006B)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0056 | CAL_VOLT_GAIN | RW | 电压通道增益 (float) |
| 0x0058 | CAL_VOLT_OFF | RW | 电压通道偏移 (float) |
| 0x005A | CAL_ANALOG1_GAIN | RW | 通道1增益 |
| 0x005C | CAL_ANALOG1_OFF | RW | 通道1偏移 |
| 0x005E | CAL_ANALOG2_GAIN | RW | 通道2增益 |
| 0x0060 | CAL_ANALOG2_OFF | RW | 通道2偏移 |
| 0x0062 | CAL_ANALOG3_GAIN | RW | 通道3增益 |
| 0x0064 | CAL_ANALOG3_OFF | RW | 通道3偏移 |
| 0x0066 | CAL_ANALOG4_GAIN | RW | 通道4增益 |
| 0x0068 | CAL_ANALOG4_OFF | RW | 通道4偏移 |
| 0x006A | CAL_CMD | WO | 校准命令 (0x5A5A=保存, 0xA5A5=复位) |
| 0x006B | CAL_STATUS | RO | 校准状态 |

> 校准公式: `corrected = gain × raw + offset`  
> Flash 存储地址: 0x08080000

---

## GPIO 扩展 (0x006C–0x0077)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x006C | GPIO_MODE0 | RW | GPIO0 模式 (0=输入, 1=输出) |
| 0x006D | GPIO_MODE1 | RW | GPIO1 模式 |
| 0x006E | GPIO_MODE2 | RW | GPIO2 模式 |
| 0x006F | GPIO_MODE3 | RW | GPIO3 模式 |
| 0x0070 | GPIO_OUT0 | RW | GPIO0 输出值 |
| 0x0071 | GPIO_OUT1 | RW | GPIO1 输出值 |
| 0x0072 | GPIO_OUT2 | RW | GPIO2 输出值 |
| 0x0073 | GPIO_OUT3 | RW | GPIO3 输出值 |
| 0x0074 | GPIO_IN0 | RO | GPIO0 输入值 |
| 0x0075 | GPIO_IN1 | RO | GPIO1 输入值 |
| 0x0076 | GPIO_IN2 | RO | GPIO2 输入值 |
| 0x0077 | GPIO_IN3 | RO | GPIO3 输入值 |

| GPIO编号 | 引脚 |
|---------|------|
| GPIO0 | PB12 |
| GPIO1 | PE6 |
| GPIO2 | PE5 |
| GPIO3 | PC4 |

---

## 红外遥控 (0x0078–0x007F)

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0078 | IR_TX_CMD | RW | 红外发送命令 (写入触发，高8位=地址，低8位=命令) |
| 0x0079 | IR_TX_DATA | RW | 红外发送数据 |
| 0x007A | IR_RX_STATUS | RO | 红外接收状态 (0=空闲, 1=收到帧, 2=重复码) |
| 0x007B | IR_RX_DATA | RO | 红外接收数据 ([7:0]=地址, [15:8]=命令) |
| 0x007C | IR_LEAD_LOW_LO | RW | 引导码低时间下限 (μs) 默认 8500 |
| 0x007D | IR_LEAD_LOW_HI | RW | 引导码低时间上限 (μs) 默认 9500 |
| 0x007E | IR_LEAD_HIGH_LO | RW | 引导码高时间下限 (μs) 默认 4000 |
| 0x007F | IR_LEAD_HIGH_HI | RW | 引导码高时间上限 (μs) 默认 5000 |

> IR_RX 引脚: PE4 (EXTI4) | IR_TX 引脚: PC5

---

## 卡尔曼滤波参数 (0x0086–0x009E)

| 地址 | 名称 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| 0x0086 | KALMAN_Q_ROLL | RW | 0.001 | Roll 过程噪声 (float) |
| 0x0088 | KALMAN_R_ROLL | RW | 0.1 | Roll 测量噪声 (float) |
| 0x008A | KALMAN_Q_PITCH | RW | 0.001 | Pitch 过程噪声 |
| 0x008C | KALMAN_R_PITCH | RW | 0.1 | Pitch 测量噪声 |
| 0x008E | KALMAN_Q_YAW | RW | 0.001 | Yaw 过程噪声 |
| 0x0090 | KALMAN_R_YAW | RW | 0.1 | Yaw 测量噪声 |
| 0x0092 | KALMAN_Q_GYRO_X | RW | 0.01 | GyroX 过程噪声 |
| 0x0094 | KALMAN_R_GYRO_X | RW | 0.05 | GyroX 测量噪声 |
| 0x0096 | KALMAN_Q_GYRO_Y | RW | 0.01 | GyroY 过程噪声 |
| 0x0098 | KALMAN_R_GYRO_Y | RW | 0.05 | GyroY 测量噪声 |
| 0x009A | KALMAN_Q_GYRO_Z | RW | 0.01 | GyroZ 过程噪声 |
| 0x009C | KALMAN_R_GYRO_Z | RW | 0.05 | GyroZ 测量噪声 |
| 0x009E | KALMAN_CMD | WO | 0 | 0x5A5A=复位滤波器 |

---

## 舵机姿态补偿系数 (0x00A0–0x00DF)

每舵机 8个寄存器 (4个float)，共8路舵机：

| 偏移 | 名称 | 说明 |
|------|------|------|
| +0x00 | BASE_ANGLE | 基础角度偏移 (deg, float) |
| +0x02 | K_ROLL | Roll 补偿系数 (float) |
| +0x04 | K_PITCH | Pitch 补偿系数 (float) |
| +0x06 | K_YAW | Yaw 补偿系数 (float) |

舵机1基址: 0x00A0，舵机2基址: 0x00A8，…，舵机8基址: 0x00D8

> 补偿公式: `目标角度 = BASE + K_ROLL×Roll + K_PITCH×Pitch + K_YAW×Yaw`

---

## 舵机补偿启用标志 (0x00E0–0x00E7)

| 地址 | 名称 | 说明 |
|------|------|------|
| 0x00E0 | SERVO_COMP_ENABLE_0 | 舵机1补偿启用 (0=关, 1=开) |
| 0x00E1 | SERVO_COMP_ENABLE_1 | 舵机2 |
| ... | ... | 依次类推 |
| 0x00E7 | SERVO_COMP_ENABLE_7 | 舵机8 |

---

## 其他控制寄存器

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x009F | SERVO_SAVE_CMD | WO | 写 0x5A5A → 保存补偿参数到 Flash |
| 0x00E8 | DBG_EN | RW | 调试输出 (0=关, 1=开) |

---

## 支持的功能码

| 功能码 | 名称 | 说明 |
|--------|------|------|
| 0x03 | Read Holding Registers | 读保持寄存器 |
| 0x06 | Write Single Register | 写单个寄存器 |
| 0x10 | Write Multiple Registers | 写多个寄存器 |
