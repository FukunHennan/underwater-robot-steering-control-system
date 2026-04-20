# Web Dashboard 上位机

> 最后更新：2026-04-21

## 概要

基于 Web Serial API 的 Modbus RTU 上位机，运行在 Chrome/Edge 浏览器中。

## 技术栈

- **框架**：React + Vite
- **样式**：TailwindCSS
- **通信**：Web Serial API（navigator.serial）
- **协议**：Modbus RTU（FC03 读 / FC06 写单个 / FC16 写多个）

## 路径

`e:\毕业设计\Software\modbus-dashboard`

## 功能模块

| 模块 | 说明 |
|---|---|
| 姿态面板 | Roll/Pitch/Yaw + GyroX/Y/Z 实时显示 |
| PWM 控制面板 | 8 路舵机 + 2 路 LED 占空比滑块 |
| ADC 数据面板 | 4 路模拟量 + 电压显示 |
| 气压计面板 | 气压(hPa) + 海拔(m) + 温度(℃) |
| 系统信息 / 通信日志 | 设备 ID、固件版本、通信帧日志 |
| 姿态零位校准 | attOffset / applyOffset / handleZeroCalibrate |
| 姿态波形面板 | SVG 实时波形，80 点缓冲，欧拉角/角速度切换 |
| Mock 模式 | URL 加 `?mock` 注入模拟数据，用于截图/演示 |

## 通信参数

- 波特率：9600bps
- 数据格式：8N1
- 从站地址：0x01
- 轮询策略：5 组寄存器循环读取，帧间延时 15ms

## 截图（模拟数据）

| 图号 | 文件 |
|---|---|
| 图 3.4 | `diagrams/png/Dashboard界面截图.png` |
| 图 4.3 | `diagrams/png/姿态数据显示界面.png` |
| 图 4.6 | `diagrams/png/PWM控制操作.png` |
