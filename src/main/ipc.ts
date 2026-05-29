import { ipcMain, shell, app, BrowserWindow } from 'electron'
import { AppSettings, WatchedTask } from '../shared/types'
import { settingsStore } from './store'
import { MonitorCoordinator } from './monitors'
import { setAutoStart } from './autostart'
import { executeShutdown } from './shutdown'
import { logger } from './logger'
import { checkForUpdates } from './updates'

export function registerIpcHandlers(
  coordinator: MonitorCoordinator,
  getMainWindow: () => BrowserWindow | null
): void {
  // ── Status ────────────────────────────────────────────────────────────────

  ipcMain.handle('app:get-status', () => {
    // Return last known status synchronously
    return null // Status is pushed via events; caller can wait
  })

  // ── Shutdown Controls ─────────────────────────────────────────────────────

  ipcMain.on('app:cancel-shutdown', () => {
    coordinator.cancelShutdown()
    logger.info('IPC: cancel-shutdown')
  })

  ipcMain.on('app:snooze', (_event, minutes: number) => {
    coordinator.snooze(minutes)
    logger.info(`IPC: snooze ${minutes}min`)
  })

  ipcMain.on('app:shutdown-now', async () => {
    logger.info('IPC: shutdown-now')
    try {
      const settings = settingsStore.get()
      await executeShutdown(settings.shutdown.action)
    } catch (e) {
      logger.error('Shutdown-now failed:', e)
    }
  })

  ipcMain.on('app:reset-monitoring', () => {
    coordinator.resetAfterShutdownCancel()
    logger.info('IPC: reset-monitoring')
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', () => {
    return settingsStore.get()
  })

  ipcMain.handle('settings:set', (_event, settings: AppSettings) => {
    const current = settingsStore.get()
    const merged: AppSettings = {
      ...current,
      ...settings,
      watchedTasks: current.watchedTasks
    }

    settingsStore.set(merged)
    coordinator.updateSettings(merged)

    // Apply system-level changes
    if (merged.system.autoStart !== undefined) {
      setAutoStart(merged.system.autoStart)
    }

    logger.info('IPC: settings updated')
    return merged
  })

  ipcMain.handle('settings:reset', () => {
    const defaults = settingsStore.reset()
    coordinator.updateSettings(defaults)
    return defaults
  })

  // ── Watched Tasks ─────────────────────────────────────────────────────────

  ipcMain.on('watched:add', (_event, task: WatchedTask) => {
    const settings = settingsStore.get()
    if (!settings.watchedTasks.find(t => t.id === task.id)) {
      settings.watchedTasks = [...settings.watchedTasks, task]
      settingsStore.set(settings)
      coordinator.updateSettings(settings)
    }
    logger.info(`IPC: watched:add ${task.id} (${task.name})`)
  })

  ipcMain.on('watched:remove', (_event, id: string) => {
    const settings = settingsStore.get()
    settings.watchedTasks = settings.watchedTasks.filter(t => t.id !== id)
    settingsStore.set(settings)
    coordinator.updateSettings(settings)
    logger.info(`IPC: watched:remove ${id}`)
  })

  ipcMain.on('watched:clear', () => {
    const settings = settingsStore.get()
    settings.watchedTasks = []
    settingsStore.set(settings)
    coordinator.updateSettings(settings)
    logger.info('IPC: watched:clear')
  })

  // ── Window Controls ───────────────────────────────────────────────────────

  ipcMain.on('window:minimize', () => {
    const win = getMainWindow()
    const settings = settingsStore.get()
    if (settings.ui.minimizeToTray) {
      win?.hide()
    } else {
      win?.minimize()
    }
  })

  ipcMain.on('window:close', () => {
    const win = getMainWindow()
    const settings = settingsStore.get()
    if (settings.ui.minimizeToTray) {
      win?.hide()
    } else {
      app.quit()
    }
  })

  ipcMain.on('window:toggle-maximize', () => {
    const win = getMainWindow()
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  // ── System ────────────────────────────────────────────────────────────────

  ipcMain.on('system:open-downloads-folder', () => {
    const os = require('os')
    const path = require('path')
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    shell.openPath(downloadsPath)
  })

  ipcMain.handle('system:open-external', (_event, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
      shell.openExternal(url)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('system:check-for-updates', async () => {
    return checkForUpdates()
  })

  ipcMain.handle('system:get-app-version', () => app.getVersion())

  ipcMain.handle('system:get-log-path', () => {
    return logger.getLogPath()
  })

  ipcMain.on('system:open-log', () => {
    shell.openPath(logger.getLogPath())
  })

  logger.info('IPC handlers registered')
}
