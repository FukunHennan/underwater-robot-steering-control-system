# 水下智能转向系统

#### 介绍

本项目是一个基于 STM32F407 的水下智能转向系统毕业设计项目，实现了水下机器人的姿态控制、传感器数据采集和执行器驱动功能。

#### 项目结构

```
.
├── Doc/                    # 文档目录
│   ├── 2026届毕业设计开题报告.docx
│   ├── 水下智能转向系统.docx
│   ├── 附件2-2026届毕业生实习报告.docx
│   └── 附件3-2026届毕业生实习周志.docx
├── Hardware/               # 硬件设计
│   ├── V1.0原理图.pdf
│   ├── 硬件系统流程图.md
│   ├── extract_pdf.py
│   └── pdf_images/
├── Software/               # 软件代码
│   └── F407/              # STM32F407 代码
│       ├── User/           # 用户代码
│       ├── Drivers/        # 驱动代码
│       └── ...
├── README.md               # 项目说明
└── DEVLOG.md               # 开发跟踪文档
```

#### 硬件系统

**主控芯片**: STM32F407VET6 (168MHz, 512KB Flash, 192KB SRAM)

**电源系统**:
- LM2596S-ADJ 降压模块（舵机/电调电源）
- AMS1117-3.3 稳压芯片（主控/传感器电源）
- LM321 电压检测电路

**传感器**:
- IMU 惯性测量模块（UART，含卡尔曼滤波）
- 红外对管 ×2（GPIO，障碍物检测）
- 温度传感器 ×4（ADC，NTC）
- 光照传感器 ×1（ADC）
- 电压检测（ADC）

**执行器**:
- 舵机 ×8（PWM，姿态控制）
- 电调 ×8（PWM，电机驱动）
- LED 灯板 ×2（PWM，照明/指示）

**预留接口**:
- 预留串口 ×1（UART）
- Modbus 接口 ×1（工业通信）

详细硬件说明请参考 [Hardware/硬件系统流程图.md](Hardware/硬件系统流程图.md)

#### 软件系统

**开发环境**:
- Keil MDK-ARM 或 EIDE
- STM32 HAL 库

**主要功能**:
- 系统时钟配置（168MHz）
- UART 调试串口（115200 波特率）
- PWM 输出控制（舵机、电调、LED）
- ADC 数据采集（温度、光照、电压）
- IMU 姿态解算（卡尔曼滤波）

#### 安装教程

1.  安装 Keil MDK-ARM 或 EIDE 开发环境
2.  安装 STM32CubeF4 固件库
3.  克隆本项目到本地
4.  打开 `Software/F407/atk_f407.uvprojx` 或使用 EIDE 打开项目

#### 使用说明

1.  连接 STM32F407 开发板
2.  编译项目
3.  烧录程序到开发板
4.  使用串口监视器查看调试信息（115200 波特率）

#### 开发环境配置（ESP-IDF）

本项目同时支持 ESP-IDF 开发（如需要）：

- ESP-IDF 6.0：`D:\esp\v6.0\esp-idf`
- ESP-IDF 5.5：`D:\esp5.5\v5.5\esp-idf`

激活环境：
```powershell
# 激活 ESP-IDF 6.0
& "D:\esp\v6.0\esp-idf\export.ps1"

# 激活 ESP-IDF 5.5
& "D:\esp5.5\v5.5\esp-idf\export.ps1"
```

#### 参与贡献

1.  Fork 本仓库
2.  新建 Feat_xxx 分支
3.  提交代码
4.  新建 Pull Request

#### 开发跟踪

详细的开发日志、错误记录和重要事件请查看 [DEVLOG.md](DEVLOG.md)
