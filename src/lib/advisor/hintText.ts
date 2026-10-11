import type { TFunction } from 'i18next'
import { toDisplay } from '../calc'
import type { Hint } from './hints'

export const HINT_ICON: Record<Hint['kind'], string> = { progress: '📈', plateau: '⏸️', volumeLow: '⬇️', volumeHigh: '⬆️', frequencyLow: '📅', frequencyHigh: '📅', deload: '🛌' }

export function hintText(h: Hint, t: TFunction, name: (id?: string) => string, units: 'kg' | 'lb'): string {
  const p = h.params
  const group = h.group ? t(`advisor.groups.${h.group}`) : ''
  switch (h.kind) {
    case 'progress': return t(p.increase ? 'advisor.hints.progressUp' : 'advisor.hints.progressStay', { name: name(h.exerciseId), weight: toDisplay(Number(p.weight), units), unit: units, reps: p.reps, lo: p.lo, hi: p.hi })
    case 'plateau': return t('advisor.hints.plateau', { name: name(h.exerciseId), sessions: p.sessions })
    case 'deload': return t('advisor.hints.deload', { weeks: p.weeks })
    default: return t(`advisor.hints.${h.kind}`, { group, ...p })
  }
}
