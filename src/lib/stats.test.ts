import { describe, expect, it } from 'vitest'
import { bestByExercise, muscleShare, periodStart, summarize, trend, weekStart, weeklyVolume, workoutStats } from './stats'
import type { Exercise, SetLog, Workout } from '../types'

const mk = (id: number, start: number, mins: number): Workout => ({ id, name: 'x', startedAt: start, endedAt: start + mins * 60000, items: [] })
const set = (workoutId: number, exerciseId: string, weight: number, reps: number, over: Partial<SetLog> = {}): SetLog => ({
  workoutId, exerciseId, order: 0, weight, reps, type: 'normal', done: 1, ...over,
})

const MON = new Date(2026, 9, 5, 10).getTime() // Mo 5.10.2026
const workouts = [mk(1, MON, 60), mk(2, MON + 2 * 86400000, 30), { id: 3, name: 'läuft', startedAt: MON, items: [] } as Workout]
const sets = [set(1, 'a', 80, 8), set(1, 'a', 80, 8), set(1, 'a', 40, 10, { type: 'warmup' }), set(2, 'b', 50, 10), set(2, 'b', 50, 10, { done: 0 })]

describe('stats', () => {
  const stats = workoutStats(workouts, sets)
  it('zählt nur abgeschlossene Einheiten, erledigte Sätze, ohne Aufwärmen', () => {
    expect(stats).toHaveLength(2)
    expect(stats[0]).toMatchObject({ sets: 2, reps: 16, volume: 1280, durationMs: 3600000 })
    expect(stats[1]).toMatchObject({ sets: 1, volume: 500 })
  })
  it('summarize', () => {
    expect(summarize(stats, 'volume')).toEqual({ sum: 1780, max: 1280, min: 500, avg: 890 })
    expect(summarize([], 'volume')).toEqual({ sum: 0, max: 0, min: 0, avg: 0 })
  })
  it('trend mit Toleranz', () => {
    expect(trend(100, 100)).toBe(0)
    expect(trend(110, 100)).toBe(1)
    expect(trend(90, 100)).toBe(-1)
    expect(trend(5, 0)).toBe(1)
    expect(trend(0, 0)).toBe(0)
  })
  it('Woche beginnt am Montag', () => {
    expect(new Date(weekStart(MON + 4 * 86400000)).getDay()).toBe(1)
    expect(weekStart(MON)).toBe(weekStart(MON + 2 * 86400000))
  })
  it('weeklyVolume fasst die Woche zusammen', () => {
    expect(weeklyVolume(stats)).toEqual([{ weekStart: weekStart(MON), volume: 1780 }])
  })
  it('periodStart', () => {
    expect(periodStart('all', 1000)).toBe(0)
    expect(periodStart('week', 7 * 86400000)).toBe(0)
  })
  it('muscleShare: Haupt 1, Hilfsmuskel 0,5', () => {
    const ex = new Map<string, Exercise>([
      ['a', { id: 'a', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] } as Exercise],
    ])
    expect(muscleShare(sets, ex)).toEqual({ chest: 2, triceps: 1 })
  })
  it('bestByExercise nimmt das beste 1RM', () => {
    const b = bestByExercise([set(1, 'a', 100, 1), set(1, 'a', 80, 10), set(1, 'a', 200, 1, { type: 'warmup' })])
    expect(b.get('a')?.weight).toBe(80) // 80×10 ≈ 106,7 > 100×1
  })
})
