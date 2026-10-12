import { Capacitor, registerPlugin } from '@capacitor/core'
import { db } from '../db'
import { bodyKgAt, workoutKcal } from './calories'
import { loadSettings } from './settings'
import type { SetLog, Workout, BodyEntry } from '../types'

export type Availability = 'available' | 'update-required' | 'unavailable'

interface FitHealthPlugin {
  status(): Promise<{ availability: Availability; granted: boolean }>
  requestPermissions(): Promise<{ granted: boolean }>
  writeWorkout(o: { id: string; title: string; start: number; end: number; kcal: number }): Promise<void>
  openSettings(): Promise<void>
}

/** Nur in der Android-App vorhanden (eigenes Capacitor-Plugin), im Browser gibt es kein Health Connect. */
export const FitHealth = registerPlugin<FitHealthPlugin>('FitHealth')
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

export interface HealthPayload { id: string; title: string; start: number; end: number; kcal: number }

/** Daten für Health Connect: Zeitraum, Titel und die geschätzten aktiven Kalorien (siehe lib/calories). */
export function healthPayload(w: Workout, sets: SetLog[], body: BodyEntry[], fallbackTitle: string): HealthPayload | null {
  if (w.id === undefined || w.endedAt === undefined || w.endedAt <= w.startedAt) return null
  const working = sets.filter((s) => s.workoutId === w.id && s.done && s.type !== 'warmup').length
  return {
    id: String(w.id),
    title: w.name || fallbackTitle,
    start: w.startedAt,
    end: w.endedAt,
    kcal: workoutKcal(w.endedAt - w.startedAt, working, bodyKgAt(body, w.startedAt)),
  }
}

/** Sendet ein abgeschlossenes Training an Health Connect. Gibt false zurück, wenn es nichts zu senden gab oder die Sync aus ist. */
export async function syncWorkout(workoutId: number, opts: { force?: boolean } = {}): Promise<boolean> {
  if (!isNativeApp()) return false
  if (!opts.force && !(await loadSettings()).healthSync) return false
  const w = await db.workouts.get(workoutId)
  if (!w) return false
  const payload = healthPayload(w, await db.sets.where('workoutId').equals(workoutId).toArray(), await db.body.toArray(), 'Fit')
  if (!payload) return false
  await FitHealth.writeWorkout(payload)
  return true
}

/** Sendet alle abgeschlossenen Trainings der letzten `days` Tage erneut (aktualisiert statt zu verdoppeln). */
export async function syncRecent(days: number): Promise<number> {
  const since = Date.now() - days * 86400000
  const list = (await db.workouts.where('startedAt').aboveOrEqual(since).toArray()).filter((w) => w.endedAt !== undefined)
  let n = 0
  for (const w of list) if (await syncWorkout(w.id!, { force: true })) n++
  return n
}

export interface SyncStatus { at: number; ok: boolean; error?: string }

/** Nach dem Beenden eines Trainings: senden und das Ergebnis für die Einstellungen merken. Wirft nie. */
export async function syncAfterFinish(workoutId: number): Promise<void> {
  try {
    if (await syncWorkout(workoutId)) await db.kv.put({ key: 'healthSyncStatus', value: { at: Date.now(), ok: true } satisfies SyncStatus })
  } catch (e) {
    await db.kv.put({ key: 'healthSyncStatus', value: { at: Date.now(), ok: false, error: e instanceof Error ? e.message : String(e) } satisfies SyncStatus })
  }
}
