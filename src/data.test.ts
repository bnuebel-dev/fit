import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MUSCLES, type Exercise } from './types'
import { allSlotIds } from './lib/advisor/slots'

const load = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as T
const exercises = load<Exercise[]>('../public/data/exercises.json')
const coverage = load<{ term: string; id: string; core: boolean; source: string }[]>('../data/pdf-coverage.json')
const byId = new Map(exercises.map((e) => [e.id, e]))

describe('Übungsdaten', () => {
  it('IDs sind eindeutig', () => {
    expect(byId.size).toBe(exercises.length)
  })
  it('jede Übung hat deutschen Namen, Hauptmuskel und gültige Muskelnamen', () => {
    for (const e of exercises) {
      expect(e.name.de, e.id).toBeTruthy()
      expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0)
      for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) expect(MUSCLES, `${e.id}: ${m}`).toContain(m)
    }
  })
  it('Bilder-Pfade zeigen auf dieselbe Übung (free-exercise-db)', () => {
    for (const e of exercises.filter((x) => x.source === 'fedb' && x.images.length)) expect(e.images[0].startsWith(`${e.id}/`), e.id).toBe(true)
  })
})

describe('Abdeckung nach den Trainer-Skripten', () => {
  it('jede in den PDFs genannte Übung/jedes Gerät ist vorhanden', () => {
    const missing = coverage.filter((c) => !byId.has(c.id)).map((c) => c.term)
    expect(missing).toEqual([])
  })
  it('Grundübungen sind als core markiert', () => {
    for (const c of coverage.filter((x) => x.core)) expect(byId.get(c.id)?.core, c.term).toBe(1)
    expect(coverage.filter((c) => c.core).length).toBeGreaterThanOrEqual(20)
  })
  it('jeder Muskel hat mindestens eine Geräte- und eine Freihantel-/Körpergewichtsübung', () => {
    const gaps: string[] = []
    for (const m of MUSCLES) {
      const s = exercises.filter((e) => e.category === 'strength' && e.primaryMuscles.includes(m))
      if (!s.some((e) => e.machine)) gaps.push(`${m}: kein Gerät`)
      if (!s.some((e) => !e.machine)) gaps.push(`${m}: keine Freihantel`)
    }
    expect(gaps).toEqual([])
  })
  it('Kernmuskeln aus Modul 6 haben mehrere Geräteübungen', () => {
    for (const m of ['chest', 'lats', 'quadriceps', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'abdominals', 'calves']) {
      const n = exercises.filter((e) => e.category === 'strength' && e.machine && e.primaryMuscles.includes(m as never)).length
      expect(n, m).toBeGreaterThanOrEqual(3)
    }
  })

  it('alle Grundübungen und alle vom Planer genutzten Übungen haben eine deutsche Anleitung', () => {
    const ids = new Set([...coverage.map((c) => c.id), ...allSlotIds()])
    const missing = [...ids].filter((id) => !byId.get(id)?.instructions.de?.length)
    expect(missing).toEqual([])
  })
})
