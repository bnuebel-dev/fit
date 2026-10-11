import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLang } from '../lib/hooks'
import { dayKey, monthGrid } from '../lib/streak'
import { Icon } from './Icon'

/** Monatskalender mit markierten Trainingstagen. Tippen auf einen Tag wählt ihn (zweites Tippen hebt auf). */
export function TrainingCalendar({ days, selected, onSelect }: { days: Map<string, number>; selected: string | null; onSelect: (key: string | null) => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor])
  const title = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date(cursor.y, cursor.m, 1))
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i)))
  const shift = (d: number) => setCursor((c) => { const n = new Date(c.y, c.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })
  const todayKey = dayKey(Date.now())
  const inMonth = [...days.keys()].filter((k) => k.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`)).length

  return (
    <section className="card p-4" aria-label={t('insights.calendar')}>
      <div className="mb-2 flex items-center justify-between">
        <button className="btn !min-h-9 !px-3" onClick={() => shift(-1)} aria-label={t('insights.prevMonth')}><Icon name="chevron" size={16} className="rotate-180" /></button>
        <div className="text-center"><div className="font-semibold capitalize">{title}</div><div className="text-xs text-muted">{t('insights.trainedDays', { count: inMonth })}</div></div>
        <button className="btn !min-h-9 !px-3" onClick={() => shift(1)} aria-label={t('insights.nextMonth')}><Icon name="chevron" size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">{weekdays.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.flat().map((d, i) => {
          if (!d) return <span key={i} />
          const key = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const n = days.get(key) ?? 0
          const sel = selected === key
          return (
            <button key={i} onClick={() => onSelect(sel ? null : key)} disabled={!n} aria-label={`${key}${n ? ` (${n})` : ''}`} aria-pressed={sel}
              className={`flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums ${n ? 'btn-primary font-bold' : 'text-muted'} ${sel ? 'ring-2 ring-fg' : ''} ${key === todayKey && !n ? 'border border-accent text-accent' : ''}`}>
              {d}
            </button>
          )
        })}
      </div>
    </section>
  )
}
