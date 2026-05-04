import { useState, useCallback, useEffect } from 'react'
import { useDeviceData } from '@/stores/DeviceDataContext'
import { useConnection } from '@/stores/ConnectionContext'
import { useUI } from '@/stores/UIContext'
import { Card } from '@/components/common/Card'
import { REG } from '@/lib/modbus'
import { KALMAN_CH_NAMES, SENSOR_AXIS_NAMES } from '@/lib/presets'
import { loadAxisMapping } from '@/lib/utils'
import type { AxisMappingConfig } from '@/lib/types'
import { Crosshair, Sliders, Repeat, Table2, Terminal, RefreshCw, Save, RotateCcw } from 'lucide-react'

export function AdvancedPage() {
  const { calib, kalman } = useDeviceData()
  const { client, connState, logs } = useConnection()
  const { error, setError } = useUI()

  const connected = connState === 'connected' && !!client

  /* === ADC Calibration === */
  const [localCalib, setLocalCalib] = useState<Array<{ gain: number; offset: number }>>(
    Array.from({ length: 5 }, () => ({ gain: 1, offset: 0 })),
  )
  const [localCalibSaved, setLocalCalibSaved] = useState(false)

  useEffect(() => {
    if (calib && calib.gains && calib.gains.length > 0) {
      setLocalCalib(prev => calib.gains.map((g, i) => ({
        gain: g ?? prev[i]?.gain ?? 1,
        offset: calib.offsets[i] ?? prev[i]?.offset ?? 0,
      })))
    }
  }, [calib])

  const handleCalibChange = useCallback((ch: number, field: 'gain' | 'offset', val: number) => {
    setLocalCalib(prev => {
      const n = [...prev]
      n[ch] = { ...n[ch], [field]: val }
      return n
    })
  }, [])

  const handleCalibApply = useCallback(async (ch: number) => {
    if (!client || !connected) return
    const c = localCalib[ch]
    try {
      await client.writeCalibChannel(ch, c.gain, c.offset)
    } catch (e: any) { setError(e.message) }
  }, [client, connected, localCalib, setError])

  const handleCalibSaveToFlash = useCallback(async () => {
    if (!client || !connected) return
    setLocalCalibSaved(false)
    client.hold()
    try {
      await client.saveCalibToFlash()
      await new Promise(resolve => setTimeout(resolve, 1000))
      setLocalCalibSaved(true)
      setTimeout(() => setLocalCalibSaved(false), 2000)
    } catch (e: any) { setError(e.message) }
    finally { client.release() }
  }, [client, connected, setError])

  const handleCalibReset = useCallback(async () => {
    if (!client || !connected) return
    client.hold()
    try {
      await client.resetCalibToDefault()
    } catch (e: any) { setError(e.message) }
    finally { client.release() }
  }, [client, connected, setError])

  /* === Kalman Params === */
  const [localKalman, setLocalKalman] = useState<Array<{ q: number; r: number }>>(
    Array.from({ length: 6 }, () => ({ q: 0.01, r: 0.1 })),
  )

  useEffect(() => {
    if (kalman && kalman.q && kalman.q.length > 0) {
      setLocalKalman(prev => kalman.q.map((q, i) => ({
        q: q ?? prev[i]?.q ?? 0.01,
        r: kalman.r[i] ?? prev[i]?.r ?? 0.1,
      })))
    }
  }, [kalman])

  const handleKalmanChange = useCallback((ch: number, field: 'q' | 'r', val: number) => {
    setLocalKalman(prev => {
      const n = [...prev]
      n[ch] = { ...n[ch], [field]: val }
      return n
    })
  }, [])

  const handleKalmanApply = useCallback(async () => {
    if (!client || !connected) return
    try {
      await client.writeKalmanParams({
        qRoll: localKalman[0].q, rRoll: localKalman[0].r,
        qPitch: localKalman[1].q, rPitch: localKalman[1].r,
        qYaw: localKalman[2].q, rYaw: localKalman[2].r,
        qGyroX: localKalman[3].q, rGyroX: localKalman[3].r,
        qGyroY: localKalman[4].q, rGyroY: localKalman[4].r,
        qGyroZ: localKalman[5].q, rGyroZ: localKalman[5].r,
      })
    } catch (e: any) { setError(e.message) }
  }, [client, connected, localKalman, setError])

  const handleKalmanSave = useCallback(async () => {
    if (!client || !connected) return
    client.hold()
    try {
      await client.writeSingleRegister(REG.KALMAN_CMD, 0x5A5A, 'high')
    } catch (e: any) { setError(e.message) }
    finally { client.release() }
  }, [client, connected, setError])

  /* === Axis Mapping === */
  const [axisMapping, setAxisMapping] = useState<AxisMappingConfig>(() => loadAxisMapping())

  const handleAxisSave = useCallback(() => {
    try {
      localStorage.setItem('axisMapping', JSON.stringify(axisMapping))
    } catch {}
  }, [axisMapping])

  /* === Register Table === */
  const [regAddr, setRegAddr] = useState('0x0000')
  const [regCount, setRegCount] = useState('10')
  const [regResult, setRegResult] = useState<number[] | null>(null)
  const [regLoading, setRegLoading] = useState(false)

  const handleRegRead = useCallback(async () => {
    if (!client || !connected) return
    const addr = parseInt(regAddr, 16)
    const count = parseInt(regCount)
    if (isNaN(addr) || isNaN(count) || count < 1 || count > 64) {
      setError('无效的地址或数量'); return
    }
    setRegLoading(true)
    try {
      const regs = await client.readHoldingRegisters(addr, count)
      setRegResult(regs)
    } catch (e: any) { setError(e.message) }
    finally { setRegLoading(false) }
  }, [client, connected, regAddr, regCount, setError])

  return (
    <div className="page-container animate-fade-in">
      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
        {/* ADC Calibration */}
        <Card title="ADC 校准" icon={<Crosshair className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          <div className="flex items-center gap-2 mb-3">
            <button className="btn btn-sm btn-success" onClick={handleCalibSaveToFlash} disabled={!connected}>
              <Save className="w-3 h-3 mr-1" />{localCalibSaved ? '已保存' : '保存到 Flash'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={handleCalibReset} disabled={!connected}>
              <RotateCcw className="w-3 h-3 mr-1" />恢复默认
            </button>
          </div>
          {localCalib.map((ch, i) => (
            <div key={i} className="flex items-center gap-2 mb-2 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <span className="text-xs w-16" style={{ color: 'var(--fg-secondary)' }}>CH{i + 1}</span>
              <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>增益</span>
              <input className="input w-16" type="number" step={0.01}
                value={ch.gain} onChange={e => handleCalibChange(i, 'gain', Number(e.target.value))}
                disabled={!connected} />
              <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>偏移</span>
              <input className="input w-20" type="number" step={0.1}
                value={ch.offset} onChange={e => handleCalibChange(i, 'offset', Number(e.target.value))}
                disabled={!connected} />
              <button className="btn btn-sm btn-primary ml-auto"
                onClick={() => handleCalibApply(i)} disabled={!connected}>
                应用
              </button>
            </div>
          ))}
        </Card>

        {/* Kalman Filter */}
        <Card title="卡尔曼滤波参数" icon={<Sliders className="w-4 h-4" style={{ color: 'var(--success)' }} />}>
          <div className="flex items-center gap-2 mb-3">
            <button className="btn btn-sm btn-primary" onClick={handleKalmanApply} disabled={!connected}>
              应用全部
            </button>
            <button className="btn btn-sm btn-ghost" onClick={handleKalmanSave} disabled={!connected}>
              <Save className="w-3 h-3 mr-1" />保存到 Flash
            </button>
          </div>
          {localKalman.map((ch, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 p-1.5 rounded" style={{ background: 'var(--bg-input)' }}>
              <span className="text-[10px] w-16" style={{ color: 'var(--fg-secondary)' }}>{KALMAN_CH_NAMES[i]}</span>
              <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>Q</span>
              <input className="input w-16" type="number" step={0.0001} min={0.0001} max={0.1}
                value={ch.q} onChange={e => handleKalmanChange(i, 'q', Number(e.target.value))}
                disabled={!connected} />
              <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>R</span>
              <input className="input w-20" type="number" step={0.01} min={0.01} max={10}
                value={ch.r} onChange={e => handleKalmanChange(i, 'r', Number(e.target.value))}
                disabled={!connected} />
            </div>
          ))}
        </Card>

        {/* Axis Mapping */}
        <Card title="传感器轴映射" icon={<Repeat className="w-4 h-4" style={{ color: 'var(--warning)' }} />}>
          <div className="mb-3 p-2 rounded-lg text-xs" style={{ background: 'var(--bg-input)', color: 'var(--fg-secondary)' }}>
            调整传感器安装方向偏差。映射公式: 目标 = 源 × 符号 + 偏移
          </div>
          {/* Roll */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs w-10" style={{ color: 'var(--fg-secondary)' }}>Roll</span>
            <select className="input flex-1 text-xs"
              value={axisMapping.rollSource}
              onChange={e => setAxisMapping(prev => ({ ...prev, rollSource: Number(e.target.value) as 0 | 1 | 2 }))}>
              {SENSOR_AXIS_NAMES.map((name, si) => (
                <option key={si} value={si}>{name}</option>
              ))}
            </select>
            <select className="input w-16 text-xs"
              value={axisMapping.rollSign}
              onChange={e => setAxisMapping(prev => ({ ...prev, rollSign: Number(e.target.value) as 1 | -1 }))}>
              <option value={1}>+</option>
              <option value={-1}>-</option>
            </select>
            <input className="input w-16 text-xs" type="number" step={0.1}
              value={axisMapping.rollOffset}
              onChange={e => setAxisMapping(prev => ({ ...prev, rollOffset: Number(e.target.value) }))} />
          </div>
          {/* Pitch */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs w-10" style={{ color: 'var(--fg-secondary)' }}>Pitch</span>
            <select className="input flex-1 text-xs"
              value={axisMapping.pitchSource}
              onChange={e => setAxisMapping(prev => ({ ...prev, pitchSource: Number(e.target.value) as 0 | 1 | 2 }))}>
              {SENSOR_AXIS_NAMES.map((name, si) => (
                <option key={si} value={si}>{name}</option>
              ))}
            </select>
            <select className="input w-16 text-xs"
              value={axisMapping.pitchSign}
              onChange={e => setAxisMapping(prev => ({ ...prev, pitchSign: Number(e.target.value) as 1 | -1 }))}>
              <option value={1}>+</option>
              <option value={-1}>-</option>
            </select>
            <input className="input w-16 text-xs" type="number" step={0.1}
              value={axisMapping.pitchOffset}
              onChange={e => setAxisMapping(prev => ({ ...prev, pitchOffset: Number(e.target.value) }))} />
          </div>
          {/* Yaw */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs w-10" style={{ color: 'var(--fg-secondary)' }}>Yaw</span>
            <select className="input flex-1 text-xs"
              value={axisMapping.yawSource}
              onChange={e => setAxisMapping(prev => ({ ...prev, yawSource: Number(e.target.value) as 0 | 1 | 2 }))}>
              {SENSOR_AXIS_NAMES.map((name, si) => (
                <option key={si} value={si}>{name}</option>
              ))}
            </select>
            <select className="input w-16 text-xs"
              value={axisMapping.yawSign}
              onChange={e => setAxisMapping(prev => ({ ...prev, yawSign: Number(e.target.value) as 1 | -1 }))}>
              <option value={1}>+</option>
              <option value={-1}>-</option>
            </select>
            <input className="input w-16 text-xs" type="number" step={0.1}
              value={axisMapping.yawOffset}
              onChange={e => setAxisMapping(prev => ({ ...prev, yawOffset: Number(e.target.value) }))} />
          </div>
          <button className="btn btn-sm btn-primary w-full" onClick={handleAxisSave}>
            保存映射配置
          </button>
        </Card>

        {/* Register Table */}
        <Card title="寄存器读取" icon={<Table2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>起始地址</span>
            <input className="input w-24 font-mono text-center"
              value={regAddr} onChange={e => setRegAddr(e.target.value)}
              disabled={!connected} />
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>数量</span>
            <input className="input w-16 text-center"
              value={regCount} onChange={e => setRegCount(e.target.value)}
              disabled={!connected} />
            <button className="btn btn-sm btn-primary"
              onClick={handleRegRead} disabled={!connected || regLoading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${regLoading ? 'animate-spin' : ''}`} />读取
            </button>
          </div>
          {regResult && (
            <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {regResult.map((v, i) => (
                <div key={i} className="text-center p-1 rounded text-xs font-mono"
                  style={{ background: 'var(--bg-input)', color: 'var(--fg-secondary)' }}>
                  {`0x${(parseInt(regAddr, 16) + i).toString(16).toUpperCase().padStart(4, '0')}`}
                  <br />
                  <span style={{ color: 'var(--accent)' }}>{`0x${v.toString(16).toUpperCase().padStart(4, '0')}`}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Communication Log */}
        <Card title="通信日志" icon={<Terminal className="w-4 h-4" style={{ color: 'var(--fg-muted)' }} />}
          className="md:col-span-2">
          <div className="max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed"
            style={{ background: '#060f1a', borderRadius: '8px', padding: '12px', color: 'var(--fg-muted)' }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--fg-muted)' }}>暂无日志...</div>
            ) : (
              logs.slice(-200).map((log, i) => (
                <div key={i} className="mb-0.5">
                  <span className="opacity-50">{log.time}</span>{' '}
                  <span style={{
                    color: log.dir === 'TX' ? 'var(--accent)' :
                           log.dir === 'RX' ? 'var(--success)' :
                           log.dir === 'ERR' ? 'var(--danger)' : 'var(--fg-muted)',
                  }}>{log.dir}</span>{' '}
                  <span>{log.data}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
