import type { Exercise, Lang } from '../types'

export function exName(ex: Pick<Exercise, 'name'>, lang: Lang): string {
  return (lang === 'de' ? ex.name.de : undefined) ?? ex.name.en
}

export function exInstructions(ex: Pick<Exercise, 'instructions'>, lang: Lang): string[] {
  return (lang === 'de' ? ex.instructions.de : undefined) ?? ex.instructions.en ?? ex.instructions.de ?? []
}

const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')

/** Alle Suchwörter müssen in Name (de/en) oder Aliasen vorkommen; Umlaute und Akzente werden ignoriert. */
export function matchesQuery(ex: Exercise, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold([ex.name.en, ex.name.de ?? '', ...(ex.aliases ?? [])].join(' '))
  return words.every((w) => hay.includes(w))
}

/** Bildquellen in Reihenfolge: schnelles CDN, dann GitHub direkt als Rückfall. */
export const IMAGE_HOSTS = [
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/',
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/',
] as const

export function exerciseImageUrl(path: string, host = 0): string {
  return `${IMAGE_HOSTS[Math.min(host, IMAGE_HOSTS.length - 1)]}${path}`
}

/** Relevanz für die Sortierung bei aktiver Suche: Name beginnt mit dem Suchbegriff > kurzer Name > Rest. Kleiner = besser. */
export function searchRank(ex: Exercise, lang: Lang, query: string): number {
  const q = fold(query).trim()
  const boost = ex.core ? -5000 : 0
  if (!q) return boost
  const name = fold(exName(ex, lang))
  const starts = name.startsWith(q) ? 0 : name.split(/[\s(]+/).some((w) => w.startsWith(q)) ? 1 : 2
  return boost + starts * 1000 + name.length
}
