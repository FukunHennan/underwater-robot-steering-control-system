/**
 * Static configuration constants used across UI panels.
 *
 * Group anything that's purely static / display-oriented here so component
 * files stay focused on rendering logic.
 */

import type { ConnectionState } from './modbus';
import type { AxisMappingConfig, IRPreset } from './types';

/** 6 Kalman filter channels — order matches firmware register layout. */
export const KALMAN_CH_NAMES = [
  'Roll', 'Pitch', 'Yaw', 'GyroX', 'GyroY', 'GyroZ',
] as const;

export const SENSOR_AXIS_NAMES = ['Roll(X)', 'Pitch(Y)', 'Yaw(Z)'] as const;

/** Default mapping: 1:1, no offset. */
export const DEFAULT_AXIS_CONFIG: AxisMappingConfig = {
  rollSource: 0, rollSign: 1, rollOffset: 0,
  pitchSource: 1, pitchSign: 1, pitchOffset: 0,
  yawSource: 2, yawSign: 1, yawOffset: 0,
};

export const MOUNT_STORAGE_KEY = 'modbus-axis-mapping';

export const PHYSICAL_AXES = [
  { key: 'roll' as const,  label: 'Roll (横滚)',  color: 'text-sky-400',     accent: 'sky' },
  { key: 'pitch' as const, label: 'Pitch (俯仰)', color: 'text-emerald-400', accent: 'emerald' },
  { key: 'yaw' as const,   label: 'Yaw (航向)',   color: 'text-amber-400',   accent: 'amber' },
] as const;

/** Physical pin labels for the 4 GPIO channels. */
export const GPIO_LABELS = ['PB12', 'PE6', 'PE5', 'PC4'] as const;

/** IR receive status code → human label.
 *  0/1/2 are the canonical NEC states; 3 is the firmware debug "edge seen". */
export const IR_STATUS_LABELS: Record<number, string> = {
  0: '空闲',
  1: '收到帧',
  2: '重复码',
  3: '边沿(调试)',
};

/** Common IR remote presets for quick-send buttons. */
export const IR_PRESETS: IRPreset[] = [
  { name: '电视 - 电源',   addr: 0x00, cmd: 0x45, note: 'TV Power' },
  { name: '电视 - 静音',   addr: 0x00, cmd: 0x09, note: 'TV Mute' },
  { name: '电视 - 音量+',  addr: 0x00, cmd: 0x47, note: 'Vol+' },
  { name: '电视 - 音量-',  addr: 0x00, cmd: 0x48, note: 'Vol-' },
  { name: '电视 - 频道+',  addr: 0x00, cmd: 0x43, note: 'CH+' },
  { name: '电视 - 频道-',  addr: 0x00, cmd: 0x44, note: 'CH-' },
  { name: '电视 - 上',     addr: 0x00, cmd: 0x16, note: 'Up' },
  { name: '电视 - 下',     addr: 0x00, cmd: 0x51, note: 'Down' },
  { name: '电视 - 左',     addr: 0x00, cmd: 0x53, note: 'Left' },
  { name: '电视 - 右',     addr: 0x00, cmd: 0x50, note: 'Right' },
  { name: '电视 - 确认',   addr: 0x00, cmd: 0x0D, note: 'OK' },
  { name: '电视 - 返回',   addr: 0x00, cmd: 0x15, note: 'Back' },
  { name: '空调 - 电源',   addr: 0x00, cmd: 0x40, note: 'AC Power' },
  { name: '空调 - 温度+',  addr: 0x00, cmd: 0x58, note: 'Temp+' },
  { name: '空调 - 温度-',  addr: 0x00, cmd: 0x59, note: 'Temp-' },
  { name: '风扇 - 电源',   addr: 0x00, cmd: 0x4C, note: 'Fan Power' },
  { name: '风扇 - 风速',   addr: 0x00, cmd: 0x4E, note: 'Fan Speed' },
  { name: '风扇 - 摇头',   addr: 0x00, cmd: 0x4D, note: 'Fan Oscillate' },
  { name: '灯 - 开',       addr: 0x00, cmd: 0x04, note: 'Light On' },
  { name: '灯 - 关',       addr: 0x00, cmd: 0x08, note: 'Light Off' },
  { name: '自定义',        addr: 0x00, cmd: 0x00, note: 'Custom' },
];

/** PWM hardware groupings for display in the PWM panel. */
export const PWM_GROUPS = [
  { label: 'TIM4', clock:  84_000_000, channels: [0, 1, 2, 3], chLabels: ['CH1', 'CH2', 'CH3', 'CH4'] },
  { label: 'TIM8', clock: 168_000_000, channels: [4, 5],       chLabels: ['CH5', 'CH6'] },
  { label: 'TIM3', clock:  84_000_000, channels: [6, 7],       chLabels: ['CH7', 'CH8'] },
  { label: 'TIM1', clock: 168_000_000, channels: [] as number[], chLabels: [] as string[],
    isLed: true, ledChannels: [0, 1], ledLabels: ['LED1', 'LED2'] },
] as const;

export const modeLabels = ['待机', '手动', '自动'] as const;

export const stateLabel: Record<ConnectionState, string> = {
  connected: '已连接',
  connecting: '连接中...',
  disconnected: '未连接',
  error: '错误',
};
