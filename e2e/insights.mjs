// E2E für Kalorien, Wochenbericht, Serie, Kalender, Aufwärmsätze, Körperverlauf und Fotobuch.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const PORT = 4176
const shots = process.env.SHOTS ?? 'e2e/shots'
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const base = `http://localhost:${PORT}${process.env.VITE_BASE ?? '/'}`
for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }

let failed = 0
const eventually = async (fn, ms = 4000) => { const end = Date.now() + ms; for (;;) { try { if (await fn()) return true } catch { /* nochmal */ } if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)) } }
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' – ' + extra : ''}`); if (!ok) failed++ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()) })

// Daten direkt in IndexedDB schreiben (Datenbank 'fit' legt die App beim ersten Start an)
const seed = (data) => page.evaluate((d) => new Promise((resolve, reject) => {
  const open = indexedDB.open('fit')
  open.onerror = () => reject(open.error)
  open.onsuccess = () => {
    const db = open.result
    const tx = db.transaction(['workouts', 'sets', 'body', 'routines'], 'readwrite')
    for (const [store, rows] of Object.entries(d)) for (const row of rows) tx.objectStore(store).add(row)
    tx.oncomplete = () => { db.close(); resolve(true) }
    tx.onerror = () => reject(tx.error)
  }
}), data)

try {
  await page.goto(base)
  await page.getByRole('heading', { name: 'Training' }).waitFor()
  await eventually(async () => (await page.getByText('Willkommen bei Fit').count()) > 0)

  // drei Einheiten in dieser Woche (Mo–Mi, vor "jetzt"), eine in der Vorwoche, Gewicht 80 → 78
  const now = new Date()
  const monday = new Date(now); monday.setHours(8, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const at = (daysFromMonday, h = 0) => monday.getTime() + daysFromMonday * 86400000 + h * 3600000
  const starts = [at(-7), at(0), at(0, 24 * 0.01), at(0, 0.02)].map((t, i) => (i === 0 ? t : at(0) + i * 600000))
  const workouts = starts.map((s, i) => ({ name: `Einheit ${i + 1}`, routineId: undefined, startedAt: s, endedAt: s + 3600000, items: [{ exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', restSec: 90 }] }))
  const sets = []
  for (let i = 0; i < 4; i++) for (let k = 0; k < 12; k++) sets.push({ workoutId: i + 1, exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', order: k, weight: 60, reps: 8, type: 'normal', done: 1 })
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const body = [
    { date: iso(new Date(at(-14))), values: { weight: 80, waist: 90 } },
    { date: iso(new Date(at(-7))), values: { weight: 79, waist: 89 } },
    { date: iso(new Date(at(0))), values: { weight: 78, waist: 88 } },
  ]
  await seed({ workouts, sets, body })
  // Heute liegt der Montag eventuell in der Zukunft der Uhrzeit – egal, die Einheiten liegen immer in der laufenden Woche.

  // --- Statistik: Wochenbericht, Ziel, Serie, Kalorien
  await page.goto(base + '#/stats')
  await page.reload()
  await page.getByRole('heading', { name: 'Statistik' }).waitFor()
  check('Wochenbericht ist da', await eventually(async () => (await page.getByRole('region', { name: 'Wochenbericht' }).count()) > 0))
  const report = page.getByRole('region', { name: 'Wochenbericht' })
  check('Wochenziel 3 von 3 erreicht', await eventually(async () => (await report.getByText('3 / 3').count()) > 0))
  check('Serie: 1 Woche in Folge', await eventually(async () => (await report.getByText('1 Woche in Folge').count()) > 0))
  // 60 min, 12 Sätze, 78 kg → 0,2 Sätze/min = 3,5 MET → 273 kcal je Einheit
  check('Kalorien je Einheit werden aus Dauer und Körpergewicht geschätzt (3 × 273 = 819)', await eventually(async () => (await report.getByText('≈ 819').count()) > 0), (await report.innerText()).replace(/\s+/g, ' ').slice(0, 200))
  check('Kalorien-Diagramm und -Zeile in der Statistik', await eventually(async () => (await page.getByText('Geschätzter Verbrauch pro Woche (kcal)').count()) > 0))
  await page.screenshot({ path: `${shots}/20-stats.png`, fullPage: true })

  // --- Startseite: Wochenziel und Serie
  await page.goto(base + '#/')
  check('Startseite zeigt Wochenziel und Serie', await eventually(async () => (await page.getByText('3 / 3').count()) > 0 && (await page.getByText('1 Woche in Folge').count()) > 0))
  await page.screenshot({ path: `${shots}/21-home.png` })

  // --- Verlauf: Kalender und Kalorien
  await page.goto(base + '#/history')
  check('Verlauf: Kalender mit Trainingstagen', await eventually(async () => (await page.getByRole('region', { name: 'Trainingskalender' }).count()) > 0))
  check('Verlauf: Kalorien an der Einheit', await eventually(async () => (await page.getByText('≈ 273 kcal').count()) > 0))
  const before = await page.locator('ul li a').count()
  const dayBtn = page.getByRole('region', { name: 'Trainingskalender' }).locator('button[aria-pressed]:not([disabled])').first()
  await dayBtn.click()
  check('Tag antippen filtert die Liste', await eventually(async () => (await page.locator('ul li a').count()) < before), `${before} → ${await page.locator('ul li a').count()}`)
  await page.screenshot({ path: `${shots}/22-history.png` })

  // --- Körper: Verlauf wählbar, Fotobuch
  await page.goto(base + '#/body')
  check('Körper: Messwert wählbar (Taille)', await eventually(async () => (await page.getByRole('tab', { name: 'Taille' }).count()) > 0))
  await page.getByRole('tab', { name: 'Taille' }).click()
  check('Körper: Veränderung wird angezeigt (−2)', await eventually(async () => (await page.getByText('-2', { exact: true }).count()) > 0))
  // Foto aus einem erzeugten PNG hochladen
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }])
  check('Fotobuch: zwei Fotos gespeichert', await eventually(async () => (await page.getByRole('button', { name: /^Foto \d{4}-/ }).count()) === 2))
  await page.getByRole('button', { name: 'Vergleichen' }).click()
  const thumbs = page.getByRole('button', { name: /^Foto \d{4}-/ })
  await thumbs.nth(0).click(); await thumbs.nth(1).click()
  check('Fotobuch: Vergleich zeigt zwei Fotos', await eventually(async () => (await page.getByRole('dialog', { name: 'Vergleichen' }).locator('img').count()) === 2))
  await page.screenshot({ path: `${shots}/23-photos.png` })
  await page.getByRole('button', { name: 'Close' }).click()
  await thumbs.first().click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Löschen' }).click()
  check('Fotobuch: Foto löschen', await eventually(async () => (await page.getByRole('button', { name: /^Foto \d{4}-/ }).count()) === 1))

  // --- Aufwärmsätze im Training
  await page.goto(base + '#/')
  await page.getByRole('link', { name: /Neue Routine/ }).click()
  await page.getByLabel('Name der Routine').fill('Test')
  await page.getByRole('button', { name: /Übung hinzufügen/ }).click()
  await page.getByLabel('Suchen').fill('bankdrücken')
  await page.locator('ul button').filter({ hasText: /Bankdrücken/ }).first().click()
  await page.getByRole('button', { name: /Speichern/ }).click()
  await page.getByRole('button', { name: 'Test' }).click()
  await page.getByLabel('Gewicht').first().fill('100')
  await page.getByRole('button', { name: 'menu' }).click()
  await page.getByRole('button', { name: 'Aufwärmsätze einfügen' }).click()
  check('Aufwärmrampe 50/70/85 kg wird vor den Arbeitssätzen eingefügt', await eventually(async () => {
    const w = await page.getByLabel('Gewicht').evaluateAll((els) => els.map((e) => e.value))
    return w.slice(0, 4).join(',') === '50,70,85,100'
  }), (await page.getByLabel('Gewicht').evaluateAll((els) => els.map((e) => e.value))).join(','))
  await page.screenshot({ path: `${shots}/24-warmup.png` })
  await page.getByRole('button', { name: 'menu' }).click()
  check('Rampe lässt sich nicht doppelt einfügen', (await page.getByRole('button', { name: 'Aufwärmsätze einfügen' }).count()) === 0)
  await page.getByRole('button', { name: 'Close' }).click()

  // --- Wochenziel in den Einstellungen
  await page.goto(base + '#/more/settings')
  check('Einstellungen: Wochenziel einstellbar', await eventually(async () => (await page.getByLabel('Wochenziel (Trainings pro Woche)').count()) > 0))
  check('keine JS-Fehler', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  failed++
  console.log('FAIL  Abbruch:', e.message.split('\n')[0])
  await page.screenshot({ path: `${shots}/error-insights.png` }).catch(() => {})
} finally {
  await browser.close()
  try { process.kill(-server.pid) } catch { /* schon beendet */ }
}
process.exit(failed ? 1 : 0)
