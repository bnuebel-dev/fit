import { db } from '../db'
import type { Routine, SetLog, Workout, WorkoutItem } from '../types'
import { e1rm, setVolume } from './calc'
import { warmupRamp } from './warmup'

export async function getActiveWorkout(): Promise<Workout | undefined> {
  const open = await db.workouts.filter((w) => w.endedAt === undefined).toArray()
  return open.sort((a, b) => b.startedAt - a.startedAt)[0]
}

/** Sätze der letzten abgeschlossenen Einheit, in der die Übung vorkam. */
export async function previousSets(exerciseId: string, excludeWorkoutId?: number): Promise<SetLog[]> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const done = all.filter((s) => s.done && s.workoutId !== excludeWorkoutId)
  if (!done.length) return []
  const workouts = await db.workouts.bulkGet([...new Set(done.map((s) => s.workoutId))])
  const finished = workouts.filter((w): w is Workout => !!w && w.endedAt !== undefined)
  if (!finished.length) return []
  const last = finished.sort((a, b) => b.startedAt - a.startedAt)[0]
  return done.filter((s) => s.workoutId === last.id).sort((a, b) => a.order - b.order)
}

/** Bestes geschätztes 1RM aus allen abgeschlossenen Einheiten (ohne Aufwärmsätze). */
export async function bestE1rm(exerciseId: string, excludeWorkoutId?: number): Promise<number> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const done = all.filter((s) => s.done && s.type !== 'warmup' && s.workoutId !== excludeWorkoutId)
  if (!done.length) return 0
  const workouts = await db.workouts.bulkGet([...new Set(done.map((s) => s.workoutId))])
  const finished = new Set(workouts.filter((w): w is Workout => !!w && w.endedAt !== undefined).map((w) => w.id))
  return Math.max(0, ...done.filter((s) => finished.has(s.workoutId)).map((s) => e1rm(s.weight, s.reps)))
}

export interface StartOptions {
  routine?: Routine
  /** Einheit aus einer früheren Einheit wiederholen */
  fromWorkoutId?: number
  name?: string
  defaultRestSec?: number
}

export async function startWorkout(opts: StartOptions = {}): Promise<number> {
  const existing = await getActiveWorkout()
  if (existing?.id) return existing.id
  const rest = opts.defaultRestSec ?? 120
  let items: WorkoutItem[] = []
  let name = opts.name ?? ''
  let planned: { exerciseId: string; sets: number; reps: number }[] = []

  if (opts.routine) {
    name = name || opts.routine.name
    items = opts.routine.items.map((i) => ({
      exerciseId: i.exerciseId,
      restSec: i.restSec,
      targetReps: i.reps,
      ...(i.repsMax !== undefined ? { targetRepsMax: i.repsMax } : {}),
      ...(i.supersetGroup !== undefined ? { supersetGroup: i.supersetGroup } : {}),
    }))
    planned = opts.routine.items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets, reps: i.reps }))
  } else if (opts.fromWorkoutId) {
    const src = await db.workouts.get(opts.fromWorkoutId)
    const srcSets = await db.sets.where('workoutId').equals(opts.fromWorkoutId).toArray()
    if (src) {
      name = name || src.name
      items = src.items.map((i) => ({ ...i, note: undefined }))
      planned = src.items.map((i) => {
        const s = srcSets.filter((x) => x.exerciseId === i.exerciseId && x.done)
        return { exerciseId: i.exerciseId, sets: Math.max(1, s.length), reps: s[0]?.reps ?? 8 }
      })
    }
  }

  const id = (await db.workouts.add({
    ...(opts.routine?.id ? { routineId: opts.routine.id } : {}),
    name,
    startedAt: Date.now(),
    items: items.map((i) => ({ ...i, restSec: i.restSec || rest })),
  })) as number

  for (const p of planned) {
    const prev = await previousSets(p.exerciseId, id)
    const rows: SetLog[] = Array.from({ length: p.sets }, (_, k) => {
      const ref = prev[k] ?? prev[prev.length - 1]
      return {
        workoutId: id,
        exerciseId: p.exerciseId,
        order: k,
        weight: ref?.weight ?? 0,
        reps: ref?.reps ?? p.reps,
        type: 'normal',
        done: 0,
      }
    })
    await db.sets.bulkAdd(rows)
  }
  return id
}

export async function addExercise(workoutId: number, exerciseId: string, restSec: number): Promise<void> {
  const w = await db.workouts.get(workoutId)
  if (!w || w.items.some((i) => i.exerciseId === exerciseId)) return
  await db.workouts.update(workoutId, { items: [...w.items, { exerciseId, restSec }] })
  await addSet(workoutId, exerciseId)
}

export async function removeExercise(workoutId: number, exerciseId: string): Promise<void> {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  await db.workouts.update(workoutId, { items: w.items.filter((i) => i.exerciseId !== exerciseId) })
  await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).delete()
}

export async function addSet(workoutId: number, exerciseId: string): Promise<number> {
  const sets = await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray()
  sets.sort((a, b) => a.order - b.order)
  const last = sets[sets.length - 1]
  const prev = last ? [] : await previousSets(exerciseId, workoutId)
  const ref = last ?? prev[0]
  return (await db.sets.add({
    workoutId,
    exerciseId,
    order: last ? last.order + 1 : 0,
    weight: ref?.weight ?? 0,
    reps: ref?.reps ?? 8,
    type: 'normal',
    done: 0,
  })) as number
}

/** Fügt eine Aufwärmrampe vor den vorhandenen Sätzen ein. Gibt die Anzahl eingefügter Sätze zurück. */
export async function addWarmups(workoutId: number, exerciseId: string, workKg: number): Promise<number> {
  const ramp = warmupRamp(workKg)
  if (!ramp.length) return 0
  const sets = await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray()
  if (sets.some((x) => x.type === 'warmup')) return 0
  await db.transaction('rw', db.sets, async () => {
    for (const x of sets) await db.sets.update(x.id!, { order: x.order + ramp.length })
    for (const [i, r] of ramp.entries()) await db.sets.add({ workoutId, exerciseId, order: i, weight: r.weight, reps: r.reps, type: 'warmup', done: 0 })
  })
  return ramp.length
}

export interface Summary {
  workoutId: number
  durationMs: number
  sets: number
  volume: number
  exercises: number
  prs: { exerciseId: string; e1rm: number; weight: number; reps: number }[]
}

/** Schließt die Einheit ab: offene Sätze und leere Übungen werden verworfen. */
export async function finishWorkout(id: number, note?: string): Promise<Summary | null> {
  const w = await db.workouts.get(id)
  if (!w) return null
  const sets = await db.sets.where('workoutId').equals(id).toArray()
  const open = sets.filter((s) => !s.done).map((s) => s.id!)
  if (open.length) await db.sets.bulkDelete(open)
  const done = sets.filter((s) => s.done)
  const keep = new Set(done.map((s) => s.exerciseId))
  const items = w.items.filter((i) => keep.has(i.exerciseId))
  if (!done.length) {
    await db.workouts.delete(id)
    return null
  }
  const endedAt = Date.now()
  await db.workouts.update(id, { endedAt, items, ...(note ? { note } : {}) })

  const prs: Summary['prs'] = []
  for (const exId of keep) {
    const before = await bestE1rm(exId, id)
    const mine = done.filter((s) => s.exerciseId === exId && s.type !== 'warmup')
    const best = mine.reduce<SetLog | undefined>((a, s) => (!a || e1rm(s.weight, s.reps) > e1rm(a.weight, a.reps) ? s : a), undefined)
    if (best && before > 0 && e1rm(best.weight, best.reps) > before + 1e-9) {
      prs.push({ exerciseId: exId, e1rm: e1rm(best.weight, best.reps), weight: best.weight, reps: best.reps })
    }
  }
  return {
    workoutId: id,
    durationMs: endedAt - w.startedAt,
    sets: done.length,
    volume: done.reduce((a, s) => a + setVolume(s), 0),
    exercises: keep.size,
    prs,
  }
}

export async function discardWorkout(id: number): Promise<void> {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(id).delete()
    await db.workouts.delete(id)
  })
}

export async function deleteWorkout(id: number): Promise<void> {
  await discardWorkout(id)
}
