import fs from 'fs'
import path from 'path'
import os from 'os'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

// Partial file extensions used by each browser during download
const PARTIAL_EXTENSIONS = [
  '.crdownload', // Chrome, Edge (Chromium), Opera
  '.part',       // Firefox
  '.tmp',        // Various browsers, generic
  '.download',   // Safari (for reference, unlikely on Windows)
  '.partial',    // Generic
  '.opdownload'  // Opera legacy
]

interface FileSnapshot {
  size: number
  timestamp: number
}

// Track file sizes over time to compute speed and detect active writes
const fileSnapshots = new Map<string, FileSnapshot>()

function getDefaultDownloadFolders(): string[] {
  const home = os.homedir()
  const folders = [path.join(home, 'Downloads')]

  // Edge/Chrome sometimes use OneDrive Downloads
  const oneDriveDownloads = path.join(home, 'OneDrive', 'Downloads')
  if (fs.existsSync(oneDriveDownloads)) folders.push(oneDriveDownloads)

  // Try USERPROFILE Downloads
  const userProfile = process.env.USERPROFILE
  if (userProfile) {
    const up = path.join(userProfile, 'Downloads')
    if (!folders.includes(up) && fs.existsSync(up)) folders.push(up)
  }

  return folders.filter(f => fs.existsSync(f))
}

interface PartialFile {
  path: string
  name: string
  size: number
  speedBps: number
  isActive: boolean
  browser: string
}

function detectBrowser(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.crdownload') return 'Chrome / Edge / Opera GX'
  if (ext === '.part') return 'Firefox'
  if (ext === '.opdownload') return 'Opera'
  return 'Browser'
}

// A file is "actively downloading" if its size changed since last check
function checkFileActive(filePath: string, currentSize: number): { speedBps: number; active: boolean } {
  const now = Date.now()
  const prev = fileSnapshots.get(filePath)
  fileSnapshots.set(filePath, { size: currentSize, timestamp: now })

  if (!prev) return { speedBps: 0, active: true } // First time seen = assume active

  const dt = (now - prev.timestamp) / 1000
  const delta = currentSize - prev.size

  // If the file has grown in the last interval, it's actively downloading
  const active = delta > 0
  const speedBps = active && dt > 0 ? delta / dt : 0

  // Also check modification time: if modified within last 5 seconds, it's active
  try {
    const stat = fs.statSync(filePath)
    const modifiedAgo = (now - stat.mtimeMs) / 1000
    return {
      speedBps,
      active: active || modifiedAgo < 5
    }
  } catch {
    return { speedBps, active }
  }
}

function scanFolder(folder: string): PartialFile[] {
  const found: PartialFile[] = []
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase()
      if (!PARTIAL_EXTENSIONS.includes(ext)) continue

      const fullPath = path.join(folder, entry.name)
      try {
        const stat = fs.statSync(fullPath)
        const { speedBps, active } = checkFileActive(fullPath, stat.size)
        found.push({
          path: fullPath,
          name: entry.name,
          size: stat.size,
          speedBps,
          isActive: active,
          browser: detectBrowser(entry.name)
        })
      } catch {
        // File may have been removed between readdir and stat
      }
    }
  } catch (e) {
    logger.warn(`Browser monitor: cannot read folder ${folder}:`, (e as Error).message)
  }
  return found
}

// Clean up snapshots for files that no longer exist to prevent memory leak
function cleanupSnapshots(activePaths: Set<string>): void {
  for (const key of fileSnapshots.keys()) {
    if (!activePaths.has(key)) {
      fileSnapshots.delete(key)
    }
  }
}

export async function checkBrowserDownloads(
  extraFolders: string[] = [],
  _ignoreSeeders = true
): Promise<MonitorStatus> {
  const id = 'browser'
  const label = 'Browsers'

  const folders = [...new Set([...getDefaultDownloadFolders(), ...extraFolders])]
  const partialFiles: PartialFile[] = []

  for (const folder of folders) {
    partialFiles.push(...scanFolder(folder))
  }

  // Clean up stale snapshots
  cleanupSnapshots(new Set(partialFiles.map(f => f.path)))

  const activeFiles = partialFiles.filter(f => f.isActive)
  const staleFiles = partialFiles.filter(f => !f.isActive)

  const downloads: DownloadItem[] = []

  for (const file of activeFiles) {
    const finalName = file.name.replace(/\.(crdownload|part|tmp|partial|download|opdownload)$/i, '')
    downloads.push({
      id: `browser_${file.path}`,
      name: finalName || file.name,
      totalBytes: -1,    // Browsers don't expose total easily via filesystem
      downloadedBytes: file.size,
      speedBps: file.speedBps,
      eta: -1,
      state: 'downloading',
      source: 'browser',
      path: path.dirname(file.path)
    })
  }

  // Stale partial files (download paused or hung)
  for (const file of staleFiles) {
    const finalName = file.name.replace(/\.(crdownload|part|tmp|partial|download|opdownload)$/i, '')
    downloads.push({
      id: `browser_stale_${file.path}`,
      name: finalName || file.name,
      totalBytes: -1,
      downloadedBytes: file.size,
      speedBps: 0,
      eta: -1,
      state: 'paused',
      source: 'browser',
      path: path.dirname(file.path)
    })
  }

  let state: DownloadState = 'idle'
  if (activeFiles.length > 0) state = 'downloading'
  else if (staleFiles.length > 0) state = 'paused'

  return {
    id,
    label,
    enabled: true,
    available: true,
    state,
    downloads,
    totalSpeedBps: activeFiles.reduce((s, f) => s + f.speedBps, 0),
    lastUpdated: Date.now()
  }
}
