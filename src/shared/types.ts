// ─── Download / Install Status Types ─────────────────────────────────────────

export type MonitorId =
  | 'steam'
  | 'qbittorrent'
  | 'utorrent'
  | 'transmission'
  | 'browser'
  | 'generic'
  | 'installer'

export type DownloadState =
  | 'idle'        // Nothing to download/install
  | 'downloading' // Actively transferring bytes
  | 'installing'  // Running an installer / applying update
  | 'paused'      // Download exists but paused
  | 'seeding'     // Torrent seeding (not a real download)
  | 'completing'  // Transfer just finished, verifying/moving
  | 'error'       // Monitor error

export interface DownloadItem {
  id: string
  name: string
  totalBytes: number
  downloadedBytes: number
  speedBps: number       // bytes per second
  eta: number            // seconds, -1 = unknown
  state: DownloadState
  source: MonitorId
  path?: string
}

export interface MonitorStatus {
  id: MonitorId
  label: string
  enabled: boolean
  available: boolean     // Is the source app detected/running?
  state: DownloadState
  downloads: DownloadItem[]
  totalSpeedBps: number
  lastUpdated: number    // unix ms
  error?: string
}

// ─── Shutdown State ───────────────────────────────────────────────────────────

export type ShutdownAction = 'shutdown' | 'signout' | 'sleep' | 'hibernate' | 'restart'

export type AppPhase =
  | 'monitoring'       // Watching for downloads/installs
  | 'cooldown'         // All done, counting down idle time
  | 'countdown'        // Showing shutdown countdown to user
  | 'snoozed'          // User hit snooze
  | 'cancelled'        // User cancelled
  | 'shutting_down'    // Executing shutdown

export interface ShutdownState {
  phase: AppPhase
  cooldownRemaining: number   // seconds left in idle cooldown
  countdownRemaining: number  // seconds left in shutdown countdown
  action: ShutdownAction
  snoozedUntil?: number       // unix ms
}

// ─── Watched Tasks ────────────────────────────────────────────────────────────

export interface WatchedTask {
  id: string        // matches DownloadItem.id
  name: string
  source: MonitorId
  addedAt: number   // unix ms
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface MonitorConfig {
  enabled: boolean
  qbittorrentUrl?: string
  qbittorrentUsername?: string
  qbittorrentPassword?: string
  utorrentUrl?: string
  utorrentUsername?: string
  utorrentPassword?: string
  transmissionUrl?: string
  transmissionUsername?: string
  transmissionPassword?: string
  steamPath?: string
  downloadFolders?: string[]
}

export interface NotificationConfig {
  sound: boolean
  soundFile?: string
  volume: number   // 0-100
}

export type AppLanguage = 'en' | 'fr'

export type AppTheme = 'dark' | 'black' | 'light' | 'blue' | 'darkblue'

export interface AppSettings {
  monitors: Record<MonitorId, MonitorConfig>
  shutdown: {
    action: ShutdownAction
    cooldownSeconds: number       // Idle time before countdown (default 120)
    countdownSeconds: number      // Countdown duration (default 60)
    ignoreSeeders: boolean        // Don't count seeding as active
    ignoreNetworkDrop: boolean    // Don't reset on brief disconnects
  }
  ui: {
    minimizeToTray: boolean
    startMinimized: boolean
    theme: AppTheme
    language: AppLanguage
  }
  system: {
    autoStart: boolean
    runAsPortable: boolean
  }
  notifications: NotificationConfig
  whitelist: string[]   // Process names to ignore
  blacklist: string[]   // Process names to always watch
  hotkeys: {
    cancelShutdown: string
    snooze: string
    openApp: string
  }
  watchedTasks: WatchedTask[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  monitors: {
    steam: { enabled: true },
    qbittorrent: {
      enabled: true,
      qbittorrentUrl: 'http://localhost:8080',
      qbittorrentUsername: '',
      qbittorrentPassword: ''
    },
    utorrent: {
      enabled: true,
      utorrentUrl: 'http://localhost:8080',
      utorrentUsername: '',
      utorrentPassword: ''
    },
    transmission: {
      enabled: true,
      transmissionUrl: 'http://localhost:9091',
      transmissionUsername: '',
      transmissionPassword: ''
    },
    browser: { enabled: true, downloadFolders: [] },
    generic: { enabled: true, downloadFolders: [] },
    installer: { enabled: true }
  },
  shutdown: {
    action: 'shutdown',
    cooldownSeconds: 120,
    countdownSeconds: 60,
    ignoreSeeders: true,
    ignoreNetworkDrop: true
  },
  ui: {
    minimizeToTray: true,
    startMinimized: false,
    theme: 'dark',
    language: 'en'
  },
  system: {
    autoStart: false,
    runAsPortable: false
  },
  notifications: {
    sound: true,
    volume: 70
  },
  whitelist: [],
  blacklist: [],
  hotkeys: {
    cancelShutdown: 'Ctrl+Shift+C',
    snooze: 'Ctrl+Shift+S',
    openApp: 'Ctrl+Shift+D'
  },
  watchedTasks: []
}

// ─── IPC Event Types ──────────────────────────────────────────────────────────

export interface IpcEvents {
  'app:get-status': () => AppStatus
  'app:cancel-shutdown': () => void
  'app:snooze': (minutes: number) => void
  'app:shutdown-now': () => void
  'settings:get': () => AppSettings
  'settings:set': (settings: AppSettings) => void
  'settings:reset': () => AppSettings
  'window:minimize': () => void
  'window:close': () => void
  'window:toggle-maximize': () => void
  'system:open-downloads-folder': () => void
  'system:open-external': (url: string) => boolean
  'system:check-for-updates': () => Promise<UpdateCheckResult>
  'status:update': (status: AppStatus) => void
  'shutdown:countdown': (state: ShutdownState) => void
  'notification:show': (msg: string, type: 'info' | 'warning' | 'error') => void
}

export interface AppStatus {
  monitors: MonitorStatus[]
  shutdown: ShutdownState
  globalSpeedBps: number
  activeDownloadCount: number  // watched tasks still actively detected
  allComplete: boolean         // all watched tasks done (list non-empty)
  uptime: number               // seconds
  watchedTasks: WatchedTask[]  // current watch list (from settings)
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseUrl: string
  publishedAt?: string
  isUpdateAvailable: boolean
  error?: string
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatSpeed(bps: number): string {
  return `${formatBytes(bps)}/s`
}

export function formatEta(seconds: number): string {
  if (seconds < 0) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
