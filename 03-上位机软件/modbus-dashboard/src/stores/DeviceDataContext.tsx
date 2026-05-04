import { createContext, useContext, useState, type ReactNode } from 'react'
import type {
  SystemData, AttitudeData, PwmData, PwmFreqData, AdcData,
  BarometerData, MagnetometerData, CalibData, KalmanData,
} from '@/lib/types'
import type { GPIOData, IRData } from '@/lib/modbus'

export interface DeviceData {
  system: SystemData | null
  attitude: AttitudeData | null
  pwm: PwmData | null
  pwmFreq: PwmFreqData | null
  adc: AdcData | null
  baro: BarometerData | null
  mag: MagnetometerData | null
  calib: CalibData | null
  kalman: KalmanData | null
}

interface DeviceDataContextValue {
  data: DeviceData
  system: SystemData | null
  attitude: AttitudeData | null
  pwm: PwmData | null
  pwmFreq: PwmFreqData | null
  adc: AdcData | null
  baro: BarometerData | null
  mag: MagnetometerData | null
  calib: CalibData | null
  kalman: KalmanData | null
  gpio: GPIOData | null
  ir: IRData | null
  attHistory: AttitudeData[]
  setSystem: (d: SystemData | null) => void
  setAttitude: (d: AttitudeData | null) => void
  setPwm: (d: PwmData | null) => void
  setPwmFreq: (d: PwmFreqData | null) => void
  setAdc: (d: AdcData | null) => void
  setBaro: (d: BarometerData | null) => void
  setMag: (d: MagnetometerData | null) => void
  setCalib: (d: CalibData | null) => void
  setKalman: (d: KalmanData | null) => void
  setGpio: (d: GPIOData | null) => void
  setIr: (d: IRData | null) => void
  appendAttHistory: (a: AttitudeData) => void
  clearAttHistory: () => void
}

const DeviceDataContext = createContext<DeviceDataContextValue | null>(null)

export function DeviceDataProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState<SystemData | null>(null)
  const [attitude, setAttitude] = useState<AttitudeData | null>(null)
  const [pwm, setPwm] = useState<PwmData | null>(null)
  const [pwmFreq, setPwmFreq] = useState<PwmFreqData | null>(null)
  const [adc, setAdc] = useState<AdcData | null>(null)
  const [baro, setBaro] = useState<BarometerData | null>(null)
  const [mag, setMag] = useState<MagnetometerData | null>(null)
  const [calib, setCalib] = useState<CalibData | null>(null)
  const [kalman, setKalman] = useState<KalmanData | null>(null)
  const [gpio, setGpio] = useState<GPIOData | null>(null)
  const [ir, setIr] = useState<IRData | null>(null)
  const [attHistory, setAttHistory] = useState<AttitudeData[]>([])

  const appendAttHistory = (a: AttitudeData) => {
    setAttHistory(prev => [...prev.slice(-299), a])
  }

  const clearAttHistory = () => setAttHistory([])

  const data: DeviceData = { system, attitude, pwm, pwmFreq, adc, baro, mag, calib, kalman }

  return (
    <DeviceDataContext.Provider value={{
      data, system, attitude, pwm, pwmFreq, adc, baro, mag, calib, kalman,
      gpio, ir, attHistory, setSystem, setAttitude, setPwm, setPwmFreq,
      setAdc, setBaro, setMag, setCalib, setKalman, setGpio, setIr,
      appendAttHistory, clearAttHistory,
    }}>
      {children}
    </DeviceDataContext.Provider>
  )
}

export function useDeviceData() {
  const ctx = useContext(DeviceDataContext)
  if (!ctx) throw new Error('useDeviceData must be used within DeviceDataProvider')
  return ctx
}
