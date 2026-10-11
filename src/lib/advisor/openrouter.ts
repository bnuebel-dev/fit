// KI-Coach (Advisor Stufe 3) über OpenRouter. Der API-Schlüssel wird vom Nutzer eingetragen und nur lokal gespeichert.
import type { Exercise, Lang, SetLog, Units, Workout } from '../../types'
import { e1rm, toDisplay } from '../calc'
import { exName } from '../names'
import { bestByExercise, workoutStats } from '../stats'
import { groupOf } from './hints'
import type { Level, Goal } from './planner'

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

export function systemPrompt(lang: Lang, profile?: { level?: Level; goal?: Goal }): string {
  const de = lang === 'de'
  const profileLine = profile
    ? de
      ? `Profil des Nutzers: Niveau ${profile.level ?? 'unbekannt'}, Ziel ${profile.goal ?? 'unbekannt'}.`
      : `User profile: level ${profile.level ?? 'unknown'}, goal ${profile.goal ?? 'unknown'}.`
    : ''
  return de
    ? [
        'Du bist ein erfahrener, ehrlicher Trainings-Coach in einer Gym-Tracking-App. Antworte auf Deutsch, knapp und konkret.',
        'Grundlage sind die Prinzipien der Muscle and Strength Pyramid (nach Eric Helms): Beständigkeit vor Volumen/Intensität/Frequenz, dann Progression, Übungsauswahl, Pausen, Kadenz.',
        'Richtwerte: Hypertrophie 6–12 Wdh. (60–85 % 1RM), Kraft 1–6 Wdh., Kraftausdauer 13–30 Wdh.; jede Muskelgruppe 2–3× pro Woche; 48–72 h Pause je Muskelgruppe; Pausen 3–5 Min. bei schweren, 1–2 Min. bei Isolationsübungen; Progression durch kleine Gewichtssteigerungen (2,5 kg) bzw. doppelte Progression; Deload alle 4–5 Wochen.',
        'Nutze die Trainingsdaten des Nutzers, wenn sie angehängt sind, und nenne Zahlen daraus. Erfinde keine Daten.',
        'Du gibst keine medizinische Beratung. Bei Schmerzen, Verletzungen oder Vorerkrankungen verweise auf Arzt oder Physiotherapie.',
        profileLine,
      ].filter(Boolean).join('\n')
    : [
        'You are an experienced, honest training coach inside a gym-tracking app. Answer in English, concise and concrete.',
        'Base your advice on the Muscle and Strength Pyramid (Eric Helms): consistency first, then volume/intensity/frequency, then progression, exercise selection, rest, tempo.',
        'Guidelines: hypertrophy 6–12 reps (60–85 % 1RM), strength 1–6 reps, muscular endurance 13–30 reps; train each muscle group 2–3× per week; 48–72 h between sessions for the same muscle; rest 3–5 min for heavy lifts, 1–2 min for isolation; progress via small load increases (2.5 kg) or double progression; deload every 4–5 weeks.',
        "Use the user's training data when attached and quote numbers from it. Do not invent data.",
        'You do not give medical advice. For pain, injury or health conditions refer to a doctor or physiotherapist.',
        profileLine,
      ].filter(Boolean).join('\n')
}

export interface ContextInput {
  workouts: Workout[]
  sets: SetLog[]
  exercises: Map<string, Exercise>
  lang: Lang
  units: Units
  now: number
  bodyWeightKg?: number
  maxWorkouts?: number
}

/** Kompakter Textauszug des Logbuchs für den Coach (letzte Einheiten, Bestwerte, Wochenvolumen). */
export function buildContext(input: ContextInput): string {
  const { exercises, lang, units } = input
  const name = (id: string) => { const e = exercises.get(id); return e ? exName(e, lang) : id }
  const w = (kg: number) => `${toDisplay(kg, units)}${units}`
  const finished = input.workouts.filter((x) => x.endedAt !== undefined).sort((a, b) => b.startedAt - a.startedAt)
  if (!finished.length) return lang === 'de' ? 'Es gibt noch keine abgeschlossenen Trainings.' : 'There are no completed workouts yet.'
  const stats = new Map(workoutStats(input.workouts, input.sets).map((s) => [s.id, s]))
  const lines: string[] = []
  if (input.bodyWeightKg) lines.push(`${lang === 'de' ? 'Körpergewicht' : 'Body weight'}: ${w(input.bodyWeightKg)}`)
  lines.push(lang === 'de' ? `Letzte Trainings (neueste zuerst, max. ${input.maxWorkouts ?? 8}):` : `Recent workouts (newest first, max ${input.maxWorkouts ?? 8}):`)
  for (const wk of finished.slice(0, input.maxWorkouts ?? 8)) {
    const date = new Date(wk.startedAt).toISOString().slice(0, 10)
    const st = stats.get(wk.id!)
    lines.push(`- ${date} ${wk.name || ''} (${st ? Math.round(st.durationMs / 60000) : '?'} min)`)
    for (const it of wk.items) {
      const sets = input.sets.filter((s) => s.workoutId === wk.id && s.exerciseId === it.exerciseId && s.done)
        .sort((a, b) => a.order - b.order).map((s) => `${toDisplay(s.weight, units)}×${s.reps}${s.type === 'warmup' ? 'W' : ''}${s.rpe ? `@${s.rpe}` : ''}`)
      if (sets.length) lines.push(`    ${name(it.exerciseId)}: ${sets.join(', ')}`)
    }
  }
  const best = [...bestByExercise(input.sets.filter((s) => finished.some((f) => f.id === s.workoutId))).entries()]
    .sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 8)
  lines.push(lang === 'de' ? 'Bestwerte (geschätztes 1RM):' : 'Best sets (estimated 1RM):')
  for (const [id, b] of best) lines.push(`- ${name(id)}: ${w(b.weight)}×${b.reps} → 1RM≈${w(Math.round(e1rm(b.weight, b.reps)))}`)
  const since = input.now - 28 * 86400000
  const perGroup = new Map<string, number>()
  const ids = new Set(finished.filter((f) => f.startedAt >= since).map((f) => f.id))
  for (const s of input.sets) {
    if (!s.done || s.type === 'warmup' || !ids.has(s.workoutId)) continue
    const e = exercises.get(s.exerciseId)
    const g = e ? groupOf(e) : null
    if (g) perGroup.set(g, (perGroup.get(g) ?? 0) + s.reps)
  }
  if (perGroup.size) {
    lines.push(lang === 'de' ? 'Ø Wiederholungen pro Woche und Muskelgruppe (letzte 4 Wochen):' : 'Avg reps per week per muscle group (last 4 weeks):')
    for (const [g, reps] of [...perGroup.entries()].sort((a, b) => b[1] - a[1])) lines.push(`- ${g}: ${Math.round(reps / 4)}`)
  }
  return lines.join('\n')
}

/** Zerlegt einen SSE-Datenstrom (mit Puffer für unvollständige Zeilen) in Text-Deltas. */
export function createSseParser(onDelta: (text: string) => void): { push: (chunk: string) => void; done: () => boolean } {
  let buffer = ''
  let finished = false
  return {
    push(chunk) {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue // Kommentare wie ": OPENROUTER PROCESSING" ignorieren
        const data = line.slice(5).trim()
        if (data === '[DONE]') { finished = true; continue }
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; error?: { message?: string; code?: number } }
          if (json.error) throw new OpenRouterError(json.error.message ?? 'OpenRouter error', json.error.code)
          const text = json.choices?.[0]?.delta?.content
          if (text) onDelta(text)
        } catch (e) {
          if (e instanceof OpenRouterError) throw e
          /* unvollständiges oder unbekanntes JSON überspringen */
        }
      }
    },
    done: () => finished,
  }
}

export interface ChatOptions {
  apiKey: string
  model: string
  messages: ChatMessage[]
  onDelta: (text: string) => void
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  referer?: string
}

export async function streamChat(o: ChatOptions): Promise<string> {
  if (!o.apiKey.trim()) throw new OpenRouterError('Missing API key', 401)
  const f = o.fetchImpl ?? fetch
  const res = await f(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    signal: o.signal,
    headers: {
      Authorization: `Bearer ${o.apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': o.referer ?? (typeof location !== 'undefined' ? location.origin : 'https://localhost'),
      'X-Title': 'Fit',
    },
    body: JSON.stringify({ model: o.model, messages: o.messages, stream: true }),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try { msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? msg } catch { /* kein JSON */ }
    throw new OpenRouterError(msg, res.status)
  }
  if (!res.body) throw new OpenRouterError('Empty response')
  let full = ''
  const parser = createSseParser((t) => { full += t; o.onDelta(t) })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    parser.push(decoder.decode(value, { stream: true }))
  }
  parser.push('\n')
  return full
}

export async function listModels(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`${OPENROUTER_URL}/models`)
  if (!res.ok) throw new OpenRouterError(`HTTP ${res.status}`, res.status)
  const json = (await res.json()) as { data?: { id: string }[] }
  return (json.data ?? []).map((m) => m.id).sort()
}
