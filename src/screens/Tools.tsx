import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { NumField } from '../components/NumField'
import { e1rm, formatDuration, oneRmTable, plates, toDisplay } from '../lib/calc'
import { useNow } from '../lib/hooks'
import { useSettings } from '../lib/settings'

function Header({ title }: { title: string }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => nav('/more')} aria-label={t('common.back')}>←</button>
      <h1 className="text-3xl font-extrabold">{title}</h1>
    </div>
  )
}

export function OneRm() {
  const { t } = useTranslation()
  const units = useSettings()?.units ?? 'kg'
  const [weight, setWeight] = useState(80)
  const [reps, setReps] = useState(8)
  const rm = e1rm(weight, reps)
  return (
    <div className="flex flex-col gap-4">
      <Header title={t('tools.oneRmTitle')} />
      <p className="text-sm text-muted">{t('tools.oneRmHint')}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">{units}<NumField className="mt-1" value={weight} onCommit={setWeight} label={t('common.weight')} /></label>
        <label className="text-sm text-muted">{t('common.reps')}<NumField className="mt-1" value={reps} min={1} onCommit={(v) => setReps(Math.round(v))} label={t('common.reps')} /></label>
      </div>
      <div className="card p-4 text-center">
        <div className="text-sm text-muted">{t('tools.est1rm')}</div>
        <div className="text-4xl font-bold tabular-nums">{Math.round(rm * 10) / 10} {units}</div>
      </div>
      {rm > 0 && (
        <table className="card w-full text-center text-sm tabular-nums">
          <thead className="text-xs text-muted"><tr><th className="p-2">{t('common.reps')}</th><th>{t('tools.percent')}</th><th>{units}</th></tr></thead>
          <tbody>
            {oneRmTable(rm).map((r) => (
              <tr key={r.reps} className="border-t border-line"><td className="p-2">{r.reps}</td><td>{r.percent}</td><td>{Math.round(toDisplay(r.weight, 'kg') * 10) / 10}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function Plates() {
  const { t } = useTranslation()
  const [target, setTarget] = useState(85)
  const [bar, setBar] = useState(20)
  const r = plates(target, bar)
  return (
    <div className="flex flex-col gap-4">
      <Header title={t('tools.platesTitle')} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">{t('tools.target')} (kg)<NumField className="mt-1" value={target} onCommit={setTarget} label={t('tools.target')} /></label>
        <label className="text-sm text-muted">{t('tools.bar')} (kg)<NumField className="mt-1" value={bar} onCommit={setBar} label={t('tools.bar')} /></label>
      </div>
      <div className="card p-4">
        <div className="mb-2 text-sm text-muted">{t('tools.perSide')}</div>
        <div className="flex flex-wrap items-center gap-2" aria-label={t('tools.perSide')}>
          {r.perSide.length === 0 && <span className="text-muted">–</span>}
          {r.perSide.flatMap((p) => Array.from({ length: p.count }, (_, i) => (
            <span key={`${p.plate}-${i}`} className="flex size-12 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">{p.plate}</span>
          )))}
        </div>
        <div className={`mt-3 text-sm ${r.remainder ? 'text-warn' : 'text-ok'}`}>{r.remainder ? `${t('tools.remainder')}: ${r.remainder} kg` : t('tools.exact')}</div>
      </div>
    </div>
  )
}

export function Stopwatch() {
  const { t } = useTranslation()
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [laps, setLaps] = useState<number[]>([])
  const startedAt = useRef(0)
  const now = useNow(100, running)
  useEffect(() => { if (running) setElapsed(now - startedAt.current) }, [now, running])
  const toggle = () => {
    if (running) { setRunning(false); return }
    startedAt.current = Date.now() - elapsed
    setRunning(true)
  }
  return (
    <div className="flex flex-col gap-4">
      <Header title={t('tools.stopwatchTitle')} />
      <div className="py-8 text-center text-6xl font-light tabular-nums" role="timer">{formatDuration(elapsed)}<span className="text-3xl text-muted">.{String(Math.floor((elapsed % 1000) / 100))}</span></div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" onClick={toggle}>{running ? t('tools.stop') : t('tools.start')}</button>
        <button className="btn flex-1" onClick={() => (running ? setLaps((l) => [elapsed, ...l]) : (setElapsed(0), setLaps([])))}>{running ? t('tools.lap') : t('tools.reset')}</button>
      </div>
      <ol className="flex flex-col gap-1 text-sm tabular-nums">
        {laps.map((l, i) => <li key={i} className="flex justify-between"><span className="text-muted">{laps.length - i}</span><span>{formatDuration(l)}</span></li>)}
      </ol>
    </div>
  )
}
