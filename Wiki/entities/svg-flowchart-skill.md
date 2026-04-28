# SVG 流程图生成技能

> 最后更新：2026-04-20

## 概要

手工 SVG 极简黑白流程图，用于论文配图。11 张图，存放于 `Documentation/diagrams/svg/` 和 `png/`。

## 图清单

| 文件名 | 论文图号 | 内容 |
|---|---|---|
| 01-系统总体架构 | 图 2.1 | 硬件架构：STM32 + IMU + ADC + PWM + 电源 |
| 03-Modbus通信流程图 | 图 3.5 | 上位机↔串口↔从站 时序 |
| 06-上位机架构图 | 图 3.3 | React 三层架构：视图→数据→通信 |
| 08-PWM控制流程图 | 图 3.10 | apply_register 分支逻辑 |
| 14-MS901M通信流程图 | 图 3.9 | 姿态+气压采集流程 |
| 17-系统初始化时序图 | 图 3.8 | HAL→UART→ADC→PWM→IMU→Modbus |
| 18-Web-Serial通信架构图 | 图 3.1 | 浏览器→USB-TTL→STM32 |
| 18b-Web-Serial串口通信流程图 | 图 3.7 | 连接→打开→收发→断开 |
| 21-Web-Serial数据获取代码流程图 | 图 3.2 | 轮询+CRC+解析+UI |
| 22-Modbus客户端通信实现流程图 | 图 3.6 | 入队→构建帧→发送→等待→解析 |
| 23-Modbus从站寄存器回调流程图 | 图 3.12 | FC03/FC06 分支处理 |

## 7 项检查清单

1. 白色背景 `<rect id="bg">`
2. 直线原则（无斜线）
3. 文字不压线（偏移 8-12px）
4. 无截断（viewBox 留余量）
5. 箭头清晰（双向拆多段 line）
6. T 字形分支
7. 注释连线用直角折线

## 转换命令

```bash
npm install sharp --no-save
node -e "sharp(svg,{density:300}).flatten({background:{r:255,g:255,b:255}}).png().toFile(png)"
```
