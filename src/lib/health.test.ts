import { describe, expect, it } from 'vitest'
import { PAL_WORK, bmi, bmiClass, bmrHarrisBenedict, bmrRule, energyNeed, macroSplit, palTotal, proteinRange, pulseHollmann, pulseKarvonen, strengthLevel } from './health'

describe('Kraftniveau (Skript-Tabellen)', () => {
  it('Kreuzheben 1,7× Körpergewicht = fortgeschrittener Mann (Beispiel aus dem Skript: 170 kg bei 100 kg)', () => {
    const r = strengthLevel('male', 'deadlift', 170, 100)
    expect(r.level).toBe('advanced')
    expect(r.nextKg).toBeCloseTo(250)
  })
  it('Stufen und Grenzen', () => {
    expect(strengthLevel('male', 'bench', 99, 100).level).toBe('beginner')
    expect(strengthLevel('male', 'bench', 100, 100).level).toBe('advanced')
    expect(strengthLevel('male', 'bench', 160, 100).level).toBe('pro')
    expect(strengthLevel('female', 'squat', 100, 100).level).toBe('advanced')
    expect(strengthLevel('female', 'press', 40, 60).level).toBe('advanced') // 0,67: ab 0,5 fortgeschritten, ab 0,7 Profi
    expect(strengthLevel('female', 'press', 50, 60).level).toBe('pro') // 0,83 > 0,7
  })
  it('Fortschritt innerhalb der Stufe', () => {
    expect(strengthLevel('male', 'squat', 72.5, 100).progress).toBeCloseTo(0.5)
    expect(strengthLevel('male', 'squat', 0, 100).progress).toBe(0)
    expect(strengthLevel('male', 'squat', 300, 100)).toMatchObject({ level: 'pro', nextKg: null, progress: 1 })
    expect(strengthLevel('male', 'squat', 100, 0).ratio).toBe(0)
  })
})

describe('BMI', () => {
  it('Berechnung und Klassen', () => {
    expect(bmi(70, 175)).toBe(22.9)
    expect(bmi(70, 0)).toBe(0)
    expect(bmiClass(18.4)).toBe('under')
    expect(bmiClass(18.5)).toBe('normal')
    expect(bmiClass(24.9)).toBe('normal')
    expect(bmiClass(25)).toBe('over')
    expect(bmiClass(30)).toBe('obese')
  })
})

describe('Energiebedarf (Beispiele aus dem Skript)', () => {
  it('Faustformel: Mann 70 kg = 1680, Frau 65 kg = 1404 kcal', () => {
    expect(bmrRule('male', 70)).toBe(1680)
    expect(bmrRule('female', 65)).toBeCloseTo(1404)
  })
  it('Büroangestellte: GU ≈ 1275, PAL ≈ 1,4, Bedarf ≈ 1785 kcal', () => {
    const gu = bmrRule('female', 59)
    expect(Math.round(gu)).toBe(1274) // Skript rundet auf 1275
    const pal = palTotal(1.4, 1.6, 3)
    expect(pal).toBeCloseTo(1.42, 1)
    expect(Math.round(energyNeed(1275, 1.4))).toBe(1785)
  })
  it('Harris-Benedict', () => {
    expect(bmrHarrisBenedict('male', 80, 180, 30)).toBeCloseTo(66.473 + 13.752 * 80 + 5.003 * 180 - 6.755 * 30, 5)
    expect(bmrHarrisBenedict('female', 60, 165, 30)).toBeGreaterThan(1300)
    expect(bmrHarrisBenedict('female', 60, 165, 30)).toBeLessThan(bmrHarrisBenedict('male', 60, 165, 30))
  })
  it('PAL-Bereiche', () => {
    expect(PAL_WORK.sitting).toBeGreaterThanOrEqual(1.4)
    expect(PAL_WORK.heavy).toBeLessThanOrEqual(2.4)
    expect(palTotal(1.45, 1.6, 0)).toBeLessThan(palTotal(1.45, 1.6, 5))
  })
})

describe('Eiweiß und Makros', () => {
  it('Spannen laut Skript', () => {
    expect(proteinRange('health')).toEqual([1, 1])
    expect(proteinRange('beginner')).toEqual([1.1, 1.8])
    expect(proteinRange('advanced')).toEqual([2.1, 2.3])
    expect(proteinRange('senior')).toEqual([1, 1.3])
  })
  it('Makroverteilung geht auf (Kohlenhydrate ≥ 45 % bei moderatem Eiweiß)', () => {
    const m = macroSplit(2500, 140)
    expect(m.proteinG).toBe(140)
    expect(m.fatG).toEqual([83, 97])
    const kcal = m.proteinG * 4 + ((m.fatG[0] + m.fatG[1]) / 2) * 9 + m.carbsG * 4
    expect(Math.abs(kcal - 2500)).toBeLessThan(10)
    expect((m.carbsG * 4) / 2500).toBeGreaterThan(0.4)
  })
  it('Kohlenhydrate werden nie negativ', () => {
    expect(macroSplit(1000, 400).carbsG).toBe(0)
  })
})

describe('Trainingspuls (Beispiele aus dem Skript)', () => {
  it('Hollmann: 20 Jahre → 160', () => expect(pulseHollmann(20)).toBe(160))
  it('Karvonen: 20 Jahre, Ruhepuls 60, 60 % → 141–147', () => {
    expect(pulseKarvonen(20, 60, 0.6)).toEqual({ low: 141, target: 144, high: 147 })
  })
})
