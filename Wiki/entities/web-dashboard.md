# Web Dashboard 使用指南

## 简介

基于 React + TypeScript + TailwindCSS 的 Web 上位机，通过 **Web Serial API** 直接在浏览器中与下位机通信。

**无需安装任何软件**，支持 Chrome、Edge 等现代浏览器。

---

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.x | UI 框架 |
| Vite | 6.x | 构建工具 |
| TailwindCSS | 3.x | 样式框架 |
| TypeScript | 5.x | 类型安全 |

---

## 快速开始

### 1. 安装依赖

```bash
cd Software/modbus-dashboard
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:5173
```

### 3. 连接设备

1. 点击右上角 **连接按钮**
2. 选择对应的串口 (通常是 USB Serial Device)
3. 设置波特率: **9600**
4. 点击连接

### 4. Mock 模式

无需连接硬件即可测试界面：
```
http://localhost:5173?mock
```

---

## 页面功能

### 首页 (home)

系统概览页面，显示：
- 系统状态卡片 (设备ID、版本、运行模式)
- 姿态数据 (Roll/Pitch/Yaw + Gyro)
- 磁力计数据 (Mag X/Y/Z、合成磁场 |B|、罗盘航向)
- ADC 数据 (4路模拟输入)
- 气压计数据 (气压/海拔/温度)

### 系统 (system)

| 功能 | 说明 |
|------|------|
| 设备ID | 显示 0x0407 |
| 固件版本 | 格式: V3.0 |
| 运行模式 | 0=停止, 1=运行, 2=调试 |
| 故障码 | 系统故障状态 |
| 运行时间 | 系统累计运行时间 |

### 姿态 (attitude)

| 功能 | 说明 |
|------|------|
| 数字显示 | 实时 Roll/Pitch/Yaw 数值 (°) |
| 3D 模型 | CSS 3D 变换显示飞机姿态 |
| 波形图 | SVG 实时绘制姿态角变化曲线 |
| 数据来源 | MS901M 九轴传感器 + 卡尔曼滤波 |

**卡尔曼滤波参数调整** (0x007E-0x008A):

> **注意**: 卡尔曼 Q/R 参数**仅在姿态页面中调整**，可在上位机实时修改滤波效果。

| 参数 | 地址范围 | 默认值 | 说明 |
|------|---------|--------|------|
| Q 值 (过程噪声) | 0x007E-0x0088 | 0.001 | 范围 0.0001-0.1，控制响应速度 |
| R 值 (测量噪声) | 0x007F-0x0089 | 0.1 | 范围 0.01-1.0，控制平滑度 |
| 命令 | 0x008A | 0 | 复位参数 |

**调整方式**:
- 通道选择：Roll/Pitch/Yaw/GyroX/GyroY/GyroZ
- Q 值滑块：增大 → 响应变快，平滑度降低
- R 值滑块：增大 → 响应变慢，平滑度提高
- 应用参数：写入下位机寄存器
- 复位按钮：恢复默认参数 (Q=0.001, R=0.1)

**推荐预设**:
| 场景 | Q 值 | R 值 | 效果 |
|------|------|------|------|
| 水下稳定模式 | 0.001 | 0.1 | 平衡响应与平滑 |
| 静态测量模式 | 0.0001 | 0.5 | 极平滑，响应慢 |
| 动态跟踪模式 | 0.01 | 0.05 | 快速响应，略抖动 |

### PWM (pwm)

**舵机控制 (8路)**:
| 功能 | 说明 |
|------|------|
| 滑块控制 | 拖动设置舵机脉宽 (500-2500μs) |
| 角度输入 | 直接输入角度值自动转换 |
| 零点校准 | 设置当前角度为零点偏移 |

**频率配置 (4组)**:
| 组 | 定时器 | 默认频率 |
|----|--------|---------|
| 0 | TIM1/TIM8 | 50Hz |
| 1 | TIM2 | 50Hz |
| 2 | TIM3 | 50Hz |
| 3 | TIM4 | 50Hz |

**LED 调光 (2路)**:
- 占空比范围: 0-1000

### ADC (adc)

| 功能 | 说明 |
|------|------|
| 通道1-4 | 模拟输入 (mV) |
| 电压监测 | 系统电压 (mV) |
| 原始值 | ADC 原始读数 |

**校准面板**:
- 通道选择 (CH0-CH4)
- 参考电压输入
- 增益 (gain) / 偏移 (offset) 编辑
- 一键校准: `gain = V_ref / V_raw`
- 保存到 Flash
- 从 Flash 加载

### 气压计 (barometer)

| 数据 | 单位 | 说明 |
|------|------|------|
| 气压 | Pa | 大气压 |
| 海拔 | m | 计算海拔 |
| 温度 | °C | 芯片温度 |

### GPIO (gpio)

从 2026-04-27 起，原 扩展IO Tab 拆分为独立的 **GPIO** 和 **红外** 两个 Tab。

**GPIO 扩展 (4路)**：

| GPIO | 引脚 | 默认模式 | 寄存器地址 |
|------|------|---------|------|
| GPIO0 | PB12 | 输入 | MODE 0x006C / OUT 0x0070 / IN 0x0074 |
| GPIO1 | PE6  | 输入 | MODE 0x006D / OUT 0x0071 / IN 0x0075 |
| GPIO2 | PE5  | 输入 | MODE 0x006E / OUT 0x0072 / IN 0x0076 |
| GPIO3 | PC4  | 输入 | MODE 0x006F / OUT 0x0073 / IN 0x0077 |

### 红外 (ir)

**红外控制寄存器**：

| 功能 | 地址 | 说明 |
|------|------|------|
| TX CMD | 0x0078 | 发送地址（调试阶段複用为 EXTI 边沿计数器）|
| TX DATA | 0x0079 | 发送命令（调试阶段複用为最近脉宽 µs 镜像）|
| RX STATUS | 0x007A | 接收状态（0=空闲 / 1=收到帧 / 2=重复码 / 3=边沿调试）|
| RX DATA | 0x007B | 接收数据 |

**红外解码参数配置** (0x007C-0x0083)：

| 参数 | 地址 | 默认值 | 说明 |
|------|------|--------|------|
| 引导码低(下限) | 0x007C | 8500μs | |
| 引导码低(上限) | 0x007D | 9500μs | |
| 引导码高(下限) | 0x007E | 4000μs | |
| 引导码高(上限) | 0x007F | 5000μs | |
| 数据"0"(下限) | 0x0080 | 400μs | |
| 数据"0"(上限) | 0x0081 | 700μs | |
| 数据"1"(下限) | 0x0082 | 1500μs | |
| 数据"1"(上限) | 0x0083 | 1900μs | |

**发射面板**：预设遵 NEC 遵设下拉、自定义地址/命令 十进制+十六进制双输入、一键发送、手动刷新 RX 状态、保存当前 RX 帧为 JSON。

**参数面板操作按钮**：从下位机读取 / 应用参数 / 恢复默认。

### 高级 (advanced)

**寄存器速查表**: 显示所有 126 个 Modbus 寄存器

**通信日志**:
- Modbus 请求/响应原始数据
- CRC 校验状态
- 时间戳

---

## 自动重连机制

| 断开原因 | 处理方式 |
|---------|---------|
| 物理断开 (USB 拔除) | 显示断开状态，等待重新连接 |
| 通信超时 | 3次重试后进入断开状态 |
| CRC 错误 | 丢弃错误帧，继续等待下一帧 |

---

## 目录结构

2026-04-27 后重构为模块化结构：

```
modbus-dashboard/
├── src/
│   ├── App.tsx                # 主壳 + 状态中枢（从 2615 行减至 ~2137 行）
│   ├── lib/
│   │   ├── modbus.ts          # Modbus RTU 协议实现
│   │   ├── types.ts           # 共享数据接口 (SystemData / AttitudeData / IRPreset ……)
│   │   ├── utils.ts           # cn / fmtFloat / 舵机转换 / loadAxisMapping
│   │   └── presets.ts         # GPIO_LABELS / IR_PRESETS / IR_STATUS_LABELS / PWM_GROUPS
│   ├── components/
│   │   ├── common/
│   │   │   ├── Card.tsx       # 通用卡片容器
│   │   │   └── Metric.tsx     # 指标读数组件
│   │   ├── panels/
│   │   │   ├── SystemCard.tsx
│   │   │   ├── BarometerCard.tsx
│   │   │   ├── MagnetometerCard.tsx
│   │   │   └── GPIOCard.tsx
│   │   └── ir/
│   │       ├── IRPanel.tsx        # 红外 Tab 容器
│   │       ├── IRTransmitPanel.tsx # 发射 + RX 状态
│   │       └── IRTimingPanel.tsx   # NEC 时序参数
│   ├── hooks/
│   │   └── usePolling.ts      # 周期轮询忪环
│   └── index.css
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

模块化原则：
- 所有状态、handler、轮询仍然集中在 `App.tsx`（避免隐式全局 store 的起不反复）
- panels/* 都是纯展示组件（props in / events out）
- 还未拆分的重量级面板（Attitude / AxisMapping / Kalman / PWM / ADC / Calibration / Advanced）仍以内联方式存在于 App.tsx，后续拆分需附带“useModbusData hook”重构

---

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建生产版本
npm run build
```

---

## 故障排除

| 问题 | 解决方案 |
|------|---------|
| 找不到串口 | 使用 Chrome/Edge，确认 USB 连接 |
| 连接成功但无数据 | 检查波特率是否为 9600 |
| 数据乱码 | 重启下位机或刷新页面 |
| 舵机不响应 | 检查舵机电源是否正常 |
| 红外解码不稳定 | 调整红外参数或扩大 timing 范围 |

---

## 更新记录

### 2026-04-27
- Tab 拆分：原 扩展IO 拆为独立的 **GPIO** 和 **红外** 两个 Tab
- 首页 / 姿态页新增独立 **磁力计卡片**（合成磁场 |B| + 罗盘航向）
- 轮询路径 `pollSequential` 补读磁力计（之前仅在 `pollOnce` 读，导致自动轮询占位 “--”）
- 寄存器地址全面对齐固件：
  - GPIO `0x6C..0x77`
  - IR `0x78..0x7B`
  - IR 时序 `0x7C..0x83`
  - Kalman `0x86..0x9E`（从上位机原老 `0x84..0x9C` 修正为 +2 对齐固件）
- IR 状态 `3` 补 “边沿(调试)” 文本、粗选拉进入添加
- 模块化重构 B1–B4：`App.tsx` 抽出 types/utils/presets/Card/Metric/usePolling 以及 System / Barometer / Magnetometer / GPIO / IR 各类面板，文件从 2615 行减至 ≈2137 行
