import React, { useEffect, useState } from 'react'
import {
  ShieldCheck,
  FileText,
  ExternalLink,
  RefreshCw,
  CircleCheckBig,
  AlertTriangle,
  Download
} from 'lucide-react'
import type { UpdateCheckResult } from '../../../shared/types'
import { useTranslation } from '../hooks/useTranslation'

export function About(): React.ReactElement {
  const { tr } = useTranslation()
  const [version, setVersion] = useState('—')
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => setVersion('dev'))
    void checkUpdates()
  }, [])

  async function checkUpdates(): Promise<void> {
    setCheckingUpdates(true)
    try {
      const result = await window.api.checkForUpdates()
      setUpdateInfo(result)
    } catch (error) {
      setUpdateInfo({
        currentVersion: version,
        latestVersion: version,
        releaseName: '',
        releaseUrl: 'https://github.com/SyroxXploits/Download-Shutdown-Guard/releases/latest',
        isUpdateAvailable: false,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setCheckingUpdates(false)
    }
  }

  const hasUpdate = Boolean(updateInfo?.isUpdateAvailable)
  const updateMessage = updateInfo?.error
    ? tr.about.updateFailed
    : hasUpdate
    ? `${tr.about.updateAvailable}: v${updateInfo?.latestVersion ?? 'unknown'}`
    : updateInfo
    ? tr.about.upToDate
    : tr.about.checkingUpdates

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-lg mx-auto w-full space-y-6">
        {/* Logo block */}
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-win-xl bg-accent/20 flex items-center justify-center">
            <ShieldCheck size={32} className="text-accent-light" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-text-primary">{tr.appName}</h1>
            <p className="text-sm text-text-tertiary mt-1">
              {tr.about.version} {version}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="card p-5">
          <p className="text-sm text-text-secondary leading-relaxed">{tr.about.description}</p>
        </div>

        {/* Update check */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              {tr.about.checkUpdates}
            </h3>
            <button
              onClick={checkUpdates}
              disabled={checkingUpdates}
              className={`btn-secondary flex items-center gap-1.5 text-xs ${checkingUpdates ? 'opacity-70' : ''}`}
            >
              <RefreshCw size={12} className={checkingUpdates ? 'animate-spin' : ''} />
              {checkingUpdates ? tr.about.checkingUpdates : tr.about.checkUpdates}
            </button>
          </div>

          <div
            className={`rounded-win border p-4 flex items-start gap-3 ${
              hasUpdate
                ? 'border-status-warning/40 bg-status-warning/10'
                : updateInfo?.error
                ? 'border-status-error/40 bg-status-error/10'
                : 'border-status-success/30 bg-status-success/10'
            }`}
          >
            <div className="mt-0.5">
              {hasUpdate ? (
                <AlertTriangle size={16} className="text-status-warning" />
              ) : updateInfo?.error ? (
                <AlertTriangle size={16} className="text-status-error" />
              ) : (
                <CircleCheckBig size={16} className="text-status-success" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary">{updateMessage}</div>
              <div className="text-xs text-text-tertiary mt-1">
                {updateInfo?.error
                  ? updateInfo.error
                  : hasUpdate
                  ? `${tr.about.version} ${version} -> v${updateInfo?.latestVersion ?? 'unknown'}`
                  : updateInfo
                  ? `${tr.about.version} ${version}`
                  : ''}
              </div>
            </div>
          </div>

          {hasUpdate && updateInfo && (
            <button
              onClick={() => window.api.openExternal(updateInfo.releaseUrl)}
              className="btn-accent flex items-center gap-1.5 text-xs"
            >
              <Download size={12} />
              {tr.about.openRelease}
              <ExternalLink size={11} />
            </button>
          )}
        </div>

        {/* Feature list */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            {tr.about.supportedSources}
          </h3>
          <ul className="space-y-2 text-sm text-text-secondary">
            {tr.about.features.map(line => (
              <li key={line} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Links */}
        <div className="card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
            {tr.about.links}
          </h3>
          <button
            onClick={() => window.api.openLog()}
            className="flex items-center gap-2 text-sm text-accent-light hover:text-accent transition-colors"
          >
            <FileText size={13} />
            {tr.about.openLog}
            <ExternalLink size={11} className="text-text-tertiary" />
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-text-tertiary text-center leading-relaxed">
          {tr.about.disclaimer}
        </p>
      </div>
    </div>
  )
}
