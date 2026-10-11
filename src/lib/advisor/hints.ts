// Fortschritts-Hinweise (Advisor Stufe 2): regelbasiert auf dem eigenen Logbuch, nach Modul 9
// (Progression, Volumen, Frequenz 2–3×/Woche, Deload alle 4–5 Wochen).
import type { Exercise, Routine, SetLog, Workout } from '../../types'
import { e1rm, nextProgression } from '../calc'
import { weekStart } from '../stats'
import type { Level } from './planner'
import { GROUP_SIZE, type Group } from './slots'

export interface Hint {
  kind: 'progress' | 'plateau' | 'volumeLow' | 'volumeHigh' | 'frequencyLow' | 'frequencyHigh' | 'deload'
  /** höher = wichtiger */
  priority: number
  exerciseId?: string
  group?: Group
  params: Record<string, number | string>
}

const DAY = 86400000

const WEEKLY: Record<Level, [number, number]> = {
  beginner: [80, 150],
  advanced: [100, 180],
  pro: [140, 210],
  hobby: [60, 150],
}

export function groupOf(ex: Pick<Exercise, 'primaryMuscles'>): Group | null {
  const m = ex.primaryMuscles[0]
  switch (m) {
    case 'chest': return 'chest'
    case 'lats': case 'middle back': case 'traps': return 'back'
    case 'shoulders': return 'shoulders'
    case 'biceps': case 'forearms': return 'biceps'
    case 'triceps': return 'triceps'
    case 'quadriceps': case 'adductors': return 'quads'
    case 'hamstrings': return 'hams'
    case 'glutes': case 'abductors': return 'glutes'
    case 'calves': return 'calves'
    case 'abdominals': case 'lower back': return 'core'
    default: return null
  }
}

export interface HintInput {
  workouts: Workout[]
  sets: SetLog[]
  exercises: Map<string, Exercise>
  routines: Routine[]
  level: Level
  now: number
}

interface Session {
  workout: Workout
  sets: SetLog[]
}

function sessions(input: HintInput): Session[] {
  const byWorkout = new Map<number, SetLog[]>()
  for (const s of input.sets) {
    if (!s.done || s.type === 'warmup') continue
    const list = byWorkout.get(s.workoutId) ?? []
    list.push(s)
    byWorkout.set(s.workoutId, list)
  }
  return input.workouts
    .filter((w) => w.endedAt !== undefined && w.id !== undefined && byWorkout.has(w.id))
    .map((w) => ({ workout: w, sets: byWorkout.get(w.id!)! }))
    .sort((a, b) => a.workout.startedAt - b.workout.startedAt)
}

/** Ziel-Wiederholungsbereich aus der letzten Routine, die die Übung enthält; sonst 8–12. */
export function repRangeFor(exerciseId: string, routines: Routine[], workouts: Workout[]): [number, number] {
  const latest = [...workouts].filter((w) => w.items.some((i) => i.exerciseId === exerciseId && i.targetReps)).sort((a, b) => b.startedAt - a.startedAt)[0]
  const wi = latest?.items.find((i) => i.exerciseId === exerciseId)
  if (wi?.targetReps) return [wi.targetReps, wi.targetRepsMax ?? Math.min(15, wi.targetReps + 4)]
  const ri = routines.flatMap((r) => r.items).find((i) => i.exerciseId === exerciseId)
  if (ri) return [ri.reps, ri.repsMax ?? Math.min(15, ri.reps + 4)]
  return [8, 12]
}

export function computeHints(input: HintInput): Hint[] {
  const all = sessions(input)
  const hints: Hint[] = []
  if (!all.length) return hints
  const { now } = input

  // --- Progression und Plateau je Übung
  const perExercise = new Map<string, { at: number; sets: SetLog[] }[]>()
  for (const s of all) {
    const byEx = new Map<string, SetLog[]>()
    for (const set of s.sets) byEx.set(set.exerciseId, [...(byEx.get(set.exerciseId) ?? []), set])
    for (const [id, sets] of byEx) perExercise.set(id, [...(perExercise.get(id) ?? []), { at: s.workout.startedAt, sets }])
  }
  for (const [id, list] of perExercise) {
    const last = list[list.length - 1]
    if (now - last.at > 21 * DAY) continue // nur aktuelle Übungen
    const range = repRangeFor(id, input.routines, input.workouts)
    const next = nextProgression(last.sets.map((s) => ({ weight: s.weight, reps: s.reps })), range, 2.5)
    if (next && last.sets.some((s) => s.weight > 0)) {
      const lastWeight = Math.max(...last.sets.map((s) => s.weight))
      hints.push({
        kind: 'progress', priority: next.weight > lastWeight ? 60 : 40, exerciseId: id,
        params: { weight: next.weight, reps: next.reps, increase: next.weight > lastWeight ? 1 : 0, lo: range[0], hi: range[1] },
      })
    }
    const recent = list.filter((x) => now - x.at <= 42 * DAY)
    if (recent.length >= 4) {
      const best = recent.map((x) => Math.max(...x.sets.map((s) => e1rm(s.weight, s.reps))))
      const before = Math.max(...best.slice(0, -2))
      const lastTwo = Math.max(...best.slice(-2))
      if (before > 0 && lastTwo <= before * 1.01) hints.push({ kind: 'plateau', priority: 70, exerciseId: id, params: { sessions: recent.length } })
    }
  }

  // --- Volumen und Frequenz je Muskelgruppe
  const weekAgo = now - 7 * DAY
  const lastWeek = all.filter((s) => s.workout.startedAt >= weekAgo)
  const twoWeeks = all.filter((s) => s.workout.startedAt >= now - 14 * DAY)
  const groupOfEx = (id: string): Group | null => { const e = input.exercises.get(id); return e ? groupOf(e) : null }
  const weekly = new Map<Group, number>()
  for (const s of lastWeek) for (const set of s.sets) {
    const g = groupOfEx(set.exerciseId)
    if (g) weekly.set(g, (weekly.get(g) ?? 0) + set.reps)
  }
  const [lo, hi] = WEEKLY[input.level]
  if (lastWeek.length >= 2) {
    for (const [g, reps] of weekly) {
      const factor = GROUP_SIZE[g] === 'big' ? 1 : 0.6
      if (reps < lo * factor * 0.75) hints.push({ kind: 'volumeLow', priority: 50, group: g, params: { reps, lo: Math.round(lo * factor), hi: Math.round(hi * factor) } })
      else if (reps > hi * factor * 1.2) hints.push({ kind: 'volumeHigh', priority: 45, group: g, params: { reps, lo: Math.round(lo * factor), hi: Math.round(hi * factor) } })
    }
  }
  if (twoWeeks.length >= 3) {
    const sessionsPerGroup = new Map<Group, number>()
    for (const s of twoWeeks) {
      const groups = new Set(s.sets.map((x) => groupOfEx(x.exerciseId)).filter((g): g is Group => !!g))
      for (const g of groups) sessionsPerGroup.set(g, (sessionsPerGroup.get(g) ?? 0) + 1)
    }
    for (const [g, n] of sessionsPerGroup) {
      if (GROUP_SIZE[g] !== 'big') continue
      const perWeek = n / 2
      if (perWeek < 1.5) hints.push({ kind: 'frequencyLow', priority: 55, group: g, params: { perWeek: Math.round(perWeek * 10) / 10 } })
      else if (perWeek > 3.5) hints.push({ kind: 'frequencyHigh', priority: 40, group: g, params: { perWeek: Math.round(perWeek * 10) / 10 } })
    }
  }

  // --- Deload: ≥ 5 Trainingswochen am Stück ohne deutlich reduzierte Woche (Zyklus 4–5 Wochen)
  const volumeByWeek = new Map<number, number>()
  for (const s of all) {
    const ws = weekStart(s.workout.startedAt)
    volumeByWeek.set(ws, (volumeByWeek.get(ws) ?? 0) + s.sets.reduce((a, x) => a + x.weight * x.reps, 0))
  }
  const thisWeek = weekStart(now)
  let streak = 0
  for (let w = thisWeek; volumeByWeek.has(w) || w === thisWeek; w -= 7 * DAY) {
    const vol = volumeByWeek.get(w)
    if (vol === undefined) { if (w === thisWeek) continue; break }
    const prev = [1, 2, 3].map((k) => volumeByWeek.get(w - k * 7 * DAY)).filter((v): v is number => v !== undefined)
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0
    if (avg > 0 && vol <= avg * 0.6 && w !== thisWeek) break // das war schon eine Deload-Woche
    streak++
  }
  if (streak >= 5) hints.push({ kind: 'deload', priority: 80, params: { weeks: streak } })

  return hints.sort((a, b) => b.priority - a.priority)
}
