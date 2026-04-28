/**
 * Shared types for the Modbus dashboard.
 *
 * Domain data shapes are produced by `ModbusClient` readers in `lib/modbus.ts`
 * (some are inferred from return types there) and consumed across components.
 */

export interface SystemData {
  deviceId: number;
  fwVersion: number;
  runMode: number;
  faultCode: number;
  sysTick: number;
}

export interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
}

export interface PwmData {
  servos: number[];
  leds: number[];
}

export interface PwmFreqGroup {
  arr: number;
  psc: number;
}

export interface PwmFreqData {
  groups: PwmFreqGroup[];
}

export interface AdcData {
  temps: number[];
  voltage: number;
  adcRaw: number[];
}

export interface BarometerData {
  pressure: number;
  altitude: number;
  temperature: number;
}

export interface CalibData {
  gains: number[];
  offsets: number[];
  status: number;
}

export interface MagnetometerData {
  magX: number;
  magY: number;
  magZ: number;
  temperature: number;
}

export interface KalmanData {
  q: number[]; // 6 channels
  r: number[]; // 6 channels
}

export interface WaveformSeries {
  label: string;
  color: string;
  data: number[];
}

/**
 * Custom axis mapping configuration.
 *
 * The sensor outputs 3 axes: sensorRoll(X), sensorPitch(Y), sensorYaw(Z).
 * Each physical axis (Roll, Pitch, Yaw) is mapped to ONE sensor axis,
 * with an optional sign flip and angle offset.
 */
export interface AxisMappingConfig {
  rollSource: 0 | 1 | 2;
  rollSign: 1 | -1;
  rollOffset: number;
  pitchSource: 0 | 1 | 2;
  pitchSign: 1 | -1;
  pitchOffset: number;
  yawSource: 0 | 1 | 2;
  yawSign: 1 | -1;
  yawOffset: number;
}

export interface IRPreset {
  name: string;
  addr: number;
  cmd: number;
  note?: string;
}
