// Ende-zu-Ende-Test im echten Chromium: Routine anlegen, trainieren, Verlauf/Statistik prüfen.
// Aufruf: npm run build && node e2e/smoke.mjs   (startet vite preview selbst)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 4173
const shots = process.env.SHOTS ?? 'e2e/shots'
mkdirSync(shots, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const base = `http://localhost:${PORT}${process.env.VITE_BASE ?? '/'}`
for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }

let failed = 0
// Wiederholt eine Bedingung bis zu 3 s – die Oberfläche rendert nach Datenbankzugriffen asynchron.
const eventually = async (fn, ms = 3000) => { const end = Date.now() + ms; for (;;) { try { if (await fn()) return true } catch { /* nochmal */ } if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)) } }
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' – ' + extra : ''}`); if (!ok) failed++ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()) })

try {
  await page.goto(base)
  await page.getByRole('heading', { name: 'Training' }).waitFor()
  check('App startet auf Deutsch', true)
  await page.screenshot({ path: `${shots}/01-home.png` })

  // Routine anlegen
  await page.getByRole('link', { name: /Neue Routine/ }).click()
  await page.getByLabel('Name der Routine').fill('Brust und Trizeps')
  await page.getByRole('button', { name: /Übung hinzufügen/ }).click()
  await page.getByLabel('Suchen').fill('bankdrücken')
  await page.locator('ul button').filter({ hasText: /Bankdrücken/ }).first().waitFor()
  const hits = await page.locator('ul button').filter({ hasText: /Bankdrücken/ }).count()
  check('Suche findet deutsche Übungsnamen', hits > 3, `${hits} Treffer`)
  await page.screenshot({ path: `${shots}/02-picker.png` })
  const first = await page.locator('ul button').filter({ hasText: /Bankdrücken/ }).first().innerText()
  check('Grundübung steht in der Suche ganz oben', first.split('\n')[0] === 'Bankdrücken Langhantel (mittlerer Griff)', first.split('\n')[0])
  await page.locator('ul button').filter({ hasText: /Bankdrücken/ }).first().click()
  await page.getByRole('button', { name: /Speichern/ }).click()
  await page.getByText('Brust und Trizeps').first().waitFor()
  check('Routine gespeichert', true)

  // Training starten und Satz abhaken
  await page.getByRole('button', { name: 'Brust und Trizeps' }).click()
  await page.getByRole('timer').count()
  const weight = page.getByLabel('Gewicht').first()
  await weight.fill('80')
  await page.getByLabel('Wdh.').first().fill('8')
  await page.getByRole('button', { name: /Satz 1 ✓/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('input[aria-label="Gewicht"]')[1]?.value === '80', null, { timeout: 3000 }).catch(() => {})
  check('Gewicht wird auf Folgesätze übernommen', (await page.getByLabel('Gewicht').nth(1).inputValue()) === '80')
  await page.getByRole('timer').waitFor()
  check('Pausentimer startet nach Abhaken', true)
  await page.screenshot({ path: `${shots}/03-workout.png` })
  await page.getByRole('button', { name: 'Beenden' }).click()
  await page.getByRole('heading', { name: /Training abgeschlossen/ }).waitFor()
  check('Zusammenfassung erscheint', await eventually(async () => await page.getByText('640 kg').count() > 0), 'Volumen 640 kg')
  await page.screenshot({ path: `${shots}/04-summary.png` })
  await page.getByRole('button', { name: 'OK' }).click()

  // Zweites Training: Vorwerte müssen erscheinen
  await page.getByRole('button', { name: 'Brust und Trizeps' }).click()
  await page.getByText('80×8').first().waitFor({ timeout: 5000 }).catch(() => {})
  check('Vorwerte der letzten Einheit sichtbar', await eventually(async () => await page.getByText('80×8').count() > 0))
  await page.getByRole('button', { name: 'Verwerfen' }).click().catch(() => {})
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Verwerfen' }).click().catch(() => {})
  await page.waitForTimeout(300)

  // Verlauf und Statistik
  await page.getByRole('link', { name: 'Verlauf' }).click()
  check('Verlauf zeigt Training', await eventually(async () => await page.getByText('Brust und Trizeps').count() > 0))
  await page.screenshot({ path: `${shots}/05-history.png` })
  await page.getByRole('link', { name: 'Statistik' }).click()
  await page.getByText('Muskelverteilung').waitFor()
  check('Statistik zeigt Muskelverteilung', await eventually(async () => await page.getByText('Brust', { exact: true }).count() > 0))
  await page.screenshot({ path: `${shots}/06-stats.png` })

  // Sprache umstellen, Rechner
  await page.getByRole('link', { name: 'Mehr' }).click()
  await page.getByRole('link', { name: /Einstellungen/ }).click()
  await page.getByRole('radio', { name: 'English (US)' }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  check('Sprachwechsel auf Englisch', true)
  await page.screenshot({ path: `${shots}/07-settings.png` })
  await page.getByRole('radio', { name: 'Deutsch' }).click()
  await page.getByRole('heading', { name: 'Einstellungen' }).waitFor()

  // Offline-Fähigkeit: nach Reload Daten noch da
  await page.goto(base)
  await page.reload()
  await page.getByRole('heading', { name: 'Training' }).waitFor()
  await page.getByRole('link', { name: 'Verlauf' }).click()
  check('Daten bleiben nach Reload erhalten', await eventually(async () => await page.getByText('Brust und Trizeps').count() > 0))

  check('keine JS-Fehler', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  failed++
  console.log('FAIL  Abbruch:', e.message.split('\n')[0])
  await page.screenshot({ path: `${shots}/error.png` }).catch(() => {})
} finally {
  await browser.close()
  try { process.kill(-server.pid) } catch { /* schon beendet */ }
}
process.exit(failed ? 1 : 0)
