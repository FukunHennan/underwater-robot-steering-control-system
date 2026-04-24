import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Waves, Plug, PlugZap, RefreshCw, Activity, Thermometer, CloudRain,
  Gauge, Sliders, Cpu, AlertTriangle, Zap, FileText, LayoutDashboard, Trash2, Settings,
  Home, Compass, Target
} from 'lucide-react'
import { ModbusClient, type ConnectionState, type ModbusLog, type ReconnectInfo, REG, CAL_CH_NAMES } from './lib/modbus'

// ======================== Types ========================

interface SystemData {
  deviceId: number; fwVersion: number; runMode: number;
  faultCode: number; sysTick: number;
}
interface AttitudeData {
  roll: number; pitch: number; yaw: number;
  gyroX: number; gyroY: number; gyroZ: number;
}
interface PwmData { servos: number[]; leds: number[] }
interface PwmFreqGroup { arr: number; psc: number }
interface PwmFreqData { groups: PwmFreqGroup[] }
interface AdcData { temps: number[]; voltage: number; adcRaw: number[] }
interface BarometerData { pressure: number; altitude: number; temperature: number }
interface CalibData { gains: number[]; offsets: number[]; status: number }

const PWM_GROUPS = [
  { label: 'TIM4', clock: 84_000_000, channels: [0, 1, 2, 3], chLabels: ['CH1', 'CH2', 'CH3', 'CH4'] },
  { label: 'TIM8', clock: 168_000_000, channels: [4, 5], chLabels: ['CH5', 'CH6'] },
  { label: 'TIM3', clock: 84_000_000, channels: [6, 7], chLabels: ['CH7', 'CH8'] },
  { label: 'TIM1', clock: 168_000_000, channels: [] as number[], chLabels: [] as string[], isLed: true, ledChannels: [0, 1], ledLabels: ['LED1', 'LED2'] },
] as const

// ======================== Helpers ========================

const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

/* Servo duty (500-2500μs) ↔ angle (°) with custom zero point.
   Standard servo: 500μs=0°, 1500μs=90°, 2500μs=180° → 1000μs per 90° */
const SERVO_US_PER_DEG = 1000 / 90
const clampDuty = (d: number) => Math.max(500, Math.min(2500, Math.round(d)))
const dutyToAngle = (duty: number, zero: number) => (duty - zero) / SERVO_US_PER_DEG
const angleToDuty = (angle: number, zero: number) => clampDuty(zero + angle * SERVO_US_PER_DEG)

function Card({ title, icon, children, className }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-[--border] bg-[--bg-card] overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[--border]">
        {icon}
        <h2 className="text-base font-semibold text-[--fg-primary]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Metric({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[--fg-muted] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-mono font-bold", color || "text-[--fg-primary]")}>
          {value}
        </span>
        {unit && <span className="text-sm text-[--fg-muted]">{unit}</span>}
      </div>
    </div>
  )
}

function StatusDot({ state }: { state: ConnectionState }) {
  const colors: Record<ConnectionState, string> = {
    connected: 'bg-[--success]',
    connecting: 'bg-[--warning] animate-pulse',
    disconnected: 'bg-[--fg-muted]',
    error: 'bg-[--danger]',
  }
  return <span className={cn("inline-block w-2 h-2 rounded-full", colors[state])} />
}

const stateLabel: Record<ConnectionState, string> = {
  connected: '已连接', connecting: '连接中...', disconnected: '未连接', error: '错误',
}

const modeLabels = ['待机', '手动', '自动']

// ======================== 3D Attitude Visualization ========================

function AttitudeModel({ roll, pitch, yaw }: { roll: number; pitch: number; yaw: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* 3D viewport */}
      <div className="relative w-full h-72" style={{ perspective: '800px' }}>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateZ(${-roll}deg) rotateX(${pitch}deg) rotateY(${-yaw}deg)`,
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Submarine body - top */}
          <div className="absolute w-36 h-20 rounded-lg border-2 border-sky-500/60 bg-sky-500/10"
            style={{ transform: 'translateZ(16px)' }}>
            <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-sky-400/80">TOP</div>
            {/* Forward indicator */}
            <div className="absolute top-1/2 -translate-y-1/2 right-2 w-0 h-0"
              style={{ borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid rgba(56,189,248,0.6)' }} />
            {/* Center cross */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3">
              <div className="absolute top-1/2 left-0 w-full h-px bg-sky-400/40" />
              <div className="absolute top-0 left-1/2 w-px h-full bg-sky-400/40" />
            </div>
          </div>
          {/* Submarine body - bottom */}
          <div className="absolute w-36 h-20 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/8"
            style={{ transform: 'translateZ(-16px)' }}>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-400/60">BTM</div>
          </div>
          {/* Left side */}
          <div className="absolute h-20 bg-amber-500/8 border-2 border-amber-500/30"
            style={{ width: '32px', transform: 'rotateY(-90deg) translateZ(72px)', borderRadius: '4px' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-amber-400/50">L</div>
          </div>
          {/* Right side */}
          <div className="absolute h-20 bg-amber-500/8 border-2 border-amber-500/30"
            style={{ width: '32px', transform: 'rotateY(90deg) translateZ(72px)', borderRadius: '4px' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-amber-400/50">R</div>
          </div>
          {/* Front */}
          <div className="absolute w-36 bg-red-500/10 border-2 border-red-500/40"
            style={{ height: '32px', transform: 'rotateX(90deg) translateZ(40px)', borderRadius: '4px' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-red-400/60">FWD ▶</div>
          </div>
          {/* Back */}
          <div className="absolute w-36 bg-zinc-500/8 border-2 border-zinc-500/20"
            style={{ height: '32px', transform: 'rotateX(-90deg) translateZ(40px)', borderRadius: '4px' }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-zinc-400/40">AFT</div>
          </div>
        </div>
        {/* Ground reference: horizon line */}
        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-[--fg-muted]/15" />
        {/* Axis labels */}
        <div className="absolute bottom-1 left-2 text-[9px] text-[--fg-muted]/40 font-mono">Roll {roll.toFixed(1)}° · Pitch {pitch.toFixed(1)}° · Yaw {yaw.toFixed(1)}°</div>
      </div>
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

interface WaveformSeries { label: string; color: string; data: number[] }

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
  const [view, setView] = useState<'home' | 'system' | 'attitude' | 'pwm' | 'adc' | 'baro' | 'advanced'>('home')

  const [system, setSystem] = useState<SystemData | null>(null)
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [pwm, setPwm] = useState<PwmData | null>(null)
  const [pwmFreq, setPwmFreq] = useState<PwmFreqData | null>(null)
  const [adc, setAdc] = useState<AdcData | null>(null)
  const [baro, setBaro] = useState<BarometerData | null>(null)
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

  const pollingRef = useRef(false)
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
    setCalib({ gains: [1, 1, 1, 1, 1], offsets: [0, 0, 0, 0, 0], status: 0 })
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
      const [sys, att, pwmData, freqData, adcData] = await Promise.all([
        client.readSystem().catch(() => null),
        client.readAttitude().catch(() => null),
        client.readPWM().catch(() => null),
        client.readPWMFreq().catch(() => null),
        client.readADC().catch(() => null),
      ])
      if (sys) setSystem(sys)
      if (att) setAttitude(att)
      if (pwmData) setPwm(pwmData)
      if (freqData) setPwmFreq(freqData)
      if (adcData) setAdc(adcData)
    } catch (e: any) {
      setError(e.message)
    }
  }, [connState, client])

  // Sequential polling (not parallel - Modbus is half-duplex)
  const pollSequential = useCallback(async () => {
    if (connState !== 'connected') return
    try {
      setError('')
      const sys = await client.readSystem()
      setSystem(sys)
      const att = await client.readAttitude()
      setAttitude(att)
      const pwmData = await client.readPWM()
      setPwm(pwmData)
      const freqData = await client.readPWMFreq()
      setPwmFreq(freqData)
      const adcData = await client.readADC()
      setAdc(adcData)
      const baroData = await client.readBarometer()
      setBaro(baroData)
    } catch (e: any) {
      setError(e.message)
    }
  }, [connState, client])

  useEffect(() => {
    if (!polling || connState !== 'connected') return
    pollingRef.current = true
    let cancelled = false

    const loop = async () => {
      while (pollingRef.current && !cancelled) {
        /* Skip polling while Flash write is in progress, to keep serial silent */
        if (!flashBusyRef.current) {
          await pollSequential()
        }
        await new Promise(r => setTimeout(r, pollInterval))
      }
    }
    loop()

    return () => { cancelled = true; pollingRef.current = false }
  }, [polling, connState, pollInterval, pollSequential])

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

  useEffect(() => {
    if (attitude) setAttHistory(prev => [...prev.slice(-(WAVEFORM_MAX - 1)), applyOffset(attitude)])
  }, [attitude, applyOffset])

  const handleZeroCalibrate = () => {
    if (attitude) {
      setAttOffset({ ...attitude })
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

  const calcFreq = (group: number) => {
    const clk = PWM_GROUPS[group].clock
    const { arr, psc } = localFreq[group]
    return clk / (psc + 1) / (arr + 1)
  }

  const fmtFloat = (v: number) => v.toFixed(2)
  const fmtTemp = (v: number) => v.toFixed(1)

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
              { id: 'system',   label: '系统',    icon: <Cpu className="w-3.5 h-3.5" /> },
              { id: 'attitude', label: '姿态',    icon: <Compass className="w-3.5 h-3.5" /> },
              { id: 'pwm',      label: 'PWM',     icon: <Sliders className="w-3.5 h-3.5" /> },
              { id: 'adc',      label: 'ADC',     icon: <Thermometer className="w-3.5 h-3.5" /> },
              { id: 'baro',     label: '气压计',  icon: <CloudRain className="w-3.5 h-3.5" /> },
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
        <Card title="系统状态" icon={<Cpu className="w-4 h-4 text-[--accent]" />} className={cn(view === 'system' ? "col-span-12 lg:col-span-6" : "col-span-12 lg:col-span-3")}>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="设备ID" value={system ? `0x${system.deviceId.toString(16).toUpperCase().padStart(4, '0')}` : '--'} />
            <Metric label="固件版本" value={system ? `V${(system.fwVersion >> 8)}.${system.fwVersion & 0xff}` : '--'} />
            <Metric label="运行模式" value={system ? modeLabels[system.runMode] || `${system.runMode}` : '--'}
              color={system?.runMode === 2 ? 'text-[--success]' : system?.runMode === 1 ? 'text-[--warning]' : undefined} />
            <Metric label="故障码" value={system ? (system.faultCode === 0 ? '正常' : `0x${system.faultCode.toString(16)}`) : '--'}
              color={system?.faultCode ? 'text-[--danger]' : 'text-[--success]'} />
            <Metric label="运行时间" value={system ? `${(system.sysTick / 1000).toFixed(1)}` : '--'} unit="秒" />
          </div>
        </Card>
        )}

        {/* Attitude data + 3D model - home + attitude */}
        {(view === 'home' || view === 'attitude') && (
        <Card title="姿态数据 (MS901M)" icon={<Activity className="w-4 h-4 text-emerald-400" />} className="col-span-12 lg:col-span-5">
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Metric label="Roll 横滚" value={calibratedAttitude ? fmtFloat(calibratedAttitude.roll) : '--'} unit="°" color="text-sky-400" />
            <Metric label="Pitch 俯仰" value={calibratedAttitude ? fmtFloat(calibratedAttitude.pitch) : '--'} unit="°" color="text-emerald-400" />
            <Metric label="Yaw 航向" value={calibratedAttitude ? fmtFloat(calibratedAttitude.yaw) : '--'} unit="°" color="text-amber-400" />
            <Metric label="Gyro X" value={calibratedAttitude ? fmtFloat(calibratedAttitude.gyroX) : '--'} unit="°/s" />
            <Metric label="Gyro Y" value={calibratedAttitude ? fmtFloat(calibratedAttitude.gyroY) : '--'} unit="°/s" />
            <Metric label="Gyro Z" value={calibratedAttitude ? fmtFloat(calibratedAttitude.gyroZ) : '--'} unit="°/s" />
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

        {/* 3D Attitude Model - attitude only */}
        {view === 'attitude' && (
        <Card title="姿态可视化" icon={<Activity className="w-4 h-4 text-sky-400" />} className="col-span-12 lg:col-span-4">
          <AttitudeModel
            roll={calibratedAttitude?.roll ?? 0}
            pitch={calibratedAttitude?.pitch ?? 0}
            yaw={calibratedAttitude?.yaw ?? 0}
          />
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
        <Card title="气压计 (MS901M)" icon={<CloudRain className="w-4 h-4 text-cyan-400" />} className="col-span-12 lg:col-span-3">
          <div className="space-y-3">
            <div className="bg-[--bg-input] rounded px-3 py-2">
              <div className="text-[10px] text-[--fg-muted] uppercase">气压</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-mono font-bold text-cyan-400">
                  {baro ? (baro.pressure / 100).toFixed(2) : '--'}
                </span>
                <span className="text-xs text-[--fg-muted]">hPa</span>
              </div>
              {baro && (
                <div className="text-[10px] text-[--fg-muted] font-mono mt-0.5">{baro.pressure} Pa</div>
              )}
            </div>
            <div className="bg-[--bg-input] rounded px-3 py-2">
              <div className="text-[10px] text-[--fg-muted] uppercase">海拔高度</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {baro ? (baro.altitude / 100).toFixed(2) : '--'}
                </span>
                <span className="text-xs text-[--fg-muted]">m</span>
              </div>
              {baro && (
                <div className="text-[10px] text-[--fg-muted] font-mono mt-0.5">{baro.altitude} cm</div>
              )}
            </div>
            <div className="bg-[--bg-input] rounded px-3 py-2">
              <div className="text-[10px] text-[--fg-muted] uppercase">温度</div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-mono font-bold text-amber-400">
                  {baro ? baro.temperature.toFixed(1) : '--'}
                </span>
                <span className="text-xs text-[--fg-muted]">°C</span>
              </div>
            </div>
          </div>
        </Card>
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
                  <tr><td className="py-1 px-2">0x004C</td><td className="px-2">BARO_TEMP</td><td className="px-2">float ℃</td><td className="px-2">R</td><td className="px-2">{baro ? `${baro.temperature.toFixed(2)} ℃` : '--'}</td></tr>
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
