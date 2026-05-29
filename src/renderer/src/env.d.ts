/// <reference types="vite/client" />

// Re-export the window.api type from preload into the renderer TypeScript context
import type { AppSettings, AppStatus, UpdateCheckResult, WatchedTask } from '../../shared/types'

interface ElectronApi {
  onStatusUpdate: (cb: (status: AppStatus) => void) => () => void
  onShutdownExecuting: (cb: () => void) => () => void
  onNotification: (cb: (msg: string, type: 'info' | 'warning' | 'error') => void) => () => void
  addWatched: (task: WatchedTask) => void
  removeWatched: (id: string) => void
  clearWatched: () => void
  cancelShutdown: () => void
  snooze: (minutes: number) => void
  shutdownNow: () => void
  resetMonitoring: () => void
  getSettings: () => Promise<AppSettings>
  setSettings: (s: AppSettings) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  minimize: () => void
  close: () => void
  toggleMaximize: () => void
  openDownloadsFolder: () => void
  openExternal: (url: string) => Promise<boolean>
  checkForUpdates: () => Promise<UpdateCheckResult>
  getAppVersion: () => Promise<string>
  getLogPath: () => Promise<string>
  openLog: () => void
  checkForUpdate: () => Promise<string | null>
  downloadUpdate: () => Promise<boolean>
  installUpdate: () => void
  onUpdateAvailable: (cb: (version: string) => void) => () => void
  onUpdateProgress: (cb: (percent: number) => void) => () => void
  onUpdateDownloaded: (cb: (version: string) => void) => () => void
  onUpdateError: (cb: (message: string) => void) => () => void
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
