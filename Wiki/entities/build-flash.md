# 编译与烧录

STM32F407 项目的一键编译、烧录与调试流程。

---

## 开发环境

| 工具 | 版本 | 说明 |
|------|------|------|
| Keil MDK | 5.x | IDE 和编译器 |
| STM32CubeMX | 6.x | 引脚配置和代码生成 |
| ST-Link | V2 | 烧录调试器 |
| STM32 ST-Link Utility | 4.x | 烧录工具 |

---

## 编译流程

### 方式一：Keil MDK IDE

1. 打开工程文件 `F407/Project.uvprojx`
2. 选择编译目标：`Debug` 或 `Release`
3. 点击 Build 按钮 (F7)
4. 检查编译输出窗口，确认 `0 Error(s), 0 Warning(s)`

### 方式二：命令行编译

```bash
# 使用 uvision 命令行
"C:\Keil_v5\UV4\UV4.exe" -b F407\Project.uvprojx -o build_output.txt

# 查看编译结果
type build_output.txt
```

### 编译选项

| 选项 | 值 | 说明 |
|------|-----|------|
| Device | STM32F407VETx | 芯片型号 |
| Clock | 168 MHz | HSE 8MHz + PLL |
| Optimization | Level 2 | Release 模式 |
| Debug | ST-Link | 调试器类型 |

---

## 烧录流程

### 方式一：ST-Link Utility

1. 连接 ST-Link 和开发板
2. 打开 STM32 ST-Link Utility
3. 点击 **Connect** 连接设备
4. 点击 **Program** 加载 `.hex` 文件
5. 勾选 **Verify after programming**
6. 点击 **Start** 开始烧录

### 方式二：Keil MDK 直接烧录

1. 在 Keil 中点击 **Download** 按钮 (F8)
2. 等待烧录完成
3. 检查 Output 窗口确认烧录成功

### 方式三：命令行烧录

```bash
# 使用 ST-Link 命令行工具
STM32_Programmer_CLI.exe -c port=SWD -w firmware.hex -v -rst
```

---

## 调试流程

### SWD 调试接口

| 功能 | 引脚 | 说明 |
|------|------|------|
| SWCLK | PA14 | 调试时钟 |
| SWDIO | PA13 | 调试数据 |
| SWO | PB3 | 串行输出 (可选) |
| GND | GND | 地线 |

### 断点调试

1. 在 Keil 中点击 **Start/Stop Debug Session** (Ctrl+F5)
2. 设置断点 (F9)
3. 全速运行 (F5)
4. 单步执行 (F10/F11)
5. 查看变量和寄存器值

### 串口调试

| 串口 | 引脚 | 波特率 | 用途 |
|------|------|--------|------|
| USART1 | PA9/PA10 | 115200 | 调试输出 |
| USART2 | PA2/PA3 | 9600 | Modbus 通信 |
| USART3 | PB10/PB11 | 115200 | MS901M 传感器 |

---

## 常见问题

### 编译错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `Error: L6218E` | 未定义符号 | 检查函数声明和源文件添加 |
| `Error: L6406E` | 内存不足 | 优化代码或调整堆栈大小 |
| `Warning: L6304W` | 重复定义 | 删除重复的源文件 |
| `Fatal Error: C3900U` | 许可证问题 | 检查 Keil 激活状态 |

### 烧录失败

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| 无法连接 | ST-Link 未识别 | 检查驱动和 USB 连接 |
| 烧录超时 | 芯片被读保护 | 执行 Mass Erase 解锁 |
| 验证失败 | Flash 损坏 | 检查芯片和焊接 |
| 复位失败 | 复位电路问题 | 检查 NRST 引脚 |

### 调试问题

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| 断点无效 | 优化级别过高 | 降低优化或使用 Debug 模式 |
| 变量不显示 | 编译器优化 | 添加 `volatile` 或降低优化 |
| 无法单步 | 代码被优化掉 | 使用汇编级调试 |

---

## Flash 存储器配置

### 地址空间

| 区域 | 地址范围 | 大小 | 用途 |
|------|---------|------|------|
| 代码区 | 0x08000000 - 0x0807FFFF | 512KB | 主程序 |
| 校准区 | 0x08080000 - 0x08080FFF | 4KB | ADC 校准参数 |
| 保留区 | 0x08081000 - 0x080FFFFF | 508KB | 未使用 |

### Flash 扇区划分

| 扇区 | 地址范围 | 大小 |
|------|---------|------|
| Sector 0 | 0x08000000 | 16KB |
| Sector 1 | 0x08004000 | 16KB |
| Sector 2 | 0x08008000 | 16KB |
| Sector 3 | 0x0800C000 | 16KB |
| Sector 4 | 0x08010000 | 64KB |
| Sector 5 | 0x08020000 | 128KB |
| Sector 6 | 0x08040000 | 128KB |
| Sector 7 | 0x08060000 | 128KB |
| Sector 8 | 0x08080000 | 16KB |

---

## 一键烧录脚本

### PowerShell 脚本

```powershell
# build_and_flash.ps1
$KEIL_PATH = "C:\Keil_v5\UV4\UV4.exe"
$PROJECT = "F407\Project.uvprojx"

# 编译
& $KEIL_PATH -b $PROJECT -o build_log.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "编译失败！" -ForegroundColor Red
    exit 1
}

# 烧录
& "STM32_Programmer_CLI.exe" -c port=SWD -w firmware.hex -v -rst
if ($LASTEXITCODE -eq 0) {
    Write-Host "烧录成功！" -ForegroundColor Green
}
```

---

## 更新记录

### 2026-04-26
- 初始创建文档
- 记录 Keil MDK 编译流程
- 记录 ST-Link 烧录方法
