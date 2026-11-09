import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// The private access file is created by the local bootstrap/integration run.
// Credentials and cookies are never written to the evidence directory.
const runtime = process.env.CODEX_NODE_MODULES || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const require = createRequire(path.join(runtime, 'package.json'))
const { chromium } = require('playwright')
const origin = process.env.UX001_FRONTEND || 'http://localhost:3030'
const access = JSON.parse(await fs.readFile(process.env.UX001_ACCESS || path.join(os.homedir(), '.codex/ux001/clean-browser-access.json'), 'utf8'))
const out = path.resolve(process.env.UX001_EVIDENCE || 'docs/ux001/evidence')
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = [], matrix = []
page.on('pageerror', e => errors.push(e.message))
const views = [[1440, 900], [768, 1024], [390, 844], [360, 800]]
async function ready() {
  await page.waitForFunction(() => { try { return window.useNuxtApp?.().isHydrating === false } catch { return false } }, null, { timeout: 90000 })
  await page.locator("h1").first().waitFor({ timeout: 45000 })
}
async function capture(name, url) {
  console.log(`Checking ${name}`)
  if (url) await page.goto(origin + url)
  await ready()
  await page.waitForFunction(() => !document.querySelector('.spinner'))
  await page.evaluate(() => document.fonts.ready)
  const current = new URL(page.url())
  const heading = await page.locator('h1').first().innerText()
  if (url && current.pathname !== new URL(origin + url).pathname) throw new Error(`Unexpected redirect for ${name}`)
  if (/404|500|not found|ошибка сервера/i.test(heading)) throw new Error(`Error page for ${name}`)
  if (name === 'export') await page.getByRole('dialog').waitFor()
  for (const [width, height] of views) {
    await page.setViewportSize({ width, height })
    const size = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
    matrix.push({ page: name, width, height, ...size, overflow: size.scrollWidth > size.clientWidth + 1, title: await page.title(), path: current.pathname, heading, dialogs: await page.getByRole('dialog').count() })
    await page.screenshot({ path: path.join(out, 'screenshots', `${name}-${width}.png`), fullPage: true })
  }
}
try {
  await capture('login', '/login')
  await capture('register', '/register')
  await page.goto(origin + '/login')
  await ready()
  await page.locator('input[name=email]').fill(access.email)
  await page.locator('input[name=password]').fill(access.password)
  const loginResponse = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST', { timeout: 90000 })
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  const loginStatus = (await loginResponse).status()
  if (loginStatus !== 200) throw new Error(`Login returned ${loginStatus}`)
  await page.waitForURL(url => url.pathname !== '/login', { timeout: 90000, waitUntil: 'domcontentloaded' })
  if (!process.env.UX001_DEEP_ONLY) for (const [name, url] of [['dashboard', '/'], ['calendar', '/calendar'], ['constructor', '/constructor'], ['invitations', '/invitations'], ['research', '/research'], ['comparisons', '/comparisons'], ['pilot', '/pilot'], ['school', '/school'], ['traditions', '/traditions'], ['scenarios', '/events'], ['profile', '/profile']]) await capture(name, url)
  if (!process.env.UX001_SKIP_WIZARD) {
  await capture('constructor-step1', '/constructor')
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await capture('constructor-errors')
  await page.locator('#field-custom_event_title').fill('Школьная встреча: исследуем историю и готовим выставку вместе с семьями')
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await capture('constructor-step2')
  await page.locator('#field-target_grades input').first().check()
  await page.locator('#field-participants_count').fill('25')
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await capture('constructor-step3')
  await page.locator('input[name=scale]').first().check()
  await page.locator('input[name=format]').first().check()
  await page.locator('#field-duration_minutes').fill('45')
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await capture('constructor-step4')
  await page.locator('input[name=direction]').first().check()
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click()
  await capture('constructor-step5')
  }
  if (process.env.UX001_SCENARIO) {
    await capture('scenario', `/scenarios/${process.env.UX001_SCENARIO}`)
    await capture('export', `/scenarios/${process.env.UX001_SCENARIO}?export=1`)
    await capture('editor', `/scenarios/${process.env.UX001_SCENARIO}/edit`)
    await page.getByRole('button', { name: 'Редактировать сценарий', exact: true }).click()
    await capture('editor-fields')
    await page.getByRole('button', { name: 'Свернуть поля', exact: true }).click()
    await page.getByText('История версий', { exact: true }).click()
    await capture('revision-history')
    await page.getByRole('button', { name: 'Подтверждение педагогом', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await capture('signoff-dialog')
    await page.getByRole('button', { name: 'Закрыть диалог', exact: true }).click()
    await capture('traditions', '/traditions')
    await page.getByRole('button', { name: 'Создать традицию', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await capture('tradition-dialog')
  }
  const icons = []
  for (const file of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest']) { const r = await context.request.get(`${origin}/${file}`); icons.push({ file, status: r.status() }) }
  const report = { origin, checkedAt: new Date().toISOString(), matrix, errors, icons }
  await fs.writeFile(path.join(out, 'browser-verification.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ states: matrix.length, overflow: matrix.filter(x => x.overflow), errors, icons }))
  if (matrix.some(x => x.overflow) || errors.length || icons.some(x => x.status !== 200)) process.exitCode = 1
} catch (error) {
  console.error(JSON.stringify({ error: error.message.split("\n")[0], errors, feedback: await page.locator(".login-feedback").allTextContents(), path: new URL(page.url()).pathname }))
  process.exitCode = 1
} finally { await browser.close() }
