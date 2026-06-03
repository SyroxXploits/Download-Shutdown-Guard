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

// How long after the manifest was last written we still consider a download
// active before labeling it paused. Steam writes in bursts and can go quiet
// during verification, so a short window makes the state flicker.
const ACTIVE_GRACE_MS = 45_000

// Steam EAppState bit flags (subset). The "fully installed" bit (4) stays set
// during in-place updates, so it must not be used to decide if a download is active.
const STATE_UPDATE_PAUSED = 512

// Bits that mean bytes are being moved/applied right now. When a download is
// paused Steam clears these but leaves the generic update markers below set.
const STATE_TRANSFER_MASK =
  65536 | // Reconfiguring
  131072 | // Validating
  262144 | // AddingFiles
  524288 | // Preallocating
  1048576 | // Downloading
  2097152 | // Staging
  4194304 | // Committing
  8388608 // UpdateStopping

// Generic "an update is in progress" markers. Steam keeps these set even while
// the download is paused, so on their own they do not imply active transfer.
const STATE_UPDATE_ACTIVE_MASK =
  256 | // UpdateRunning
  1024 // UpdateStarted

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

async function processManifest(libPath: string, manifest: string): Promise<DownloadItem | null> {
  const manifestPath = path.join(libPath, manifest)
  const [content, manifestStat] = await Promise.all([
    fsp.readFile(manifestPath, 'utf8'),
    fsp.stat(manifestPath).catch(() => null)
  ])
  const acf = parseAcf(content)
  const appId = acf.appid ?? manifest.replace('appmanifest_', '').replace('.acf', '')
  const installDir = acf.installdir?.trim() || ''
  const stateFlags = Number(acf.StateFlags ?? 0)

  // Decide based on update/download state bits, not the "fully installed" bit
  // (4). Bit 4 stays set while an already-installed game is patching.
  const isPaused = (stateFlags & STATE_UPDATE_PAUSED) !== 0
  const isTransferring = (stateFlags & STATE_TRANSFER_MASK) !== 0
  const isUpdateFlagged = (stateFlags & STATE_UPDATE_ACTIVE_MASK) !== 0

  // Surface the task if it is transferring, paused, or otherwise flagged as an
  // in-progress update. A game that is merely fully installed has none of these.
  if (stateFlags === 0 || (!isPaused && !isTransferring && !isUpdateFlagged)) {
    return null
  }

  const installPath = installDir ? path.join(libPath, 'common', installDir) : null
  const stagingPath = path.join(libPath, 'downloading', appId)
  const latestMtimeMs = manifestStat?.mtimeMs ?? 0
  const recentlyActive = latestMtimeMs > 0 && Date.now() - latestMtimeMs <= ACTIVE_GRACE_MS

  // The paused bit always wins. Otherwise, trust Steam's transfer bits and the
  // manifest timestamp. Do not scan steamapps/downloading or common/<game>:
  // repeatedly touching Steam's active file tree on Windows can contribute to
  // "Disk error" failures while Steam preallocates, stages, renames, or commits.
  const reallyDownloading = !isPaused && (isTransferring || recentlyActive)
  const state: DownloadState = reallyDownloading ? 'downloading' : 'paused'

  return {
    id: `steam_${appId}`,
    name: acf.name ?? `App ${appId}`,
    totalBytes: -1,
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
