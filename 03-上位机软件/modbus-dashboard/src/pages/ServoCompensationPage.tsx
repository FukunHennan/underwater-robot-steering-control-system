import { useState, useEffect } from 'react'
import { ModbusClient, REG } from '../lib/modbus'
import { AlertTriangle, Zap, RefreshCw, Save, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import type { AttitudeData } from '../lib/types'

interface ServoCompensationPageProps {
  client: ModbusClient | null
}

interface ServoCompData {
  baseAngle: number
  kRoll: number
  kPitch: number
  kYaw: number
  autoEnabled: boolean
}

export function ServoCompensationPage({ client }: ServoCompensationPageProps) {
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [servoComp, setServoComp] = useState<ServoCompData[]>(
    Array(8).fill(null).map(() => ({
      baseAngle: 90,
      kRoll: 0,
      kPitch: 0,
      kYaw: 0,
      autoEnabled: true,
    }))
  )
  
  // 全局参数（用于批量应用）
  const [globalParams, setGlobalParams] = useState({
    baseAngle: 90,
    kRoll: 0.5,
    kPitch: 0.3,
    kYaw: 0,
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedServo, setExpandedServo] = useState<number | null>(null)

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
            baseAngle: base || 90,
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
  const handleUpdate = async (index: number, field: keyof ServoCompData, value: number) => {
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
  const handleSaveAll = async () => {
    if (!client) return
    try {
      await client.writeSingleRegister(REG.CMD_SAVE_CALIB, 0xA5A5)
      setError(null)
      alert('所有参数已保存到 Flash')
    } catch (err) {
      setError(`保存失败: ${(err as Error).message}`)
    }
  }

  // 应用全局参数到所有舵机
  const applyGlobalToAll = async () => {
    if (!client) return
    try {
      for (let i = 0; i < 8; i++) {
        const baseAddr = REG.SERVO_COMP_BASE_ANGLE + i * 4
        await client.writeFloatRegister(baseAddr, globalParams.baseAngle)
        await client.writeFloatRegister(baseAddr + 1, globalParams.kRoll)
        await client.writeFloatRegister(baseAddr + 2, globalParams.kPitch)
        await client.writeFloatRegister(baseAddr + 3, globalParams.kYaw)
      }
      
      setServoComp(prev => prev.map(servo => ({
        ...servo,
        baseAngle: globalParams.baseAngle,
        kRoll: globalParams.kRoll,
        kPitch: globalParams.kPitch,
        kYaw: globalParams.kYaw,
      })))
      
      setError(null)
    } catch (err) {
      setError(`应用全局参数失败: ${(err as Error).message}`)
    }
  }

  // 计算目标角度
  const calculateTargetAngle = (servo: ServoCompData) => {
    if (!attitude) return servo.baseAngle
    return servo.baseAngle + 
           servo.kRoll * attitude.roll + 
           servo.kPitch * attitude.pitch + 
           servo.kYaw * attitude.yaw
  }

  // 初始加载
  useEffect(() => {
    if (client) {
      readAttitude()
      readServoCompParams()
      
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
            主从式布局 · 批量参数管理 · 实时预览
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
            onClick={handleSaveAll}
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

      {/* 实时姿态监控 */}
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

      {/* 全局补偿参数配置 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            全局补偿参数（批量应用）
          </h2>
          <button
            onClick={applyGlobalToAll}
            className="px-3 py-1 text-xs rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
          >
            应用到全部舵机
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">BASE (°)</label>
            <input
              type="number"
              step="0.1"
              value={globalParams.baseAngle}
              onChange={(e) => setGlobalParams({...globalParams, baseAngle: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">K_Roll</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kRoll}
              onChange={(e) => setGlobalParams({...globalParams, kRoll: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">K_Pitch</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kPitch}
              onChange={(e) => setGlobalParams({...globalParams, kPitch: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">K_Yaw</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kYaw}
              onChange={(e) => setGlobalParams({...globalParams, kYaw: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* 舵机状态总览表格 */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50">
          <h2 className="text-sm font-semibold text-white">舵机状态总览</h2>
        </div>
        
        <table className="w-full text-xs">
          <thead className="bg-gray-900/30 text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">基准角</th>
              <th className="px-4 py-2 text-left">K_Roll</th>
              <th className="px-4 py-2 text-left">K_Pitch</th>
              <th className="px-4 py-2 text-left">K_Yaw</th>
              <th className="px-4 py-2 text-left">目标角</th>
              <th className="px-4 py-2 text-left">PWM</th>
              <th className="px-4 py-2 text-left">状态</th>
              <th className="px-4 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {servoComp.map((servo, i) => {
              const targetAngle = calculateTargetAngle(servo)
              const pwm = Math.round(1500 + targetAngle * 10)
              
              return (
                <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-white">#{i + 1}</td>
                  <td className="px-4 py-2 font-mono">{servo.baseAngle.toFixed(1)}°</td>
                  <td className="px-4 py-2 font-mono">{servo.kRoll.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono">{servo.kPitch.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono">{servo.kYaw.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono text-blue-400">{targetAngle.toFixed(1)}°</td>
                  <td className="px-4 py-2 font-mono text-green-400">{pwm} μs</td>
                  <td className="px-4 py-2">
                    {servo.autoEnabled ? (
                      <span className="flex items-center gap-1 text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        启用
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500">
                        <XCircle className="w-3 h-3" />
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setExpandedServo(expandedServo === i ? null : i)}
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                      {expandedServo === i ? (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3 h-3" />
                          编辑
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 展开的舵机详细配置 */}
      {expandedServo !== null && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              舵机 #{expandedServo + 1} 详细配置
            </h3>
            <button
              onClick={() => setExpandedServo(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 左侧：参数编辑 */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">基础角度 (°)</label>
                <input
                  type="number"
                  step="0.1"
                  value={servoComp[expandedServo].baseAngle}
                  onChange={(e) => handleUpdate(expandedServo, 'baseAngle', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">K_Roll</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kRoll}
                  onChange={(e) => handleUpdate(expandedServo, 'kRoll', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">K_Pitch</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kPitch}
                  onChange={(e) => handleUpdate(expandedServo, 'kPitch', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">K_Yaw</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kYaw}
                  onChange={(e) => handleUpdate(expandedServo, 'kYaw', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-gray-700 bg-gray-900 text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            
            {/* 右侧：预览和开关 */}
            <div className="space-y-3">
              <div className="p-3 rounded bg-gray-900/50 border border-gray-700">
                <div className="text-[10px] text-gray-400 mb-1">目标角度预览</div>
                <div className="text-2xl font-bold text-blue-400 tabular-nums">
                  {calculateTargetAngle(servoComp[expandedServo]).toFixed(1)}°
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  PWM: {Math.round(1500 + calculateTargetAngle(servoComp[expandedServo]) * 10)} μs
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={servoComp[expandedServo].autoEnabled}
                  onChange={(e) => handleToggleAuto(expandedServo, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-xs text-gray-300">启用自动补偿</span>
              </label>
              
              <div className="p-2 rounded bg-gray-900/30 border border-gray-700 text-[10px] text-gray-400">
                <div className="font-mono">
                  θ = {servoComp[expandedServo].baseAngle.toFixed(1)} + 
                  ({servoComp[expandedServo].kRoll.toFixed(3)})×R + 
                  ({servoComp[expandedServo].kPitch.toFixed(3)})×P + 
                  ({servoComp[expandedServo].kYaw.toFixed(3)})×Y
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
