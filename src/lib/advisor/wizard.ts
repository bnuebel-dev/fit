// Frage-Antwort-Modus des Planers: Jede Frage hat Antwortoptionen und eine Begründung aus den
// Trainer-Unterlagen. Die Antworten werden in die Eingaben des regelbasierten Planers übersetzt.
import type { Goal, Level, PlanInput, Plan } from './planner'

export type Experience = 'new' | 'some' | 'years' | 'casual'
export type Equipment = 'machines' | 'free'

export interface Answers {
  goal: Goal
  experience: Experience
  days: number
  minutes: number
  equipment: Equipment
}

export type QuestionId = keyof Answers

export interface Question {
  id: QuestionId
  /** Auswahlwerte in Anzeigereihenfolge */
  options: (string | number)[]
}

export const QUESTIONS: Question[] = [
  { id: 'goal', options: ['hypertrophy', 'strength', 'endurance', 'general'] },
  { id: 'experience', options: ['new', 'some', 'years', 'casual'] },
  { id: 'days', options: [2, 3, 4, 5, 6, 1] },
  { id: 'minutes', options: [30, 45, 60, 75, 90] },
  { id: 'equipment', options: ['machines', 'free'] },
]

/** Erfahrung → Niveau der Volumentabelle (Modul 9.2.1). */
export function levelFor(experience: Experience): Level {
  switch (experience) {
    case 'new': return 'beginner'
    case 'some': return 'advanced'
    case 'years': return 'pro'
    case 'casual': return 'hobby'
  }
}

export function toPlanInput(a: Answers): PlanInput {
  return { goal: a.goal, level: levelFor(a.experience), days: a.days, minutes: a.minutes, machines: a.equipment === 'machines' }
}

/** Vorbelegung: Einsteiger und Hobbysportler starten an Geräten (Modul 9.4.2), Erfahrene mit freien Grundübungen. */
export function defaultAnswers(p?: Partial<PlanInput>): Answers {
  const experience: Experience = p?.level === 'pro' ? 'years' : p?.level === 'advanced' ? 'some' : p?.level === 'hobby' ? 'casual' : 'new'
  return {
    goal: p?.goal ?? 'hypertrophy',
    experience,
    days: p?.days ?? 3,
    minutes: p?.minutes ?? 60,
    equipment: p?.machines === false ? 'free' : 'machines',
  }
}

export function isComplete(a: Partial<Record<QuestionId, unknown>>): a is Answers {
  return QUESTIONS.every((q) => a[q.id] !== undefined)
}

/** Kurzfassung des Plans als Text, z. B. zur Übergabe an den Coach. */
export function planToText(plan: Plan, name: (exerciseId: string) => string, sessionName: (s: Plan['sessions'][number]) => string): string {
  const lines: string[] = []
  const i = plan.input
  lines.push(`Ziel: ${i.goal}, Niveau: ${i.level}, ${plan.input.days} Tage pro Woche, ${i.minutes} Minuten, ${i.machines ? 'Geräte bevorzugt' : 'freie Gewichte bevorzugt'}.`)
  for (const s of plan.sessions) {
    lines.push(`${sessionName(s)} (ca. ${s.estMinutes} Min.):`)
    for (const it of s.items) lines.push(`- ${name(it.exerciseId)}: ${it.sets} × ${it.repsMin}–${it.repsMax}, Pause ${it.restSec} s`)
  }
  return lines.join('\n')
}
