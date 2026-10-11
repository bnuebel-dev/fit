import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createPlan, estimateMinutes, suggestWeekdays, templateFor, type Goal, type Level } from './planner'
import { allSlotIds, GROUP_SIZE, SLOTS } from './slots'
import type { Exercise, Muscle } from '../../types'

const exercises = JSON.parse(readFileSync(new URL('../../../public/data/exercises.json', import.meta.url), 'utf8')) as Exercise[]
const byId = new Map(exercises.map((e) => [e.id, e]))

const goals: Goal[] = ['strength', 'hypertrophy', 'endurance', 'general']
const levels: Level[] = ['beginner', 'advanced', 'pro', 'hobby']

describe('Slots', () => {
  it('alle Slot-Übungen existieren in der Datenbank', () => {
    expect(allSlotIds().filter((id) => !byId.has(id))).toEqual([])
  })
  const MAIN: Record<string, Muscle[]> = {
    chest: ['chest'], back: ['lats', 'middle back', 'traps', 'lower back'], shoulders: ['shoulders'], biceps: ['biceps'], triceps: ['triceps'],
    quads: ['quadriceps'], hams: ['hamstrings', 'glutes', 'lower back'], glutes: ['glutes', 'abductors', 'hamstrings', 'quadriceps'],
    calves: ['calves'], core: ['abdominals', 'lower back'],
  }
  it('Slot-Übungen trainieren den passenden Muskel (Haupt- oder Hilfsmuskel)', () => {
    const bad: string[] = []
    for (const [g, slots] of Object.entries(SLOTS)) {
      for (const s of slots) for (const id of [s.machine?.id, s.free?.id]) {
        if (!id) continue
        const e = byId.get(id)!
        const muscles = [...e.primaryMuscles, ...e.secondaryMuscles]
        if (!muscles.some((m) => MAIN[g].includes(m))) bad.push(`${g}: ${id} (${muscles.join(',')})`)
      }
    }
    expect(bad).toEqual([])
  })
  it('Rolle passt zur Übung: Isolation = eingelenkig/„isolation“, Grundübung = mehrgelenkig – wo die Datenbank das angibt', () => {
    const bad: string[] = []
    for (const s of Object.values(SLOTS).flat()) for (const v of [s.machine, s.free]) {
      if (!v) continue
      const mech = byId.get(v.id)!.mechanic
      if (mech && ((v.role === 'compound' && mech === 'isolation') || (v.role === 'isolation' && mech === 'compound'))) bad.push(`${v.id}: ${v.role} vs ${mech}`)
    }
    expect(bad).toEqual([])
  })
  it('Gerätevarianten sind tatsächlich Geräte/Kabel, wo angegeben', () => {
    const notMachine = Object.values(SLOTS).flat().filter((s) => s.machine && !byId.get(s.machine.id)!.machine).map((s) => s.machine!.id)
    expect(notMachine).toEqual([])
  })
})

describe('Split nach Trainingstagen (Modul 9.1.2)', () => {
  it('Tage → Split', () => {
    expect(templateFor(1).split).toBe('single')
    expect(templateFor(2).split).toBe('fullbody')
    expect(templateFor(3).split).toBe('fullbody')
    expect(templateFor(4).split).toBe('upperlower')
    expect(templateFor(5).split).toBe('ppl5')
    expect(templateFor(6).split).toBe('ppl6')
    expect(templateFor(99).template).toHaveLength(6)
  })
  it('jede große Muskelgruppe wird bei ≥ 2 Tagen mindestens 2× pro Woche trainiert (außer 3er-Split mit 5 Tagen: ≥ 2)', () => {
    for (let d = 2; d <= 6; d++) {
      const p = createPlan({ goal: 'hypertrophy', level: 'advanced', days: d, minutes: 75, machines: false })
      for (const g of ['chest', 'back', 'quads', 'hams'] as const) expect(p.frequency[g], `${d} Tage ${g}`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('createPlan', () => {
  for (const goal of goals) for (const level of levels) for (let days = 1; days <= 6; days++) {
    it(`${goal}/${level}/${days} Tage ist gültig`, () => {
      const p = createPlan({ goal, level, days, minutes: 60, machines: level === 'beginner' || level === 'hobby' })
      expect(p.sessions).toHaveLength(days)
      for (const s of p.sessions) {
        const ids = s.items.map((i) => i.exerciseId)
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of ids) expect(byId.has(id), id).toBe(true)
        // Grundübungen vor Isolationsübungen
        const firstIso = s.items.findIndex((i) => i.role === 'isolation')
        if (firstIso >= 0) expect(s.items.slice(firstIso).every((i) => i.role === 'isolation')).toBe(true)
        for (const i of s.items) {
          expect(i.sets).toBeGreaterThanOrEqual(2)
          expect(i.sets).toBeLessThanOrEqual(5)
          expect(i.repsMin).toBeLessThan(i.repsMax)
          expect(i.restSec).toBeGreaterThanOrEqual(60)
        }
        expect(s.estMinutes).toBeLessThanOrEqual(65)
        expect(s.items.length).toBeLessThanOrEqual(8)
      }
    })
  }

  it('Wiederholungsbereiche folgen dem Ziel (Kraft 1–6, Hypertrophie 6–12, Kraftausdauer 13–30)', () => {
    const comp = (goal: Goal) => createPlan({ goal, level: 'advanced', days: 3, minutes: 75, machines: false }).sessions[0].items.find((i) => i.role === 'compound')!
    expect(comp('strength').repsMax).toBeLessThanOrEqual(6)
    expect(comp('hypertrophy').repsMin).toBeGreaterThanOrEqual(6)
    expect(comp('hypertrophy').repsMax).toBeLessThanOrEqual(12)
    expect(comp('endurance').repsMin).toBeGreaterThanOrEqual(13)
  })

  it('Pausen: schwer 3–5 Min., Isolation 1–2 Min.', () => {
    const p = createPlan({ goal: 'strength', level: 'advanced', days: 3, minutes: 90, machines: false })
    for (const i of p.sessions.flatMap((s) => s.items)) {
      if (i.repsMax <= 6) expect(i.restSec).toBeGreaterThanOrEqual(180)
      if (i.role === 'isolation' && i.repsMax >= 8) expect(i.restSec).toBeLessThanOrEqual(120)
    }
  })

  it('Einsteiger bekommen Geräteübungen, Fortgeschrittene freie Grundübungen', () => {
    const beg = createPlan({ goal: 'hypertrophy', level: 'beginner', days: 3, minutes: 60, machines: true })
    const adv = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 3, minutes: 60, machines: false })
    expect(beg.sessions[0].items.some((i) => i.exerciseId === 'Leg_Press')).toBe(true)
    expect(adv.sessions[0].items.some((i) => i.exerciseId === 'Barbell_Squat')).toBe(true)
    expect(adv.sessions[0].items.some((i) => i.exerciseId === 'Barbell_Bench_Press_-_Medium_Grip')).toBe(true)
  })

  it('Zeitbudget wird eingehalten, kürzere Einheiten haben weniger Übungen', () => {
    const long = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 3, minutes: 90, machines: false })
    const short = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 3, minutes: 40, machines: false })
    expect(short.sessions[0].estMinutes).toBeLessThanOrEqual(45)
    expect(short.sessions[0].items.length).toBeLessThan(long.sessions[0].items.length)
  })

  it('A/B-Einheiten unterscheiden sich in der Übungsauswahl', () => {
    const p = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 4, minutes: 75, machines: false })
    const a = p.sessions[0].items.map((i) => i.exerciseId).join()
    const b = p.sessions[2].items.map((i) => i.exerciseId).join()
    expect(a).not.toBe(b)
    expect(p.sessions.map((s) => s.label)).toEqual(['A', 'A', 'B', 'B'])
  })

  it('Wochenvolumen liegt für große Gruppen im Rahmen der Empfehlung (Hobby ≥ 60)', () => {
    const p = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 4, minutes: 90, machines: false })
    for (const g of Object.keys(p.weekly) as (keyof typeof p.weekly)[]) {
      if (GROUP_SIZE[g!] === 'big') expect(p.weekly[g]!, g).toBeGreaterThanOrEqual(40)
      expect(p.weekly[g]!, g).toBeLessThanOrEqual(260)
    }
  })

  it('Warnungen: 1 Tag/Woche und sehr kurze Einheiten', () => {
    expect(createPlan({ goal: 'general', level: 'hobby', days: 1, minutes: 60, machines: true }).warnings.map((w) => w.key)).toContain('warn.frequency')
    expect(createPlan({ goal: 'general', level: 'hobby', days: 3, minutes: 30, machines: true }).warnings.map((w) => w.key)).toContain('warn.short')
  })

  it('Begründungen enthalten die Pyramide (Beständigkeit, Volumen, Pausen, Deload)', () => {
    const keys = createPlan({ goal: 'hypertrophy', level: 'advanced', days: 4, minutes: 60, machines: false }).reasons.map((r) => r.key)
    for (const k of ['consistency', 'volume', 'rest', 'deload', 'split.upperlower']) expect(keys).toContain(k)
  })

  it('estimateMinutes', () => {
    expect(estimateMinutes([])).toBe(8)
    expect(estimateMinutes([{ sets: 3, restSec: 135 }])).toBe(17)
  })
})

describe('suggestWeekdays', () => {
  it('liefert pro Tag einen Wochentag, aufsteigend und ohne Doppelungen', () => {
    for (let d = 1; d <= 6; d++) {
      const w = suggestWeekdays(d)
      expect(w).toHaveLength(d)
      expect(new Set(w).size).toBe(d)
      expect([...w].sort((a, b) => a - b)).toEqual(w)
      expect(w.every((x) => x >= 1 && x <= 7)).toBe(true)
    }
  })
  it('bei 2 und 3 Tagen liegt mindestens ein Ruhetag dazwischen (Ganzkörper braucht 48 h)', () => {
    for (const d of [2, 3]) {
      const w = suggestWeekdays(d)
      for (let i = 1; i < w.length; i++) expect(w[i] - w[i - 1]).toBeGreaterThanOrEqual(2)
    }
  })
})
