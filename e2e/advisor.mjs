// E2E für den Advisor: Planer, Hinweise, Coach (OpenRouter wird nachgebaut).
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const PORT = 4175
const shots = process.env.SHOTS ?? 'e2e/shots'
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const base = `http://localhost:${PORT}/`
for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch { /* warten */ } await new Promise((r) => setTimeout(r, 200)) }

let failed = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' – ' + extra : ''}`); if (!ok) failed++ }

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route(/cdn\.jsdelivr\.net/, (r) => r.abort())
const orRequests = []
await ctx.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
  orRequests.push({ headers: route.request().headers(), body: JSON.parse(route.request().postData() ?? '{}') })
  const d = (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': OPENROUTER PROCESSING\n\n' + d('Dein Bankdrücken ') + d('steigt gut. ') + d('Weiter so!') + 'data: [DONE]\n\n' })
})
await ctx.route('https://openrouter.ai/api/v1/models', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'anthropic/claude-sonnet-4.5' }, { id: 'openai/gpt-4o' }] }) }))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text())) errors.push(m.text()) })

try {
  await page.goto(base + '#/more/advisor')
  await page.getByRole('heading', { name: 'Advisor' }).waitFor()

  // --- Planer
  await page.getByRole('radio', { name: 'Muskelaufbau' }).click()
  await page.getByRole('radio', { name: 'Fortgeschritten' }).click()
  await page.getByRole('radio', { name: '4', exact: true }).click()
  await page.getByRole('button', { name: 'Plan erstellen' }).click()
  await page.getByRole('heading', { name: 'Oberkörper A' }).waitFor()
  check('Plan für 4 Tage: Oberkörper/Unterkörper A+B', (await page.getByRole('heading', { name: /^(Oberkörper|Unterkörper) [AB]$/ }).count()) === 4)
  check('Grundübung Kniebeuge im Plan (Fortgeschritten, Freihantel)', (await page.getByText('Kniebeuge Langhantel').count()) > 0)
  await page.getByText('Warum dieser Plan?').click()
  check('Begründung nennt Beständigkeit und Deload', (await page.getByText(/Beständigkeit ist die Basis/).count()) > 0 && (await page.getByText(/Entlastungswoche/).count()) > 0)
  await page.screenshot({ path: `${shots}/10-advisor-plan.png`, fullPage: false })
  await page.getByRole('button', { name: 'Als Routinen speichern' }).click()
  await page.getByRole('heading', { name: 'Training' }).waitFor()
  await page.getByText(/^Unterkörper B$/).waitFor()
  check('Routinen wurden gespeichert und erscheinen im Training', (await page.getByText(/^Oberkörper A$/).count()) === 1 && (await page.getByText(/^Unterkörper B$/).count()) === 1)

  // gespeicherte Routine starten: Sätze sind vorbereitet
  await page.getByRole('button', { name: 'Oberkörper A' }).click()
  await page.getByLabel('Gewicht').first().waitFor()
  check('Routine aus Plan startet mit vorbereiteten Sätzen', (await page.getByLabel('Gewicht').count()) >= 10)
  await page.screenshot({ path: `${shots}/11-advisor-routine.png` })
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Verwerfen' }).click()
  await page.getByRole('heading', { name: 'Training' }).waitFor()

  // --- Hinweise (leeres Logbuch)
  await page.goto(base + '#/more/advisor')
  await page.getByRole('tab', { name: 'Hinweise' }).click()
  check('Hinweise ohne Daten: freundlicher Leerzustand', (await page.getByText(/Noch keine Hinweise/).count()) > 0)

  // --- Coach
  await page.getByRole('tab', { name: 'Coach' }).click()
  await page.getByLabel('Frag deinen Coach …').waitFor()
  check('Ohne Schlüssel wird zum Eintragen aufgefordert', (await page.getByText(/Trage deinen OpenRouter-Schlüssel ein/).count()) > 0)
  check('Eingabe ist ohne Schlüssel deaktiviert', await page.getByLabel('Frag deinen Coach …').isDisabled())
  // wirklich Zeichen für Zeichen tippen: das Feld darf dabei weder Zeichen verlieren noch zuklappen
  await page.getByLabel('OpenRouter-API-Schlüssel').pressSequentially('sk-or-v1-testkey', { delay: 25 })
  check('Schlüssel lässt sich von Hand tippen (kein Zeichenverlust)', (await page.getByLabel('OpenRouter-API-Schlüssel').inputValue()) === 'sk-or-v1-testkey')
  check('Verbindungsbereich bleibt beim Tippen offen', await page.getByLabel('OpenRouter-API-Schlüssel').isVisible())
  await page.getByLabel('Frag deinen Coach …').click() // Fokus verlassen = speichern
  await page.getByRole('button', { name: 'Modelle laden' }).click()
  await page.waitForTimeout(300)
  await page.getByLabel('Frag deinen Coach …').fill('Wie steigere ich mein Bankdrücken?')
  await page.getByRole('button', { name: 'Senden' }).click()
  await page.getByText('Dein Bankdrücken steigt gut. Weiter so!').waitFor()
  check('Coach-Antwort wird gestreamt und angezeigt', true)
  check('Anfrage enthält Schlüssel, Modell und System-Prompt', orRequests.length === 1
    && orRequests[0].headers.authorization === 'Bearer sk-or-v1-testkey'
    && orRequests[0].body.stream === true
    && orRequests[0].body.messages[0].role === 'system'
    && /Muscle and Strength Pyramid/.test(orRequests[0].body.messages[0].content)
    && orRequests[0].body.messages.at(-1).content === 'Wie steigere ich mein Bankdrücken?', JSON.stringify(orRequests[0]?.body.model))
  await page.screenshot({ path: `${shots}/12-advisor-coach.png` })

  // Schlüssel bleibt nach Reload lokal erhalten, wird aber nicht an andere Hosts geschickt
  await page.reload()
  await page.getByRole('tab', { name: 'Coach' }).click()
  await page.getByText('Verbindung').click()
  check('Schlüssel bleibt lokal gespeichert', (await page.getByLabel('OpenRouter-API-Schlüssel').inputValue()) === 'sk-or-v1-testkey')

  check('keine JS-Fehler', errors.length === 0, errors.slice(0, 3).join(' | '))
} catch (e) {
  failed++
  console.log('FAIL  Abbruch:', e.message.split('\n')[0])
  await page.screenshot({ path: `${shots}/error-advisor.png` }).catch(() => {})
} finally {
  await browser.close()
  server.kill()
}
process.exit(failed ? 1 : 0)
