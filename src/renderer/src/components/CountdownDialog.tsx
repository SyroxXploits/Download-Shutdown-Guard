import React from 'react'
import { AlertTriangle, X, Clock, Power, Moon, LogOut, RotateCw } from 'lucide-react'
import type { ShutdownState, ShutdownAction } from '../../../shared/types'
import { formatDuration } from '../../../shared/types'
import { useTranslation } from '../hooks/useTranslation'

interface CountdownDialogProps {
  shutdown: ShutdownState
  onCancel: () => void
  onSnooze: (minutes: number) => void
  onShutdownNow: () => void
}

const ACTION_ICONS: Record<ShutdownAction, React.ReactNode> = {
  shutdown: <Power size={15} />,
  signout: <LogOut size={15} />,
  restart: <RotateCw size={15} />,
  sleep: <Moon size={15} />,
  hibernate: <Moon size={15} />
}

export function CountdownDialog({
  shutdown,
  onCancel,
  onSnooze,
  onShutdownNow
}: CountdownDialogProps): React.ReactElement | null {
  const { tr } = useTranslation()
  const { phase, countdownRemaining, action } = shutdown

  if (phase !== 'countdown' && phase !== 'shutting_down') return null

  const isExecuting = phase === 'shutting_down'
  const actionLabel = tr.actions[action] ?? tr.actions.shutdown
  const actionIcon = ACTION_ICONS[action] ?? <Power size={15} />

  // Ring progress: counts down from countdownRemaining toward 0
  // We treat max = 60 for display purposes (or whatever was configured)
  const RING_MAX = Math.max(countdownRemaining, 60)
  const r = 32
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - countdownRemaining / RING_MAX)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
      <div className="pointer-events-auto animate-slide-up">
        <div
          className="w-[420px] rounded-win-lg border border-stroke shadow-win backdrop-blur-sm"
          style={{ background: 'rgb(var(--surface-raised) / 0.97)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-status-warning/20">
                <AlertTriangle size={18} className="text-status-warning" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">
                  {isExecuting ? tr.countdown.titleExecuting : tr.countdown.title}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {isExecuting
                    ? tr.countdown.subtitleExecuting
                    : tr.countdown.subtitle.replace('{action}', actionLabel.toLowerCase())}
                </div>
              </div>
            </div>
            {!isExecuting && (
              <button
                onClick={onCancel}
                className="p-1.5 rounded hover:bg-fill/[0.08] text-text-tertiary hover:text-text-primary transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Countdown ring */}
          {!isExecuting && (
            <div className="flex items-center justify-center py-5 gap-6">
              <div className="relative shrink-0">
                <svg width="88" height="88" className="-rotate-90">
                  <circle
                    cx="44" cy="44" r={r}
                    fill="none"
                    stroke="rgb(var(--fill) / 0.1)"
                    strokeWidth="5"
                  />
                  <circle
                    cx="44" cy="44" r={r}
                    fill="none"
                    stroke={countdownRemaining <= 10 ? '#ff6b6b' : '#fce100'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-2xl font-bold font-mono tabular-nums ${
                      countdownRemaining <= 10 ? 'text-status-error countdown-pulse' : 'text-text-primary'
                    }`}
                  >
                    {countdownRemaining}
                  </span>
                  <span className="text-xs text-text-tertiary">{tr.countdown.seconds}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  {actionIcon}
                  <span>{actionLabel} — {formatDuration(countdownRemaining)}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed max-w-[180px]">
                  {tr.countdown.waitingFor.replace('{time}', formatDuration(countdownRemaining))}
                </p>
              </div>
            </div>
          )}

          {/* Executing spinner */}
          {isExecuting && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">
                {actionLabel}…
              </span>
            </div>
          )}

          <div className="h-px bg-stroke mx-5" />

          {/* Action buttons */}
          {!isExecuting && (
            <div className="flex items-center gap-2 p-4">
              <button onClick={onCancel} className="btn-secondary flex-1 text-xs">
                {tr.countdown.cancel}
              </button>
              <button
                onClick={() => onSnooze(10)}
                className="btn-secondary flex items-center justify-center gap-1.5 flex-1 text-xs"
              >
                <Clock size={12} />
                {tr.countdown.snooze}
              </button>
              <button
                onClick={onShutdownNow}
                className="btn-danger flex items-center justify-center gap-1.5 flex-1 text-xs"
              >
                {actionIcon}
                {tr.countdown.now}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
