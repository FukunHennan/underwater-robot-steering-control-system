/**
 * Cross-cutting utilities shared by dashboard components.
 *
 * Keep this module dependency-free (no React, no heavy imports) so it can be
 * imported from anywhere — including hooks and pure helpers.
 */

import type { AxisMappingConfig } from './types';
import { DEFAULT_AXIS_CONFIG, MOUNT_STORAGE_KEY } from './presets';

/** Conditional className join. */
export const cn = (...classes: (string | false | undefined | null)[]): string =>
  classes.filter(Boolean).join(' ');

/** Standard 2-decimal float formatter for telemetry display. */
export const fmtFloat = (v: number): string => v.toFixed(2);

/** Temperature formatter — 1 decimal is plenty for °C readings. */
export const fmtTemp = (v: number): string => v.toFixed(1);

/* ----------------------------------------------------------------------------
 * Servo helpers
 *   500μs = 0°, 1500μs = 90°, 2500μs = 180°  →  1000μs per 90°
 * --------------------------------------------------------------------------*/
export const SERVO_US_PER_DEG = 1000 / 90;
export const clampDuty = (d: number): number =>
  Math.max(500, Math.min(2500, Math.round(d)));
export const dutyToAngle = (duty: number, zero: number): number =>
  (duty - zero) / SERVO_US_PER_DEG;
export const angleToDuty = (angle: number, zero: number): number =>
  clampDuty(zero + angle * SERVO_US_PER_DEG);

/* ----------------------------------------------------------------------------
 * Axis mapping helpers (persisted in localStorage so users can keep their
 * mounting orientation across sessions).
 * --------------------------------------------------------------------------*/
export function loadAxisMapping(): AxisMappingConfig {
  try {
    const saved = localStorage.getItem(MOUNT_STORAGE_KEY);
    if (saved !== null) {
      const cfg = JSON.parse(saved) as AxisMappingConfig;
      for (const key of ['rollSource', 'pitchSource', 'yawSource'] as const) {
        if (![0, 1, 2].includes(cfg[key])) return DEFAULT_AXIS_CONFIG;
      }
      for (const key of ['rollSign', 'pitchSign', 'yawSign'] as const) {
        if (![1, -1].includes(cfg[key])) return DEFAULT_AXIS_CONFIG;
      }
      return cfg;
    }
  } catch {
    /* ignore: fall through to default */
  }
  return DEFAULT_AXIS_CONFIG;
}

export function applyAxisMapping(
  raw: { roll: number; pitch: number; yaw: number; gyroX: number; gyroY: number; gyroZ: number },
  cfg: AxisMappingConfig,
): { roll: number; pitch: number; yaw: number; gyroX: number; gyroY: number; gyroZ: number } {
  const sensorVals = [raw.roll, raw.pitch, raw.yaw];
  const sensorGyros = [raw.gyroX, raw.gyroY, raw.gyroZ];

  return {
    roll: cfg.rollSign * sensorVals[cfg.rollSource] + cfg.rollOffset,
    pitch: cfg.pitchSign * sensorVals[cfg.pitchSource] + cfg.pitchOffset,
    yaw: cfg.yawSign * sensorVals[cfg.yawSource] + cfg.yawOffset,
    gyroX: cfg.rollSign * sensorGyros[cfg.rollSource],
    gyroY: cfg.pitchSign * sensorGyros[cfg.pitchSource],
    gyroZ: cfg.yawSign * sensorGyros[cfg.yawSource],
  };
}
