import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Waves, Plug, PlugZap, RefreshCw, Activity, Thermometer, CloudRain,
  Gauge, Sliders, Cpu, AlertTriangle, Zap, FileText, LayoutDashboard, Trash2, Settings,
  Home, Compass, Target
} from 'lucide-react'
import { ModbusClient, type ConnectionState, type ModbusLog, type ReconnectInfo, type GPIOData, type IRData, REG, CAL_CH_NAMES } from './lib/modbus'
import type {
  SystemData, AttitudeData, PwmData, PwmFreqData, AdcData,
  BarometerData, CalibData, MagnetometerData, KalmanData,
  AxisMappingConfig, IRPreset, WaveformSeries, PwmFreqGroup,
} from './lib/types'
import {
  cn, fmtFloat, fmtTemp,
  SERVO_US_PER_DEG, clampDuty, dutyToAngle, angleToDuty,
  loadAxisMapping, applyAxisMapping,
} from './lib/utils'
import {
  KALMAN_CH_NAMES, SENSOR_AXIS_NAMES, DEFAULT_AXIS_CONFIG, PHYSICAL_AXES,
  GPIO_LABELS, IR_STATUS_LABELS, IR_PRESETS, PWM_GROUPS,
  modeLabels, stateLabel, MOUNT_STORAGE_KEY,
} from './lib/presets'
import { Card } from './components/common/Card'
import { Metric } from './components/common/Metric'
import { SystemCard } from './components/panels/SystemCard'
import { BarometerCard } from './components/panels/BarometerCard'
import { MagnetometerCard } from './components/panels/MagnetometerCard'
import { GPIOCard } from './components/panels/GPIOCard'
import { IRPanel } from './components/ir/IRPanel'
import { usePolling } from './hooks/usePolling'
import { ServoCompensationPage } from './pages/ServoCompensationPage'

// ======================== StatusDot (kept local - tightly coupled to header layout) ========================

function StatusDot({ state }: { state: ConnectionState }) {
  const colors: Record<ConnectionState, string> = {
    connected: 'bg-[--success]',
    connecting: 'bg-[--warning] animate-pulse',
    disconnected: 'bg-[--fg-muted]',
    error: 'bg-[--danger]',
  }
  return <span className={cn('inline-block w-2 h-2 rounded-full', colors[state])} />
}

// ======================== 3D Attitude Visualization ========================

/**
 * 3D underwater vehicle attitude indicator using CSS 3D box faces.
 * Each face shows a different view of the vehicle so it remains
 * readable from any rotation angle.
 *
 *  Body dimensions: 200 (length) × 80 (width) × 60 (height)
 */
function AttitudeModel({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  const L = 180  // length
  const R = 35   // radius of cylinder body

  // Propeller rotation animation (visual spin effect based on yaw rate)
  const propAngle = yaw * 3  // spin proportional to yaw

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 3D viewport with water background */}
      <div className="relative w-full h-80 rounded-xl overflow-hidden"
        style={{
          perspective: '1000px',
          background: 'linear-gradient(180deg, rgba(10,25,50,0.95) 0%, rgba(5,15,35,0.98) 100%)',
        }}
      >
        {/* Water effect - light rays */}
        <div className="absolute inset-0 opacity-10" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.3) 0%, transparent 70%)',
        }} />

        {/* 3D model container */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${yaw}deg) rotateX(${-pitch}deg) rotateZ(${-roll}deg)`,
            transition: 'transform 120ms ease-out',
          }}
        >
          {/* ====== MAIN CYLINDER BODY ====== */}
          {/* Cylinder made of 24 vertical slices for smooth 3D tube */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15) * Math.PI / 180
            const x = Math.cos(angle) * R
            const y = Math.sin(angle) * R
            const nextAngle = ((i + 1) * 15) * Math.PI / 180
            const nx = Math.cos(nextAngle) * R
            const ny = Math.sin(nextAngle) * R
            const brightness = 0.3 + 0.4 * Math.cos(angle)  // lighting effect
            return (
              <div key={`side-${i}`} style={{
                position: 'absolute',
                width: L,
                height: 1,  // thin strip
                transformStyle: 'preserve-3d',
                transform: `translateY(${y}px) translateZ(${x}px) rotateX(90deg)`,
              }}>
                <div style={{
                  width: L,
                  height: R * 2,
                  background: `linear-gradient(90deg, 
                    rgba(30,60,110,${brightness * 0.8}) 0%, 
                    rgba(40,80,140,${brightness}) 50%, 
                    rgba(25,50,90,${brightness * 0.8}) 100%)`,
                  borderLeft: `1px solid rgba(56,189,248,${brightness * 0.3})`,
                  borderRight: `1px solid rgba(56,189,248,${brightness * 0.3})`,
                  opacity: 0.85,
                }} />
              </div>
            )
          })}

          {/* ====== FRONT NOSE CONE (hemisphere) ====== */}
          <div style={{
            position: 'absolute',
            width: R * 2,
            height: R * 2,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2}px) translateZ(${R}px)`,
          }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 15) * Math.PI / 180
              const y = Math.sin(angle) * R
              const z = Math.cos(angle) * R
              const brightness = 0.4 + 0.5 * Math.cos(angle)
              return (
                <div key={`nose-${i}`} style={{
                  position: 'absolute',
                  width: 1,
                  height: R * 2,
                  transformStyle: 'preserve-3d',
                  transform: `translateY(${y}px) translateZ(${z}px) rotateY(90deg)`,
                }}>
                  <div style={{
                    width: R * 0.6,  // nose cone depth
                    height: R * 2,
                    background: `linear-gradient(90deg, 
                      rgba(56,189,248,${brightness * 0.4}) 0%,
                      rgba(40,80,140,${brightness * 0.6}) 100%)`,
                    borderRadius: '0 50% 50% 0',
                    opacity: 0.9,
                  }} />
                </div>
              )
            })}
          </div>

          {/* ====== BACK STERN (flat cap) ====== */}
          <div style={{
            position: 'absolute',
            width: R * 2,
            height: R * 2,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2}px) translateZ(${R}px) rotateY(90deg)`,
          }}>
            <div style={{
              width: R * 2,
              height: R * 2,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(25,50,90,0.9) 0%, rgba(15,35,65,0.95) 100%)',
              border: `2px solid rgba(56,189,248,0.3)`,
              boxShadow: 'inset 0 0 20px rgba(56,189,248,0.1)',
            }} />
          </div>

          {/* ====== TOP DOME / CANOPY ====== */}
          <div style={{
            position: 'absolute',
            width: 80,
            height: 40,
            transformStyle: 'preserve-3d',
            transform: `translateX(20px) translateY(${-R * 0.6}px) translateZ(0)`,
          }}>
            <div style={{
              width: 80,
              height: 40,
              background: 'radial-gradient(ellipse at 50% 80%, rgba(56,189,248,0.25) 0%, rgba(30,60,110,0.15) 70%)',
              borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
              border: `1px solid rgba(56,189,248,0.3)`,
              borderBottom: 'none',
            }} />
            {/* Dome windows */}
            <div className="absolute" style={{ left: 20, top: 10, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
            <div className="absolute" style={{ left: 35, top: 8, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
            <div className="absolute" style={{ left: 50, top: 10, width: 10, height: 12, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }} />
          </div>

          {/* ====== FRONT CAMERA ====== */}
          <div style={{
            position: 'absolute',
            width: 20,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2 + 10}px) translateZ(0) rotateY(90deg)`,
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(239,68,68,0.4) 0%, rgba(150,20,20,0.6) 50%, rgba(80,10,10,0.8) 100%)',
              border: `2px solid rgba(239,68,68,0.5)`,
              boxShadow: '0 0 15px rgba(239,68,68,0.3), inset 0 0 8px rgba(0,0,0,0.5)',
            }} />
            {/* Camera lens ring */}
            <div className="absolute inset-2 rounded-full" style={{ border: '1px solid rgba(239,68,68,0.3)' }} />
          </div>

          {/* ====== SEARCHLIGHT ====== */}
          <div style={{
            position: 'absolute',
            width: 16,
            height: 16,
            transformStyle: 'preserve-3d',
            transform: `translateX(${L / 2 + 5}px) translateY(15px) translateZ(0) rotateY(90deg)`,
          }}>
            <div style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(251,191,36,0.5) 0%, rgba(200,150,30,0.3) 60%)',
              border: `1px solid rgba(251,191,36,0.4)`,
              boxShadow: '0 0 20px rgba(251,191,36,0.4)',
            }} />
            {/* Light beam cone */}
            <div style={{
              position: 'absolute',
              left: 16,
              top: -10,
              width: 50,
              height: 36,
              background: 'linear-gradient(90deg, rgba(251,191,36,0.15) 0%, transparent 100%)',
              clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 70%)',
            }} />
          </div>

          {/* ====== TOP THRUSTER (vertical) ====== */}
          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(30px) translateY(${-R - 8}px) translateZ(0)`,
          }}>
            <div style={{
              width: 30,
              height: 20,
              background: 'rgba(139,92,246,0.2)',
              borderRadius: 4,
              border: `1px solid rgba(139,92,246,0.4)`,
            }} />
            {/* Propeller blades */}
            <div className="absolute inset-0 flex items-center justify-center" style={{
              transform: `rotate(${propAngle}deg)`,
            }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          {/* ====== BOTTOM THRUSTER (vertical) ====== */}
          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(30px) translateY(${R + 8}px) translateZ(0)`,
          }}>
            <div style={{
              width: 30,
              height: 20,
              background: 'rgba(139,92,246,0.2)',
              borderRadius: 4,
              border: `1px solid rgba(139,92,246,0.4)`,
            }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{
              transform: `rotate(${-propAngle}deg)`,
            }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          {/* ====== LEFT SIDE THRUSTER ====== */}
          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(-30px) translateZ(${-R - 8}px) rotateX(90deg)`,
          }}>
            <div style={{
              width: 30,
              height: 20,
              background: 'rgba(139,92,246,0.2)',
              borderRadius: 4,
              border: `1px solid rgba(139,92,246,0.4)`,
            }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{
              transform: `rotate(${-propAngle * 0.8}deg)`,
            }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          {/* ====== RIGHT SIDE THRUSTER ====== */}
          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(-30px) translateZ(${R + 8}px) rotateX(90deg)`,
          }}>
            <div style={{
              width: 30,
              height: 20,
              background: 'rgba(139,92,246,0.2)',
              borderRadius: 4,
              border: `1px solid rgba(139,92,246,0.4)`,
            }} />
            <div className="absolute inset-0 flex items-center justify-center" style={{
              transform: `rotate(${propAngle * 0.8}deg)`,
            }}>
              <div style={{ width: 24, height: 3, background: 'rgba(139,92,246,0.5)', borderRadius: 2 }} />
              <div style={{ width: 3, height: 24, background: 'rgba(139,92,246,0.5)', borderRadius: 2, position: 'absolute' }} />
            </div>
          </div>

          {/* ====== MAIN PROPELLER (back) ====== */}
          <div style={{
            position: 'absolute',
            width: 50,
            height: 50,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2 - 15}px) translateZ(${R}px) rotateY(90deg)`,
          }}>
            {/* Propeller hub */}
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(168,130,76,0.6) 0%, rgba(100,80,40,0.8) 100%)',
              border: `1px solid rgba(168,130,76,0.5)`,
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }} />
            {/* Rotating blades */}
            <div className="absolute inset-0 flex items-center justify-center" style={{
              transform: `rotate(${propAngle}deg)`,
            }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`blade-${i}`} style={{
                  position: 'absolute',
                  width: 20,
                  height: 6,
                  background: `linear-gradient(90deg, rgba(168,130,76,0.7) 0%, rgba(168,130,76,0.2) 100%)`,
                  borderRadius: '0 50% 50% 0',
                  transform: `rotate(${i * 90}deg) translateX(8px)`,
                }} />
              ))}
            </div>
          </div>

          {/* ====== TAIL FINS ====== */}
          {/* Top horizontal fin */}
          <div style={{
            position: 'absolute',
            width: 35,
            height: 15,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2 + 10}px) translateY(${-R - 5}px) translateZ(0)`,
          }}>
            <div style={{
              width: 35,
              height: 15,
              background: 'rgba(251,191,36,0.15)',
              border: `1px solid rgba(251,191,36,0.4)`,
              clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
            }} />
          </div>
          {/* Bottom horizontal fin */}
          <div style={{
            position: 'absolute',
            width: 35,
            height: 15,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2 + 10}px) translateY(${R + 5}px) translateZ(0)`,
          }}>
            <div style={{
              width: 35,
              height: 15,
              background: 'rgba(251,191,36,0.15)',
              border: `1px solid rgba(251,191,36,0.4)`,
              clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
            }} />
          </div>
          {/* Vertical fin */}
          <div style={{
            position: 'absolute',
            width: 30,
            height: 20,
            transformStyle: 'preserve-3d',
            transform: `translateX(${-L / 2 + 15}px) translateY(0) translateZ(${-R - 5}px) rotateX(90deg)`,
          }}>
            <div style={{
              width: 30,
              height: 20,
              background: 'rgba(239,68,68,0.1)',
              border: `1px solid rgba(239,68,68,0.4)`,
              clipPath: 'polygon(0 50%, 100% 0, 100% 100%)',
            }} />
          </div>

          {/* ====== ANTENNA / SENSOR MAST ====== */}
          <div style={{
            position: 'absolute',
            width: 3,
            height: 15,
            transformStyle: 'preserve-3d',
            transform: `translateX(50px) translateY(${-R - 15}px) translateZ(0)`,
          }}>
            <div style={{
              width: 3,
              height: 15,
              background: 'linear-gradient(180deg, rgba(239,68,68,0.6) 0%, rgba(100,100,100,0.4) 100%)',
              borderRadius: 2,
            }} />
            <div style={{
              position: 'absolute',
              top: -3,
              left: -2,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.6)',
              boxShadow: '0 0 10px rgba(239,68,68,0.4)',
            }} />
          </div>
        </div>

        {/* Water particles / bubbles */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`bubble-${i}`} className="absolute rounded-full" style={{
              width: 3 + Math.random() * 5,
              height: 3 + Math.random() * 5,
              left: `${10 + Math.random() * 80}%`,
              top: `${20 + Math.random() * 60}%`,
              background: `rgba(56,189,248,${0.1 + Math.random() * 0.2})`,
              animation: `bubbleFloat ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }} />
          ))}
        </div>

        {/* Ground reference grid */}
        <div className="absolute inset-x-0 bottom-0 h-20 opacity-20" style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.1) 100%)',
          backgroundImage: `repeating-linear-gradient(90deg, rgba(56,189,248,0.2) 0px, rgba(56,189,248,0.2) 1px, transparent 1px, transparent 40px),
                           repeating-linear-gradient(0deg, rgba(56,189,248,0.2) 0px, rgba(56,189,248,0.2) 1px, transparent 1px, transparent 40px)`,
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom',
        }} />

        {/* Axis labels */}
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/40 text-[10px] text-[--fg-muted] font-mono">
          Roll {roll.toFixed(1)}° · Pitch {pitch.toFixed(1)}° · Yaw {yaw.toFixed(1)}°
        </div>
      </div>

      {/* Bubble animation styles */}
      <style>{`
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.2); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

// ======================== Attitude Waveform ========================

const WAVEFORM_MAX = 80  // number of history samples
const WAVE_COLORS = {
  roll: '#38bdf8',   // sky-400
  pitch: '#34d399',  // emerald-400
  yaw: '#fbbf24',    // amber-400
  gyroX: '#f87171',  // red-400
  gyroY: '#a78bfa',  // violet-400
  gyroZ: '#fb923c',  // orange-400
}

function AttitudeWaveform({ history, showGyro }: { history: AttitudeData[]; showGyro: boolean }) {
  const W = 800, H = 280, PL = 44, PR = 10, PT = 10, PB = 24
  const cw = W - PL - PR, ch = H - PT - PB

  const series: WaveformSeries[] = showGyro
    ? [
        { label: 'Gyro X', color: WAVE_COLORS.gyroX, data: history.map(h => h.gyroX) },
        { label: 'Gyro Y', color: WAVE_COLORS.gyroY, data: history.map(h => h.gyroY) },
        { label: 'Gyro Z', color: WAVE_COLORS.gyroZ, data: history.map(h => h.gyroZ) },
      ]
    : [
        { label: 'Roll', color: WAVE_COLORS.roll, data: history.map(h => h.roll) },
        { label: 'Pitch', color: WAVE_COLORS.pitch, data: history.map(h => h.pitch) },
        { label: 'Yaw', color: WAVE_COLORS.yaw, data: history.map(h => h.yaw) },
      ]

  // Auto-scale Y axis
  let allVals = series.flatMap(s => s.data)
  if (allVals.length === 0) allVals = [-1, 1]
  let yMin = Math.min(...allVals), yMax = Math.max(...allVals)
  const yPad = Math.max((yMax - yMin) * 0.1, 1)
  yMin -= yPad; yMax += yPad

  const toX = (i: number) => PL + (i / Math.max(history.length - 1, 1)) * cw
  const toY = (v: number) => PT + ch - ((v - yMin) / (yMax - yMin)) * ch

  // Grid lines (5 horizontal)
  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const v = yMin + (yMax - yMin) * (i / 4)
    return { y: toY(v), label: v.toFixed(1) }
  })

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PL} y1={g.y} x2={W - PR} y2={g.y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={PL - 4} y={g.y + 3} textAnchor="end" fill="var(--fg-muted)" fontSize={8} fontFamily="monospace">{g.label}</text>
          </g>
        ))}
        {/* Zero line */}
        {yMin < 0 && yMax > 0 && (
          <line x1={PL} y1={toY(0)} x2={W - PR} y2={toY(0)} stroke="var(--fg-muted)" strokeWidth={0.5} opacity={0.4} />
        )}
        {/* Data lines */}
        {series.map((s, si) => {
          if (s.data.length < 2) return null
          const pts = s.data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')
          return <polyline key={si} points={pts} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" />
        })}
        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="var(--border)" strokeWidth={1} />
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--border)" strokeWidth={1} />
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1 px-1">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            <span className="text-[10px] text-[--fg-muted]">{s.label}</span>
            {s.data.length > 0 && (
              <span className="text-[10px] font-mono" style={{ color: s.color }}>
                {s.data[s.data.length - 1].toFixed(1)}{showGyro ? '°/s' : '°'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ======================== App ========================

export default function App() {
  const client = useRef(new ModbusClient()).current
  const [connState, setConnState] = useState<ConnectionState>('disconnected')
  const [logs, setLogs] = useState<ModbusLog[]>([])
  const [polling, setPolling] = useState(false)
  const [pollInterval, setPollInterval] = useState(500)
  const [view, setView] = useState<'home' | 'system' | 'attitude' | 'pwm' | 'comp' | 'adc' | 'baro' | 'gpio' | 'ir' | 'advanced'>('home')

  const [system, setSystem] = useState<SystemData | null>(null)
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [pwm, setPwm] = useState<PwmData | null>(null)
  const [pwmFreq, setPwmFreq] = useState<PwmFreqData | null>(null)
  const [adc, setAdc] = useState<AdcData | null>(null)
  const [baro, setBaro] = useState<BarometerData | null>(null)
  const [mag, setMag] = useState<MagnetometerData | null>(null)
  const [gpio, setGpio] = useState<GPIOData | null>(null)
  const [ir, setIr] = useState<IRData | null>(null)
  const [error, setError] = useState('')
  const [attHistory, setAttHistory] = useState<AttitudeData[]>([])
  const [showGyro, setShowGyro] = useState(false)
  const [attOffset, setAttOffset] = useState<AttitudeData | null>(null)

  /* Local slider state: instant UI feedback, write only on release */
  const [localServos, setLocalServos] = useState<number[]>([1500,1500,1500,1500,1500,1500,1500,1500])
  const [localLeds, setLocalLeds] = useState<number[]>([0, 0])
  const [localFreq, setLocalFreq] = useState<PwmFreqGroup[]>([
    { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 },
    { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 },
  ])

  /* ADC calibration state */
  const [calib, setCalib] = useState<CalibData | null>(null)
  const [calibEdit, setCalibEdit] = useState<{ gains: string[]; offsets: string[] }>({
    gains: ['1', '1', '1', '1', '1'],
    offsets: ['0', '0', '0', '0', '0'],
  })
  const [calibMsg, setCalibMsg] = useState<{ type: 'info' | 'ok' | 'err'; text: string } | null>(null)
  const [ioMsg, setIoMsg] = useState<{ type: 'info' | 'ok' | 'err'; text: string } | null>(null)

  /* Kalman filter parameters state */
  const [kalman, setKalman] = useState<KalmanData | null>(null)
  const [kalmanQEdit, setKalmanQEdit] = useState<string[]>(Array(6).fill('0.001'))
  const [kalmanREdit, setKalmanREdit] = useState<string[]>(Array(6).fill('0.1'))
  const [kalmanMsg, setKalmanMsg] = useState<{ type: 'info' | 'ok' | 'err'; text: string } | null>(null)
  const [kalmanChan, setKalmanChan] = useState(0) // 0-5 channel selector

  /* Custom axis mapping state */
  const [axisCfg, setAxisCfg] = useState<AxisMappingConfig>(loadAxisMapping)
  const [irTxCmd, setIrTxCmd] = useState('1')
  const [irTxData, setIrTxData] = useState('4660')
  const [irTxPresetIndex, setIrTxPresetIndex] = useState(0)
  const [irTxAddr, setIrTxAddr] = useState('0')
  const [irTxAddrHex, setIrTxAddrHex] = useState('00')
  const [irTxCmdHex, setIrTxCmdHex] = useState('45')

  /* IR timing parameters */
  const [irParams, setIrParams] = useState({
    leadLowLo: 8500, leadLowHi: 9500,
    leadHighLo: 4000, leadHighHi: 5000,
    bit0Lo: 400, bit0Hi: 700,
    bit1Lo: 1500, bit1Hi: 1900,
  })
  const [irParamsEdit, setIrParamsEdit] = useState({
    leadLowLo: '8500', leadLowHi: '9500',
    leadHighLo: '4000', leadHighHi: '5000',
    bit0Lo: '400', bit0Hi: '700',
    bit1Lo: '1500', bit1Hi: '1900',
  })
  const [irMsg, setIrMsg] = useState<{ type: 'info' | 'ok' | 'err'; text: string } | null>(null)

  /* Servo zero-angle calibration (per-channel, saved in localStorage) */
  const [servoZeros, setServoZeros] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('servoZeros')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === 8) return parsed
      }
    } catch { /* ignore */ }
    return [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]
  })
  /* Servo angle editing string (independent of duty slider, allows typing) */
  const [servoAngleStr, setServoAngleStr] = useState<string[]>(Array(8).fill(''))
  /* Which servo angle input is currently focused (allows empty string while editing) */
  const [focusedServoAngle, setFocusedServoAngle] = useState<number | null>(null)

  const draggingRef = useRef(false)

  const timerRef = useRef<number | null>(null)
  /* Flash 写入期间暂停所有轮询，避免串口污染 */
  const flashBusyRef = useRef(false)
  /* Auto-reconnect progress (null = not reconnecting) */
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null)

  // MOCK MODE: inject demo data when ?mock is in URL
  useEffect(() => {
    if (!window.location.search.includes('mock')) return
    setConnState('connected' as ConnectionState)
    setSystem({ deviceId: 0x0407, fwVersion: 0x0300, runMode: 1, faultCode: 0, sysTick: 156320 })
    setAttitude({ roll: 12.35, pitch: -3.78, yaw: 156.42, gyroX: 0.52, gyroY: -1.23, gyroZ: 0.08 })
    setPwm({ servos: [1500, 1620, 1380, 1500, 1750, 1500, 1200, 1500], leds: [680, 250] })
    setPwmFreq({ groups: [{ arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }] })
    setAdc({ temps: [25.6, 18.3, 31.2, 22.8], voltage: 11.8, adcRaw: [3128, 2234, 3812, 2786, 3654] })
    setBaro({ pressure: 101325, altitude: 2850, temperature: 24.6 })
    setMag({ magX: 23.5, magY: -12.3, magZ: 45.8, temperature: 25.2 })
    setCalib({ gains: [1, 1, 1, 1, 1], offsets: [0, 0, 0, 0, 0], status: 0 })
    setKalman({ q: [0.001, 0.001, 0.001, 0.001, 0.001, 0.001], r: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] })
    setGpio({ modes: [0, 1, 0, 1], outputs: [0, 1, 0, 1], inputs: [0, 1, 1, 0] })
    setIr({ txCmd: 0, txData: 0x1234, rxStatus: 0, rxData: 0x1234 })
    setLocalServos([1500, 1620, 1380, 1500, 1750, 1500, 1200, 1500])
    setLocalLeds([680, 250])
    const hist: AttitudeData[] = []
    for (let i = 0; i < 60; i++) {
      hist.push({
        roll: 12.35 + Math.sin(i * 0.15) * 5, pitch: -3.78 + Math.cos(i * 0.12) * 3,
        yaw: 156.42 + Math.sin(i * 0.08) * 2, gyroX: 0.52 + Math.sin(i * 0.2) * 2,
        gyroY: -1.23 + Math.cos(i * 0.18) * 1.5, gyroZ: 0.08 + Math.sin(i * 0.25) * 0.5
      })
    }
    setAttHistory(hist)
  }, [])

  useEffect(() => {
    client.onStateChange(setConnState)
    client.onLog(setLogs)
    client.onReconnect(setReconnectInfo)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [client])

  const handleConnect = async () => {
    try {
      setError('')
      await client.connect(9600)
      /* Auto-load calibration once on connect */
      loadCalibFromDevice().catch(() => null)
      client.readGPIO().then(setGpio).catch(() => null)
      client.readIR().then(setIr).catch(() => null)
      loadKalmanFromDevice().catch(() => null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDisconnect = async () => {
    pollingRef.current = false
    setPolling(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    await client.disconnect()
  }

  const pollOnce = useCallback(async () => {
    if (connState !== 'connected') return
    try {
      setError('')
      const [sys, att, pwmData, freqData, adcData, baroData, magData, gpioData, irData] = await Promise.all([
        client.readSystem().catch(() => null),
        client.readAttitude().catch(() => null),
        client.readPWM().catch(() => null),
        client.readPWMFreq().catch(() => null),
        client.readADC().catch(() => null),
        client.readBarometer().catch(() => null),
        client.readMagnetometer().catch(() => null),
        client.readGPIO().catch(() => null),
        client.readIR().catch(() => null),
      ])
      if (sys) setSystem(sys)
      if (att) setAttitude(att)
      if (pwmData) setPwm(pwmData)
      if (freqData) setPwmFreq(freqData)
      if (adcData) setAdc(adcData)
      if (baroData) setBaro(baroData)
      if (magData) setMag(magData)
      if (gpioData) setGpio(gpioData)
      if (irData) setIr(irData)
    } catch (e: any) {
      setError(e.message)
    }
  }, [connState, client])

  // Sequential polling (not parallel - Modbus is half-duplex)
  const pollSequential = useCallback(async () => {
    if (connState !== 'connected') return
    try {
      setError('')
      const sys = await client.readSystem().catch(() => null)
      if (sys) setSystem(sys)
      const att = await client.readAttitude().catch(() => null)
      if (att) setAttitude(att)
      const pwmData = await client.readPWM().catch(() => null)
      if (pwmData) setPwm(pwmData)
      const freqData = await client.readPWMFreq().catch(() => null)
      if (freqData) setPwmFreq(freqData)
      const adcData = await client.readADC().catch(() => null)
      if (adcData) setAdc(adcData)
      const baroData = await client.readBarometer().catch(() => null)
      if (baroData) setBaro(baroData)
      const magData = await client.readMagnetometer().catch(() => null)
      if (magData) setMag(magData)
      const gpioData = await client.readGPIO().catch(() => null)
      if (gpioData) setGpio(gpioData)
      const irData = await client.readIR().catch(() => null)
      if (irData) setIr(irData)
    } catch (e: any) {
      setError(e.message)
    }
  }, [connState, client])

  const isPollingBusy = useCallback(() => flashBusyRef.current, [])

  /* Polling loop is managed by the usePolling hook. The hook owns its own
   * cancellation ref so we capture it here to allow imperative stops from
   * disconnect/toggle handlers below. */
  const { pollingRef } = usePolling({
    enabled: polling && connState === 'connected',
    intervalMs: pollInterval,
    pollFn: pollSequential,
    isBusy: isPollingBusy,
  })

  const togglePolling = () => {
    if (polling) {
      pollingRef.current = false
      setPolling(false)
    } else {
      setPolling(true)
    }
  }

  /* Sync local slider state when poll data arrives */
  useEffect(() => {
    if (pwm && !draggingRef.current) {
      setLocalServos(pwm.servos.slice())
      setLocalLeds(pwm.leds.slice())
    }
  }, [pwm])

  useEffect(() => {
    if (pwmFreq) setLocalFreq(pwmFreq.groups.map(g => ({ ...g })))
  }, [pwmFreq])

  const applyOffset = useCallback((raw: AttitudeData): AttitudeData => {
    if (!attOffset) return raw
    return {
      roll: raw.roll - attOffset.roll,
      pitch: raw.pitch - attOffset.pitch,
      yaw: raw.yaw - attOffset.yaw,
      gyroX: raw.gyroX - attOffset.gyroX,
      gyroY: raw.gyroY - attOffset.gyroY,
      gyroZ: raw.gyroZ - attOffset.gyroZ,
    }
  }, [attOffset])

  const calibratedAttitude = attitude ? applyOffset(attitude) : null

  /* Apply axis mapping for mount orientation (handles axis swap + sign flip + offset) */
  const calibratedAttitudeWithMount = calibratedAttitude != null
    ? applyAxisMapping(calibratedAttitude, axisCfg)
    : null

  useEffect(() => {
    if (calibratedAttitudeWithMount) setAttHistory(prev => [...prev.slice(-(WAVEFORM_MAX - 1)), calibratedAttitudeWithMount])
  }, [calibratedAttitudeWithMount])

  const handleZeroCalibrate = () => {
    if (calibratedAttitudeWithMount) {
      setAttOffset({
        roll: attitude!.roll,
        pitch: attitude!.pitch,
        yaw: attitude!.yaw,
        gyroX: attitude!.gyroX,
        gyroY: attitude!.gyroY,
        gyroZ: attitude!.gyroZ,
      })
      setAttHistory([])
    }
  }

  const handleClearCalibrate = () => {
    setAttOffset(null)
    setAttHistory([])
  }

  /* ============ ADC Calibration handlers ============ */

  const loadCalibFromDevice = useCallback(async () => {
    try {
      const data = await client.readCalibration()
      setCalib(data)
      setCalibEdit({
        gains:   data.gains.map(g => g.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')),
        offsets: data.offsets.map(o => o.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')),
      })
      return data
    } catch (e: any) {
      setCalibMsg({ type: 'err', text: `读取失败: ${e.message}` })
      return null
    }
  }, [client])

  const handleCalibRefresh = async () => {
    setCalibMsg({ type: 'info', text: '正在读取校准值...' })
    const data = await loadCalibFromDevice()
    if (data) setCalibMsg({ type: 'ok', text: '已从下位机读取校准值' })
  }

  const handleCalibApplyChannel = async (ch: number) => {
    const g = parseFloat(calibEdit.gains[ch])
    const o = parseFloat(calibEdit.offsets[ch])
    if (!isFinite(g) || !isFinite(o)) {
      setCalibMsg({ type: 'err', text: `${CAL_CH_NAMES[ch]} 参数不合法` })
      return
    }
    try {
      await client.writeCalibChannel(ch, g, o)
      setCalibMsg({ type: 'ok', text: `${CAL_CH_NAMES[ch]} 已应用 gain=${g}, offset=${o}` })
      await loadCalibFromDevice()
    } catch (e: any) {
      setCalibMsg({ type: 'err', text: `写入失败: ${e.message}` })
    }
  }

  /** 一键校准：用户输入该通道的"实际物理量值"，基于当前读数反算 gain */
  const handleCalibAuto = async (ch: number) => {
    const actualStr = window.prompt(
      `一键校准 ${CAL_CH_NAMES[ch]}\n\n请输入此通道当前的实际值（如万用表测得的电压V）：`,
      ''
    )
    if (actualStr === null) return
    const actual = parseFloat(actualStr)
    if (!isFinite(actual) || actual === 0) {
      setCalibMsg({ type: 'err', text: '输入值不合法' })
      return
    }
    /* 获取当前下位机读数（该读数已经过校准）, 目标: y = actual
       当前显示值 y_cur = gain_cur * x + offset_cur
       令 offset 不变, 新 gain: gain_new = gain_cur * (actual - offset_cur) / (y_cur - offset_cur)
       等价于: gain_new = gain_cur * actual / y_cur  （当 offset=0 时）
       这里保持 offset 不变, 按当前显示值线性缩放 */
    let yCur: number | null = null
    if (ch === 0) {
      /* VOLTAGE: adc.voltage 已经是校准后 V */
      yCur = adc?.voltage ?? null
    } else {
      /* ANALOG1-4: adc.temps[ch-1] 是校准后数值 */
      yCur = adc?.temps?.[ch - 1] ?? null
    }
    if (yCur === null || !isFinite(yCur) || yCur === 0) {
      setCalibMsg({ type: 'err', text: '当前读数无效，无法自动计算' })
      return
    }
    const curGain   = calib?.gains?.[ch]   ?? 1
    const curOffset = calib?.offsets?.[ch] ?? 0
    const newGain   = curGain * (actual - curOffset) / (yCur - curOffset)
    if (!isFinite(newGain)) {
      setCalibMsg({ type: 'err', text: '计算结果无效' })
      return
    }
    try {
      await client.writeCalibChannel(ch, newGain, curOffset)
      setCalibMsg({
        type: 'ok',
        text: `${CAL_CH_NAMES[ch]} 自动校准: gain ${curGain.toFixed(4)} → ${newGain.toFixed(4)}`,
      })
      await loadCalibFromDevice()
    } catch (e: any) {
      setCalibMsg({ type: 'err', text: `写入失败: ${e.message}` })
    }
  }

  const handleCalibSaveFlash = async () => {
    if (!window.confirm('确认将当前校准值写入 MCU Flash？\n写入后掉电不丢失。')) return
    /* 置 busy 标志：停所有轮询，让串口保持静默，避免扰乱下位机 Flash 擦写 */
    flashBusyRef.current = true
    try {
      setCalibMsg({ type: 'info', text: '正在写入 Flash，请勿操作 (1-2 秒)...' })
      await client.saveCalibToFlash()

      /* 静默等 1500ms：下位机擦写 + 重建 Modbus 协议栈的完整窗口 */
      await new Promise(r => setTimeout(r, 1500))

      /* 轮询 CAL_STATUS，最多等 5 秒 */
      const deadline = Date.now() + 5000
      let data: Awaited<ReturnType<typeof loadCalibFromDevice>> = null
      while (Date.now() < deadline) {
        try {
          data = await loadCalibFromDevice()
        } catch {
          /* 重建协议栈瞬间可能仍有一次失败，容忍并继续 */
          await new Promise(r => setTimeout(r, 400))
          continue
        }
        if (data && (data.status === 1 || data.status === 0xFF)) break
        await new Promise(r => setTimeout(r, 400))
      }
      if (data && data.status === 1) {
        setCalibMsg({ type: 'ok', text: '校准值已保存到 Flash' })
      } else if (data && data.status === 0xFF) {
        setCalibMsg({ type: 'err', text: 'Flash 写入失败，请重试' })
      } else {
        setCalibMsg({ type: 'err', text: '保存超时，请检查下位机是否已烧录新固件' })
      }
    } catch (e: any) {
      setCalibMsg({ type: 'err', text: `保存失败: ${e.message}` })
    } finally {
      flashBusyRef.current = false
    }
  }

  const handleCalibReset = async () => {
    if (!window.confirm('将所有通道校准值恢复为默认 (gain=1, offset=0)？\n仅改 RAM，未写 Flash。')) return
    try {
      await client.resetCalibToDefault()
      await new Promise(r => setTimeout(r, 100))
      await loadCalibFromDevice()
      setCalibMsg({ type: 'ok', text: '已恢复默认值（未写 Flash）' })
    } catch (e: any) {
      setCalibMsg({ type: 'err', text: `恢复失败: ${e.message}` })
    }
  }

  const handleServoDrag = (channel: number, value: number) => {
    draggingRef.current = true
    setLocalServos(prev => { const n = [...prev]; n[channel] = value; return n })
  }

  const handleServoCommit = async (channel: number, value: number) => {
    draggingRef.current = false
    try {
      await client.writeSingleRegister(REG.SERVO1 + channel, value)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleServoAngleCommit = async (ch: number, angleStr: string) => {
    setFocusedServoAngle(null)
    const trimmed = angleStr.trim()
    /* Empty input or invalid number: silently discard, show computed angle */
    if (trimmed === '') {
      setServoAngleStr(prev => { const n = [...prev]; n[ch] = ''; return n })
      return
    }
    const angle = parseFloat(trimmed)
    if (!isFinite(angle)) {
      setServoAngleStr(prev => { const n = [...prev]; n[ch] = ''; return n })
      return
    }
    const duty = angleToDuty(angle, servoZeros[ch])
    setLocalServos(prev => { const n = [...prev]; n[ch] = duty; return n })
    setServoAngleStr(prev => { const n = [...prev]; n[ch] = ''; return n })
    try {
      await client.writeSingleRegister(REG.SERVO1 + ch, duty)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleServoDutyInput = async (ch: number, duty: number) => {
    const d = clampDuty(duty)
    setLocalServos(prev => { const n = [...prev]; n[ch] = d; return n })
    try {
      await client.writeSingleRegister(REG.SERVO1 + ch, d)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleServoSetZero = (ch: number) => {
    const currentDuty = localServos[ch]
    const newZeros = [...servoZeros]
    newZeros[ch] = currentDuty
    setServoZeros(newZeros)
    try { localStorage.setItem('servoZeros', JSON.stringify(newZeros)) } catch { /* ignore */ }
  }

  const handleServoResetZero = (ch: number) => {
    const newZeros = [...servoZeros]
    newZeros[ch] = 1500
    setServoZeros(newZeros)
    try { localStorage.setItem('servoZeros', JSON.stringify(newZeros)) } catch { /* ignore */ }
  }

  const handleLedDrag = (channel: number, value: number) => {
    draggingRef.current = true
    setLocalLeds(prev => { const n = [...prev]; n[channel] = value; return n })
  }

  const handleLedCommit = async (channel: number, value: number) => {
    draggingRef.current = false
    try {
      await client.writeSingleRegister(REG.LED1 + channel, value)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleFreqChange = (group: number, field: 'arr' | 'psc', value: number) => {
    setLocalFreq(prev => {
      const n = [...prev]
      n[group] = { ...n[group], [field]: value }
      return n
    })
  }

  const handleFreqCommit = async (group: number) => {
    try {
      const regBase = REG.PWM_ARR_G1 + group * 2
      await client.writeMultipleRegisters(regBase, [localFreq[group].arr, localFreq[group].psc])
    } catch (e: any) {
      setError(e.message)
    }
  }

  const refreshExtIO = useCallback(async () => {
    try {
      const [gpioData, irData] = await Promise.all([
        client.readGPIO(),
        client.readIR(),
      ])
      setGpio(gpioData)
      setIr(irData)
    } catch (e: any) {
      setIoMsg({ type: 'err', text: `读取扩展IO失败: ${e.message}` })
    }
  }, [client])

  const handleGPIOModeChange = async (ch: number, mode: number) => {
    try {
      await client.writeGPIOMode(ch, mode)
      setIoMsg({ type: 'ok', text: `${GPIO_LABELS[ch]} 已切换为${mode ? '输出' : '输入'}模式` })
      await refreshExtIO()
    } catch (e: any) {
      setIoMsg({ type: 'err', text: `GPIO 模式写入失败: ${e.message}` })
    }
  }

  const handleGPIOOutputChange = async (ch: number, value: number) => {
    try {
      await client.writeGPIOOutput(ch, value)
      setIoMsg({ type: 'ok', text: `${GPIO_LABELS[ch]} 输出已设为 ${value ? '高' : '低'} 电平` })
      await refreshExtIO()
    } catch (e: any) {
      setIoMsg({ type: 'err', text: `GPIO 输出写入失败: ${e.message}` })
    }
  }

  const handleIRSend = async () => {
    const addr = parseInt(irTxAddr, 10) || 0
    const cmd = parseInt(irTxData, 10) || 0
    if (addr < 0 || addr > 255 || cmd < 0 || cmd > 255) {
      setIoMsg({ type: 'err', text: '地址和命令必须是 0-255 的整数' })
      return
    }
    try {
      await client.writeIRTx(addr, cmd)
      setIoMsg({ type: 'ok', text: `已发送 NEC: ADDR=0x${addr.toString(16).toUpperCase().padStart(2,'0')} CMD=0x${cmd.toString(16).toUpperCase().padStart(2,'0')}` })
      await refreshExtIO()
    } catch (e: any) {
      setIoMsg({ type: 'err', text: `红外发送失败: ${e.message}` })
    }
  }

  const handleIRPresetSelect = (index: number) => {
    setIrTxPresetIndex(index)
    const preset = IR_PRESETS[index]
    if (preset && preset.name !== '自定义') {
      setIrTxAddr(preset.addr.toString())
      setIrTxAddrHex(preset.addr.toString(16).toUpperCase().padStart(2, '0'))
      setIrTxData(preset.cmd.toString())
      setIrTxCmdHex(preset.cmd.toString(16).toUpperCase().padStart(2, '0'))
    }
  }

  /* Snapshot the latest decoded IR frame to a JSON file on the host. */
  const handleIRSaveRx = () => {
    if (!ir) {
      setIoMsg({ type: 'err', text: '无红外接收数据可保存' })
      return
    }
    const data = {
      timestamp: new Date().toISOString(),
      rxStatus: ir.rxStatus,
      rxStatusText: IR_STATUS_LABELS[ir.rxStatus] ?? `${ir.rxStatus}`,
      rxData: ir.rxData,
      rxDataHex: `0x${ir.rxData.toString(16).toUpperCase().padStart(4, '0')}`,
    }
    const text = JSON.stringify(data, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ir-receive-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setIoMsg({ type: 'ok', text: '红外接收数据已保存到计算机' })
  }

  const handleIRParamsRead = async () => {
    try {
      const params = await client.readIRParams()
      setIrParams(params)
      setIrParamsEdit({
        leadLowLo: params.leadLowLo.toString(),
        leadLowHi: params.leadLowHi.toString(),
        leadHighLo: params.leadHighLo.toString(),
        leadHighHi: params.leadHighHi.toString(),
        bit0Lo: params.bit0Lo.toString(),
        bit0Hi: params.bit0Hi.toString(),
        bit1Lo: params.bit1Lo.toString(),
        bit1Hi: params.bit1Hi.toString(),
      })
      setIrMsg({ type: 'ok', text: '已从下位机读取红外参数' })
    } catch (e: any) {
      setIrMsg({ type: 'err', text: `读取失败: ${e.message}` })
    }
  }

  const handleIRParamsApply = async () => {
    const parseVal = (str: string, def: number) => {
      const v = parseInt(str, 10)
      return Number.isFinite(v) ? v : def
    }
    const params = {
      leadLowLo: parseVal(irParamsEdit.leadLowLo, 8500),
      leadLowHi: parseVal(irParamsEdit.leadLowHi, 9500),
      leadHighLo: parseVal(irParamsEdit.leadHighLo, 4000),
      leadHighHi: parseVal(irParamsEdit.leadHighHi, 5000),
      bit0Lo: parseVal(irParamsEdit.bit0Lo, 400),
      bit0Hi: parseVal(irParamsEdit.bit0Hi, 700),
      bit1Lo: parseVal(irParamsEdit.bit1Lo, 1500),
      bit1Hi: parseVal(irParamsEdit.bit1Hi, 1900),
    }
    try {
      await client.writeIRParams(params)
      setIrParams(params)
      setIrMsg({ type: 'ok', text: '红外参数已应用' })
    } catch (e: any) {
      setIrMsg({ type: 'err', text: `写入失败: ${e.message}` })
    }
  }

  const handleIRParamsReset = () => {
    const defaults = {
      leadLowLo: '8500', leadLowHi: '9500',
      leadHighLo: '4000', leadHighHi: '5000',
      bit0Lo: '400', bit0Hi: '700',
      bit1Lo: '1500', bit1Hi: '1900',
    }
    setIrParamsEdit(defaults)
    setIrMsg({ type: 'info', text: '已恢复默认参数（未写入下位机）' })
  }

  /* ============ Kalman filter handlers ============ */

  const loadKalmanFromDevice = useCallback(async () => {
    try {
      const params = await client.readKalmanParams()
      const qArr = [params.qRoll, params.qPitch, params.qYaw, params.qGyroX, params.qGyroY, params.qGyroZ]
      const rArr = [params.rRoll, params.rPitch, params.rYaw, params.rGyroX, params.rGyroY, params.rGyroZ]
      setKalman({ q: qArr, r: rArr })
      setKalmanQEdit(qArr.map(v => v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')))
      setKalmanREdit(rArr.map(v => v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')))
      return params
    } catch (e: any) {
      setKalmanMsg({ type: 'err', text: `读取失败: ${e.message}` })
      return null
    }
  }, [client])

  const handleKalmanRefresh = async () => {
    setKalmanMsg({ type: 'info', text: '正在读取卡尔曼参数...' })
    const params = await loadKalmanFromDevice()
    if (params) setKalmanMsg({ type: 'ok', text: '已从下位机读取卡尔曼参数' })
  }

  const handleKalmanApply = async () => {
    const parseVal = (str: string, def: number, min: number, max: number) => {
      if (str === '' || str === undefined || str === null) return def
      const v = parseFloat(str)
      if (!isFinite(v) || isNaN(v)) return def
      if (v < min) return min
      if (v > max) return max
      return v
    }
    const newQ: number[] = []
    const newR: number[] = []
    for (let i = 0; i < 6; i++) {
      const q = parseVal(kalmanQEdit[i], 0.001, 0.0001, 1.0)
      const r = parseVal(kalmanREdit[i], 0.1, 0.01, 10.0)
      newQ.push(q)
      newR.push(r)
    }
    try {
      await client.writeKalmanParams({
        qRoll: newQ[0], rRoll: newR[0],
        qPitch: newQ[1], rPitch: newR[1],
        qYaw: newQ[2], rYaw: newR[2],
        qGyroX: newQ[3], rGyroX: newR[3],
        qGyroY: newQ[4], rGyroY: newR[4],
        qGyroZ: newQ[5], rGyroZ: newR[5],
      })
      setKalman({ q: newQ, r: newR })
      // Update edit fields with actual applied values
      setKalmanQEdit(newQ.map(v => v.toFixed(4)))
      setKalmanREdit(newR.map(v => v.toFixed(4)))
      setKalmanMsg({ type: 'ok', text: '卡尔曼参数已应用到下位机' })
    } catch (e: any) {
      setKalmanMsg({ type: 'err', text: `写入失败: ${e.message}` })
    }
  }

  const handleKalmanReset = () => {
    setKalmanQEdit(Array(6).fill('0.001'))
    setKalmanREdit(Array(6).fill('0.1'))
    setKalmanMsg({ type: 'info', text: '已恢复默认参数（未写入下位机）' })
  }

  const handleKalmanFilterReset = async () => {
    if (!window.confirm('确认复位卡尔曼滤波器？\n滤波器状态将重新初始化。')) return
    try {
      await client.resetKalmanFilter()
      setKalmanMsg({ type: 'ok', text: '卡尔曼滤波器已复位' })
    } catch (e: any) {
      setKalmanMsg({ type: 'err', text: `复位失败: ${e.message}` })
    }
  }

  /* ============ Axis mapping handlers ============ */

  const updateAxisConfig = (partial: Partial<AxisMappingConfig>) => {
    const newCfg = { ...axisCfg, ...partial }
    setAxisCfg(newCfg)
    try {
      localStorage.setItem(MOUNT_STORAGE_KEY, JSON.stringify(newCfg))
    } catch { /* ignore */ }
  }

  const calcFreq = (group: number) => {
    const clk = PWM_GROUPS[group].clock
    const { arr, psc } = localFreq[group]
    return clk / (psc + 1) / (arr + 1)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[--border] bg-[--bg-card]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Waves className="w-6 h-6 text-[--accent]" />
            <div>
              <h1 className="text-base font-bold">水下机器人 Modbus 监控</h1>
              <p className="text-xs text-[--fg-muted]">STM32F407 · Slave 0x01 · 9600 8N1</p>
            </div>
          </div>
          {/* Tab Navigation */}
          <nav className="flex items-center gap-1 bg-[--bg-input] rounded-md p-1 overflow-x-auto">
            {([
              { id: 'home',     label: '首页',    icon: <Home className="w-3.5 h-3.5" /> },
              { id: 'attitude', label: '姿态',    icon: <Compass className="w-3.5 h-3.5" /> },
              { id: 'pwm',      label: 'PWM',     icon: <Sliders className="w-3.5 h-3.5" /> },
              { id: 'comp',     label: '补偿',    icon: <Target className="w-3.5 h-3.5" /> },
              { id: 'adc',      label: 'ADC',     icon: <Thermometer className="w-3.5 h-3.5" /> },
              { id: 'baro',     label: '气压计',  icon: <CloudRain className="w-3.5 h-3.5" /> },
              { id: 'gpio',     label: 'GPIO',    icon: <Zap className="w-3.5 h-3.5" /> },
              { id: 'ir',       label: '红外',    icon: <Zap className="w-3.5 h-3.5" /> },
              { id: 'advanced', label: '高级',    icon: <Settings className="w-3.5 h-3.5" />, badge: logs.length },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap relative",
                  view === tab.id
                    ? "bg-[--accent] text-white"
                    : "text-[--fg-secondary] hover:text-[--fg-primary]"
                )}
              >
                {tab.icon} {tab.label}
                {'badge' in tab && tab.badge > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    view === tab.id ? "bg-white/20" : "bg-[--accent]/20 text-[--accent]"
                  )}>
                    {tab.badge > 999 ? '999+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection */}
          <div className="flex items-center gap-2">
            <StatusDot state={connState} />
            <span className="text-xs text-[--fg-secondary]">
              {reconnectInfo
                ? `重连中 ${reconnectInfo.attempt}/${reconnectInfo.max}${reconnectInfo.reason === 'comm-error' ? ' (通讯错误)' : ' (设备断开)'}`
                : stateLabel[connState]}
            </span>
          </div>
          {connState === 'connected' ? (
            <>
              <button onClick={togglePolling}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  polling ? "bg-[--accent] text-white" : "bg-[--bg-input] text-[--fg-secondary] hover:text-[--fg-primary]"
                )}>
                <RefreshCw className={cn("w-3.5 h-3.5", polling && "animate-spin")} />
                {polling ? '停止轮询' : '开始轮询'}
              </button>
              <select value={pollInterval} onChange={e => setPollInterval(Number(e.target.value))}
                className="bg-[--bg-input] text-[--fg-secondary] text-xs rounded px-2 py-1.5 border border-[--border]">
                <option value={200}>200ms</option>
                <option value={500}>500ms</option>
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
              </select>
              <button onClick={pollOnce}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-[--bg-input] text-[--fg-secondary] hover:text-[--fg-primary] transition-colors">
                读取一次
              </button>
              <button onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                <PlugZap className="w-3.5 h-3.5" /> 断开
              </button>
            </>
          ) : (
            <button onClick={handleConnect} disabled={connState === 'connecting'}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs bg-[--accent] text-white hover:brightness-110 disabled:opacity-50 transition-all">
              <Plug className="w-3.5 h-3.5" /> 连接串口
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-xs text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ========= Main content - 6 module pages ========= */}
      {view !== 'advanced' && (
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 max-w-[1600px] mx-auto w-full">
        {/* System Status - home + system */}
        {(view === 'home' || view === 'system') && (
          <SystemCard system={system} expanded={view === 'system'} />
        )}

        {/* Attitude data + 3D model - home + attitude */}
        {(view === 'home' || view === 'attitude') && (
        <Card title="姿态数据 (MS901M)" icon={<Activity className="w-4 h-4 text-emerald-400" />} className="col-span-12 lg:col-span-5">
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Metric label="Roll 横滚" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.roll) : '--'} unit="°" color="text-sky-400" />
            <Metric label="Pitch 俯仰" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.pitch) : '--'} unit="°" color="text-emerald-400" />
            <Metric label="Yaw 航向" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.yaw) : '--'} unit="°" color="text-amber-400" />
            <Metric label="Gyro X" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.gyroX) : '--'} unit="°/s" />
            <Metric label="Gyro Y" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.gyroY) : '--'} unit="°/s" />
            <Metric label="Gyro Z" value={calibratedAttitudeWithMount ? fmtFloat(calibratedAttitudeWithMount.gyroZ) : '--'} unit="°/s" />
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[--border]">
            <button onClick={handleZeroCalibrate} disabled={!attitude}
              className="px-3 py-1 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors">
              零点校准
            </button>
            {attOffset && (
              <button onClick={handleClearCalibrate}
                className="px-3 py-1 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                清除校准
              </button>
            )}
            {attOffset && (
              <span className="text-[10px] text-[--fg-muted] ml-auto">已校准</span>
            )}
          </div>
        </Card>
        )}

        {/* Magnetometer (MS901M) - home + attitude */}
        {(view === 'home' || view === 'attitude') && (
          <MagnetometerCard mag={mag} expanded={view === 'attitude'} />
        )}

        {/* 3D Attitude Model - attitude only */}
        {view === 'attitude' && (
        <Card title="姿态可视化" icon={<Activity className="w-4 h-4 text-sky-400" />} className="col-span-12 lg:col-span-4">
          <AttitudeModel
            roll={calibratedAttitudeWithMount?.roll ?? 0}
            pitch={calibratedAttitudeWithMount?.pitch ?? 0}
            yaw={calibratedAttitudeWithMount?.yaw ?? 0}
          />
        </Card>
        )}

        {/* Custom Axis Mapping - attitude only */}
        {view === 'attitude' && (
        <Card title="传感器安装方向" icon={<Compass className="w-4 h-4 text-violet-400" />} className="col-span-12">
          <div className="space-y-3">
            <div className="rounded bg-violet-500/10 border border-violet-500/20 px-3 py-2 text-xs text-violet-300 leading-relaxed">
              为每个物理轴选择传感器轴来源、方向和偏移角度。解决俯仰角和横滚角互换的问题。设置保存在浏览器中。
            </div>

            {/* 3 physical axes: Roll, Pitch, Yaw */}
            {PHYSICAL_AXES.map((axis) => {
              const sourceKey = `${axis.key}Source` as keyof AxisMappingConfig
              const signKey = `${axis.key}Sign` as keyof AxisMappingConfig
              const offsetKey = `${axis.key}Offset` as keyof AxisMappingConfig
              const source = axisCfg[sourceKey] as 0 | 1 | 2
              const sign = axisCfg[signKey] as 1 | -1
              const offset = axisCfg[offsetKey] as number

              return (
                <div key={axis.key} className="bg-[--bg-input] rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${axis.color}`}>{axis.label}</span>
                    <span className="text-[10px] text-[--fg-muted]">→ 传感器轴:</span>
                    {/* Source selector */}
                    <div className="flex gap-1">
                      {([0, 1, 2] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateAxisConfig({ [sourceKey]: s } as Partial<AxisMappingConfig>)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                            source === s
                              ? `bg-${axis.accent}-500/30 text-${axis.accent}-300 border border-${axis.accent}-500/50`
                              : "bg-[--bg-card] text-[--fg-muted] hover:text-[--fg-primary]"
                          )}
                        >{SENSOR_AXIS_NAMES[s]}</button>
                      ))}
                    </div>
                    {/* Sign toggle */}
                    <button
                      onClick={() => updateAxisConfig({ [signKey]: (sign * -1) as 1 | -1 } as Partial<AxisMappingConfig>)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                        sign === 1
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-red-500/20 text-red-400 border border-red-500/40"
                      )}
                    >{sign === 1 ? '+ 正向' : '- 反向'}</button>
                  </div>
                  {/* Offset input */}
                  <div className="flex items-center gap-2 ml-1">
                    <span className="text-[10px] text-[--fg-muted]">偏移角度:</span>
                    <input
                      type="number"
                      value={offset}
                      onChange={(e) => updateAxisConfig({ [offsetKey]: parseFloat(e.target.value) || 0 } as Partial<AxisMappingConfig>)}
                      className="w-16 bg-[--bg-card] border border-[--border] rounded px-1.5 py-0.5 text-xs font-mono text-[--fg-primary] focus:outline-none focus:border-violet-400/50"
                    />
                    <span className="text-[10px] text-[--fg-muted]">°</span>
                    <span className="text-[10px] text-[--fg-muted] ml-auto font-mono">
                      = {sign > 0 ? '' : '-'}{SENSOR_AXIS_NAMES[source]}{offset !== 0 ? ` ${offset > 0 ? '+' : ''}${offset}°` : ''}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-[--border]">
              <button onClick={() => updateAxisConfig(DEFAULT_AXIS_CONFIG)}
                className="px-3 py-1 rounded text-[11px] font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors">
                恢复默认</button>
            </div>
          </div>
        </Card>
        )}

        {/* Kalman Filter Parameters - attitude only */}
        {view === 'attitude' && (
        <Card title="卡尔曼滤波参数" icon={<Sliders className="w-4 h-4 text-cyan-400" />} className="col-span-12">
          <div className="space-y-3">
            <div className="rounded bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-xs text-cyan-300 leading-relaxed">
              调整 Q (过程噪声) 和 R (测量噪声) 参数，实时控制滤波效果。Q↑ → 响应变快，平滑度↓；R↑ → 响应变慢，平滑度↑。
            </div>

            {kalmanMsg && (
              <div className={cn(
                "px-2 py-1 rounded text-[11px] font-mono",
                kalmanMsg.type === 'ok' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                kalmanMsg.type === 'err' && "bg-red-500/15 text-red-400 border border-red-500/30",
                kalmanMsg.type === 'info' && "bg-sky-500/15 text-sky-400 border border-sky-500/30",
              )}>{kalmanMsg.text}</div>
            )}

            {/* Channel selector tabs */}
            <div className="flex flex-wrap gap-1">
              {KALMAN_CH_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setKalmanChan(i)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                    kalmanChan === i
                      ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                      : "bg-[--bg-input] text-[--fg-muted] hover:text-[--fg-primary]"
                  )}
                >{name}</button>
              ))}
            </div>

            {/* Selected channel controls */}
            <div className="bg-[--bg-input] rounded-lg p-4">
              <div className="text-sm font-semibold text-[--fg-primary] mb-3">{KALMAN_CH_NAMES[kalmanChan]}</div>
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* Q slider */}
                <div className="col-span-5">
                  <div className="text-[10px] text-[--fg-muted] uppercase mb-1.5">过程噪声 Q</div>
                  <input type="range" min="-4" max="0" step="0.01"
                    value={Math.log10(parseFloat(kalmanQEdit[kalmanChan]) || 0.001)}
                    onChange={e => {
                      const v = Math.pow(10, parseFloat(e.target.value))
                      setKalmanQEdit(prev => { const n = [...prev]; n[kalmanChan] = v.toFixed(4); return n })
                    }}
                    className="w-full accent-cyan-400" />
                  <div className="flex items-center gap-1 mt-1">
                    <input type="text" value={kalmanQEdit[kalmanChan]}
                      onChange={e => setKalmanQEdit(prev => { const n = [...prev]; n[kalmanChan] = e.target.value; return n })}
                      className="w-20 bg-[--bg-card] border border-[--border] rounded px-2 py-0.5 text-xs font-mono text-[--fg-primary] focus:outline-none focus:border-cyan-400/50" />
                    <span className="text-[10px] text-[--fg-muted]">范围 0.0001-1.0</span>
                  </div>
                </div>
                {/* R slider */}
                <div className="col-span-5">
                  <div className="text-[10px] text-[--fg-muted] uppercase mb-1.5">测量噪声 R</div>
                  <input type="range" min="-2" max="1" step="0.01"
                    value={Math.log10(parseFloat(kalmanREdit[kalmanChan]) || 0.1)}
                    onChange={e => {
                      const v = Math.pow(10, parseFloat(e.target.value))
                      setKalmanREdit(prev => { const n = [...prev]; n[kalmanChan] = v.toFixed(4); return n })
                    }}
                    className="w-full accent-cyan-400" />
                  <div className="flex items-center gap-1 mt-1">
                    <input type="text" value={kalmanREdit[kalmanChan]}
                      onChange={e => setKalmanREdit(prev => { const n = [...prev]; n[kalmanChan] = e.target.value; return n })}
                      className="w-20 bg-[--bg-card] border border-[--border] rounded px-2 py-0.5 text-xs font-mono text-[--fg-primary] focus:outline-none focus:border-cyan-400/50" />
                    <span className="text-[10px] text-[--fg-muted]">范围 0.01-10.0</span>
                  </div>
                </div>
                {/* Preset buttons */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <button onClick={() => { setKalmanQEdit(prev => { const n = [...prev]; n[kalmanChan] = '0.0001'; return n }); setKalmanREdit(prev => { const n = [...prev]; n[kalmanChan] = '0.5'; return n }) }}
                    className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors">静态模式</button>
                  <button onClick={() => { setKalmanQEdit(prev => { const n = [...prev]; n[kalmanChan] = '0.001'; return n }); setKalmanREdit(prev => { const n = [...prev]; n[kalmanChan] = '0.1'; return n }) }}
                    className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">稳定模式</button>
                  <button onClick={() => { setKalmanQEdit(prev => { const n = [...prev]; n[kalmanChan] = '0.01'; return n }); setKalmanREdit(prev => { const n = [...prev]; n[kalmanChan] = '0.05'; return n }) }}
                    className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">动态模式</button>
                </div>
              </div>
            </div>

            {/* All channels overview table */}
            <div className="grid grid-cols-[80px_1fr_1fr_72px] gap-1 items-center text-[10px] text-[--fg-muted] uppercase px-1">
              <div>通道</div>
              <div>Q 值</div>
              <div>R 值</div>
              <div className="text-right">效果</div>
            </div>
            {KALMAN_CH_NAMES.map((name, ch) => {
              const qVal = parseFloat(kalmanQEdit[ch]) || 0.001
              const rVal = parseFloat(kalmanREdit[ch]) || 0.1
              return (
                <div key={ch} className="grid grid-cols-[80px_1fr_1fr_72px] gap-1 items-center rounded bg-[--bg-input]/40 px-2 py-1.5">
                  <div className="text-xs font-semibold text-[--fg-primary]">{name}</div>
                  <div className="text-xs font-mono text-cyan-400">{qVal.toFixed(4)}</div>
                  <div className="text-xs font-mono text-emerald-400">{rVal.toFixed(4)}</div>
                  <div className="text-[10px] text-[--fg-muted] text-right">
                    {qVal > 0.01 ? '快响应' : qVal < 0.0005 ? '极平滑' : '平衡'}
                  </div>
                </div>
              )
            })}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[--border]">
              <button onClick={handleKalmanRefresh} disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" />从下位机读取</button>
              <button onClick={handleKalmanApply} disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40 transition-colors">
                应用参数</button>
              <button onClick={handleKalmanReset}
                className="px-3 py-1 rounded text-[11px] font-medium bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors">
                恢复默认</button>
              <button onClick={handleKalmanFilterReset} disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-colors">
                复位滤波器</button>
            </div>
          </div>
        </Card>
        )}

        {/* ADC Raw Data - home + adc */}
        {(view === 'home' || view === 'adc') && (
        <Card title="ADC 数据" icon={<Thermometer className="w-4 h-4 text-orange-400" />} className="col-span-12 lg:col-span-3">
          <div className="space-y-3">
            {/* ADC Raw channels 0-3 */}
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-[--bg-input] rounded px-3 py-2">
                  <div className="text-[10px] text-[--fg-muted] uppercase">ADC CH{i}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-mono font-bold text-[--fg-primary]">
                      {adc ? adc.adcRaw[i] : '--'}
                    </span>
                    <span className="text-[10px] text-[--fg-muted]">/4095</span>
                  </div>
                  {/* Mini bar */}
                  {adc && (
                    <div className="mt-1 h-1 bg-[--border] rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400/60 rounded-full transition-all" style={{ width: `${(adc.adcRaw[i] / 4095) * 100}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Voltage (ADC CH4 converted) */}
            <div className="bg-[--bg-input] rounded px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[--fg-muted] uppercase flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 电压 (CH4)
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-mono font-bold text-[--fg-primary]">
                    {adc ? adc.voltage.toFixed(1) : '--'}
                  </span>
                  <span className="text-xs text-[--fg-muted]">V</span>
                </div>
              </div>
              {adc && (
                <div className="text-[10px] text-[--fg-muted] font-mono">
                  RAW: {adc.adcRaw[4]}
                </div>
              )}
            </div>
          </div>
        </Card>
        )}

        {/* ADC Calibration Panel - adc only */}
        {view === 'adc' && (
        <Card title="ADC 校准" icon={<Settings className="w-4 h-4 text-purple-400" />} className="col-span-12 lg:col-span-6">
          <div className="space-y-2">
            {/* Message bar */}
            {calibMsg && (
              <div className={cn(
                "px-2 py-1 rounded text-[11px] font-mono",
                calibMsg.type === 'ok' && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                calibMsg.type === 'err' && "bg-red-500/15 text-red-400 border border-red-500/30",
                calibMsg.type === 'info' && "bg-sky-500/15 text-sky-400 border border-sky-500/30",
              )}>{calibMsg.text}</div>
            )}

            {/* Table header */}
            <div className="grid grid-cols-[80px_1fr_1fr_72px_52px] gap-1 items-center text-[10px] text-[--fg-muted] uppercase px-1">
              <div>通道</div>
              <div>增益 Gain</div>
              <div>偏移 Offset</div>
              <div className="text-right">应用</div>
              <div className="text-right">一键</div>
            </div>

            {/* Per-channel rows */}
            {CAL_CH_NAMES.map((name, ch) => {
              const currentReading = ch === 0
                ? (adc ? `${adc.voltage.toFixed(3)} V` : '--')
                : (adc ? `${adc.temps[ch - 1]?.toFixed(1) ?? '--'}` : '--')
              return (
                <div key={ch} className="grid grid-cols-[80px_1fr_1fr_72px_52px] gap-1 items-center">
                  <div className="text-xs">
                    <div className="font-semibold text-[--fg-primary]">{name}</div>
                    <div className="text-[10px] text-[--fg-muted] font-mono">{currentReading}</div>
                  </div>
                  <input
                    type="text"
                    value={calibEdit.gains[ch]}
                    onChange={e => setCalibEdit(prev => {
                      const n = [...prev.gains]; n[ch] = e.target.value; return { ...prev, gains: n }
                    })}
                    className="bg-[--bg-input] border border-[--border] rounded px-2 py-1 text-xs font-mono text-[--fg-primary] focus:outline-none focus:border-purple-400/50"
                    placeholder="1.0"
                  />
                  <input
                    type="text"
                    value={calibEdit.offsets[ch]}
                    onChange={e => setCalibEdit(prev => {
                      const n = [...prev.offsets]; n[ch] = e.target.value; return { ...prev, offsets: n }
                    })}
                    className="bg-[--bg-input] border border-[--border] rounded px-2 py-1 text-xs font-mono text-[--fg-primary] focus:outline-none focus:border-purple-400/50"
                    placeholder="0.0"
                  />
                  <button
                    onClick={() => handleCalibApplyChannel(ch)}
                    disabled={connState !== 'connected'}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-40 transition-colors"
                  >应用</button>
                  <button
                    onClick={() => handleCalibAuto(ch)}
                    disabled={connState !== 'connected' || !adc}
                    title={`输入 ${name} 的实际值，自动反算 gain`}
                    className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-colors"
                  >校准</button>
                </div>
              )
            })}

            {/* Global action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[--border]">
              <button
                onClick={handleCalibRefresh}
                disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 disabled:opacity-40 flex items-center gap-1 transition-colors"
              ><RefreshCw className="w-3 h-3" />从下位机读取</button>
              <button
                onClick={handleCalibSaveFlash}
                disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
              >保存到 Flash</button>
              <button
                onClick={handleCalibReset}
                disabled={connState !== 'connected'}
                className="px-3 py-1 rounded text-[11px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
              >恢复默认</button>
              {calib && (
                <span className="ml-auto text-[10px] text-[--fg-muted] font-mono">
                  Flash状态: {calib.status === 1 ? '已保存' : calib.status === 0xFF ? '错误' : '未保存'}
                </span>
              )}
            </div>

            {/* Hint */}
            <div className="text-[10px] text-[--fg-muted] pt-1 leading-relaxed">
              公式: <span className="font-mono">y = gain × x + offset</span>  ·  校准值需点“保存到 Flash”才能掉电保留
            </div>
          </div>
        </Card>
        )}

        {/* Barometer Data (MS901M) - home + baro */}
        {(view === 'home' || view === 'baro') && (
          <BarometerCard baro={baro} />
        )}

        {/* Servo Control - pwm only (with angle + zero-point) */}
        {view === 'pwm' && (
        <Card title="舵机控制 (CH1-CH8)" icon={<Target className="w-4 h-4 text-violet-400" />} className="col-span-12">
          <div className="space-y-2">
            {/* Header row */}
            <div className="grid grid-cols-[56px_1fr_96px_96px_110px] items-center gap-3 px-2 text-[10px] text-[--fg-muted] uppercase">
              <div>通道</div>
              <div>滑块（脉宽 μs）</div>
              <div className="text-center">占空比</div>
              <div className="text-center">角度</div>
              <div className="text-center">零点</div>
            </div>
            {Array.from({ length: 8 }, (_, ch) => {
              const duty = localServos[ch]
              const zero = servoZeros[ch]
              const angle = dutyToAngle(duty, zero)
              const isEditing = focusedServoAngle === ch
              /* While editing, show user's raw input (including empty string);
                 when not editing, show computed angle */
              const angleDisplay = isEditing ? servoAngleStr[ch] : angle.toFixed(1)
              return (
                <div key={ch} className="grid grid-cols-[56px_1fr_96px_96px_110px] items-center gap-3 py-1.5 px-2 rounded bg-[--bg-input]/40">
                  <span className="text-xs font-mono font-semibold text-violet-400">CH{ch + 1}</span>
                  {/* 滑块 */}
                  <input
                    type="range" min={500} max={2500} step={10}
                    value={duty}
                    onChange={e => handleServoDrag(ch, Number(e.target.value))}
                    onPointerUp={e => handleServoCommit(ch, Number((e.target as HTMLInputElement).value))}
                    disabled={connState !== 'connected'}
                    className="w-full"
                  />
                  {/* 占空比输入 */}
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={500} max={2500} step={10}
                      value={duty}
                      onChange={e => handleServoDutyInput(ch, Number(e.target.value))}
                      disabled={connState !== 'connected'}
                      className="w-16 bg-[--bg-card] border border-[--border] rounded px-1.5 py-0.5 text-xs font-mono text-violet-400 focus:outline-none focus:border-violet-400/60"
                    />
                    <span className="text-[10px] text-[--fg-muted]">μs</span>
                  </div>
                  {/* 角度输入 */}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={angleDisplay}
                      onFocus={() => {
                        setFocusedServoAngle(ch)
                        setServoAngleStr(prev => { const n = [...prev]; n[ch] = angle.toFixed(1); return n })
                      }}
                      onChange={e => setServoAngleStr(prev => { const n = [...prev]; n[ch] = e.target.value; return n })}
                      onBlur={e => handleServoAngleCommit(ch, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      disabled={connState !== 'connected'}
                      className="w-20 bg-[--bg-card] border border-[--border] rounded px-2 py-1 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-400/60"
                    />
                    <span className="text-[10px] text-[--fg-muted]">°</span>
                  </div>
                  {/* 零点按钮 */}
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => handleServoSetZero(ch)}
                      disabled={connState !== 'connected'}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition-colors"
                      title={`把当前位置 ${duty}μs 设为该舵机的 0° 基准`}
                    >设0°</button>
                    <button
                      onClick={() => handleServoResetZero(ch)}
                      className="px-1.5 py-0.5 rounded text-[10px] text-[--fg-muted] hover:text-[--fg-primary]"
                      title={`零点复位到 1500μs（当前零点 ${zero}μs）`}
                    >复位</button>
                    <span className="text-[10px] text-[--fg-muted] font-mono w-10 text-right" title="当前零点脉宽">{zero}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-[--border] text-[10px] text-[--fg-muted] leading-relaxed">
            脉宽范围 500-2500 μs · 角度换算 <span className="font-mono">angle = (duty − zero) × 90 / 1000</span> · <span className="text-emerald-400">"设0°"</span> 把当前位置记为该舵机的 0 度基准（仅保存在浏览器 localStorage）
          </div>
        </Card>
        )}

        {/* LED Dimming - pwm only */}
        {view === 'pwm' && (
        <Card title="LED 调光" icon={<Zap className="w-4 h-4 text-amber-400" />} className="col-span-12 lg:col-span-6">
          <div className="space-y-2">
            {[0, 1].map(li => (
              <div key={`led${li}`} className="flex items-center gap-3 p-2 rounded bg-[--bg-input]/40">
                <span className="text-xs font-mono font-semibold text-amber-400 w-10 shrink-0">LED{li + 1}</span>
                <input
                  type="range" min={0} max={1000} step={10}
                  value={localLeds[li]}
                  onChange={e => handleLedDrag(li, Number(e.target.value))}
                  onPointerUp={e => handleLedCommit(li, Number((e.target as HTMLInputElement).value))}
                  disabled={connState !== 'connected'}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-amber-400 w-16 text-right shrink-0">{localLeds[li]} / 1000</span>
                <span className="text-[10px] text-[--fg-muted] w-12 text-right">{(localLeds[li] / 10).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[--border] text-[10px] text-[--fg-muted]">占空比 0-1000 对应 0-100% 亮度</div>
        </Card>
        )}

        {/* PWM Frequency Config - pwm only (moved from advanced) */}
        {view === 'pwm' && (
        <Card title="PWM 频率配置 (按定时器分组)" icon={<Sliders className="w-4 h-4 text-violet-400" />} className="col-span-12 lg:col-span-6">
          <div className="grid grid-cols-1 gap-3">
            {PWM_GROUPS.map((g, gi) => {
              const freq = calcFreq(gi)
              const isLed = 'isLed' in g && g.isLed
              return (
                <div key={gi} className="bg-[--bg-input] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[--fg-primary]">{g.label}</span>
                      <span className="text-[10px] text-[--fg-muted]">
                        {isLed ? 'LED1-2' : g.chLabels.join(',')} · {(g.clock / 1e6).toFixed(0)}MHz
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-violet-400">
                      {freq >= 1000 ? `${(freq / 1000).toFixed(2)} kHz` : `${freq.toFixed(2)} Hz`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[--fg-muted]">ARR</label>
                    <input type="number" min={0} max={65535} value={localFreq[gi].arr}
                      onChange={e => handleFreqChange(gi, 'arr', Number(e.target.value))}
                      disabled={connState !== 'connected'}
                      className="w-20 bg-[--bg-card] border border-[--border] rounded px-1.5 py-0.5 text-xs font-mono text-[--fg-primary]" />
                    <label className="text-[10px] text-[--fg-muted] ml-1">PSC</label>
                    <input type="number" min={0} max={65535} value={localFreq[gi].psc}
                      onChange={e => handleFreqChange(gi, 'psc', Number(e.target.value))}
                      disabled={connState !== 'connected'}
                      className="w-20 bg-[--bg-card] border border-[--border] rounded px-1.5 py-0.5 text-xs font-mono text-[--fg-primary]" />
                    <button onClick={() => handleFreqCommit(gi)} disabled={connState !== 'connected'}
                      className="ml-auto px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 transition-colors">
                      写入
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-[10px] text-[--fg-muted] font-mono">freq = TIM_CLK / (PSC+1) / (ARR+1)</div>
        </Card>
        )}

        {view === 'comp' && (
          <ServoCompensationPage client={client} />
        )}

        {view === 'gpio' && (
          <GPIOCard
            gpio={gpio}
            connected={connState === 'connected'}
            ioMsg={ioMsg}
            onModeChange={handleGPIOModeChange}
            onOutputChange={handleGPIOOutputChange}
            onRefresh={refreshExtIO}
          />
        )}

        {view === 'ir' && (
          <IRPanel
            ir={ir}
            connected={connState === 'connected'}
            irTxAddr={irTxAddr}
            setIrTxAddr={setIrTxAddr}
            irTxAddrHex={irTxAddrHex}
            setIrTxAddrHex={setIrTxAddrHex}
            irTxData={irTxData}
            setIrTxData={setIrTxData}
            irTxCmdHex={irTxCmdHex}
            setIrTxCmdHex={setIrTxCmdHex}
            irTxPresetIndex={irTxPresetIndex}
            setIrTxPresetIndex={setIrTxPresetIndex}
            onPresetSelect={handleIRPresetSelect}
            onSend={handleIRSend}
            onRefresh={refreshExtIO}
            onSaveRx={handleIRSaveRx}
            irParamsEdit={irParamsEdit}
            setIrParamsEdit={setIrParamsEdit}
            irMsg={irMsg}
            onParamsRead={handleIRParamsRead}
            onParamsApply={handleIRParamsApply}
            onParamsReset={handleIRParamsReset}
          />
        )}
        </main>
        )}

      {/* Main content - Advanced Settings View (Registers + Logs) */}
      {view === 'advanced' && (
        <main className="flex-1 p-4 grid grid-cols-12 gap-4 max-w-[1600px] mx-auto w-full">
          {/* Register Map Quick Reference */}
          <Card title="Modbus 寄存器速查" icon={<Gauge className="w-4 h-4 text-[--fg-muted]" />} className="col-span-12">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[--fg-muted] border-b border-[--border]">
                    <th className="text-left py-1.5 px-2 font-medium">地址</th>
                    <th className="text-left py-1.5 px-2 font-medium">名称</th>
                    <th className="text-left py-1.5 px-2 font-medium">类型</th>
                    <th className="text-left py-1.5 px-2 font-medium">权限</th>
                    <th className="text-left py-1.5 px-2 font-medium">当前值</th>
                  </tr>
                </thead>
                <tbody className="text-[--fg-secondary] font-mono">
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0000</td><td className="px-2">DEVICE_ID</td><td className="px-2">uint16</td><td className="px-2">R</td><td className="px-2">{system ? `0x${system.deviceId.toString(16).toUpperCase().padStart(4, '0')}` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0001</td><td className="px-2">FW_VERSION</td><td className="px-2">uint16</td><td className="px-2">R</td><td className="px-2">{system ? `V${system.fwVersion >> 8}.${system.fwVersion & 0xff}` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0002</td><td className="px-2">RUN_MODE</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{system?.runMode ?? '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0010</td><td className="px-2">ROLL</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.roll.toFixed(3) : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0012</td><td className="px-2">PITCH</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.pitch.toFixed(3) : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0014</td><td className="px-2">YAW</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.yaw.toFixed(3) : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0016</td><td className="px-2">GYRO_X</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.gyroX.toFixed(3) : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0018</td><td className="px-2">GYRO_Y</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.gyroY.toFixed(3) : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x001A</td><td className="px-2">GYRO_Z</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.gyroZ.toFixed(3) : '--'}</td></tr>
                  {Array.from({ length: 8 }, (_, i) => (
                    <tr key={`servo${i}`} className="border-b border-[--border]/50"><td className="py-1 px-2">0x{(0x0020 + i).toString(16).toUpperCase().padStart(4, '0')}</td><td className="px-2">SERVO{i + 1}</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{pwm?.servos[i] ?? '--'}</td></tr>
                  ))}
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0028</td><td className="px-2">LED1</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{pwm?.leds[0] ?? '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0029</td><td className="px-2">LED2</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{pwm?.leds[1] ?? '--'}</td></tr>
                  {Array.from({ length: 4 }, (_, i) => (
                    <tr key={`analog${i}`} className="border-b border-[--border]/50"><td className="py-1 px-2">0x{(0x0030 + i).toString(16).toUpperCase().padStart(4, '0')}</td><td className="px-2">ANALOG{i + 1}</td><td className="px-2">uint16</td><td className="px-2">R</td><td className="px-2">{adc?.temps[i]?.toFixed(1) ?? '--'}</td></tr>
                  ))}
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0034</td><td className="px-2">VOLTAGE</td><td className="px-2">×100 V</td><td className="px-2">R</td><td className="px-2">{adc ? `${adc.voltage.toFixed(2)} V` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0040-47</td><td className="px-2">PWM_ARR/PSC G1-G4</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">ARR/PSC ×4 组</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0048</td><td className="px-2">PRESSURE</td><td className="px-2">int32 Pa</td><td className="px-2">R</td><td className="px-2">{baro ? `${baro.pressure} Pa` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x004A</td><td className="px-2">ALTITUDE</td><td className="px-2">int32 cm</td><td className="px-2">R</td><td className="px-2">{baro ? `${baro.altitude} cm` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x004C</td><td className="px-2">BARO_TEMP</td><td className="px-2">float ℃</td><td className="px-2">R</td><td className="px-2">{baro ? `${baro.temperature.toFixed(2)} ℃` : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0066-0x0069</td><td className="px-2">GPIO_MODE0-3</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{gpio ? gpio.modes.join(', ') : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x006A-0x006D</td><td className="px-2">GPIO_OUT0-3</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{gpio ? gpio.outputs.join(', ') : '--'}</td></tr>
                  <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x006E-0x0071</td><td className="px-2">GPIO_IN0-3</td><td className="px-2">uint16</td><td className="px-2">R</td><td className="px-2">{gpio ? gpio.inputs.join(', ') : '--'}</td></tr>
                  <tr><td className="py-1 px-2">0x0072-0x0075</td><td className="px-2">IR_TX/IR_RX</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{ir ? `${ir.txCmd}/${ir.txData}/${ir.rxStatus}/${ir.rxData}` : '--'}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      )}

      {/* Main content - Logs (shown under Advanced view) */}
      {view === 'advanced' && (
        <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full flex flex-col min-h-0 pt-0">
          <Card title={`通信日志 (共 ${logs.length} 条)`} icon={<FileText className="w-4 h-4 text-[--accent]" />} className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[--border]">
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-[--fg-muted]">TX 发送</span>
                  <span className="font-mono text-sky-400">{logs.filter(l => l.dir === 'TX').length}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[--fg-muted]">RX 接收</span>
                  <span className="font-mono text-emerald-400">{logs.filter(l => l.dir === 'RX').length}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[--fg-muted]">ERR 错误</span>
                  <span className="font-mono text-red-400">{logs.filter(l => l.dir !== 'TX' && l.dir !== 'RX').length}</span>
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    const text = logs.map(l => `[${l.time}] ${l.dir}  ${l.data}`).join('\n')
                    const blob = new Blob([text], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `modbus-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  disabled={logs.length === 0}
                  className="px-3 py-1.5 rounded text-xs bg-[--bg-input] text-[--fg-secondary] hover:text-[--fg-primary] disabled:opacity-40 transition-colors"
                >导出 .txt</button>
                <button
                  onClick={() => { client.clearLog(); setLogs([]) }}
                  disabled={logs.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 清空
                </button>
              </div>
            </div>
            {/* Log content */}
            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 min-h-[400px]">
              {logs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[--fg-muted] text-sm">
                  暂无通信日志，连接串口后开始轮询即可产生日志
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3 px-2 py-1 hover:bg-[--bg-input]/50 rounded">
                    <span className="text-[--fg-muted] shrink-0 w-20">{log.time}</span>
                    <span className={cn(
                      "shrink-0 w-10 font-bold",
                      log.dir === 'TX' ? 'text-sky-400' : log.dir === 'RX' ? 'text-emerald-400' : 'text-red-400'
                    )}>{log.dir}</span>
                    <span className="text-[--fg-secondary] break-all flex-1">{log.data}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </main>
      )}
    </div>
  )
}
