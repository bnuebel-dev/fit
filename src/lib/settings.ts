import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Lang, Settings } from '../types'

export function detectLang(): Lang {
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function defaultSettings(): Settings {
  return {
    language: detectLang(),
    units: 'kg',
    theme: 'system',
    restDefault: 120,
    advisorKey: '',
    advisorModel: 'anthropic/claude-sonnet-4.5',
    weeklyGoal: 3,
    healthSync: false,
  }
}

export async function loadSettings(): Promise<Settings> {
  const stored = (await db.kv.get('settings'))?.value as Partial<Settings> | undefined
  return { ...defaultSettings(), ...stored }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await loadSettings()), ...patch }
  await db.kv.put({ key: 'settings', value: next })
}

/** undefined solange die Einstellungen noch laden. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(loadSettings, [])
}
