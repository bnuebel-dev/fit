import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDuration } from '../lib/calc'
import { useNow } from '../lib/hooks'
import { beep, useRest } from '../lib/restTimer'

/** Kompakte Leiste über der Navigation; Antippen öffnet die Vollbildansicht. */
export function RestTimer() {
  const { t } = useTranslation()
  const { endsAt, total, label, add, stop } = useRest()
  const now = useNow(250, endsAt !== null)
  const [full, setFull] = useState(false)
  const fired = useRef<number | null>(null)

  const left = endsAt === null ? 0 : endsAt - now
  useEffect(() => {
    if (endsAt !== null && left <= 0 && fired.current !== endsAt) {
      fired.current = endsAt
      beep()
      const id = setTimeout(() => {
        if (useRest.getState().endsAt === endsAt) stop()
      }, 2500)
      return () => clearTimeout(id)
    }
  }, [endsAt, left, stop])

  if (endsAt === null) return null
  const over = left <= 0
  const pct = Math.min(100, Math.max(0, ((total * 1000 - left) / (total * 1000)) * 100))

  if (full) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label={t('rest.title')}>
        <div className="flex items-center justify-between p-4">
          <button className="btn" onClick={() => setFull(false)}>←</button>
          <span className="text-sm text-white/60">{t('rest.title')}</span>
          <span className="w-11" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="text-8xl font-light tabular-nums">{over ? '0:00' : formatDuration(left)}</div>
          <div className="mt-1 text-white/50">/ {formatDuration(total * 1000)}</div>
          {label && <div className="mt-8 text-lg text-white/80">{label}</div>}
          {over && <div className="mt-4 text-ok">{t('rest.done')}</div>}
        </div>
        <div className="flex items-center justify-around p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button className="btn !bg-white/10 !text-white" onClick={() => add(-10)}>{t('rest.minus')}</button>
          <button className="btn btn-primary" onClick={() => { stop(); setFull(false) }}>{t('rest.skip')}</button>
          <button className="btn !bg-white/10 !text-white" onClick={() => add(10)}>{t('rest.plus')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3">
      <div className="card overflow-hidden shadow-lg" role="timer">
        <div className="h-1 bg-surface2"><div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="flex items-center gap-2 p-2">
          <button className="flex min-w-0 flex-1 items-baseline gap-3 px-2 text-left" onClick={() => setFull(true)}>
            <span className="text-2xl font-semibold tabular-nums">{over ? '0:00' : formatDuration(left)}</span>
            <span className="min-w-0 truncate text-sm text-muted">{over ? t('rest.done') : label || t('rest.title')}</span>
          </button>
          <button className="btn !px-3" onClick={() => add(-10)} aria-label={t('rest.minus')}>−10</button>
          <button className="btn !px-3" onClick={() => add(10)} aria-label={t('rest.plus')}>+10</button>
          <button className="btn !px-3" onClick={stop} aria-label={t('rest.skip')}>✕</button>
        </div>
      </div>
    </div>
  )
}
