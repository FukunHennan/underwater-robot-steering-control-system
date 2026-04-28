import { useState, useEffect } from 'react'
import { ModbusClient, REG } from '../lib/modbus'
import { ServoCompensationCard } from '../components/panels/ServoCompensationCard'
import { Card } from '../components/common/Card'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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
    <div className="space-y-6 p-6">
      {/* 标题和说明 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">舵机姿态自适应补偿</h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            根据 IMU 姿态数据（Roll/Pitch/Yaw）自动调整舵机角度，实现水下机器人姿态稳定控制。
            补偿公式：目标角度 = BASE_ANGLE + K_ROLL×Roll + K_PITCH×Pitch + K_YAW×Yaw
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={readServoCompParams}
            disabled={loading}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {loading ? '读取中...' : '刷新参数'}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* 当前姿态显示 */}
      {attitude && (
        <Card title="当前姿态" icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-sky-500/10 rounded">
              <div className="text-xs text-gray-400 mb-1">Roll 横滚</div>
              <div className="text-xl font-mono text-sky-400">{attitude.roll.toFixed(2)}°</div>
            </div>
            <div className="text-center p-3 bg-emerald-500/10 rounded">
              <div className="text-xs text-gray-400 mb-1">Pitch 俯仰</div>
              <div className="text-xl font-mono text-emerald-400">{attitude.pitch.toFixed(2)}°</div>
            </div>
            <div className="text-center p-3 bg-amber-500/10 rounded">
              <div className="text-xs text-gray-400 mb-1">Yaw 航向</div>
              <div className="text-xl font-mono text-amber-400">{attitude.yaw.toFixed(2)}°</div>
            </div>
          </div>
        </Card>
      )}

      {/* 舵机补偿配置面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
