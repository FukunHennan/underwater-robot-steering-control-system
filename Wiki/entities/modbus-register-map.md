# Modbus 寄存器映射

> 最后更新：2026-04-20

## 概要

STM32F407VET6 Modbus RTU 从站，地址 0x01，9600 8N1，共 **78 个保持寄存器**（REG_HOLDING_MAX=78），分 6 组。

## 寄存器表

| 地址范围 | 名称 | 数量 | 权限 | 说明 |
|---|---|---|---|---|
| 0x0000-0x0005 | 系统寄存器 | 6 | R/部分RW | DEVICE_ID=0x0407, FW_VERSION=0x0300, RUN_MODE(RW), FAULT_CODE, SYS_TICK |
| 0x0010-0x001B | 姿态寄存器 | 12 | R | Roll/Pitch/Yaw/GyroX/Y/Z（IEEE 754 float，每个 2 寄存器，大端字序） |
| 0x0020-0x0029 | PWM 控制 | 10 | RW | SERVO1-8 占空比(500-2500μs) + LED1-2 占空比(0-1000) |
| 0x0030-0x0039 | ADC 传感器 | 10 | R | 4 路模拟量 + 电压(×100V) + 5 路 ADC 原始值(12-bit) |
| 0x0040-0x0047 | PWM 频率 | 8 | RW | 4 组定时器 ARR+PSC，freq=TIM_CLK/(psc+1)/(arr+1) |
| 0x0048-0x004D | 气压计 | 6 | R | 气压(int32 Pa) + 海拔(int32 cm) + 温度(float ℃) |

## 写权限

仅以下寄存器可写：
- 0x0002 运行模式
- 0x0020~0x0029 PWM 控制
- 0x0040~0x0047 PWM 频率

## 辅助函数

- `modbus_set_register_float()` — 写入 IEEE 754 浮点到 2 个寄存器
- `modbus_set_register_int32()` — 写入 int32 到 2 个寄存器

## 变更历史

| 日期 | 变更 |
|---|---|
| 2026-04-20 | 72→78：新增气压计寄存器组 0x0048-0x004D（6 个），同步更新论文正文和大纲 |
