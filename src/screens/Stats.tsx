import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db'
import { formatDuration, toDisplay } from '../lib/calc'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { useSettings } from '../lib/settings'
import { bestByExercise, muscleShare, periodStart, summarize, trend, weeklyVolume, workoutStats, type Metric, type Period } from '../lib/stats'
import { useExerciseMap } from '../lib/useExercises'
import { MUSCLES } from '../types'

const PERIODS: Period[] = ['week', 'm1', 'm3', 'y1', 'all']
const ARROW = { 1: '▲', 0: '▶', [-1]: '▼' } as const
const ARROW_CLS = { 1: 'text-ok', 0: 'text-muted', [-1]: 'text-danger' } as const

export function Stats() {
  const { t } = useTranslation()
  const lang = useLang()
  const units = useSettings()?.units ?? 'kg'
  const exMap = useExerciseMap()
  const [period, setPeriod] = useState<Period>('m3')
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray() }), [])

  const view = useMemo(() => {
    if (!data) return null
    const now = Date.now()
    const from = periodStart(period, now)
    const span = period === 'all' ? 0 : now - from
    const all = workoutStats(data.workouts, data.sets)
    const cur = all.filter((w) => w.startedAt >= from)
    const prev = span ? all.filter((w) => w.startedAt >= from - span && w.startedAt < from) : []
    const ids = new Set(cur.map((w) => w.id))
    const curSets = data.sets.filter((s) => ids.has(s.workoutId))
    return { cur, prev, curSets, weekly: weeklyVolume(cur), share: muscleShare(curSets, exMap), best: bestByExercise(curSets) }
  }, [data, period, exMap])

  const rows: { key: Metric; label: string; fmt: (v: number) => string }[] = [
    { key: 'durationMs', label: t('stats.time'), fmt: (v) => formatDuration(v) },
    { key: 'volume', label: t('stats.volume'), fmt: (v) => `${Math.round(toDisplay(v, units))}` },
    { key: 'sets', label: t('stats.sets'), fmt: (v) => String(Math.round(v * 10) / 10) },
    { key: 'reps', label: t('stats.reps'), fmt: (v) => String(Math.round(v)) },
  ]
  const maxShare = Math.max(1, ...Object.values(view?.share ?? {}))
  const fmtWeek = (ts: number) => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(ts)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('stats.title')}</h1>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {PERIODS.map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={`chip shrink-0 !px-4 !py-2 text-sm ${period === p ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setPeriod(p)}>{t(`stats.${p}`)}</button>
        ))}
      </div>

      {!view && <p className="text-muted">{t('common.loading')}</p>}
      {view && view.cur.length === 0 && <p className="text-muted">{t('stats.noData')}</p>}
      {view && view.cur.length > 0 && (
        <>
          <div className="card p-3">
            <div className="mb-2 text-sm text-muted">{view.cur.length} {t('stats.workouts')}</div>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs text-muted">
                <tr><th className="text-left" /><th>{t('stats.sum')}</th><th>{t('stats.max')}</th><th>{t('stats.avg')}</th><th>{t('stats.trend')}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = summarize(view.cur, r.key)
                  const tr = view.prev.length ? trend(s.avg, summarize(view.prev, r.key).avg) : 0
                  return (
                    <tr key={r.key} className="border-t border-line text-center">
                      <td className="py-2 text-left text-muted">{r.label}</td><td>{r.fmt(s.sum)}</td><td>{r.fmt(s.max)}</td><td>{r.fmt(s.avg)}</td>
                      <td className={ARROW_CLS[tr]} aria-label={String(tr)}>{ARROW[tr]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="card p-3">
            <h2 className="mb-2 font-semibold">{t('stats.volumeOverTime')} ({units})</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.weekly.map((w) => ({ week: fmtWeek(w.weekStart), volume: Math.round(toDisplay(w.volume, units)) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted)' }} width={44} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12 }} />
                  <Bar dataKey="volume" fill="var(--color-accent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-3">
            <h2 className="mb-2 font-semibold">{t('stats.muscles')}</h2>
            <ul className="flex flex-col gap-1.5">
              {MUSCLES.filter((m) => view.share[m]).sort((a, b) => view.share[b]! - view.share[a]!).map((m) => (
                <li key={m} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 text-muted">{t(`muscle.${m}`)}</span>
                  <span className="h-3 rounded-full bg-accent" style={{ width: `${(view.share[m]! / maxShare) * 100}%`, minWidth: 4 }} />
                  <span className="tabular-nums">{Math.round(view.share[m]! * 10) / 10}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-3">
            <h2 className="mb-2 font-semibold">{t('stats.records')}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {[...view.best.entries()].sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 8).map(([id, b]) => {
                const ex = exMap.get(id)
                return <li key={id} className="flex justify-between gap-2"><span className="truncate">{ex ? exName(ex, lang) : id}</span><span className="tabular-nums text-muted">{toDisplay(b.weight, units)} {units} × {b.reps}</span></li>
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
