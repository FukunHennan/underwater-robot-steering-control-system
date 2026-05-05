import { useState, useCallback, useEffect } from 'react'
import { useDeviceData } from '@/stores/DeviceDataContext'
import { useConnection } from '@/stores/ConnectionContext'
import { useUI } from '@/stores/UIContext'
import { Card } from '@/components/common/Card'
import { REG } from '@/lib/modbus'
import { SERVO_US_PER_DEG, clampDuty, dutyToAngle, angleToDuty } from '@/lib/utils'
import { Sliders, RotateCw, Save, ChevronDown, ChevronRight, Compass } from 'lucide-react'

const SERVO_ZERO = 500

interface ServoCompCoeff {
  baseAngle: number
  kRoll: number
  kPitch: number
  kYaw: number
}

const INITIAL_SERVOS = [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]
const INITIAL_COMP: ServoCompCoeff[] = Array.from({ length: 8 }, () => ({
  baseAngle: 90, kRoll: 0, kPitch: 0, kYaw: 0,
}))
const SERVO_LABELS = ['舵机 1', '舵机 2', '舵机 3', '舵机 4', '舵机 5', '舵机 6', '舵机 7', '舵机 8']

export function ServoPage() {
  const { pwm, attitude } = useDeviceData()
  const { client, connState } = useConnection()
  const { error, setError } = useUI()

  const [localServos, setLocalServos] = useState<number[]>(INITIAL_SERVOS)
  const [localComp, setLocalComp] = useState<ServoCompCoeff[]>(INITIAL_COMP)
  const [compEnabled, setCompEnabled] = useState<boolean[]>(Array(8).fill(false))
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [expandedServo, setExpandedServo] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [globalCompApplied, setGlobalCompApplied] = useState(false)

  useEffect(() => {
    if (pwm && pwm.servos.length === 8) {
      setLocalServos(pwm.servos.map(s => s ?? 1500))
    }
  }, [pwm])

  const connected = connState === 'connected' && !!client

  useEffect(() => {
    if (!connected || !client) return
    client.readAllServoComp().then(channels => {
      setLocalComp(channels.map(c => ({
        baseAngle: c.baseAngle,
        kRoll: c.kRoll,
        kPitch: c.kPitch,
        kYaw: c.kYaw,
      })))
    }).catch(() => null)
    client.readAllServoCompEnable().then(enables => {
      setCompEnabled(enables)
      setAutoEnabled(enables.every(x => x))
    }).catch(() => null)
  }, [connected])

  const sendServo = useCallback(async (ch: number, duty: number) => {
    if (!client || !connected) return
    try {
      const d = clampDuty(Math.round(duty))
      await client.writeSingleRegister(REG.SERVO1 + ch, d, 'normal')
    } catch (e: any) {
      setError(e.message)
    }
  }, [client, connected, setError])

  const handleSliderChange = (ch: number, duty: number) => {
    const clamped = clampDuty(Math.round(duty))
    setLocalServos(prev => { const n = [...prev]; n[ch] = clamped; return n })
    sendServo(ch, clamped)
  }

  const handleAngleCommit = (ch: number, val: string) => {
    const deg = parseFloat(val)
    if (isNaN(deg) || deg < 0 || deg > 180) return
    const duty = angleToDuty(deg, SERVO_ZERO)
    handleSliderChange(ch, duty)
  }

  const handleSetZero = (ch: number) => {
    const duty = angleToDuty(90, SERVO_ZERO)
    handleSliderChange(ch, duty)
  }

  const handleCompCoeffChange = (ch: number, key: keyof ServoCompCoeff, val: number) => {
    setLocalComp(prev => {
      const n = [...prev]
      n[ch] = { ...n[ch], [key]: val }
      return n
    })
  }

  const handleCompApply = async (ch: number) => {
    if (!client || !connected) return
    const c = localComp[ch]
    try {
      await client.writeServoCompCoeff(ch, {
        baseAngle: c.baseAngle,
        kRoll: c.kRoll,
        kPitch: c.kPitch,
        kYaw: c.kYaw,
      })
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleCompToggle = async (ch: number, enabled: boolean) => {
    if (!client || !connected) return
    const addr = REG.SERVO_COMP_ENABLE + ch
    try {
      await client.writeSingleRegister(addr, enabled ? 1 : 0, 'high')
      setCompEnabled(prev => {
        const n = [...prev]
        n[ch] = enabled
        setAutoEnabled(n.every(x => x))
        return n
      })
      if (!enabled && expandedServo === ch) {
        setExpandedServo(null)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleAutoCompToggle = async (enabled: boolean) => {
    if (!client || !connected) return
    try {
      for (let i = 0; i < 8; i++) {
        await client.writeSingleRegister(REG.SERVO_COMP_ENABLE + i, enabled ? 1 : 0, 'high')
      }
      setAutoEnabled(enabled)
      setCompEnabled(Array(8).fill(enabled))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleSaveToFlash = async () => {
    if (!client || !connected) return
    setSaving(true)
    client.hold()
    try {
      for (let i = 0; i < 8; i++) {
        await handleCompApply(i)
      }
      await client.saveServoCompToFlash()
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
      client.release()
    }
  }

  const handleGlobalCompApply = async () => {
    if (!client || !connected) return
    setGlobalCompApplied(true)
    try {
      for (let i = 0; i < 8; i++) {
        await handleCompApply(i)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setTimeout(() => setGlobalCompApplied(false), 2000)
  }

  const calculateTargetAngle = (ch: number): number | null => {
    if (!attitude) return null
    const c = localComp[ch]
    if (!compEnabled[ch]) return null
    return dutyToAngle(localServos[ch], SERVO_ZERO) + c.kRoll * attitude.roll + c.kPitch * attitude.pitch + c.kYaw * attitude.yaw
  }

  return (
    <div className="page-container animate-fade-in">
      {attitude && (
        <div className="card p-3 flex items-center gap-4">
          <Compass className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
            Roll: <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>{attitude.roll.toFixed(1)}°</span>
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
            Pitch: <span className="font-mono font-semibold" style={{ color: 'var(--success)' }}>{attitude.pitch.toFixed(1)}°</span>
          </span>
          <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
            Yaw: <span className="font-mono font-semibold" style={{ color: 'var(--warning)' }}>{attitude.yaw.toFixed(1)}°</span>
          </span>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>全局控制</span>
          <button
            className={`btn btn-sm ${autoEnabled ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => handleAutoCompToggle(!autoEnabled)}
            disabled={!connected}
          >
            {autoEnabled ? '补偿已开启' : '补偿已关闭'}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleGlobalCompApply}
            disabled={!connected || globalCompApplied}
          >
            {globalCompApplied ? '已应用' : '应用所有参数'}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={handleSaveToFlash}
            disabled={!connected || saving}
          >
            <Save className="w-3 h-3 mr-1" />
            {saving ? '保存中...' : '保存到 Flash'}
          </button>
        </div>
      </div>

      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {localServos.map((duty, ch) => {
          const angle = dutyToAngle(duty, SERVO_ZERO)
          const targetAngle = calculateTargetAngle(ch)
          const isExpanded = expandedServo === ch

          return (
            <Card key={ch} title={`${SERVO_LABELS[ch]} (CH${ch + 1})`}
              icon={<Sliders className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="range"
                  className="slider flex-1"
                  min={500} max={2500}
                  value={duty}
                  onChange={e => handleSliderChange(ch, Number(e.target.value))}
                  disabled={!connected}
                />
                <span className="text-xs font-mono w-12 text-right" style={{ color: 'var(--fg-primary)' }}>{duty}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>角度:</span>
                <input
                  className="input w-20 text-center"
                  type="number" min={0} max={180}
                  value={angle.toFixed(0)}
                  onChange={e => handleAngleCommit(ch, e.target.value)}
                  disabled={!connected}
                />
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>deg</span>
                <button className="btn btn-sm btn-ghost ml-auto" onClick={() => handleSetZero(ch)} disabled={!connected}>
                  <RotateCw className="w-3 h-3 mr-1" />回中
                </button>
                <button
                  className={`btn btn-sm ${compEnabled[ch] ? 'btn-success' : 'btn-ghost'}`}
                  onClick={() => handleCompToggle(ch, !compEnabled[ch])}
                  disabled={!connected}
                >
                  {compEnabled[ch] ? '补偿开' : '补偿关'}
                </button>
              </div>

              {compEnabled[ch] && targetAngle !== null && (
                <div className="text-xs mb-2 p-2 rounded" style={{ background: 'var(--bg-input)' }}>
                  目标角度: <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{targetAngle.toFixed(1)}°</span>
                  <span className="ml-2" style={{ color: 'var(--fg-muted)' }}>
                    (基角 {dutyToAngle(duty, SERVO_ZERO).toFixed(0)}° + 补偿)
                  </span>
                </div>
              )}

              <button
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors"
                style={{ color: 'var(--fg-muted)', background: 'transparent' }}
                onClick={() => setExpandedServo(isExpanded ? null : ch)}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {isExpanded ? '收起补偿参数' : '展开补偿参数'}
              </button>

              {isExpanded && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>基准角度 (°)</span>
                      <input className="input" type="number" min={0} max={180} step={1}
                        value={localComp[ch].baseAngle}
                        onChange={e => handleCompCoeffChange(ch, 'baseAngle', Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>kRoll</span>
                      <input className="input" type="number" step={0.01}
                        value={localComp[ch].kRoll}
                        onChange={e => handleCompCoeffChange(ch, 'kRoll', Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>kPitch</span>
                      <input className="input" type="number" step={0.01}
                        value={localComp[ch].kPitch}
                        onChange={e => handleCompCoeffChange(ch, 'kPitch', Number(e.target.value))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>kYaw</span>
                      <input className="input" type="number" step={0.01}
                        value={localComp[ch].kYaw}
                        onChange={e => handleCompCoeffChange(ch, 'kYaw', Number(e.target.value))} />
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary w-full mt-2"
                    onClick={() => handleCompApply(ch)} disabled={!connected}>
                    应用此通道
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
