import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../db'
import { useLang } from '../lib/hooks'
import { exName, matchesQuery, searchRank } from '../lib/names'
import { MUSCLES, type Exercise, type Muscle } from '../types'
import { ExerciseImage } from './ExerciseImage'
import { Sheet } from './Sheet'

const PAGE = 60

export function ExerciseList({ onPick, onCreate }: { onPick: (ex: Exercise) => void; onCreate?: () => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const all = useLiveQuery(() => db.exercises.toArray(), [])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | ''>('')
  const [onlyMachines, setOnlyMachines] = useState(false)
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const list = useMemo(() => {
    if (!all) return []
    return all
      .filter((e) => (!muscle || e.primaryMuscles.includes(muscle)) && (!onlyMachines || e.machine) && (!onlyFavs || e.favorite) && matchesQuery(e, query))
      .sort((a, b) => b.favorite - a.favorite || searchRank(a, lang, query) - searchRank(b, lang, query) || exName(a, lang).localeCompare(exName(b, lang), lang))
  }, [all, query, muscle, onlyMachines, onlyFavs, lang])

  return (
    <div className="flex flex-col gap-3">
      <input className="field" type="search" placeholder={t('common.search')} value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} aria-label={t('common.search')} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className={`chip shrink-0 ${onlyFavs ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setOnlyFavs((v) => !v)}>★ {t('exercises.favorites')}</button>
        <button className={`chip shrink-0 ${onlyMachines ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setOnlyMachines((v) => !v)}>{t('exercises.onlyMachines')}</button>
        {MUSCLES.map((m) => (
          <button key={m} className={`chip shrink-0 ${muscle === m ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => { setMuscle(muscle === m ? '' : m); setShown(PAGE) }}>
            {t(`muscle.${m}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{list.length} {t('exercises.results')}</span>
        {onCreate && <button className="font-medium text-accent" onClick={onCreate}>+ {t('exercises.create')}</button>}
      </div>
      <ul className="flex flex-col gap-2">
        {list.slice(0, shown).map((e) => (
          <li key={e.id}>
            <button className="card flex w-full items-center gap-3 p-2 text-left active:opacity-70" onClick={() => onPick(e)}>
              <ExerciseImage ex={e} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{e.favorite ? '★ ' : ''}{exName(e, lang)}</div>
                <div className="truncate text-xs text-muted">
                  {e.primaryMuscles.map((m) => t(`muscle.${m}`)).join(', ')}
                  {e.equipment[0] ? ` · ${t(`equip.${e.equipment[0]}`, { defaultValue: e.equipment[0] })}` : ''}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {list.length > shown && <button className="btn" onClick={() => setShown((s) => s + PAGE)}>+ {t('common.all')}</button>}
    </div>
  )
}

export function ExercisePicker({ onPick, onClose }: { onPick: (ex: Exercise) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const [creating, setCreating] = useState(false)
  return (
    <Sheet title={creating ? t('exercises.create') : t('exercises.pick')} onClose={onClose} full>
      {creating ? <CustomExerciseForm onDone={(e) => (e ? onPick(e) : setCreating(false))} /> : <ExerciseList onPick={onPick} onCreate={() => setCreating(true)} />}
    </Sheet>
  )
}

export function CustomExerciseForm({ onDone }: { onDone: (ex: Exercise | null) => void }) {
  const { t } = useTranslation()
  const lang = useLang()
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState<Muscle>('chest')
  const [secondary, setSecondary] = useState<Muscle[]>([])
  const [machine, setMachine] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    const ex: Exercise = {
      id: `u-${Date.now().toString(36)}`,
      source: 'custom',
      name: lang === 'de' ? { en: name.trim(), de: name.trim() } : { en: name.trim() },
      category: 'strength',
      equipment: machine ? ['machine'] : [],
      machine: machine ? 1 : 0,
      primaryMuscles: [primary],
      secondaryMuscles: secondary,
      instructions: {},
      images: [],
      favorite: 0,
    }
    await db.exercises.add(ex)
    onDone(ex)
  }

  return (
    <div className="flex flex-col gap-3">
      <input className="field" placeholder={t('exercises.name')} value={name} onChange={(e) => setName(e.target.value)} aria-label={t('exercises.name')} />
      <label className="flex flex-col gap-1 text-sm text-muted">{t('exercises.primary')}
        <select className="field" value={primary} onChange={(e) => setPrimary(e.target.value as Muscle)}>
          {MUSCLES.map((m) => <option key={m} value={m}>{t(`muscle.${m}`)}</option>)}
        </select>
      </label>
      <div className="text-sm text-muted">{t('exercises.secondary')}</div>
      <div className="flex flex-wrap gap-2">
        {MUSCLES.filter((m) => m !== primary).map((m) => (
          <button key={m} className={`chip ${secondary.includes(m) ? '!bg-accent !text-accent-fg' : ''}`} onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}>
            {t(`muscle.${m}`)}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={machine} onChange={(e) => setMachine(e.target.checked)} /> {t('exercises.onlyMachines')}</label>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={() => onDone(null)}>{t('common.cancel')}</button>
        <button className="btn btn-primary flex-1" onClick={save} disabled={!name.trim()}>{t('common.save')}</button>
      </div>
    </div>
  )
}
