import type { Exercise, Muscle, SetLog, Workout } from '../types'
import { e1rm, setVolume } from './calc'

export interface WorkoutStat {
  id: number
  startedAt: number
  durationMs: number
  sets: number
  reps: number
  volume: number
}

export type Period = 'week' | 'm1' | 'm3' | 'y1' | 'all'
const DAY = 86400000

export function periodStart(period: Period, now: number): number {
  switch (period) {
    case 'week': return now - 7 * DAY
    case 'm1': return now - 30 * DAY
    case 'm3': return now - 91 * DAY
    case 'y1': return now - 365 * DAY
    default: return 0
  }
}

export function workoutStats(workouts: Workout[], sets: SetLog[]): WorkoutStat[] {
  const byWorkout = new Map<number, SetLog[]>()
  for (const s of sets) {
    if (!s.done) continue
    const list = byWorkout.get(s.workoutId) ?? []
    list.push(s)
    byWorkout.set(s.workoutId, list)
  }
  return workouts
    .filter((w) => w.endedAt !== undefined && w.id !== undefined)
    .map((w) => {
      const ws = (byWorkout.get(w.id!) ?? []).filter((s) => s.type !== 'warmup')
      return {
        id: w.id!,
        startedAt: w.startedAt,
        durationMs: w.endedAt! - w.startedAt,
        sets: ws.length,
        reps: ws.reduce((a, s) => a + s.reps, 0),
        volume: ws.reduce((a, s) => a + setVolume(s), 0),
      }
    })
    .sort((a, b) => a.startedAt - b.startedAt)
}

export type Metric = 'durationMs' | 'volume' | 'sets' | 'reps'
export interface MetricSummary { sum: number; max: number; min: number; avg: number }

export function summarize(list: WorkoutStat[], metric: Metric): MetricSummary {
  if (!list.length) return { sum: 0, max: 0, min: 0, avg: 0 }
  const values = list.map((w) => w[metric])
  const sum = values.reduce((a, b) => a + b, 0)
  return { sum, max: Math.max(...values), min: Math.min(...values), avg: sum / values.length }
}

/** Trend: aktueller Durchschnitt gegenüber dem vorherigen Zeitraum. 0 = gleich (±2 %). */
export function trend(current: number, previous: number): -1 | 0 | 1 {
  if (previous === 0) return current > 0 ? 1 : 0
  const ratio = current / previous
  return ratio > 1.02 ? 1 : ratio < 0.98 ? -1 : 0
}

export function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Montag
  return d.getTime()
}

export function weeklyVolume(list: WorkoutStat[]): { weekStart: number; volume: number }[] {
  const map = new Map<number, number>()
  for (const w of list) map.set(weekStart(w.startedAt), (map.get(weekStart(w.startedAt)) ?? 0) + w.volume)
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([ws, volume]) => ({ weekStart: ws, volume }))
}

/** Anteil je Muskelgruppe: Hauptmuskel zählt je Satz 1, Hilfsmuskeln 0,5. */
export function muscleShare(sets: SetLog[], exercises: Map<string, Exercise>): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {}
  for (const s of sets) {
    if (!s.done || s.type === 'warmup') continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) out[m] = (out[m] ?? 0) + 1
    for (const m of ex.secondaryMuscles) out[m] = (out[m] ?? 0) + 0.5
  }
  return out
}

export function bestByExercise(sets: SetLog[]): Map<string, { weight: number; reps: number; e1rm: number }> {
  const best = new Map<string, { weight: number; reps: number; e1rm: number }>()
  for (const s of sets) {
    if (!s.done || s.type === 'warmup') continue
    const v = e1rm(s.weight, s.reps)
    if (v > (best.get(s.exerciseId)?.e1rm ?? 0)) best.set(s.exerciseId, { weight: s.weight, reps: s.reps, e1rm: v })
  }
  return best
}
