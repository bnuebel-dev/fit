import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDuration, toDisplay } from '../lib/calc'
import { muscleShare, summarize, trend, weekStart, type WorkoutStat } from '../lib/stats'
import { weekStreak, weeklyCounts } from '../lib/streak'
import { useSettings } from '../lib/settings'
import { useExerciseMap } from '../lib/useExercises'
import { MUSCLES, type SetLog, type Workout } from '../types'

const WEEK = 7 * 86400000
const ARROW = { 1: '▲', 0: '▶', [-1]: '▼' } as const
const ARROW_CLS = { 1: 'text-ok', 0: 'text-muted', [-1]: 'text-danger' } as const

/** Wochenbericht: diese gegenüber der letzten Woche, Wochenziel, Serie und meistbelastete Muskeln. */
export function WeekReport({ workouts, sets, stats }: { workouts: Workout[]; sets: SetLog[]; stats: WorkoutStat[] }) {
  const { t } = useTranslation()
  const settings = useSettings()
  const units = settings?.units ?? 'kg'
  const goal = settings?.weeklyGoal ?? 3
  const exMap = useExerciseMap()

  const r = useMemo(() => {
    const now = Date.now()
    const ws = weekStart(now)
    const cur = stats.filter((s) => s.startedAt >= ws)
    const prev = stats.filter((s) => s.startedAt >= ws - WEEK && s.startedAt < ws)
    const ids = new Set(cur.map((s) => s.id))
    const share = muscleShare(sets.filter((x) => ids.has(x.workoutId)), exMap)
    const top = MUSCLES.filter((m) => share[m]).sort((a, b) => share[b]! - share[a]!).slice(0, 3)
    return { cur, prev, top, streak: weekStreak(weeklyCounts(workouts), goal, now) }
  }, [workouts, sets, stats, goal, exMap])

  const rows = [
    { key: 'workouts', label: t('insights.workouts'), cur: r.cur.length, prev: r.prev.length, fmt: (v: number) => String(v) },
    { key: 'kcal', label: t('insights.kcal'), cur: summarize(r.cur, 'kcal').sum, prev: summarize(r.prev, 'kcal').sum, fmt: (v: number) => `≈ ${Math.round(v)}` },
    { key: 'volume', label: `${t('stats.volume')} (${units})`, cur: summarize(r.cur, 'volume').sum, prev: summarize(r.prev, 'volume').sum, fmt: (v: number) => String(Math.round(toDisplay(v, units))) },
    { key: 'time', label: t('stats.time'), cur: summarize(r.cur, 'durationMs').sum, prev: summarize(r.prev, 'durationMs').sum, fmt: formatDuration },
    { key: 'sets', label: t('stats.sets'), cur: summarize(r.cur, 'sets').sum, prev: summarize(r.prev, 'sets').sum, fmt: (v: number) => String(Math.round(v)) },
  ]
  const pct = Math.min(100, Math.round((r.cur.length / Math.max(1, goal)) * 100))

  return (
    <section className="card p-4" aria-label={t('insights.reportTitle')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('insights.reportTitle')}</h2>
          <p className="text-xs text-muted">{t('insights.reportHint')}</p>
        </div>
        <span className="chip !bg-accent/12 font-semibold !text-accent" aria-label={t('insights.streak')}>🔥 {t('insights.streakWeeks', { count: r.streak })}</span>
      </div>
      <div className="mb-1 flex justify-between text-sm"><span>{t('insights.goal')}</span><span className="tabular-nums font-semibold">{r.cur.length} / {goal}</span></div>
      <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(goal, r.cur.length)} aria-label={t('insights.goal')}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-xs text-muted"><tr><th className="text-left font-normal" /><th className="font-normal">{t('insights.thisWeek')}</th><th className="font-normal">{t('insights.lastWeek')}</th><th /></tr></thead>
        <tbody>
          {rows.map((x) => {
            const tr = trend(x.cur, x.prev)
            return (
              <tr key={x.key} className="border-t border-line text-center">
                <td className="py-2 text-left text-muted">{x.label}</td><td className="font-semibold">{x.fmt(x.cur)}</td><td className="text-muted">{x.fmt(x.prev)}</td>
                <td className={ARROW_CLS[tr]}>{ARROW[tr]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {r.top.length > 0 && <p className="mt-3 text-sm"><span className="text-muted">{t('insights.topMuscles')}: </span>{r.top.map((m) => t(`muscle.${m}`)).join(', ')}</p>}
      <p className="mt-2 text-xs text-muted">{t('insights.kcalNote')}</p>
    </section>
  )
}
