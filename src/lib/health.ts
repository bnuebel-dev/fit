// Rechenformeln aus den Trainer-Unterlagen (Modul 7, 8, 10): Kraftniveau, Energiebedarf, Eiweiß, BMI, Trainingspuls.

export type Sex = 'male' | 'female'

// ---------- Kraftniveau (Modul 7.3.5, Verhältnis 1RM / Körpergewicht)
export type Lift = 'squat' | 'bench' | 'deadlift' | 'press'
export type StrengthLevel = 'beginner' | 'advanced' | 'pro'

/** Untergrenze von „Fortgeschritten“ und „Profi“ als Vielfaches des Körpergewichts. */
export const STRENGTH_STANDARDS: Record<Sex, Record<Lift, [number, number]>> = {
  male: { squat: [1.45, 2.25], bench: [1, 1.6], deadlift: [1.7, 2.5], press: [0.7, 1] },
  female: { squat: [1, 1.45], bench: [0.7, 1], deadlift: [1.1, 1.8], press: [0.5, 0.7] },
}

export interface StrengthResult {
  ratio: number
  level: StrengthLevel
  /** Zielwert der nächsten Stufe als Vielfaches des Körpergewichts (null = höchste Stufe) */
  nextRatio: number | null
  /** benötigtes 1RM für die nächste Stufe in kg */
  nextKg: number | null
  /** Fortschritt innerhalb der aktuellen Stufe 0..1 */
  progress: number
}

export function strengthLevel(sex: Sex, lift: Lift, oneRmKg: number, bodyKg: number): StrengthResult {
  const [adv, pro] = STRENGTH_STANDARDS[sex][lift]
  const ratio = bodyKg > 0 ? oneRmKg / bodyKg : 0
  if (ratio >= pro) return { ratio, level: 'pro', nextRatio: null, nextKg: null, progress: 1 }
  if (ratio >= adv) return { ratio, level: 'advanced', nextRatio: pro, nextKg: pro * bodyKg, progress: (ratio - adv) / (pro - adv) }
  return { ratio, level: 'beginner', nextRatio: adv, nextKg: adv * bodyKg, progress: Math.max(0, ratio / adv) }
}

// ---------- BMI
export type BmiClass = 'under' | 'normal' | 'over' | 'obese'

export function bmi(kg: number, cm: number): number {
  return cm > 0 ? Math.round((kg / (cm / 100) ** 2) * 10) / 10 : 0
}

export function bmiClass(value: number): BmiClass {
  return value < 18.5 ? 'under' : value < 25 ? 'normal' : value < 30 ? 'over' : 'obese'
}

// ---------- Energiebedarf (Modul 10.2)
/** Grundumsatz nach Harris/Benedict (kcal/Tag). */
export function bmrHarrisBenedict(sex: Sex, kg: number, cm: number, age: number): number {
  return sex === 'male'
    ? 66.473 + 13.752 * kg + 5.003 * cm - 6.755 * age
    : 655.096 + 9.563 * kg + 1.85 * cm - 4.676 * age
}

/** Faustformel: 1,0 (Männer) bzw. 0,9 (Frauen) kcal × kg × 24 h. */
export function bmrRule(sex: Sex, kg: number): number {
  return (sex === 'male' ? 1 : 0.9) * kg * 24
}

export const PAL_WORK = {
  sitting: 1.45, // ausschließlich sitzend (1,4–1,5)
  mixed: 1.65, // sitzend mit gehender/stehender Tätigkeit (1,6–1,7)
  standing: 1.85, // überwiegend gehend/stehend (1,8–1,9)
  heavy: 2.2, // körperlich anstrengend (2,0–2,4)
} as const
export type WorkActivity = keyof typeof PAL_WORK

export const PAL_SLEEP = 0.95

/** Gesamt-PAL: Tag zu je 8 Stunden Schlaf, Arbeit, Freizeit; jede Wochenstunde Sport erhöht den Freizeitwert um 0,1. */
export function palTotal(work: number, leisure: number, sportHoursPerWeek: number): number {
  return (work + (leisure + 0.1 * sportHoursPerWeek) + PAL_SLEEP) / 3
}

export const energyNeed = (bmr: number, pal: number): number => bmr * pal

// ---------- Eiweiß (Modul 10.7.4), g pro kg Körpergewicht und Tag
export type ProteinProfile = 'health' | 'beginner' | 'advanced' | 'senior'

export function proteinRange(profile: ProteinProfile): [number, number] {
  switch (profile) {
    case 'health': return [1, 1] // 2–3× pro Woche Gesundheitssport: etwa 1 g/kg
    case 'beginner': return [1.1, 1.8]
    case 'advanced': return [2.1, 2.3]
    case 'senior': return [1, 1.3]
  }
}

/** Richtwerte: ≥ 50 % der Energie aus Kohlenhydraten, 30–35 % aus Fett (DGE); der Rest ist Eiweiß. */
export function macroSplit(kcal: number, proteinG: number): { proteinG: number; fatG: [number, number]; carbsG: number } {
  const proteinKcal = proteinG * 4
  const fat: [number, number] = [Math.round((kcal * 0.3) / 9), Math.round((kcal * 0.35) / 9)]
  const carbs = Math.max(0, Math.round((kcal - proteinKcal - ((fat[0] + fat[1]) / 2) * 9) / 4))
  return { proteinG: Math.round(proteinG), fatG: fat, carbsG: carbs }
}

// ---------- Trainingspuls (Modul 8.1.1)
export const hfMax = (age: number): number => 220 - age
/** Hollmann: 180 − Alter */
export const pulseHollmann = (age: number): number => 180 - age
/** Karvonen: HF_Ruhe + (HFmax − HF_Ruhe) × Intensität, ±3 S/Min. */
export function pulseKarvonen(age: number, rest: number, intensity: number): { low: number; target: number; high: number } {
  const target = rest + (hfMax(age) - rest) * intensity
  return { low: Math.round(target - 3), target: Math.round(target), high: Math.round(target + 3) }
}
