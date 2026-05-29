import React from 'react'
import { Download, RefreshCw, X, AlertTriangle, Sparkles } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

export type UpdatePhase = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateState {
  phase: UpdatePhase
  version: string
  percent: number
  error?: string
}

interface UpdateDialogProps {
  update: UpdateState
  onUpdateNow: () => void
  onRestart: () => void
  onDismiss: () => void
}

export function UpdateDialog({
  update,
  onUpdateNow,
  onRestart,
  onDismiss
}: UpdateDialogProps): React.ReactElement | null {
  const { tr } = useTranslation()
  const { phase, version, percent, error } = update

  if (phase === 'idle') return null

  const v = version || '?'

  let icon: React.ReactNode
  let title: string
  let message: string
  if (phase === 'available') {
    icon = <Sparkles size={18} className="text-accent-light" />
    title = tr.update.availableTitle
    message = tr.update.availableMessage.replace('{version}', v)
  } else if (phase === 'downloading') {
    icon = <Download size={18} className="text-accent-light" />
    title = tr.update.downloadingTitle
    message = tr.update.downloadingMessage.replace('{version}', v)
  } else if (phase === 'downloaded') {
    icon = <RefreshCw size={18} className="text-status-success" />
    title = tr.update.downloadedTitle
    message = tr.update.downloadedMessage.replace('{version}', v)
  } else {
    icon = <AlertTriangle size={18} className="text-status-error" />
    title = tr.update.errorTitle
    message = error ?? ''
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-[420px] rounded-win-lg border border-stroke shadow-win"
        style={{ background: 'rgb(var(--surface-raised) / 0.99)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent/15">{icon}</div>
            <div className="text-sm font-semibold text-text-primary pt-1.5">{title}</div>
          </div>
          {phase !== 'downloading' && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded hover:bg-fill/[0.08] text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 pb-2">
          <p className="text-xs text-text-secondary leading-relaxed">{message}</p>

          {phase === 'downloading' && (
            <div className="mt-4">
              <div className="progress-bar">
                <div
                  className="progress-fill bg-accent"
                  style={{ width: `${Math.min(100, Math.max(2, percent))}%`, transition: 'width 0.3s' }}
                />
              </div>
              <div className="mt-1 text-right text-xs text-text-tertiary tabular-nums">{percent}%</div>
            </div>
          )}
        </div>

        <div className="h-px bg-stroke mx-5 mt-2" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4">
          {phase === 'available' && (
            <>
              <button onClick={onDismiss} className="btn-secondary text-xs">
                {tr.update.later}
              </button>
              <button
                onClick={onUpdateNow}
                className="btn-accent flex items-center gap-1.5 text-xs"
              >
                <Download size={13} />
                {tr.update.updateNow}
              </button>
            </>
          )}
          {phase === 'downloaded' && (
            <>
              <button onClick={onDismiss} className="btn-secondary text-xs">
                {tr.update.later}
              </button>
              <button
                onClick={onRestart}
                className="btn-accent flex items-center gap-1.5 text-xs"
              >
                <RefreshCw size={13} />
                {tr.update.restartNow}
              </button>
            </>
          )}
          {phase === 'error' && (
            <button onClick={onDismiss} className="btn-secondary text-xs">
              {tr.update.later}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
