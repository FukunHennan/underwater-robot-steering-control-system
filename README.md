# 水下智能转向系统

基于 STM32F407 的水下智能转向控制系统，通过 Modbus RTU 协议与上位机通信。

---

## 项目结构

```
e:\毕业设计\
├── 04-技术文档/              # 项目文档与知识库
│   ├── Documentation/        # 论文文档
│   │   ├── 论文正文.md       # 完整论文内容
│   │   ├── 论文大纲.md       # 论文大纲
│   │   └── docx/             # Word文档原始文件
├── Wiki/                     # 项目知识库 (管理体系)
│   ├── README.md             # Wiki索引
│   ├── entities/             # 实体文档
│   │   ├── modbus-register-map.md  # 寄存器映射详解
│   │   ├── adc-calibration.md      # ADC校准系统
│   │   └── web-dashboard.md        # 上位机使用指南
│   └── health-check-log.md   # 健康检查记录
├── .vscode/                  # VS Code 配置
│   ├── settings.json         # VS Code 设置
│   └── extensions.json       # 推荐扩展
├── Hardware/                 # 硬件设计
│   └── V1.0原理图.pdf        # 电路原理图
├── Software/
│   ├── F407/                 # STM32F407 下位机代码
│   │   ├── User/             # 用户代码 (demo.c, main.c)
│   │   └── Drivers/          # 驱动代码
│   │       ├── BSP/          # 板级驱动
│   │       │   ├── Modbus/   # Modbus RTU 从站 (118寄存器)
│   │       │   ├── ADC/      # 5通道ADC采集
│   │       │   ├── PWM/      # 10路PWM输出
│   │       │   ├── GPIO/     # GPIO扩展驱动
│   │       │   ├── Calib/    # ADC校准 (Flash存储)
│   │       │   └── ATK_MS901M/# 九轴姿态传感器
│   │       └── STM32F4xx_HAL_Driver/
│   └── modbus-dashboard/     # React 上位机 (Web Dashboard)
├── README.md                 # 本文件
└── DEVLOG.md                 # 开发日志
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
| 九轴IMU | ATK-MS901M | UART | 姿态角+陀螺仪+气压计 |
| ADC | STM32内置 | GPIO | 4路模拟输入+电压检测 |

**执行器**:
| 类型 | 数量 | 接口 |
|------|------|------|
| 舵机 | 8路 | PWM (500-2500μs) |
| LED | 2路 | PWM调光 |

**扩展接口**:
| 功能 | 引脚 | 说明 |
|------|------|------|
| GPIO0 | PB12 | 通用GPIO |
| GPIO2 | PE6 | 通用GPIO |
| GPIO3 | PE5 | 通用GPIO |
| GPIO4 | PC4 | 通用GPIO |
| IR_RX | PC5 | 红外接收 (NEC协议) |

---

## 软件系统

### 下位机 (STM32F407)

**固件版本**: V3.0
**协议**: Modbus RTU 从站 (地址 0x01)
**寄存器数量**: 118个

| 功能模块 | 说明 |
|---------|------|
| 姿态采集 | MS901M九轴数据 + 卡尔曼滤波 |
| PWM控制 | 10路输出 (舵机/LED) |
| ADC采集 | 5通道DMA + 线性校准 |
| 红外解码 | NEC协议实时解码 |
| GPIO扩展 | 4路可配置输入/输出 |

### 上位机 (modbus-dashboard)

**技术栈**: React 18 + Vite + TypeScript + TailwindCSS

**特性**:
- 🌐 浏览器直连 (Web Serial API)
- 📊 3D姿态可视化
- 📈 实时波形显示
- 🔧 ADC校准面板
- 📝 通信日志

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

## Modbus 寄存器

| 地址 | 功能 | 说明 |
|------|------|------|
| 0x0000-0x0005 | 系统 | 设备ID、版本、模式、故障码 |
| 0x0010-0x001B | 姿态 | Roll/Pitch/Yaw + Gyro |
| 0x0020-0x0029 | PWM | 8路舵机 + 2路LED |
| 0x0030-0x0039 | ADC | 4路模拟 + 电压 |
| 0x0040-0x0047 | 频率 | PWM频率配置 |
| 0x0048-0x004D | 气压计 | 气压/海拔/温度 |
| 0x0050-0x0065 | 校准 | ADC校准参数 |
| 0x0066-0x0071 | GPIO | 扩展IO控制 |
| 0x0072-0x0075 | 红外 | 遥控接收 |

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
| [论文正文](04-技术文档/Documentation/论文正文.md) | 完整毕业设计论文 |
| [Wiki首页](Wiki/README.md) | 知识库索引 |
| [寄存器映射](Wiki/entities/modbus-register-map.md) | Modbus详细说明 |
| [ADC校准](Wiki/entities/adc-calibration.md) | 校准系统详解 |
| [Dashboard指南](Wiki/entities/web-dashboard.md) | 上位机使用说明 |

---

## 待实现功能

- [ ] PID 姿态闭环控制算法
- [ ] 深度传感器与深度控制
- [ ] 红外发送功能
- [ ] ESP32 Wi-Fi 无线通信
- [ ] 水下摄像头集成
- [ ] 自主导航算法

---

## 开发日志

详细的开发记录、问题解决和版本变更请查看 [DEVLOG.md](DEVLOG.md)

健康检查记录请查看 [Wiki/health-check-log.md](Wiki/health-check-log.md)
