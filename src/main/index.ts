import { app, BrowserWindow, ipcMain, nativeTheme, shell, Notification } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { settingsStore } from './store'
import { MonitorCoordinator } from './monitors'
import { registerIpcHandlers } from './ipc'
import { createTray, updateTrayStatus, destroyTray } from './tray'
import { executeShutdown } from './shutdown'
import { wasLaunchedAtStartup } from './autostart'
import { initUpdater } from './updater'
import { logger } from './logger'
import type { AppStatus } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let coordinator: MonitorCoordinator | null = null
let countdownTimer: NodeJS.Timeout | null = null
let isQuitting = false

// ── Window Creation ───────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const settings = settingsStore.get()

  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 650,
    frame: false,           // Custom title bar
    titleBarStyle: 'hidden',
    transparent: false,
    backgroundColor: '#202020',
    show: false,
    icon: path.join(
      app.isPackaged
        ? path.join(process.resourcesPath, 'resources')
        : path.join(__dirname, '../../resources'),
      'icon.png'
    ),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('ready-to-show', () => {
    if (!settings.ui.startMinimized && !wasLaunchedAtStartup()) {
      win.show()
    }
    logger.info('Main window ready')
  })

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      // Read settings fresh so changes made in the UI are respected immediately
      const currentSettings = settingsStore.get()
      if (currentSettings.ui.minimizeToTray) {
        win.hide()
      } else {
        app.exit(0)
      }
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

// ── Shutdown Countdown Ticker ─────────────────────────────────────────────────

function startCountdownTicker(): void {
  if (countdownTimer) return
  countdownTimer = setInterval(() => {
    if (!coordinator) return
    const result = coordinator.tickCountdown()
    if (result === 'shutdown') {
      clearInterval(countdownTimer!)
      countdownTimer = null
      performShutdown()
    }
  }, 1000)
}

function stopCountdownTicker(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

async function performShutdown(): Promise<void> {
  const settings = settingsStore.get()
  logger.info(`Performing shutdown action: ${settings.shutdown.action}`)

  mainWindow?.webContents.send('shutdown:executing')

  try {
    await executeShutdown(settings.shutdown.action)
  } catch (e) {
    logger.error('Shutdown failed:', e)
    mainWindow?.webContents.send('notification:show', `Shutdown failed: ${String(e)}`, 'error')
    coordinator?.resetAfterShutdownCancel()
  }
}

// ── Status Push ───────────────────────────────────────────────────────────────

function onStatusUpdate(status: AppStatus): void {
  // Push to renderer
  mainWindow?.webContents.send('status:update', status)

  // Update tray
  updateTrayStatus(status)

  // Manage countdown ticker
  if (status.shutdown.phase === 'countdown') {
    startCountdownTicker()

    // Show notification when countdown begins (only once)
    if (status.shutdown.countdownRemaining === coordinator?.getShutdownState().countdownRemaining) {
      showCountdownNotification(status.shutdown.countdownRemaining)
    }
  } else {
    stopCountdownTicker()
  }
}

function showCountdownNotification(seconds: number): void {
  if (!Notification.isSupported()) return
  new Notification({
    title: 'Download Shutdown Guard',
    body: `All downloads complete! Shutting down in ${seconds} seconds.\nClick to open the app and cancel.`,
    icon: path.join(
      app.isPackaged
        ? path.join(process.resourcesPath, 'resources')
        : path.join(__dirname, '../../resources'),
      'icon.png'
    )
  })
    .on('click', () => {
      mainWindow?.show()
      mainWindow?.focus()
    })
    .show()
}

// ── App Bootstrap ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.downloadshutdownguard.app')

  // Force dark theme
  nativeTheme.themeSource = 'dark'

  optimizer.watchWindowShortcuts

  const settings = settingsStore.get()
  coordinator = new MonitorCoordinator(settings)

  mainWindow = createWindow()

  registerIpcHandlers(coordinator, () => mainWindow)

  createTray(mainWindow)

  // Forward tray actions to coordinator
  ipcMain.on('action:cancel-shutdown', () => coordinator?.cancelShutdown())
  ipcMain.on('action:snooze', (_e, min: number) => coordinator?.snooze(min))

  coordinator.onStatusUpdate(onStatusUpdate)
  coordinator.start()

  // Real in-app auto-updater (electron-updater). Setting isQuitting lets the
  // window's close handler allow the quit-and-install to proceed.
  initUpdater(
    () => mainWindow,
    () => {
      isQuitting = true
    }
  )

  app.on('activate', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  logger.info(`App started v${app.getVersion()}, pid=${process.pid}`)
})

app.on('window-all-closed', () => {
  // Don't quit on window close — we live in the tray
})

app.on('before-quit', () => {
  isQuitting = true
  coordinator?.stop()
  stopCountdownTicker()
  destroyTray()
  logger.info('App quitting')
  // Force-kill all Electron child processes after 2s in case any hang.
  setTimeout(() => process.exit(0), 2000).unref()
})

// Single-instance lock: a second launch just focuses the existing window.
// This is registered BEFORE app.whenReady so it fires even if the app is still loading.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // Another instance is already running — exit immediately without any cleanup.
  app.exit(0)
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      if (mainWindow.isMinimized()) mainWindow.restore()
    }
  })
}
