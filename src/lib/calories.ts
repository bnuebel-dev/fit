import type { BodyEntry } from '../types'

/** Annahme, solange noch kein Körpergewicht eingetragen ist. */
export const DEFAULT_BODY_KG = 75

/**
 * MET-Wert für Krafttraining nach der Dichte der Arbeitssätze (Sätze pro Minute).
 * Der Compendium of Physical Activities nennt 3,5 MET für leichtes bis mäßiges und 6,0 MET für intensives Krafttraining.
 */
export function metForDensity(setsPerMinute: number): number {
  const t = Math.min(1, Math.max(0, (setsPerMinute - 0.2) / 0.3))
  return 3.5 + t * 2.5
}

/** Geschätzter Gesamtverbrauch einer Einheit in kcal (grobe Schätzung, kein Messwert). */
export function workoutKcal(durationMs: number, workingSets: number, bodyKg: number = DEFAULT_BODY_KG): number {
  const hours = Math.min(durationMs, 3 * 3600000) / 3600000
  if (hours <= 0) return 0
  const met = metForDensity(workingSets / (hours * 60))
  return Math.round(met * bodyKg * hours)
}

/** Körpergewicht am Tag: letzter Eintrag bis dahin, sonst der erste spätere, sonst Standard. */
export function bodyKgAt(entries: BodyEntry[], ts: number): number {
  const day = new Date(ts)
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  const withWeight = entries.filter((e) => e.values.weight).sort((a, b) => a.date.localeCompare(b.date))
  if (!withWeight.length) return DEFAULT_BODY_KG
  const before = withWeight.filter((e) => e.date <= iso)
  return (before.length ? before[before.length - 1] : withWeight[0]).values.weight
}
