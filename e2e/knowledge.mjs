// E2E: Wissensbereich, Glossar, Kraftlevel und Energie-Rechner.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const PORT = 4176
const shots = process.env.SHOTS ?? 'e2e/shots'
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const base = `http://localhost:${PORT}${process.env.VITE_BASE ?? '/'}`
for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }

let failed = 0
const eventually = async (fn, ms = 3000) => { const end = Date.now() + ms; for (;;) { try { if (await fn()) return true } catch { /* nochmal */ } if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)) } }
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' – ' + extra : ''}`); if (!ok) failed++ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()) })

try {
  // --- Wissen
  await page.goto(base + '#/more')
  await page.getByRole('link', { name: 'Wissen', exact: true }).click()
  await page.getByRole('heading', { name: 'Wissen' }).waitFor()
  const cards = await page.locator('a[href^="#/more/knowledge/"]').count()
  check('Wissensliste zeigt Glossar und alle Artikel', cards >= 16, `${cards} Links`)
  await page.screenshot({ path: `${shots}/20-knowledge.png` })

  await page.getByLabel('Wissen durchsuchen').fill('deload')
  check('Suche findet Artikel zu Deload (Progression, Regeneration …)', await eventually(async () => (await page.getByText('Progression: stärker werden').count()) > 0))
  await page.getByLabel('Wissen durchsuchen').fill('quatschbegriffxyz')
  check('Suche ohne Treffer zeigt Hinweis', await eventually(async () => (await page.getByText('Nichts gefunden.').count()) > 0))
  await page.getByLabel('Wissen durchsuchen').fill('')

  // --- Artikel und Begriffs-Popup
  await page.getByRole('link', { name: /Progression: stärker werden/ }).click()
  await page.getByRole('heading', { name: 'Progression: stärker werden' }).first().waitFor()
  await page.getByRole('button', { name: 'Deload', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  check('Antippen eines Fachbegriffs zeigt die Erklärung', (await page.getByRole('dialog').innerText()).includes('leichtere Woche'))
  await page.screenshot({ path: `${shots}/21-term.png` })
  await page.getByRole('button', { name: 'Close' }).click()
  check('Artikel enthält Zahlenbeispiel doppelte Progression', (await page.getByText('82,5 kg: 6, 6, 6').count()) > 0)

  // --- Tabelle der Wiederholungsprozente in einem anderen Artikel + Werkzeug-Link
  await page.goto(base + '#/more/knowledge/volume-intensity')
  await page.getByRole('heading', { name: 'Volumen, Intensität und Wiederholungen' }).first().waitFor()
  check('Prozenttabelle (1 Wdh. = 100 %)', (await page.getByText(/1 Wdh\.: 100 %, 2: 96 %/).count()) > 0)
  await page.getByRole('link', { name: /1RM-Rechner/ }).click()
  await page.getByRole('heading', { name: '1RM-Rechner' }).waitFor()
  check('Werkzeug-Link führt zum 1RM-Rechner', true)

  // --- Glossar
  await page.goto(base + '#/more/knowledge/glossary')
  await page.getByRole('heading', { name: 'Glossar' }).waitFor()
  await page.getByLabel('Suchen').fill('rpe')
  check('Glossarsuche findet RPE', await eventually(async () => (await page.getByText('RPE (empfundene Anstrengung)').count()) > 0))

  // --- Kraftlevel (Beispiel aus dem Skript: 100 kg Mann, Kreuzheben 170 kg = fortgeschritten)
  await page.goto(base + '#/more/strength-level')
  await page.getByRole('heading', { name: 'Kraftlevel' }).waitFor()
  await page.getByLabel('Körpergewicht', { exact: true }).fill('100')
  await page.getByLabel('Kreuzheben Gewicht').fill('170')
  check('Kreuzheben 1,7× Körpergewicht = Fortgeschritten', await eventually(async () => (await page.getByRole('region', { name: 'Kreuzheben' }).getByText('Fortgeschritten').count()) > 0))
  check('Nächste Stufe ab 250 kg', await eventually(async () => (await page.getByText('Nächste Stufe ab 250 kg').count()) > 0))
  await page.getByLabel('Kniebeuge Gewicht').fill('100')
  check('Kniebeuge 1,0× Körpergewicht = Anfänger', await eventually(async () => (await page.getByRole('region', { name: 'Kniebeuge' }).getByText('Anfänger').count()) > 0))
  await page.screenshot({ path: `${shots}/22-strength.png` })

  // --- Energie (Mann, 30 J., 175 cm, 75 kg, sitzend, 3 h Sport: Grundumsatz 1771, Bedarf 2538)
  await page.goto(base + '#/more/energy')
  await page.getByRole('heading', { name: 'Energie, Makros und Puls' }).waitFor()
  check('Grundumsatz nach Harris-Benedict = 1771 kcal', await eventually(async () => (await page.getByText('1771 kcal').count()) > 0))
  check('Gesamtbedarf = 2538 kcal', await eventually(async () => (await page.getByText(/2538 kcal pro Tag/).count()) > 0))
  check('BMI 24,5 Normalgewicht', (await page.getByText('24.5 · Normalgewicht').count()) > 0 || (await page.getByText('24,5 · Normalgewicht').count()) > 0)
  check('Karvonen (30 J., Ruhepuls 60, 60 %: 60 + 130 × 0,6 = 138) = 135–141', await eventually(async () => (await page.getByText('135–141 Schläge pro Minute').count()) > 0))
  await page.screenshot({ path: `${shots}/23-energy.png`, fullPage: true })

  // --- Englisch
  await page.goto(base + '#/more/settings')
  await page.getByRole('radio', { name: 'English (US)' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  await page.goto(base + '#/more/knowledge/rest-tempo')
  check('Artikel auf Englisch', await eventually(async () => (await page.getByRole('heading', { name: 'Rest and tempo' }).count()) > 0))
  check('Englischer Fachbegriff-Link', (await page.getByRole('button', { name: 'Cadence', exact: true }).count()) > 0)

  check('keine JS-Fehler', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  failed++
  console.log('FAIL  Abbruch:', e.message.split('\n')[0])
  await page.screenshot({ path: `${shots}/error-knowledge.png` }).catch(() => {})
} finally {
  await browser.close()
  try { process.kill(-server.pid) } catch { /* schon beendet */ }
}
process.exit(failed ? 1 : 0)
