# Word插入版：Flash地址与Modbus寄存器大表

## 表1 Flash地址与存储用途总表

| 序号 | 区域/模块 | 宏定义 | 起始地址 | 结束地址 | Sector | 大小 | 当前用途 | 数据内容 | 状态/说明 |
|---:|---|---|---:|---:|---|---:|---|---|---|
| 1 | Flash Bank 起始 | - | `0x08000000` | - | - | 512KB总容量 | STM32F407VET6内部Flash起始地址 | 固件代码与参数存储 | MCU Flash基地址 |
| 2 | Sector 0 | - | `0x08000000` | `0x08003FFF` | Sector 0 | 16KB | 固件代码区 | 程序代码 | 当前未作为参数区 |
| 3 | Sector 1 | - | `0x08004000` | `0x08007FFF` | Sector 1 | 16KB | 固件代码区 | 程序代码 | 当前未作为参数区 |
| 4 | 当前统一配置区 | `DEVICE_CONFIG_FLASH_ADDR` | `0x08008000` | `0x0800BFFF` | Sector 2 | 16KB | 当前主要参数持久化区域 | ADC校准、Kalman参数、舵机补偿参数、CRC | 当前实际保存区 |
| 5 | 当前统一配置扇区 | `DEVICE_CONFIG_FLASH_SECTOR` | `0x08008000` | `0x0800BFFF` | `FLASH_SECTOR_2` | 16KB | Flash擦写目标扇区 | `device_config_t`结构体 | 保存时会擦除整个Sector 2 |
| 6 | 当前统一配置Magic | `DEVICE_CONFIG_MAGIC` | `0x08008000`内部 | - | Sector 2 | 4B | 判断是否为统一配置格式 | 固定值`0xCF9A12E7` | 读取时用于格式识别 |
| 7 | ADC校准增益 | `calib_gain[]` | `0x08008000`之后 | - | Sector 2 | 5个float | 保存ADC校准增益 | 电压与4路模拟量增益 | 属于`device_config_t` |
| 8 | ADC校准偏移 | `calib_off[]` | `0x08008000`之后 | - | Sector 2 | 5个float | 保存ADC校准偏移 | 电压与4路模拟量偏移 | 属于`device_config_t` |
| 9 | Kalman Q参数 | `kalman_q[]` | `0x08008000`之后 | - | Sector 2 | 6个float | 保存Kalman过程噪声 | Roll、Pitch、Yaw、Gyro X/Y/Z Q | 属于`device_config_t` |
| 10 | Kalman R参数 | `kalman_r[]` | `0x08008000`之后 | - | Sector 2 | 6个float | 保存Kalman观测噪声 | Roll、Pitch、Yaw、Gyro X/Y/Z R | 属于`device_config_t` |
| 11 | 舵机基础角度 | `servo_base[]` | `0x08008000`之后 | - | Sector 2 | 8个float | 保存8路舵机基础角度 | Servo1~Servo8 base angle | 属于`device_config_t` |
| 12 | 舵机Roll补偿 | `servo_roll[]` | `0x08008000`之后 | - | Sector 2 | 8个float | 保存Roll补偿系数 | Servo1~Servo8 K Roll | 属于`device_config_t` |
| 13 | 舵机Pitch补偿 | `servo_pitch[]` | `0x08008000`之后 | - | Sector 2 | 8个float | 保存Pitch补偿系数 | Servo1~Servo8 K Pitch | 属于`device_config_t` |
| 14 | 舵机Yaw补偿 | `servo_yaw[]` | `0x08008000`之后 | - | Sector 2 | 8个float | 保存Yaw补偿系数 | Servo1~Servo8 K Yaw | 属于`device_config_t` |
| 15 | 舵机补偿使能 | `servo_en[]` | `0x08008000`之后 | - | Sector 2 | 8个uint8_t | 保存8路舵机自动补偿开关 | 0=关闭，1=开启 | 属于`device_config_t` |
| 16 | 配置CRC | `crc` | `0x08008000`之后 | - | Sector 2 | 4B | 校验统一配置完整性 | CRC校验值 | Magic和CRC都正确才加载 |
| 17 | 旧ADC校准地址 | `CALIB_FLASH_ADDR` | `0x08008000` | `0x0800BFFF` | Sector 2 | 16KB | 旧版ADC校准保存地址 | ADC校准旧格式 | 已被统一配置格式替代 |
| 18 | 旧舵机补偿地址 | `SERVO_COMP_FLASH_ADDR` | `0x0800C000` | `0x0800FFFF` | Sector 3 | 16KB | 旧版舵机补偿保存地址 | 舵机补偿旧格式 | 当前仅兼容读取 |
| 19 | 旧Kalman地址 | `KALMAN_PERSIST_FLASH_ADDR` | `0x08010000` | `0x0801FFFF` | Sector 4 | 64KB | 旧版Kalman参数保存地址 | Kalman Q/R旧格式 | 当前仅兼容读取 |
| 20 | Sector 5 | - | `0x08020000` | `0x0803FFFF` | Sector 5 | 128KB | 未使用 | - | 可预留扩展 |
| 21 | Sector 6 | - | `0x08040000` | `0x0805FFFF` | Sector 6 | 128KB | 未使用 | - | 可预留扩展 |
| 22 | Sector 7 | - | `0x08060000` | `0x0807FFFF` | Sector 7 | 128KB | 未使用 | - | 可预留扩展 |

## 表2 Modbus Holding Register寄存器总表

| 序号 | 地址Hex | 地址Dec | 寄存器名称 | 属性 | 数据类型/单位 | 所属模块 | 功能说明 |
|---:|---:|---:|---|---|---|---|---|
| 1 | `0x0000` | 0 | `REG_DEVICE_ID` | R | uint16 | 系统信息 | 设备ID，固定为`0x0407` |
| 2 | `0x0001` | 1 | `REG_FW_VERSION` | R | uint16 | 系统信息 | 固件版本，固定为`0x0300` |
| 3 | `0x0002` | 2 | `REG_RUN_MODE` | R/W | uint16 | 系统信息 | 运行模式 |
| 4 | `0x0003` | 3 | `REG_FAULT_CODE` | R | uint16 | 系统信息 | 故障码 |
| 5 | `0x0004` | 4 | `REG_SYS_TICK_L` | R | uint16 | 系统信息 | 系统Tick低16位 |
| 6 | `0x0005` | 5 | `REG_SYS_TICK_H` | R | uint16 | 系统信息 | 系统Tick高16位 |
| 7 | `0x0010~0x0011` | 16~17 | `REG_ROLL` | R | float/deg | 姿态 | 横滚角Roll |
| 8 | `0x0012~0x0013` | 18~19 | `REG_PITCH` | R | float/deg | 姿态 | 俯仰角Pitch |
| 9 | `0x0014~0x0015` | 20~21 | `REG_YAW` | R | float/deg | 姿态 | 偏航角Yaw |
| 10 | `0x0016~0x0017` | 22~23 | `REG_GYRO_X` | R | float | 陀螺仪 | X轴角速度 |
| 11 | `0x0018~0x0019` | 24~25 | `REG_GYRO_Y` | R | float | 陀螺仪 | Y轴角速度 |
| 12 | `0x001A~0x001B` | 26~27 | `REG_GYRO_Z` | R | float | 陀螺仪 | Z轴角速度 |
| 13 | `0x0020` | 32 | `REG_SERVO1` | R/W | uint16/us | PWM输出 | 舵机1 PWM脉宽 |
| 14 | `0x0021` | 33 | `REG_SERVO2` | R/W | uint16/us | PWM输出 | 舵机2 PWM脉宽 |
| 15 | `0x0022` | 34 | `REG_SERVO3` | R/W | uint16/us | PWM输出 | 舵机3 PWM脉宽 |
| 16 | `0x0023` | 35 | `REG_SERVO4` | R/W | uint16/us | PWM输出 | 舵机4 PWM脉宽 |
| 17 | `0x0024` | 36 | `REG_SERVO5` | R/W | uint16/us | PWM输出 | 舵机5 PWM脉宽 |
| 18 | `0x0025` | 37 | `REG_SERVO6` | R/W | uint16/us | PWM输出 | 舵机6 PWM脉宽 |
| 19 | `0x0026` | 38 | `REG_SERVO7` | R/W | uint16/us | PWM输出 | 舵机7 PWM脉宽 |
| 20 | `0x0027` | 39 | `REG_SERVO8` | R/W | uint16/us | PWM输出 | 舵机8 PWM脉宽 |
| 21 | `0x0028` | 40 | `REG_LED1` | R/W | uint16/% | PWM输出 | LED1亮度/PWM |
| 22 | `0x0029` | 41 | `REG_LED2` | R/W | uint16/% | PWM输出 | LED2亮度/PWM |
| 23 | `0x0030` | 48 | `REG_ANALOG1`/`TEMP1` | R | uint16 | ADC | 模拟通道1 |
| 24 | `0x0031` | 49 | `REG_ANALOG2`/`TEMP2` | R | uint16 | ADC | 模拟通道2 |
| 25 | `0x0032` | 50 | `REG_ANALOG3`/`TEMP3` | R | uint16 | ADC | 模拟通道3 |
| 26 | `0x0033` | 51 | `REG_ANALOG4`/`TEMP4` | R | uint16 | ADC | 模拟通道4 |
| 27 | `0x0034` | 52 | `REG_VOLTAGE` | R | uint16 | ADC | 电压值 |
| 28 | `0x0035` | 53 | `REG_ADC_RAW0` | R | uint16 | ADC | ADC原始值0 |
| 29 | `0x0036` | 54 | `REG_ADC_RAW1` | R | uint16 | ADC | ADC原始值1 |
| 30 | `0x0037` | 55 | `REG_ADC_RAW2` | R | uint16 | ADC | ADC原始值2 |
| 31 | `0x0038` | 56 | `REG_ADC_RAW3` | R | uint16 | ADC | ADC原始值3 |
| 32 | `0x0039` | 57 | `REG_ADC_RAW4` | R | uint16 | ADC | ADC原始值4 |
| 33 | `0x0040` | 64 | `REG_PWM_ARR_G1` | R/W | uint16 | PWM频率 | PWM组1 ARR |
| 34 | `0x0041` | 65 | `REG_PWM_PSC_G1` | R/W | uint16 | PWM频率 | PWM组1 PSC |
| 35 | `0x0042` | 66 | `REG_PWM_ARR_G2` | R/W | uint16 | PWM频率 | PWM组2 ARR |
| 36 | `0x0043` | 67 | `REG_PWM_PSC_G2` | R/W | uint16 | PWM频率 | PWM组2 PSC |
| 37 | `0x0044` | 68 | `REG_PWM_ARR_G3` | R/W | uint16 | PWM频率 | PWM组3 ARR |
| 38 | `0x0045` | 69 | `REG_PWM_PSC_G3` | R/W | uint16 | PWM频率 | PWM组3 PSC |
| 39 | `0x0046` | 70 | `REG_PWM_ARR_G4` | R/W | uint16 | PWM频率 | PWM组4 ARR |
| 40 | `0x0047` | 71 | `REG_PWM_PSC_G4` | R/W | uint16 | PWM频率 | PWM组4 PSC |
| 41 | `0x0048~0x0049` | 72~73 | `REG_PRESSURE_H/L` | R | int32 | 气压计 | 气压值，高低字 |
| 42 | `0x004A~0x004B` | 74~75 | `REG_ALTITUDE_H/L` | R | int32 | 气压计 | 高度值，高低字 |
| 43 | `0x004C~0x004D` | 76~77 | `REG_BARO_TEMP` | R | float | 气压计 | 气压计温度 |
| 44 | `0x004E~0x004F` | 78~79 | `REG_MAG_X` | R | float | 磁力计 | X轴磁场 |
| 45 | `0x0050~0x0051` | 80~81 | `REG_MAG_Y` | R | float | 磁力计 | Y轴磁场 |
| 46 | `0x0052~0x0053` | 82~83 | `REG_MAG_Z` | R | float | 磁力计 | Z轴磁场 |
| 47 | `0x0054~0x0055` | 84~85 | `REG_MAG_TEMP` | R | float | 磁力计 | 磁力计温度 |
| 48 | `0x0056~0x0057` | 86~87 | `REG_CAL_VOLT_GAIN` | R/W | float | ADC校准 | 电压校准增益 |
| 49 | `0x0058~0x0059` | 88~89 | `REG_CAL_VOLT_OFF` | R/W | float | ADC校准 | 电压校准偏移 |
| 50 | `0x005A~0x005B` | 90~91 | `REG_CAL_AN1_GAIN` | R/W | float | ADC校准 | 模拟通道1校准增益 |
| 51 | `0x005C~0x005D` | 92~93 | `REG_CAL_AN1_OFF` | R/W | float | ADC校准 | 模拟通道1校准偏移 |
| 52 | `0x005E~0x005F` | 94~95 | `REG_CAL_AN2_GAIN` | R/W | float | ADC校准 | 模拟通道2校准增益 |
| 53 | `0x0060~0x0061` | 96~97 | `REG_CAL_AN2_OFF` | R/W | float | ADC校准 | 模拟通道2校准偏移 |
| 54 | `0x0062~0x0063` | 98~99 | `REG_CAL_AN3_GAIN` | R/W | float | ADC校准 | 模拟通道3校准增益 |
| 55 | `0x0064~0x0065` | 100~101 | `REG_CAL_AN3_OFF` | R/W | float | ADC校准 | 模拟通道3校准偏移 |
| 56 | `0x0066~0x0067` | 102~103 | `REG_CAL_AN4_GAIN` | R/W | float | ADC校准 | 模拟通道4校准增益 |
| 57 | `0x0068~0x0069` | 104~105 | `REG_CAL_AN4_OFF` | R/W | float | ADC校准 | 模拟通道4校准偏移 |
| 58 | `0x006A` | 106 | `REG_CAL_CMD` | R/W | uint16 | ADC校准 | 写`0x5A5A`保存，写`0xA5A5`重置 |
| 59 | `0x006B` | 107 | `REG_CAL_STATUS` | R | uint16 | ADC校准 | `0=idle`，`1=OK`，`0xFF=error` |
| 60 | `0x006C~0x006F` | 108~111 | `REG_GPIO_MODE0~3` | R/W | uint16 | GPIO | GPIO模式，0=输入，1=输出 |
| 61 | `0x0070~0x0073` | 112~115 | `REG_GPIO_OUT0~3` | R/W | uint16 | GPIO | GPIO输出状态 |
| 62 | `0x0074~0x0077` | 116~119 | `REG_GPIO_IN0~3` | R | uint16 | GPIO | GPIO输入状态 |
| 63 | `0x0078` | 120 | `REG_IR_TX_CMD` | R/W | uint16 | 红外 | 写入地址触发NEC发送；调试时显示边沿计数 |
| 64 | `0x0079` | 121 | `REG_IR_TX_DATA` | R/W | uint16 | 红外 | 写入命令数据；调试时显示最近脉宽us |
| 65 | `0x007A` | 122 | `REG_IR_RX_STATUS` | R | uint16 | 红外 | 接收状态：0空闲，1收到帧，2重复码，3边沿调试 |
| 66 | `0x007B` | 123 | `REG_IR_RX_DATA` | R | uint16 | 红外 | 接收数据，高8位地址，低8位命令 |
| 67 | `0x007C` | 124 | `REG_IR_LEAD_LOW_LO` | R/W | uint16/us | 红外参数 | NEC引导低电平最小时间 |
| 68 | `0x007D` | 125 | `REG_IR_LEAD_LOW_HI` | R/W | uint16/us | 红外参数 | NEC引导低电平最大时间 |
| 69 | `0x007E` | 126 | `REG_IR_LEAD_HIGH_LO` | R/W | uint16/us | 红外参数 | NEC引导高电平最小时间 |
| 70 | `0x007F` | 127 | `REG_IR_LEAD_HIGH_HI` | R/W | uint16/us | 红外参数 | NEC引导高电平最大时间 |
| 71 | `0x0080` | 128 | `REG_IR_BIT0_LO` | R/W | uint16/us | 红外参数 | NEC数据0脉宽最小值 |
| 72 | `0x0081` | 129 | `REG_IR_BIT0_HI` | R/W | uint16/us | 红外参数 | NEC数据0脉宽最大值 |
| 73 | `0x0082` | 130 | `REG_IR_BIT1_LO` | R/W | uint16/us | 红外参数 | NEC数据1脉宽最小值 |
| 74 | `0x0083` | 131 | `REG_IR_BIT1_HI` | R/W | uint16/us | 红外参数 | NEC数据1脉宽最大值 |
| 75 | `0x0086~0x0087` | 134~135 | `REG_KALMAN_Q_ROLL` | R/W | float | Kalman | Roll通道Q参数 |
| 76 | `0x0088~0x0089` | 136~137 | `REG_KALMAN_R_ROLL` | R/W | float | Kalman | Roll通道R参数 |
| 77 | `0x008A~0x008B` | 138~139 | `REG_KALMAN_Q_PITCH` | R/W | float | Kalman | Pitch通道Q参数 |
| 78 | `0x008C~0x008D` | 140~141 | `REG_KALMAN_R_PITCH` | R/W | float | Kalman | Pitch通道R参数 |
| 79 | `0x008E~0x008F` | 142~143 | `REG_KALMAN_Q_YAW` | R/W | float | Kalman | Yaw通道Q参数 |
| 80 | `0x0090~0x0091` | 144~145 | `REG_KALMAN_R_YAW` | R/W | float | Kalman | Yaw通道R参数 |
| 81 | `0x0092~0x0093` | 146~147 | `REG_KALMAN_Q_GYRO_X` | R/W | float | Kalman | Gyro X通道Q参数 |
| 82 | `0x0094~0x0095` | 148~149 | `REG_KALMAN_R_GYRO_X` | R/W | float | Kalman | Gyro X通道R参数 |
| 83 | `0x0096~0x0097` | 150~151 | `REG_KALMAN_Q_GYRO_Y` | R/W | float | Kalman | Gyro Y通道Q参数 |
| 84 | `0x0098~0x0099` | 152~153 | `REG_KALMAN_R_GYRO_Y` | R/W | float | Kalman | Gyro Y通道R参数 |
| 85 | `0x009A~0x009B` | 154~155 | `REG_KALMAN_Q_GYRO_Z` | R/W | float | Kalman | Gyro Z通道Q参数 |
| 86 | `0x009C~0x009D` | 156~157 | `REG_KALMAN_R_GYRO_Z` | R/W | float | Kalman | Gyro Z通道R参数 |
| 87 | `0x009E` | 158 | `REG_KALMAN_CMD` | R/W | uint16 | Kalman | Kalman命令，写`0x5A5A`保存统一配置 |
| 88 | `0x009F` | 159 | `REG_SERVO_SAVE_CMD` | W | uint16 | 舵机补偿 | 写`0x5A5A`保存统一配置到Flash |
| 89 | `0x00A0~0x00A1` | 160~161 | `REG_SERVO1_BASE` | R/W | float/deg | 舵机补偿 | 舵机1基础角度 |
| 90 | `0x00A2~0x00A3` | 162~163 | `REG_SERVO1_K_ROLL` | R/W | float | 舵机补偿 | 舵机1 Roll补偿系数 |
| 91 | `0x00A4~0x00A5` | 164~165 | `REG_SERVO1_K_PITCH` | R/W | float | 舵机补偿 | 舵机1 Pitch补偿系数 |
| 92 | `0x00A6~0x00A7` | 166~167 | `REG_SERVO1_K_YAW` | R/W | float | 舵机补偿 | 舵机1 Yaw补偿系数 |
| 93 | `0x00A8~0x00A9` | 168~169 | `REG_SERVO2_BASE` | R/W | float/deg | 舵机补偿 | 舵机2基础角度 |
| 94 | `0x00AA~0x00AB` | 170~171 | `REG_SERVO2_K_ROLL` | R/W | float | 舵机补偿 | 舵机2 Roll补偿系数 |
| 95 | `0x00AC~0x00AD` | 172~173 | `REG_SERVO2_K_PITCH` | R/W | float | 舵机补偿 | 舵机2 Pitch补偿系数 |
| 96 | `0x00AE~0x00AF` | 174~175 | `REG_SERVO2_K_YAW` | R/W | float | 舵机补偿 | 舵机2 Yaw补偿系数 |
| 97 | `0x00B0~0x00B1` | 176~177 | `REG_SERVO3_BASE` | R/W | float/deg | 舵机补偿 | 舵机3基础角度 |
| 98 | `0x00B2~0x00B3` | 178~179 | `REG_SERVO3_K_ROLL` | R/W | float | 舵机补偿 | 舵机3 Roll补偿系数 |
| 99 | `0x00B4~0x00B5` | 180~181 | `REG_SERVO3_K_PITCH` | R/W | float | 舵机补偿 | 舵机3 Pitch补偿系数 |
| 100 | `0x00B6~0x00B7` | 182~183 | `REG_SERVO3_K_YAW` | R/W | float | 舵机补偿 | 舵机3 Yaw补偿系数 |
| 101 | `0x00B8~0x00B9` | 184~185 | `REG_SERVO4_BASE` | R/W | float/deg | 舵机补偿 | 舵机4基础角度 |
| 102 | `0x00BA~0x00BB` | 186~187 | `REG_SERVO4_K_ROLL` | R/W | float | 舵机补偿 | 舵机4 Roll补偿系数 |
| 103 | `0x00BC~0x00BD` | 188~189 | `REG_SERVO4_K_PITCH` | R/W | float | 舵机补偿 | 舵机4 Pitch补偿系数 |
| 104 | `0x00BE~0x00BF` | 190~191 | `REG_SERVO4_K_YAW` | R/W | float | 舵机补偿 | 舵机4 Yaw补偿系数 |
| 105 | `0x00C0~0x00C1` | 192~193 | `REG_SERVO5_BASE` | R/W | float/deg | 舵机补偿 | 舵机5基础角度 |
| 106 | `0x00C2~0x00C3` | 194~195 | `REG_SERVO5_K_ROLL` | R/W | float | 舵机补偿 | 舵机5 Roll补偿系数 |
| 107 | `0x00C4~0x00C5` | 196~197 | `REG_SERVO5_K_PITCH` | R/W | float | 舵机补偿 | 舵机5 Pitch补偿系数 |
| 108 | `0x00C6~0x00C7` | 198~199 | `REG_SERVO5_K_YAW` | R/W | float | 舵机补偿 | 舵机5 Yaw补偿系数 |
| 109 | `0x00C8~0x00C9` | 200~201 | `REG_SERVO6_BASE` | R/W | float/deg | 舵机补偿 | 舵机6基础角度 |
| 110 | `0x00CA~0x00CB` | 202~203 | `REG_SERVO6_K_ROLL` | R/W | float | 舵机补偿 | 舵机6 Roll补偿系数 |
| 111 | `0x00CC~0x00CD` | 204~205 | `REG_SERVO6_K_PITCH` | R/W | float | 舵机补偿 | 舵机6 Pitch补偿系数 |
| 112 | `0x00CE~0x00CF` | 206~207 | `REG_SERVO6_K_YAW` | R/W | float | 舵机补偿 | 舵机6 Yaw补偿系数 |
| 113 | `0x00D0~0x00D1` | 208~209 | `REG_SERVO7_BASE` | R/W | float/deg | 舵机补偿 | 舵机7基础角度 |
| 114 | `0x00D2~0x00D3` | 210~211 | `REG_SERVO7_K_ROLL` | R/W | float | 舵机补偿 | 舵机7 Roll补偿系数 |
| 115 | `0x00D4~0x00D5` | 212~213 | `REG_SERVO7_K_PITCH` | R/W | float | 舵机补偿 | 舵机7 Pitch补偿系数 |
| 116 | `0x00D6~0x00D7` | 214~215 | `REG_SERVO7_K_YAW` | R/W | float | 舵机补偿 | 舵机7 Yaw补偿系数 |
| 117 | `0x00D8~0x00D9` | 216~217 | `REG_SERVO8_BASE` | R/W | float/deg | 舵机补偿 | 舵机8基础角度 |
| 118 | `0x00DA~0x00DB` | 218~219 | `REG_SERVO8_K_ROLL` | R/W | float | 舵机补偿 | 舵机8 Roll补偿系数 |
| 119 | `0x00DC~0x00DD` | 220~221 | `REG_SERVO8_K_PITCH` | R/W | float | 舵机补偿 | 舵机8 Pitch补偿系数 |
| 120 | `0x00DE~0x00DF` | 222~223 | `REG_SERVO8_K_YAW` | R/W | float | 舵机补偿 | 舵机8 Yaw补偿系数 |
| 121 | `0x00E0` | 224 | `REG_SERVO1_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机1补偿使能，0关闭，1开启 |
| 122 | `0x00E1` | 225 | `REG_SERVO2_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机2补偿使能，0关闭，1开启 |
| 123 | `0x00E2` | 226 | `REG_SERVO3_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机3补偿使能，0关闭，1开启 |
| 124 | `0x00E3` | 227 | `REG_SERVO4_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机4补偿使能，0关闭，1开启 |
| 125 | `0x00E4` | 228 | `REG_SERVO5_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机5补偿使能，0关闭，1开启 |
| 126 | `0x00E5` | 229 | `REG_SERVO6_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机6补偿使能，0关闭，1开启 |
| 127 | `0x00E6` | 230 | `REG_SERVO7_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机7补偿使能，0关闭，1开启 |
| 128 | `0x00E7` | 231 | `REG_SERVO8_AUTO_EN` | R/W | uint16 | 舵机补偿 | 舵机8补偿使能，0关闭，1开启 |
| 129 | `0x00E8` | 232 | `REG_DBG_EN` | R/W | uint16 | 调试 | 调试输出开关，0关闭，1开启 |

