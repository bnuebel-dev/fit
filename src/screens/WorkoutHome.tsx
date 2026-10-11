import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { computeHints } from '../lib/advisor/hints'
import { HINT_ICON, hintText } from '../lib/advisor/hintText'
import { useProfile } from '../lib/advisor/profile'
import { toDisplay } from '../lib/calc'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { useSettings } from '../lib/settings'
import { weekStart, workoutStats } from '../lib/stats'
import { useExerciseMap } from '../lib/useExercises'
import { getActiveWorkout, startWorkout } from '../lib/workout'
import type { Routine } from '../types'

export function weekdayLabel(day: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2024, 0, day))
}

function relativeDay(ts: number, lang: string, today: string): string {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000)
  if (days <= 0) return today
  return new Intl.RelativeTimeFormat(lang, { numeric: 'always' }).format(-days, 'day')
}

/** Wochentag heute: Montag = 1 … Sonntag = 7 */
const todayWeekday = (): number => ((new Date().getDay() + 6) % 7) + 1

export function WorkoutHome() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const settings = useSettings()
  const profile = useProfile()
  const exMap = useExerciseMap()
  const units = settings?.units ?? 'kg'
  const active = useLiveQuery(getActiveWorkout, [])
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), [])
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray() }), [])

  const lastDone = useMemo(() => {
    const map = new Map<number, number>()
    for (const w of data?.workouts ?? []) if (w.endedAt !== undefined && w.routineId !== undefined) map.set(w.routineId, Math.max(map.get(w.routineId) ?? 0, w.startedAt))
    return map
  }, [data])

  const week = useMemo(() => {
    if (!data) return null
    const all = workoutStats(data.workouts, data.sets)
    const since = weekStart(Date.now())
    const cur = all.filter((w) => w.startedAt >= since)
    return {
      count: cur.length,
      sets: cur.reduce((a, w) => a + w.sets, 0),
      volume: cur.reduce((a, w) => a + w.volume, 0),
      total: all.length,
      last: all[all.length - 1]?.startedAt,
    }
  }, [data])

  const tip = useMemo(() => {
    if (!data || !profile) return null
    return computeHints({ workouts: data.workouts, sets: data.sets, exercises: exMap, routines: routines ?? [], level: profile.level, now: Date.now() })[0] ?? null
  }, [data, profile, exMap, routines])

  const begin = async (routine?: Routine) => {
    await startWorkout({ routine, name: routine ? undefined : t('workout.emptyName'), defaultRestSec: settings?.restDefault })
    nav('/workout')
  }

  const isNew = !!routines && routines.length === 0 && week?.total === 0
  const todays = routines?.find((r) => r.weekday === todayWeekday())
  const hintName = (id?: string) => { const e = id ? exMap.get(id) : undefined; return e ? exName(e, lang) : (id ?? '') }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('workout.title')}</h1>

      {active && (
        <Link to="/workout" className="card flex items-center justify-between border-accent p-4 text-accent">
          <span className="font-medium">{t('workout.resume')}</span>
          <span aria-hidden>▶</span>
        </Link>
      )}

      {isNew && (
        <section className="card flex flex-col gap-3 border-accent bg-accent/10 p-5" aria-label={t('home.welcomeTitle')}>
          <div className="text-3xl" aria-hidden>👋</div>
          <h2 className="text-lg font-semibold">{t('home.welcomeTitle')}</h2>
          <p className="text-sm text-muted">{t('home.welcomeText')}</p>
          <Link to="/advisor" className="btn btn-primary">{t('home.createPlan')}</Link>
          <Link to="/more/knowledge" className="btn">{t('home.explore')}</Link>
        </section>
      )}

      {!isNew && week && (
        <section className="card p-4" aria-label={t('home.thisWeek')}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-semibold">{t('home.thisWeek')}</h2>
            <span className="text-xs text-muted">{t('home.lastWorkout')}: {week.last ? relativeDay(week.last, lang, t('common.today')) : t('home.noWorkoutsYet')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[week.count, t('home.workouts')], [week.sets, t('home.sets')], [`${Math.round(toDisplay(week.volume, units))}`, `${t('home.volume')} (${units})`]].map(([v, l]) => (
              <div key={String(l)} className="rounded-xl bg-surface2 py-2"><div className="text-lg font-bold tabular-nums">{v}</div><div className="text-xs text-muted">{l}</div></div>
            ))}
          </div>
        </section>
      )}

      {todays && !active && (
        <section className="card flex items-center gap-3 p-4" aria-label={t('home.today')}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black" style={{ background: todays.color }}>{weekdayLabel(todays.weekday!, lang)}</span>
          <div className="min-w-0 flex-1"><div className="text-xs font-semibold uppercase tracking-wide text-accent">{t('home.today')}</div><div className="truncate font-semibold">{todays.name}</div></div>
          <button className="btn btn-primary" onClick={() => begin(todays)}>{t('home.startToday')}</button>
        </section>
      )}

      {tip && (
        <Link to="/advisor?tab=hints" className="card flex gap-3 p-4 text-sm" aria-label={t('home.tip')}>
          <span aria-hidden>{HINT_ICON[tip.kind]}</span>
          <span className="min-w-0 flex-1"><span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-accent">{t('home.tip')}</span>{hintText(tip, t, hintName, units)}</span>
        </Link>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" onClick={() => begin()} disabled={!!active}>{t('workout.startEmpty')}</button>
        <Link to="/routine/new" className="btn">+ {t('workout.newRoutine')}</Link>
      </div>

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('workout.routines')}</h2>
      {routines && routines.length === 0 && !isNew && <p className="text-muted">{t('workout.noRoutines')}</p>}
      <ul className="flex flex-col gap-2">
        {routines?.map((r) => {
          const last = lastDone.get(r.id!)
          return (
            <li key={r.id} className="card flex items-center gap-3 p-3">
              <button className="flex flex-1 items-center gap-3 text-left" onClick={() => begin(r)} disabled={!!active} aria-label={r.name}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black" style={{ background: r.color }}>
                  {r.weekday ? weekdayLabel(r.weekday, lang) : r.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {r.note || `${r.items.length} ${t('exercises.title')}`}
                    {' · '}{last ? relativeDay(last, lang, t('common.today')) : t('workout.never')}
                  </span>
                </span>
              </button>
              <Link to={`/routine/${r.id}`} className="btn" aria-label={t('common.edit')}>✎</Link>
            </li>
          )
        })}
      </ul>

      {!isNew && (
        <Link to="/advisor" className="card flex items-center gap-3 p-4">
          <span className="text-2xl" aria-hidden>🧠</span>
          <span className="flex-1"><span className="block font-medium">{t('home.planCardTitle')}</span><span className="text-xs text-muted">{t('home.planCardText')}</span></span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
      )}

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('home.quick')}</h2>
      <div className="grid grid-cols-3 gap-2">
        {[['/more/knowledge', '📚', t('more.knowledge')], ['/more/exercises', '🏋️', t('more.exercises')], ['/more', '🧮', t('more.title')]].map(([to, icon, label]) => (
          <Link key={to} to={to} className="card flex flex-col items-center gap-1 p-3 text-center text-sm"><span className="text-2xl" aria-hidden>{icon}</span>{label}</Link>
        ))}
      </div>
    </div>
  )
}
