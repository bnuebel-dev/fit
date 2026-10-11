import { useTranslation } from 'react-i18next'
import type { Muscle } from '../types'

type View = 'front' | 'back'
interface Zone {
  muscle: Muscle
  view: View
  /** Pfad der linken Körperhälfte; wird für rechts gespiegelt */
  d: string
  /** nur einmal zeichnen (mittig) */
  center?: boolean
}

// Koordinatensystem je Ansicht: 120 × 250, Körpermitte bei x = 60
const ZONES: Zone[] = [
  // Vorderansicht
  { muscle: 'neck', view: 'front', center: true, d: 'M53,31 h14 v10 q-7,4 -14,0 z' },
  { muscle: 'shoulders', view: 'front', d: 'M34,44 q-12,2 -14,16 q4,6 12,2 q6,-6 8,-16 z' },
  { muscle: 'chest', view: 'front', d: 'M37,47 q12,-4 22,2 v20 q-12,5 -22,-3 q-4,-10 0,-19 z' },
  { muscle: 'abdominals', view: 'front', d: 'M41,74 q8,3 18,0 v44 q-10,6 -18,0 z' },
  { muscle: 'biceps', view: 'front', d: 'M19,64 q6,-3 11,-1 l-2,28 q-6,3 -11,0 z' },
  { muscle: 'forearms', view: 'front', d: 'M16,94 q6,2 11,0 l-5,38 q-5,2 -8,0 z' },
  { muscle: 'quadriceps', view: 'front', d: 'M43,130 q8,-4 16,0 l-2,48 q-7,6 -14,0 q-3,-24 0,-48 z' },
  { muscle: 'adductors', view: 'front', d: 'M58,132 h2 v34 q-4,-6 -4,-14 z' },
  { muscle: 'calves', view: 'front', d: 'M43,186 q7,-3 13,0 l-3,52 q-4,3 -8,0 q-4,-26 -2,-52 z' },
  // Rückansicht
  { muscle: 'neck', view: 'back', center: true, d: 'M53,31 h14 v8 q-7,4 -14,0 z' },
  { muscle: 'traps', view: 'back', d: 'M59,38 q-10,2 -22,10 l22,26 z' },
  { muscle: 'shoulders', view: 'back', d: 'M34,46 q-12,2 -14,16 q4,6 12,2 q6,-6 8,-16 z' },
  { muscle: 'lats', view: 'back', d: 'M38,64 l20,14 l-2,34 q-12,-4 -18,-26 z' },
  { muscle: 'middle back', view: 'back', d: 'M59,66 h-9 l2,26 h7 z' },
  { muscle: 'lower back', view: 'back', d: 'M59,94 h-9 l-2,24 q8,4 11,0 z' },
  { muscle: 'triceps', view: 'back', d: 'M19,64 q6,-3 11,-1 l-2,28 q-6,3 -11,0 z' },
  { muscle: 'forearms', view: 'back', d: 'M16,94 q6,2 11,0 l-5,38 q-5,2 -8,0 z' },
  { muscle: 'glutes', view: 'back', d: 'M59,122 q-14,-6 -20,4 q0,16 12,20 q8,-2 8,-12 z' },
  { muscle: 'abductors', view: 'back', d: 'M36,124 q-4,2 -4,8 q2,8 6,10 q-2,-8 -2,-18 z' },
  { muscle: 'hamstrings', view: 'back', d: 'M43,150 q8,-4 16,0 l-2,34 q-7,5 -14,0 q-3,-18 0,-34 z' },
  { muscle: 'calves', view: 'back', d: 'M43,188 q7,-3 13,0 l-3,50 q-4,3 -8,0 q-4,-24 -2,-50 z' },
]

export interface MuscleMapProps {
  /** Hauptmuskeln (volle Farbe) */
  primary?: Muscle[]
  /** Hilfsmuskeln (abgeschwächt) */
  secondary?: Muscle[]
  /** Intensität je Muskel 0..1 (z. B. Anteil in der Statistik); überschreibt primary/secondary */
  intensity?: Partial<Record<Muscle, number>>
  className?: string
}

export function muscleOpacity(m: Muscle, p: MuscleMapProps): number {
  if (p.intensity) return Math.min(1, Math.max(0, p.intensity[m] ?? 0))
  if (p.primary?.includes(m)) return 1
  if (p.secondary?.includes(m)) return 0.45
  return 0
}

function Body({ view, p }: { view: View; p: MuscleMapProps }) {
  const zones = ZONES.filter((z) => z.view === view)
  const draw = (z: Zone, mirrored: boolean, key: string) => {
    const o = muscleOpacity(z.muscle, p)
    return (
      <g key={key} transform={mirrored ? 'translate(120,0) scale(-1,1)' : undefined}>
        <path d={z.d} fill="var(--color-surface2)" stroke="var(--color-line)" strokeWidth="1" strokeLinejoin="round" />
        {o > 0 && <path d={z.d} fill="var(--color-accent)" fillOpacity={0.15 + 0.85 * o} stroke="none" />}
      </g>
    )
  }
  return (
    <svg viewBox="0 0 120 250" className="h-full w-full" aria-hidden>
      <circle cx="60" cy="16" r="13" fill="var(--color-surface2)" stroke="var(--color-line)" />
      <path d="M40,44 q20,-8 40,0 l6,28 l-6,50 q-20,8 -40,0 l-6,-50 z" fill="none" stroke="var(--color-line)" strokeDasharray="2 3" />
      {zones.map((z, i) => (z.center ? draw(z, false, `${i}`) : [draw(z, false, `${i}l`), draw(z, true, `${i}r`)]))}
    </svg>
  )
}

/** Vorder- und Rückansicht mit eingefärbten Muskelgruppen. */
export function MuscleMap(props: MuscleMapProps) {
  const { t } = useTranslation()
  const active = [...new Set(ZONES.map((z) => z.muscle))].filter((m) => muscleOpacity(m, props) > 0)
  const label = active.map((m) => t(`muscle.${m}`)).join(', ')
  return (
    <figure className={`flex gap-2 ${props.className ?? ''}`} role="img" aria-label={label || t('stats.muscles')}>
      <div className="aspect-[120/250] flex-1"><Body view="front" p={props} /></div>
      <div className="aspect-[120/250] flex-1"><Body view="back" p={props} /></div>
    </figure>
  )
}
