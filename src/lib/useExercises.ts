import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import type { Exercise } from '../types'

export function useExerciseMap(): Map<string, Exercise> {
  const list = useLiveQuery(() => db.exercises.toArray(), [])
  return useMemo(() => new Map((list ?? []).map((e) => [e.id, e])), [list])
}
