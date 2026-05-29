import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import { DownloadItem, DownloadState, MonitorStatus } from '../../shared/types'
import { logger } from '../logger'

interface AcfData {
  appid?: string
  name?: string
  installdir?: string
  StateFlags?: string
  BytesToDownload?: string
  BytesDownloaded?: string
  BytesToStage?: string
  BytesStaged?: string
}

// How long after the last file-system write we still consider a download
// "active" before labelling it paused. Generous on purpose: Steam writes in
// bursts (and goes quiet between chunks / during verification), so a short
// window made the state flicker between downloading and paused.
const ACTIVE_GRACE_MS = 45_000

// Steam EAppState bit flags (subset). The "fully installed" bit (4) stays set
// during in-place updates of an already-installed game, so it must NOT be used
// to decide whether a download is happening. The bits below are the ones that
// actually mean "an update/download is running" or "paused mid-update".
const STATE_UPDATE_PAUSED = 512
const STATE_UPDATE_RUNNING_MASK =
  256 | // UpdateRunning
  1024 | // UpdateStarted
  65536 | // Reconfiguring
  131072 | // Validating
  262144 | // AddingFiles
  524288 | // Preallocating
  1048576 | // Downloading
  2097152 | // Staging
  4194304 | // Committing
  8388608 // UpdateStopping

function parseAcf(content: string): AcfData {
  const result: Record<string, string> = {}
  const re = /^\s*"([^"]+)"\s+"([^"]*)"\s*$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    result[match[1]] = match[2]
  }
  return result as AcfData
}

function parseLibraryFolders(vdfPath: string): string[] {
  const paths: string[] = []
  try {
    const content = fs.readFileSync(vdfPath, 'utf8')
    const re = /"path"\s+"([^"]+)"/gi
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      const steamPath = match[1].replace(/\\\\/g, '\\')
      if (fs.existsSync(steamPath) && !paths.includes(steamPath)) {
        paths.push(steamPath)
      }
    }
  } catch {
    // Ignore unreadable library folder files.
  }
  return paths
}

function discoverSteamLibraryPaths(steamPath: string): string[] {
  const libraryApps = new Set<string>()
  const rootsToScan = new Set<string>([steamPath])
  const seenVdfs = new Set<string>()

  const addLibraryRoot = (rootPath: string): void => {
    const steamappsPath = path.join(rootPath, 'steamapps')
    if (fs.existsSync(steamappsPath)) {
      libraryApps.add(steamappsPath)
      rootsToScan.add(rootPath)
    }
  }

  addLibraryRoot(steamPath)

  while (rootsToScan.size > 0) {
    const [rootPath] = rootsToScan
    rootsToScan.delete(rootPath)

    for (const vdfPath of [
      path.join(rootPath, 'steamapps', 'libraryfolders.vdf'),
      path.join(rootPath, 'config', 'libraryfolders.vdf')
    ]) {
      if (seenVdfs.has(vdfPath) || !fs.existsSync(vdfPath)) continue
      seenVdfs.add(vdfPath)

      for (const libraryPath of parseLibraryFolders(vdfPath)) {
        addLibraryRoot(libraryPath)
      }
    }
  }

  return [...libraryApps]
}

function findSteamPath(): string | null {
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)']!, 'Steam') : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Steam') : null
  ].filter(Boolean) as string[]

  for (const steamPath of candidates) {
    if (fs.existsSync(path.join(steamPath, 'steam.exe'))) return steamPath
  }

  try {
    const reg = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath 2>nul',
      { encoding: 'utf8', timeout: 2000 }
    )
    const match = reg.match(/InstallPath\s+REG_SZ\s+(.+)/i)
    if (match) {
      const steamPath = match[1].trim()
      if (fs.existsSync(path.join(steamPath, 'steam.exe'))) return steamPath
    }
  } catch {
    // Registry access can fail in sandboxed or unusual environments.
  }

  return null
}

interface FolderActivity {
  exists: boolean
  latestMtimeMs: number
}

/**
 * Cheap, non-blocking activity probe: does the folder exist and what's the most
 * recent mtime within a shallow depth. We deliberately do NOT sum every file's
 * size (that's expensive on multi-GB trees and was a source of UI lag) — we only
 * need to know whether bytes are still being written.
 */
async function getFolderActivity(rootPath: string, maxDepth = 2): Promise<FolderActivity> {
  let rootStat: fs.Stats
  try {
    rootStat = await fsp.stat(rootPath)
  } catch {
    return { exists: false, latestMtimeMs: 0 }
  }
  if (!rootStat.isDirectory()) return { exists: false, latestMtimeMs: 0 }

  let latestMtimeMs = rootStat.mtimeMs
  const stack: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }]

  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!
    if (depth > maxDepth) continue

    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    await Promise.all(
      entries.map(async entry => {
        const fullPath = path.join(dir, entry.name)
        try {
          const stat = await fsp.stat(fullPath)
          if (stat.mtimeMs > latestMtimeMs) latestMtimeMs = stat.mtimeMs
          if (entry.isDirectory() && depth < maxDepth) {
            stack.push({ dir: fullPath, depth: depth + 1 })
          }
        } catch {
          // Steam moves files around while we look — ignore transient errors.
        }
      })
    )
  }

  return { exists: true, latestMtimeMs }
}

async function processManifest(libPath: string, manifest: string): Promise<DownloadItem | null> {
  const content = await fsp.readFile(path.join(libPath, manifest), 'utf8')
  const acf = parseAcf(content)
  const appId = acf.appid ?? manifest.replace('appmanifest_', '').replace('.acf', '')
  const installDir = acf.installdir?.trim() || ''
  const stateFlags = Number(acf.StateFlags ?? 0)

  // Decide based on the update/download state bits, NOT the "fully installed"
  // bit (4). Bit 4 stays set while an already-installed game is patching, so the
  // old check `(stateFlags & 4)` silently dropped every in-place update — the
  // cause of "Steam isn't detected anymore". A game with only "update required"
  // (bit 2) set but none of the running bits is an *available* update, not an
  // active one, so we deliberately ignore that to avoid flooding the list with
  // every game that merely has a pending patch.
  //
  // NOTE: We can't read a real progress %/speed for Steam from disk — the
  // appmanifest's byte counters stay 0 during a download and the
  // downloading/<appid> folder is a fixed-size staging buffer, not a progress
  // gauge (verified empirically). So an active update is reported as an
  // indeterminate in-progress download rather than a fabricated number.
  const isRunning = (stateFlags & STATE_UPDATE_RUNNING_MASK) !== 0
  const isPaused = (stateFlags & STATE_UPDATE_PAUSED) !== 0

  if (stateFlags === 0 || (!isRunning && !isPaused)) {
    return null
  }

  const stagingPath = path.join(libPath, 'downloading', appId)
  const installPath = installDir ? path.join(libPath, 'common', installDir) : null

  const [downloadActivity, installActivity] = await Promise.all([
    getFolderActivity(stagingPath, 2),
    installPath ? getFolderActivity(installPath, 1) : Promise.resolve({ exists: false, latestMtimeMs: 0 })
  ])

  const latestMtimeMs = Math.max(downloadActivity.latestMtimeMs, installActivity.latestMtimeMs)
  const recentlyActive = latestMtimeMs > 0 && Date.now() - latestMtimeMs <= ACTIVE_GRACE_MS

  // Steam's flags are authoritative for running/paused. Recent disk writes are a
  // secondary confirmation that keeps a briefly-quiet "running" download from
  // being mislabelled. If Steam says it's running, trust it (it may be verifying
  // or between chunks); only fall back to "paused" when the paused bit is set
  // and nothing has been written recently.
  const state: DownloadState = isRunning || recentlyActive ? 'downloading' : 'paused'

  return {
    id: `steam_${appId}`,
    name: acf.name ?? `App ${appId}`,
    totalBytes: -1, // indeterminate — Steam doesn't expose live bytes on disk
    downloadedBytes: 0,
    speedBps: 0,
    eta: -1,
    state,
    source: 'steam',
    path: installPath ?? stagingPath
  }
}

export async function checkSteam(steamPathOverride?: string): Promise<MonitorStatus> {
  const id = 'steam'
  const label = 'Steam'

  const steamPath = steamPathOverride || findSteamPath()
  if (!steamPath) {
    return {
      id,
      label,
      enabled: true,
      available: false,
      state: 'idle',
      downloads: [],
      totalSpeedBps: 0,
      lastUpdated: Date.now(),
      error: 'Steam not found'
    }
  }

  const libraryPaths = discoverSteamLibraryPaths(steamPath)
  const downloads: DownloadItem[] = []

  for (const libPath of libraryPaths) {
    let manifests: string[]
    try {
      manifests = (await fsp.readdir(libPath)).filter(
        file => file.startsWith('appmanifest_') && file.endsWith('.acf')
      )
    } catch {
      continue
    }

    const results = await Promise.all(
      manifests.map(async manifest => {
        try {
          return await processManifest(libPath, manifest)
        } catch (error) {
          logger.warn(`Steam: failed to parse ${manifest}:`, (error as Error).message)
          return null
        }
      })
    )

    for (const item of results) {
      if (item) downloads.push(item)
    }
  }

  const monitorState: DownloadState = downloads.some(download => download.state === 'downloading')
    ? 'downloading'
    : downloads.some(download => download.state === 'installing')
      ? 'installing'
      : downloads.some(download => download.state === 'paused')
        ? 'paused'
        : 'idle'

  return {
    id,
    label,
    enabled: true,
    available: fs.existsSync(path.join(steamPath, 'steam.exe')),
    state: monitorState,
    downloads,
    totalSpeedBps: 0,
    lastUpdated: Date.now()
  }
}
