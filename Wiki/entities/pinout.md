# STM32F407 引脚连接说明

**型号**: STM32F407VET6 | **主频**: 168MHz | **Flash**: 512KB | **SRAM**: 192KB

---

## 通信接口

| 接口 | 引脚 TX/RX | 波特率 | 用途 |
|------|-----------|--------|------|
| USART1 | PA9 / PA10 | 115200 | 调试串口 |
| USART2 | PA2 / PA3 | 9600 | Modbus RTU |
| USART3 | PB10 / PB11 | 115200 | ATK-MS901M 姿态传感器 |

---

## PWM 输出

| 通道 | 引脚 | 定时器 | 默认频率 |
|------|------|--------|---------|
| SERVO1 | PA8 | TIM1_CH1 | 50Hz |
| SERVO2 | PA9 | TIM1_CH2 | 50Hz |
| SERVO3 | PA10 | TIM1_CH3 | 50Hz |
| SERVO4 | PA11 | TIM1_CH4 | 50Hz |
| SERVO5 | PC6 | TIM8_CH1 | 50Hz |
| SERVO6 | PC7 | TIM8_CH2 | 50Hz |
| SERVO7 | PC8 | TIM8_CH3 | 50Hz |
| SERVO8 | PC9 | TIM8_CH4 | 50Hz |
| LED1 | PA15 | TIM2_CH1 | 可配置 |
| LED2 | PC10 | TIM2_CH2 | 可配置 |

> PWM 脉宽范围: 500–2500μs (舵机), 0–1000 (LED)

---

## ADC 采集

| 通道 | 引脚 | 说明 |
|------|------|------|
| ADC1_IN0 | PA0 | 模拟输入1 |
| ADC1_IN1 | PA1 | 模拟输入2 |
| ADC1_IN2 | PA2 | 模拟输入3 |
| ADC1_IN3 | PA3 | 模拟输入4 |
| ADC1_IN10 | PC0 | 系统电压检测 |

> 配置: 12位分辨率，DMA 连续转换模式

---

## 扩展 GPIO

| GPIO编号 | 引脚 | 默认模式 |
|---------|------|---------|
| GPIO0 | PB12 | 输入 |
| GPIO1 | PE6 | 输入 |
| GPIO2 | PE5 | 输入 |
| GPIO3 | PC4 | 输入 |

---

## 红外遥控

| 功能 | 引脚 | 中断/接口 | 说明 |
|------|------|----------|------|
| IR_RX | PE4 | EXTI4 | 红外接收 NEC协议 |
| IR_TX | PC5 | GPIO | 红外发射 NEC协议 |

---

## 调试接口

| 功能 | 引脚 |
|------|------|
| SWCLK | PA14 |
| SWDIO | PA13 |

---

## 完整引脚汇总

| 信号 | 类型 | 引脚 |
|------|------|------|
| USART1_TX | 输出 | PA9 |
| USART1_RX | 输入 | PA10 |
| USART2_TX | 输出 | PA2 |
| USART2_RX | 输入 | PA3 |
| USART3_TX | 输出 | PB10 |
| USART3_RX | 输入 | PB11 |
| SERVO1–4 | 输出 | PA8–PA11 |
| SERVO5–8 | 输出 | PC6–PC9 |
| LED1 | 输出 | PA15 |
| LED2 | 输出 | PC10 |
| ADC1–4 | 输入 | PA0–PA3 |
| VOLTAGE | 输入 | PC0 |
| GPIO0–3 | 双向 | PB12, PE6, PE5, PC4 |
| IR_RX | 输入 | PE4 |
| IR_TX | 输出 | PC5 |
| SWCLK | - | PA14 |
| SWDIO | - | PA13 |
