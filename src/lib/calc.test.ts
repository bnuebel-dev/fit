import { describe, expect, it } from 'vitest'
import { e1rm, fromDisplay, nextProgression, oneRmTable, plates, setVolume, toDisplay, weightForReps } from './calc'

describe('calc', () => {
  it('e1rm: eine Wiederholung ist das Gewicht', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(80, 8)).toBeCloseTo(101.33, 1)
    expect(e1rm(0, 5)).toBe(0)
  })
  it('weightForReps ist die Umkehrung', () => {
    const rm = e1rm(80, 8)
    expect(weightForReps(rm, 8)).toBeCloseTo(80, 5)
  })
  it('oneRmTable hat 12 Zeilen und fällt', () => {
    const t = oneRmTable(100)
    expect(t).toHaveLength(12)
    expect(t[0].weight).toBe(100)
    expect(t[11].weight).toBeLessThan(t[0].weight)
  })
  it('plates: 85 kg = 20 + 10 + 2,5 pro Seite (ohne 25er)', () => {
    const r = plates(85, 20, [20, 10, 5, 2.5, 1.25])
    expect(r.perSide).toEqual([
      { plate: 20, count: 1 },
      { plate: 10, count: 1 },
      { plate: 2.5, count: 1 },
    ])
    expect(r.remainder).toBe(0)
  })
  it('plates: mit 25er-Scheibe nimmt die größte zuerst', () => {
    expect(plates(85).perSide).toEqual([
      { plate: 25, count: 1 },
      { plate: 5, count: 1 },
      { plate: 2.5, count: 1 },
    ])
  })
  it('plates: Rest wird gemeldet', () => {
    expect(plates(21).remainder).toBeCloseTo(0, 5) // 0,5 kg pro Seite
    expect(plates(20.3).remainder).toBeGreaterThan(0)
  })
  it('setVolume zählt nur erledigte Arbeitssätze', () => {
    expect(setVolume({ weight: 80, reps: 8, done: 1, type: 'normal' })).toBe(640)
    expect(setVolume({ weight: 80, reps: 8, done: 0, type: 'normal' })).toBe(0)
    expect(setVolume({ weight: 40, reps: 8, done: 1, type: 'warmup' })).toBe(0)
  })
  it('Einheiten rechnen hin und zurück', () => {
    expect(fromDisplay(toDisplay(100, 'lb'), 'lb')).toBeCloseTo(100, 1)
    expect(toDisplay(100, 'kg')).toBe(100)
  })
  it('Doppelte Progression', () => {
    expect(nextProgression([], [8, 12])).toBeNull()
    expect(nextProgression([{ weight: 60, reps: 12 }, { weight: 60, reps: 12 }], [8, 12])).toEqual({ weight: 62.5, reps: 8 })
    expect(nextProgression([{ weight: 60, reps: 9 }, { weight: 60, reps: 8 }], [8, 12])).toEqual({ weight: 60, reps: 9 })
  })
})
