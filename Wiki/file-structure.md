# 项目文件内容架构

本文档描述水下智能转向系统项目的完整文件结构与内容组织。

---

## 项目根目录结构

```
e:\毕业设计\
├── Wiki/                           # 项目知识库
│   ├── README.md                   # Wiki 索引
│   ├── file-structure.md           # 本文件 - 文件架构
│   ├── health-check-log.md         # 健康检查记录
│   └── entities/                   # 技术实体文档
│       ├── pinout.md               # STM32 引脚分配
│       ├── modbus-register-map.md  # Modbus 寄存器映射
│       ├── adc-calibration.md      # ADC 校准系统
│       ├── web-dashboard.md        # Web 上位机使用指南
│       └── svg-flowchart-skill.md  # SVG 流程图技能
│
├── F407/                           # 下位机 STM32F407 固件代码
│   ├── Core/
│   │   ├── Src/
│   │   │   ├── main.c              # 主程序入口
│   │   │   ├── demo.c              # 主循环逻辑
│   │   │   ├── stm32f4xx_it.c      # 中断处理
│   │   │   └── system_stm32f4xx.c  # 系统初始化
│   │   └── Inc/
│   │       ├── main.h
│   │       └── stm32f4xx_hal_conf.h
│   ├── Drivers/
│   │   ├── STM32F4xx_HAL_Driver/   # HAL 库
│   │   └── CMSIS/                  # ARM CMSIS 库
│   ├── Modbus/
│   │   ├── modbus.c/h              # Modbus RTU 从站协议
│   │   └── freemodbus/             # FreeModbus 库
│   ├── Modules/
│   │   ├── adc.c/h                 # ADC DMA 多通道采集
│   │   ├── pwm.c/h                 # PWM 舵机/LED 控制
│   │   ├── atk_ms901m.c/h          # 姿态传感器驱动
│   │   ├── kalman.c/h              # 卡尔曼滤波算法
│   │   ├── calib.c/h               # ADC 校准与 Flash 存储
│   │   ├── gpio.c/h                # 扩展 GPIO 控制
│   │   └── ir_remote.c/h           # 红外遥控 (NEC 协议)
│   ├── CMakeLists.txt              # CMake 构建配置
│   └── build/                      # 编译输出目录
│
├── Software/
│   └── modbus-dashboard/           # 上位机 Web Dashboard
│       ├── src/
│       │   ├── App.tsx             # 主应用组件
│       │   ├── main.tsx            # 入口文件
│       │   ├── index.css           # 全局样式
│       │   ├── lib/
│       │   │   ├── modbus.ts       # Modbus RTU 协议实现
│       │   │   └── protocol.ts     # 数据解析工具
│       │   └── pages/              # 页面组件
│       │       ├── Home.tsx        # 系统概览
│       │       ├── System.tsx      # 系统信息
│       │       ├── Attitude.tsx    # 姿态显示
│       │       ├── PWM.tsx         # PWM 控制
│       │       ├── ADC.tsx         # ADC 监测与校准
│       │       ├── Barometer.tsx   # 气压计数据
│       │       ├── ExtIO.tsx       # 扩展 IO 与红外
│       │       └── Advanced.tsx    # 寄存器与日志
│       ├── public/
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── tsconfig.json
│
├── Documentation/                  # 论文与文档
│   ├── diagrams/                   # 流程图与架构图
│   │   ├── svg/                    # SVG 源文件
│   │   │   ├── 01-系统总体架构.svg
│   │   │   ├── 03-Modbus通信流程图.svg
│   │   │   ├── 06-上位机架构图.svg
│   │   │   └── ...
│   │   └── png/                    # 转换后的 PNG
│   ├── hardware/                   # 硬件设计文档
│   │   └── V1.0原理图.pdf          # 电路原理图
│   └── thesis/                     # 论文正文
│       └── 论文正文.docx           # 毕业论文文档
│
├── 配置与工具/
│   ├── .vscode/                    # VS Code 工作区配置
│   ├── convert_docx.py             # DOCX 转换脚本
│   └── build.ps1                   # 一键构建脚本
│
└── README.md                       # 项目总览
```

---

## 核心文件说明

### 下位机代码 (F407/)

| 文件 | 功能 | 技术要点 |
|------|------|---------|
| `demo.c` | 主循环 | 初始化 → IMU 读取 → Modbus 处理 |
| `modbus.c/h` | Modbus RTU 从站 | 126 寄存器映射，CRC16 校验 |
| `atk_ms901m.c/h` | 姿态传感器驱动 | UART 协议解析，非阻塞 5ms 超时 |
| `kalman.c/h` | 卡尔曼滤波 | 6 通道浮点运算，Cortex-M4 FPU |
| `adc.c/h` | ADC 采集 | 5 通道 DMA，12 位分辨率 |
| `pwm.c/h` | PWM 输出 | 4 定时器 10 路输出，频率可调 |
| `calib.c/h` | ADC 校准 | Flash 0x08080000，CRC16 校验 |
| `gpio.c/h` | 扩展 GPIO | 4 路可配置输入/输出 |
| `ir_remote.c/h` | 红外遥控 | NEC 协议，PE4/EXTI4 中断解码 |

### 上位机代码 (modbus-dashboard/)

| 文件 | 功能 | 技术要点 |
|------|------|---------|
| `App.tsx` | 主应用 | React Router + 页面导航 |
| `modbus.ts` | Modbus 协议 | Web Serial API 通信，CRC16 计算 |
| `protocol.ts` | 数据解析 | IEEE 754 浮点，大端字序转换 |
| `Home.tsx` | 系统概览 | 设备 ID、姿态、ADC 数据卡片 |
| `Attitude.tsx` | 姿态显示 | 3D CSS 变换 + SVG 波形图 |
| `PWM.tsx` | PWM 控制 | 滑块 + 角度输入 + 频率配置 |
| `ADC.tsx` | ADC 校准 | 参考电压输入 + 一键校准 |
| `ExtIO.tsx` | 扩展功能 | GPIO 控制 + 红外参数配置 |

---

## 数据流向

```
┌─────────────────────────────────────────────────────────┐
│                      上位机 (Web Dashboard)              │
│  React + TypeScript + TailwindCSS                        │
│  Web Serial API → Modbus RTU 帧                          │
└────────────────────────┬────────────────────────────────┘
                         │ USB Serial (9600 8N1)
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    下位机 (STM32F407)                    │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  MS901M IMU  │───▶│  卡尔曼滤波  │                   │
│  │  (USART3)    │    │              │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                              │                          │
│                              ▼                          │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │  Modbus RTU  │◀───│  寄存器映射  │                   │
│  │  (USART2)    │    │  (126个)     │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                              │                          │
│              ┌───────────────┼───────────────┐          │
│              ▼               ▼               ▼          │
│         ┌────────┐     ┌────────┐     ┌────────┐       │
│         │ PWM输出│     │ADC采集 │     │ GPIO   │       │
│         │10路    │     │5通道   │     │4路+红外│       │
│         └────────┘     └────────┘     └────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 文件用途分类

### 硬件相关
- 原理图：`Documentation/hardware/V1.0原理图.pdf`
- 引脚分配：`Wiki/entities/pinout.md`
- 寄存器映射：`Wiki/entities/modbus-register-map.md`

### 软件相关
- 下位机固件：`F407/` 目录
- 上位机界面：`Software/modbus-dashboard/` 目录
- 通信协议：Modbus RTU + Web Serial API

### 文档相关
- 毕业论文：`Documentation/thesis/论文正文.docx`
- 流程图：`Documentation/diagrams/svg/` 目录
- 技术文档：`Wiki/` 目录

---

## 更新记录

### 2026-04-26
- 初始创建文件架构文档
- 整理项目目录结构
- 补充数据流向说明
