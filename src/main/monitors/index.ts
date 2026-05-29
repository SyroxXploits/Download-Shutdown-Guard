import { AppSettings, AppStatus, MonitorStatus, ShutdownState } from '../../shared/types'
import { checkSteam } from './steam'
import { checkQbittorrent } from './qbittorrent'
import { checkUtorrent } from './utorrent'
import { checkTransmission } from './transmission'
import { checkBrowserDownloads } from './browser'
import { checkInstallers } from './installer'
import { logger } from '../logger'

export type StatusCallback = (status: AppStatus) => void

export class MonitorCoordinator {
  private intervalMs: number
  private timer: NodeJS.Timeout | null = null
  private settings: AppSettings
  private callbacks: StatusCallback[] = []
  private startTime = Date.now()
  private pollInFlight = false

  // Cooldown tracking: seconds since ALL tasks completed
  private cooldownStartedAt: number | null = null
  private shutdownState: ShutdownState

  constructor(settings: AppSettings) {
    this.settings = settings
    // Poll every 2s so download speed/progress feel real-time. This is only
    // safe because every monitor (Steam folder scans included) is now fully
    // async and never blocks the main process.
    this.intervalMs = 2000
    this.shutdownState = this.buildInitialShutdownState()
  }

  private buildInitialShutdownState(): ShutdownState {
    return {
      phase: 'monitoring',
      cooldownRemaining: this.settings.shutdown.cooldownSeconds,
      countdownRemaining: this.settings.shutdown.countdownSeconds,
      action: this.settings.shutdown.action
    }
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    this.shutdownState.action = settings.shutdown.action
  }

  onStatusUpdate(cb: StatusCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  private emit(status: AppStatus): void {
    this.callbacks.forEach(cb => {
      try {
        cb(status)
      } catch (e) {
        logger.error('Status callback error:', e)
      }
    })
  }

  start(): void {
    if (this.timer) return
    logger.info('MonitorCoordinator started')
    this.poll()
    this.timer = setInterval(() => this.poll(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    logger.info('MonitorCoordinator stopped')
  }

  async poll(): Promise<void> {
    if (this.pollInFlight) return
    this.pollInFlight = true
    try {
      const statuses = await this.fetchAll()
      const status = this.buildAppStatus(statuses)
      this.emit(status)
    } catch (e) {
      logger.error('Poll error:', e)
    } finally {
      this.pollInFlight = false
    }
  }

  private async fetchAll(): Promise<MonitorStatus[]> {
    const s = this.settings
    const tasks: Promise<MonitorStatus>[] = []

    if (s.monitors.steam?.enabled) {
      tasks.push(checkSteam(s.monitors.steam.steamPath))
    }
    if (s.monitors.qbittorrent?.enabled) {
      tasks.push(
        checkQbittorrent(
          s.monitors.qbittorrent.qbittorrentUrl,
          s.monitors.qbittorrent.qbittorrentUsername,
          s.monitors.qbittorrent.qbittorrentPassword,
          s.shutdown.ignoreSeeders
        )
      )
    }
    if (s.monitors.utorrent?.enabled) {
      tasks.push(
        checkUtorrent(
          s.monitors.utorrent.utorrentUrl,
          s.monitors.utorrent.utorrentUsername,
          s.monitors.utorrent.utorrentPassword,
          s.shutdown.ignoreSeeders
        )
      )
    }
    if (s.monitors.transmission?.enabled) {
      tasks.push(
        checkTransmission(
          s.monitors.transmission.transmissionUrl,
          s.monitors.transmission.transmissionUsername,
          s.monitors.transmission.transmissionPassword
        )
      )
    }
    if (s.monitors.browser?.enabled) {
      tasks.push(checkBrowserDownloads(s.monitors.browser.downloadFolders, s.shutdown.ignoreSeeders))
    }
    if (s.monitors.installer?.enabled) {
      tasks.push(checkInstallers())
    }

    // Run all monitors in parallel — if one throws it returns an error status
    const results = await Promise.allSettled(tasks)
    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      logger.error(`Monitor ${i} failed:`, r.reason)
      return {
        id: 'generic' as const,
        label: 'Unknown',
        enabled: false,
        available: false,
        state: 'idle' as const,
        downloads: [],
        totalSpeedBps: 0,
        lastUpdated: Date.now(),
        error: String(r.reason)
      }
    })
  }

  private buildAppStatus(statuses: MonitorStatus[]): AppStatus {
    // All currently detected download items across every monitor
    const allDetectedIds = new Set(statuses.flatMap(s => s.downloads).map(d => d.id))
    const globalSpeedBps = statuses.reduce((s, m) => s + m.totalSpeedBps, 0)

    // Shutdown is driven only by tasks the user explicitly added to the watch list.
    // If nothing is watched, the app stays idle and never triggers shutdown.
    const watchedTasks = this.settings.watchedTasks ?? []
    const watchedActive = watchedTasks.filter(t => allDetectedIds.has(t.id))

    const hasActiveTasks = watchedTasks.length > 0 && watchedActive.length > 0
    const allComplete = watchedTasks.length > 0 && watchedActive.length === 0

    // ── Phase machine ──────────────────────────────────────────────────────────
    const now = Date.now()
    const sd = this.shutdownState
    const cfg = this.settings.shutdown

    if (sd.phase === 'monitoring') {
      if (allComplete) {
        if (this.cooldownStartedAt === null) {
          this.cooldownStartedAt = now
          logger.info('All tasks complete — starting cooldown timer')
        }
        const elapsed = (now - this.cooldownStartedAt) / 1000
        const remaining = Math.max(0, cfg.cooldownSeconds - elapsed)
        sd.cooldownRemaining = Math.ceil(remaining)

        if (remaining <= 0) {
          sd.phase = 'countdown'
          sd.countdownRemaining = cfg.countdownSeconds
          logger.info('Cooldown complete — entering shutdown countdown')
        }
      } else {
        if (this.cooldownStartedAt !== null) {
          logger.info('Task activity detected — resetting cooldown')
          this.cooldownStartedAt = null
        }
        sd.cooldownRemaining = cfg.cooldownSeconds
      }
    } else if (sd.phase === 'countdown') {
      // If a new task appears during countdown, abort and go back to monitoring
      if (!allComplete) {
        logger.info('New task detected during countdown — cancelling shutdown')
        sd.phase = 'monitoring'
        sd.cooldownRemaining = cfg.cooldownSeconds
        sd.countdownRemaining = cfg.countdownSeconds
        this.cooldownStartedAt = null
      }
    } else if (sd.phase === 'snoozed') {
      if (now >= (sd.snoozedUntil ?? 0)) {
        logger.info('Snooze expired — resuming monitoring')
        sd.phase = 'monitoring'
        sd.cooldownRemaining = cfg.cooldownSeconds
        this.cooldownStartedAt = null
      }
      if (hasActiveTasks) {
        sd.phase = 'monitoring'
        this.cooldownStartedAt = null
      }
    } else if (sd.phase === 'cancelled') {
      if (hasActiveTasks) {
        logger.info('New task started — resuming monitoring after cancel')
        sd.phase = 'monitoring'
        this.cooldownStartedAt = null
      }
    }

    return {
      monitors: statuses,
      shutdown: { ...sd },
      globalSpeedBps,
      activeDownloadCount: watchedActive.length,
      allComplete,
      uptime: Math.floor((now - this.startTime) / 1000),
      watchedTasks
    }
  }

  getShutdownState(): ShutdownState {
    return { ...this.shutdownState }
  }

  cancelShutdown(): void {
    this.shutdownState.phase = 'cancelled'
    this.shutdownState.cooldownRemaining = this.settings.shutdown.cooldownSeconds
    this.cooldownStartedAt = null
    logger.info('Shutdown cancelled by user')
  }

  snooze(minutes: number): void {
    this.shutdownState.phase = 'snoozed'
    this.shutdownState.snoozedUntil = Date.now() + minutes * 60 * 1000
    this.cooldownStartedAt = null
    logger.info(`Shutdown snoozed for ${minutes} minutes`)
  }

  tickCountdown(): 'shutdown' | 'continue' {
    if (this.shutdownState.phase !== 'countdown') return 'continue'
    this.shutdownState.countdownRemaining = Math.max(
      0,
      this.shutdownState.countdownRemaining - 1
    )
    if (this.shutdownState.countdownRemaining <= 0) {
      this.shutdownState.phase = 'shutting_down'
      return 'shutdown'
    }
    return 'continue'
  }

  resetAfterShutdownCancel(): void {
    this.shutdownState = this.buildInitialShutdownState()
    this.cooldownStartedAt = null
  }
}
