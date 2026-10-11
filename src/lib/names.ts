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

export function exerciseImageUrl(path: string): string {
  return `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${path}`
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
