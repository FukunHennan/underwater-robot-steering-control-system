# 水下智能转向系统

基于 STM32F407 的水下智能转向控制系统，通过 Modbus RTU 协议与上位机通信。

---

## 项目结构

```
e:\毕业设计\
├── 01-硬件设计/              # 电路原理图
├── 02-下位机固件/            # STM32F407 固件
│   └── F407/
│       ├── User/             # 用户代码 (demo.c, main.c)
│       └── Drivers/BSP/      # 板级驱动
│           ├── ATK_MS901M/   # 九轴姿态传感器驱动
│           ├── Modbus/       # Modbus RTU 从站 (159寄存器)
│           ├── Kalman/       # 六通道卡尔曼滤波器
│           ├── PWM/          # 10路PWM输出
│           ├── ADC/          # 5通道ADC DMA采集
│           ├── Calib/        # ADC校准 (Flash存储)
│           └── GPIO/         # 4路扩展GPIO
├── 03-上位机软件/            # React Web Dashboard
│   └── modbus-dashboard/src/
│       ├── lib/modbus.ts     # 寄存器定义 + Modbus通信
│       ├── pages/            # 5个功能页面
│       ├── stores/           # 状态管理
│       └── components/       # UI组件
├── Wiki/                     # 项目知识库
│   ├── README.md             # Wiki索引
│   ├── system-architecture.md # 架构图与流程图
│   └── entities/             # 详细文档
│       ├── modbus-register-map.md  # 寄存器映射
│       ├── pinout.md               # 硬件引脚
│       ├── kalman-filter.md        # 卡尔曼滤波
│       └── servo-compensation.md   # 舵机姿态补偿
└── README.md                 # 本文件
```

---

## 硬件系统

**主控芯片**: STM32F407VET6 (168MHz, Cortex-M4, 512KB Flash)

**通信接口**:
| 接口 | 用途 | 速率 |
|------|------|------|
| USART1 | 调试串口 | 115200 |
| USART2 | Modbus RTU | 9600 |
| USART3 | MS901M姿态传感器 | 115200 |

**传感器**:
| 传感器 | 型号 | 接口 | 功能 |
|--------|------|------|------|
| 九轴IMU | ATK-MS901M | USART3 | 陀螺仪+加速度+磁力计+气压计 |
| ADC | STM32内置 | DMA | 4路模拟输入+电压检测 |

**执行器**:
| 类型 | 数量 | 接口 | 引脚 |
|------|------|------|------|
| 舵机 | 8路 | PWM 50Hz | PA8–PA11, PC6–PC9 |
| LED | 2路 | PWM调光 | PA15, PC10 |

**扩展接口**:
| 功能 | 引脚 | 说明 |
|------|------|------|
| GPIO0–3 | PB12/PE6/PE5/PC4 | 4路可配置输入/输出 |
| IR_RX | PE4 | 红外接收 NEC协议 (EXTI4) |
| IR_TX | PC5 | 红外发射 NEC协议 |

---

## 软件系统

### 下位机 (STM32F407)

**固件版本**: V3.0
**协议**: Modbus RTU 从站 (地址 0x01)
**寄存器数量**: 159个 (0x0000–0x00E8)

| 功能模块 | 说明 |
|---------|------|
| 姿态采集 | MS901M九轴数据 + 六通道卡尔曼滤波 |
| 磁力计 | 三轴磁场数据（float, μT） |
| 气压计 | 气压/海拔/温度 |
| PWM控制 | 10路输出 (8舵机+2LED)，频率可调 |
| 舵机补偿 | 8路独立姿态补偿 (BASE+kR/kP/kY)，Flash保存 |
| ADC采集 | 5通道DMA + 线性校准，Flash保存 |
| 红外收发 | NEC协议 TX (PC5) + RX (PE4) |
| GPIO扩展 | 4路可配置输入/输出 |

### 上位机 (modbus-dashboard)

**技术栈**: React 18 + Vite + TypeScript + TailwindCSS

**页面**: 系统 / 传感器 / 舵机 / 外设 / 高级 (5页)

**特性**:
- 浏览器直连 (Web Serial API)，无需额外软件
- 3D姿态可视化 + 实时波形
- 磁力计数据显示
- 舵机补偿系数配置
- ADC校准面板 (增益/偏移)
- 卡尔曼 Q/R 参数实时调节
- GPIO 控制 + 红外收发
- 自动重连 (最多10次，指数退避)
- 通信日志

**Mock 模式**: 追加 `?mock` 参数无需硬件即可预览

---

## 快速开始

### 下位机编译

```powershell
# 激活 ESP-IDF 环境 (仅用于参考，实际使用 Keil/EIDE)
# 打开 Software/F407/atk_f407.uvprojx

# 使用 EIDE 插件编译
idf.py build
```

### 上位机运行

```bash
cd Software/modbus-dashboard

# 安装依赖
npm install

# 开发模式
npm run dev
# 访问 http://localhost:5173

# Mock模式 (无需硬件)
http://localhost:5173?mock
```

### 串口连接

1. 使用 USB 转 RS485 模块连接电脑
2. 波特率: 9600, 数据位: 8, 停止位: 1, 无校验
3. 在 Dashboard 中选择对应串口

---

## Modbus 寄存器速查

| 地址范围 | 功能 | 说明 |
|---------|------|------|
| 0x0000–0x0005 | 系统 | 设备ID、版本、模式、故障码、运行时间 |
| 0x0010–0x001B | 姿态 | Roll/Pitch/Yaw + Gyro X/Y/Z (float) |
| 0x0020–0x0029 | PWM | 8路舵机 + 2路LED |
| 0x0030–0x0039 | ADC | 4路模拟校准值 + 电压 + 5路原始值 |
| 0x0040–0x0047 | PWM频率 | 4组定时器 ARR/PSC 配置 |
| 0x0048–0x004D | 气压计 | 气压(Pa)/海拔(cm)/温度(°C) |
| 0x004E–0x0055 | 磁力计 | Mag X/Y/Z + 温度 (float, μT) |
| 0x0056–0x006B | ADC校准 | 5通道增益/偏移 + 命令 |
| 0x006C–0x0077 | GPIO | 4路模式/输出/输入 |
| 0x0078–0x007F | 红外 | TX命令/数据 + RX状态/数据 + 解码参数 |
| 0x0086–0x009E | 卡尔曼 | 6通道 Q/R 参数 + 复位命令 |
| 0x00A0–0x00DF | 舵机补偿 | 8路 BASE/kRoll/kPitch/kYaw |
| 0x00E0–0x00E7 | 补偿启用 | 8路补偿使能标志 |

详见 [Wiki/寄存器映射](Wiki/entities/modbus-register-map.md)

---

## 开发指南

### 添加新模块

1. 在 `Drivers/BSP/` 下创建模块目录
2. 实现 `xxx.c` 和 `xxx.h`
3. 在 `demo.c` 中初始化
4. 如需Modbus寄存器，在 `modbus.c` 中添加

### 调试技巧

1. **串口监视器**: 115200 波特率查看调试信息
2. **Dashboard日志**: 通信页面查看Modbus请求/响应
3. **LED指示**: 系统运行时会闪烁

---

## 文档链接

| 文档 | 说明 |
|------|------|
| [Wiki首页](Wiki/README.md) | 知识库索引 |
| [系统架构图](Wiki/system-architecture.md) | 架构图、数据流、流程图 |
| [寄存器映射](Wiki/entities/modbus-register-map.md) | 159个寄存器完整说明 |
| [硬件引脚](Wiki/entities/pinout.md) | STM32F407 引脚分配 |
| [卡尔曼滤波](Wiki/entities/kalman-filter.md) | 滤波原理与参数调节 |
| [舵机姿态补偿](Wiki/entities/servo-compensation.md) | 补偿算法与使用指南 |

---

## 待实现功能

- [ ] PID 姿态闭环控制算法
- [ ] 深度传感器与深度控制
- [ ] ESP32 Wi-Fi 无线通信
- [ ] 水下摄像头集成
- [ ] 自主导航算法

---

## 开发日志

详细的开发记录、问题解决和版本变更请查看 [DEVLOG.md](DEVLOG.md)
