import { useState, useEffect, useCallback } from 'react'
import type { AppStatus, AppSettings, WatchedTask } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

interface UseAppStatusReturn {
  status: AppStatus | null
  settings: AppSettings
  setSettings: (s: AppSettings) => Promise<void>
  resetSettings: () => Promise<AppSettings>
  cancelShutdown: () => void
  snooze: (minutes: number) => void
  shutdownNow: () => void
  addWatched: (task: WatchedTask) => void
  removeWatched: (id: string) => void
  isExecuting: boolean
  notification: { msg: string; type: 'info' | 'warning' | 'error' } | null
  dismissNotification: () => void
}

const INITIAL_SETTINGS: AppSettings = DEFAULT_SETTINGS

export function useAppStatus(): UseAppStatusReturn {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [settings, setSettingsState] = useState<AppSettings>(INITIAL_SETTINGS)
  const [isExecuting, setIsExecuting] = useState(false)
  const [notification, setNotification] = useState<{
    msg: string
    type: 'info' | 'warning' | 'error'
  } | null>(null)

  useEffect(() => {
    // Load initial settings
    window.api.getSettings().then(setSettingsState).catch(console.error)

    // Subscribe to status updates from main process
    const unsub = window.api.onStatusUpdate(setStatus)

    // Subscribe to shutdown executing
    const unsubExec = window.api.onShutdownExecuting(() => setIsExecuting(true))

    // Subscribe to notifications
    const unsubNotif = window.api.onNotification((msg, type) => {
      setNotification({ msg, type })
    })

    return () => {
      unsub()
      unsubExec()
      unsubNotif()
    }
  }, [])

  const setSettings = useCallback(async (s: AppSettings) => {
    const saved = await window.api.setSettings(s)
    setSettingsState(saved)
  }, [])

  const resetSettings = useCallback(async (): Promise<AppSettings> => {
    const defaults = await window.api.resetSettings()
    setSettingsState(defaults)
    return defaults
  }, [])

  const cancelShutdown = useCallback(() => {
    window.api.cancelShutdown()
  }, [])

  const snooze = useCallback((minutes: number) => {
    window.api.snooze(minutes)
  }, [])

  const shutdownNow = useCallback(() => {
    window.api.shutdownNow()
  }, [])

  const addWatched = useCallback((task: WatchedTask) => {
    window.api.addWatched(task)
  }, [])

  const removeWatched = useCallback((id: string) => {
    window.api.removeWatched(id)
  }, [])

  const dismissNotification = useCallback(() => {
    setNotification(null)
  }, [])

  return {
    status,
    settings,
    setSettings,
    resetSettings,
    cancelShutdown,
    snooze,
    shutdownNow,
    addWatched,
    removeWatched,
    isExecuting,
    notification,
    dismissNotification
  }
}
