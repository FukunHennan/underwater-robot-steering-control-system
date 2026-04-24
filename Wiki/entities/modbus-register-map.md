# Modbus 寄存器映射

> 最后更新：2026-04-25

## 概要

STM32F407VET6 Modbus RTU 从站，地址 0x01，9600 8N1，共 **102 个保持寄存器**（REG_HOLDING_MAX=102），分 7 组。

## 寄存器表

| 地址范围 | 名称 | 数量 | 权限 | 说明 |
|---|---|---|---|---|
| 0x0000-0x0005 | 系统寄存器 | 6 | R/部分RW | DEVICE_ID=0x0407, FW_VERSION=0x0300, RUN_MODE(RW), FAULT_CODE, SYS_TICK |
| 0x0010-0x001B | 姿态寄存器 | 12 | R | Roll/Pitch/Yaw/GyroX/Y/Z（IEEE 754 float，每个 2 寄存器，大端字序） |
| 0x0020-0x0029 | PWM 控制 | 10 | RW | SERVO1-8 占空比(500-2500μs) + LED1-2 占空比(0-1000) |
| 0x0030-0x0039 | ADC 传感器 | 10 | R | 4 路模拟量 + 电压(×100V) + 5 路 ADC 原始值(12-bit) |
| 0x0040-0x0047 | PWM 频率 | 8 | RW | 4 组定时器 ARR+PSC，freq=TIM_CLK/(psc+1)/(arr+1) |
| 0x0048-0x004D | 气压计 | 6 | R | 气压(int32 Pa) + 海拔(int32 cm) + 温度(float ℃) |
| 0x0050-0x0065 | ADC 校准 | 22 | RW | 5 通道 gain/offset (float×10) + CMD + STATUS |

## ADC 校准寄存器细节 (0x0050-0x0065)

| 偏移 | 字段 | 类型 | 说明 |
|---|---|---|---|
| 0x0050-0x0053 | CAL_VOLT_GAIN/OFF | 2×float | 通道 0 (VOLTAGE) 增益+偏移 |
| 0x0054-0x0057 | CAL_AN1_GAIN/OFF | 2×float | 通道 1 (ANALOG1) |
| 0x0058-0x005B | CAL_AN2_GAIN/OFF | 2×float | 通道 2 (ANALOG2) |
| 0x005C-0x005F | CAL_AN3_GAIN/OFF | 2×float | 通道 3 (ANALOG3) |
| 0x0060-0x0063 | CAL_AN4_GAIN/OFF | 2×float | 通道 4 (ANALOG4) |
| 0x0064 | CAL_CMD | uint16 | 0x5A5A=保存到 Flash, 0xA5A5=恢复默认 |
| 0x0065 | CAL_STATUS | uint16 | 0=idle, 1=OK, 0xFF=error |

**写命令即触发**：写 gain/offset 立即生效（RAM）；写 CMD=0x5A5A 延迟到 `modbus_process_pending_calib` 执行（避免 Flash 擦写阻塞 Modbus 响应）。

## 写权限

可写寄存器：
- 0x0002 运行模式
- 0x0020~0x0029 PWM 控制
- 0x0040~0x0047 PWM 频率
- 0x0050~0x0064 ADC 校准（含 CMD，不含 STATUS）

## 辅助函数

- `modbus_set_register_float()` — 写入 IEEE 754 浮点到 2 个寄存器
- `modbus_set_register_int32()` — 写入 int32 到 2 个寄存器
- `modbus_get_register_float()` — 从 2 个寄存器重组浮点

## 变更历史

| 日期 | 变更 |
|---|---|
| 2026-04-20 | 72→78：新增气压计寄存器组 0x0048-0x004D（6 个） |
| 2026-04-25 | 78→102：新增 ADC 校准寄存器组 0x0050-0x0065（22 个，5 通道 gain/offset + CMD + STATUS） |
