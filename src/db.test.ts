import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, exportBackup, importBackup, seedExercises, type BackupFile } from './db'
import { finishWorkout, startWorkout } from './lib/workout'
import type { Exercise } from './types'

const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, source: 'fedb', name: { en: id, de: id }, category: 'strength', equipment: [], machine: 0,
  primaryMuscles: ['chest'], secondaryMuscles: [], instructions: {}, images: [], favorite: 0, ...extra,
})
const file = (list: Exercise[]) => async () => JSON.stringify(list)

beforeEach(async () => {
  await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.sets.clear(), db.body.clear(), db.photos.clear(), db.kv.clear()])
})

describe('seedExercises', () => {
  it('lädt die Übungen beim ersten Start und überspringt unveränderte Daten', async () => {
    expect(await seedExercises(file([ex('a'), ex('b')]))).toBe(2)
    expect(await db.exercises.count()).toBe(2)
    expect(await seedExercises(file([ex('a'), ex('b')]))).toBe(0)
  })

  it('behält Favoriten und eigene Übungen, wenn sich die Daten ändern', async () => {
    await seedExercises(file([ex('a'), ex('b')]))
    await db.exercises.update('a', { favorite: 1 })
    await db.exercises.add(ex('u-mine', { source: 'custom' }))
    await seedExercises(file([ex('a', { name: { en: 'a', de: 'neu' } }), ex('c')]))
    const all = await db.exercises.toArray()
    expect(all.map((e) => e.id).sort()).toEqual(['a', 'c', 'u-mine']) // b entfernt, eigene bleibt
    expect(all.find((e) => e.id === 'a')).toMatchObject({ favorite: 1, name: { de: 'neu' } })
  })

  it('wirft bei Netzfehlern und lässt vorhandene Daten unberührt', async () => {
    await seedExercises(file([ex('a')]))
    await expect(seedExercises(async () => { throw new TypeError('Failed to fetch') })).rejects.toThrow('Failed to fetch')
    expect(await db.exercises.count()).toBe(1)
  })
})

describe('Backup', () => {
  async function fill() {
    await seedExercises(file([ex('bench'), ex('squat')]))
    await db.exercises.update('squat', { favorite: 1 })
    await db.exercises.add(ex('u-1', { source: 'custom', name: { en: 'Mine', de: 'Meine' } }))
    const rid = (await db.routines.add({ name: 'Push', color: '#fff', order: 1, items: [{ exerciseId: 'bench', sets: 3, reps: 8, restSec: 90 }] })) as number
    const wid = await startWorkout({ routine: (await db.routines.get(rid))! })
    const sets = await db.sets.where('workoutId').equals(wid).toArray()
    await db.sets.update(sets[0].id!, { weight: 80, reps: 8, done: 1 })
    await finishWorkout(wid)
    await db.body.add({ date: '2026-10-01', values: { weight: 82 } })
    await db.photos.add({ date: '2026-10-01', data: 'data:image/jpeg;base64,AAAA' })
    await db.kv.put({ key: 'settings', value: { language: 'de', units: 'kg' } })
  }

  it('Export und Import ergeben denselben Datenbestand', async () => {
    await fill()
    const backup = JSON.parse(JSON.stringify(await exportBackup())) as BackupFile
    expect(backup).toMatchObject({ app: 'fit', version: 1 })
    expect(backup.customExercises.map((e) => e.id)).toEqual(['u-1'])
    expect(backup.favorites).toEqual(['squat'])

    // frische Installation
    await Promise.all([db.exercises.clear(), db.routines.clear(), db.workouts.clear(), db.sets.clear(), db.body.clear(), db.kv.clear()])
    await seedExercises(file([ex('bench'), ex('squat')]))
    await importBackup(backup)

    expect(await db.routines.count()).toBe(1)
    expect(await db.workouts.count()).toBe(1)
    expect((await db.sets.toArray()).filter((s) => s.done)).toHaveLength(1)
    expect(await db.body.count()).toBe(1)
    expect((await db.photos.toArray()).map((p) => p.data)).toEqual(['data:image/jpeg;base64,AAAA'])
    expect((await db.exercises.get('squat'))?.favorite).toBe(1)
    expect((await db.exercises.get('bench'))?.favorite).toBe(0)
    expect(await db.exercises.get('u-1')).toBeDefined()
    expect((await db.kv.get('settings'))?.value).toMatchObject({ language: 'de' })
  })

  it('Import ersetzt vorhandene Trainingsdaten statt sie zu verdoppeln', async () => {
    await fill()
    const backup = JSON.parse(JSON.stringify(await exportBackup())) as BackupFile
    await importBackup(backup)
    await importBackup(backup)
    expect(await db.workouts.count()).toBe(1)
    expect(await db.routines.count()).toBe(1)
  })

  it('lehnt fremde Dateien ab, ohne Daten zu verändern', async () => {
    await fill()
    await expect(importBackup({ app: 'other', version: 1 } as unknown as BackupFile)).rejects.toThrow()
    await expect(importBackup(null as unknown as BackupFile)).rejects.toThrow()
    expect(await db.workouts.count()).toBe(1)
  })
})
