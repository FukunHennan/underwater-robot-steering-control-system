import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ModbusClient, type ConnectionState, type ModbusLog, type ReconnectInfo } from '@/lib/modbus'

interface ConnectionContextValue {
  client: ModbusClient
  connState: ConnectionState
  logs: ModbusLog[]
  reconnectInfo: ReconnectInfo | null
  handleConnect: () => Promise<void>
  handleDisconnect: () => Promise<void>
  clearLogs: () => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const client = useRef(new ModbusClient()).current
  const [connState, setConnState] = useState<ConnectionState>('disconnected')
  const [logs, setLogs] = useState<ModbusLog[]>([])
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo | null>(null)

  useEffect(() => {
    client.onStateChange(setConnState)
    client.onLog(setLogs)
    client.onReconnect(setReconnectInfo)
  }, [client])

  const handleConnect = async () => {
    await client.connect(9600)
  }

  const handleDisconnect = async () => {
    try {
      await client.disconnect()
    } catch { }
  }

  const clearLogs = () => {
    client.clearLog()
  }

  return (
    <ConnectionContext.Provider value={{ client, connState, logs, reconnectInfo, handleConnect, handleDisconnect, clearLogs }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnection() {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnection must be used within ConnectionProvider')
  return ctx
}
