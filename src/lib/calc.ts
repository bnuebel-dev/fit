import type { SetLog } from '../types'

/** Geschätztes 1RM (Epley); bei einer Wiederholung ist es das Gewicht selbst. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Gewicht für eine Zielwiederholungszahl bei gegebenem 1RM. */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm
  return oneRm / (1 + reps / 30)
}

/** Prozentwerte des 1RM mit passender Wiederholungszahl (Tabelle). */
export function oneRmTable(oneRm: number): { percent: number; reps: number; weight: number }[] {
  const rows: { percent: number; reps: number; weight: number }[] = []
  for (let reps = 1; reps <= 12; reps++) {
    const weight = weightForReps(oneRm, reps)
    rows.push({ percent: Math.round((weight / oneRm) * 100), reps, weight })
  }
  return rows
}

export interface PlateResult {
  perSide: { plate: number; count: number }[]
  remainder: number
}

/** Scheiben pro Seite für ein Zielgewicht (Greedy, absteigend). */
export function plates(
  target: number,
  bar = 20,
  available = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
): PlateResult {
  let rest = Math.max(0, (target - bar) / 2)
  const perSide: PlateResult['perSide'] = []
  for (const plate of [...available].sort((a, b) => b - a)) {
    const count = Math.floor((rest + 1e-9) / plate)
    if (count > 0) {
      perSide.push({ plate, count })
      rest -= count * plate
    }
  }
  return { perSide, remainder: Math.round(rest * 2 * 1000) / 1000 }
}

export function setVolume(s: Pick<SetLog, 'weight' | 'reps' | 'done' | 'type'>): number {
  if (!s.done || s.type === 'warmup') return 0
  return s.weight * s.reps
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const LB_PER_KG = 2.2046226218

export function toDisplay(kg: number, units: 'kg' | 'lb'): number {
  const v = units === 'lb' ? kg * LB_PER_KG : kg
  return Math.round(v * 100) / 100
}

export function fromDisplay(value: number, units: 'kg' | 'lb'): number {
  return units === 'lb' ? value / LB_PER_KG : value
}

/** Doppelte Progression: alle Arbeitssätze im oberen Wdh-Bereich → Gewicht erhöhen. */
export function nextProgression(
  lastSets: { weight: number; reps: number }[],
  repRange: [number, number],
  step = 2.5,
): { weight: number; reps: number } | null {
  if (!lastSets.length) return null
  const weight = Math.max(...lastSets.map((s) => s.weight))
  const top = lastSets.filter((s) => s.weight === weight)
  if (top.every((s) => s.reps >= repRange[1])) return { weight: weight + step, reps: repRange[0] }
  const minReps = Math.min(...top.map((s) => s.reps))
  return { weight, reps: Math.min(repRange[1], minReps + 1) }
}
