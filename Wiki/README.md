# 水下智能转向系统 Wiki

## 项目概述

基于 STM32F407 的水下智能转向控制系统，通过 Modbus RTU 协议与上位机通信。

## 文档结构

```
Wiki/
├── README.md                    # 本文件 - 项目索引
├── file-structure.md            # 项目文件内容架构
├── health-check-log.md          # 健康检查记录
└── entities/                     # 实体文档
    ├── pinout.md                # STM32 引脚连接说明
    ├── modbus-register-map.md   # Modbus 寄存器映射 (159个)
    ├── adc-calibration.md       # ADC 校准系统
    ├── kalman-filter.md         # 卡尔曼滤波算法
    ├── pwm-control.md           # PWM 控制逻辑
    ├── ir-remote.md             # 红外遥控协议
    ├── servo-compensation.md    # ✨ 舵机姿态补偿系统
    ├── build-flash.md           # 编译与烧录指南
    ├── web-dashboard.md         # Web 上位机使用指南
    └── svg-flowchart-skill.md   # SVG 流程图技能
```

## 技术栈

### 下位机 (STM32F407)
- **主频**: 168 MHz (Cortex-M4)
- **通信**: Modbus RTU (USART2, 9600 8N1)
- **传感器**: ATK-MS901M 九轴姿态传感器 (USART3)
- **ADC**: 5 通道 DMA 采集
- **PWM**: 10 路 (8 路舵机 + 2 路 LED)
- **红外**: NEC 协议解码 (PE4/EXTI4)

### 上位机
- **框架**: React 18 + Vite + TypeScript
- **样式**: TailwindCSS
- **通信**: Web Serial API (浏览器直接连接)

## 快速链接

| 文档 | 说明 |
|------|------|
| [引脚连接说明](entities/pinout.md) | STM32F407 各功能引脚定义 |
| [寄存器映射](entities/modbus-register-map.md) | 159 个 Modbus 寄存器详解 |
| [ADC 校准系统](entities/adc-calibration.md) | 校准公式、Flash 存储 |
| [卡尔曼滤波](entities/kalman-filter.md) | 六通道滤波算法 |
| [PWM 控制](entities/pwm-control.md) | 10 路舵机/LED 控制 |
| [红外遥控](entities/ir-remote.md) | NEC 协议解码 |
| [✨ 舵机姿态补偿](entities/servo-compensation.md) | 姿态自适应调节系统 |
| [编译烧录](entities/build-flash.md) | Keil MDK 开发流程 |
| [Dashboard 使用指南](entities/web-dashboard.md) | 上位机功能详解 |

## 核心功能

| 功能 | 说明 |
|------|------|
| 姿态感知 | MS901M 九轴 + 卡尔曼滤波 |
| PWM 控制 | 8 路舵机 + 2 路 LED |
| ADC 采集 | 5 通道 + 线性校准 |
| GPIO 扩展 | 4 路可配置输入/输出 |
| 红外遥控 | NEC 协议解码 (可调参数) |
| Modbus RTU | 159 寄存器从站 |
| ✨ 姿态补偿 | 舵机根据姿态自动调节角度 |

## 更新日志

### 2026-04-26
- 红外接收迁移到 **PE4** (原 PC5)
- 添加**红外解码参数可调**功能 (0x0076-0x007D)
- 上位机添加红外参数配置面板
- 更新 Wiki 文档 (引脚、寄存器、上位机)

### 2026-04-14
- 初始版本
- 实现基础 Modbus 通信
- 实现姿态传感器读取
- 实现卡尔曼滤波
