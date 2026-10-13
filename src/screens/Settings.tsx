import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { db, exportBackup, importBackup, type BackupFile } from '../db'
import { NumField } from '../components/NumField'
import { FitHealth, isNativeApp, sendTestWorkout, syncRecent, type Availability, type SyncStatus } from '../lib/healthConnect'
import { saveSettings, useSettings } from '../lib/settings'
import type { Lang, Theme, Units } from '../types'

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-1 text-sm text-muted">{label}</div>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.v} role="radio" aria-checked={value === o.v} className={`btn flex-1 ${value === o.v ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => onChange(o.v)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

function HealthConnectSection() {
  const { t } = useTranslation()
  const s = useSettings()
  const status = useLiveQuery(async () => (await db.kv.get('healthSyncStatus'))?.value as SyncStatus | undefined, [])
  const [info, setInfo] = useState<{ availability: Availability; granted: boolean; grantedList?: string } | null>(null)
  const [msg, setMsg] = useState('')
  const native = isNativeApp()
  const refresh = () => FitHealth.status().then(setInfo).catch((e: Error) => setMsg(e.message))
  useEffect(() => { if (native) void refresh() }, [native])
  if (!s) return null
  if (!native) return <section className="card p-4 text-sm text-muted"><h2 className="mb-1 font-semibold text-fg">{t('health.title')}</h2>{t('health.webOnly')}</section>

  const connect = async () => {
    setMsg('')
    try {
      const r = await FitHealth.requestAccess()
      await saveSettings({ healthSync: r.granted })
      setMsg(r.granted ? t('health.connected') : t('health.denied'))
      await refresh()
    } catch (e) { setMsg((e as Error).message) }
  }
  const sendRecent = async () => {
    setMsg('')
    try { setMsg(t('health.sent', { count: await syncRecent(30) })) } catch (e) { setMsg((e as Error).message) }
  }
  const sendTest = async () => {
    setMsg('')
    try { await sendTestWorkout(); setMsg(t('health.testSent')) } catch (e) { setMsg(`${t('health.testFailed')}: ${(e as Error).message}`) }
  }
  const state = info?.availability === 'unavailable' ? t('health.unavailable') : info?.availability === 'update-required' ? t('health.update') : info?.granted ? t('health.on') : t('health.off')

  return (
    <section className="card flex flex-col gap-3 p-4" aria-label={t('health.title')}>
      <div><h2 className="font-semibold">{t('health.title')}</h2><p className="text-sm text-muted">{t('health.hint')}</p></div>
      <p className="text-sm"><span className="text-muted">{t('health.state')}: </span><b>{state}</b></p>
      {info?.availability === 'available' && !info.granted && <button className="btn btn-primary" onClick={connect}>{t('health.connect')}</button>}
      {info?.availability === 'available' && info.granted && (
        <>
          <label className="flex items-center justify-between gap-3 text-sm">{t('health.auto')}
            <input type="checkbox" className="size-6 accent-[var(--color-accent)]" checked={s.healthSync} onChange={(e) => void saveSettings({ healthSync: e.target.checked })} />
          </label>
          <button className="btn" onClick={sendRecent}>{t('health.sendRecent')}</button>
          <button className="btn" onClick={sendTest}>{t('health.sendTest')}</button>
        </>
      )}
      <button className="btn" onClick={() => void FitHealth.openSettings().catch((e: Error) => setMsg(e.message))}>{t('health.open')}</button>
      {info?.grantedList !== undefined && <p className="break-words text-xs text-muted">{t('health.granted')}: {info.grantedList || '–'}</p>}
      {status && <p className="break-words text-xs text-muted">{status.ok ? t('health.lastOk', { when: new Date(status.at).toLocaleString() }) : status.skipped ? t(`health.skipped_${status.skipped.replace('-', '_')}`) : t('health.lastError', { error: status.error })}</p>}
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      <p className="text-xs text-muted">{t('health.note')}</p>
    </section>
  )
}

export function SettingsScreen() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const s = useSettings()
  const count = useLiveQuery(() => db.exercises.count(), [])
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  if (!s) return null

  const doExport = async () => {
    const blob = new Blob([JSON.stringify(await exportBackup(), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fit-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const doImport = async (f: File) => {
    try {
      await importBackup(JSON.parse(await f.text()) as BackupFile)
      setMsg(t('settings.importDone'))
    } catch {
      setMsg(t('settings.importError'))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => nav('/more')} aria-label={t('common.back')}>←</button>
        <h1 className="text-3xl font-extrabold">{t('settings.title')}</h1>
      </div>
      <Choice<Lang> label={t('settings.language')} value={s.language} onChange={(language) => void saveSettings({ language })} options={[{ v: 'de', label: 'Deutsch' }, { v: 'en', label: 'English (US)' }]} />
      <Choice<Units> label={t('settings.units')} value={s.units} onChange={(units) => void saveSettings({ units })} options={[{ v: 'kg', label: 'kg' }, { v: 'lb', label: 'lb' }]} />
      <Choice<Theme> label={t('settings.theme')} value={s.theme} onChange={(theme) => void saveSettings({ theme })} options={[{ v: 'system', label: t('settings.system') }, { v: 'light', label: t('settings.light') }, { v: 'dark', label: t('settings.dark') }]} />
      <label className="text-sm text-muted">{t('settings.restDefault')}
        <NumField className="mt-1" value={s.restDefault} onCommit={(v) => void saveSettings({ restDefault: Math.round(v) })} label={t('settings.restDefault')} />
      </label>

      <label className="text-sm text-muted">{t('insights.goalSetting')}
        <NumField className="mt-1" value={s.weeklyGoal} min={1} onCommit={(v) => void saveSettings({ weeklyGoal: Math.min(7, Math.max(1, Math.round(v))) })} label={t('insights.goalSetting')} />
      </label>

      <HealthConnectSection />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('settings.backup')}</h2>
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={doExport}>{t('settings.export')}</button>
          <button className="btn flex-1" onClick={() => file.current?.click()}>{t('settings.import')}</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = '' }} />
        </div>
        {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
      </section>

      <section className="flex flex-col gap-1 text-sm text-muted">
        <h2 className="font-semibold text-fg">{t('settings.data')}</h2>
        <p>{t('settings.exercisesLoaded')}: {count ?? '…'}</p>
        <p>{t('settings.sources')}: free-exercise-db (Unlicense), wger (CC-BY-SA)</p>
      </section>
    </div>
  )
}
