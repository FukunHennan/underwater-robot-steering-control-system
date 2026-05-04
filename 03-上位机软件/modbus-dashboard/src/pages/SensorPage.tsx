import { useDeviceData } from '@/stores/DeviceDataContext'
import { Card } from '@/components/common/Card'
import { Metric } from '@/components/common/Metric'
import AttitudeModel from '@/components/AttitudeModel'
import { Compass, Radar, Gauge, Thermometer, Waves } from 'lucide-react'

export function SensorPage() {
  const { attitude, baro, mag, adc } = useDeviceData()

  return (
    <div className="page-container animate-fade-in">
      {/* Attitude + 3D Model row */}
      <div className="panel-grid" style={{ gridTemplateColumns: '1fr 360px' }}>
        <Card title="姿态数据" icon={<Compass className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          <div className="grid grid-cols-3 gap-5 mb-4">
            <div className="flex flex-col items-center p-4 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))', border: '1px solid rgba(6,182,212,0.2)' }}>
              <span className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--accent-dim)' }}>Roll 横滚</span>
              <span className="text-3xl font-bold font-mono" style={{ color: 'var(--accent)' }}>
                {attitude ? attitude.roll.toFixed(1) : '--'}°
              </span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.15), rgba(45,212,191,0.05))', border: '1px solid rgba(45,212,191,0.2)' }}>
              <span className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--success)' }}>Pitch 俯仰</span>
              <span className="text-3xl font-bold font-mono" style={{ color: 'var(--success)' }}>
                {attitude ? attitude.pitch.toFixed(1) : '--'}°
              </span>
            </div>
            <div className="flex flex-col items-center p-4 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--warning)' }}>Yaw 偏航</span>
              <span className="text-3xl font-bold font-mono" style={{ color: 'var(--warning)' }}>
                {attitude ? attitude.yaw.toFixed(1) : '--'}°
              </span>
            </div>
          </div>
          {/* Gyro data */}
          {attitude && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--fg-muted)' }}>陀螺仪 (deg/s)</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--accent)' }}>X</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--fg-secondary)' }}>{attitude.gyroX.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--success)' }}>Y</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--fg-secondary)' }}>{attitude.gyroY.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--warning)' }}>Z</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--fg-secondary)' }}>{attitude.gyroZ.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 3D Model */}
        <div className="card overflow-hidden">
          {attitude ? (
            <AttitudeModel roll={attitude.roll} pitch={attitude.pitch} yaw={attitude.yaw} />
          ) : (
            <div className="flex items-center justify-center h-80">
              <div className="text-center">
                <Waves className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--fg-muted)' }} />
                <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>等待姿态数据...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barometer + Magnetometer + ADC Temps */}
      <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        <Card title="气压计" icon={<Radar className="w-4 h-4" style={{ color: 'var(--accent)' }} />}>
          <div className="grid grid-cols-2 gap-5">
            <Metric label="气压" value={baro ? baro.pressure.toLocaleString() : '--'} unit="Pa" />
            <Metric label="海拔" value={baro ? baro.altitude.toFixed(1) : '--'} unit="m" />
            <Metric label="温度" value={baro ? baro.temperature.toFixed(1) : '--'} unit="°C" />
          </div>
        </Card>

        <Card title="磁力计" icon={<Gauge className="w-4 h-4" style={{ color: 'var(--warning)' }} />}>
          <div className="grid grid-cols-2 gap-5">
            <Metric label="Mag X" value={mag ? mag.magX.toFixed(2) : '--'} unit="µT" />
            <Metric label="Mag Y" value={mag ? mag.magY.toFixed(2) : '--'} unit="µT" />
            <Metric label="Mag Z" value={mag ? mag.magZ.toFixed(2) : '--'} unit="µT" />
            <Metric label="温度" value={mag ? mag.temperature.toFixed(1) : '--'} unit="°C" />
          </div>
        </Card>

        <Card title="温度传感器" icon={<Thermometer className="w-4 h-4" style={{ color: 'var(--danger)' }} />}>
          <div className="grid grid-cols-2 gap-4">
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
      </div>
    </div>
  )
}
