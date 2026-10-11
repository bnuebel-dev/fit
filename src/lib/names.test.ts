import { describe, expect, it } from 'vitest'
import { exName, matchesQuery } from './names'
import type { Exercise } from '../types'

const ex = {
  name: { en: 'Leg Press', de: 'Beinpresse' },
  aliases: ['Beinpresse Eng'],
} as Exercise

describe('names', () => {
  it('wählt die Sprache mit Fallback auf Englisch', () => {
    expect(exName(ex, 'de')).toBe('Beinpresse')
    expect(exName(ex, 'en')).toBe('Leg Press')
    expect(exName({ name: { en: 'Plank' } }, 'de')).toBe('Plank')
  })
  it('Suche ignoriert Umlaute und Groß-/Kleinschreibung und nutzt Aliase', () => {
    expect(matchesQuery(ex, 'BEIN')).toBe(true)
    expect(matchesQuery(ex, 'leg pre')).toBe(true)
    expect(matchesQuery(ex, 'eng')).toBe(true)
    expect(matchesQuery(ex, 'squat')).toBe(false)
    expect(matchesQuery({ ...ex, name: { en: 'Press', de: 'Drücken über Kopf' } } as Exercise, 'ueber')).toBe(false)
    expect(matchesQuery({ ...ex, name: { en: 'x', de: 'Straße' } } as Exercise, 'strasse')).toBe(true)
  })
})

import { searchRank } from './names'
describe('searchRank', () => {
  const mk = (de: string) => ({ name: { en: de, de } }) as Exercise
  it('Namensanfang und kurze Namen zuerst', () => {
    const q = 'bankdr'
    const list = ['Negativ-Bankdrücken Langhantel', 'Bankdrücken (Powerlifting)', 'Bankdrücken', 'Kurzhantel Bankdrücken'].map(mk)
    const sorted = [...list].sort((a, b) => searchRank(a, 'de', q) - searchRank(b, 'de', q)).map((e) => e.name.de)
    expect(sorted[0]).toBe('Bankdrücken')
    expect(sorted[1]).toBe('Bankdrücken (Powerlifting)')
  })
  it('ohne Suchbegriff neutral', () => {
    expect(searchRank(mk('x'), 'de', '')).toBe(0)
  })
})
