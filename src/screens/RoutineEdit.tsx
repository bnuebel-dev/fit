import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { ExercisePicker } from '../components/ExercisePicker'
import { NumField } from '../components/NumField'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { useSettings } from '../lib/settings'
import { useExerciseMap } from '../lib/useExercises'
import type { Routine, RoutineItem } from '../types'
import { weekdayLabel } from './WorkoutHome'

const COLORS = ['#f59e0b', '#ef4444', '#a78bfa', '#facc15', '#34d399', '#38bdf8', '#fb7185', '#94a3b8']

export function RoutineEdit() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const { id } = useParams()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const isNew = id === 'new'
  const [routine, setRoutine] = useState<Routine | null>(isNew ? { name: '', color: COLORS[0], order: Date.now(), items: [] } : null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (!isNew) void db.routines.get(Number(id)).then((r) => setRoutine(r ?? null))
  }, [id, isNew])

  if (!routine) return <p className="text-muted">{t('common.loading')}</p>
  const patch = (p: Partial<Routine>) => setRoutine({ ...routine, ...p })
  const patchItem = (i: number, p: Partial<RoutineItem>) => patch({ items: routine.items.map((it, k) => (k === i ? { ...it, ...p } : it)) })
  const move = (i: number, d: -1 | 1) => {
    const items = [...routine.items]
    const j = i + d
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    patch({ items })
  }
  const save = async () => {
    await db.routines.put({ ...routine, name: routine.name.trim() || t('workout.newRoutine') })
    nav('/')
  }
  const remove = async () => {
    if (!isNew && confirm(t('common.confirmDelete'))) {
      await db.routines.delete(Number(id))
      nav('/')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav(-1)} aria-label={t('common.back')}>←</button>
        <h1 className="flex-1 text-xl font-bold">{isNew ? t('workout.newRoutine') : routine.name}</h1>
        <button className="btn btn-primary" onClick={save}>{t('common.save')}</button>
      </div>

      <input className="field" placeholder={t('workout.routineName')} value={routine.name} onChange={(e) => patch({ name: e.target.value })} aria-label={t('workout.routineName')} />

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('workout.color')}>
        {COLORS.map((c) => (
          <button key={c} role="radio" aria-checked={routine.color === c} aria-label={c} className={`size-9 rounded-full ${routine.color === c ? 'ring-2 ring-fg ring-offset-2 ring-offset-bg' : ''}`} style={{ background: c }} onClick={() => patch({ color: c })} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('workout.weekday')}>
        <button className={`chip ${!routine.weekday ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => patch({ weekday: undefined })}>{t('common.none')}</button>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <button key={d} className={`chip ${routine.weekday === d ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => patch({ weekday: d })}>{weekdayLabel(d, lang)}</button>
        ))}
      </div>

      <input className="field" placeholder={t('workout.note')} value={routine.note ?? ''} onChange={(e) => patch({ note: e.target.value })} aria-label={t('workout.note')} />

      <ul className="flex flex-col gap-2">
        {routine.items.map((it, i) => {
          const ex = exMap.get(it.exerciseId)
          return (
            <li key={`${it.exerciseId}-${i}`} className="card flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-medium">{ex ? exName(ex, lang) : it.exerciseId}</span>
                <button className="btn !min-h-9 !px-2" onClick={() => move(i, -1)} aria-label="up">↑</button>
                <button className="btn !min-h-9 !px-2" onClick={() => move(i, 1)} aria-label="down">↓</button>
                <button className="btn btn-danger !min-h-9 !px-2" onClick={() => patch({ items: routine.items.filter((_, k) => k !== i) })} aria-label={t('common.delete')}>✕</button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted">
                <label>{t('workout.targetSets')}<NumField value={it.sets} min={1} onCommit={(v) => patchItem(i, { sets: Math.round(v) })} label={t('workout.targetSets')} /></label>
                <label>{t('workout.targetReps')}<NumField value={it.reps} min={1} onCommit={(v) => patchItem(i, { reps: Math.round(v) })} label={t('workout.targetReps')} /></label>
                <label>{t('workout.rest')}<NumField value={it.restSec} min={0} onCommit={(v) => patchItem(i, { restSec: Math.round(v) })} label={t('workout.rest')} /></label>
              </div>
              {i < routine.items.length - 1 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={it.supersetGroup !== undefined && it.supersetGroup === routine.items[i + 1].supersetGroup}
                    onChange={(e) => {
                      const g = it.supersetGroup ?? Date.now()
                      const items = routine.items.map((x, k) => (k === i || k === i + 1 ? { ...x, supersetGroup: e.target.checked ? g : undefined } : x))
                      patch({ items })
                    }} />
                  {t('workout.superset')}
                </label>
              )}
            </li>
          )
        })}
      </ul>

      <button className="btn" onClick={() => setPicking(true)}>+ {t('workout.addExercise')}</button>
      {!isNew && <button className="btn btn-danger" onClick={remove}>{t('common.delete')}</button>}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            patch({ items: [...routine.items, { exerciseId: ex.id, sets: 3, reps: 8, restSec: settings?.restDefault ?? 120 }] })
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
