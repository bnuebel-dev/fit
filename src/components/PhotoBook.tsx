import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../db'
import { shrinkImage } from '../lib/image'
import type { Photo } from '../types'
import { Sheet } from './Sheet'

const today = () => new Date().toISOString().slice(0, 10)

/** Fotobuch: Fortschrittsfotos bleiben auf dem Gerät (verkleinert in IndexedDB) und sind Teil des Backups. */
export function PhotoBook() {
  const { t } = useTranslation()
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), [])
  const input = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<Photo | null>(null)
  const [compare, setCompare] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setError('')
    try {
      for (const f of Array.from(files)) await db.photos.add({ date: today(), data: await shrinkImage(f) })
    } catch {
      setError(t('photos.error'))
    } finally {
      setBusy(false)
    }
  }
  const byId = (id: number) => photos?.find((p) => p.id === id)
  const pair = compare && compare.length === 2 ? compare.map(byId) : null

  return (
    <section className="flex flex-col gap-3" aria-label={t('photos.title')}>
      <div className="flex items-center justify-between">
        <h2 className="section-title !mt-0">{t('photos.title')}</h2>
        <div className="flex gap-2">
          {photos && photos.length >= 2 && (
            <button className={`btn !min-h-9 !px-3 ${compare ? 'btn-primary' : ''}`} onClick={() => setCompare(compare ? null : [])}>{t('photos.compare')}</button>
          )}
          <button className="btn !min-h-9 !px-3" onClick={() => input.current?.click()} disabled={busy}>+ {t('photos.add')}</button>
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {compare && <p className="text-sm text-muted">{t('photos.compareHint', { n: compare.length })}</p>}
      {photos && photos.length === 0 && <p className="text-sm text-muted">{t('photos.empty')}</p>}
      <ul className="grid grid-cols-3 gap-2">
        {photos?.map((p) => {
          const picked = compare?.includes(p.id!)
          return (
            <li key={p.id}>
              <button className={`relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-surface2 ${picked ? 'ring-2 ring-accent' : ''}`} aria-label={`${t('photos.photo')} ${p.date}`}
                onClick={() => {
                  if (!compare) return setView(p)
                  setCompare(picked ? compare.filter((i) => i !== p.id) : [...compare, p.id!].slice(-2))
                }}>
                <img src={p.data} alt="" className="size-full object-cover" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[11px] text-white">{p.date}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {view && (
        <Sheet title={view.date} onClose={() => setView(null)} full>
          <img src={view.data} alt={`${t('photos.photo')} ${view.date}`} className="mx-auto max-h-[60vh] rounded-2xl" />
          <button className="btn btn-danger mt-3 w-full" onClick={async () => { if (confirm(t('common.confirmDelete'))) { await db.photos.delete(view.id!); setView(null) } }}>{t('common.delete')}</button>
        </Sheet>
      )}
      {pair && pair[0] && pair[1] && (
        <Sheet title={t('photos.compare')} onClose={() => setCompare(null)} full>
          <div className="grid grid-cols-2 gap-2">
            {[...pair].sort((a, b) => a!.date.localeCompare(b!.date)).map((p) => (
              <figure key={p!.id}><img src={p!.data} alt={`${t('photos.photo')} ${p!.date}`} className="w-full rounded-2xl" /><figcaption className="mt-1 text-center text-sm text-muted">{p!.date}</figcaption></figure>
            ))}
          </div>
        </Sheet>
      )}
    </section>
  )
}
