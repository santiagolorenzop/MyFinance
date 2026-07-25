import { createContext, useContext } from 'react'
import type { UserSettings } from '@/domain/types'

export interface AppState {
  ready: boolean
  error: string | null
  settings: UserSettings | null
  refreshSettings: () => Promise<void>
}

export const AppStateContext = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext)
  if (!ctx) {
    throw new Error('useAppState must be used within AppProviders')
  }
  return ctx
}
