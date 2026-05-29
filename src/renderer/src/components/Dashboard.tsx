import React from 'react'
import {
  Activity, Clock, Zap, Shield, CheckCircle2,
  Timer, Power, Moon, RotateCw, AlertCircle, LogOut,
  Plus, X, Gamepad2, Magnet, Globe, HardDrive, Package
} from 'lucide-react'
import type { AppStatus, AppSettings, ShutdownAction, WatchedTask, DownloadItem, MonitorId } from '../../../shared/types'
import { formatSpeed, formatBytes, formatEta, formatDuration } from '../../../shared/types'
import { CountdownDialog } from './CountdownDialog'
import { useTranslation } from '../hooks/useTranslation'

interface DashboardProps {
  status: AppStatus | null
  settings: AppSettings
  onCancel: () => void
  onSnooze: (minutes: number) => void
  onShutdownNow: () => void
  onAddWatched: (task: WatchedTask) => void
  onRemoveWatched: (id: string) => void
}

const ACTION_ICONS: Record<ShutdownAction, React.ReactNode> = {
  shutdown: <Power size={15} />,
  signout: <LogOut size={15} />,
  sleep: <Moon size={15} />,
  hibernate: <Moon size={15} />,
  restart: <RotateCw size={15} />
}

const SOURCE_ICONS: Record<MonitorId, React.ReactNode> = {
  steam: <Gamepad2 size={15} />,
  qbittorrent: <Magnet size={15} />,
  utorrent: <Magnet size={15} />,
  transmission: <Magnet size={15} />,
  browser: <Globe size={15} />,
  generic: <HardDrive size={15} />,
  installer: <Package size={15} />
}

function StatPill({
  icon, label, value, accent = false
}: {
  icon: React.ReactNode; label: string; value: string; accent?: boolean
}): React.ReactElement {
  return (
    <div className="card-overlay px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${accent ? 'bg-accent/20' : 'bg-fill/[0.06]'}`}>
        <div className={accent ? 'text-accent-light' : 'text-text-secondary'}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-text-tertiary truncate">{label}</div>
        <div className={`text-sm font-semibold truncate ${accent ? 'text-accent-light' : 'text-text-primary'}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

function PhaseBar({ status }: { status: AppStatus }): React.ReactElement {
  const { tr } = useTranslation()
  const { phase, cooldownRemaining, countdownRemaining } = status.shutdown
  const cooldownTotal = (status.shutdown as unknown as { cooldownSeconds?: number }).cooldownSeconds ?? 120
  const hasWatched = status.watchedTasks.length > 0

  let label: string
  let subLabel: string
  let color: string
  let icon: React.ReactNode

  if (!hasWatched) {
    label = tr.dashboard.phaseNoWatched
    subLabel = tr.dashboard.watchingEmptyDesc
    color = 'border-stroke bg-fill/[0.04]'
    icon = <Shield size={14} className="text-text-tertiary" />
  } else {
    switch (phase) {
      case 'monitoring':
        if (status.activeDownloadCount > 0) {
          label = tr.dashboard.phaseMonitoring
          subLabel = tr.dashboard.phaseMonitoringActive.replace('{count}', String(status.activeDownloadCount))
          color = 'border-accent bg-accent/10'
          icon = <Activity size={14} className="text-accent-light" />
        } else {
          label = tr.dashboard.phaseMonitoring
          subLabel = tr.dashboard.phaseMonitoringIdle
          color = 'border-stroke bg-fill/[0.04]'
          icon = <Shield size={14} className="text-text-tertiary" />
        }
        break
      case 'cooldown':
        label = tr.dashboard.phaseCooldown
        subLabel = tr.dashboard.phaseCooldownDesc.replace('{time}', formatDuration(cooldownRemaining))
        color = 'border-status-success/40 bg-status-success/10'
        icon = <Timer size={14} className="text-status-success" />
        break
      case 'countdown':
        label = tr.dashboard.phaseCountdown
        subLabel = tr.dashboard.phaseCountdownDesc.replace('{seconds}', String(countdownRemaining))
        color = 'border-status-warning/40 bg-status-warning/10'
        icon = <Power size={14} className="text-status-warning" />
        break
      case 'snoozed':
        label = tr.dashboard.phaseSnoozed
        subLabel = tr.dashboard.phaseSnoozedDesc
        color = 'border-status-info/40 bg-status-info/10'
        icon = <Clock size={14} className="text-status-info" />
        break
      case 'cancelled':
        label = tr.dashboard.phaseCancelled
        subLabel = tr.dashboard.phaseCancelledDesc
        color = 'border-status-error/40 bg-status-error/10'
        icon = <AlertCircle size={14} className="text-status-error" />
        break
      case 'shutting_down':
        label = tr.dashboard.phaseShuttingDown
        subLabel = tr.dashboard.phaseShuttingDownDesc
        color = 'border-status-error/60 bg-status-error/20'
        icon = <Power size={14} className="text-status-error" />
        break
      default:
        label = ''
        subLabel = ''
        color = 'border-stroke bg-fill/[0.04]'
        icon = <Shield size={14} />
    }
  }

  const cooldownPct = phase === 'cooldown'
    ? Math.max(0, 100 - (cooldownRemaining / cooldownTotal) * 100)
    : null

  return (
    <div className={`rounded-win border px-4 py-3 ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-text-primary">{label}</span>
        </div>
        {phase === 'cooldown' && (
          <span className="text-xs font-mono text-status-success">
            {formatDuration(cooldownRemaining)}
          </span>
        )}
      </div>
      <p className="text-xs text-text-secondary">{subLabel}</p>
      {cooldownPct !== null && (
        <div className="progress-bar mt-2">
          <div
            className="progress-fill bg-status-success"
            style={{ width: `${cooldownPct}%`, transition: 'width 1s linear' }}
          />
        </div>
      )}
    </div>
  )
}

export function Dashboard({
  status,
  settings,
  onCancel,
  onSnooze,
  onShutdownNow,
  onAddWatched,
  onRemoveWatched
}: DashboardProps): React.ReactElement {
  const { tr } = useTranslation()

  if (!status) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-text-tertiary">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{tr.dashboard.connecting}</span>
      </div>
    )
  }

  const actionLabel = tr.actions[settings.shutdown.action] ?? tr.actions.shutdown
  const actionIcon = ACTION_ICONS[settings.shutdown.action] ?? <Power size={15} />

  // Build a flat map of all currently active download items
  const allActiveItems = new Map<string, DownloadItem>()
  for (const monitor of status.monitors) {
    for (const item of monitor.downloads) {
      allActiveItems.set(item.id, item)
    }
  }

  // Watched tasks with their live state
  const watchedTasks = status.watchedTasks
  const watchedIds = new Set(watchedTasks.map(t => t.id))

  // Detected tasks not yet in the watch list
  const detectedItems = Array.from(allActiveItems.values()).filter(
    item =>
      !watchedIds.has(item.id) &&
      (item.state === 'downloading' || item.state === 'installing' ||
       item.state === 'paused' || item.state === 'completing')
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 p-5 pb-0 shrink-0">
        <StatPill
          icon={<Shield size={15} />}
          label={tr.dashboard.watching}
          value={`${watchedTasks.length}`}
          accent={watchedTasks.length > 0}
        />
        <StatPill
          icon={<Zap size={15} />}
          label={tr.dashboard.totalSpeed}
          value={status.globalSpeedBps > 0 ? formatSpeed(status.globalSpeedBps) : '—'}
          accent={status.globalSpeedBps > 0}
        />
        <StatPill
          icon={<Clock size={15} />}
          label={tr.dashboard.uptime}
          value={formatDuration(status.uptime)}
        />
        <StatPill
          icon={actionIcon}
          label={tr.dashboard.action}
          value={`${actionLabel} / ${settings.shutdown.cooldownSeconds}s`}
        />
      </div>

      {/* Phase status bar */}
      <div className="px-5 pt-3 pb-0 shrink-0">
        <PhaseBar status={status} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 pt-3 space-y-4">

        {/* ── Watching section ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              {tr.dashboard.watchingSection}
              {watchedTasks.length > 0 && (
                <span className="ml-2 text-accent-light normal-case font-normal">
                  {watchedTasks.length}
                </span>
              )}
            </h2>
          </div>

          {watchedTasks.length === 0 ? (
            <div className="card p-5 flex flex-col items-center gap-2 text-center">
              <Shield size={22} className="text-text-disabled" />
              <div className="text-sm font-medium text-text-secondary">{tr.dashboard.watchingEmpty}</div>
              <div className="text-xs text-text-tertiary">{tr.dashboard.watchingEmptyDesc}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {watchedTasks.map(task => {
                const live = allActiveItems.get(task.id) ?? null
                const isDone = !live
                return (
                  <div key={task.id} className="card p-3 pop-in">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-text-tertiary shrink-0">
                        {SOURCE_ICONS[task.source]}
                      </div>
                      <span className="text-xs font-semibold text-text-primary flex-1 truncate">
                        {task.name}
                      </span>
                      {isDone && (
                        <span className="text-xs text-status-success flex items-center gap-1">
                          <CheckCircle2 size={12} /> {tr.dashboard.taskDone}
                        </span>
                      )}
                      <button
                        onClick={() => onRemoveWatched(task.id)}
                        className="shrink-0 p-1 rounded hover:bg-fill/[0.08] text-text-tertiary hover:text-status-error transition-colors"
                        title={tr.dashboard.removeButton}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {live ? (
                      <>
                        <div className="progress-bar mb-1.5">
                          {live.totalBytes > 0 ? (
                            <div
                              className={`progress-fill ${
                                live.state === 'downloading' ? 'bg-accent' :
                                live.state === 'installing' ? 'bg-status-info' :
                                live.state === 'paused' ? 'bg-status-warning' : 'bg-status-success'
                              }`}
                              style={{ width: `${Math.min(100, (live.downloadedBytes / live.totalBytes) * 100)}%` }}
                            />
                          ) : (
                            <div className={`indeterminate-fill h-full rounded-full ${
                              live.state === 'installing' ? 'bg-status-info' : 'bg-accent'
                            }`} />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-tertiary">
                          <span>
                            {live.downloadedBytes > 0 ? formatBytes(live.downloadedBytes) : ''}
                            {live.totalBytes > 0 ? ` / ${formatBytes(live.totalBytes)}` : ''}
                          </span>
                          <span className="text-accent-light">
                            {live.speedBps > 0 ? formatSpeed(live.speedBps) :
                             live.state === 'installing' ? tr.states.installing :
                             live.state === 'paused' ? tr.states.paused : ''}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="progress-bar">
                        <div className="progress-fill bg-status-success" style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Detected Tasks section ──────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            {tr.dashboard.detectedSection}
            {detectedItems.length > 0 && (
              <span className="ml-2 text-text-secondary normal-case font-normal">
                {detectedItems.length}
              </span>
            )}
          </h2>

          {detectedItems.length === 0 ? (
            <div className="card p-4 text-sm text-text-tertiary text-center">
              {tr.dashboard.detectedEmpty}
            </div>
          ) : (
            <div className="space-y-2">
              {detectedItems.map(item => (
                <div key={item.id} className="card p-3 pop-in">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-text-tertiary shrink-0">
                      {SOURCE_ICONS[item.source]}
                    </div>
                    <span className="text-xs font-semibold text-text-primary flex-1 truncate" title={item.name}>
                      {item.name}
                    </span>
                    <span className={`text-xs shrink-0 ${
                      item.state === 'downloading' ? 'text-accent-light' :
                      item.state === 'installing' ? 'text-status-info' :
                      item.state === 'paused' ? 'text-status-warning' : 'text-text-tertiary'
                    }`}>
                      {item.speedBps > 0 ? formatSpeed(item.speedBps) :
                       item.state === 'installing' ? tr.states.installing :
                       item.state === 'paused' ? tr.states.paused :
                       item.state === 'downloading' ? tr.states.downloading : ''}
                    </span>
                    <button
                      onClick={() => onAddWatched({
                        id: item.id,
                        name: item.name,
                        source: item.source,
                        addedAt: Date.now()
                      })}
                      className="shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent/20 hover:bg-accent/40 text-accent-light transition-colors"
                      title={tr.dashboard.addButton}
                    >
                      <Plus size={11} />
                      <span>{tr.dashboard.addButton}</span>
                    </button>
                  </div>
                  <div className="progress-bar mb-1.5">
                    {item.totalBytes > 0 ? (
                      <div
                        className={`progress-fill ${
                          item.state === 'downloading' ? 'bg-accent' :
                          item.state === 'installing' ? 'bg-status-info' :
                          item.state === 'paused' ? 'bg-status-warning' : 'bg-fill/20'
                        }`}
                        style={{ width: `${Math.min(100, (item.downloadedBytes / item.totalBytes) * 100)}%` }}
                      />
                    ) : (
                      <div className="indeterminate-fill h-full rounded-full bg-status-info" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-tertiary">
                    <span>
                      {item.downloadedBytes > 0 ? formatBytes(item.downloadedBytes) : ''}
                      {item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ''}
                    </span>
                    {item.eta > 0 && <span>{tr.common.eta} {formatEta(item.eta)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions during countdown / snooze */}
        {(status.shutdown.phase === 'countdown' || status.shutdown.phase === 'snoozed') && (
          <div className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">{tr.dashboard.quickActions}</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {status.shutdown.phase === 'snoozed' ? tr.dashboard.phaseSnoozed : tr.dashboard.phaseCountdown}
              </div>
            </div>
            <button onClick={onCancel} className="btn-secondary text-xs">
              {tr.dashboard.cancel}
            </button>
            <button onClick={() => onSnooze(10)} className="btn-secondary text-xs flex items-center gap-1">
              <Clock size={11} /> {tr.dashboard.snooze10}
            </button>
          </div>
        )}

        {/* All-done banner */}
        {status.allComplete && status.shutdown.phase === 'monitoring' && (
          <div className="card p-4 flex items-center gap-3 border-status-success/20">
            <CheckCircle2 size={18} className="text-status-success shrink-0" />
            <div className="text-sm text-text-primary">
              {tr.dashboard.allCompleteDesc.replace('{seconds}', String(settings.shutdown.cooldownSeconds))}
            </div>
          </div>
        )}

      </div>

      {/* Countdown overlay */}
      <CountdownDialog
        shutdown={status.shutdown}
        onCancel={onCancel}
        onSnooze={onSnooze}
        onShutdownNow={onShutdownNow}
      />
    </div>
  )
}
