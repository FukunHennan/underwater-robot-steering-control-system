import { useState, useCallback, useEffect, useRef } from 'react'
import { useDeviceData } from '@/stores/DeviceDataContext'
import { useConnection } from '@/stores/ConnectionContext'
import { useUI } from '@/stores/UIContext'
import { Card } from '@/components/common/Card'
import { REG } from '@/lib/modbus'
import { PWM_GROUPS, IR_PRESETS } from '@/lib/presets'
import { Lightbulb, Radio, Keyboard, Activity } from 'lucide-react'

/** Repeatedly transmit IR code until user releases */
function useIRRepeat(client: any, connected: boolean) {
  const timerRef = useRef<number>(0)
  const sendRef = useRef(false)

  const startSend = useCallback(async (addr: number, cmd: number) => {
    if (!client || !connected) return
    sendRef.current = true
    const send = async () => {
      if (!sendRef.current || !client) return
      try {
        await client.writeSingleRegister(REG.IR_TX_DATA, cmd & 0xFFFF, 'high')
        await client.writeSingleRegister(REG.IR_TX_CMD, addr & 0xFFFF, 'high')
      } catch {}
      if (sendRef.current) {
        timerRef.current = window.setTimeout(send, 100)
      }
    }
    send()
  }, [client, connected])

  const stopSend = useCallback(() => {
    sendRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = 0
    }
  }, [])

  useEffect(() => () => {
    sendRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { startSend, stopSend }
}

export function PeripheralPage() {
  const { pwm, pwmFreq, gpio, ir } = useDeviceData()
  const { client, connState } = useConnection()
  const { error, setError } = useUI()

  const [localLEDs, setLocalLEDs] = useState([0, 0])
  const [localGPIO, setLocalGPIO] = useState<{ mode: boolean; out: boolean }[]>([
    { mode: false, out: false },
    { mode: false, out: false },
    { mode: false, out: false },
    { mode: false, out: false },
  ])
  const [localPWMFreq, setLocalPWMFreq] = useState<Array<{ arr: number; psc: number }>>(
    Array.from({ length: 4 }, () => ({ arr: 0, psc: 0 })),
  )
  const [localIR, setLocalIR] = useState({ txCmd: 0, txData: 0, rxStatus: 0, rxData: 0 })
  const [irRepeatEnabled, setIrRepeatEnabled] = useState(false)
  const [customAddr, setCustomAddr] = useState('0xFF00')
  const [customCmd, setCustomCmd] = useState('0x0040')

  const connected = connState === 'connected' && !!client
  const { startSend, stopSend } = useIRRepeat(client, connected)

  useEffect(() => {
    if (pwm && pwm.leds.length === 2) setLocalLEDs(pwm.leds)
  }, [pwm])

  useEffect(() => {
    if (pwmFreq && pwmFreq.groups.length === 4) setLocalPWMFreq(pwmFreq.groups)
  }, [pwmFreq])

  useEffect(() => {
    if (gpio && gpio.modes && gpio.modes.length > 0) {
      setLocalGPIO(prev => Array.from({ length: gpio.modes.length }, (_, i) => ({
        mode: gpio.modes[i] === 1,
        out: gpio.outputs[i] === 1,
      })))
    }
  }, [gpio])

  useEffect(() => {
    if (ir) setLocalIR(ir)
  }, [ir])

  /* === LED === */
  const handleLEDChange = useCallback(async (ch: number, val: number) => {
    const v = Math.max(0, Math.min(100, Math.round(val)))
    setLocalLEDs(prev => { const n = [...prev]; n[ch] = v; return n })
    if (!client || !connected) return
    try {
      await client.writeSingleRegister(REG.SERVO1 + 8 + ch, v, 'normal')
    } catch (e: any) { setError(e.message) }
  }, [client, connected, setError])

  /* === GPIO === */
  const handleGPIOMode = useCallback(async (ch: number, mode: boolean) => {
    setLocalGPIO(prev => {
      const n = [...prev]
      n[ch] = { ...n[ch], mode }
      return n
    })
    if (!client || !connected) return
    try {
      await client.writeSingleRegister(REG.GPIO_MODE0 + ch, mode ? 1 : 0, 'high')
    } catch (e: any) { setError(e.message) }
  }, [client, connected, setError])

  const handleGPIOOut = useCallback(async (ch: number, out: boolean) => {
    setLocalGPIO(prev => {
      const n = [...prev]
      n[ch] = { ...n[ch], out }
      return n
    })
    if (!client || !connected) return
    try {
      await client.writeSingleRegister(REG.GPIO_OUT0 + ch, out ? 1 : 0, 'high')
    } catch (e: any) { setError(e.message) }
  }, [client, connected, setError])

  /* === PWM Frequency === */
  const handleFreqChange = useCallback(async (groupIdx: number, field: 'arr' | 'psc', val: number) => {
    setLocalPWMFreq(prev => {
      const n = [...prev]
      n[groupIdx] = { ...n[groupIdx], [field]: val }
      return n
    })
  }, [])

  const handleFreqCommit = useCallback(async (groupIdx: number) => {
    if (!client || !connected) return
    const g = localPWMFreq[groupIdx]
    const addr = REG.PWM_ARR_G1 + groupIdx * 2
    try {
      await client.writeMultipleRegisters(addr, [g.arr, g.psc], 'high')
    } catch (e: any) { setError(e.message) }
  }, [client, connected, localPWMFreq, setError])

  /* === IR === */
  const handleIRPreset = useCallback((preset: { addr: number; cmd: number }) => {
    if (!client || !connected) return
    client.writeSingleRegister(REG.IR_TX_DATA, preset.cmd & 0xFFFF, 'high')
      .then(() => client.writeSingleRegister(REG.IR_TX_CMD, preset.addr & 0xFFFF, 'high'))
      .catch((e: any) => setError(e.message))
  }, [client, connected, setError])

  const handleIRCustomTransmit = useCallback(() => {
    if (!client || !connected) return
    const addr = parseInt(customAddr, 16)
    const cmd = parseInt(customCmd, 16)
    if (isNaN(addr) || isNaN(cmd)) { setError('无效的 IR 地址/命令'); return }
    if (!irRepeatEnabled) {
      client.writeSingleRegister(REG.IR_TX_DATA, cmd & 0xFFFF, 'high')
        .then(() => client.writeSingleRegister(REG.IR_TX_CMD, addr & 0xFFFF, 'high'))
        .catch((e: any) => setError(e.message))
    } else {
      startSend(addr, cmd)
    }
  }, [client, connected, customAddr, customCmd, irRepeatEnabled, startSend, setError])

  const handleIRStop = useCallback(() => {
    stopSend()
  }, [stopSend])

  return (
    <div className="page-container animate-fade-in">
      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        {/* LED Dimming */}
        <Card title="LED 调光" icon={<Lightbulb className="w-4 h-4" style={{ color: 'var(--warning)' }} />}>
          {[0, 1].map(ch => (
            <div key={ch} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: 'var(--fg-secondary)' }}>通道 {ch + 1}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{localLEDs[ch] ?? 0}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range" className="slider flex-1"
                  min={0} max={100}
                  value={localLEDs[ch] ?? 0}
                  onChange={e => handleLEDChange(ch, Number(e.target.value))}
                  disabled={!connected}
                />
                <input
                  className="input w-16 text-center"
                  type="number" min={0} max={100}
                  value={localLEDs[ch] ?? 0}
                  onChange={e => handleLEDChange(ch, Number(e.target.value))}
                  disabled={!connected}
                />
              </div>
            </div>
          ))}
        </Card>

        {/* GPIO Control */}
        <Card title="GPIO 控制" icon={<Activity className="w-4 h-4" style={{ color: 'var(--success)' }} />}>
          <div className="grid gap-2">
            {localGPIO.map((pin, ch) => (
              <div key={ch} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                <span className="text-xs font-mono w-16" style={{ color: 'var(--fg-primary)' }}>GPIO{ch}</span>
                <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-secondary)' }}>
                  <input type="checkbox" checked={pin.mode}
                    onChange={e => handleGPIOMode(ch, e.target.checked)}
                    disabled={!connected} />
                  输出
                </label>
                {pin.mode && (
                  <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-secondary)' }}>
                    <input type="checkbox" checked={pin.out}
                      onChange={e => handleGPIOOut(ch, e.target.checked)}
                      disabled={!connected} />
                    高电平
                  </label>
                )}
                <div className="flex-1 text-right">
                  <span className={`w-2 h-2 inline-block rounded-full ${pin.mode && pin.out ? 'bg-[var(--success)]' : 'bg-[var(--fg-muted)]'}`} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* PWM Frequency Config */}
        <Card title="PWM 频率配置" icon={<Radio className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          {localPWMFreq.map((g, i) => (
            <div key={i} className="mb-3 last:mb-0 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--fg-secondary)' }}>
                {PWM_GROUPS[i]?.label ?? `组 ${i + 1}`}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] w-8" style={{ color: 'var(--fg-muted)' }}>ARR</span>
                <input className="input flex-1" type="number"
                  value={g.arr} min={0} max={65535}
                  onChange={e => handleFreqChange(i, 'arr', Number(e.target.value))}
                  disabled={!connected} />
                <span className="text-[10px] w-8" style={{ color: 'var(--fg-muted)' }}>PSC</span>
                <input className="input flex-1" type="number"
                  value={g.psc} min={0} max={65535}
                  onChange={e => handleFreqChange(i, 'psc', Number(e.target.value))}
                  disabled={!connected} />
              </div>
              <button className="btn btn-sm btn-primary w-full"
                onClick={() => handleFreqCommit(i)} disabled={!connected}>
                应用
              </button>
            </div>
          ))}
        </Card>

        {/* IR Remote */}
        <Card title="红外遥控" icon={<Keyboard className="w-4 h-4" style={{ color: 'var(--danger)' }} />}>
          {/* IR Status */}
          <div className="flex items-center gap-3 mb-3 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
            <div className="flex-1 text-xs" style={{ color: 'var(--fg-secondary)' }}>
              RX 状态: <span className="font-mono" style={{ color: localIR.rxStatus === 1 ? 'var(--success)' : 'var(--fg-muted)' }}>
                {localIR.rxStatus === 1 ? '收到' : '等待'}
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
              RX 数据: <span className="font-mono" style={{ color: 'var(--accent)' }}>
                0x{localIR.rxData.toString(16).toUpperCase().padStart(4, '0')}
              </span>
            </div>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {IR_PRESETS.map((p, i) => (
              <button key={i} className="btn btn-sm btn-ghost text-[10px]"
                onClick={() => handleIRPreset(p)}
                disabled={!connected}>
                {p.name}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>地址</span>
            <input className="input w-24 text-center font-mono" value={customAddr}
              onChange={e => setCustomAddr(e.target.value)} disabled={!connected} />
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>命令</span>
            <input className="input w-24 text-center font-mono" value={customCmd}
              onChange={e => setCustomCmd(e.target.value)} disabled={!connected} />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--fg-secondary)' }}>
              <input type="checkbox" checked={irRepeatEnabled}
                onChange={e => setIrRepeatEnabled(e.target.checked)}
                disabled={!connected} />
              连发
            </label>
            <button className="btn btn-sm btn-primary flex-1" onMouseDown={handleIRCustomTransmit}
              onMouseUp={handleIRStop} onMouseLeave={handleIRStop}
              disabled={!connected}>
              {irRepeatEnabled ? '按住发送' : '发送'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
