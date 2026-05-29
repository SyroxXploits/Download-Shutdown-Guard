import { app, ipcMain, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import pkg from 'electron-updater'
import { logger } from './logger'

// electron-updater ships as CommonJS; grab autoUpdater off the default export.
const { autoUpdater } = pkg

const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let initialized = false

/**
 * electron-updater can only update an installed (NSIS) build: it needs
 * `app-update.yml` next to the app resources and an installer to hand off to.
 * The portable target extracts to a random Temp folder with no usable metadata,
 * so every automatic check threw `ENOENT app-update.yml` and surfaced a scary
 * "Update failed" dialog the user never asked for. Detect that case and route
 * updates to the GitHub releases page (via the renderer's browser fallback)
 * instead of pretending the in-app updater works.
 */
function isInAppUpdateSupported(): boolean {
  if (!app.isPackaged) return false
  // electron-builder sets these only when running the portable target.
  if (process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE) return false
  try {
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))
  } catch {
    return false
  }
}

/**
 * Wire up the real in-app auto-update flow (electron-updater).
 *
 * Flow: check → if a newer release exists we notify the renderer, which asks the
 * user "Do you want to update?". Only on confirmation do we download, stream
 * progress, and finally offer to restart & install. Nothing downloads silently.
 *
 * Only works in a packaged build — electron-updater requires the installed app
 * metadata (app-update.yml). In dev it's a no-op.
 */
export function initUpdater(
  getWindow: () => BrowserWindow | null,
  prepareQuit: () => void
): void {
  if (initialized) return
  initialized = true

  const updateSupported = isInAppUpdateSupported()

  // On portable / unpackaged builds the in-app updater can't work. Register the
  // IPC handlers so the renderer still gets sensible answers (no update found /
  // download failed → it falls back to opening the releases page), but never
  // attach the auto-check or the error listener that spammed "Update failed".
  if (!updateSupported) {
    logger.info('In-app updater unavailable (portable or dev build) — using GitHub releases fallback')
    ipcMain.handle('update:check', async () => null)
    ipcMain.handle('update:download', async () => false)
    ipcMain.on('update:install', () => {})
    return
  }

  // We ask the user before doing anything.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m: unknown) => logger.info('[updater]', m),
    warn: (m: unknown) => logger.warn('[updater]', m),
    error: (m: unknown) => logger.error('[updater]', m),
    debug: () => {}
  }

  const send = (channel: string, ...args: unknown[]): void => {
    getWindow()?.webContents.send(channel, ...args)
  }

  autoUpdater.on('update-available', info => {
    logger.info(`Update available: v${info.version}`)
    send('update:available', info.version)
  })
  autoUpdater.on('update-not-available', () => {
    send('update:not-available')
  })
  autoUpdater.on('download-progress', progress => {
    send('update:progress', Math.round(progress.percent))
  })
  autoUpdater.on('update-downloaded', info => {
    logger.info(`Update downloaded: v${info.version}`)
    send('update:downloaded', info.version)
  })
  autoUpdater.on('error', err => {
    logger.error('Updater error:', err)
    send('update:error', err instanceof Error ? err.message : String(err))
  })

  // ── IPC ────────────────────────────────────────────────────────────────────
  // Returns the new version string if an update is available, else null.
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) return null
    try {
      const result = await autoUpdater.checkForUpdates()
      const info = result?.updateInfo
      if (info && autoUpdater.currentVersion.compare(info.version) < 0) {
        return info.version
      }
      return null
    } catch (e) {
      logger.warn('Update check failed:', e)
      return null
    }
  })

  ipcMain.handle('update:download', async () => {
    if (!app.isPackaged) return false
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (e) {
      logger.error('Update download failed:', e)
      send('update:error', e instanceof Error ? e.message : String(e))
      return false
    }
  })

  ipcMain.on('update:install', () => {
    if (!app.isPackaged) return
    prepareQuit()
    // Quit and install the downloaded update. isSilent=false shows the NSIS
    // progress; isForceRunAfter=true relaunches the app afterwards.
    autoUpdater.quitAndInstall(false, true)
  })

  // Initial check shortly after launch, then periodically.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(e => logger.warn('Initial update check failed:', e))
  }, 4000)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, RECHECK_INTERVAL_MS)
}
