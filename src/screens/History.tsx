import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { formatDuration, toDisplay } from '../lib/calc'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { useSettings } from '../lib/settings'
import { workoutStats } from '../lib/stats'
import { useExerciseMap } from '../lib/useExercises'
import { deleteWorkout, startWorkout } from '../lib/workout'

const fmtDate = (ts: number, lang: string) =>
  new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(ts)

export function History() {
  const { t } = useTranslation()
  const lang = useLang()
  const units = useSettings()?.units ?? 'kg'
  const data = useLiveQuery(async () => {
    const [workouts, sets] = await Promise.all([db.workouts.toArray(), db.sets.toArray()])
    const stats = new Map(workoutStats(workouts, sets).map((s) => [s.id, s]))
    return workouts.filter((w) => w.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt).map((w) => ({ w, s: stats.get(w.id!)! }))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('history.title')}</h1>
      {data && data.length === 0 && <p className="text-muted">{t('history.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {data?.map(({ w, s }) => (
          <li key={w.id}>
            <Link to={`/history/${w.id}`} className="card block p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{w.name || t('workout.emptyName')}</span>
                <span className="text-xs text-muted">{fmtDate(w.startedAt, lang)}</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {formatDuration(s.durationMs)} · {s.sets} {t('history.setsDone')} · {Math.round(toDisplay(s.volume, units))} {units}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WorkoutDetail() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const settings = useSettings()
  const units = settings?.units ?? 'kg'
  const { id } = useParams()
  const wid = Number(id)
  const exMap = useExerciseMap()
  const data = useLiveQuery(async () => ({ w: await db.workouts.get(wid), sets: await db.sets.where('workoutId').equals(wid).sortBy('order') }), [wid])
  if (!data) return <p className="text-muted">{t('common.loading')}</p>
  if (!data.w) return <p className="text-muted">{t('common.empty')}</p>
  const { w, sets } = data

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav('/history')} aria-label={t('common.back')}>←</button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{w.name || t('workout.emptyName')}</h1>
          <div className="text-xs text-muted">{fmtDate(w.startedAt, lang)}{w.endedAt ? ` · ${formatDuration(w.endedAt - w.startedAt)}` : ''}</div>
        </div>
      </div>
      {w.items.map((it) => {
        const ex = exMap.get(it.exerciseId)
        const mine = sets.filter((s) => s.exerciseId === it.exerciseId)
        return (
          <section key={it.exerciseId} className="card p-3">
            <Link to={`/more/exercises/${it.exerciseId}`} className="font-semibold">{ex ? exName(ex, lang) : it.exerciseId}</Link>
            {it.note && <p className="text-sm text-muted">{it.note}</p>}
            <ul className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
              {mine.map((s, i) => (
                <li key={s.id} className="flex justify-between">
                  <span className="text-muted">{s.type === 'normal' ? i + 1 : t(`workout.${s.type}`)}</span>
                  <span>{toDisplay(s.weight, units)} {units} × {s.reps}{s.rpe ? ` @${s.rpe}` : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={async () => { await startWorkout({ fromWorkoutId: wid, defaultRestSec: settings?.restDefault }); nav('/workout') }}>{t('history.repeat')}</button>
        <button className="btn btn-danger flex-1" onClick={async () => { if (confirm(t('common.confirmDelete'))) { await deleteWorkout(wid); nav('/history') } }}>{t('history.delete')}</button>
      </div>
    </div>
  )
}
