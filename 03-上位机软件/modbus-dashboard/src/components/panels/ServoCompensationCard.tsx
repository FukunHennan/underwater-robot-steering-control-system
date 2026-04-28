import { useState, useEffect } from 'react'
import { Sliders, RefreshCw, Save, RotateCcw } from 'lucide-react'
import type { AttitudeData } from '../../lib/types'
import { Card } from '../common/Card'

interface ServoCompensationData {
  baseAngle: number
  kRoll: number
  kPitch: number
  kYaw: number
  autoEnabled: boolean
}

interface ServoCompensationPanelProps {
  servoIndex: number
  data: ServoCompensationData
  attitude: AttitudeData | null
  onUpdate: (index: number, field: keyof ServoCompensationData, value: number) => void
  onToggleAuto: (index: number, enabled: boolean) => void
  onSave: (index: number) => void
}

export function ServoCompensationCard({
  servoIndex,
  data,
  attitude,
  onUpdate,
  onToggleAuto,
  onSave,
}: ServoCompensationPanelProps) {
  const [editBase, setEditBase] = useState(data.baseAngle.toString())
  const [editKRoll, setEditKRoll] = useState(data.kRoll.toString())
  const [editKPitch, setEditKPitch] = useState(data.kPitch.toString())
  const [editKYaw, setEditKYaw] = useState(data.kYaw.toString())

  // Sync local state when data changes
  useEffect(() => {
    setEditBase(data.baseAngle.toFixed(2))
    setEditKRoll(data.kRoll.toFixed(3))
    setEditKPitch(data.kPitch.toFixed(3))
    setEditKYaw(data.kYaw.toFixed(3))
  }, [data])

  const calculatePreview = () => {
    if (!attitude) return 0
    const angle = data.baseAngle + 
                  data.kRoll * attitude.roll + 
                  data.kPitch * attitude.pitch + 
                  data.kYaw * attitude.yaw
    return angle
  }

  const calculatePWM = (angle: number) => {
    return Math.round(1500 + angle * 10)
  }

  const handleSaveField = (field: keyof ServoCompensationData, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      onUpdate(servoIndex, field, num)
    }
  }

  const previewAngle = calculatePreview()
  const previewPWM = calculatePWM(previewAngle)

  return (
    <Card title={`舵机 ${servoIndex + 1} 姿态补偿`} icon={<Sliders className="w-4 h-4" />}>
      <div className="flex items-center justify-end mb-3">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={data.autoEnabled}
            onChange={(e) => onToggleAuto(servoIndex, e.target.checked)}
            className="rounded border-[--border] bg-[--bg-elevated]"
          />
          <span className="text-[--fg-muted]">自动补偿</span>
        </label>
        <button
          onClick={() => onSave(servoIndex)}
          className="p-1 rounded hover:bg-[--bg-elevated] transition-colors"
          title="保存参数"
        >
          <Save className="w-3.5 h-3.5 text-[--fg-muted]" />
        </button>
      </div>

      {/* Coefficient inputs */}
      <div className="space-y-2 mb-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[--fg-muted] block mb-1">基础角度 (°)</label>
            <input
              type="number"
              step="0.1"
              value={editBase}
              onChange={(e) => setEditBase(e.target.value)}
              onBlur={() => handleSaveField('baseAngle', editBase)}
              className="w-full px-2 py-1 text-xs rounded border border-[--border] bg-[--bg-elevated] text-[--fg] focus:border-[--accent] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[--fg-muted] block mb-1">K_Roll</label>
            <input
              type="number"
              step="0.001"
              value={editKRoll}
              onChange={(e) => setEditKRoll(e.target.value)}
              onBlur={() => handleSaveField('kRoll', editKRoll)}
              className="w-full px-2 py-1 text-xs rounded border border-[--border] bg-[--bg-elevated] text-[--fg] focus:border-[--accent] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[--fg-muted] block mb-1">K_Pitch</label>
            <input
              type="number"
              step="0.001"
              value={editKPitch}
              onChange={(e) => setEditKPitch(e.target.value)}
              onBlur={() => handleSaveField('kPitch', editKPitch)}
              className="w-full px-2 py-1 text-xs rounded border border-[--border] bg-[--bg-elevated] text-[--fg] focus:border-[--accent] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[--fg-muted] block mb-1">K_Yaw</label>
            <input
              type="number"
              step="0.001"
              value={editKYaw}
              onChange={(e) => setEditKYaw(e.target.value)}
              onBlur={() => handleSaveField('kYaw', editKYaw)}
              className="w-full px-2 py-1 text-xs rounded border border-[--border] bg-[--bg-elevated] text-[--fg] focus:border-[--accent] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Formula display */}
      <div className="mb-3 p-2 rounded bg-[--bg-elevated] border border-[--border]">
        <div className="text-[10px] text-[--fg-muted] mb-1">补偿公式:</div>
        <div className="text-xs font-mono text-[--fg]">
          Angle = {data.baseAngle.toFixed(1)} + {data.kRoll.toFixed(3)}×Roll + {data.kPitch.toFixed(3)}×Pitch + {data.kYaw.toFixed(3)}×Yaw
        </div>
      </div>

      {/* Preview with current attitude */}
      {attitude && (
        <div className="space-y-1">
          <div className="text-[10px] text-[--fg-muted]">当前姿态预览:</div>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
            <div className="px-2 py-1 rounded bg-sky-500/10 text-sky-400">
              Roll: {attitude.roll.toFixed(1)}°
            </div>
            <div className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
              Pitch: {attitude.pitch.toFixed(1)}°
            </div>
            <div className="px-2 py-1 rounded bg-amber-500/10 text-amber-400">
              Yaw: {attitude.yaw.toFixed(1)}°
            </div>
          </div>
          
          <div className="mt-2 p-2 rounded bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[--fg-muted]">补偿后角度</div>
                <div className="text-lg font-bold text-[--fg]">{previewAngle.toFixed(1)}°</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[--fg-muted]">PWM 脉冲</div>
                <div className="text-lg font-bold text-[--accent]">{previewPWM} μs</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick presets */}
      <div className="mt-3 pt-2 border-t border-[--border]">
        <div className="text-[10px] text-[--fg-muted] mb-2">快速预设:</div>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => {
              onUpdate(servoIndex, 'baseAngle', 0)
              onUpdate(servoIndex, 'kRoll', 0)
              onUpdate(servoIndex, 'kPitch', 0)
              onUpdate(servoIndex, 'kYaw', 0)
            }}
            className="px-2 py-1 text-[10px] rounded bg-[--bg-elevated] hover:bg-[--bg-hover] text-[--fg-muted] transition-colors flex items-center justify-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
          <button
            onClick={() => {
              onUpdate(servoIndex, 'kRoll', 1.0)
              onUpdate(servoIndex, 'kPitch', 0)
              onUpdate(servoIndex, 'kYaw', 0)
            }}
            className="px-2 py-1 text-[10px] rounded bg-[--bg-elevated] hover:bg-[--bg-hover] text-[--fg-muted] transition-colors"
          >
            仅 Roll
          </button>
          <button
            onClick={() => {
              onUpdate(servoIndex, 'kRoll', 0.5)
              onUpdate(servoIndex, 'kPitch', 0.5)
              onUpdate(servoIndex, 'kYaw', 0)
            }}
            className="px-2 py-1 text-[10px] rounded bg-[--bg-elevated] hover:bg-[--bg-hover] text-[--fg-muted] transition-colors"
          >
            Roll+Pitch
          </button>
          <button
            onClick={() => {
              onUpdate(servoIndex, 'kRoll', 0.33)
              onUpdate(servoIndex, 'kPitch', 0.33)
              onUpdate(servoIndex, 'kYaw', 0.33)
            }}
            className="px-2 py-1 text-[10px] rounded bg-[--bg-elevated] hover:bg-[--bg-hover] text-[--fg-muted] transition-colors"
          >
            三轴均衡
          </button>
        </div>
      </div>
    </Card>
  )
}
