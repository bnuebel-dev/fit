import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db'
import { computeHints } from '../lib/advisor/hints'
import { HINT_ICON, hintText } from '../lib/advisor/hintText'
import { OpenRouterError, buildContext, listModels, streamChat, systemPrompt, type ChatMessage } from '../lib/advisor/openrouter'
import { createPlan, suggestWeekdays, type Plan } from '../lib/advisor/planner'
import { QUESTIONS, defaultAnswers, planToText, toPlanInput, type Answers } from '../lib/advisor/wizard'
import { saveProfile, useProfile } from '../lib/advisor/profile'
import { useLang } from '../lib/hooks'
import { exName } from '../lib/names'
import { saveSettings, useSettings } from '../lib/settings'
import { useExerciseMap } from '../lib/useExercises'
import type { Routine } from '../types'

type Tab = 'plan' | 'hints' | 'coach'
const COLORS = ['#f59e0b', '#ef4444', '#a78bfa', '#facc15', '#34d399', '#38bdf8']

export function Advisor() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const initial = (['plan', 'hints', 'coach'] as Tab[]).find((x) => x === params.get('tab')) ?? 'plan'
  const [tab, setTab] = useState<Tab>(initial)
  const [seed, setSeed] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('advisor.title')}</h1>
      <div className="flex gap-2" role="tablist">
        {(['plan', 'hints', 'coach'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`btn flex-1 ${tab === x ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setTab(x)}>{t(`advisor.tabs.${x}`)}</button>
        ))}
      </div>
      {tab === 'plan' && <PlanTab onRefine={(text) => { setSeed(text); setTab('coach') }} />}
      {tab === 'hints' && <HintsTab />}
      {tab === 'coach' && <CoachTab seed={seed} onSeedUsed={() => setSeed(null)} />}
    </div>
  )
}

// ---------- Stufe 1: Planer im Frage-Antwort-Modus
function sessionTitle(s: Plan['sessions'][number], t: ReturnType<typeof useTranslation>['t']): string {
  return `${t(`advisor.session.${s.kind}`)}${s.label ? ` ${s.label}` : ''}`
}

function PlanTab({ onRefine }: { onRefine: (text: string) => void }) {
  const { t } = useTranslation()
  const profile = useProfile()
  const [step, setStep] = useState(-1) // -1 Einstieg, 0..4 Fragen, 5 Ergebnis
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  if (!profile) return null

  const start = () => { setAnswers(defaultAnswers(profile)); setStep(0) }
  const finish = (a: Answers) => {
    const input = toPlanInput(a)
    void saveProfile(input)
    setPlan(createPlan(input))
    setStep(QUESTIONS.length)
  }

  if (step < 0 || !answers) {
    return (
      <div className="card flex flex-col gap-4 p-5">
        <div className="text-3xl" aria-hidden>🧠</div>
        <h2 className="text-lg font-semibold">{t('wizard.title')}</h2>
        <p className="text-sm text-muted">{t('wizard.intro')}</p>
        <button className="btn btn-primary" onClick={start}>{t('wizard.start')}</button>
      </div>
    )
  }

  if (step >= QUESTIONS.length && plan) {
    return (
      <PlanResult
        plan={plan}
        answers={answers}
        onChange={() => setStep(0)}
        onRestart={() => { setPlan(null); setAnswers(null); setStep(-1) }}
        onRefine={onRefine}
      />
    )
  }

  const q = QUESTIONS[step]
  const last = step === QUESTIONS.length - 1
  const optKey = (v: string | number) => (q.id === 'days' ? `d${v}` : q.id === 'minutes' ? `m${v}` : String(v))
  return (
    <div className="flex flex-col gap-4" aria-label={t('wizard.title')}>
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted"><span>{t('wizard.step', { n: step + 1, total: QUESTIONS.length })}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
        </div>
      </div>
      <h2 className="text-xl font-bold">{t(`wizard.q.${q.id}.title`)}</h2>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t(`wizard.q.${q.id}.title`)}>
        {q.options.map((v) => {
          const [label, desc] = t(`wizard.q.${q.id}.${optKey(v)}`, { returnObjects: true }) as unknown as string[]
          const selected = answers[q.id] === v
          return (
            <button key={String(v)} role="radio" aria-checked={selected} onClick={() => setAnswers({ ...answers, [q.id]: v })}
              className={`card flex flex-col items-start p-4 text-left ${selected ? '!border-accent bg-accent/10' : ''}`}>
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-muted">{desc}</span>
            </button>
          )
        })}
      </div>
      <details className="card p-3">
        <summary className="cursor-pointer text-sm font-semibold">{t('wizard.why')}</summary>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(`wizard.q.${q.id}.why`)}</p>
      </details>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={() => setStep(step === 0 ? -1 : step - 1)}>{t('wizard.back')}</button>
        <button className="btn btn-primary flex-1" onClick={() => (last ? finish(answers) : setStep(step + 1))}>{last ? t('wizard.showPlan') : t('wizard.next')}</button>
      </div>
    </div>
  )
}

function PlanResult({ plan, answers, onChange, onRestart, onRefine }: { plan: Plan; answers: Answers; onChange: () => void; onRestart: () => void; onRefine: (text: string) => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const exMap = useExerciseMap()
  const [saved, setSaved] = useState(false)
  const [equipmentLabel] = t(`wizard.q.equipment.${answers.equipment}`, { returnObjects: true }) as unknown as string[]
  const name = (id: string) => { const e = exMap.get(id); return e ? exName(e, lang) : id }

  const save = async () => {
    const base = Date.now()
    const routines: Routine[] = plan.sessions.map((s, i) => ({
      name: sessionTitle(s, t), color: COLORS[i % COLORS.length], order: base + i, weekday: suggestWeekdays(plan.input.days)[i], note: t('advisor.plan.estimate', { min: s.estMinutes }),
      items: s.items.map((it) => ({ exerciseId: it.exerciseId, sets: it.sets, reps: it.repsMin, repsMax: it.repsMax, restSec: it.restSec })),
    }))
    await db.routines.bulkAdd(routines)
    setSaved(true)
    nav('/')
  }

  return (
    <div className="flex flex-col gap-4" aria-label="plan">
      <div className="card border-accent bg-accent/10 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">{t('wizard.summary')}</div>
        <p className="mt-1 font-semibold">{t('wizard.result', { days: plan.input.days, split: t(`wizard.splits.${plan.split}`), minutes: plan.input.minutes, goal: t(`advisor.goals.${answers.goal}`) })}</p>
        <p className="text-sm text-muted">{t(`advisor.levels.${plan.input.level}`)} · {equipmentLabel}</p>
      </div>
      {plan.warnings.map((w, i) => <p key={i} className="card border-warn p-3 text-sm text-warn" role="alert">{t(`advisor.reasons.${w.key}`, w.params)}</p>)}
      <h2 className="font-semibold">{t('advisor.plan.sessions')}</h2>
      {plan.sessions.map((s, i) => (
        <section key={i} className="card p-3" aria-label={sessionTitle(s, t)}>
          <div className="mb-2 flex items-baseline justify-between"><h3 className="font-semibold">{sessionTitle(s, t)}</h3><span className="text-xs text-muted">{t('advisor.plan.estimate', { min: s.estMinutes })}</span></div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.items.map((it) => (
              <li key={it.exerciseId} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{name(it.exerciseId)}</span>
                <span className="shrink-0 tabular-nums text-muted">{t('advisor.plan.setsReps', { sets: it.sets, min: it.repsMin, max: it.repsMax })} · {it.restSec}s</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card p-3">
        <h3 className="mb-2 font-semibold">{t('advisor.plan.weekly')}</h3>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(plan.weekly).map(([g, reps]) => <li key={g} className="chip">{t(`advisor.groups.${g}`)}: {reps} · {t('advisor.plan.perWeek', { n: plan.frequency[g as keyof typeof plan.frequency] })}</li>)}
        </ul>
      </section>
      <details className="card p-3" open>
        <summary className="cursor-pointer font-semibold">{t('advisor.plan.why')}</summary>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm">
          {plan.reasons.map((r, i) => <li key={i}>{t(`advisor.reasons.${r.key}`, r.params)}</li>)}
        </ul>
      </details>
      <button className="btn btn-primary" onClick={save}>{saved ? t('advisor.plan.saved') : t('advisor.plan.save')}</button>
      <button className="btn" onClick={() => onRefine(`${t('wizard.refineMessage')}\n\n${planToText(plan, name, (s) => sessionTitle(s, t))}`)}>🧠 {t('wizard.refine')}</button>
      <p className="-mt-2 text-xs text-muted">{t('wizard.refineHint')}</p>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={onChange}>{t('wizard.change')}</button>
        <button className="btn flex-1" onClick={onRestart}>{t('wizard.restart')}</button>
      </div>
    </div>
  )
}

// ---------- Stufe 2: Hinweise
function HintsTab() {
  const { t } = useTranslation()
  const lang = useLang()
  const profile = useProfile()
  const units = useSettings()?.units ?? 'kg'
  const exMap = useExerciseMap()
  const data = useLiveQuery(async () => ({ workouts: await db.workouts.toArray(), sets: await db.sets.toArray(), routines: await db.routines.toArray() }), [])
  const hints = useMemo(() => (data && profile ? computeHints({ ...data, exercises: exMap, level: profile.level, now: Date.now() }) : []), [data, profile, exMap])
  const name = (id?: string) => { const e = id ? exMap.get(id) : undefined; return e ? exName(e, lang) : (id ?? '') }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">{t('advisor.hints.title')}</h2>
      {hints.length === 0 && <p className="text-sm text-muted">{t('advisor.hints.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {hints.slice(0, 12).map((h, i) => (
          <li key={i} className="card flex gap-3 p-3 text-sm"><span aria-hidden>{HINT_ICON[h.kind]}</span><span>{hintText(h, t, name, units)}</span></li>
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
function CoachTab({ seed, onSeedUsed }: { seed: string | null; onSeedUsed: () => void }) {
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
  useEffect(() => { if (seed) { setInput(seed); onSeedUsed() } }, [seed, onSeedUsed])
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
        <textarea className="field max-h-40 flex-1 py-2" rows={input.includes('\n') ? 6 : 1} value={input} placeholder={t('advisor.coach.placeholder')} onChange={(e) => setInput(e.target.value)} disabled={!hasKey} aria-label={t('advisor.coach.placeholder')} />
        {busy ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>{t('advisor.coach.stop')}</button> : <button className="btn btn-primary" disabled={!hasKey || !input.trim()}>{t('advisor.coach.send')}</button>}
      </form>
      {messages.length > 0 && <button className="btn" onClick={() => { abort.current?.abort(); setMessages([]); setError('') }}>{t('advisor.coach.clear')}</button>}
      <p className="text-xs text-muted">{t('advisor.coach.disclaimer')}</p>
    </div>
  )
}
