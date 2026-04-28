# 红外遥控协议

NEC 协议红外遥控的接收解码与参数可调实现，支持 PE4 (EXTI4) 中断解码。

---

## 概述

系统支持 NEC 标准红外协议的接收解码，解码参数可通过 Modbus 寄存器 (0x0076-0x007D) 运行时调节，适应不同遥控器和环境。

---

## 硬件连接

### 红外接收

| 功能 | 引脚 | 中断 | 说明 |
|------|------|------|------|
| IR_RX | PE4 | EXTI4 | 红外接收 (38kHz) |

### 红外发射

| 功能 | 引脚 | 说明 |
|------|------|------|
| IR_TX | PC5 | 红外发射（已实现 NEC 脉冲发射）|

### 接收输入要求

- `PE4` 必须启用**内部上拉** (`GPIO_PULLUP`)。多数集成式红外接收头空闲拉高 / 按键拉低，不加上拉会出现 EXTI 边沿丢失。

---

## NEC 协议时序

### 标准时序

```
引导码:     ____                        ________
           |    |                      |        |
      9ms  |4.5ms                     |  4.5ms |
   _______|    |______________________|        |______

数据"0":       ___    ___               ___    ___
              |   |  |   |             |   |  |   |
         560μs|560μs                    |560μs|560μs|
      ________|   |_____________________|   |________

数据"1":       ______    ______        ______    ______
              |      |  |      |      |      |  |      |
         560μs|1680μs                    |1680μs|
      ________|      |__________________|      |________
```

### 数据帧格式

```
引导码 (9ms 低 + 4.5ms 高) + 地址 (8 位) + 地址反码 (8 位) + 命令 (8 位) + 命令反码 (8 位)
```

**总帧长**: 约 67.5ms (32 位数据)

---

## 可调参数寄存器

| 地址 | 名称 | 默认值 | 说明 |
|------|------|--------|------|
| 0x0076 | IR_LEAD_LOW_LO | 8500μs | 引导码低时间下限 |
| 0x0077 | IR_LEAD_LOW_HI | 9500μs | 引导码低时间上限 |
| 0x0078 | IR_LEAD_HIGH_LO | 4000μs | 引导码高时间下限 |
| 0x0079 | IR_LEAD_HIGH_HI | 5000μs | 引导码高时间上限 |
| 0x007A | IR_BIT0_LO | 400μs | 数据"0"时间下限 |
| 0x007B | IR_BIT0_HI | 700μs | 数据"0"时间上限 |
| 0x007C | IR_BIT1_LO | 1500μs | 数据"1"时间下限 |
| 0x007D | IR_BIT1_HI | 1900μs | 数据"1"时间上限 |

---

## Modbus 寄存器映射

### 红外控制

| 地址 | 名称 | 类型 | 说明 |
|------|------|------|------|
| 0x0078 | IR_TX_CMD | RW | 红外发送地址（写入后在 IR_TX_DATA 收到下一次写时发起 NEC 发射）|
| 0x0079 | IR_TX_DATA | RW | 红外发送命令 |
| 0x007A | IR_RX_STATUS | RO | 红外接收状态 |
| 0x007B | IR_RX_DATA | RO | 红外接收数据 |

> **调试複用**：在接收调试阶段，固件将 `IR_TX_CMD` 複用为 EXTI 边沿计数器，`IR_TX_DATA` 存放最近一次脉宽（µs），便于判断中断是否进、NEC 是否能解出。

### 接收状态

| 值 | 名称 | 说明 |
|----|------|------|
| 0 | IDLE | 空闲 |
| 1 | FRAME | 收到完整帧 |
| 2 | REPEAT | 重复码 |
| 3 | EDGE | 检测到 EXTI 边沿但未完成 NEC 解码（调试状态）|

### 数据格式

```
IR_RX_DATA: [7:0] = 地址, [15:8] = 命令
```

---

## 解码流程

### 中断处理

```c
void EXTI4_IRQHandler(void)
{
    if (__HAL_GPIO_EXTI_GET_IT(GPIO_PIN_4) != RESET) {
        uint32_t current_time = DWT_GetTickUs();
        uint32_t pulse_width = current_time - last_edge_time;
        last_edge_time = current_time;
        
        ir_decode_process_pulse(pulse_width);
        __HAL_GPIO_EXTI_CLEAR_IT(GPIO_PIN_4);
    }
}
```

### 脉冲解码

```c
void ir_decode_process_pulse(uint32_t width_us)
{
    switch(ir_state) {
        case IR_STATE_IDLE:
            // 检测引导码
            if (width_us >= ir_param.lead_low_lo && 
                width_us <= ir_param.lead_low_hi) {
                ir_state = IR_STATE_LEAD;
            }
            break;
            
        case IR_STATE_LEAD:
            // 检测引导码高电平
            if (width_us >= ir_param.lead_high_lo && 
                width_us <= ir_param.lead_high_hi) {
                ir_state = IR_STATE_DATA;
                bit_count = 0;
                data = 0;
            }
            break;
            
        case IR_STATE_DATA:
            // 解码数据位
            if (width_us >= ir_param.bit0_lo && 
                width_us <= ir_param.bit0_hi) {
                // 数据 "0"
                data >>= 1;
            } else if (width_us >= ir_param.bit1_lo && 
                       width_us <= ir_param.bit1_hi) {
                // 数据 "1"
                data >>= 1;
                data |= 0x80000000;
            }
            bit_count++;
            
            if (bit_count == 32) {
                // 完整帧
                ir_rx_status = IR_STATUS_FRAME;
                ir_rx_data = extract_command(data);
                ir_state = IR_STATE_IDLE;
            }
            break;
    }
}
```

---

## 上位机配置面板

Web Dashboard 的扩展 IO 页面提供红外参数配置：

| 功能 | 说明 |
|------|------|
| 从下位机读取 | 读取当前参数到页面 |
| 应用参数 | 写入下位机寄存器 |
| 恢复默认 | 恢复 NEC 标准 timing |

---

## 参数调优指南

### 环境干扰处理

| 现象 | 调整建议 |
|------|---------|
| 误触发 | 缩小 timing 范围 (如 8800-9200) |
| 无法解码 | 扩大 timing 范围 (如 8000-10000) |
| 遥控距离短 | 检查引导码参数 |
| 按键连发 | 调整重复码检测时间 |

### 不同遥控器适配

| 遥控器类型 | 调整重点 |
|-----------|---------|
| 标准 NEC | 使用默认参数 |
| 修改版 NEC | 根据实际波形调整 |
| 兼容协议 | 适当放宽 timing 范围 |

---

## 性能指标

| 指标 | 值 | 说明 |
|------|-----|------|
| 解码精度 | ±50μs | DWT 微秒级计时 |
| 中断延迟 | <5μs | EXTI4 优先级 |
| 内存占用 | 64 字节 | 状态机 + 缓冲区 |
| 支持协议 | NEC | 标准 32 位 |

---

## 注意事项

1. **38kHz 载波** - 红外接收模块已解调，输出为基带信号
2. **DWT 计时器** - 依赖 Cortex-M4 的 DWT 周期计数器
3. **参数保存** - 修改后的参数不会自动保存，需写入 Flash (待实现)
4. **重复码** - NEC 长按按键会发送重复码 (110ms 周期)

---

## 故障排除

| 现象 | 可能原因 | 解决方案 |
|------|---------|---------|
| 无响应 | 引脚连接错误 | 检查 PE4 连接 |
| 解码错误 | 参数不匹配 | 调整 timing 范围 |
| 偶尔失效 | 环境光干扰 | 缩小 timing 范围 |
| 数据错误 | 地址/命令反码校验 | 检查校验逻辑 |

---

## 参考资料

- NEC μPD6121G 数据手册
- 红外通信协议标准
- STM32 EXTI 中断配置指南

---

## 更新记录

### 2026-04-26
- 初始创建文档
- 记录 NEC 协议解码实现
- 红外接收从 PC5 迁移到 PE4

### 2026-04-27
- 修正寄存器地址：`IR_TX_CMD/DATA/RX_STATUS/RX_DATA` 从 `0x70..0x73` 调为实际的 `0x78..0x7B`
- `PE4` EXTI 输入加内部上拉 (`GPIO_PULLUP`)，解决部分模块输出驱动弱时边沿丢失问题
- IR_STATUS=3 含义明确为“边沿检测但未解码”，作为调试状态、不作为正常帧状态
- 调试阶段将 `IR_TX_CMD/IR_TX_DATA` 複用为 EXTI 边沿计数 / 最近脉宽镜像
- NEC 判定阈值较原始实现放宽（适配不同模块）
