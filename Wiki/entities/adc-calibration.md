# ADC 校准系统

## 概述

本系统使用线性校准模型修正 ADC 测量误差：
```
V_corrected = gain × V_raw + offset
```

校准参数存储在 STM32F407 的 Flash 中，支持掉电保存。

---

## 硬件配置

| 通道 | 引脚 | 默认用途 |
|------|------|---------|
| CH0 | PA0 | 模拟输入1 |
| CH1 | PA1 | 模拟输入2 |
| CH2 | PA2 | 模拟输入3 |
| CH3 | PA3 | 模拟输入4 |
| CH4 | PC0 | 电压检测 |

---

## 校准数据结构

```c
typedef struct {
    uint32_t magic;           // 校验魔数: 0xCAFEBABA
    float gain[5];            // 增益系数
    float offset[5];          // 偏移系数
    uint16_t crc16;           // CRC16 校验
} calib_data_t;
```

**Flash 地址**: 0x08080000 (最后 4KB 扇区)

---

## 校准公式

| 原始值 (mV) | 校准后 (mV) |
|-------------|-------------|
| `raw` | `gain × raw + offset` |

**默认值**:
- gain = 1.0
- offset = 0.0

---

## Modbus 寄存器

详见 [寄存器映射](modbus-register-map.md#adc-校准-0x0050---0x0065)

| 地址 | 名称 | 说明 |
|------|------|------|
| 0x0050 | REG_CALIB_CH0_GAIN | 通道0 增益 |
| 0x0052 | REG_CALIB_CH0_OFFSET | 通道0 偏移 |
| ... | ... | ... |
| 0x0064 | REG_CALIB_CMD | 校准命令 |

---

## 校准命令

| 命令值 | 操作 | 说明 |
|--------|------|------|
| 0 | 无操作 | 空闲 |
| 1 | 保存 | 将当前 gain/offset 写入 Flash |
| 2 | 加载 | 从 Flash 读取校准参数 |
| 3 | 复位 | 恢复默认参数 (gain=1, offset=0) |

---

## 校准流程

### 1. 手动校准

```
1. 连接已知精确电压源到 ADC 通道
2. 读取 REG_ANALOGx 原始值
3. 计算校准系数:
   gain = V_actual / V_raw
   offset = 0 (理想ADC)
4. 通过 Modbus 写入校准系数
5. 发送 REG_CALIB_CMD = 1 保存到 Flash
```

### 2. 一键校准 (Web Dashboard)

```
1. 在上位机输入参考电压 (如 2500mV)
2. 系统自动:
   - 读取当前原始值
   - 计算 gain = V_ref / V_raw
   - 设置 offset = 0
   - 自动写入寄存器
   - 自动保存 Flash
```

---

## Flash 操作

### 读取流程

```c
void calib_load_from_flash(void) {
    calib_data_t* flash = (calib_data_t*)FLASH_BASE;
    uint16_t crc = crc16_calc(flash, sizeof(calib_data_t) - 2);

    if (flash->magic == CALIB_MAGIC && flash->crc16 == crc) {
        memcpy(&g_calib, flash, sizeof(calib_data_t));
    } else {
        calib_reset_defaults();  // 使用默认值
    }
}
```

### 保存流程

```c
esp_err_t calib_save_to_flash(void) {
    // 1. 解锁 Flash
    // 2. 擦除扇区
    // 3. 计算 CRC16
    // 4. 写入数据
    // 5. 锁定 Flash
    // 6. 验证写入
}
```

---

## 注意事项

1. **Flash 写入寿命**: STM32F4 约 10 万次写入，避免频繁保存
2. **校准时机**: 建议在系统上电后、首次使用前加载校准参数
3. **温度影响**: 校准参数可能随温度漂移，高精度应用需温度补偿

---

## 故障排除

| 现象 | 可能原因 | 解决方案 |
|------|---------|---------|
| 校准后数值不变 | 未发送保存命令 | 写入 REG_CALIB_CMD = 1 |
| Flash 读取失败 | 数据损坏 | 发送 REG_CALIB_CMD = 3 复位 |
| 数值异常大 | gain 值错误 | 检查 gain 是否为正数 |
