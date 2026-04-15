import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Waves, Plug, PlugZap, RefreshCw, Activity, Thermometer,
  Gauge, Sliders, Cpu, AlertTriangle, Zap, Sun, ChevronDown, ChevronUp
} from 'lucide-react'
import { ModbusClient, type ConnectionState, type ModbusLog, REG } from './lib/modbus'

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
interface AdcData { temps: number[]; voltage: number; adcRaw: number[] }

// ======================== Helpers ========================

const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

function Card({ title, icon, children, className }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-[--border] bg-[--bg-card] overflow-hidden", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[--border]">
        {icon}
        <h2 className="text-sm font-semibold text-[--fg-primary]">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Metric({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[--fg-muted] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-mono font-bold", color || "text-[--fg-primary]")}>
          {value}
        </span>
        {unit && <span className="text-xs text-[--fg-muted]">{unit}</span>}
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
      <div className="relative w-full h-48" style={{ perspective: '600px' }}>
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

// ======================== App ========================

export default function App() {
  const client = useRef(new ModbusClient()).current
  const [connState, setConnState] = useState<ConnectionState>('disconnected')
  const [logs, setLogs] = useState<ModbusLog[]>([])
  const [polling, setPolling] = useState(false)
  const [pollInterval, setPollInterval] = useState(500)
  const [showLog, setShowLog] = useState(false)

  const [system, setSystem] = useState<SystemData | null>(null)
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [pwm, setPwm] = useState<PwmData | null>(null)
  const [adc, setAdc] = useState<AdcData | null>(null)
  const [error, setError] = useState('')

  /* Local slider state: instant UI feedback, write only on release */
  const [localServos, setLocalServos] = useState<number[]>([1500,1500,1500,1500,1500,1500,1500,1500])
  const [localLeds, setLocalLeds] = useState<number[]>([0, 0])
  const draggingRef = useRef(false)

  const pollingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    client.onStateChange(setConnState)
    client.onLog(setLogs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [client])

  const handleConnect = async () => {
    try {
      setError('')
      await client.connect(9600)
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
      const [sys, att, pwmData, adcData] = await Promise.all([
        client.readSystem().catch(() => null),
        client.readAttitude().catch(() => null),
        client.readPWM().catch(() => null),
        client.readADC().catch(() => null),
      ])
      if (sys) setSystem(sys)
      if (att) setAttitude(att)
      if (pwmData) setPwm(pwmData)
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
      const adcData = await client.readADC()
      setAdc(adcData)
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
        await pollSequential()
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

  const fmtFloat = (v: number) => v.toFixed(2)
  const fmtTemp = (v: number) => v.toFixed(1)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[--border] bg-[--bg-card]">
        <div className="flex items-center gap-3">
          <Waves className="w-6 h-6 text-[--accent]" />
          <div>
            <h1 className="text-base font-bold">水下机器人 Modbus 监控</h1>
            <p className="text-xs text-[--fg-muted]">STM32F407 · Slave 0x01 · 9600 8N1</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection */}
          <div className="flex items-center gap-2">
            <StatusDot state={connState} />
            <span className="text-xs text-[--fg-secondary]">{stateLabel[connState]}</span>
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

      {/* Main content */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 max-w-[1600px] mx-auto w-full">
        {/* System Status - top row */}
        <Card title="系统状态" icon={<Cpu className="w-4 h-4 text-[--accent]" />} className="col-span-12 lg:col-span-3">
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

        {/* Attitude data + 3D model */}
        <Card title="姿态数据 (MS901M)" icon={<Activity className="w-4 h-4 text-emerald-400" />} className="col-span-12 lg:col-span-5">
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Metric label="Roll 横滚" value={attitude ? fmtFloat(attitude.roll) : '--'} unit="°" color="text-sky-400" />
            <Metric label="Pitch 俯仰" value={attitude ? fmtFloat(attitude.pitch) : '--'} unit="°" color="text-emerald-400" />
            <Metric label="Yaw 航向" value={attitude ? fmtFloat(attitude.yaw) : '--'} unit="°" color="text-amber-400" />
            <Metric label="Gyro X" value={attitude ? fmtFloat(attitude.gyroX) : '--'} unit="°/s" />
            <Metric label="Gyro Y" value={attitude ? fmtFloat(attitude.gyroY) : '--'} unit="°/s" />
            <Metric label="Gyro Z" value={attitude ? fmtFloat(attitude.gyroZ) : '--'} unit="°/s" />
          </div>
        </Card>

        {/* 3D Attitude Model */}
        <Card title="姿态可视化" icon={<Activity className="w-4 h-4 text-sky-400" />} className="col-span-12 lg:col-span-4">
          <AttitudeModel
            roll={attitude?.roll ?? 0}
            pitch={attitude?.pitch ?? 0}
            yaw={attitude?.yaw ?? 0}
          />
        </Card>

        {/* ADC Raw Data */}
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

        {/* PWM Servos */}
        <Card title="舵机 PWM 控制" icon={<Sliders className="w-4 h-4 text-violet-400" />} className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-[--fg-muted] w-14">Servo {i + 1}</span>
                <input
                  type="range" min={500} max={2500} step={10}
                  value={localServos[i]}
                  onChange={e => handleServoDrag(i, Number(e.target.value))}
                  onPointerUp={e => handleServoCommit(i, Number((e.target as HTMLInputElement).value))}
                  disabled={connState !== 'connected'}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-[--fg-secondary] w-14 text-right">
                  {localServos[i]} μs
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* LED Control */}
        <Card title="LED 控制" icon={<Sun className="w-4 h-4 text-yellow-400" />} className="col-span-12 lg:col-span-4">
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[--fg-muted]">LED {i + 1}</span>
                  <span className="text-xs font-mono text-[--fg-secondary]">
                    {localLeds[i]} / 1000
                  </span>
                </div>
                <input
                  type="range" min={0} max={1000} step={10}
                  value={localLeds[i]}
                  onChange={e => handleLedDrag(i, Number(e.target.value))}
                  onPointerUp={e => handleLedCommit(i, Number((e.target as HTMLInputElement).value))}
                  disabled={connState !== 'connected'}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Register Map Quick Reference */}
        <Card title="寄存器速查" icon={<Gauge className="w-4 h-4 text-[--fg-muted]" />} className="col-span-12">
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
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0002</td><td className="px-2">RUN_MODE</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{system?.runMode ?? '--'}</td></tr>
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0010</td><td className="px-2">ROLL</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.roll.toFixed(3) : '--'}</td></tr>
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0012</td><td className="px-2">PITCH</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.pitch.toFixed(3) : '--'}</td></tr>
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0014</td><td className="px-2">YAW</td><td className="px-2">float</td><td className="px-2">R</td><td className="px-2">{attitude ? attitude.yaw.toFixed(3) : '--'}</td></tr>
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0020</td><td className="px-2">SERVO1</td><td className="px-2">uint16</td><td className="px-2">R/W</td><td className="px-2">{pwm?.servos[0] ?? '--'}</td></tr>
                <tr className="border-b border-[--border]/50"><td className="py-1 px-2">0x0030</td><td className="px-2">TEMP1</td><td className="px-2">int16 x10</td><td className="px-2">R</td><td className="px-2">{adc ? `${adc.temps[0].toFixed(1)}°C` : '--'}</td></tr>
                <tr><td className="py-1 px-2">0x0034</td><td className="px-2">VOLTAGE</td><td className="px-2">int16 x10</td><td className="px-2">R</td><td className="px-2">{adc ? `${adc.voltage.toFixed(1)}V` : '--'}</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Log panel (toggleable bottom bar) */}
      <div className="border-t border-[--border] bg-[--bg-card]">
        <button onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-[--fg-muted] hover:text-[--fg-secondary] transition-colors">
          <span>通信日志 ({logs.length})</span>
          {showLog ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        {showLog && (
          <div className="h-40 overflow-y-auto px-4 pb-2 font-mono text-[11px] space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[--fg-muted] shrink-0">{log.time}</span>
                <span className={cn(
                  "shrink-0 w-6",
                  log.dir === 'TX' ? 'text-sky-400' : log.dir === 'RX' ? 'text-emerald-400' : 'text-red-400'
                )}>{log.dir}</span>
                <span className="text-[--fg-secondary] break-all">{log.data}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
