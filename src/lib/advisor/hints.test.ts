import { describe, expect, it } from 'vitest'
import { computeHints, groupOf, repRangeFor, type HintInput } from './hints'
import { weekStart } from '../stats'
import type { Exercise, SetLog, Workout } from '../../types'

const DAY = 86400000
const NOW = new Date(2026, 9, 9, 12).getTime() // Fr 9.10.2026
const ex = (id: string, m: Exercise['primaryMuscles'][number]): [string, Exercise] => [id, { id, primaryMuscles: [m], secondaryMuscles: [] } as unknown as Exercise]
const exercises = new Map<string, Exercise>([ex('bench', 'chest'), ex('row', 'lats'), ex('squat', 'quadriceps')])

let nextId = 1
function session(daysAgo: number, rows: { id: string; sets: [number, number][] }[], target?: [number, number]): { w: Workout; s: SetLog[] } {
  const id = nextId++
  const start = NOW - daysAgo * DAY
  const w: Workout = {
    id, name: 't', startedAt: start, endedAt: start + 3600000,
    items: rows.map((r) => ({ exerciseId: r.id, restSec: 90, ...(target ? { targetReps: target[0], targetRepsMax: target[1] } : {}) })),
  }
  const s: SetLog[] = rows.flatMap((r) => r.sets.map(([weight, reps], i) => ({ workoutId: id, exerciseId: r.id, order: i, weight, reps, type: 'normal' as const, done: 1 as const })))
  return { w, s }
}
const input = (list: ReturnType<typeof session>[], level: HintInput['level'] = 'advanced'): HintInput => ({
  workouts: list.map((x) => x.w), sets: list.flatMap((x) => x.s), exercises, routines: [], level, now: NOW,
})

describe('groupOf', () => {
  it('ordnet Muskeln den Planungsgruppen zu', () => {
    expect(groupOf({ primaryMuscles: ['lats'] })).toBe('back')
    expect(groupOf({ primaryMuscles: ['quadriceps'] })).toBe('quads')
    expect(groupOf({ primaryMuscles: ['lower back'] })).toBe('core')
    expect(groupOf({ primaryMuscles: ['neck'] })).toBeNull()
  })
})

describe('Progression (doppelte Progression, Modul 9.3)', () => {
  it('oberes Ende des Bereichs erreicht → Gewicht +2,5 kg, Wiederholungen zurück auf unten', () => {
    const h = computeHints(input([session(3, [{ id: 'bench', sets: [[80, 12], [80, 12], [80, 12]] }], [8, 12])]))
    const p = h.find((x) => x.kind === 'progress')!
    expect(p.params).toMatchObject({ weight: 82.5, reps: 8, increase: 1 })
  })
  it('noch nicht am oberen Ende → gleiches Gewicht, eine Wiederholung mehr', () => {
    const h = computeHints(input([session(3, [{ id: 'bench', sets: [[80, 9], [80, 8], [80, 8]] }], [8, 12])]))
    expect(h.find((x) => x.kind === 'progress')!.params).toMatchObject({ weight: 80, reps: 9, increase: 0 })
  })
  it('Standard-Bereich 8–12, wenn keine Routine bekannt ist', () => {
    expect(repRangeFor('x', [], [])).toEqual([8, 12])
  })
  it('keine Hinweise für lange nicht trainierte Übungen', () => {
    expect(computeHints(input([session(40, [{ id: 'bench', sets: [[80, 12]] }])])).filter((h) => h.kind === 'progress')).toEqual([])
  })
})

describe('Plateau', () => {
  it('4 Einheiten ohne Verbesserung des 1RM in 6 Wochen', () => {
    const list = [30, 22, 14, 7].map((d) => session(d, [{ id: 'bench', sets: [[80, 8]] }]))
    expect(computeHints(input(list)).some((h) => h.kind === 'plateau' && h.exerciseId === 'bench')).toBe(true)
  })
  it('kein Plateau bei steigenden Leistungen', () => {
    const list = [30, 22, 14, 7].map((d, i) => session(d, [{ id: 'bench', sets: [[80 + i * 5, 8]] }]))
    expect(computeHints(input(list)).some((h) => h.kind === 'plateau')).toBe(false)
  })
})

describe('Volumen und Frequenz', () => {
  it('zu wenig Wochenvolumen für große Gruppe', () => {
    const list = [session(1, [{ id: 'bench', sets: [[60, 8], [60, 8]] }]), session(4, [{ id: 'squat', sets: [[100, 8], [100, 8]] }])]
    const h = computeHints(input(list))
    expect(h.some((x) => x.kind === 'volumeLow' && x.group === 'chest')).toBe(true)
  })
  it('ausreichendes Volumen erzeugt keinen Hinweis', () => {
    const sets: [number, number][] = Array.from({ length: 12 }, () => [60, 10])
    const list = [session(1, [{ id: 'bench', sets }]), session(4, [{ id: 'bench', sets: [[60, 10]] }])]
    expect(computeHints(input(list)).some((x) => x.kind === 'volumeLow' && x.group === 'chest')).toBe(false)
  })
  it('Frequenz < 1,5×/Woche wird gemeldet, ≥ 2× nicht', () => {
    const low = [session(2, [{ id: 'bench', sets: [[60, 8]] }, { id: 'squat', sets: [[60, 8]] }]), session(5, [{ id: 'squat', sets: [[60, 8]] }]), session(9, [{ id: 'squat', sets: [[60, 8]] }])]
    expect(computeHints(input(low)).some((x) => x.kind === 'frequencyLow' && x.group === 'chest')).toBe(true)
    const ok = [2, 5, 9, 12].map((d) => session(d, [{ id: 'bench', sets: [[60, 8]] }]))
    expect(computeHints(input(ok)).some((x) => x.kind === 'frequencyLow' && x.group === 'chest')).toBe(false)
  })
})

describe('Deload (Modul 9.3.1: Zyklus 4–5 Wochen)', () => {
  const weeks = (n: number, vol: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => session(i * 7 + 1, [{ id: 'bench', sets: [[vol(i), 10]] }]))
  it('nach 5 Trainingswochen ohne Entlastung', () => {
    const h = computeHints(input(weeks(6, () => 80)))
    expect(h.find((x) => x.kind === 'deload')?.params.weeks).toBeGreaterThanOrEqual(5)
  })
  it('kein Hinweis nach kurzer Serie', () => {
    expect(computeHints(input(weeks(3, () => 80))).some((x) => x.kind === 'deload')).toBe(false)
  })
  it('eine reduzierte Woche setzt den Zähler zurück', () => {
    // Woche 0 = aktuell … Woche 2 war leicht (Deload); davor 3 harte Wochen
    const list = weeks(7, (i) => (i === 2 ? 40 : 80))
    const h = computeHints(input(list))
    expect(h.some((x) => x.kind === 'deload')).toBe(false)
  })
  it('weekStart-Hilfsfunktion liegt am Montag', () => {
    expect(new Date(weekStart(NOW)).getDay()).toBe(1)
  })
})

describe('Sortierung', () => {
  it('Deload und Plateau vor einfachen Progressionshinweisen', () => {
    const list = Array.from({ length: 6 }, (_, i) => session(i * 7 + 1, [{ id: 'bench', sets: [[80, 8]] }]))
    const h = computeHints(input(list))
    expect(h[0].priority).toBeGreaterThanOrEqual(h[h.length - 1].priority)
    expect(h[0].kind).toBe('deload')
  })
  it('leeres Logbuch → keine Hinweise', () => {
    expect(computeHints(input([]))).toEqual([])
  })
})
