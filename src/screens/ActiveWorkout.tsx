import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { ExerciseImage } from '../components/ExerciseImage'
import { ExercisePicker } from '../components/ExercisePicker'
import { NumField } from '../components/NumField'
import { Sheet } from '../components/Sheet'
import { e1rm, formatDuration, fromDisplay, nextProgression, toDisplay } from '../lib/calc'
import { useLang, useNow } from '../lib/hooks'
import { exName } from '../lib/names'
import { useRest } from '../lib/restTimer'
import { useSettings } from '../lib/settings'
import { useExerciseMap } from '../lib/useExercises'
import { addExercise, addSet, bestE1rm, discardWorkout, finishWorkout, getActiveWorkout, previousSets, removeExercise, type Summary } from '../lib/workout'
import type { Exercise, SetLog, SetType, Units, Workout, WorkoutItem } from '../types'

const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure']
const TYPE_LETTER: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' }

export function ActiveWorkout() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const settings = useSettings()
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null, [])
  const exMap = useExerciseMap()
  const lang = useLang()
  const [picking, setPicking] = useState(false)
  const [summary, setSummary] = useState<Summary | null | 'empty'>(null)
  const now = useNow(1000, !!active)

  if (summary && summary !== 'empty') return <SummaryView summary={summary} onClose={() => nav('/', { replace: true })} />
  if (active === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (active === null) return <Navigate to="/" replace />
  const units = settings?.units ?? 'kg'

  const finish = async () => {
    const res = await finishWorkout(active.id!)
    useRest.getState().stop()
    if (res) setSummary(res)
    else {
      alert(t('workout.noSets'))
      nav('/', { replace: true })
    }
  }
  const discard = async () => {
    if (!confirm(t('workout.discardConfirm'))) return
    await discardWorkout(active.id!)
    useRest.getState().stop()
    nav('/', { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-line bg-bg px-4 py-2">
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate bg-transparent text-lg font-bold outline-none"
            value={active.name}
            aria-label={t('workout.routineName')}
            onChange={(e) => void db.workouts.update(active.id!, { name: e.target.value })}
          />
          <div className="text-xs text-muted tabular-nums">{formatDuration(now - active.startedAt)}</div>
        </div>
        <button className="btn btn-primary" onClick={finish}>{t('workout.finish')}</button>
      </div>

      {active.items.length === 0 && <p className="text-muted">{t('workout.tapToCheck')}</p>}

      {active.items.map((item, i) => {
        const ex = exMap.get(item.exerciseId)
        const linkedPrev = i > 0 && item.supersetGroup !== undefined && active.items[i - 1].supersetGroup === item.supersetGroup
        const linkedNext = i < active.items.length - 1 && item.supersetGroup !== undefined && active.items[i + 1].supersetGroup === item.supersetGroup
        return (
          <ExerciseCard
            key={item.exerciseId}
            workout={active}
            item={item}
            index={i}
            name={ex ? exName(ex, lang) : item.exerciseId}
            image={ex}
            units={units}
            linkedPrev={linkedPrev}
            linkedNext={linkedNext}
          />
        )
      })}

      <button className="btn" onClick={() => setPicking(true)}>+ {t('workout.addExercise')}</button>
      <button className="btn btn-danger" onClick={discard}>{t('workout.discard')}</button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (ex) => {
            await addExercise(active.id!, ex.id, settings?.restDefault ?? 120)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}

function ExerciseCard({ workout, item, index, name, image, units, linkedPrev, linkedNext }: {
  workout: Workout; item: WorkoutItem; index: number; name: string
  image?: Exercise
  units: Units; linkedPrev: boolean; linkedNext: boolean
}) {
  const { t } = useTranslation()
  const [menu, setMenu] = useState(false)
  const [showRpe, setShowRpe] = useState(false)
  const wid = workout.id!
  const sets = useLiveQuery(() => db.sets.where('[workoutId+exerciseId]').equals([wid, item.exerciseId]).sortBy('order'), [wid, item.exerciseId])
  const prev = useLiveQuery(() => previousSets(item.exerciseId, wid), [item.exerciseId, wid])
  const best = useLiveQuery(() => bestE1rm(item.exerciseId, wid), [item.exerciseId, wid])
  const unit = t(`workout.${units}`)
  // Vorschlag nach doppelter Progression aus der letzten Einheit (Modul 9.3.1)
  const lo = item.targetReps ?? 8
  const hi = item.targetRepsMax ?? Math.min(15, lo + 4)
  const suggestion = prev && prev.some((x) => x.weight > 0 && x.type !== 'warmup') ? nextProgression(prev.filter((x) => x.type !== 'warmup').map((x) => ({ weight: x.weight, reps: x.reps })), [lo, hi]) : null
  const open = (sets ?? []).filter((x) => !x.done)
  const applySuggestion = async () => {
    if (!suggestion) return
    for (const x of open) await db.sets.update(x.id!, { weight: suggestion.weight, reps: suggestion.reps })
  }
  const alreadyApplied = !!suggestion && open.length > 0 && open.every((x) => x.weight === suggestion.weight && x.reps === suggestion.reps)

  const update = (s: SetLog, p: Partial<SetLog>) => db.sets.update(s.id!, p)
  const toggleDone = async (s: SetLog) => {
    const done = s.done ? 0 : 1
    await update(s, { done })
    if (done) {
      // Folgesätze ohne Gewicht übernehmen das eben eingetragene Gewicht
      const later = (sets ?? []).filter((x) => x.order > s.order && !x.done && x.weight === 0)
      for (const x of later) await update(x, { weight: s.weight })
    }
    if (done && s.type !== 'warmup') useRest.getState().start(item.restSec, name)
    else if (!done) useRest.getState().stop()
  }
  const updateItem = (p: Partial<WorkoutItem>) =>
    db.workouts.update(wid, { items: workout.items.map((it) => (it.exerciseId === item.exerciseId ? { ...it, ...p } : it)) })

  const toggleSuperset = async () => {
    const next = workout.items[index + 1]
    if (!next) return
    const g = linkedNext ? undefined : (item.supersetGroup ?? Date.now())
    await db.workouts.update(wid, {
      items: workout.items.map((it, k) => (k === index || k === index + 1 ? { ...it, supersetGroup: g } : it)),
    })
    setMenu(false)
  }

  return (
    <section className={`card p-3 ${linkedPrev || linkedNext ? 'border-l-4 !border-l-accent' : ''}`} aria-label={name}>
      <div className="flex items-center gap-3">
        {image && <ExerciseImage ex={image} size={44} />}
        <Link to={`/more/exercises/${item.exerciseId}`} className="min-w-0 flex-1 truncate font-semibold">{name}</Link>
        <button className="btn !px-3" onClick={() => setMenu(true)} aria-label="menu">⋮</button>
      </div>
      {item.note && <p className="mt-1 text-sm text-muted">{item.note}</p>}
      {suggestion && open.length > 0 && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm" role="note">
          <span>💡 {t('workout.suggestion', { weight: toDisplay(suggestion.weight, units), unit, reps: suggestion.reps })}</span>
          {!alreadyApplied && <button className="font-semibold text-accent" onClick={applySuggestion}>{t('workout.apply')}</button>}
        </div>
      )}

      <div className={`mt-3 grid items-center gap-2 text-center text-xs text-muted ${showRpe ? 'grid-cols-[2rem_1fr_1fr_1fr_3.5rem_2.75rem]' : 'grid-cols-[2rem_1fr_1fr_1fr_2.75rem]'}`}>
        <span>{t('workout.set')}</span><span>{t('workout.previous')}</span><span>{unit}</span><span>{t('common.reps')}</span>{showRpe && <span>{t('workout.rpe')}</span>}<span />
        {sets?.map((s, k) => {
          const p = prev?.[k] ?? prev?.[prev.length - 1]
          const isPr = !!s.done && s.type !== 'warmup' && (best ?? 0) > 0 && e1rm(s.weight, s.reps) > (best ?? 0)
          return (
            <SetRow key={s.id} s={s} k={k} prevText={p ? `${toDisplay(p.weight, units)}×${p.reps}` : '–'} units={units} isPr={isPr} showRpe={showRpe}
              onType={() => update(s, { type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % TYPE_ORDER.length] })}
              onWeight={(v) => update(s, { weight: fromDisplay(v, units) })}
              onReps={(v) => update(s, { reps: Math.round(v) })}
              onRpe={(v) => update(s, { rpe: Math.min(10, v) })}
              onDone={() => toggleDone(s)}
              onDelete={() => db.sets.delete(s.id!)} />
          )
        })}
      </div>

      <button className="btn mt-3 w-full" onClick={() => addSet(wid, item.exerciseId)}>+ {t('workout.addSet')}</button>

      {menu && (
        <Sheet title={name} onClose={() => setMenu(false)}>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted">{t('workout.note')}
              <input className="field mt-1" value={item.note ?? ''} onChange={(e) => void updateItem({ note: e.target.value })} />
            </label>
            <label className="text-sm text-muted">{t('workout.rest')}
              <NumField className="mt-1" value={item.restSec} onCommit={(v) => void updateItem({ restSec: Math.round(v) })} label={t('workout.rest')} />
            </label>
            <button className="btn" onClick={() => { setShowRpe((v) => !v); setMenu(false) }}>{t('workout.rpe')}</button>
            {index < workout.items.length - 1 && <button className="btn" onClick={toggleSuperset}>{t('workout.superset')}{linkedNext ? ' ✓' : ''}</button>}
            <button className="btn btn-danger" onClick={() => { void removeExercise(wid, item.exerciseId); setMenu(false) }}>{t('workout.removeExercise')}</button>
          </div>
        </Sheet>
      )}
    </section>
  )
}

function SetRow({ s, k, prevText, units, isPr, showRpe, onType, onWeight, onReps, onRpe, onDone, onDelete }: {
  s: SetLog; k: number; prevText: string; units: Units; isPr: boolean; showRpe: boolean
  onType: () => void; onWeight: (v: number) => void; onReps: (v: number) => void; onRpe: (v: number) => void; onDone: () => void; onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <button
        className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${s.type === 'normal' ? 'bg-surface2 text-fg' : 'bg-warn/20 text-warn'}`}
        onClick={onType}
        onContextMenu={(e) => { e.preventDefault(); onDelete() }}
        aria-label={`${t('workout.set')} ${k + 1} ${t(`workout.${s.type}`)}`}
      >
        {TYPE_LETTER[s.type] || k + 1}
      </button>
      <span className="text-sm tabular-nums">{prevText}</span>
      <NumField value={toDisplay(s.weight, units)} onCommit={onWeight} step={units === 'kg' ? 2.5 : 5} label={t('common.weight')} />
      <NumField value={s.reps} onCommit={onReps} label={t('common.reps')} />
      {showRpe && <NumField value={s.rpe ?? 0} min={0} onCommit={onRpe} label={t('workout.rpe')} />}
      <button
        className={`flex size-11 items-center justify-center rounded-xl text-xl font-bold ${s.done ? 'bg-ok text-black' : 'bg-surface2 text-muted'}`}
        onClick={onDone}
        aria-pressed={!!s.done}
        aria-label={`${t('workout.set')} ${k + 1} ✓`}
      >
        {isPr ? '🏆' : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        )}
      </button>
    </>
  )
}

function SummaryView({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const settings = useSettings()
  const exMap = useExerciseMap()
  const units = settings?.units ?? 'kg'
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">🎉 {t('workout.summary')}</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t('workout.duration')} value={formatDuration(summary.durationMs)} />
        <Stat label={t('common.sets')} value={String(summary.sets)} />
        <Stat label={t('workout.volume')} value={`${Math.round(toDisplay(summary.volume, units))} ${units}`} />
      </div>
      {summary.prs.length > 0 && (
        <div className="card p-3">
          <h2 className="mb-2 font-semibold">🏆 {t('workout.newPr')}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.prs.map((p) => {
              const ex = exMap.get(p.exerciseId)
              return <li key={p.exerciseId}>{ex ? exName(ex, lang) : p.exerciseId}: {toDisplay(p.weight, units)} {units} × {p.reps} (1RM ≈ {Math.round(toDisplay(p.e1rm, units))})</li>
            })}
          </ul>
        </div>
      )}
      <button className="btn btn-primary" onClick={onClose}>{t('common.ok')}</button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}
