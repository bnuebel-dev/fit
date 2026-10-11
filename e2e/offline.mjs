// E2E: Die installierte App muss ohne Netz laufen (Service Worker + lokale Datenbank).
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const PORT = 4177
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const base = `http://localhost:${PORT}${process.env.VITE_BASE ?? '/'}`
for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }

let failed = 0
const eventually = async (fn, ms = 5000) => { const end = Date.now() + ms; for (;;) { try { if (await fn()) return true } catch { /* nochmal */ } if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 100)) } }
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' – ' + extra : ''}`); if (!ok) failed++ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

try {
  await page.goto(base)
  await page.getByRole('heading', { name: 'Training' }).waitFor()
  // Übungen müssen in der Datenbank sein, dann auf aktiven Service Worker mit gefülltem Cache warten
  await page.goto(base + '#/more/exercises')
  await page.getByLabel('Suchen').waitFor()
  const ready = await eventually(async () => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    const keys = await caches.keys()
    let n = 0
    for (const k of keys) n += (await (await caches.open(k)).keys()).length
    return !!reg.active && n >= 5
  }), 15000)
  check('Service Worker aktiv und App-Dateien im Cache', ready)

  // --- Netz aus ---
  await ctx.setOffline(true)
  await page.goto(base)
  check('App startet offline (nach Neuladen)', await eventually(async () => (await page.getByRole('heading', { name: 'Training' }).count()) > 0))

  await page.getByRole('button', { name: 'Leeres Training starten' }).click()
  await page.getByRole('button', { name: /Übung hinzufügen/ }).click()
  await page.getByLabel('Suchen').fill('beinpresse')
  check('Übungsdatenbank funktioniert offline', await eventually(async () => (await page.locator('ul button').filter({ hasText: /^Beinpresse/ }).count()) > 0))
  await page.locator('ul button').filter({ hasText: /^Beinpresse/ }).first().click()
  await page.getByLabel('Gewicht').first().fill('120')
  await page.getByRole('button', { name: /Satz 1 ✓/ }).click()
  await page.getByRole('timer').waitFor()
  await page.getByRole('button', { name: 'Beenden' }).click()
  check('Training offline abgeschlossen', await eventually(async () => (await page.getByRole('heading', { name: /Training abgeschlossen/ }).count()) > 0))
  await page.getByRole('button', { name: 'OK' }).click()

  await page.goto(base + '#/history')
  check('Offline gespeichertes Training steht im Verlauf', await eventually(async () => (await page.getByText('Training').count()) > 0 && (await page.getByText(/1 Sätze/).count()) > 0))

  // --- Netz wieder an: Daten bleiben ---
  await ctx.setOffline(false)
  await page.reload()
  await page.getByRole('link', { name: 'Verlauf' }).click()
  check('Daten bleiben nach Rückkehr des Netzes erhalten', await eventually(async () => (await page.getByText(/1 Sätze/).count()) > 0))
  check('keine JS-Fehler', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  failed++
  console.log('FAIL  Abbruch:', e.message.split('\n')[0])
} finally {
  await browser.close()
  try { process.kill(-server.pid) } catch { /* schon beendet */ }
}
process.exit(failed ? 1 : 0)
