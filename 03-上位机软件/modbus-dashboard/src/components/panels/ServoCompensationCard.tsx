import { useState, useEffect } from 'react'
import { Sliders, Save, RotateCcw, Zap } from 'lucide-react'
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
    <Card title={`舵机 ${servoIndex + 1}`} icon={<Sliders className="w-4 h-4 text-blue-400" />}>
      <div className="space-y-4">
        {/* 顶部：自动补偿开关 + 保存按钮 */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={data.autoEnabled}
                onChange={(e) => onToggleAuto(servoIndex, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
            <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
              自动补偿
            </span>
          </label>
          
          <button
            onClick={() => onSave(servoIndex)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            title="保存到 Flash"
          >
            <Save className="w-3 h-3" />
            保存
          </button>
        </div>

        {/* 核心预览区 - 最醒目的位置 */}
        {attitude && (
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/30 p-4">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">目标角度</div>
                <div className="text-3xl font-bold text-white tabular-nums">
                  {previewAngle.toFixed(1)}°
                </div>
              </div>
              
              <div className="text-right space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">PWM 脉冲</div>
                <div className="text-2xl font-bold text-blue-400 tabular-nums">
                  {previewPWM} <span className="text-sm text-gray-400">μs</span>
                </div>
              </div>
            </div>

            {/* 姿态数据迷你显示 */}
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-sky-400 mb-0.5">Roll</div>
                <div className="text-sm font-mono text-white">{attitude.roll.toFixed(1)}°</div>
              </div>
              <div>
                <div className="text-[10px] text-emerald-400 mb-0.5">Pitch</div>
                <div className="text-sm font-mono text-white">{attitude.pitch.toFixed(1)}°</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-400 mb-0.5">Yaw</div>
                <div className="text-sm font-mono text-white">{attitude.yaw.toFixed(1)}°</div>
              </div>
            </div>
          </div>
        )}

        {/* 参数配置区 */}
        <div className="space-y-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">补偿系数</div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">基础角度 (°)</label>
              <input
                type="number"
                step="0.1"
                value={editBase}
                onChange={(e) => setEditBase(e.target.value)}
                onBlur={() => handleSaveField('baseAngle', editBase)}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">K_Roll</label>
              <input
                type="number"
                step="0.001"
                value={editKRoll}
                onChange={(e) => setEditKRoll(e.target.value)}
                onBlur={() => handleSaveField('kRoll', editKRoll)}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">K_Pitch</label>
              <input
                type="number"
                step="0.001"
                value={editKPitch}
                onChange={(e) => setEditKPitch(e.target.value)}
                onBlur={() => handleSaveField('kPitch', editKPitch)}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400">K_Yaw</label>
              <input
                type="number"
                step="0.001"
                value={editKYaw}
                onChange={(e) => setEditKYaw(e.target.value)}
                onBlur={() => handleSaveField('kYaw', editKYaw)}
                className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-800/50 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* 补偿公式展示 */}
        <div className="p-2 rounded bg-gray-800/50 border border-gray-700">
          <div className="text-[10px] text-gray-400 mb-1">计算公式</div>
          <div className="text-xs font-mono text-gray-300 leading-relaxed">
            θ = {data.baseAngle.toFixed(1)} + ({data.kRoll.toFixed(3)})×R + ({data.kPitch.toFixed(3)})×P + ({data.kYaw.toFixed(3)})×Y
          </div>
        </div>

        {/* 快速预设 - 紧凑的单行布局 */}
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] text-gray-400">快速预设:</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                onUpdate(servoIndex, 'baseAngle', 0)
                onUpdate(servoIndex, 'kRoll', 0)
                onUpdate(servoIndex, 'kPitch', 0)
                onUpdate(servoIndex, 'kYaw', 0)
              }}
              className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              title="重置所有系数为 0"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              重置
            </button>
            <button
              onClick={() => {
                onUpdate(servoIndex, 'kRoll', 1.0)
                onUpdate(servoIndex, 'kPitch', 0)
                onUpdate(servoIndex, 'kYaw', 0)
              }}
              className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="仅响应 Roll 轴"
            >
              Roll
            </button>
            <button
              onClick={() => {
                onUpdate(servoIndex, 'kRoll', 0)
                onUpdate(servoIndex, 'kPitch', 1.0)
                onUpdate(servoIndex, 'kYaw', 0)
              }}
              className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="仅响应 Pitch 轴"
            >
              Pitch
            </button>
            <button
              onClick={() => {
                onUpdate(servoIndex, 'kRoll', 0.5)
                onUpdate(servoIndex, 'kPitch', 0.5)
                onUpdate(servoIndex, 'kYaw', 0)
              }}
              className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Roll + Pitch 均衡补偿"
            >
              R+P
            </button>
            <button
              onClick={() => {
                onUpdate(servoIndex, 'kRoll', 0.33)
                onUpdate(servoIndex, 'kPitch', 0.33)
                onUpdate(servoIndex, 'kYaw', 0.33)
              }}
              className="px-2 py-1 text-[10px] rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="三轴均衡补偿"
            >
              全向
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
