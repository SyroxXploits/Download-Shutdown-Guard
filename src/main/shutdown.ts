import { exec } from 'child_process'
import { BrowserWindow } from 'electron'
import { ShutdownAction } from '../shared/types'
import { logger } from './logger'

// Execute a Windows shutdown command
export function executeShutdown(action: ShutdownAction): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string

    switch (action) {
      case 'shutdown':
        cmd = 'shutdown /s /t 0'
        break
      case 'restart':
        cmd = 'shutdown /r /t 0'
        break
      case 'signout':
        // /l = log off the current user
        cmd = 'shutdown /l'
        break
      case 'sleep':
        // rundll32 powrprof.dll,SetSuspendState 0,1,0 => sleep
        cmd = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0'
        break
      case 'hibernate':
        cmd = 'shutdown /h'
        break
      default:
        cmd = 'shutdown /s /t 0'
    }

    logger.info(`Executing shutdown action: ${action} — command: ${cmd}`)

    exec(cmd, (error) => {
      if (error) {
        logger.error('Shutdown command failed:', error)
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

// Cancel a pending Windows shutdown (in case it was scheduled with a delay)
export function cancelSystemShutdown(): void {
  exec('shutdown /a', (err) => {
    if (err) logger.warn('shutdown /a failed (no pending shutdown scheduled):', err.message)
  })
}

// Open the shutdown countdown overlay window
export function openCountdownWindow(parentWindow: BrowserWindow | null): BrowserWindow {
  const win = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Reuse preload from main window
      preload: parentWindow
        ? (parentWindow.webContents as unknown as { getURL: () => string }) && undefined
        : undefined
    }
  })

  // Position in the bottom-right corner like a Windows notification
  const { screen } = require('electron')
  const { bounds } = screen.getPrimaryDisplay()
  const margin = 24
  win.setPosition(
    bounds.width - win.getBounds().width - margin,
    bounds.height - win.getBounds().height - margin - 48 // above taskbar
  )

  win.once('ready-to-show', () => win.show())
  return win
}
