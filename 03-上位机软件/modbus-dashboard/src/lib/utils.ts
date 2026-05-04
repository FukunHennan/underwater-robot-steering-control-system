import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { AttitudeData, AxisMappingConfig } from './types'
import { MOUNT_STORAGE_KEY, DEFAULT_AXIS_CONFIG } from './presets'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SERVO_US_PER_DEG = 10

export function fmtFloat(n: number): string {
  return n.toFixed(2)
}

export function clampDuty(d: number): number {
  return Math.max(500, Math.min(2500, Math.round(d)))
}

export function dutyToAngle(duty: number, zero: number): number {
  return (duty - zero) / SERVO_US_PER_DEG
}

export function angleToDuty(angle: number, zero: number): number {
  return angle * SERVO_US_PER_DEG + zero
}

export function loadAxisMapping(): AxisMappingConfig {
  try {
    const raw = localStorage.getItem(MOUNT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : { ...DEFAULT_AXIS_CONFIG }
  } catch {
    return { ...DEFAULT_AXIS_CONFIG }
  }
}

export function applyAxisMapping(att: AttitudeData, cfg: AxisMappingConfig): AttitudeData {
  const axes = [att.roll, att.pitch, att.yaw]
  return {
    roll: axes[cfg.rollSource] * cfg.rollSign + cfg.rollOffset,
    pitch: axes[cfg.pitchSource] * cfg.pitchSign + cfg.pitchOffset,
    yaw: axes[cfg.yawSource] * cfg.yawSign + cfg.yawOffset,
    gyroX: att.gyroX,
    gyroY: att.gyroY,
    gyroZ: att.gyroZ,
  }
}
