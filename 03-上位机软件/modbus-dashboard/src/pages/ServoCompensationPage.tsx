import { useState, useEffect } from 'react'
import { ModbusClient, REG } from '../lib/modbus'
import { ServoCompensationCard } from '../components/panels/ServoCompensationCard'
import { AlertTriangle, Zap, RefreshCw, Save } from 'lucide-react'
import type { AttitudeData } from '../lib/types'

interface ServoCompensationPageProps {
  client: ModbusClient | null
}

export function ServoCompensationPage({ client }: ServoCompensationPageProps) {
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [servoComp, setServoComp] = useState<Array<{
    baseAngle: number
    kRoll: number
    kPitch: number
    kYaw: number
    autoEnabled: boolean
  }>>(Array(8).fill(null).map(() => ({
    baseAngle: 0,
    kRoll: 0,
    kPitch: 0,
    kYaw: 0,
    autoEnabled: false,
  })))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 读取姿态数据
  const readAttitude = async () => {
    if (!client) return
    try {
      const data = await client.readAttitude()
      setAttitude(data)
    } catch (err) {
      console.error('读取姿态失败:', err)
    }
  }

  // 读取舵机补偿参数
  const readServoCompParams = async () => {
    if (!client) return
    setLoading(true)
    setError(null)
    try {
      const newComp = await Promise.all(
        Array(8).fill(null).map(async (_, i) => {
          const baseAddr = REG.SERVO_COMP_BASE_ANGLE + i * 4
          const [base, kRoll, kPitch, kYaw] = await Promise.all([
            client.readFloatRegister(baseAddr),
            client.readFloatRegister(baseAddr + 1),
            client.readFloatRegister(baseAddr + 2),
            client.readFloatRegister(baseAddr + 3),
          ])
          const enabledAddr = REG.SERVO_COMP_ENABLE_0 + i
          const enabledWord = await client.readSingleRegister(enabledAddr)
          const autoEnabled = !!(enabledWord & 0x0001)
          
          return {
            baseAngle: base || 0,
            kRoll: kRoll || 0,
            kPitch: kPitch || 0,
            kYaw: kYaw || 0,
            autoEnabled,
          }
        })
      )
      setServoComp(newComp)
    } catch (err) {
      setError(`读取补偿参数失败: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  // 更新单个舵机的补偿参数
  const handleUpdate = async (index: number, field: string, value: number) => {
    if (!client) return
    try {
      const baseAddr = REG.SERVO_COMP_BASE_ANGLE + index * 4
      let addr = baseAddr
      
      switch (field) {
        case 'baseAngle':
          addr = baseAddr
          break
        case 'kRoll':
          addr = baseAddr + 1
          break
        case 'kPitch':
          addr = baseAddr + 2
          break
        case 'kYaw':
          addr = baseAddr + 3
          break
      }
      
      await client.writeFloatRegister(addr, value)
      
      // 更新本地状态
      setServoComp(prev => {
        const newComp = [...prev]
        newComp[index] = { ...newComp[index], [field]: value }
        return newComp
      })
    } catch (err) {
      setError(`写入参数失败: ${(err as Error).message}`)
    }
  }

  // 切换自动补偿使能
  const handleToggleAuto = async (index: number, enabled: boolean) => {
    if (!client) return
    try {
      const regAddr = REG.SERVO_COMP_ENABLE_0 + index
      await client.writeSingleRegister(regAddr, enabled ? 1 : 0)
      
      setServoComp(prev => {
        const newComp = [...prev]
        newComp[index] = { ...newComp[index], autoEnabled: enabled }
        return newComp
      })
    } catch (err) {
      setError(`切换使能失败: ${(err as Error).message}`)
    }
  }

  // 保存所有参数到 Flash
  const handleSave = async (index: number) => {
    if (!client) return
    try {
      await client.writeSingleRegister(REG.CMD_SAVE_CALIB, 0xA5A5)
      setError(null)
      alert('参数已保存到 Flash')
    } catch (err) {
      setError(`保存失败: ${(err as Error).message}`)
    }
  }

  // 初始加载
  useEffect(() => {
    if (client) {
      readAttitude()
      readServoCompParams()
      
      // 定时读取姿态
      const interval = setInterval(readAttitude, 500)
      return () => clearInterval(interval)
    }
  }, [client])

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <p className="text-lg font-medium">请先连接设备</p>
          <p className="text-sm text-gray-400 mt-2">在顶部导航栏点击"连接串口"</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6 max-w-7xl mx-auto">
      {/* 页面标题和全局操作 */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            舵机姿态自适应补偿
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            根据 IMU 姿态数据自动调整舵机角度 · 实时预览补偿效果
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={readServoCompParams}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '读取中...' : '刷新参数'}
          </button>
          
          <button
            onClick={() => handleSave(0)}
            className="px-3 py-1.5 text-xs rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            保存全部
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 transition-colors">✕</button>
        </div>
      )}

      {/* 当前姿态显示 - 紧凑的卡片设计 */}
      {attitude && (
        <div className="grid grid-cols-3 gap-3">
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/30 p-3 text-center">
            <div className="absolute top-0 right-0 w-16 h-16 bg-sky-500/10 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-[10px] text-sky-400 uppercase tracking-wider mb-1">Roll 横滚</div>
              <div className="text-2xl font-bold text-white tabular-nums">{attitude.roll.toFixed(1)}°</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 p-3 text-center">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Pitch 俯仰</div>
              <div className="text-2xl font-bold text-white tabular-nums">{attitude.pitch.toFixed(1)}°</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-3 text-center">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">Yaw 航向</div>
              <div className="text-2xl font-bold text-white tabular-nums">{attitude.yaw.toFixed(1)}°</div>
            </div>
          </div>
        </div>
      )}

      {/* 舵机补偿配置面板 - 响应式网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {servoComp.map((comp, i) => (
          <ServoCompensationCard
            key={i}
            servoIndex={i}
            data={comp}
            attitude={attitude}
            onUpdate={(idx, field, value) => handleUpdate(idx, field, value)}
            onToggleAuto={(idx, enabled) => handleToggleAuto(idx, enabled)}
            onSave={handleSave}
          />
        ))}
      </div>
    </div>
  )
}
