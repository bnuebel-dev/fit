import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../db'
import { NumField } from '../components/NumField'
import { Sheet } from '../components/Sheet'
import { fromDisplay, toDisplay } from '../lib/calc'
import { useSettings } from '../lib/settings'

const FIELDS = ['weight', 'height', 'chest', 'waist', 'hips', 'bicepsL', 'bicepsR', 'thighL', 'thighR', 'neck', 'shoulders'] as const
type Field = (typeof FIELDS)[number]

export const todayIso = () => new Date().toISOString().slice(0, 10)

export function bmi(weightKg: number, heightCm: number): number {
  return heightCm > 0 ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : 0
}

export function Body() {
  const { t } = useTranslation()
  const units = useSettings()?.units ?? 'kg'
  const entries = useLiveQuery(() => db.body.orderBy('date').toArray(), [])
  const [editing, setEditing] = useState<{ id?: number; date: string; values: Record<string, number> } | null>(null)

  const latest = (f: Field) => [...(entries ?? [])].reverse().find((e) => e.values[f] !== undefined)?.values[f]
  const w = latest('weight')
  const h = latest('height')
  const chart = (entries ?? []).filter((e) => e.values.weight).map((e) => ({ date: e.date.slice(5), weight: toDisplay(e.values.weight, units) }))

  const label = (f: Field) => `${t(`body.${f}`)} (${f === 'weight' ? units : t('body.cm')})`
  const fmt = (f: Field, v: number) => (f === 'weight' ? toDisplay(v, units) : v)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t('body.title')}</h1>
        <button className="btn btn-primary" onClick={() => setEditing({ date: todayIso(), values: {} })}>+ {t('body.newEntry')}</button>
      </div>

      {w && h ? <div className="card p-3 text-sm"><span className="text-muted">{t('body.bmi')}:</span> <b>{bmi(w, h)}</b></div> : null}

      {chart.length > 1 && (
        <div className="card p-3">
          <h2 className="mb-2 font-semibold">{t('body.weight')} ({units})</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} width={40} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 12 }} />
                <Line type="monotone" dataKey="weight" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('body.history')}</h2>
      {entries && entries.length === 0 && <p className="text-muted">{t('body.empty')}</p>}
      <ul className="flex flex-col gap-2">
        {[...(entries ?? [])].reverse().map((e) => (
          <li key={e.id}>
            <button className="card w-full p-3 text-left" onClick={() => setEditing({ id: e.id, date: e.date, values: e.values })}>
              <div className="font-medium">{e.date}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {FIELDS.filter((f) => e.values[f] !== undefined).map((f) => <span key={f}>{t(`body.${f}`)}: {fmt(f, e.values[f])}</span>)}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <Sheet title={t('body.newEntry')} onClose={() => setEditing(null)} full>
          <div className="flex flex-col gap-3">
            <label className="text-sm text-muted">{t('body.date')}
              <input type="date" className="field mt-1" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </label>
            {FIELDS.map((f) => (
              <label key={f} className="text-sm text-muted">{label(f)}
                <NumField className="mt-1" value={editing.values[f] !== undefined ? fmt(f, editing.values[f]) : 0} min={0}
                  onCommit={(v) => setEditing((cur) => cur && { ...cur, values: { ...cur.values, [f]: v === 0 ? undefined! : f === 'weight' ? fromDisplay(v, units) : v } })}
                  label={t(`body.${f}`)} />
              </label>
            ))}
            <div className="flex gap-2">
              {editing.id && <button className="btn btn-danger" onClick={async () => { await db.body.delete(editing.id!); setEditing(null) }}>{t('common.delete')}</button>}
              <button className="btn btn-primary flex-1" onClick={async () => {
                const values = Object.fromEntries(Object.entries(editing.values).filter(([, v]) => typeof v === 'number' && v > 0))
                if (Object.keys(values).length) await db.body.put({ ...(editing.id ? { id: editing.id } : {}), date: editing.date, values })
                setEditing(null)
              }}>{t('common.save')}</button>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  )
}
