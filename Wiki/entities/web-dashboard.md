# Web Dashboard 上位机

> 最后更新：2026-04-25

## 概要

基于 Web Serial API 的 Modbus RTU 上位机，运行在 Chrome/Edge 浏览器中。

## 技术栈

- **框架**：React + Vite
- **样式**：TailwindCSS
- **通信**：Web Serial API（navigator.serial）
- **协议**：Modbus RTU（FC03 读 / FC06 写单个 / FC16 写多个）

## 路径

`e:\毕业设计\Software\modbus-dashboard`

## 页面结构（7 页 Tab）

从 2026-04-25 起重构为多 Tab 导航：

| Tab | 卡片 |
|---|---|
| 首页 home | 系统/姿态/ADC/气压 四件概览 |
| 系统 system | 系统状态详情（大尺寸） |
| 姿态 attitude | 姿态数据 + 零点校准 + 3D 可视化 + 波形 |
| PWM pwm | 舵机控制（滑块+占空比+角度+零点）+ LED 调光 + PWM 频率配置 |
| ADC adc | ADC 原始数据 + 5 通道 gain/offset 校准面板 |
| 气压计 baro | 气压/海拔/温度 |
| 高级 advanced | Modbus 寄存器速查 + 通信日志 |

## 关键功能

| 功能 | 实现 |
|---|---|
| 舵机角度控制 | `dutyToAngle/angleToDuty` 换算，零点保存在 `localStorage.servoZeros`，支持"设 0°"/"复位" |
| 角度输入编辑态 | `focusedServoAngle` 跟踪焦点，编辑期间允许空串；blur/Enter 时提交，空值回滚 |
| ADC 校准 UI | 5 通道 gain/offset 输入 + 应用/一键反算 + 从下位机读取/保存到 Flash/恢复默认 |
| Flash 写入握手 | `flashBusyRef` 暂停所有轮询，下发 CMD=0x5A5A → 静默 1500ms → 轮询 CAL_STATUS ≤5s |
| 自动重连 | 物理断开事件 + 连续 3 次通讯失败双触发；软重连（同 port close+open）→ 硬重连（`getPorts()`）；指数退避 1→2→4→8→16→30s，最多 10 次 |
| 重连进度 UI | 状态栏动态显示"重连中 N/10 (设备断开/通讯错误)" |
| 姿态零位校准 | `attOffset`，对所有姿态数据统一偏移 |
| 姿态波形 | SVG 800×280，80 点缓冲，欧拉角/角速度切换 |
| Mock 模式 | URL 加 `?mock` 注入模拟数据 |

## 通信参数

- 波特率：9600bps
- 数据格式：8N1
- 从站地址：0x01
- 轮询策略：6 组寄存器循环（系统/姿态/PWM/ADC/气压/PWM 频率），帧间延时 15ms

## 主要文件

| 文件 | 说明 |
|---|---|
| `src/App.tsx` | 主 UI，~1300 行，7 页 Tab + 各卡片实现 |
| `src/lib/modbus.ts` | `ModbusClient` 类，Web Serial 收发 + Modbus 帧构造 + 自动重连 + 校准 API |

## 截图（模拟数据）

| 图号 | 文件 |
|---|---|
| 图 3.4 | `diagrams/photos/Dashboard界面截图.png` |
| 图 4.3 | `diagrams/photos/姿态数据显示界面.png` |
| 上位机子页 | `diagrams/photos/上位机-数据监控/通讯日志/高级设置.png` |

## 变更历史

| 日期 | 变更 |
|---|---|
| 2026-04-21 | 新增 `?mock` 模式和 3 张截图 |
| 2026-04-25 | 重构为 7 页 Tab；舵机角度/零点控制；ADC 校准面板；Flash 握手；自动重连；全局字号放大 |
