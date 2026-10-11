import { describe, expect, it } from 'vitest'
import { QUESTIONS, defaultAnswers, isComplete, levelFor, planToText, toPlanInput } from './wizard'
import { createPlan } from './planner'

describe('Frage-Antwort-Modus', () => {
  it('Erfahrung wird auf die Niveaus der Volumentabelle abgebildet', () => {
    expect(levelFor('new')).toBe('beginner')
    expect(levelFor('some')).toBe('advanced')
    expect(levelFor('years')).toBe('pro')
    expect(levelFor('casual')).toBe('hobby')
  })

  it('Antworten ergeben gültige Planer-Eingaben', () => {
    const input = toPlanInput({ goal: 'strength', experience: 'some', days: 4, minutes: 75, equipment: 'free' })
    expect(input).toEqual({ goal: 'strength', level: 'advanced', days: 4, minutes: 75, machines: false })
    const plan = createPlan(input)
    expect(plan.split).toBe('upperlower')
    expect(plan.sessions).toHaveLength(4)
  })

  it('jede Kombination der Antworten liefert einen Plan mit der gewählten Tageszahl', () => {
    const q = Object.fromEntries(QUESTIONS.map((x) => [x.id, x.options])) as Record<string, (string | number)[]>
    let n = 0
    for (const goal of q.goal) for (const experience of q.experience) for (const days of q.days) for (const minutes of q.minutes) for (const equipment of q.equipment) {
      const plan = createPlan(toPlanInput({ goal, experience, days, minutes, equipment } as never))
      expect(plan.sessions).toHaveLength(days as number)
      n++
    }
    expect(n).toBe(4 * 4 * 6 * 5 * 2)
  })

  it('Vorbelegung: Einsteiger an Geräten, Erfahrene aus dem Profil, vollständig', () => {
    expect(defaultAnswers()).toMatchObject({ experience: 'new', equipment: 'machines', days: 3 })
    expect(defaultAnswers({ level: 'pro', machines: false, days: 5 })).toMatchObject({ experience: 'years', equipment: 'free', days: 5 })
    expect(isComplete(defaultAnswers())).toBe(true)
    expect(isComplete({ goal: 'general' })).toBe(false)
  })

  it('Textexport enthält Einheiten, Übungen, Sätze und Pausen', () => {
    const plan = createPlan(toPlanInput(defaultAnswers()))
    const text = planToText(plan, (id) => `<${id}>`, (s) => `${s.kind}${s.label}`)
    expect(text).toContain('3 Tage pro Woche')
    expect(text).toContain('fullbodyA')
    expect(text).toMatch(/- <Leg_Press>: \d × \d+–\d+, Pause \d+ s/)
    expect(text.split('\n').length).toBeGreaterThan(15)
  })
})
