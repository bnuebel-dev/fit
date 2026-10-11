import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { NumField } from '../components/NumField'
import { computeHints, type Hint } from '../lib/advisor/hints'
import { OpenRouterError, buildContext, listModels, streamChat, systemPrompt, type ChatMessage } from '../lib/advisor/openrouter'
import { createPlan, type Goal, type Level, type Plan } from '../lib/advisor/planner'
import { saveProfile, useProfile, type Profile } from '../lib/advisor/profile'
import { toDisplay } from '../lib/calc'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { saveSettings, useSettings } from '../lib/settings'
import { useExerciseMap } from '../lib/useExercises'
import type { Routine } from '../types'

type Tab = 'plan' | 'hints' | 'coach'
const GOALS: Goal[] = ['hypertrophy', 'strength', 'endurance', 'general']
const LEVELS: Level[] = ['beginner', 'advanced', 'pro', 'hobby']
const COLORS = ['#f59e0b', '#ef4444', '#a78bfa', '#facc15', '#34d399', '#38bdf8']

export function Advisor() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('plan')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav('/more')} aria-label={t('common.back')}>←</button>
        <h1 className="text-2xl font-bold">{t('advisor.title')}</h1>
      </div>
      <div className="flex gap-2" role="tablist">
        {(['plan', 'hints', 'coach'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`btn flex-1 ${tab === x ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setTab(x)}>{t(`advisor.tabs.${x}`)}</button>
        ))}
      </div>
      {tab === 'plan' && <PlanTab />}
      {tab === 'hints' && <HintsTab />}
      {tab === 'coach' && <CoachTab />}
    </div>
  )
}

function Chips<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-sm text-muted">{label}</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} role="radio" aria-checked={value === o.v} className={`chip !px-3 !py-2 text-sm ${value === o.v ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => onChange(o.v)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

// ---------- Stufe 1: Planer
function PlanTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const profile = useProfile()
  const exMap = useExerciseMap()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [saved, setSaved] = useState(false)
  if (!profile) return null

  const set = (p: Partial<Profile>) => { void saveProfile(p); setSaved(false) }
  const create = () => setPlan(createPlan(profile))
  const sessionName = (s: Plan['sessions'][number]) => `${t(`advisor.session.${s.kind}`)}${s.label ? ` ${s.label}` : ''}`

  const save = async () => {
    if (!plan) return
    const base = Date.now()
    const routines: Routine[] = plan.sessions.map((s, i) => ({
      name: sessionName(s), color: COLORS[i % COLORS.length], order: base + i, note: t('advisor.plan.estimate', { min: s.estMinutes }),
      items: s.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets, reps: it.repsMin, repsMax: it.repsMax, restSec: it.restSec })),
    }))
    await db.routines.bulkAdd(routines)
    setSaved(true)
    nav('/')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('advisor.plan.intro')}</p>
      <Chips<Goal> label={t('advisor.plan.goal')} value={profile.goal} onChange={(goal) => set({ goal })} options={GOALS.map((g) => ({ v: g, label: t(`advisor.goals.${g}`) }))} />
      <Chips<Level> label={t('advisor.plan.level')} value={profile.level} onChange={(level) => set({ level, machines: level === 'beginner' || level === 'hobby' })} options={LEVELS.map((l) => ({ v: l, label: t(`advisor.levels.${l}`) }))} />
      <Chips<number> label={t('advisor.plan.days')} value={profile.days} onChange={(days) => set({ days })} options={[1, 2, 3, 4, 5, 6].map((d) => ({ v: d, label: String(d) }))} />
      <label className="text-sm text-muted">{t('advisor.plan.minutes')}
        <NumField className="mt-1" value={profile.minutes} min={20} onCommit={(minutes) => set({ minutes: Math.round(minutes) })} label={t('advisor.plan.minutes')} />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={profile.machines} onChange={(e) => set({ machines: e.target.checked })} /> {t('advisor.plan.machines')}</label>
      <button className="btn btn-primary" onClick={create}>{t('advisor.plan.create')}</button>

      {plan && (
        <div className="flex flex-col gap-4" aria-label="plan">
          {plan.warnings.map((w, i) => <p key={i} className="card border-warn p-3 text-sm text-warn" role="alert">{t(`advisor.reasons.${w.key}`, w.params)}</p>)}
          <h2 className="font-semibold">{t('advisor.plan.sessions')}</h2>
          {plan.sessions.map((s, i) => (
            <section key={i} className="card p-3" aria-label={sessionName(s)}>
              <div className="mb-2 flex items-baseline justify-between"><h3 className="font-semibold">{sessionName(s)}</h3><span className="text-xs text-muted">{t('advisor.plan.estimate', { min: s.estMinutes })}</span></div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {s.items.map((it) => {
                  const ex = exMap.get(it.exerciseId)
                  return (
                    <li key={it.exerciseId} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">{ex ? exName(ex, lang) : it.exerciseId}</span>
                      <span className="shrink-0 tabular-nums text-muted">{t('advisor.plan.setsReps', { sets: it.sets, min: it.repsMin, max: it.repsMax })} · {it.restSec}s</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          <section className="card p-3">
            <h3 className="mb-2 font-semibold">{t('advisor.plan.weekly')}</h3>
            <ul className="flex flex-wrap gap-2">
              {Object.entries(plan.weekly).map(([g, reps]) => <li key={g} className="chip">{t(`advisor.groups.${g}`)}: {reps} · {t('advisor.plan.perWeek', { n: plan.frequency[g as keyof typeof plan.frequency] })}</li>)}
            </ul>
          </section>
          <details className="card p-3">
            <summary className="cursor-pointer font-semibold">{t('advisor.plan.why')}</summary>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm">
              {plan.reasons.map((r, i) => <li key={i}>{t(`advisor.reasons.${r.key}`, r.params)}</li>)}
            </ul>
          </details>
          <button className="btn btn-primary" onClick={save}>{saved ? t('advisor.plan.saved') : t('advisor.plan.save')}</button>
        </div>
      )}
    </div>
  )
}

// ---------- Stufe 2: Hinweise
function hintText(h: Hint, t: ReturnType<typeof useTranslation>['t'], name: (id?: string) => string, units: 'kg' | 'lb'): string {
  const p = h.params
  const group = h.group ? t(`advisor.groups.${h.group}`) : ''
  switch (h.kind) {
    case 'progress': return t(p.increase ? 'advisor.hints.progressUp' : 'advisor.hints.progressStay', { name: name(h.exerciseId), weight: toDisplay(Number(p.weight), units), unit: units, reps: p.reps, lo: p.lo, hi: p.hi })
    case 'plateau': return t('advisor.hints.plateau', { name: name(h.exerciseId), sessions: p.sessions })
    case 'deload': return t('advisor.hints.deload', { weeks: p.weeks })
    default: return t(`advisor.hints.${h.kind}`, { group, ...p })
  }
}

function HintsTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const profile = useProfile()
  const units = useSettings()?.units ?? 'kg'
  const exMap = useExerciseMap()
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray(), routines: await db.routines.toArray() }), [])
  const hints = useMemo(() => (data && profile ? computeHints({ ...data, exercises: exMap, level: profile.level, now: Date.now() }) : []), [data, profile, exMap])
  const name = (id?: string) => { const e = id ? exMap.get(id) : undefined; return e ? exName(e, lang) : (id ?? '') }
  const icon: Record<Hint['kind'], string> = { progress: '📈', plateau: '⏸️', volumeLow: '⬇️', volumeHigh: '⬆️', frequencyLow: '📅', frequencyHigh: '📅', deload: '🛌' }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">{t('advisor.hints.title')}</h2>
      {hints.length === 0 && <p className="text-sm text-muted">{t('advisor.hints.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {hints.slice(0, 12).map((h, i) => (
          <li key={i} className="card flex gap-3 p-3 text-sm"><span aria-hidden>{icon[h.kind]}</span><span>{hintText(h, t, name, units)}</span></li>
        ))}
      </ul>
    </div>
  )
}

/** Eingabefeld mit lokalem Zustand: speichert verzögert und beim Verlassen, damit Tippen nie auf die Datenbank warten muss. */
function SavedInput({ value, onSave, ...rest }: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [local, setLocal] = useState(value)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(local)
  const save = useRef(onSave)
  save.current = onSave
  useEffect(() => { setLocal(value); latest.current = value }, [value])
  const flush = () => { if (pending.current) { clearTimeout(pending.current); pending.current = null; save.current(latest.current) } }
  useEffect(() => flush, [])
  return (
    <input
      {...rest}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value)
        latest.current = e.target.value
        if (pending.current) clearTimeout(pending.current)
        pending.current = setTimeout(flush, 400)
      }}
      onBlur={flush}
    />
  )
}

// ---------- Stufe 3: Coach (OpenRouter)
function CoachTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const settings = useSettings()
  const profile = useProfile()
  const exMap = useExerciseMap()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [share, setShare] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [models, setModels] = useState<string[]>([])
  const abort = useRef<AbortController | null>(null)
  // Verbindungsbereich nur beim ersten Anzeigen offen, wenn noch kein Schlüssel da ist (klappt nicht beim Tippen zu)
  const [settingsOpen] = useState(() => !settings?.advisorKey.trim())

  if (!settings) return null
  const hasKey = settings.advisorKey.trim().length > 0

  const send = async (text: string) => {
    if (!text.trim() || busy || !hasKey) return
    setError('')
    setInput('')
    const history: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)
    abort.current = new AbortController()
    try {
      let context = ''
      if (share) {
        const [workouts, sets, body] = await Promise.all([db.workouts.toArray(), db.sets.toArray(), db.body.orderBy('date').toArray()])
        const bw = [...body].reverse().find((b) => b.values.weight)?.values.weight
        context = buildContext({ workouts, sets, exercises: exMap, lang, units: settings.units, now: Date.now(), bodyWeightKg: bw })
      }
      const sys: ChatMessage[] = [
        { role: 'system', content: systemPrompt(lang, profile ? { level: profile.level, goal: profile.goal } : undefined) },
        ...(context ? [{ role: 'system' as const, content: `${lang === 'de' ? 'Trainingsdaten des Nutzers' : 'User training data'}:\n${context}` }] : []),
      ]
      await streamChat({
        apiKey: settings.advisorKey, model: settings.advisorModel, messages: [...sys, ...history], signal: abort.current.signal,
        onDelta: (d) => setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + d } : x))),
      })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof OpenRouterError ? `${e.message}${e.status ? ` (${e.status})` : ''}` : (e as Error).message)
        setMessages((m) => (m[m.length - 1]?.content === '' ? m.slice(0, -1) : m))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <details className="card p-3" open={settingsOpen}>
        <summary className="cursor-pointer font-semibold">{t('advisor.coach.settings')}</summary>
        <div className="mt-3 flex flex-col gap-3">
          {!hasKey && <p className="text-sm text-warn">{t('advisor.coach.keyMissing')}</p>}
          <label className="text-sm text-muted">{t('settings.advisorKey')}
            <SavedInput className="field mt-1" type="password" autoComplete="off" placeholder="sk-or-…" value={settings.advisorKey} onSave={(advisorKey) => void saveSettings({ advisorKey })} aria-label={t('settings.advisorKey')} />
          </label>
          <p className="text-xs text-muted">{t('settings.advisorHint')}</p>
          <label className="text-sm text-muted">{t('advisor.coach.modelLabel')}
            <SavedInput className="field mt-1" list="or-models" value={settings.advisorModel} onSave={(advisorModel) => void saveSettings({ advisorModel })} aria-label={t('advisor.coach.modelLabel')} />
            <datalist id="or-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </label>
          <button className="btn" onClick={async () => { try { setModels(await listModels()) } catch (e) { setError((e as Error).message) } }}>{t('advisor.coach.loadModels')}</button>
        </div>
      </details>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> {t('advisor.coach.share')}</label>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {(['review', 'bench', 'plan', 'deload'] as const).map((k) => <button key={k} className="chip !px-3 !py-2 text-sm" disabled={!hasKey} onClick={() => void send(t(`advisor.coach.starters.${k}`))}>{t(`advisor.coach.starters.${k}`)}</button>)}
        </div>
      )}

      <ul className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${m.role === 'user' ? 'self-end bg-accent text-accent-fg' : 'card self-start'}`}>{m.content || '…'}</li>
        ))}
      </ul>
      {error && <p role="alert" className="card border-danger p-3 text-sm text-danger">{t('advisor.coach.error')}: {error}</p>}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input) }}>
        <input className="field flex-1" value={input} placeholder={t('advisor.coach.placeholder')} onChange={(e) => setInput(e.target.value)} disabled={!hasKey} aria-label={t('advisor.coach.placeholder')} />
        {busy ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>{t('advisor.coach.stop')}</button> : <button className="btn btn-primary" disabled={!hasKey || !input.trim()}>{t('advisor.coach.send')}</button>}
      </form>
      {messages.length > 0 && <button className="btn" onClick={() => { abort.current?.abort(); setMessages([]); setError('') }}>{t('advisor.coach.clear')}</button>}
      <p className="text-xs text-muted">{t('advisor.coach.disclaimer')}</p>
    </div>
  )
}
