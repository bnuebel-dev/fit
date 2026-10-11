// Baut public/data/exercises.json aus free-exercise-db (Basis) und den wger-Fixtures
// (deutsche Namen/Beschreibungen) plus eigener Übersetzungs-/Ergänzungsdateien.
//
// Aufruf:
//   node scripts/build-exercises.mjs --fedb <exercises.json> --wger <wger/exercises/fixtures>
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
)
if (!args.fedb || !args.wger) {
  console.error('Usage: node scripts/build-exercises.mjs --fedb <file> --wger <fixtures dir>')
  process.exit(1)
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const optional = (p, fallback) => (existsSync(p) ? readJson(p) : fallback)

const fedb = readJson(args.fedb)
const wgerBase = readJson(join(args.wger, 'exercise-base-data.json'))
const wgerTr = readJson(join(args.wger, 'translations.json'))
const dataDir = new URL('../data/', import.meta.url).pathname
const deNames = optional(join(dataDir, 'de-names.json'), {}) // fedb-id -> deutscher Name
const deInstr = optional(join(dataDir, 'de-instructions.json'), {}) // fedb-id -> [Schritte]
const wgerMerge = optional(join(dataDir, 'wger-merge.json'), {}) // wger-Name (de) -> fedb-id (Dubletten)
const custom = optional(join(dataDir, 'custom-exercises.json'), []) // eigene Ergänzungen (z. B. Geräte aus den PDFs)

const WGER_MUSCLE = {
  1: 'biceps', 2: 'shoulders', 3: 'chest', 4: 'chest', 5: 'triceps', 6: 'abdominals', 7: 'calves',
  8: 'glutes', 9: 'traps', 10: 'quadriceps', 11: 'hamstrings', 12: 'lats', 13: 'biceps',
  14: 'abdominals', 15: 'calves', 16: 'lower back',
}
const WGER_EQUIP = {
  1: 'barbell', 2: 'e-z curl bar', 3: 'dumbbell', 4: 'body only', 5: 'exercise ball',
  6: 'other', 7: 'body only', 8: 'other', 9: 'other', 10: 'kettlebells', 11: 'bands', 12: 'cable',
}
const WGER_CAT_MUSCLE = { 10: 'abdominals', 11: 'chest', 12: 'lats', 13: 'shoulders', 14: 'calves', 9: 'quadriceps' }

const norm = (s) =>
  s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).map((w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w)).sort().join(' ')

const plain = (html) =>
  html.replace(/<li>/g, '\n').replace(/<\/p>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü').replace(/&szlig;/g, 'ß').replace(/&quot;/g, '"')
    .split('\n').map((l) => l.trim()).filter((l) => l.length > 2)

// ---- wger: Basis- und Übersetzungsdaten je Übung zusammenführen
const wger = new Map()
for (const b of wgerBase) wger.set(b.pk, { pk: b.pk, f: b.fields, en: null, de: null })
for (const t of wgerTr) {
  const w = wger.get(t.fields.exercise)
  if (!w) continue
  if (t.fields.language === 2) w.en = t.fields
  if (t.fields.language === 1) w.de = t.fields
}
const wgerByName = new Map()
for (const w of wger.values()) if (w.en?.name) wgerByName.set(norm(w.en.name), w)

const MACHINE_WORDS = /machine|leverage|smith|press$|lever|hack|cable|pulldown|pec deck|butterfly/i
const out = []
const usedWger = new Set()
let matched = 0

for (const e of fedb) {
  const w = wgerByName.get(norm(e.name))
  const deFromWger = w?.de?.name && w.de.name.length > 2 ? w.de.name : undefined
  if (w) usedWger.add(w.pk)
  if (deFromWger) matched++
  const deDesc = w?.de?.description ? plain(w.de.description) : []
  out.push({
    id: e.id,
    source: 'fedb',
    name: { en: e.name, ...((deNames[e.id] ?? deFromWger) ? { de: deNames[e.id] ?? deFromWger } : {}) },
    category: e.category,
    equipment: e.equipment ? [e.equipment] : [],
    machine: e.equipment === 'machine' || e.equipment === 'cable' || /smith|leverage|machine/i.test(e.name) ? 1 : 0,
    ...(e.level ? { level: e.level } : {}),
    ...(e.mechanic ? { mechanic: e.mechanic } : {}),
    ...(e.force ? { force: e.force } : {}),
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    instructions: {
      en: e.instructions,
      ...((deInstr[e.id] ?? (deDesc.length >= 1 && deDesc.join('').length > 40 ? deDesc : undefined))
        ? { de: deInstr[e.id] ?? deDesc } : {}),
    },
    images: e.images,
    favorite: 0,
  })
}

// ---- wger-Übungen mit deutschem Namen, die in free-exercise-db fehlen
let added = 0
let merged = 0
const byId = new Map(out.map((o) => [o.id, o]))
for (const w of wger.values()) {
  if (usedWger.has(w.pk) || !w.de?.name || w.de.name.length < 3) continue
  const target = byId.get(wgerMerge[w.de.name])
  if (target) {
    // Dublette: deutschen Namen als Suchbegriff und die deutsche Beschreibung als Anleitung übernehmen
    const alias = w.de.name
    if (alias !== target.name.de) target.aliases = [...new Set([...(target.aliases ?? []), alias])]
    const desc = w.de.description ? plain(w.de.description) : []
    if (!target.instructions.de && desc.join('').length > 40) target.instructions.de = desc
    merged++
    continue
  }
  const primary = [...new Set((w.f.muscles ?? []).map((m) => WGER_MUSCLE[m]).filter(Boolean))]
  if (!primary.length && WGER_CAT_MUSCLE[w.f.category]) primary.push(WGER_CAT_MUSCLE[w.f.category])
  if (!primary.length) continue
  const equipment = [...new Set((w.f.equipment ?? []).map((q) => WGER_EQUIP[q]).filter(Boolean))]
  const desc = w.de.description ? plain(w.de.description) : []
  out.push({
    id: `wger-${w.pk}`,
    source: 'wger',
    name: { en: w.en?.name ?? w.de.name, de: w.de.name },
    category: w.f.category === 15 ? 'cardio' : 'strength',
    equipment,
    machine: equipment.includes('cable') || MACHINE_WORDS.test(w.de.name) ? 1 : 0,
    primaryMuscles: primary,
    secondaryMuscles: [...new Set((w.f.muscles_secondary ?? []).map((m) => WGER_MUSCLE[m]).filter(Boolean))],
    instructions: { ...(desc.length ? { de: desc } : {}) },
    images: [],
    favorite: 0,
  })
  added++
}

// ---- eigene Ergänzungen (Geräte/Übungen aus den PDFs, die oben fehlen)
const ids = new Set(out.map((o) => o.id))
for (const c of custom) {
  if (ids.has(c.id)) continue
  out.push({ favorite: 0, images: [], secondaryMuscles: [], instructions: {}, equipment: [], machine: 0, ...c, source: 'custom' })
}

// Grundübungen/-geräte aus den PDFs bekommen ein Flag (bessere Sortierung in Liste und Suche)
const coverage = optional(join(dataDir, 'pdf-coverage.json'), [])
const core = new Set(coverage.filter((c) => c.core).map((c) => c.id))
for (const o of out) if (core.has(o.id)) o.core = 1
const missing = coverage.filter((c) => !out.some((o) => o.id === c.id))
if (missing.length) { console.error('Fehlende Referenz-Übungen:', missing.map((m) => m.term).join(', ')); process.exit(2) }

mkdirSync(join(new URL('../public/data/', import.meta.url).pathname), { recursive: true })
writeFileSync(new URL('../public/data/exercises.json', import.meta.url), JSON.stringify(out))
const de = out.filter((o) => o.name.de).length
console.log(`fedb: ${fedb.length}, davon mit dt. Namen aus wger-Abgleich: ${matched}`)
console.log(`wger zusätzlich: ${added}, als Dublette gemerged: ${merged}, custom: ${custom.length}`)
console.log(`gesamt: ${out.length}, mit deutschem Namen: ${de}, mit dt. Anleitung: ${out.filter((o) => o.instructions.de).length}`)
