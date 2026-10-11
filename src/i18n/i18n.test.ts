import { describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'

const keys = (o: unknown, p = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  )

describe('i18n', () => {
  it('de und en haben exakt dieselben Schlüssel', () => {
    expect(keys(en).sort()).toEqual(keys(de).sort())
  })
  it('keine leeren Texte', () => {
    for (const dict of [de, en]) for (const k of keys(dict)) {
      const v = k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], dict)
      expect(String(v).length, k).toBeGreaterThan(0)
    }
  })
})
