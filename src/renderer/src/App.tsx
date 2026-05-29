import React, { useState, useMemo, useEffect } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { TitleBar } from './components/TitleBar'
import { Dashboard } from './components/Dashboard'
import { Settings } from './components/Settings'
import { About } from './components/About'
import { Credits } from './components/Credits'
import { UpdateDialog, type UpdateState } from './components/UpdateDialog'
import { useAppStatus } from './hooks/useAppStatus'
import { I18nContext } from './hooks/useTranslation'
import { TRANSLATIONS } from '../../shared/i18n'
import type { AppLanguage, UpdateCheckResult } from '../../shared/types'

// Re-check for new releases every 6 hours while the app stays open.
const UPDATE_RECHECK_MS = 6 * 60 * 60 * 1000

type View = 'dashboard' | 'settings' | 'about' | 'credits'

export default function App(): React.ReactElement {
  const [view, setView] = useState<View>('dashboard')
  const {
    status,
    settings,
    setSettings,
    resetSettings,
    cancelShutdown,
    snooze,
    shutdownNow,
    addWatched,
    removeWatched,
    notification,
    dismissNotification
  } = useAppStatus()

  // Language is derived from settings so it persists across restarts
  const lang: AppLanguage = (settings.ui?.language as AppLanguage) ?? 'en'
  const tr = TRANSLATIONS[lang] ?? TRANSLATIONS.en

  // ── Outdated-version check ─────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const runCheck = (): void => {
      window.api
        .checkForUpdates()
        .then(result => {
          if (!cancelled) setUpdateInfo(result)
        })
        .catch(() => {
          /* Network failures are non-fatal — just don't show the banner. */
        })
    }
    runCheck()
    const timer = window.setInterval(runCheck, UPDATE_RECHECK_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const showOutdated = Boolean(updateInfo?.isUpdateAvailable) && !updateDismissed

  // ── Real in-app updater (electron-updater) ─────────────────────────────────
  const [update, setUpdate] = useState<UpdateState>({ phase: 'idle', version: '', percent: 0 })

  useEffect(() => {
    const offs = [
      window.api.onUpdateAvailable(version =>
        setUpdate(prev =>
          // Don't interrupt an in-progress download with a fresh "available".
          prev.phase === 'downloading' || prev.phase === 'downloaded'
            ? prev
            : { phase: 'available', version, percent: 0 }
        )
      ),
      window.api.onUpdateProgress(percent =>
        setUpdate(prev => ({ ...prev, phase: 'downloading', percent }))
      ),
      window.api.onUpdateDownloaded(version =>
        setUpdate({ phase: 'downloaded', version, percent: 100 })
      ),
      window.api.onUpdateError(message =>
        setUpdate(prev => ({ ...prev, phase: 'error', error: message }))
      )
    ]
    return () => offs.forEach(off => off())
  }, [])

  // Begin downloading the update in-app. Falls back to the browser if the
  // in-app updater isn't available (e.g. a dev/unpackaged build).
  const startUpdate = async (): Promise<void> => {
    const version = update.version || updateInfo?.latestVersion || ''
    setUpdate({ phase: 'downloading', version, percent: 0 })
    const ok = await window.api.downloadUpdate()
    if (!ok) {
      setUpdate({ phase: 'idle', version: '', percent: 0 })
      window.api.openExternal(
        updateInfo?.releaseUrl ??
          'https://github.com/SyroxXploits/Download-Shutdown-Guard/releases/latest'
      )
    }
  }

  // Apply the selected theme to the document root
  useEffect(() => {
    document.documentElement.dataset.theme = settings.ui?.theme ?? 'dark'
  }, [settings.ui?.theme])

  // Expose a setLang that propagates through settings
  const setLang = (newLang: AppLanguage): void => {
    setSettings({ ...settings, ui: { ...settings.ui, language: newLang } })
  }

  const i18nValue = useMemo(() => ({ lang, tr, setLang }), [lang, tr])

  return (
    <I18nContext.Provider value={i18nValue}>
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        {/* Custom title bar */}
        <TitleBar activeView={view} onViewChange={v => setView(v as View)} />

        {/* Outdated-version warning (red, persistent until dismissed) */}
        {showOutdated && updateInfo && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-sm bg-status-error/20 text-status-error border-b border-status-error/40 animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle size={16} className="shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold">{tr.about.outdatedTitle}</span>
                <span className="opacity-90">
                  {' — '}
                  {tr.about.outdatedMessage
                    .replace('{current}', updateInfo.currentVersion)
                    .replace('{latest}', updateInfo.latestVersion)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={startUpdate}
                className="flex items-center gap-1.5 rounded-md bg-status-error/90 hover:bg-status-error text-white px-2.5 py-1 text-xs font-medium transition-colors"
              >
                <Download size={13} />
                {tr.about.downloadUpdate}
              </button>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="px-1.5 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Notification banner */}
        {notification && (
          <div
            className={`shrink-0 flex items-center justify-between px-4 py-2 text-sm animate-fade-in ${
              notification.type === 'error'
                ? 'bg-status-error/20 text-status-error border-b border-status-error/30'
                : notification.type === 'warning'
                ? 'bg-status-warning/20 text-status-warning border-b border-status-warning/30'
                : 'bg-status-info/20 text-status-info border-b border-status-info/30'
            }`}
          >
            <span>{notification.msg}</span>
            <button
              onClick={dismissNotification}
              className="ml-4 opacity-60 hover:opacity-100 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {view === 'dashboard' && (
            <Dashboard
              status={status}
              settings={settings}
              onCancel={cancelShutdown}
              onSnooze={snooze}
              onShutdownNow={shutdownNow}
              onAddWatched={addWatched}
              onRemoveWatched={removeWatched}
            />
          )}
          {view === 'settings' && (
            <Settings
              settings={settings}
              onSave={setSettings}
              onReset={resetSettings}
            />
          )}
          {view === 'about' && <About />}
          {view === 'credits' && <Credits />}
        </div>

        {/* In-app update prompt (download / restart) */}
        <UpdateDialog
          update={update}
          onUpdateNow={startUpdate}
          onRestart={() => window.api.installUpdate()}
          onDismiss={() => setUpdate({ phase: 'idle', version: '', percent: 0 })}
        />
      </div>
    </I18nContext.Provider>
  )
}
