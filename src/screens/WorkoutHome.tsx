import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { useLang } from '../lib/hooks'
import { useSettings } from '../lib/settings'
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

export function WorkoutHome() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const settings = useSettings()
  const active = useLiveQuery(getActiveWorkout, [])
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), [])
  const lastDone = useLiveQuery(async () => {
    const finished = await db.workouts.filter((w) => w.endedAt !== undefined && w.routineId !== undefined).toArray()
    const map = new Map<number, number>()
    for (const w of finished) map.set(w.routineId!, Math.max(map.get(w.routineId!) ?? 0, w.startedAt))
    return map
  }, [])

  const begin = async (routine?: Routine) => {
    await startWorkout({ routine, name: routine ? undefined : t('workout.emptyName'), defaultRestSec: settings?.restDefault })
    nav('/workout')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('workout.title')}</h1>

      {active && (
        <Link to="/workout" className="card flex items-center justify-between border-accent p-4 text-accent">
          <span className="font-medium">{t('workout.resume')}</span>
          <span aria-hidden>▶</span>
        </Link>
      )}

      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" onClick={() => begin()} disabled={!!active}>{t('workout.startEmpty')}</button>
        <Link to="/routine/new" className="btn">+ {t('workout.newRoutine')}</Link>
      </div>

      <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted">{t('workout.routines')}</h2>
      {routines && routines.length === 0 && <p className="text-muted">{t('workout.noRoutines')}</p>}
      <ul className="flex flex-col gap-2">
        {routines?.map((r) => {
          const last = lastDone?.get(r.id!)
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
    </div>
  )
}
