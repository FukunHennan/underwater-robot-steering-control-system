import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type PageView = 'system' | 'sensor' | 'servo' | 'peripheral' | 'advanced'

interface UIContextValue {
  view: PageView
  setView: (v: PageView) => void
  polling: boolean
  pollInterval: number
  setPollInterval: (ms: number) => void
  togglePolling: () => void
  error: string | null
  setError: (e: string | null) => void
  showGyro: boolean
  setShowGyro: (v: boolean) => void
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<PageView>('system')
  const [polling, setPolling] = useState(false)
  const [pollInterval, setPollInterval] = useState(500)
  const [error, setError] = useState<string | null>(null)
  const [showGyro, setShowGyro] = useState(false)

  const togglePolling = useCallback(() => {
    setPolling(prev => !prev)
  }, [])

  return (
    <UIContext.Provider value={{
      view, setView, polling, pollInterval, setPollInterval,
      togglePolling, error, setError, showGyro, setShowGyro,
    }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within UIProvider')
  return ctx
}
