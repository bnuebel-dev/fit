import { describe, expect, it } from 'vitest'
import { OpenRouterError, buildContext, createSseParser, listModels, streamChat, systemPrompt } from './openrouter'
import type { Exercise, SetLog, Workout } from '../../types'

const enc = new TextEncoder()
function sseResponse(chunks: string[], status = 200): Response {
  const stream = new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close() },
  })
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
}
const delta = (t: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`

describe('SSE-Parser', () => {
  it('sammelt Deltas, ignoriert Kommentare und erkennt [DONE]', () => {
    const got: string[] = []
    const p = createSseParser((t) => got.push(t))
    p.push(': OPENROUTER PROCESSING\n\n' + delta('Hallo') + delta(' Welt') + 'data: [DONE]\n\n')
    expect(got.join('')).toBe('Hallo Welt')
    expect(p.done()).toBe(true)
  })
  it('setzt Zeilen zusammen, die über Chunk-Grenzen geteilt sind', () => {
    const got: string[] = []
    const p = createSseParser((t) => got.push(t))
    const line = delta('Kniebeuge')
    p.push(line.slice(0, 20)); p.push(line.slice(20))
    expect(got).toEqual(['Kniebeuge'])
  })
  it('wirft bei Fehlern im Datenstrom', () => {
    const p = createSseParser(() => {})
    expect(() => p.push(`data: ${JSON.stringify({ error: { message: 'Rate limited', code: 429 } })}\n`)).toThrow(/Rate limited/)
  })
})

describe('streamChat', () => {
  it('streamt Text, sendet Schlüssel und Modell', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => { seen = { url, init }; return sseResponse([delta('Gut'), delta(' so'), 'data: [DONE]\n\n']) }) as unknown as typeof fetch
    const parts: string[] = []
    const text = await streamChat({ apiKey: ' sk-or-test ', model: 'x/y', messages: [{ role: 'user', content: 'Hi' }], onDelta: (t) => parts.push(t), fetchImpl, referer: 'https://fit.test' })
    expect(text).toBe('Gut so')
    expect(parts).toEqual(['Gut', ' so'])
    expect(seen!.url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const headers = seen!.init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-or-test')
    expect(headers['HTTP-Referer']).toBe('https://fit.test')
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({ model: 'x/y', stream: true, messages: [{ role: 'user', content: 'Hi' }] })
  })
  it('meldet HTTP-Fehler mit Meldung und Status', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { message: 'No auth credentials found' } }), { status: 401 })) as unknown as typeof fetch
    await expect(streamChat({ apiKey: 'k', model: 'm', messages: [], onDelta: () => {}, fetchImpl })).rejects.toMatchObject({ status: 401, message: 'No auth credentials found' })
  })
  it('ohne Schlüssel wird gar nicht erst gesendet', async () => {
    let called = false
    const fetchImpl = (async () => { called = true; return sseResponse([]) }) as unknown as typeof fetch
    await expect(streamChat({ apiKey: '  ', model: 'm', messages: [], onDelta: () => {}, fetchImpl })).rejects.toBeInstanceOf(OpenRouterError)
    expect(called).toBe(false)
  })
})

describe('listModels', () => {
  it('liefert sortierte IDs', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ data: [{ id: 'b/b' }, { id: 'a/a' }] }))) as unknown as typeof fetch
    expect(await listModels(fetchImpl)).toEqual(['a/a', 'b/b'])
  })
})

describe('systemPrompt', () => {
  it('enthält Sprache, Richtwerte und den Medizin-Hinweis', () => {
    const de = systemPrompt('de', { level: 'advanced', goal: 'hypertrophy' })
    expect(de).toMatch(/Deutsch/); expect(de).toMatch(/2–3× pro Woche/); expect(de).toMatch(/keine medizinische Beratung/); expect(de).toMatch(/advanced/)
    const en = systemPrompt('en')
    expect(en).toMatch(/English/); expect(en).toMatch(/medical advice/)
  })
})

describe('buildContext', () => {
  const DAY = 86400000
  const now = Date.UTC(2026, 9, 9)
  const ex = new Map<string, Exercise>([['bench', { id: 'bench', name: { en: 'Bench Press', de: 'Bankdrücken' }, primaryMuscles: ['chest'], secondaryMuscles: [] } as unknown as Exercise]])
  const w: Workout = { id: 1, name: 'Push', startedAt: now - DAY, endedAt: now - DAY + 3600000, items: [{ exerciseId: 'bench', restSec: 90 }] }
  const sets: SetLog[] = [
    { workoutId: 1, exerciseId: 'bench', order: 0, weight: 80, reps: 8, type: 'normal', done: 1 },
    { workoutId: 1, exerciseId: 'bench', order: 1, weight: 40, reps: 10, type: 'warmup', done: 1 },
    { workoutId: 1, exerciseId: 'bench', order: 2, weight: 80, reps: 5, type: 'normal', done: 0 },
  ]
  it('fasst Trainings, Bestwerte und Volumen zusammen (nur erledigte Sätze)', () => {
    const c = buildContext({ workouts: [w], sets, exercises: ex, lang: 'de', units: 'kg', now, bodyWeightKg: 82 })
    expect(c).toContain('Körpergewicht: 82kg')
    expect(c).toContain('Bankdrücken: 80×8, 40×10W')
    expect(c).not.toContain('80×5')
    expect(c).toContain('1RM≈101kg')
    expect(c).toContain('chest: 2')
  })
  it('rechnet in lb um und kennt den leeren Fall', () => {
    expect(buildContext({ workouts: [w], sets, exercises: ex, lang: 'en', units: 'lb', now })).toContain('Bench Press: 176.37×8')
    expect(buildContext({ workouts: [], sets: [], exercises: ex, lang: 'en', units: 'kg', now })).toMatch(/no completed workouts/)
  })
})
