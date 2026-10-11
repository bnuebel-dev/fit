import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { Goal, Level } from './planner'

export interface Profile {
  goal: Goal
  level: Level
  days: number
  minutes: number
  machines: boolean
}

export const DEFAULT_PROFILE: Profile = { goal: 'hypertrophy', level: 'beginner', days: 3, minutes: 60, machines: true }

export async function loadProfile(): Promise<Profile> {
  return { ...DEFAULT_PROFILE, ...((await db.kv.get('advisorProfile'))?.value as Partial<Profile> | undefined) }
}

export async function saveProfile(p: Partial<Profile>): Promise<void> {
  await db.kv.put({ key: 'advisorProfile', value: { ...(await loadProfile()), ...p } })
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(loadProfile, [])
}
