# ADC 校准模块

> 最后更新：2026-04-25

## 概要

为 STM32F407 的 5 路模拟量采集（VOLTAGE + ANALOG1-4）提供线性校准能力，支持 RAM 即时生效 + Flash 持久化。校准公式 `y = gain * raw + offset`。

## 路径

- 下位机：`e:\毕业设计\Software\F407\Drivers\BSP\Calib\`（新模块）
- 上位机：`Software/modbus-dashboard/src/App.tsx` 校准面板 + `lib/modbus.ts` 校准 API

## 数据结构

```c
typedef struct {
    uint32_t magic;        // 0xC41BA71C
    float    gain[5];      // 通道 0-4 增益，默认 1.0
    float    offset[5];    // 通道 0-4 偏移，默认 0.0
    uint32_t crc;          // 自定义累加校验 (sum << 1 ^ byte)
} calib_data_t;            // 52 字节
```

## Flash 布局

| 参数 | 值 |
|---|---|
| 地址 | `0x08008000` |
| 扇区 | `FLASH_SECTOR_2` |
| 大小 | 16KB |
| 擦除时间 | ~300ms（F407 typical）|

**选 Sector 2 原因**：固件只占 25KB（Sector 0-1），Sector 2 空闲且小（Sector 5-7 均为 128KB 擦除 1-2 秒，会阻塞 Modbus）。

## Modbus 寄存器映射 (0x0050-0x0065)

见 [modbus-register-map.md](./modbus-register-map.md)。

## 握手式 Flash 写入（解决 CRC 失败问题）

### 问题

直接在 Modbus 回调里调 `calib_save_to_flash()` 会阻塞 1-3 秒：
1. Flash 擦除期间 CPU 取指 stall，FreeModbus T3.5 定时器错乱
2. Master 读超时，下次请求时串口缓冲残留旧响应 → CRC 失败

### 解决方案（两阶段）

**阶段 1 — 下位机延迟 + 协议栈重启**（`modbus.c`）：

```c
// 回调只置标志
if (addr == REG_CAL_CMD) {
    g_pending_calib_cmd = cmd;
    g_modbus_registers[REG_CAL_CMD] = 0;  // 立即清零让 ACK 正常发
}

// 主循环 eMBPoll() 返回后处理
static void modbus_process_pending_calib(void) {
    if (cmd == CALIB_CMD_SAVE) {
        eMBDisable();              // 关 Modbus
        HAL_Delay(10);             // 等 T3.5 残帧
        calib_save_to_flash();     // ~300ms
        eMBInit(...); eMBEnable(); // 重建状态机，清 RX 缓冲
    }
}
```

**阶段 2 — 上位机暂停轮询静默等待**（`App.tsx`）：

```tsx
flashBusyRef.current = true     // 停所有轮询
await client.saveCalibToFlash() // 下发 CMD=0x5A5A
await sleep(1500)               // 静默窗口
// 轮询 CAL_STATUS ≤5s
flashBusyRef.current = false    // 恢复轮询
```

## 上电加载流程

```c
void calib_init(void) {
    calib_read_flash(&tmp);
    if (calib_is_valid(&tmp))     // magic + CRC 双验证
        memcpy(&g_calib, &tmp, sizeof(calib_data_t));
    else
        calib_reset_default();    // 全部 gain=1, offset=0
}
```

首次烧录 Flash 未擦除状态（全 0xFF），magic 不匹配 → 自动回退默认值，不会崩溃。

## API 总结

### 下位机

| 函数 | 说明 |
|---|---|
| `calib_init()` | 上电加载，demo.c `main` 调用 |
| `calib_reset_default()` | 设置默认值到 RAM（gain=1, offset=0） |
| `calib_save_to_flash()` | 擦除 Sector 2 + 写入，返回 HAL_StatusTypeDef |
| `calib_apply(ch, raw)` | 对单通道原始值应用校准 |
| `modbus_sync_calib_to_regs()` | 把 RAM 校准值同步到 Modbus 寄存器 |

### 上位机（`lib/modbus.ts`）

| API | 说明 |
|---|---|
| `loadCalibration()` | 读 0x0050-0x0065 所有寄存器 |
| `writeCalibChannel(ch, gain, offset)` | FC16 写单通道 gain/offset |
| `saveCalibToFlash()` | FC06 写 CAL_CMD=0x5A5A |
| `resetCalibToDefault()` | FC06 写 CAL_CMD=0xA5A5 |

## 变更历史

| 日期 | 变更 |
|---|---|
| 2026-04-24 | 初始实现，Sector 7 (128KB)，回调里同步写 Flash |
| 2026-04-25 | 换 Sector 2（16KB 擦除 ~300ms）；推迟到主循环执行；Flash 前后 eMBDisable/eMBInit/eMBEnable 重建协议栈；上位机握手式停轮询 |

## 相关实体

- [modbus-register-map](./modbus-register-map.md) — 寄存器地址分配
- [web-dashboard](./web-dashboard.md) — 上位机校准 UI
