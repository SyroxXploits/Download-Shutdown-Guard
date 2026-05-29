import { app } from 'electron'
import { logger } from './logger'

// Use Electron's built-in loginItem for auto-start
export function setAutoStart(enabled: boolean): void {
  try {
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        name: 'Download Shutdown Guard',
        args: enabled ? ['--autostart'] : []
      })
    } else {
      // In dev, just log — don't register the dev build as a startup item
      logger.info(`[Dev] Auto-start would be ${enabled ? 'enabled' : 'disabled'}`)
    }
  } catch (e) {
    logger.error('Failed to set auto-start:', e)
  }
}

export function getAutoStartEnabled(): boolean {
  try {
    if (app.isPackaged) {
      return app.getLoginItemSettings().openAtLogin
    }
  } catch {
    // ignore
  }
  return false
}

export function wasLaunchedAtStartup(): boolean {
  return process.argv.includes('--autostart')
}
