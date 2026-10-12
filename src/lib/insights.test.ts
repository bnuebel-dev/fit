import { describe, expect, it } from 'vitest'
import { bodyKgAt, DEFAULT_BODY_KG, metForDensity, workoutKcal } from './calories'
import { monthGrid, weekStreak, weeklyCounts } from './streak'
import { warmupRamp } from './warmup'
import { healthPayload } from './healthConnect'
import { weekStart } from './stats'

const DAY = 86400000
const MON = new Date(2026, 9, 5, 10).getTime()
const done = (ts: number) => ({ startedAt: ts, endedAt: ts + 3600000 })

describe('Kalorien', () => {
  it('MET steigt mit der Satzdichte zwischen 3,5 und 6', () => {
    expect(metForDensity(0)).toBe(3.5)
    expect(metForDensity(0.2)).toBe(3.5)
    expect(metForDensity(0.35)).toBeCloseTo(4.75)
    expect(metForDensity(5)).toBe(6)
  })
  it('60 min, 80 kg, 12 Sätze (0,2/min) ≈ 3,5 MET → 280 kcal', () => {
    expect(workoutKcal(3600000, 12, 80)).toBe(280)
  })
  it('intensiver ist mehr, Dauer wird auf 3 h gedeckelt, 0 bei 0', () => {
    expect(workoutKcal(3600000, 30, 80)).toBeGreaterThan(workoutKcal(3600000, 12, 80))
    expect(workoutKcal(10 * 3600000, 10, 75)).toBe(workoutKcal(3 * 3600000, 10, 75))
    expect(workoutKcal(0, 0)).toBe(0)
  })
  it('Körpergewicht: letzter Eintrag davor, sonst erster, sonst Standard', () => {
    const body = [{ date: '2026-10-01', values: { weight: 80 } }, { date: '2026-10-20', values: { weight: 78 } }]
    expect(bodyKgAt(body, MON)).toBe(80)
    expect(bodyKgAt(body, new Date(2026, 9, 25).getTime())).toBe(78)
    expect(bodyKgAt(body, new Date(2026, 8, 1).getTime())).toBe(80)
    expect(bodyKgAt([], MON)).toBe(DEFAULT_BODY_KG)
  })
})

describe('Aufwärmrampe', () => {
  it('100 kg → 50 / 70 / 85 kg', () => expect(warmupRamp(100)).toEqual([{ weight: 50, reps: 8 }, { weight: 70, reps: 5 }, { weight: 85, reps: 3 }]))
  it('unter 20 kg keine Rampe, Gewichte immer unter dem Arbeitsgewicht und ohne Doppelte', () => {
    expect(warmupRamp(15)).toEqual([])
    for (const kg of [20, 22.5, 27.5, 40, 62.5, 140]) {
      const r = warmupRamp(kg)
      expect(r.every((x) => x.weight < kg)).toBe(true)
      expect(new Set(r.map((x) => x.weight)).size).toBe(r.length)
    }
  })
})

describe('Serie und Kalender', () => {
  it('zählt Wochen mit erreichtem Ziel rückwärts', () => {
    const w = [MON, MON + DAY, MON + 2 * DAY, MON - 7 * DAY, MON - 6 * DAY, MON - 5 * DAY, MON - 14 * DAY].map(done)
    const counts = weeklyCounts(w)
    expect(weekStreak(counts, 3, MON + 3 * DAY)).toBe(2) // aktuelle Woche (3) + letzte (3), davor nur 1
    expect(weekStreak(counts, 3, MON - 7 * DAY + 3 * DAY)).toBe(1)
  })
  it('die laufende, noch nicht erreichte Woche bricht die Serie nicht ab', () => {
    const counts = weeklyCounts([MON - 7 * DAY, MON - 6 * DAY, MON - 5 * DAY].map(done))
    expect(weekStreak(counts, 3, MON + DAY)).toBe(1)
  })
  it('laufende Einheiten zählen nicht, keine Einheiten → 0', () => {
    expect(weeklyCounts([{ startedAt: MON }]).size).toBe(0)
    expect(weekStreak(new Map(), 3, MON)).toBe(0)
  })
  it('weekStart ist Montag 0 Uhr', () => expect(new Date(weekStart(MON + 4 * DAY)).getDay()).toBe(1))
  it('monthGrid: Oktober 2026 beginnt am Donnerstag und hat 31 Tage', () => {
    const g = monthGrid(2026, 9)
    expect(g.every((r) => r.length === 7)).toBe(true)
    expect(g[0].indexOf(1)).toBe(3)
    expect(g.flat().filter(Boolean)).toHaveLength(31)
  })
})

describe('Health-Connect-Daten', () => {
  const w = { id: 7, name: 'Push', startedAt: MON, endedAt: MON + 3600000, items: [] }
  const s = (done: 0 | 1, type: 'normal' | 'warmup' = 'normal') => ({ workoutId: 7, exerciseId: 'a', order: 0, weight: 50, reps: 8, type, done })
  it('Zeitraum, Titel und geschätzte Kalorien (12 Arbeitssätze in 60 min bei 80 kg = 280)', () => {
    const sets = [...Array.from({ length: 12 }, () => s(1)), s(1, 'warmup'), s(0)]
    expect(healthPayload(w, sets, [{ date: '2026-10-01', values: { weight: 80 } }], 'Fit')).toEqual({ id: '7', title: 'Push', start: MON, end: MON + 3600000, kcal: 280 })
  })
  it('Ersatztitel, und nichts für laufende Einheiten', () => {
    expect(healthPayload({ ...w, name: '' }, [s(1)], [], 'Fit')?.title).toBe('Fit')
    expect(healthPayload({ ...w, endedAt: undefined }, [], [], 'Fit')).toBeNull()
    expect(healthPayload({ ...w, endedAt: w.startedAt }, [], [], 'Fit')).toBeNull()
  })
})
