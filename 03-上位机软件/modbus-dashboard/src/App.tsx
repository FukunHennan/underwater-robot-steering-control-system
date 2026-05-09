import { useState, useEffect, useCallback } from 'react'
import {
  Waves, Plug, PlugZap, RefreshCw, AlertTriangle,
  Monitor, Activity, Server, Radio, Settings,
} from 'lucide-react'
import { type ConnectionState } from './lib/modbus'
import { stateLabel } from './lib/presets'
import { usePolling } from './hooks/usePolling'
import { useConnection, ConnectionProvider } from './stores/ConnectionContext'
import { useDeviceData, DeviceDataProvider } from './stores/DeviceDataContext'
import { useUI, UIProvider, type PageView } from './stores/UIContext'
import { SystemPage } from './pages/SystemPage'
import { SensorPage } from './pages/SensorPage'
import { ServoPage } from './pages/ServoPage'
import { PeripheralPage } from './pages/PeripheralPage'
import { AdvancedPage } from './pages/AdvancedPage'

const NAV_ITEMS: { id: PageView; label: string; icon: React.ReactNode }[] = [
  { id: 'system', label: '系统', icon: <Monitor className="w-4 h-4" /> },
  { id: 'sensor', label: '传感器', icon: <Activity className="w-4 h-4" /> },
  { id: 'servo', label: '舵机', icon: <Server className="w-4 h-4" /> },
  { id: 'peripheral', label: '外设', icon: <Radio className="w-4 h-4" /> },
  { id: 'advanced', label: '高级', icon: <Settings className="w-4 h-4" /> },
]

function AppShell() {
  const { client, connState, reconnectInfo, handleConnect, handleDisconnect } = useConnection()
  const { setSystem, setAttitude, setPwm, setPwmFreq, setAdc, setBaro, setMag,
    setGpio, setIr, setCalib, setKalman, appendAttHistory, clearAttHistory } = useDeviceData()
  const { view, setView, polling, pollInterval, togglePolling, setPollInterval, error, setError } = useUI()

  useEffect(() => {
    if (!window.location.search.includes('mock')) return
    setSystem({ deviceId: 0x0407, fwVersion: 0x0300, runMode: 1, faultCode: 0, sysTick: 156320 })
    setAttitude({ roll: 12.35, pitch: -3.78, yaw: 156.42, gyroX: 0.52, gyroY: -1.23, gyroZ: 0.08 })
    setPwm({ servos: [1500, 1620, 1380, 1500, 1750, 1500, 1200, 1500], leds: [680, 250] })
    setPwmFreq({ groups: [{ arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }, { arr: 19999, psc: 83 }] })
    setAdc({ temps: [25.6, 18.3, 31.2, 22.8], voltage: 5.12, adcRaw: [3, 2, 3, 2, 1118] })
    setBaro({ pressure: 101325, altitude: 2850, temperature: 24.6 })
    setMag({ magX: 23.5, magY: -12.3, magZ: 45.8, temperature: 25.2 })
    setCalib({ gains: [1.143, 1, 1, 1, 1], offsets: [0, 0, 0, 0, 0], status: 0 })
    setKalman({ q: [0.001, 0.001, 0.001, 0.001, 0.001, 0.001], r: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] })
    setGpio({ modes: [0, 1, 0, 1], outputs: [0, 1, 0, 1], inputs: [0, 1, 1, 0] })
    setIr({ txCmd: 0, txData: 0x1234, rxStatus: 0, rxData: 0x1234 })
  }, [])

  const pollSequential = useCallback(async () => {
    if (connState !== 'connected') return
    try {
      setError('')
      const sys = await client.readSystem().catch((e: any) => {
        setError(e.message || 'Modbus 通讯失败')
        return null
      })
      if (!sys) return
      setSystem(sys)
      if (client.hasPendingWrites()) return

      const att = await client.readAttitude().catch(() => null)
      if (att) { setAttitude(att); appendAttHistory(att) }
      if (client.hasPendingWrites()) return

      const p = await client.readPWM().catch(() => null)
      if (p) setPwm(p)
      if (client.hasPendingWrites()) return

      const f = await client.readPWMFreq().catch(() => null)
      if (f) setPwmFreq(f)
      if (client.hasPendingWrites()) return

      const a = await client.readADC().catch(() => null)
      if (a) setAdc(a)
      if (client.hasPendingWrites()) return

      const b = await client.readBarometer().catch(() => null)
      if (b) setBaro(b)
      if (client.hasPendingWrites()) return

      const m = await client.readMagnetometer().catch(() => null)
      if (m) setMag(m)
      if (client.hasPendingWrites()) return

      const g = await client.readGPIO().catch(() => null)
      if (g) setGpio(g)
      if (client.hasPendingWrites()) return

      const ir = await client.readIR().catch(() => null)
      if (ir) setIr(ir)
    } catch (e: any) { setError(e.message) }
  }, [connState, client])

  const { pollingRef } = usePolling({
    enabled: polling && connState === 'connected',
    intervalMs: pollInterval,
    pollFn: pollSequential,
    isBusy: useCallback(() => client?.hasPendingWrites() ?? false, [client]),
  })

  const handleTogglePolling = () => {
    if (polling) { pollingRef.current = false; togglePolling() }
    else togglePolling()
  }

  const handleConnectAction = async () => {
    try {
      setError('')
      await handleConnect()
      const sys = await client.readSystem('high')
      setSystem(sys)
      clearAttHistory()
      client.readCalibration().then(setCalib).catch(() => null)
      client.readKalmanParams().then(kp => setKalman({
        q: [kp.qRoll, kp.qPitch, kp.qYaw, kp.qGyroX, kp.qGyroY, kp.qGyroZ],
        r: [kp.rRoll, kp.rPitch, kp.rYaw, kp.rGyroX, kp.rGyroY, kp.rGyroZ],
      })).catch(() => null)
      client.readGPIO().then(setGpio).catch(() => null)
      client.readIR().then(setIr).catch(() => null)
    } catch (e: any) { setError(e.message) }
  }

  const handleDisconnectAction = async () => {
    pollingRef.current = false; if (polling) togglePolling(); await handleDisconnect()
  }

  const stateColors: Record<ConnectionState, string> = {
    connected: 'var(--success)',
    connecting: 'var(--warning)',
    disconnected: 'var(--fg-muted)',
    error: 'var(--danger)',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 flex flex-col" style={{ background: 'var(--sidebar-bg)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.15)' }}>
            <Waves className="w-4.5 h-4.5" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: 'var(--fg-primary)' }}>ROV 监控</span>
            <span className="text-[10px]" style={{ color: 'var(--fg-muted)' }}>v1.0 · Slave 0x01</span>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: view === item.id ? 'var(--sidebar-active)' : 'transparent',
                color: view === item.id ? 'var(--accent)' : 'var(--fg-secondary)',
              }}
              onMouseEnter={e => { if (view !== item.id) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
              onMouseLeave={e => { if (view !== item.id) e.currentTarget.style.background = 'transparent' }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        {/* Connection status in sidebar */}
        <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: stateColors[connState] }} />
          <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
            {reconnectInfo ? `重连 ${reconnectInfo.attempt}/${reconnectInfo.max}` : stateLabel[connState]}
          </span>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <header className="flex items-center justify-between px-5 py-2.5 border-b shrink-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>
              {NAV_ITEMS.find(n => n.id === view)?.label || ''}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--accent)' }}>
              {connState === 'connected' ? '已连接' : '未连接'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {connState === 'connected' ? (
              <>
                <button className="btn btn-ghost" onClick={handleTogglePolling}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {polling ? '停止' : '轮询'}
                </button>
                <select value={pollInterval} onChange={e => setPollInterval(Number(e.target.value))}
                  className="input text-xs py-1 w-[90px]">
                  <option value={200}>200ms</option>
                  <option value={500}>500ms</option>
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                </select>
                <button className="btn btn-ghost" onClick={() => pollSequential()}>读一次</button>
                <button className="btn btn-danger" onClick={handleDisconnectAction}>
                  <PlugZap className="w-3.5 h-3.5" /> 断开
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={handleConnectAction} disabled={connState === 'connecting'}>
                <Plug className="w-3.5 h-3.5" /> 连接串口
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-5 py-2 text-xs" style={{ background: 'var(--danger-bg)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--danger)' }} />
            <span style={{ color: 'var(--danger)' }}>{error}</span>
            <button onClick={() => setError('')} className="ml-auto" style={{ color: 'var(--danger)' }}>✕</button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
          {view === 'system' && <SystemPage />}
          {view === 'sensor' && <SensorPage />}
          {view === 'servo' && <ServoPage />}
          {view === 'peripheral' && <PeripheralPage />}
          {view === 'advanced' && <AdvancedPage />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ConnectionProvider>
      <DeviceDataProvider>
        <UIProvider>
          <AppShell />
        </UIProvider>
      </DeviceDataProvider>
    </ConnectionProvider>
  )
}
