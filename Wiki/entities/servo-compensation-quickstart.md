# 舵机姿态补偿功能 - 快速开始指南

## 🎯 当前状态

✅ **下位机固件**：已完成实现
- 寄存器映射已添加（0x00A0-0x00DF 系数 + 0x00E0-0x00E7 使能）
- 补偿计算逻辑已集成到 `modbus_update_sensors()`
- PWM 自动更新功能正常

✅ **上位机组件**：已创建 UI 组件
- `ServoCompensationCard.tsx` 组件已完成
- 包含完整的参数编辑、预览和预设功能

⚠️ **待完成**：集成到主界面
- 需要在 `App.tsx` 中添加路由和状态管理
- 需要添加 Modbus 写入浮点数的辅助方法

---

## 🔧 临时测试方案

### 方案1：使用 Modbus 调试工具直接测试

你可以使用任何 Modbus 调试工具（如 Modbus Poll、QModMaster）直接读写寄存器来测试功能：

#### 测试步骤：

1. **连接硬件**
   - USB转RS485 连接到 STM32F407
   - 波特率：9600, 8N1, Slave ID: 1

2. **设置舵机1的补偿系数**
   ```
   地址 0x00A0-0x00A1: BASE_ANGLE = 0.0 (float)
   地址 0x00A2-0x00A3: K_ROLL = 1.0 (float)
   地址 0x00A4-0x00A5: K_PITCH = 0.0 (float)
   地址 0x00A6-0x00A7: K_YAW = 0.0 (float)
   ```

3. **启用自动补偿**
   ```
   地址 0x00E0: SERVO1_AUTO_EN = 1
   ```

4. **观察效果**
   - 倾斜开发板，观察 Roll 角变化
   - 舵机1应该跟随 Roll 角同步转动
   - 角度关系：舵机角度 ≈ Roll 角 × 1.0

5. **测试其他配置**
   ```
   仅 Pitch: K_ROLL=0, K_PITCH=1.0, K_YAW=0
   三轴联动: K_ROLL=0.5, K_PITCH=0.5, K_YAW=0.5
   ```

### 方案2：通过串口助手发送 Modbus 命令

如果你熟悉 Modbus RTU 协议，可以直接发送十六进制命令：

#### 示例：设置舵机1的 K_ROLL = 1.0

```
写多个寄存器命令：
01 10 00 A2 00 02 04 3F 80 00 00 00 00 00 00 XX XX
     ↑  ↑  ↑    ↑    ↑  └──────────────┘
     |  |  |    |    |     K_ROLL = 1.0 (IEEE 754 float)
     |  |  |    |    └─ 字节数(4)
     |  |  |    └─ 寄存器数量(2)
     |  |  └─ 起始地址(0x00A2)
     |  └─ 功能码(写多寄存器)
     └─ Slave ID
```

---

## 💻 完整集成步骤（供开发者参考）

如果你想将补偿面板集成到 Web Dashboard 中，需要完成以下步骤：

### 1. 在 `modbus.ts` 中添加寄存器常量

```typescript
// src/lib/modbus.ts
export const REG = {
  // ... existing registers ...
  
  // Servo compensation coefficients (float = 2 regs each)
  SERVO_COMP_BASE: 0x00A0,  // Base address for servo 1
  SERVO_COMP_ENABLE: 0x00E0, // Enable flags base
  
  // Helper to calculate register address for servo N (0-indexed)
  getServoCompBase: (servoIndex: number) => 0x00A0 + servoIndex * 8,
  getServoCompEnable: (servoIndex: number) => 0x00E0 + servoIndex,
} as const
```

### 2. 添加写入浮点数的方法

```typescript
// src/lib/modbus.ts - ModbusClient class
async writeFloatRegister(address: number, value: number): Promise<void> {
  const buffer = new ArrayBuffer(4)
  new DataView(buffer).setFloat32(0, value, false) // Big-endian
  const bytes = new Uint8Array(buffer)
  
  // Float occupies 2 registers (4 bytes)
  const regValue = [
    (bytes[0] << 8) | bytes[1],
    (bytes[2] << 8) | bytes[3],
  ]
  
  await this.writeMultipleRegisters(address, regValue)
}
```

### 3. 在 `App.tsx` 中添加状态和处理函数

参考之前创建的代码片段，添加：
- `servoComp` 状态数组
- `handleServoCompUpdate` 处理函数
- `handleServoCompToggle` 处理函数
- `handleServoCompSave` 处理函数

### 4. 添加标签页和渲染逻辑

在标签导航中添加"补偿"选项，并在主内容区条件渲染 `ServoCompensationCard` 组件。

---

## 📊 验证功能是否正常

### 检查清单：

- [ ] 下位机固件已编译并烧录
- [ ] IMU 传感器工作正常（能在 Dashboard 看到姿态数据）
- [ ] PWM 输出正常（舵机能手动控制）
- [ ] Modbus 通信正常（能读取寄存器）
- [ ] 卡尔曼滤波已启用（姿态数据平滑）

### 快速验证：

1. 打开 Dashboard，确认能看到 Roll/Pitch/Yaw 数据
2. 使用 Modbus 工具写入上述测试参数
3. 倾斜开发板，观察舵机是否跟随运动
4. 如果舵机动了，说明功能正常！

---

## 🐛 常见问题

### Q: 写入系数后舵机不动？

**检查**：
1. AUTO_EN 标志是否设置为 1
2. 至少有一个系数不为 0
3. IMU 数据是否正常（查看姿态页面）
4. PWM 是否在有效范围（500-2500 μs）

### Q: 如何查看当前的补偿系数？

使用 Modbus 读取命令读取对应寄存器，或者在下位机代码中添加串口打印调试信息。

### Q: 补偿效果太剧烈怎么办？

减小系数值，例如从 1.0 降到 0.3，逐步调整找到合适的参数。

---

## 📞 需要帮助？

如果需要我帮你完成完整的集成，请告诉我，我可以：
1. 修改 `modbus.ts` 添加必要的方法
2. 修改 `App.tsx` 集成补偿面板
3. 测试并确保功能正常工作

或者你可以先使用 Modbus 调试工具验证功能，确认下位机逻辑正确后再进行上位机集成。