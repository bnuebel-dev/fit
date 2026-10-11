// Rendert die Muskelgrafik zur Sichtprüfung (Screenshot).
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 50; i++) { try { if ((await fetch('http://localhost:4174/')).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const page = await ctx.newPage()
await page.goto('http://localhost:4174/#/more/exercises/Barbell_Bench_Press_-_Medium_Grip')
await page.getByRole('img').first().waitFor()
await page.waitForTimeout(500)
await page.screenshot({ path: 'e2e/shots/muscles.png' })
await page.goto('http://localhost:4174/#/more/exercises/Romanian_Deadlift')
await page.waitForTimeout(500)
await page.screenshot({ path: 'e2e/shots/muscles2.png' })
await browser.close(); server.kill()
