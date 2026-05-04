import { useDeviceData } from '@/stores/DeviceDataContext'
import { useConnection } from '@/stores/ConnectionContext'
import { Card } from '@/components/common/Card'
import { Metric } from '@/components/common/Metric'
import { Cpu, Battery, Thermometer, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { stateLabel } from '@/lib/presets'
import type { ConnectionState } from '@/lib/modbus'

const stateColors: Record<ConnectionState, string> = {
  connected: 'var(--success)',
  connecting: 'var(--warning)',
  disconnected: 'var(--fg-muted)',
  error: 'var(--danger)',
}

export function SystemPage() {
  const { system, adc } = useDeviceData()
  const { connState, reconnectInfo } = useConnection()

  const fwMajor = system ? system.fwVersion >> 8 : 0
  const fwMinor = system ? system.fwVersion & 0xff : 0

  return (
    <div className="page-container animate-fade-in">
      {/* Connection Status */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)' }}>
            <Activity className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>通信状态</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: stateColors[connState] }} />
              <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>
                {reconnectInfo
                  ? `重连中 ${reconnectInfo.attempt}/${reconnectInfo.max}`
                  : stateLabel[connState]}
              </span>
              {connState === 'connected' && (
                <span className="badge" style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--success)' }}>
                  <CheckCircle className="w-3 h-3 mr-1" /> 已连接
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        <Card title="系统信息" icon={<Cpu className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          <div className="grid grid-cols-2 gap-5">
            <Metric label="设备 ID" value={system ? `0x${system.deviceId.toString(16).toUpperCase().padStart(4, '0')}` : '--'} />
            <Metric label="固件版本" value={system ? `V${fwMajor}.${fwMinor}` : '--'} />
            <Metric label="运行模式" value={system ? (system.runMode === 1 ? '正常' : system.runMode === 0 ? '待机' : `模式${system.runMode}`) : '--'} />
            <Metric label="故障代码" value={system ? `0x${system.faultCode?.toString(16).toUpperCase().padStart(4, '0') ?? '0000'}` : '--'} color={system?.faultCode ? 'var(--danger)' : undefined} />
            <Metric label="运行时间" value={system ? `${(system.sysTick / 1000).toFixed(1)}s` : '--'} />
          </div>
        </Card>

        {/* Power Status */}
        <Card title="电源状态" icon={<Battery className="w-4 h-4" style={{ color: 'var(--success)' }} />}>
          <div className="grid grid-cols-2 gap-5">
            <Metric label="供电电压" value={adc ? adc.voltage.toFixed(2) : '--'} unit="V" color={adc && adc.voltage < 10.5 ? 'var(--danger)' : 'var(--success)'} />
            <Metric label="ADC 原始值" value={adc ? adc.adcRaw.join(' / ') : '--'} />
          </div>
        </Card>

        {/* Temperature Channels */}
        <Card title="温度传感器" icon={<Thermometer className="w-4 h-4" style={{ color: 'var(--warning)' }} />}>
          <div className="grid grid-cols-2 gap-5">
            {adc && adc.temps.length > 0 ? (
              adc.temps.map((t, i) => (
                <Metric key={i} label={`通道 ${i + 1}`} value={t.toFixed(1)} unit="°C"
                  color={t > 60 ? 'var(--danger)' : t > 45 ? 'var(--warning)' : undefined} />
              ))
            ) : (
              <div className="col-span-2 text-xs" style={{ color: 'var(--fg-muted)' }}>暂无数据</div>
            )}
          </div>
        </Card>

        {/* Fault Status */}
        <Card title="设备状态" icon={<AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>故障指示</span>
              <span className={`text-xs font-mono font-bold ${system?.faultCode ? 'text-[--danger]' : 'text-[--success]'}`}>
                {system?.faultCode ? `故障 (${system.faultCode})` : '正常'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <span className="text-xs" style={{ color: 'var(--fg-secondary)' }}>系统滴答</span>
              <span className="text-xs font-mono" style={{ color: 'var(--fg-primary)' }}>{system?.sysTick ?? '--'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
