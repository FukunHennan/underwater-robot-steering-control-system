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
  const [hasInitialized, setHasInitialized] = useState(false)  // 防止重复初始化

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
      console.log('开始读取舵机补偿参数...')
      const newComp = await Promise.all(
        Array(8).fill(null).map(async (_, i) => {
          try {
            const baseAddr = REG.SERVO_COMP_BASE_ANGLE + i * 8  // 每个舵机占用 8 个寄存器（4个float × 2）
            console.log(`读取舵机 ${i + 1}, 基地址: 0x${baseAddr.toString(16).toUpperCase()}`)
            
            const [base, kRoll, kPitch, kYaw] = await Promise.all([
              client.readFloatRegister(baseAddr),
              client.readFloatRegister(baseAddr + 2),   // float 占用 2 个寄存器
              client.readFloatRegister(baseAddr + 4),
              client.readFloatRegister(baseAddr + 6),
            ])
            
            const enabledAddr = REG.SERVO_COMP_ENABLE_0 + i
            const enabledWord = await client.readSingleRegister(enabledAddr)
            const autoEnabled = !!(enabledWord & 0x0001)
            
            console.log(`舵机 ${i + 1}: BASE=${base}, K_R=${kRoll}, K_P=${kPitch}, K_Y=${kYaw}, EN=${autoEnabled}`)
            
            return {
              baseAngle: base || 90,
              kRoll: kRoll || 0,
              kPitch: kPitch || 0,
              kYaw: kYaw || 0,
              autoEnabled,
            }
          } catch (err) {
            console.error(`读取舵机 ${i + 1} 失败:`, err)
            // 返回默认值，避免整个读取失败
            return {
              baseAngle: 90,
              kRoll: 0,
              kPitch: 0,
              kYaw: 0,
              autoEnabled: true,
            }
          }
        })
      )
      setServoComp(newComp)
      console.log('舵机补偿参数读取完成')
    } catch (err) {
      const errorMsg = `读取补偿参数失败: ${(err as Error).message}`
      console.error(errorMsg)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  // 更新单个舵机的补偿参数
  const handleUpdate = async (index: number, field: keyof ServoCompData, value: number) => {
    if (!client) return
    try {
      const baseAddr = REG.SERVO_COMP_BASE_ANGLE + index * 8  // 每个舵机占用 8 个寄存器
      let addr = baseAddr
      
      switch (field) {
        case 'baseAngle':
          addr = baseAddr
          break
        case 'kRoll':
          addr = baseAddr + 2  // float 占用 2 个寄存器
          break
        case 'kPitch':
          addr = baseAddr + 4
          break
        case 'kYaw':
          addr = baseAddr + 6
          break
      }
      
      console.log(`写入舵机 ${index + 1} ${field}: 地址 0x${addr.toString(16).toUpperCase()}, 值 ${value}`)
      await client.writeFloatRegister(addr, value)
      
      setServoComp(prev => {
        const newComp = [...prev]
        newComp[index] = { ...newComp[index], [field]: value }
        return newComp
      })
    } catch (err) {
      const errorMsg = `写入参数失败: ${(err as Error).message}`
      console.error(errorMsg)
      setError(errorMsg)
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
      // 使用现有的校准保存命令（地址 0x006A，值 0x5A5A）
      await client.writeSingleRegister(0x006A, 0x5A5A)
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
      console.log('应用全局参数到所有舵机...')
      for (let i = 0; i < 8; i++) {
        const baseAddr = REG.SERVO_COMP_BASE_ANGLE + i * 8
        console.log(`写入舵机 ${i + 1}: BASE=${globalParams.baseAngle}, K_R=${globalParams.kRoll}, K_P=${globalParams.kPitch}, K_Y=${globalParams.kYaw}`)
        
        await client.writeFloatRegister(baseAddr, globalParams.baseAngle)
        await client.writeFloatRegister(baseAddr + 2, globalParams.kRoll)
        await client.writeFloatRegister(baseAddr + 4, globalParams.kPitch)
        await client.writeFloatRegister(baseAddr + 6, globalParams.kYaw)
      }
      
      setServoComp(prev => prev.map(servo => ({
        ...servo,
        baseAngle: globalParams.baseAngle,
        kRoll: globalParams.kRoll,
        kPitch: globalParams.kPitch,
        kYaw: globalParams.kYaw,
      })))
      
      setError(null)
      console.log('全局参数应用完成')
    } catch (err) {
      const errorMsg = `应用全局参数失败: ${(err as Error).message}`
      console.error(errorMsg)
      setError(errorMsg)
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
    if (client && !hasInitialized) {
      console.log('补偿页面初始化，读取参数...')
      readAttitude()
      readServoCompParams()
      setHasInitialized(true)
      
      const interval = setInterval(readAttitude, 500)
      return () => clearInterval(interval)
    }
  }, [client, hasInitialized])

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
    <div className="space-y-4 p-6 max-w-7xl mx-auto bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* 页面标题和全局操作 */}
      <div className="flex items-center justify-between pb-4 border-b border-blue-200 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            舵机姿态自适应补偿
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            主从式布局 · 批量参数管理 · 实时预览
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={readServoCompParams}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '读取中...' : '刷新参数'}
          </button>
          
          <button
            onClick={handleSaveAll}
            className="px-3 py-1.5 text-xs rounded bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            保存全部
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
        </div>
      )}

      {/* 实时姿态监控 */}
      {attitude && (
        <div className="grid grid-cols-3 gap-3">
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 p-4 text-center shadow-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-xs text-white/90 uppercase tracking-wider mb-1 font-medium">Roll 横滚</div>
              <div className="text-3xl font-bold text-white tabular-nums drop-shadow-sm">{attitude.roll.toFixed(1)}°</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 p-4 text-center shadow-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-xs text-white/90 uppercase tracking-wider mb-1 font-medium">Pitch 俯仰</div>
              <div className="text-3xl font-bold text-white tabular-nums drop-shadow-sm">{attitude.pitch.toFixed(1)}°</div>
            </div>
          </div>
          
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-center shadow-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
            <div className="relative">
              <div className="text-xs text-white/90 uppercase tracking-wider mb-1 font-medium">Yaw 航向</div>
              <div className="text-3xl font-bold text-white tabular-nums drop-shadow-sm">{attitude.yaw.toFixed(1)}°</div>
            </div>
          </div>
        </div>
      )}

      {/* 全局补偿参数配置 */}
      <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-500" />
            全局补偿参数（批量应用）
          </h2>
          <button
            onClick={applyGlobalToAll}
            className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600 transition-colors shadow-sm"
          >
            应用到全部舵机
          </button>
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-600 block mb-1 font-medium">BASE (°)</label>
            <input
              type="number"
              step="0.1"
              value={globalParams.baseAngle}
              onChange={(e) => setGlobalParams({...globalParams, baseAngle: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1 font-medium">K_Roll</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kRoll}
              onChange={(e) => setGlobalParams({...globalParams, kRoll: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1 font-medium">K_Pitch</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kPitch}
              onChange={(e) => setGlobalParams({...globalParams, kPitch: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1 font-medium">K_Yaw</label>
            <input
              type="number"
              step="0.001"
              value={globalParams.kYaw}
              onChange={(e) => setGlobalParams({...globalParams, kYaw: parseFloat(e.target.value) || 0})}
              className="w-full px-2 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* 舵机状态总览表格 */}
      <div className="rounded-lg border border-blue-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="text-sm font-semibold text-gray-800">舵机状态总览</h2>
        </div>
        
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-medium">ID</th>
              <th className="px-4 py-2 text-left font-medium">基准角</th>
              <th className="px-4 py-2 text-left font-medium">K_Roll</th>
              <th className="px-4 py-2 text-left font-medium">K_Pitch</th>
              <th className="px-4 py-2 text-left font-medium">K_Yaw</th>
              <th className="px-4 py-2 text-left font-medium">目标角</th>
              <th className="px-4 py-2 text-left font-medium">PWM</th>
              <th className="px-4 py-2 text-left font-medium">状态</th>
              <th className="px-4 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {servoComp.map((servo, i) => {
              const targetAngle = calculateTargetAngle(servo)
              const pwm = Math.round(1500 + targetAngle * 10)
              
              return (
                <tr key={i} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-2 font-mono text-gray-800 font-medium">#{i + 1}</td>
                  <td className="px-4 py-2 font-mono text-gray-700">{servo.baseAngle.toFixed(1)}°</td>
                  <td className="px-4 py-2 font-mono text-gray-700">{servo.kRoll.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono text-gray-700">{servo.kPitch.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono text-gray-700">{servo.kYaw.toFixed(3)}</td>
                  <td className="px-4 py-2 font-mono text-blue-600 font-semibold">{targetAngle.toFixed(1)}°</td>
                  <td className="px-4 py-2 font-mono text-green-600 font-semibold">{pwm} μs</td>
                  <td className="px-4 py-2">
                    {servo.autoEnabled ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        启用
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <XCircle className="w-3.5 h-3.5" />
                        禁用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setExpandedServo(expandedServo === i ? null : i)}
                      className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 font-medium"
                    >
                      {expandedServo === i ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          收起
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3.5 h-3.5" />
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
        <div className="rounded-lg border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 animate-in fade-in slide-in-from-top-2 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">
              舵机 #{expandedServo + 1} 详细配置
            </h3>
            <button
              onClick={() => setExpandedServo(null)}
              className="text-gray-500 hover:text-gray-700 transition-colors text-lg"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 左侧：参数编辑 */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1 font-medium">基础角度 (°)</label>
                <input
                  type="number"
                  step="0.1"
                  value={servoComp[expandedServo].baseAngle}
                  onChange={(e) => handleUpdate(expandedServo, 'baseAngle', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1 font-medium">K_Roll</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kRoll}
                  onChange={(e) => handleUpdate(expandedServo, 'kRoll', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1 font-medium">K_Pitch</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kPitch}
                  onChange={(e) => handleUpdate(expandedServo, 'kPitch', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1 font-medium">K_Yaw</label>
                <input
                  type="number"
                  step="0.001"
                  value={servoComp[expandedServo].kYaw}
                  onChange={(e) => handleUpdate(expandedServo, 'kYaw', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
            </div>
            
            {/* 右侧：预览和开关 */}
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white border-2 border-blue-300 shadow-sm">
                <div className="text-xs text-gray-600 mb-1 font-medium">目标角度预览</div>
                <div className="text-3xl font-bold text-blue-600 tabular-nums">
                  {calculateTargetAngle(servoComp[expandedServo]).toFixed(1)}°
                </div>
                <div className="text-sm text-gray-600 mt-2 font-medium">
                  PWM: <span className="text-green-600 font-bold">{Math.round(1500 + calculateTargetAngle(servoComp[expandedServo]) * 10)} μs</span>
                </div>
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-300 transition-colors">
                <input
                  type="checkbox"
                  checked={servoComp[expandedServo].autoEnabled}
                  onChange={(e) => handleToggleAuto(expandedServo, e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 font-medium">启用自动补偿</span>
              </label>
              
              <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 font-medium">
                <div className="font-mono text-sm">
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
