# 水下智能转向系统 - 总体架构图

## 系统架构概览

```mermaid
graph TD
    subgraph 上位机系统
        A[Web Dashboard] -->|Web Serial API| B[Modbus RTU 客户端]
        B -->|USB Serial| C[通信层]
        A -->|系统页| D[设备信息/运行状态]
        A -->|传感器页| E[姿态可视化/波形/磁力计]
        A -->|舵机页| F[PWM控制/舵机补偿]
        A -->|外设页| G[GPIO/红外收发]
        A -->|高级页| H[ADC校准/卡尔曼参数/通信日志]
    end

    subgraph 通信链路
        C -->|Modbus RTU 9600 8N1| I[RS485 总线]
        I -->|差分信号| J[STM32F407 USART2]
    end

    subgraph 下位机系统
        J -->|寄存器读写| K[Modbus 从站 159寄存器]
        K -->|姿态数据| L[ATK-MS901M 驱动]
        K -->|PWM输出| M[定时器控制 TIM1/2/3/4/8]
        K -->|ADC采样| N[5通道ADC DMA]
        K -->|红外收发| O[NEC协议 TX/RX]
        K -->|卡尔曼滤波| P[六通道滤波器]
        K -->|舵机补偿| Q[姿态补偿模块]
        K -->|校准参数| R[ADC校准 Flash存储]
        K -->|GPIO控制| S[4路扩展IO]

        L --> T[ATK-MS901M]
        T --> T1[3轴陀螺仪]
        T --> T2[3轴加速度计]
        T --> T3[3轴磁力计]
        T --> T4[气压计]

        M --> U[舵机驱动 x8]
        M --> V[LED控制 x2]

        N --> W[模拟通道 x4]
        N --> X[电源电压检测]

        O --> O1[红外接收 PE4]
        O --> O2[红外发射 PC5]

        Q -->|补偿输出| M
    end

    subgraph 执行机构
        U --> Z[转向舵机]
        V --> AA[状态指示灯]
    end

    style A fill:#60a5fa,stroke:#1d4ed8,stroke-width:2px
    style K fill:#34d399,stroke:#065f46,stroke-width:2px
    style T fill:#fbbf24,stroke:#92400e,stroke-width:2px
    style Q fill:#f87171,stroke:#b91c1c,stroke-width:2px
```

---

## 架构层次

| 层级 | 组件 | 说明 |
|------|------|------|
| **应用层** | Web Dashboard (5页) | 系统/传感器/舵机/外设/高级 |
| **协议层** | Modbus RTU | 工业标准通信协议，159个保持寄存器 |
| **驱动层** | STM32 HAL | 硬件驱动抽象层 |
| **感知层** | ATK-MS901M | 九轴姿态传感器（陀螺仪+加速度+磁力计+气压计） |
| **算法层** | 卡尔曼滤波 | 六通道滤波（Roll/Pitch/Yaw + 3轴Gyro），参数可调 |
| **补偿层** | 舵机姿态补偿 | 8路舵机独立补偿系数（BASE + kRoll/kPitch/kYaw） |
| **执行层** | 舵机/LED | 8路舵机 + 2路LED调光 |

---

## 数据流

```mermaid
flowchart LR
    subgraph 传感器数据流向
        A[传感器采集] --> B[数据预处理]
        B --> C[卡尔曼滤波 x6]
        C --> D[寄存器更新]
        D --> E[Modbus读取]
        E --> F[UI展示]
    end

    subgraph 补偿控制流向
        C -->|Roll/Pitch/Yaw| G[舵机补偿计算]
        G -->|目标角度 = BASE + kR×R + kP×P + kY×Y| H[PWM更新]
    end

    subgraph 参数下发流向
        I[用户操作] --> J[寄存器写入]
        J --> K1[PWM直接控制]
        J --> K2[卡尔曼Q/R参数]
        J --> K3[补偿系数]
        J --> K4[校准增益/偏移]
    end

    style A fill:#fbbf24
    style G fill:#f87171
    style I fill:#60a5fa
```

---

## 通信时序

```mermaid
sequenceDiagram
    participant Dashboard as Web Dashboard
    participant Modbus as Modbus Client
    participant STM32 as STM32F407
    participant Sensor as ATK-MS901M

    Note over Dashboard,Sensor: 轮询周期 (200ms~2s)

    Dashboard->>Modbus: 读姿态+陀螺仪 (FC03 0x0010 x12)
    Modbus->>STM32: 01 03 00 10 00 0C ...
    STM32->>Sensor: 读取陀螺仪+姿态角
    Sensor-->>STM32: Gyro x/y/z + Roll/Pitch/Yaw
    STM32->>STM32: 卡尔曼滤波 (六通道)
    STM32->>STM32: 舵机补偿计算 → 更新PWM
    STM32-->>Modbus: 01 03 18 [12×float]
    Modbus-->>Dashboard: Roll/Pitch/Yaw/Gyro

    Dashboard->>Modbus: 读磁力计 (FC03 0x004E x8)
    STM32->>Sensor: 读取磁力计
    Sensor-->>STM32: Mag x/y/z + 温度
    STM32-->>Modbus: 01 03 10 [4×float]
    Modbus-->>Dashboard: MagX/Y/Z/Temp

    Dashboard->>Modbus: 写卡尔曼参数 (FC10 0x0086)
    Modbus->>STM32: 01 10 00 86 00 18 [12×float]
    STM32->>STM32: 更新Q/R参数
    STM32-->>Modbus: 01 10 00 86 00 18

    Dashboard->>Modbus: 写舵机补偿系数 (FC10 0x0096)
    Modbus->>STM32: 01 10 00 96 00 08 [4×float]
    STM32->>STM32: 更新补偿系数 BASE/kRoll/kPitch/kYaw
    STM32-->>Modbus: 01 10 00 96 00 08
```

---

## 下位机主循环流程

```mermaid
flowchart TD
    Start([系统启动]) --> Init[初始化各模块\nADC / PWM / MS901M\nCalib / GPIO / Modbus\nKalman滤波器 x6]
    Init --> Loop([主循环 while 1])

    Loop --> DT[计算 dt = now - last_tick]
    DT --> ReadGyro[读陀螺仪数据]
    ReadGyro --> KalmanGyro[卡尔曼更新 Gyro x/y/z]
    KalmanGyro --> WriteGyroReg[写 REG_GYRO_X/Y/Z]

    WriteGyroReg --> ReadAtt[读姿态角 Roll/Pitch/Yaw]
    ReadAtt --> YawUnwrap[Yaw 解绕处理 ±180°]
    YawUnwrap --> KalmanAtt[卡尔曼更新 Roll/Pitch/Yaw\n陀螺仪预测 + 姿态观测]
    KalmanAtt --> WriteAttReg[写 REG_ROLL/PITCH/YAW]

    WriteAttReg --> ReadBaro[读气压计数据]
    ReadBaro --> WriteBaroReg[写气压/海拔/温度寄存器]

    WriteBaroReg --> ServoComp{舵机补偿\n已启用?}
    ServoComp -->|是| CompCalc[补偿角度 = BASE\n+ kR×Roll + kP×Pitch\n+ kY×Yaw]
    CompCalc --> UpdatePWM[更新PWM定时器]
    ServoComp -->|否| MbPoll

    UpdatePWM --> MbPoll[modbus_process\neMBPoll + 寄存器同步]
    MbPoll --> Delay[delay_ms 5]
    Delay --> Loop

    style Start fill:#34d399,stroke:#065f46
    style Init fill:#60a5fa,stroke:#1d4ed8
    style KalmanGyro fill:#fbbf24,stroke:#92400e
    style KalmanAtt fill:#fbbf24,stroke:#92400e
    style CompCalc fill:#f87171,stroke:#b91c1c
```

---

## 上位机连接与轮询流程

```mermaid
flowchart TD
    A([启动 Dashboard]) --> B{浏览器支持\nWeb Serial API?}
    B -->|否| Err[显示错误提示]
    B -->|是| C[用户点击连接串口]
    C --> D[navigator.serial.requestPort]
    D --> E[打开串口 9600 8N1]
    E --> F[连接成功\n注册断开事件监听]
    F --> G{开始轮询}

    G --> H[读系统寄存器 0x0000 x6]
    H --> I{有待写操作?}
    I -->|是| WriteQueue[优先处理写队列\nKalman/补偿/校准/PWM]
    WriteQueue --> G
    I -->|否| J[读姿态+陀螺仪 0x0010 x12]
    J --> K[读气压计 0x0048 x6]
    K --> L[读磁力计 0x004E x8]
    L --> M[读ADC 0x0030 x10]
    M --> N[读GPIO 0x006C x12]
    N --> O[读红外 0x0078 x4]
    O --> P[更新UI / 历史波形]
    P --> Q[等待 pollInterval\n200ms / 500ms / 1s / 2s]
    Q --> G

    F --> R{设备断开?}
    R -->|物理断开| Reconnect[自动重连\n最多10次 指数退避]
    Reconnect -->|成功| G
    Reconnect -->|失败| S[显示断开状态]

    style A fill:#34d399,stroke:#065f46
    style WriteQueue fill:#f87171,stroke:#b91c1c
    style Reconnect fill:#fbbf24,stroke:#92400e
```

---

## 硬件连接

| 设备 | 接口 | 引脚 | 说明 |
|------|------|------|------|
| ATK-MS901M | USART3 | PB10/PB11 | 九轴传感器（陀螺+加速度+磁力计+气压计） |
| Modbus通信 | USART2 | PA2/PA3 | RS485 转串口，9600 8N1 |
| 调试串口 | USART1 | PA9/PA10 | 115200 波特率 |
| 红外接收 | EXTI4 | PE4 | NEC协议解码，中断触发 |
| 红外发射 | GPIO | PC5 | NEC协议发送 |
| 舵机1-4 | TIM1 | PA8/PA9/PA10/PA11 | 50Hz PWM |
| 舵机5-8 | TIM8 | PC6/PC7/PC8/PC9 | 50Hz PWM |
| LED1-2 | TIM2 | PA15/PC10 | 调光PWM |
| ADC1-4 | ADC1 | PA0/PA1/PA2/PA3 | 模拟输入，DMA |
| 电压检测 | ADC1 | PC0 | 系统电压监测 |
| GPIO0-3 | GPIO | PB12/PE6/PE5/PC4 | 4路扩展IO |
