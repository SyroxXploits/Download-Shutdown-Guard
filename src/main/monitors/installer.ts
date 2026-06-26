import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

// ─── Process name lists ───────────────────────────────────────────────────────

// MSI/NSIS/Inno/generic installer processes
// Only include processes that are unambiguously running an installation.
// Avoid generic names like update.exe/updater.exe that many apps use as background
// auto-update checkers — they'd fire false positives constantly.
const INSTALLER_PROCESSES = [
  'msiexec.exe',          // Windows Installer (MSI packages)
  'setup.exe',            // Generic installer
  'install.exe',          // Generic installer
  'installer.exe',        // Generic installer
  'uninstall.exe',        // Uninstallers (also block shutdown)
  'uninst.exe',
  'patch.exe',            // Patch installers
  'bootstrap.exe',        // Bootstrappers (download deps, then install)
  'dotNetFx*.exe',        // .NET runtime installers
  'vcredist*.exe',        // Visual C++ redistributable
  'directx*.exe',         // DirectX setup
  'oalinst.exe',          // OpenAL installer
  'dxsetup.exe'
]

// Windows Update processes.
//
// NOTE: We deliberately keep this EMPTY. TiWorker.exe and TrustedInstaller.exe
// (component-based servicing) run constantly in the background for routine
// maintenance — component cleanup, scheduled servicing stack work, optional
// feature changes — NOT just user-initiated Windows Updates. Surfacing them as
// individual tasks produced confusing "weird" entries that appeared even when
// nothing was actually being downloaded/installed by the user.
//
// Genuine, actively-downloading Windows Updates are still detected via the
// consolidated "Windows Update" item below, which requires BOTH the update
// service to be running AND recent file activity in SoftwareDistribution.
const WINDOWS_UPDATE_PROCESSES: string[] = []

// Package managers
const PACKAGE_MANAGER_PROCESSES = [
  'winget.exe',           // Windows Package Manager
  'choco.exe',            // Chocolatey
  'chocolatey.exe',
  'scoop.exe',            // Scoop
  'nuget.exe',            // NuGet
  'pip.exe',              // Python pip
  'pip3.exe',
  'npm.exe',              // Node package manager (in install mode)
  'npx.exe',
  'pnpm.exe',
  'yarn.exe'
]

const ALL_WATCHED_PROCESSES = [
  ...INSTALLER_PROCESSES,
  ...WINDOWS_UPDATE_PROCESSES,
  ...PACKAGE_MANAGER_PROCESSES
]

// ─── Tasklist runner ──────────────────────────────────────────────────────────

interface RunningProcess {
  name: string
  pid: number
  category: string
}

interface ProcessSnapshot {
  names: Set<string>
  commandLines: string[]
}

interface LauncherProbe {
  id: string
  name: string
  processNames: string[]
  commandLinePatterns?: RegExp[]
  activityPaths: string[]
}

const ACTIVE_FILE_WINDOW_MS = 120_000

const LAUNCHER_PROBES: LauncherProbe[] = [
  {
    id: 'ea',
    name: 'EA App',
    processNames: ['EADesktop.exe', 'EABackgroundService.exe', 'EALocalHostSvc.exe', 'origin.exe'],
    commandLinePatterns: [/EADesktop/i, /Electronic Arts/i],
    activityPaths: [
      '%ProgramData%\\EA Desktop\\*',
      '%ProgramData%\\Electronic Arts\\EA Desktop\\*',
      '%LOCALAPPDATA%\\Electronic Arts\\EA Desktop\\*',
      '%LOCALAPPDATA%\\EADesktop\\*',
      '%APPDATA%\\EA Desktop\\*'
    ]
  },
  {
    id: 'ubisoft',
    name: 'Ubisoft Connect',
    processNames: ['upc.exe', 'UbisoftConnect.exe', 'UbisoftGameLauncher.exe', 'UbisoftGameLauncher64.exe'],
    commandLinePatterns: [/Ubisoft/i, /Uplay/i],
    activityPaths: [
      '%ProgramFiles(x86)%\\Ubisoft\\Ubisoft Game Launcher\\cache\\*',
      '%ProgramFiles%\\Ubisoft\\Ubisoft Game Launcher\\cache\\*',
      '%LOCALAPPDATA%\\Ubisoft Game Launcher\\cache\\*',
      '%ProgramData%\\Ubisoft\\*'
    ]
  },
  {
    id: 'xbox',
    name: 'Xbox App',
    processNames: ['XboxPcApp.exe', 'GamingServices.exe', 'GamingServicesNet.exe'],
    commandLinePatterns: [/XboxPcApp/i, /GamingServices/i],
    activityPaths: [
      '%LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_*\\LocalCache\\*',
      '%LOCALAPPDATA%\\Packages\\Microsoft.XboxApp_*\\LocalCache\\*',
      '%ProgramData%\\Microsoft\\Windows\\DeliveryOptimization\\Cache\\*'
    ]
  },
  {
    id: 'microsoft-store',
    name: 'Microsoft Store',
    processNames: ['WinStore.App.exe', 'StoreExperienceHost.exe', 'Microsoft.StorePurchaseApp.exe'],
    commandLinePatterns: [/WindowsApps\\Microsoft\.WindowsStore/i, /StoreExperienceHost/i],
    activityPaths: [
      '%LOCALAPPDATA%\\Packages\\Microsoft.WindowsStore_*\\LocalCache\\*',
      '%LOCALAPPDATA%\\Packages\\Microsoft.StorePurchaseApp_*\\LocalCache\\*',
      '%ProgramData%\\Microsoft\\Windows\\DeliveryOptimization\\Cache\\*'
    ]
  }
]

function expandPathPattern(pattern: string): string[] {
  const expanded = pattern.replace(/%([^%]+)%/g, (_, key: string) => process.env[key] ?? '')
  if (!expanded || expanded.includes('%')) return []

  const wildcardIndex = expanded.indexOf('*')
  if (wildcardIndex === -1) return [expanded]

  const parent = expanded.slice(0, wildcardIndex)
  const lastSeparator = Math.max(parent.lastIndexOf('\\'), parent.lastIndexOf('/'))
  const baseDir = lastSeparator >= 0 ? parent.slice(0, lastSeparator) : parent
  if (!baseDir || !fs.existsSync(baseDir)) return []

  try {
    const escaped = expanded
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
    const re = new RegExp(`^${escaped}$`, 'i')
    return fs.readdirSync(baseDir)
      .map(entry => path.join(baseDir, entry))
      .filter(fullPath => re.test(fullPath))
  } catch {
    return []
  }
}

function hasRecentFileActivity(rootPath: string, cutoff: number, maxDepth = 2): boolean {
  try {
    const stat = fs.statSync(rootPath)
    if (stat.mtimeMs > cutoff) return true
    if (!stat.isDirectory()) return false
  } catch {
    return false
  }

  const stack: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }]
  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!
    if (depth > maxDepth) continue

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.mtimeMs > cutoff) return true
        if (entry.isDirectory() && depth < maxDepth) {
          stack.push({ dir: fullPath, depth: depth + 1 })
        }
      } catch {
        // Launcher caches can churn while we look; ignore transient misses.
      }
    }
  }

  return false
}

function getProcessSnapshot(): ProcessSnapshot {
  try {
    const script = [
      'Get-CimInstance Win32_Process |',
      'Select-Object Name,CommandLine |',
      'ConvertTo-Json -Compress'
    ].join(' ')
    const output = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim()
    if (!output) return { names: new Set(), commandLines: [] }

    const parsed = JSON.parse(output) as Array<{ Name?: string; CommandLine?: string }> | { Name?: string; CommandLine?: string }
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return {
      names: new Set(rows.map(row => row.Name?.toLowerCase()).filter(Boolean) as string[]),
      commandLines: rows.map(row => row.CommandLine ?? '').filter(Boolean)
    }
  } catch {
    return { names: new Set(), commandLines: [] }
  }
}

function getRunningInstallers(): RunningProcess[] {
  try {
    // Get the full process list once and parse it
    const output = execSync('tasklist /FO CSV /NH 2>nul', {
      encoding: 'utf8',
      timeout: 5000
    })

    const processes: RunningProcess[] = []
    const lines = output.trim().split('\n')

    for (const line of lines) {
      const parts = line.split('","').map(p => p.replace(/"/g, '').trim())
      if (parts.length < 2) continue
      const name = parts[0].toLowerCase()
      const pid = parseInt(parts[1], 10) || 0

      // Match against watched process list (with glob support for patterns like dotNetFx*.exe)
      for (const watched of ALL_WATCHED_PROCESSES) {
        const pattern = watched.toLowerCase()
        if (pattern.includes('*')) {
          const prefix = pattern.split('*')[0]
          const suffix = pattern.split('*')[1] || ''
          if (name.startsWith(prefix) && name.endsWith(suffix)) {
            processes.push({ name: parts[0], pid, category: categorize(watched) })
            break
          }
        } else if (name === pattern) {
          processes.push({ name: parts[0], pid, category: categorize(watched) })
          break
        }
      }
    }

    return processes
  } catch (e) {
    logger.warn('Installer monitor: tasklist failed:', (e as Error).message)
    return []
  }
}

function categorize(processName: string): string {
  const name = processName.toLowerCase()
  if (WINDOWS_UPDATE_PROCESSES.some(p => p.toLowerCase() === name)) return 'Windows Update'
  if (PACKAGE_MANAGER_PROCESSES.some(p => p.toLowerCase() === name)) return 'Package Manager'
  return 'Installer'
}

function detectLauncherActivity(snapshot: ProcessSnapshot): DownloadItem[] {
  const cutoff = Date.now() - ACTIVE_FILE_WINDOW_MS
  const items: DownloadItem[] = []

  for (const probe of LAUNCHER_PROBES) {
    const processRunning = probe.processNames.some(name => snapshot.names.has(name.toLowerCase())) ||
      (probe.commandLinePatterns ?? []).some(pattern => snapshot.commandLines.some(commandLine => pattern.test(commandLine)))

    if (!processRunning) continue

    const hasActivity = probe.activityPaths
      .flatMap(expandPathPattern)
      .some(candidate => hasRecentFileActivity(candidate, cutoff))

    if (!hasActivity) continue

    items.push({
      id: `launcher_${probe.id}`,
      name: probe.name,
      totalBytes: -1,
      downloadedBytes: 0,
      speedBps: 0,
      eta: -1,
      state: 'installing',
      source: 'installer'
    })
  }

  return items
}

// ─── Windows Update service state ────────────────────────────────────────────

function isWindowsUpdateServiceActive(): boolean {
  try {
    // Query the wuauserv and UsoSvc services for running state
    const out = execSync(
      'sc query wuauserv 2>nul && sc query UsoSvc 2>nul',
      { encoding: 'utf8', timeout: 3000 }
    )
    // If "RUNNING" appears in the output for either, WU is active
    return out.includes('RUNNING')
  } catch {
    return false
  }
}

// ─── Pending Windows Updates detection ───────────────────────────────────────

function hasPendingWindowsUpdates(): boolean {
  // SoftwareDistribution\Download always has subdirectories (cached past updates).
  // Only flag as "active" if a file inside was written within the last 2 minutes,
  // which means Windows Update is currently downloading or staging something.
  const wuFolder = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'SoftwareDistribution',
    'Download'
  )
  try {
    if (!fs.existsSync(wuFolder)) return false
    const cutoff = Date.now() - 120_000
    for (const entry of fs.readdirSync(wuFolder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const sub = path.join(wuFolder, entry.name)
      try {
        for (const file of fs.readdirSync(sub)) {
          const stat = fs.statSync(path.join(sub, file))
          if (stat.mtimeMs > cutoff) return true
        }
      } catch { /* skip inaccessible subfolder */ }
    }
    return false
  } catch {
    return false
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function checkInstallers(): Promise<MonitorStatus> {
  const id = 'installer'
  const label = 'Installers & Updates'

  try {
    const running = getRunningInstallers()
    const processSnapshot = getProcessSnapshot()
    const wuServiceActive = isWindowsUpdateServiceActive()
    const wuHasPending = hasPendingWindowsUpdates()

    const items: DownloadItem[] = []

    // Add each running installer process as a download item
    for (const proc of running) {
      items.push({
        id: `inst_${proc.pid}`,
        name: `${proc.name} (${proc.category})`,
        totalBytes: -1,
        downloadedBytes: 0,
        speedBps: 0,
        eta: -1,
        state: 'installing',
        source: 'installer'
      })
    }

    // Windows Update: add an item if the service is active and there are staged updates
    if (wuServiceActive && wuHasPending && !running.some(p => WINDOWS_UPDATE_PROCESSES.some(w => w.toLowerCase() === p.name.toLowerCase()))) {
      items.push({
        id: 'wu_service',
        name: 'Windows Update',
        totalBytes: -1,
        downloadedBytes: 0,
        speedBps: 0,
        eta: -1,
        state: 'installing',
        source: 'installer'
      })
    }

    items.push(...detectLauncherActivity(processSnapshot))

    const state: DownloadState = items.length > 0 ? 'installing' : 'idle'

    return {
      id,
      label,
      enabled: true,
      available: true,
      state,
      downloads: items,
      totalSpeedBps: 0,
      lastUpdated: Date.now()
    }
  } catch (e) {
    logger.error('Installer monitor error:', e)
    return {
      id,
      label,
      enabled: true,
      available: false,
      state: 'idle',
      downloads: [],
      totalSpeedBps: 0,
      lastUpdated: Date.now(),
      error: (e as Error).message
    }
  }
}
