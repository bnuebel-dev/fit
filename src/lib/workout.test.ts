import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { addExercise, addSet, bestE1rm, finishWorkout, getActiveWorkout, previousSets, startWorkout } from './workout'
import type { Routine } from '../types'

const routine: Routine = {
  id: 1,
  name: 'Brust',
  color: '#f90',
  order: 0,
  items: [{ exerciseId: 'bench', sets: 3, reps: 8, restSec: 90 }],
}

async function logSets(workoutId: number, exerciseId: string, rows: [number, number][]) {
  const sets = await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray()
  sets.sort((a, b) => a.order - b.order)
  for (let i = 0; i < rows.length; i++) {
    const s = sets[i] ?? { id: await addSet(workoutId, exerciseId) }
    await db.sets.update(s.id!, { weight: rows[i][0], reps: rows[i][1], done: 1 })
  }
}

beforeEach(async () => {
  await Promise.all([db.workouts.clear(), db.sets.clear()])
})

describe('workout', () => {
  it('startet aus Routine mit vorbereiteten Sätzen und nur einer aktiven Einheit', async () => {
    const id = await startWorkout({ routine })
    expect((await getActiveWorkout())?.id).toBe(id)
    expect(await db.sets.where('workoutId').equals(id).count()).toBe(3)
    expect(await startWorkout({ routine })).toBe(id)
  })

  it('übernimmt Vorwerte der letzten abgeschlossenen Einheit', async () => {
    const a = await startWorkout({ routine })
    await logSets(a, 'bench', [[80, 8], [80, 8], [82.5, 6]])
    await finishWorkout(a)
    expect((await previousSets('bench')).map((s) => s.weight)).toEqual([80, 80, 82.5])

    const b = await startWorkout({ routine })
    const sets = (await db.sets.where('workoutId').equals(b).toArray()).sort((x, y) => x.order - y.order)
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[80, 8], [80, 8], [82.5, 6]])
  })

  it('verwirft offene Sätze und leere Einheiten', async () => {
    const a = await startWorkout({ routine })
    await logSets(a, 'bench', [[60, 10]])
    const summary = await finishWorkout(a)
    expect(summary?.sets).toBe(1)
    expect(await db.sets.where('workoutId').equals(a).count()).toBe(1)

    const empty = await startWorkout({ routine })
    expect(await finishWorkout(empty)).toBeNull()
    expect(await db.workouts.get(empty)).toBeUndefined()
  })

  it('erkennt Rekorde nur gegenüber früheren abgeschlossenen Einheiten', async () => {
    const a = await startWorkout({ routine })
    await logSets(a, 'bench', [[80, 8]])
    const first = await finishWorkout(a)
    expect(first?.prs).toEqual([]) // erste Einheit: kein Vergleichswert

    const b = await startWorkout({ routine })
    await logSets(b, 'bench', [[85, 8]])
    const second = await finishWorkout(b)
    expect(second?.prs).toHaveLength(1)
    expect(await bestE1rm('bench')).toBeGreaterThan(100)

    const c = await startWorkout({ routine })
    await logSets(c, 'bench', [[70, 8]])
    expect((await finishWorkout(c))?.prs).toEqual([])
  })

  it('Aufwärmsätze zählen nicht fürs Volumen und nicht für Rekorde', async () => {
    const a = await startWorkout({ routine })
    await logSets(a, 'bench', [[100, 5], [60, 5]])
    const sets = await db.sets.where('workoutId').equals(a).toArray()
    await db.sets.update(sets.find((s) => s.weight === 100)!.id!, { type: 'warmup' })
    const s = await finishWorkout(a)
    expect(s?.volume).toBe(300)
  })

  it('fügt Übungen hinzu', async () => {
    const id = await startWorkout({ name: 'Frei' })
    await addExercise(id, 'squat', 120)
    await addExercise(id, 'squat', 120)
    expect((await db.workouts.get(id))?.items).toHaveLength(1)
    expect(await db.sets.where('workoutId').equals(id).count()).toBe(1)
  })
})
