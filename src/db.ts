import Dexie, { type EntityTable } from 'dexie'
import type { BodyEntry, Exercise, Routine, SetLog, Workout } from './types'

export interface KV {
  key: string
  value: unknown
}

class FitDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  body!: EntityTable<BodyEntry, 'id'>
  kv!: EntityTable<KV, 'key'>

  constructor(name = 'fit') {
    super(name)
    this.version(1).stores({
      exercises: 'id, source, category, machine, favorite, *primaryMuscles, *equipment',
      routines: '++id, order',
      workouts: '++id, startedAt, endedAt, routineId',
      sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
      body: '++id, date',
      kv: 'key',
    })
  }
}

export const db = new FitDB()

/** Übungsdaten aus /data/exercises.json in IndexedDB laden (nur bei Änderung). Favoriten bleiben erhalten. */
export async function seedExercises(fetchText: () => Promise<string> = defaultFetch): Promise<number> {
  const text = await fetchText()
  const signature = `${text.length}:${text.slice(0, 64)}:${text.slice(-64)}`
  const current = (await db.kv.get('exercisesSignature'))?.value
  if (current === signature && (await db.exercises.count()) > 0) return 0
  const list = JSON.parse(text) as Exercise[]
  const old = await db.exercises.toArray()
  const favorites = new Set(old.filter((e) => e.favorite).map((e) => e.id))
  const fileIds = new Set(list.map((e) => e.id))
  await db.transaction('rw', db.exercises, db.kv, async () => {
    // Einträge aus früheren Dateiständen, die es nicht mehr gibt, entfernen (eigene 'u-…' bleiben)
    const stale = old.filter((e) => !fileIds.has(e.id) && e.source !== 'custom').map((e) => e.id)
    if (stale.length) await db.exercises.bulkDelete(stale)
    await db.exercises.bulkPut(list.map((e) => ({ ...e, favorite: favorites.has(e.id) ? 1 : 0 })))
    await db.kv.put({ key: 'exercisesSignature', value: signature })
  })
  return list.length
}

async function defaultFetch(): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
  if (!res.ok) throw new Error(`exercises.json: ${res.status}`)
  return res.text()
}

export interface BackupFile {
  app: 'fit'
  version: 1
  exportedAt: string
  routines: Routine[]
  workouts: Workout[]
  sets: SetLog[]
  body: BodyEntry[]
  customExercises: Exercise[]
  favorites: string[]
  settings: unknown
}

export async function exportBackup(): Promise<BackupFile> {
  const [routines, workouts, sets, body, exercises, settings] = await Promise.all([
    db.routines.toArray(),
    db.workouts.toArray(),
    db.sets.toArray(),
    db.body.toArray(),
    db.exercises.toArray(),
    db.kv.get('settings'),
  ])
  return {
    app: 'fit',
    version: 1,
    exportedAt: new Date().toISOString(),
    routines,
    workouts,
    sets,
    body,
    customExercises: exercises.filter((e) => e.id.startsWith('u-')),
    favorites: exercises.filter((e) => e.favorite).map((e) => e.id),
    settings: settings?.value ?? null,
  }
}

export async function importBackup(file: BackupFile): Promise<void> {
  if (file?.app !== 'fit' || file.version !== 1) throw new Error('Not a Fit backup')
  await db.transaction('rw', [db.routines, db.workouts, db.sets, db.body, db.exercises, db.kv], async () => {
    await Promise.all([db.routines.clear(), db.workouts.clear(), db.sets.clear(), db.body.clear()])
    await db.routines.bulkAdd(file.routines)
    await db.workouts.bulkAdd(file.workouts)
    await db.sets.bulkAdd(file.sets)
    await db.body.bulkAdd(file.body)
    await db.exercises.bulkPut(file.customExercises)
    const favs = new Set(file.favorites)
    await db.exercises.toCollection().modify((e) => {
      e.favorite = favs.has(e.id) ? 1 : 0
    })
    if (file.settings) await db.kv.put({ key: 'settings', value: file.settings })
  })
}
