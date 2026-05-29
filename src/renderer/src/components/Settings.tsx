import React, { useState, useCallback } from 'react'
import {
  Save, RotateCcw, Power, Moon, RotateCw, Gamepad2,
  Magnet, Globe, HardDrive, FolderOpen, Package, LogOut
} from 'lucide-react'
import type { AppSettings, ShutdownAction, MonitorId, AppLanguage, AppTheme } from '../../../shared/types'
import { useTranslation } from '../hooks/useTranslation'
import { LANGUAGE_LABELS } from '../../../shared/i18n'

interface SettingsProps {
  settings: AppSettings
  onSave: (s: AppSettings) => Promise<void>
  onReset: () => Promise<AppSettings>
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): React.ReactElement {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`toggle shrink-0 ${checked ? 'bg-accent' : 'bg-fill/[0.15]'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`toggle-thumb ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{title}</h3>
      <div className="card p-4 space-y-4">{children}</div>
    </div>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-tertiary mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// ─── Shutdown action definitions ──────────────────────────────────────────────

type ActionDef = { value: ShutdownAction; icon: React.ReactNode }

const ACTION_DEFS: ActionDef[] = [
  { value: 'shutdown', icon: <Power size={14} /> },
  { value: 'signout', icon: <LogOut size={14} /> },
  { value: 'sleep', icon: <Moon size={14} /> },
  { value: 'hibernate', icon: <Moon size={14} /> },
  { value: 'restart', icon: <RotateCw size={14} /> }
]

// ─── Theme definitions ────────────────────────────────────────────────────────

const THEME_LIST: { value: AppTheme; bg: string; accent: string }[] = [
  { value: 'dark', bg: '#2b2b2b', accent: '#0078d4' },
  { value: 'black', bg: '#121212', accent: '#0078d4' },
  { value: 'light', bg: '#ffffff', accent: '#005fb8' },
  { value: 'blue', bg: '#142346', accent: '#3884ff' },
  { value: 'darkblue', bg: '#0f162e', accent: '#4682f0' }
]

// ─── Monitor info ─────────────────────────────────────────────────────────────

type MonitorMeta = { icon: React.ReactNode }

const MONITOR_META: Record<MonitorId, MonitorMeta> = {
  steam: { icon: <Gamepad2 size={14} /> },
  qbittorrent: { icon: <Magnet size={14} /> },
  utorrent: { icon: <Magnet size={14} /> },
  transmission: { icon: <Magnet size={14} /> },
  browser: { icon: <Globe size={14} /> },
  generic: { icon: <HardDrive size={14} /> },
  installer: { icon: <Package size={14} /> }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Settings({ settings, onSave, onReset }: SettingsProps): React.ReactElement {
  const { tr, setLang } = useTranslation()
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Keep draft in sync if parent resets settings
  React.useEffect(() => {
    setDraft(settings)
  }, [settings])

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }, [])

  const updateShutdown = useCallback(
    <K extends keyof AppSettings['shutdown']>(key: K, value: AppSettings['shutdown'][K]) => {
      setDraft(prev => ({ ...prev, shutdown: { ...prev.shutdown, [key]: value } }))
      setSaved(false)
    },
    []
  )

  const updateMonitor = useCallback(
    (monitor: MonitorId, key: string, value: unknown) => {
      setDraft(prev => ({
        ...prev,
        monitors: {
          ...prev.monitors,
          [monitor]: { ...prev.monitors[monitor], [key]: value }
        }
      }))
      setSaved(false)
    },
    []
  )

  const updateUi = useCallback(
    <K extends keyof AppSettings['ui']>(key: K, value: AppSettings['ui'][K]) => {
      setDraft(prev => ({ ...prev, ui: { ...prev.ui, [key]: value } }))
      setSaved(false)
    },
    []
  )

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await onSave(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    if (!confirm(tr.settings.confirmReset)) return
    const defaults = await onReset()
    setDraft(defaults)
  }

  const handleLangChange = (lang: AppLanguage): void => {
    updateUi('language', lang)
    setLang(lang) // also immediately switch UI language
  }

  const handleThemeChange = (theme: AppTheme): void => {
    updateUi('theme', theme)
    // Apply instantly for live preview; persisted on Save
    document.documentElement.dataset.theme = theme
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-stroke">
        <h2 className="text-base font-semibold text-text-primary">{tr.settings.title}</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} className="btn-ghost flex items-center gap-1.5 text-xs">
            <RotateCcw size={12} /> {tr.settings.reset}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`btn-accent flex items-center gap-1.5 text-xs ${saving ? 'opacity-60' : ''}`}
          >
            <Save size={12} />
            {saving ? tr.settings.saving : saved ? tr.settings.saved : tr.settings.save}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* ── Language ─────────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionLanguage}>
          <Row label={tr.settings.languageLabel}>
            <div className="flex gap-2">
              {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => handleLangChange(lang)}
                  className={`px-3 py-1.5 rounded-win border text-sm transition-colors ${
                    draft.ui.language === lang
                      ? 'border-accent bg-accent/20 text-accent-light'
                      : 'border-stroke bg-surface-flyout text-text-secondary hover:border-fill/20'
                  }`}
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* ── Appearance / Theme ────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionTheme}>
          <div className="label mb-1">{tr.settings.themeLabel}</div>
          <div className="grid grid-cols-5 gap-2">
            {THEME_LIST.map(t => {
              const active = draft.ui.theme === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => handleThemeChange(t.value)}
                  className="group flex flex-col items-center gap-2 transition-transform active:scale-95"
                  title={tr.settings.themes[t.value]}
                >
                  <span
                    className={`relative w-full aspect-square rounded-win-lg border-2 overflow-hidden transition-all ${
                      active
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-stroke group-hover:border-stroke-surface'
                    }`}
                    style={{ backgroundColor: t.bg }}
                  >
                    <span
                      className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full shadow"
                      style={{ backgroundColor: t.accent }}
                    />
                  </span>
                  <span className={`text-[11px] ${active ? 'text-accent-light font-medium' : 'text-text-tertiary'}`}>
                    {tr.settings.themes[t.value]}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Shutdown behavior ─────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionShutdown}>
          <div>
            <div className="label mb-2">{tr.settings.actionLabel}</div>
            <div className="grid grid-cols-3 gap-2">
              {ACTION_DEFS.map(a => (
                <button
                  key={a.value}
                  onClick={() => updateShutdown('action', a.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-win border text-sm transition-colors ${
                    draft.shutdown.action === a.value
                      ? 'border-accent bg-accent/20 text-accent-light'
                      : 'border-stroke bg-surface-flyout text-text-secondary hover:border-fill/20'
                  }`}
                >
                  {a.icon}
                  {tr.actions[a.value]}
                </button>
              ))}
            </div>
          </div>

          <Row label={tr.settings.cooldown} description={tr.settings.cooldownDesc}>
            <input
              type="number"
              min="10"
              max="3600"
              value={draft.shutdown.cooldownSeconds}
              onChange={e => updateShutdown('cooldownSeconds', Number(e.target.value))}
              className="input w-24 text-right"
            />
          </Row>

          <Row label={tr.settings.countdownDur} description={tr.settings.countdownDurDesc}>
            <input
              type="number"
              min="5"
              max="300"
              value={draft.shutdown.countdownSeconds}
              onChange={e => updateShutdown('countdownSeconds', Number(e.target.value))}
              className="input w-24 text-right"
            />
          </Row>

          <Row label={tr.settings.ignoreSeeders} description={tr.settings.ignoreSeeedersDesc}>
            <Toggle
              checked={draft.shutdown.ignoreSeeders}
              onChange={v => updateShutdown('ignoreSeeders', v)}
            />
          </Row>

          <Row label={tr.settings.ignoreNetworkDrop} description={tr.settings.ignoreNetworkDropDesc}>
            <Toggle
              checked={draft.shutdown.ignoreNetworkDrop}
              onChange={v => updateShutdown('ignoreNetworkDrop', v)}
            />
          </Row>
        </Section>

        {/* ── Monitors ─────────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionMonitors}>
          {(Object.keys(MONITOR_META) as MonitorId[]).map((id, idx, arr) => (
            <div key={id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-text-secondary">{MONITOR_META[id].icon}</div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {tr.monitors[id] ?? id}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {tr.settings.monitorDesc[id] ?? ''}
                    </div>
                  </div>
                </div>
                <Toggle
                  checked={draft.monitors[id]?.enabled ?? false}
                  onChange={v => updateMonitor(id, 'enabled', v)}
                />
              </div>

              {/* qBittorrent sub-settings */}
              {id === 'qbittorrent' && draft.monitors.qbittorrent?.enabled && (
                <div className="ml-6 space-y-2 border-l border-stroke pl-4">
                  <div className="input-group">
                    <label className="label">{tr.settings.qbtUrl}</label>
                    <input
                      className="input"
                      placeholder="http://localhost:8080"
                      value={draft.monitors.qbittorrent.qbittorrentUrl || ''}
                      onChange={e => updateMonitor('qbittorrent', 'qbittorrentUrl', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="input-group">
                      <label className="label">{tr.settings.qbtUser}</label>
                      <input
                        className="input"
                        placeholder="admin"
                        value={draft.monitors.qbittorrent.qbittorrentUsername || ''}
                        onChange={e => updateMonitor('qbittorrent', 'qbittorrentUsername', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">{tr.settings.qbtPass}</label>
                      <input
                        type="password"
                        className="input"
                        value={draft.monitors.qbittorrent.qbittorrentPassword || ''}
                        onChange={e => updateMonitor('qbittorrent', 'qbittorrentPassword', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* µTorrent sub-settings */}
              {id === 'utorrent' && draft.monitors.utorrent?.enabled && (
                <div className="ml-6 space-y-2 border-l border-stroke pl-4">
                  <div className="input-group">
                    <label className="label">{tr.settings.utorrentUrl}</label>
                    <input
                      className="input"
                      placeholder="http://localhost:8080"
                      value={draft.monitors.utorrent.utorrentUrl || ''}
                      onChange={e => updateMonitor('utorrent', 'utorrentUrl', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="input-group">
                      <label className="label">{tr.settings.utorrentUser}</label>
                      <input
                        className="input"
                        placeholder="admin"
                        value={draft.monitors.utorrent.utorrentUsername || ''}
                        onChange={e => updateMonitor('utorrent', 'utorrentUsername', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">{tr.settings.utorrentPass}</label>
                      <input
                        type="password"
                        className="input"
                        value={draft.monitors.utorrent.utorrentPassword || ''}
                        onChange={e => updateMonitor('utorrent', 'utorrentPassword', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Transmission sub-settings */}
              {id === 'transmission' && draft.monitors.transmission?.enabled && (
                <div className="ml-6 space-y-2 border-l border-stroke pl-4">
                  <div className="input-group">
                    <label className="label">{tr.settings.transmissionUrl}</label>
                    <input
                      className="input"
                      placeholder="http://localhost:9091"
                      value={draft.monitors.transmission.transmissionUrl || ''}
                      onChange={e => updateMonitor('transmission', 'transmissionUrl', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="input-group">
                      <label className="label">{tr.settings.transmissionUser}</label>
                      <input
                        className="input"
                        value={draft.monitors.transmission.transmissionUsername || ''}
                        onChange={e => updateMonitor('transmission', 'transmissionUsername', e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">{tr.settings.transmissionPass}</label>
                      <input
                        type="password"
                        className="input"
                        value={draft.monitors.transmission.transmissionPassword || ''}
                        onChange={e => updateMonitor('transmission', 'transmissionPassword', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {idx < arr.length - 1 && <div className="h-px bg-stroke" />}
            </div>
          ))}
        </Section>

        {/* ── Interface ────────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionUI}>
          <Row label={tr.settings.minimizeToTray} description={tr.settings.minimizeToTrayDesc}>
            <Toggle
              checked={draft.ui.minimizeToTray}
              onChange={v => updateUi('minimizeToTray', v)}
            />
          </Row>
          <Row label={tr.settings.startMinimized} description={tr.settings.startMinimizedDesc}>
            <Toggle
              checked={draft.ui.startMinimized}
              onChange={v => updateUi('startMinimized', v)}
            />
          </Row>
        </Section>

        {/* ── System ───────────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionSystem}>
          <Row label={tr.settings.autoStart} description={tr.settings.autoStartDesc}>
            <Toggle
              checked={draft.system?.autoStart ?? false}
              onChange={v => update('system', { ...draft.system, autoStart: v })}
            />
          </Row>
        </Section>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionNotifications}>
          <Row label={tr.settings.notifSound} description={tr.settings.notifSoundDesc}>
            <Toggle
              checked={draft.notifications.sound}
              onChange={v => update('notifications', { ...draft.notifications, sound: v })}
            />
          </Row>
          <Row label={tr.settings.notifVolume}>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={draft.notifications.volume}
                onChange={e =>
                  update('notifications', { ...draft.notifications, volume: Number(e.target.value) })
                }
                className="w-28 accent-accent"
              />
              <span className="text-xs text-text-tertiary w-8 text-right">
                {draft.notifications.volume}%
              </span>
            </div>
          </Row>
        </Section>

        {/* ── Diagnostics ───────────────────────────────────────────────────── */}
        <Section title={tr.settings.sectionDiagnostics}>
          <Row label="Application log" description="">
            <button
              onClick={() => window.api.openLog()}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <FolderOpen size={12} />
              {tr.settings.openLog}
            </button>
          </Row>
        </Section>

      </div>
    </div>
  )
}
