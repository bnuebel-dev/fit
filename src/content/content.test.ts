import { describe, expect, it } from 'vitest'
import { ARTICLES, GLOSSARY, glossaryById } from './index'

const refs = (s: string): string[] => [...s.matchAll(/\[\[([^|\]]+)\|[^\]]+\]\]/g)].map((m) => m[1])
const kind = (line: string): 'li' | 'note' | 'p' => (line.startsWith('- ') ? 'li' : line.startsWith('! ') ? 'note' : 'p')

describe('Wissensartikel', () => {
  it('IDs sind eindeutig und es gibt Artikel in allen Gruppen', () => {
    expect(new Set(ARTICLES.map((a) => a.id)).size).toBe(ARTICLES.length)
    expect(new Set(ARTICLES.map((a) => a.group))).toEqual(new Set(['planning', 'training', 'body', 'nutrition']))
    expect(ARTICLES.length).toBeGreaterThanOrEqual(15)
  })
  it('alle Texte sind in beiden Sprachen vorhanden', () => {
    for (const a of ARTICLES) {
      for (const lang of ['de', 'en'] as const) {
        expect(a.title[lang].trim().length, `${a.id} title ${lang}`).toBeGreaterThan(3)
        expect(a.summary[lang].trim().length, `${a.id} summary ${lang}`).toBeGreaterThan(10)
        expect(a.sections.length, a.id).toBeGreaterThan(0)
        for (const s of a.sections) {
          expect(s.h[lang].trim().length, `${a.id} h ${lang}`).toBeGreaterThan(2)
          expect(s.body[lang].length, `${a.id}/${s.h.en} body ${lang}`).toBeGreaterThan(0)
          for (const line of s.body[lang]) expect(line.trim().length, `${a.id}/${s.h.en}`).toBeGreaterThan(3)
        }
      }
    }
  })
  it('Deutsch und Englisch haben dieselbe Struktur (Absätze, Listen, Hinweise, Glossar-Verweise)', () => {
    for (const a of ARTICLES) for (const s of a.sections) {
      expect(s.body.de.map(kind), `${a.id}/${s.h.en}`).toEqual(s.body.en.map(kind))
      expect(s.body.de.flatMap(refs), `${a.id}/${s.h.en} Verweise`).toEqual(s.body.en.flatMap(refs))
    }
  })
  it('alle Glossar-Verweise zeigen auf vorhandene Einträge', () => {
    const bad: string[] = []
    for (const a of ARTICLES) for (const s of a.sections) for (const lang of ['de', 'en'] as const) for (const line of s.body[lang]) for (const id of refs(line)) {
      if (!glossaryById(id)) bad.push(`${a.id}: ${id}`)
    }
    expect(bad).toEqual([])
  })
  it('Werkzeug-Links zeigen auf bekannte Routen', () => {
    const routes = ['/more/advisor', '/more/1rm', '/more/strength-level', '/more/energy']
    for (const a of ARTICLES) if (a.tool) expect(routes, a.id).toContain(a.tool.to)
  })
  it('Zahlen aus dem Skript stimmen (Stichproben)', () => {
    const text = (id: string) => JSON.stringify(ARTICLES.find((a) => a.id === id))
    expect(text('volume-intensity')).toContain('1 Wdh.: 100 %, 2: 96 %, 3: 92 %, 4: 89 %, 5: 86 %')
    expect(text('volume-intensity')).toContain('15: 60 %')
    expect(text('rest-tempo')).toContain('3 bis 5 Minuten')
    expect(text('rest-tempo')).toContain('2/0/1/1')
    expect(text('recovery')).toContain('48 bis 72 Stunden')
    expect(text('nutrition')).toContain('2,1 bis 2,3')
    expect(text('cardio')).toContain('141 bis 147')
  })
})

describe('Glossar', () => {
  it('IDs eindeutig, beide Sprachen gefüllt', () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length)
    for (const g of GLOSSARY) for (const lang of ['de', 'en'] as const) {
      expect(g.term[lang].trim().length, g.id).toBeGreaterThan(1)
      expect(g.text[lang].trim().length, g.id).toBeGreaterThan(20)
    }
  })
  it('enthält die zentralen Begriffe', () => {
    for (const id of ['1rm', 'rpe', 'rir', 'volume', 'intensity', 'deload', 'overload', 'hypertrophy', 'tempo', 'bmr', 'pal']) expect(glossaryById(id), id).toBeDefined()
  })
})
