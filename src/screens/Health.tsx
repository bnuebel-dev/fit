import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { NumField } from '../components/NumField'
import { e1rm, fromDisplay, toDisplay } from '../lib/calc'
import {
  PAL_WORK, bmi, bmiClass, bmrHarrisBenedict, energyNeed, macroSplit, palTotal, proteinRange, pulseHollmann, pulseKarvonen, hfMax, strengthLevel,
  type Lift, type ProteinProfile, type Sex, type WorkActivity,
} from '../lib/health'
import { useSettings } from '../lib/settings'

function Header({ title }: { title: string }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => nav('/more')} aria-label={t('common.back')}>←</button>
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  )
}

function SexChoice({ value, onChange }: { value: Sex; onChange: (s: Sex) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={t('tools.energy.sex')}>
      {(['male', 'female'] as Sex[]).map((s) => (
        <button key={s} role="radio" aria-checked={value === s} className={`btn flex-1 ${value === s ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => onChange(s)}>{t(`tools.strength.${s}`)}</button>
      ))}
    </div>
  )
}

/** Letzte gespeicherte Körperwerte (kg, cm). */
function useLatestBody(): { weight?: number; height?: number } | undefined {
  return useLiveQuery(async () => {
    const all = await db.body.orderBy('date').toArray()
    const last = (k: string) => [...all].reverse().find((e) => e.values[k] !== undefined)?.values[k]
    return { weight: last('weight'), height: last('height') }
  }, [])
}

const LIFTS: Lift[] = ['squat', 'bench', 'deadlift', 'press']
const LEVEL_COLOR = { beginner: 'bg-warn', advanced: 'bg-accent', pro: 'bg-ok' } as const

export function StrengthLevel() {
  const { t } = useTranslation()
  const units = useSettings()?.units ?? 'kg'
  const body = useLatestBody()
  const [sex, setSex] = useState<Sex>('male')
  const [bodyWeight, setBodyWeight] = useState<number | null>(null)
  const [sets, setSets] = useState<Record<Lift, { weight: number; reps: number }>>({
    squat: { weight: 0, reps: 1 }, bench: { weight: 0, reps: 1 }, deadlift: { weight: 0, reps: 1 }, press: { weight: 0, reps: 1 },
  })
  if (!body) return null
  const bwKg = bodyWeight ?? body.weight ?? 80
  const bwDisplay = toDisplay(bwKg, units)

  return (
    <div className="flex flex-col gap-4">
      <Header title={t('tools.strength.title')} />
      <p className="text-sm text-muted">{t('tools.strength.hint')}</p>
      <SexChoice value={sex} onChange={setSex} />
      <label className="text-sm text-muted">{t('tools.strength.bodyWeight')} ({units}){body.weight && bodyWeight === null ? ` · ${t('tools.strength.fromBody')}` : ''}
        <NumField className="mt-1" value={bwDisplay} onCommit={(v) => setBodyWeight(fromDisplay(v, units))} label={t('tools.strength.bodyWeight')} />
      </label>

      {LIFTS.map((lift) => {
        const s = sets[lift]
        const rmKg = s.weight > 0 ? e1rm(fromDisplay(s.weight, units), s.reps) : 0
        const r = rmKg > 0 ? strengthLevel(sex, lift, rmKg, bwKg) : null
        return (
          <section key={lift} className="card flex flex-col gap-3 p-3" aria-label={t(`tools.strength.${lift}`)}>
            <h2 className="font-semibold">{t(`tools.strength.${lift}`)}</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">{t('tools.strength.weight')} ({units})
                <NumField className="mt-1" value={s.weight} onCommit={(v) => setSets({ ...sets, [lift]: { ...s, weight: v } })} label={`${t(`tools.strength.${lift}`)} ${t('tools.strength.weight')}`} />
              </label>
              <label className="text-xs text-muted">{t('tools.strength.reps')}
                <NumField className="mt-1" min={1} value={s.reps} onCommit={(v) => setSets({ ...sets, [lift]: { ...s, reps: Math.max(1, Math.round(v)) } })} label={`${t(`tools.strength.${lift}`)} ${t('tools.strength.reps')}`} />
              </label>
            </div>
            {!r ? <p className="text-sm text-muted">{t('tools.strength.none')}</p> : (
              <div className="flex flex-col gap-1.5" role="status">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{t(`tools.strength.${r.level}`)}</span>
                  <span className="text-sm text-muted">{t('tools.strength.ratio', { r: (Math.round(r.ratio * 100) / 100).toLocaleString() })}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className={`h-full ${LEVEL_COLOR[r.level]}`} style={{ width: `${Math.round(r.progress * 100)}%` }} /></div>
                <div className="text-xs text-muted">
                  {t('tools.strength.est', { v: Math.round(toDisplay(rmKg, units)), unit: units })}
                  {' · '}{r.nextKg ? t('tools.strength.next', { v: Math.round(toDisplay(r.nextKg, units)), unit: units }) : t('tools.strength.top')}
                </div>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

type Goal = 'maintain' | 'lose' | 'gain'
const GOAL_FACTOR: Record<Goal, number> = { maintain: 1, lose: 0.85, gain: 1.1 }

export function Energy() {
  const { t } = useTranslation()
  const units = useSettings()?.units ?? 'kg'
  const body = useLatestBody()
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState(30)
  const [kgOverride, setKg] = useState<number | null>(null)
  const [cmOverride, setCm] = useState<number | null>(null)
  const [work, setWork] = useState<WorkActivity>('sitting')
  const [sport, setSport] = useState(3)
  const [goal, setGoal] = useState<Goal>('maintain')
  const [profile, setProfile] = useState<ProteinProfile>('beginner')
  const [rest, setRest] = useState(60)
  const [intensity, setIntensity] = useState(60)
  if (!body) return null

  const kg = kgOverride ?? body.weight ?? 75
  const cm = cmOverride ?? body.height ?? 175
  const bmr = bmrHarrisBenedict(sex, kg, cm, age)
  const pal = palTotal(PAL_WORK[work], 1.6, sport) // Freizeit überwiegend sitzend (1,6) plus Sport
  const total = Math.round(energyNeed(bmr, pal))
  const target = Math.round(total * GOAL_FACTOR[goal])
  const [pLo, pHi] = proteinRange(profile)
  const protein = (pLo + pHi) / 2 * kg
  const macros = macroSplit(target, protein)
  const bmiValue = bmi(kg, cm)
  const hk = pulseKarvonen(age, rest, intensity / 100)

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0"><span className="text-muted">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
  )

  return (
    <div className="flex flex-col gap-4">
      <Header title={t('tools.energy.title')} />
      <SexChoice value={sex} onChange={setSex} />
      <div className="grid grid-cols-3 gap-3">
        <label className="text-xs text-muted">{t('tools.energy.age')}<NumField className="mt-1" value={age} min={10} onCommit={(v) => setAge(Math.round(v))} label={t('tools.energy.age')} /></label>
        <label className="text-xs text-muted">{t('tools.energy.height')}<NumField className="mt-1" value={cm} onCommit={setCm} label={t('tools.energy.height')} /></label>
        <label className="text-xs text-muted">{t('tools.energy.weight')} ({units})<NumField className="mt-1" value={toDisplay(kg, units)} onCommit={(v) => setKg(fromDisplay(v, units))} label={t('tools.energy.weight')} /></label>
      </div>
      <label className="text-sm text-muted">{t('tools.energy.work')}
        <select className="field mt-1" value={work} onChange={(e) => setWork(e.target.value as WorkActivity)} aria-label={t('tools.energy.work')}>
          {(Object.keys(PAL_WORK) as WorkActivity[]).map((w) => <option key={w} value={w}>{t(`tools.energy.${w}`)}</option>)}
        </select>
      </label>
      <label className="text-sm text-muted">{t('tools.energy.sport')}<NumField className="mt-1" value={sport} onCommit={setSport} label={t('tools.energy.sport')} /></label>
      <label className="text-sm text-muted">{t('tools.energy.goal')}
        <select className="field mt-1" value={goal} onChange={(e) => setGoal(e.target.value as Goal)} aria-label={t('tools.energy.goal')}>
          {(['maintain', 'lose', 'gain'] as Goal[]).map((g) => <option key={g} value={g}>{t(`tools.energy.${g}`)}</option>)}
        </select>
      </label>

      <section className="card p-3" aria-label={t('tools.energy.total')}>
        <Row label={t('tools.energy.bmr')} value={`${Math.round(bmr)} kcal`} />
        <Row label={t('tools.energy.pal')} value={(Math.round(pal * 100) / 100).toLocaleString()} />
        <Row label={t('tools.energy.total')} value={`${total} ${t('tools.energy.perDay')}`} />
        <Row label={`${t('tools.energy.target')}: ${t(`tools.energy.${goal}`)}`} value={`${target} ${t('tools.energy.perDay')}`} />
      </section>

      <section className="card flex flex-col gap-3 p-3" aria-label={t('tools.energy.macros')}>
        <h2 className="font-semibold">{t('tools.energy.macros')}</h2>
        <label className="text-sm text-muted">{t('tools.energy.profile')}
          <select className="field mt-1" value={profile} onChange={(e) => setProfile(e.target.value as ProteinProfile)} aria-label={t('tools.energy.profile')}>
            {(['health', 'beginner', 'advanced', 'senior'] as ProteinProfile[]).map((p) => <option key={p} value={p}>{t(`tools.energy.${p}`)} ({proteinRange(p).join('–').replace(/^(\d+(?:\.\d+)?)–\1$/, '$1')} g/kg)</option>)}
          </select>
        </label>
        <div>
          <Row label={t('tools.energy.protein')} value={`${macros.proteinG} g`} />
          <Row label={t('tools.energy.fat')} value={`${macros.fatG[0]}–${macros.fatG[1]} g`} />
          <Row label={t('tools.energy.carbs')} value={`${macros.carbsG} g`} />
        </div>
      </section>

      <section className="card p-3" aria-label={t('tools.energy.bmi')}>
        <Row label={t('tools.energy.bmi')} value={`${bmiValue} · ${t(`tools.energy.${bmiClass(bmiValue)}`)}`} />
      </section>

      <section className="card flex flex-col gap-3 p-3" aria-label={t('tools.energy.pulse')}>
        <h2 className="font-semibold">{t('tools.energy.pulse')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">{t('tools.energy.rest')}<NumField className="mt-1" value={rest} onCommit={(v) => setRest(Math.round(v))} label={t('tools.energy.rest')} /></label>
          <label className="text-xs text-muted">{t('tools.energy.intensity')}<NumField className="mt-1" value={intensity} onCommit={(v) => setIntensity(Math.min(100, Math.round(v)))} label={t('tools.energy.intensity')} /></label>
        </div>
        <div>
          <Row label={t('tools.energy.hfmax')} value={`${hfMax(age)}`} />
          <Row label={t('tools.energy.hollmann')} value={`${pulseHollmann(age)} ${t('tools.energy.bpm')}`} />
          <Row label={t('tools.energy.karvonen')} value={`${hk.low}–${hk.high} ${t('tools.energy.bpm')}`} />
        </div>
      </section>
      <p className="text-xs text-muted">{t('tools.energy.disclaimer')}</p>
    </div>
  )
}
