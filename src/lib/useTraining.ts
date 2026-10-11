import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import { bodyKgAt } from './calories'
import { workoutStats } from './stats'

/** Einheiten, Sätze und Körperdaten samt berechneten Kennzahlen (inkl. geschätzter Kalorien). */
export function useTraining() {
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray(), body: await db.body.toArray() }), [])
  const stats = useMemo(() => (data ? workoutStats(data.workouts, data.sets, (ts) => bodyKgAt(data.body, ts)) : null), [data])
  return data && stats ? { ...data, stats } : null
}
