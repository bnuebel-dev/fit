import { weekStart } from './stats'
import type { Workout } from '../types'

const WEEK = 7 * 86400000

export function weeklyCounts(workouts: Pick<Workout, 'startedAt' | 'endedAt'>[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const w of workouts) {
    if (w.endedAt === undefined) continue
    const ws = weekStart(w.startedAt)
    map.set(ws, (map.get(ws) ?? 0) + 1)
  }
  return map
}

/** Wochen in Folge, in denen das Wochenziel erreicht wurde. Die laufende Woche zählt, sobald sie erreicht ist, bricht die Serie aber nicht ab. */
export function weekStreak(counts: Map<number, number>, goal: number, now: number): number {
  let ws = weekStart(now)
  let n = 0
  if ((counts.get(ws) ?? 0) >= goal) n++
  ws = weekStart(ws - 1)
  while ((counts.get(ws) ?? 0) >= goal) { n++; ws = weekStart(ws - 1) }
  return n
}

/** Wochenanfänge ab einem Zeitpunkt, hilfreich für Diagramme. */
export function weeksBack(now: number, n: number): number[] {
  const first = weekStart(now)
  return Array.from({ length: n }, (_, i) => weekStart(first - (n - 1 - i) * WEEK + 3600000))
}

export const dayKey = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Raster für einen Monat: Wochen beginnen am Montag, leere Zellen als null. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7))
}
