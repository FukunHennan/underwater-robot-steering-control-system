# Wiki 知识库

水下智能转向系统 - 项目文档索引

---

## 文档列表

| 文档 | 说明 |
|------|------|
| [系统架构](system-architecture.md) | 总体架构图、数据流、时序图、流程图 |
| [Modbus 寄存器映射](entities/modbus-register-map.md) | 159个寄存器完整说明 |
| [硬件引脚](entities/pinout.md) | STM32F407 引脚分配 |
| [卡尔曼滤波](entities/kalman-filter.md) | 六通道滤波器原理与参数 |
| [舵机姿态补偿](entities/servo-compensation.md) | 补偿算法与系数配置 |

---

## 系统概览

**主控**: STM32F407VET6 (168MHz, Cortex-M4)  
**固件版本**: V3.0  
**通信协议**: Modbus RTU (9600 8N1, 地址 0x01)  
**寄存器数量**: 159个 (0x0000–0x009E+)  
**上位机**: React 18 + Vite + TypeScript (Web Serial API)

---

## 快速导航

- **寄存器速查**: [modbus-register-map.md](entities/modbus-register-map.md)
- **引脚速查**: [pinout.md](entities/pinout.md)
- **流程图**: [system-architecture.md](system-architecture.md)
