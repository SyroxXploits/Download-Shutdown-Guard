import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, AppStatus, UpdateCheckResult, WatchedTask } from '../shared/types'

// Expose a safe, typed API surface to the renderer via window.api
const api = {
  // ── Status ──────────────────────────────────────────────────────────────
  onStatusUpdate: (cb: (status: AppStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AppStatus) => cb(status)
    ipcRenderer.on('status:update', handler)
    return () => ipcRenderer.removeListener('status:update', handler)
  },

  onShutdownExecuting: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('shutdown:executing', handler)
    return () => ipcRenderer.removeListener('shutdown:executing', handler)
  },

  onNotification: (cb: (msg: string, type: 'info' | 'warning' | 'error') => void) => {
    const handler = (_: Electron.IpcRendererEvent, msg: string, type: string) =>
      cb(msg, type as 'info' | 'warning' | 'error')
    ipcRenderer.on('notification:show', handler)
    return () => ipcRenderer.removeListener('notification:show', handler)
  },

  // ── Watched Tasks ─────────────────────────────────────────────────────────
  addWatched: (task: WatchedTask) => ipcRenderer.send('watched:add', task),
  removeWatched: (id: string) => ipcRenderer.send('watched:remove', id),
  clearWatched: () => ipcRenderer.send('watched:clear'),

  // ── Controls ─────────────────────────────────────────────────────────────
  cancelShutdown: () => ipcRenderer.send('app:cancel-shutdown'),
  snooze: (minutes: number) => ipcRenderer.send('app:snooze', minutes),
  shutdownNow: () => ipcRenderer.send('app:shutdown-now'),
  resetMonitoring: () => ipcRenderer.send('app:reset-monitoring'),

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (s: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('settings:set', s),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),

  // ── Window ────────────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),

  // ── System ────────────────────────────────────────────────────────────────
  openDownloadsFolder: () => ipcRenderer.send('system:open-downloads-folder'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('system:open-external', url),
  checkForUpdates: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('system:check-for-updates'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('system:get-app-version'),
  getLogPath: (): Promise<string> => ipcRenderer.invoke('system:get-log-path'),
  openLog: () => ipcRenderer.send('system:open-log'),

  // ── In-app auto-updater (electron-updater) ─────────────────────────────────
  // Returns the available version string, or null if up to date / unavailable.
  checkForUpdate: (): Promise<string | null> => ipcRenderer.invoke('update:check'),
  downloadUpdate: (): Promise<boolean> => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.send('update:install'),
  onUpdateAvailable: (cb: (version: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, version: string) => cb(version)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },
  onUpdateProgress: (cb: (percent: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, percent: number) => cb(percent)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },
  onUpdateDownloaded: (cb: (version: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, version: string) => cb(version)
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.removeListener('update:downloaded', handler)
  },
  onUpdateError: (cb: (message: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on('update:error', handler)
    return () => ipcRenderer.removeListener('update:error', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

// Type augmentation for TypeScript in renderer
declare global {
  interface Window {
    api: typeof api
  }
}
