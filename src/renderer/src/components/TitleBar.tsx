import React from 'react'
import { Minimize2, Square, X, ShieldCheck } from 'lucide-react'
import { useTranslation } from '../hooks/useTranslation'

interface TitleBarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function TitleBar({ activeView, onViewChange }: TitleBarProps): React.ReactElement {
  const { tr } = useTranslation()

  const NAV_ITEMS = [
    { id: 'dashboard', label: tr.nav.dashboard },
    { id: 'settings', label: tr.nav.settings },
    { id: 'about', label: tr.nav.about },
    { id: 'credits', label: tr.nav.credits }
  ]

  return (
    <div className="title-bar flex items-center h-11 bg-surface-raised border-b border-stroke px-4 shrink-0">
      {/* App icon + name */}
      <div className="flex items-center gap-2 mr-6">
        <ShieldCheck size={16} className="text-accent-light" />
        <span className="text-sm font-semibold text-text-primary">{tr.appName}</span>
      </div>

      {/* Navigation tabs */}
      <nav className="no-drag flex items-center gap-1 flex-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`
              px-3 py-1 rounded text-sm transition-colors
              ${activeView === item.id
                ? 'bg-fill/[0.08] text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-fill/[0.04]'
              }
            `}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Window controls */}
      <div className="no-drag flex items-center">
        <button
          onClick={() => window.api.minimize()}
          className="w-12 h-11 flex items-center justify-center text-text-secondary hover:bg-fill/[0.08] hover:text-text-primary transition-colors"
          title={tr.window.minimize}
        >
          <Minimize2 size={15} strokeWidth={2.4} />
        </button>
        <button
          onClick={() => window.api.toggleMaximize()}
          className="w-12 h-11 flex items-center justify-center text-text-secondary hover:bg-fill/[0.08] hover:text-text-primary transition-colors"
          title={tr.window.maximize}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => window.api.close()}
          className="w-12 h-11 flex items-center justify-center text-text-secondary hover:bg-red-500 hover:text-white transition-colors"
          title={tr.window.close}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
