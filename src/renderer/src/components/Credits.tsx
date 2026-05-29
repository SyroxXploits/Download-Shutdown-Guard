import React, { useEffect, useRef, useState } from 'react'
import { Heart, Code2, Cpu, Layers, Zap, Star, MessageCircle, BadgeInfo } from 'lucide-react'
import discordAvatar from '../assets/syrox-discord-avatar.gif'
import { useTranslation } from '../hooks/useTranslation'

const TECH = [
  { icon: <Cpu size={15} />, name: 'Electron', desc: 'Desktop shell' },
  { icon: <Code2 size={15} />, name: 'React', desc: 'UI framework' },
  { icon: <Layers size={15} />, name: 'TypeScript', desc: 'Type safety' },
  { icon: <Zap size={15} />, name: 'Vite', desc: 'Build tooling' },
  { icon: <Layers size={15} />, name: 'Tailwind CSS', desc: 'Styling' }
]

const DISCORD_HANDLE = 'syrox_0'

export function Credits(): React.ReactElement {
  const { tr } = useTranslation()
  const [version, setVersion] = useState('-')
  const [stars, setStars] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion).catch(() => setVersion('dev'))
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
    const timer = setTimeout(() => setStars(true), 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto">
      <div className="relative overflow-visible px-6 py-[clamp(1rem,3vh,3rem)] sm:px-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,120,212,0.14) 0%, transparent 70%)'
          }}
        />

        {['top-8 left-1/4', 'top-12 right-1/3', 'top-6 right-1/4', 'top-16 left-1/3'].map((pos, i) => (
          <Star
            key={i}
            size={10}
            className={`absolute ${pos} text-accent/40 transition-opacity duration-700 ${
              stars ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDelay: `${i * 150}ms`, fill: 'currentColor' }}
          />
        ))}

        <div className="relative mx-auto flex max-w-xl flex-col items-center text-center pt-2 sm:pt-4">
          <div className="relative mb-[clamp(0.75rem,2vh,1.75rem)]">
            <div className="h-[clamp(5.75rem,10vh,8rem)] w-[clamp(5.75rem,10vh,8rem)] rounded-full bg-gradient-to-br from-accent to-accent-dark p-1.5 shadow-win">
              <div className="h-full w-full overflow-hidden rounded-full bg-surface-raised ring-4 ring-surface">
                <img
                  src={discordAvatar}
                  alt="Syrox Discord profile picture"
                  className="h-full w-full object-contain object-center p-1"
                />
              </div>
            </div>
            <div
              className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping"
              style={{ animationDuration: '2.5s' }}
            />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-text-primary">{tr.credits.madeBy}</h1>
          <p className="mt-1 text-sm font-medium text-accent-light">{tr.credits.role}</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-stroke bg-fill/[0.06] px-3 py-1.5 text-sm text-text-secondary">
            <MessageCircle size={14} className="text-accent-light" />
            <span className="font-medium text-text-primary">{DISCORD_HANDLE}</span>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-text-tertiary">
            <Heart size={14} className="text-red-400 animate-pulse-slow" fill="currentColor" />
            <span>{tr.credits.thanks}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg space-y-4 px-8 pb-8">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Download Shutdown Guard
            </h2>
            <span className="badge-idle text-xs">v{version}</span>
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">{tr.about.description}</p>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {tr.credits.techStack.split('.')[0]}
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {TECH.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between border-b border-stroke/50 py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2.5 text-text-secondary">
                  {item.icon}
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                </div>
                <span className="text-xs text-text-tertiary">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            {tr.credits.license}
          </h2>
          <p className="text-sm text-text-secondary">{tr.credits.licenseText}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-stroke bg-fill/[0.06] px-3 py-1.5 text-xs text-text-tertiary">
            <BadgeInfo size={12} className="text-accent-light" />
            <span>&copy; 2025 Syrox. All rights reserved.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
