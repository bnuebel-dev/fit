// Regelbasierter Trainingsplaner (Advisor Stufe 1), nach Modul 9 der Trainer-Unterlagen
// (Muscle and Strength Pyramid): Beständigkeit → Volumen/Intensität/Frequenz → Progression →
// Übungsauswahl → Pausen → Kadenz.
import { GROUP_SIZE, SLOTS, pickVariant, type Group, type Role } from './slots'

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general'
export type Level = 'beginner' | 'advanced' | 'pro' | 'hobby'
export type SplitType = 'single' | 'fullbody' | 'upperlower' | 'ppl5' | 'ppl6'

export interface PlanInput {
  goal: Goal
  level: Level
  /** Trainingstage pro Woche (1–6) */
  days: number
  /** verfügbare Minuten pro Einheit */
  minutes: number
  /** Geräteübungen bevorzugen (Einstieg) statt Freihantel */
  machines: boolean
}

export interface PlanItem {
  exerciseId: string
  group: Group
  role: Role
  sets: number
  repsMin: number
  repsMax: number
  restSec: number
}

export interface PlanSession {
  /** Schlüssel für die Benennung, z. B. "fullbody", "upper", "push" */
  kind: 'fullbody' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'
  /** Buchstabe zur Unterscheidung gleicher Einheiten (A, B, C) */
  label: string
  items: PlanItem[]
  estMinutes: number
}

export interface Reason {
  key: string
  params?: Record<string, string | number>
}

export interface Plan {
  input: PlanInput
  split: SplitType
  sessions: PlanSession[]
  /** Wiederholungen pro Woche je Muskelgruppe (Mittelwert des Wdh-Bereichs) */
  weekly: Partial<Record<Group, number>>
  /** wie oft pro Woche trainiert wird */
  frequency: Partial<Record<Group, number>>
  reasons: Reason[]
  warnings: Reason[]
}

const VOLUME: Record<Level, { big: [number, number]; small: [number, number]; weekly: [number, number] }> = {
  beginner: { big: [40, 50], small: [20, 30], weekly: [80, 150] },
  advanced: { big: [50, 60], small: [30, 40], weekly: [100, 180] },
  pro: { big: [70, 80], small: [40, 50], weekly: [140, 210] },
  hobby: { big: [30, 50], small: [20, 35], weekly: [60, 150] },
}

const REP_RANGE: Record<Goal, Record<Role, [number, number]>> = {
  strength: { compound: [3, 6], isolation: [8, 12] },
  hypertrophy: { compound: [6, 10], isolation: [10, 15] },
  endurance: { compound: [13, 20], isolation: [15, 25] },
  general: { compound: [8, 12], isolation: [10, 15] },
}

type Template = { kind: PlanSession['kind']; groups: Group[] }[]

const FB = (small: Group[]): Template[number] => ({ kind: 'fullbody', groups: ['chest', 'back', 'quads', 'hams', ...small] })
const UPPER: Template[number] = { kind: 'upper', groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'] }
const LOWER: Template[number] = { kind: 'lower', groups: ['quads', 'hams', 'glutes', 'calves', 'core'] }
const PUSH: Template[number] = { kind: 'push', groups: ['chest', 'shoulders', 'triceps'] }
const PULL: Template[number] = { kind: 'pull', groups: ['back', 'biceps', 'core'] }
const LEGS: Template[number] = { kind: 'legs', groups: ['quads', 'hams', 'glutes', 'calves'] }

export function templateFor(days: number): { split: SplitType; template: Template } {
  switch (Math.min(6, Math.max(1, Math.round(days)))) {
    case 1: return { split: 'single', template: [FB(['shoulders', 'biceps', 'triceps', 'core'])] }
    case 2: return { split: 'fullbody', template: [FB(['shoulders', 'biceps', 'core']), FB(['shoulders', 'triceps', 'calves'])] }
    case 3: return { split: 'fullbody', template: [FB(['shoulders', 'biceps', 'core']), FB(['triceps', 'calves', 'glutes']), FB(['shoulders', 'biceps', 'triceps'])] }
    case 4: return { split: 'upperlower', template: [UPPER, LOWER, UPPER, LOWER] }
    case 5: return { split: 'ppl5', template: [PUSH, PULL, LEGS, UPPER, LOWER] }
    default: return { split: 'ppl6', template: [PUSH, PULL, LEGS, PUSH, PULL, LEGS] }
  }
}

const GROUP_ORDER: Group[] = ['chest', 'back', 'quads', 'hams', 'glutes', 'shoulders', 'biceps', 'triceps', 'calves', 'core']
const mid = ([a, b]: [number, number]) => (a + b) / 2
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function restFor(role: Role, repsMax: number, goal: Goal): number {
  if (goal === 'endurance') return 60
  if (repsMax <= 6) return 240 // intensive Übungen (1–6 Wdh.): 3–5 Minuten
  if (role === 'compound' && repsMax <= 10) return 150
  return 90 // moderate Isolationsübungen (8–15 Wdh.): 1–2 Minuten
}

export const estimateMinutes = (items: Pick<PlanItem, 'sets' | 'restSec'>[]): number =>
  Math.round(8 + items.reduce((a, i) => a + (i.sets * (i.restSec + 45)) / 60, 0)) // 8 Min. Aufwärmen

/** Höchstzahl Übungen je Gruppe und Einheit */
const MAX_PER_GROUP: Partial<Record<Group, number>> = { core: 1, calves: 1 }
/** Höchstzahl Übungen je Einheit (sonst wird es unübersichtlich) */
const MAX_ITEMS = 8
/** Reihenfolge beim Kürzen: vorn = zuerst streichen. Rücken zuletzt, damit Zug ≥ Druck bleibt. */
const DROP_ORDER: Group[] = ['core', 'calves', 'biceps', 'triceps', 'shoulders', 'glutes', 'chest', 'hams', 'quads', 'back']

export function createPlan(input: PlanInput): Plan {
  const days = Math.min(6, Math.max(1, Math.round(input.days)))
  const { split, template } = templateFor(days)
  const vol = VOLUME[input.level]

  const freq: Partial<Record<Group, number>> = {}
  for (const s of template) for (const g of s.groups) freq[g] = (freq[g] ?? 0) + 1

  const occurrence: Partial<Record<Group, number>> = {}
  const sessions: PlanSession[] = []
  const letterCount: Partial<Record<PlanSession['kind'], number>> = {}
  const kindTotal: Partial<Record<PlanSession['kind'], number>> = {}
  for (const s of template) kindTotal[s.kind] = (kindTotal[s.kind] ?? 0) + 1

  for (const s of template) {
    const items: PlanItem[] = []
    for (const g of s.groups) {
      const size = GROUP_SIZE[g]
      const f = freq[g]!
      const weeklyTarget = size === 'big' ? mid(vol.weekly) : mid(vol.weekly) * 0.6
      const range = size === 'big' ? vol.big : vol.small
      const perSession = clamp(weeklyTarget / f, range[0], range[1])
      const pool = SLOTS[g]
      const n = Math.min(pool.length, MAX_PER_GROUP[g] ?? 2, perSession >= (size === 'big' ? 36 : 28) ? 2 : 1)
      const k = occurrence[g] ?? 0
      occurrence[g] = k + 1
      // an Folgetagen andere Übungen wählen (Abwechslung, Modul 9.4)
      const start = pool.length >= 2 * n ? (k * n) % pool.length : k % pool.length
      for (let i = 0; i < n; i++) {
        const v = pickVariant(pool[(start + i) % pool.length], input.machines)
        const [lo, hi] = REP_RANGE[input.goal][v.role]
        const sets = clamp(Math.round(perSession / n / ((lo + hi) / 2)), 2, 5)
        items.push({ exerciseId: v.id, group: g, role: v.role, sets, repsMin: lo, repsMax: hi, restSec: restFor(v.role, hi, input.goal) })
      }
    }
    // schwere Grundübungen zuerst, Isolation am Ende (Modul 9)
    items.sort((a, b) =>
      (a.role === 'compound' ? 0 : 1) - (b.role === 'compound' ? 0 : 1) ||
      (GROUP_SIZE[a.group] === 'big' ? 0 : 1) - (GROUP_SIZE[b.group] === 'big' ? 0 : 1) ||
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
    // doppelte Übungen innerhalb einer Einheit entfernen (z. B. zweimal Wadenheben stehend)
    const seen = new Set<string>()
    const unique = items.filter((i) => (seen.has(i.exerciseId) ? false : (seen.add(i.exerciseId), true)))

    // Zeitbudget und Übungsmaximum einhalten: zuerst Zusatzübungen streichen (Reihenfolge DROP_ORDER), dann Sätze kürzen
    const budget = Math.max(20, input.minutes)
    const trimmed = [...unique]
    const dropIndex = (): number => {
      const count = new Map<Group, number>()
      for (const i of trimmed) count.set(i.group, (count.get(i.group) ?? 0) + 1)
      const extras = trimmed.map((i, idx) => ({ i, idx })).filter(({ i }) => (count.get(i.group) ?? 0) > 1)
      const pool = extras.length ? extras : trimmed.map((i, idx) => ({ i, idx })).filter(({ i }) => GROUP_SIZE[i.group] === 'small')
      if (!pool.length) return -1
      pool.sort((a, b) => DROP_ORDER.indexOf(a.i.group) - DROP_ORDER.indexOf(b.i.group) || b.idx - a.idx)
      return pool[0].idx
    }
    while (trimmed.length > MAX_ITEMS || estimateMinutes(trimmed) > budget) {
      const idx = dropIndex()
      if (idx < 0) break
      trimmed.splice(idx, 1)
    }
    while (estimateMinutes(trimmed) > budget) {
      const biggest = trimmed.filter((i) => i.sets > 2).sort((a, b) => b.sets - a.sets)[0]
      if (!biggest) break
      biggest.sets -= 1
    }

    const letter = kindTotal[s.kind]! > 1 ? String.fromCharCode(65 + (letterCount[s.kind] ?? 0)) : ''
    letterCount[s.kind] = (letterCount[s.kind] ?? 0) + 1
    sessions.push({ kind: s.kind, label: letter, items: trimmed, estMinutes: estimateMinutes(trimmed) })
  }

  const weekly: Plan['weekly'] = {}
  for (const sess of sessions) for (const i of sess.items) weekly[i.group] = (weekly[i.group] ?? 0) + Math.round(i.sets * (i.repsMin + i.repsMax) / 2)

  const [rLo, rHi] = [REP_RANGE[input.goal].compound[0], REP_RANGE[input.goal].isolation[1]]
  const reasons: Reason[] = [
    { key: 'consistency' },
    { key: `split.${split}`, params: { days } },
    { key: 'volume', params: { lo: vol.weekly[0], hi: vol.weekly[1] } },
    { key: `intensity.${input.goal}`, params: { lo: rLo, hi: rHi } },
    { key: 'order' },
    { key: input.machines ? 'selection.machines' : 'selection.free' },
    { key: input.level === 'beginner' || input.level === 'hobby' ? 'progression.linear' : 'progression.double' },
    { key: 'rest' },
    { key: input.level === 'beginner' ? 'tempo.beginner' : 'tempo.standard' },
    { key: 'deload' },
  ]
  const warnings: Reason[] = []
  if (days < 2) warnings.push({ key: 'warn.frequency' })
  for (const s of sessions) if (s.estMinutes > Math.max(20, input.minutes) + 5) warnings.push({ key: 'warn.time', params: { min: s.estMinutes } })
  if (input.minutes < 40) warnings.push({ key: 'warn.short' })

  return { input: { ...input, days }, split, sessions, weekly, frequency: freq, reasons, warnings }
}

/** Verteilt die Trainingstage mit möglichst viel Erholung dazwischen (Montag = 1 … Sonntag = 7). */
export function suggestWeekdays(days: number): number[] {
  switch (Math.min(6, Math.max(1, Math.round(days)))) {
    case 1: return [1]
    case 2: return [1, 4]
    case 3: return [1, 3, 5]
    case 4: return [1, 2, 4, 5]
    case 5: return [1, 2, 3, 4, 5]
    default: return [1, 2, 3, 4, 5, 6]
  }
}
