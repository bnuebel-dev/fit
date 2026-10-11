import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../db'
import { CustomExerciseForm, ExerciseList } from '../components/ExercisePicker'
import { ExerciseImage } from '../components/ExerciseImage'
import { e1rm, toDisplay } from '../lib/calc'
import { useLang } from '../lib/hooks'
import { exInstructions, exName, exerciseImageUrl } from '../lib/names'
import { useSettings } from '../lib/settings'

export function Exercises() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [creating, setCreating] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav('/more')} aria-label={t('common.back')}>←</button>
        <h1 className="text-2xl font-bold">{creating ? t('exercises.create') : t('exercises.title')}</h1>
      </div>
      {creating
        ? <CustomExerciseForm onDone={(e) => { setCreating(false); if (e) nav(`/more/exercises/${e.id}`) }} />
        : <ExerciseList onPick={(e) => nav(`/more/exercises/${e.id}`)} onCreate={() => setCreating(true)} />}
    </div>
  )
}

export function ExerciseDetail() {
  const { t } = useTranslation()
  const lang = useLang()
  const nav = useNavigate()
  const units = useSettings()?.units ?? 'kg'
  const { id = '' } = useParams()
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  const hist = useLiveQuery(async () => {
    const sets = (await db.sets.where('exerciseId').equals(id).toArray()).filter((s) => s.done && s.type !== 'warmup')
    const workouts = await db.workouts.bulkGet([...new Set(sets.map((s) => s.workoutId))])
    const started = new Map(workouts.filter((w) => w?.endedAt !== undefined).map((w) => [w!.id!, w!.startedAt]))
    const byWorkout = new Map<number, number>()
    let best = { weight: 0, reps: 0, e1rm: 0 }
    for (const s of sets) {
      if (!started.has(s.workoutId)) continue
      const v = e1rm(s.weight, s.reps)
      byWorkout.set(s.workoutId, Math.max(byWorkout.get(s.workoutId) ?? 0, v))
      if (v > best.e1rm) best = { weight: s.weight, reps: s.reps, e1rm: v }
    }
    const points = [...byWorkout.entries()].map(([wid, v]) => ({ at: started.get(wid)!, e1rm: v })).sort((a, b) => a.at - b.at)
    return { best, points }
  }, [id])
  const [img, setImg] = useState(0)

  if (ex === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (!ex) return <p className="text-muted">{t('common.empty')}</p>
  const steps = exInstructions(ex, lang)
  const enFallback = lang === 'de' && !ex.instructions.de && !!ex.instructions.en

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav(-1)} aria-label={t('common.back')}>←</button>
        <h1 className="flex-1 text-xl font-bold">{exName(ex, lang)}</h1>
        <button className="btn" aria-pressed={!!ex.favorite} aria-label={t('exercises.favorites')} onClick={() => db.exercises.update(ex.id, { favorite: ex.favorite ? 0 : 1 })}>{ex.favorite ? '★' : '☆'}</button>
      </div>

      {ex.images.length > 0 && (
        <button className="card overflow-hidden" onClick={() => setImg((i) => (i + 1) % ex.images.length)} aria-label="image">
          <img src={exerciseImageUrl(ex.images[img])} alt={exName(ex, lang)} className="w-full object-contain" />
        </button>
      )}
      {ex.images.length === 0 && <div className="self-start"><ExerciseImage ex={ex} size={96} /></div>}

      <div className="flex flex-wrap gap-2">
        {ex.primaryMuscles.map((m) => <span key={m} className="chip !bg-accent !text-accent-fg">{t(`muscle.${m}`)}</span>)}
        {ex.secondaryMuscles.map((m) => <span key={m} className="chip">{t(`muscle.${m}`)}</span>)}
        {ex.equipment.map((q) => <span key={q} className="chip">{t(`equip.${q}`, { defaultValue: q })}</span>)}
        {ex.machine ? <span className="chip">{t('equip.machine')}</span> : null}
        <span className="chip">{t(`category.${ex.category}`, { defaultValue: ex.category })}</span>
      </div>

      <section className="card p-3">
        <h2 className="mb-2 font-semibold">{t('exercises.instructions')}</h2>
        {steps.length === 0 ? <p className="text-sm text-muted">{t('exercises.noInstructions')}</p> : (
          <>
            {enFallback && <p className="mb-2 text-xs text-muted">{t('exercises.fallbackEn')}</p>}
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </>
        )}
      </section>

      <section className="card p-3">
        <h2 className="mb-2 font-semibold">{t('exercises.history')}</h2>
        {!hist || hist.points.length === 0 ? <p className="text-sm text-muted">{t('exercises.noHistory')}</p> : (
          <>
            <div className="mb-2 text-sm">
              <span className="text-muted">{t('exercises.bestSet')}:</span> {toDisplay(hist.best.weight, units)} {units} × {hist.best.reps}
              {' · '}<span className="text-muted">{t('exercises.est1rm')}:</span> {Math.round(toDisplay(hist.best.e1rm, units))} {units}
            </div>
            {hist.points.length > 1 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hist.points.map((p) => ({ date: new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(p.at), v: Math.round(toDisplay(p.e1rm, units)) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} width={40} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12 }} />
                    <Line type="monotone" dataKey="v" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {ex.id.startsWith('u-') && (
        <button className="btn btn-danger" onClick={async () => { if (confirm(t('common.confirmDelete'))) { await db.exercises.delete(ex.id); nav('/more/exercises') } }}>{t('common.delete')}</button>
      )}
    </div>
  )
}
