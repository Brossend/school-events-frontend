import { afterAll, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApiClient } from '../app/utils/api-client'
import { parseSessionProfile } from '../app/utils/session'
import { parseDashboard } from '../app/utils/dashboard'

// Opt-in, real HTTP only. Supply credentials through process environment.
// Never log cookies, passwords, full request bodies, or session IDs.
const origin = process.env.LIVE_API_ORIGIN ?? 'http://localhost:8000'
const webOrigin = process.env.LIVE_WEB_ORIGIN ?? 'http://localhost:3000'
const steps: { name: string; status: string }[] = []
const requests: Record<string, unknown>[] = []
const evidence: Record<string, unknown> = { origin, webOrigin, completed: false, steps, requests }
const cookies = new Map<string, string>()
const schools = new Map<string, string>()
let activeSchool: string | undefined
let staleXsrf = false
let unauthorized = 0

const transport: typeof fetch = async (input, init) => {
  const url = String(input)
  if (new URL(url).origin !== new URL(origin).origin) throw new Error('Unexpected live test destination')
  const headers = new Headers(init?.headers)
  headers.set('Origin', webOrigin)
  headers.set('Referer', `${webOrigin}/`)
  headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '))
  const timeout = AbortSignal.timeout(30000)
  const response = await fetch(input, { ...init, headers, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
  const cookieNames: string[] = []
  for (const cookie of response.headers.getSetCookie()) {
    const entry = cookie.split(';')[0]!
    const equals = entry.indexOf('=')
    const name = entry.slice(0, equals)
    cookies.set(name, entry.slice(equals + 1))
    cookieNames.push(name)
  }
  if (url.endsWith('/sanctum/csrf-cookie')) staleXsrf = false
  requests.push({
    path: new URL(url).pathname, query: Object.fromEntries(new URL(url).searchParams), method: init?.method ?? 'GET', status: response.status,
    school: schools.get(headers.get('X-School-Id') ?? '') ?? (headers.has('X-School-Id') ? 'foreign-school' : null),
    responseSchool: schools.get(response.headers.get('X-School-Id') ?? '') ?? null,
    hasXsrfHeader: headers.has('X-XSRF-TOKEN'), setCookieNames: cookieNames,
    allowOrigin: response.headers.get('Access-Control-Allow-Origin'),
    allowCredentials: response.headers.get('Access-Control-Allow-Credentials'),
  })
  return response
}
const client = createApiClient({
  origin, fetch: transport, getSchoolId: () => activeSchool,
  getCookie: () => staleXsrf ? 'XSRF-TOKEN=deliberately-stale-live-test' : [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
  onUnauthorized: () => { unauthorized++ },
})

afterAll(async () => {
  await mkdir('docs/evidence', { recursive: true })
  await writeFile(process.env.LIVE_EVIDENCE_FILE ?? 'docs/evidence/live-api-results.json', JSON.stringify(evidence, null, 2))
})

it('verifies real Sanctum session, memberships, school header, errors and logout', async () => {
  expect(process.env.LIVE_EMAIL, 'LIVE_EMAIL must be supplied').toBeTruthy()
  expect(process.env.LIVE_PASSWORD, 'LIVE_PASSWORD must be supplied').toBeTruthy()
  const input = { email: process.env.LIVE_EMAIL!, password: process.env.LIVE_PASSWORD! }

  await client.csrf()
  expect(requests.at(-1)?.status).toBe(204)
  steps.push({ name: 'Explicit /sanctum/csrf-cookie', status: 'PASS: 204' })

  await expect(client.request('get', '/auth/me', { tenant: false })).rejects.toMatchObject({ status: 401 })
  steps.push({ name: 'Unauthenticated /auth/me', status: 'PASS: 401' })

  const login = await client.request('post', '/auth/login', { tenant: false, body: input })
  const profile = parseSessionProfile(login)
  expect(profile.schools.length).toBeGreaterThan(0)
  expect(cookies.has('XSRF-TOKEN')).toBe(true)
  profile.schools.forEach((school, index) => schools.set(school.school_id, `school-${index + 1}`))
  steps.push({ name: 'CSRF cookie and successful login', status: 'PASS: 204 → 200' })

  const me = parseSessionProfile(await client.request('get', '/auth/me', { tenant: false }))
  expect(me).toEqual(profile)
  evidence.actualMeRedacted = { data: {
    user: { id: '<user-uuid>', name: '<redacted>', email: '<redacted>', system_role: me.user.system_role },
    schools: me.schools.map((s, i) => ({ school_id: `<school-${i + 1}-uuid>`, name: `<school-${i + 1}>`, role: s.role, is_default: s.is_default })),
  } }
  steps.push({ name: '/auth/me includes user and memberships', status: 'PASS: 200' })

  for (const school of me.schools) {
    activeSchool = school.school_id
    const tenant = await client.request('get', '/tenant/current', {})
    expect(tenant.data.school_id).toBe(school.school_id)
    steps.push({ name: `Tenant selection ${schools.get(school.school_id)}`, status: 'PASS: 200 with X-School-Id' })
    const dashboard = parseDashboard(await client.request('get', '/dashboard/summary', {}))
    expect(dashboard.school.id).toBe(school.school_id)
    const list = await client.request('get', '/calendar-events', { query: { page: 1, per_page: 1 } })
    expect(list.meta.current_page).toBe(1); expect(list.meta.per_page).toBe(1)
    if (list.meta.total > 1) {
      const next = await client.request('get', '/calendar-events', { query: { page: 2, per_page: 1 } })
      expect(next.meta.current_page).toBe(2)
      expect(next.data[0]?.id).not.toBe(list.data[0]?.id)
    }
    if (list.data[0]) {
      const event = list.data[0]
      const detail = await client.request('get', '/calendar-events/{id}', { params: { id: event.id } })
      expect(detail.data.id).toBe(event.id)
      const filtered = await client.request('get', '/calendar-events', { query: { q: event.title, type: event.event_type as 'federal' | 'regional' | 'cultural_traditional' | 'school_custom', per_page: 100 } })
      expect(filtered.data.some(e => e.id === event.id)).toBe(true)
      expect(filtered.data.every(e => e.event_type === event.event_type)).toBe(true)
    }
    const empty = await client.request('get', '/calendar-events', { query: { q: 'fe002-no-such-event-9c71' } })
    expect(empty.data).toEqual([]); expect(empty.meta.total).toBe(0)
    const period = await client.request('get', '/calendar-events', { query: { from: '2026-11-01', to: '2026-11-30', region_code: '66', type: 'regional' } })
    expect(period.data.every(e => e.region_code === '66' && e.event_type === 'regional')).toBe(true)
    steps.push({ name: `FE-002 dashboard, pagination, search/type/region/period, empty and detail ${schools.get(school.school_id)}`, status: 'PASS: real responses' })
    evidence[`${schools.get(school.school_id)}-dashboard`] = { counts: dashboard.counts, upcoming: dashboard.upcoming_events.length, recent: dashboard.recent_scenarios.length, returnedListKeys: list.data[0] ? Object.keys(list.data[0]) : [] }
  }
  const parallel = await Promise.all(me.schools.map(async school => {
    const dashboard = parseDashboard(await client.request('get', '/dashboard/summary', { schoolId: school.school_id }))
    expect(dashboard.school.id).toBe(school.school_id)
    return schools.get(dashboard.school.id)
  }))
  evidence.parallelSchools = parallel
  steps.push({ name: 'Parallel dashboard requests with different X-School-Id', status: 'PASS: isolated school IDs' })
  const cancellation = new AbortController()
  const cancelled = client.request('get', '/calendar-events', { signal: cancellation.signal, query: { q: 'cancelled-request-check' } })
  cancellation.abort()
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  steps.push({ name: 'Real Fetch AbortSignal cancellation', status: 'PASS: AbortError, no late result applied' })
  await expect(client.request('get', '/tenant/current', { schoolId: '00000000-0000-4000-8000-000000000001' })).rejects.toMatchObject({ status: 404 })
  steps.push({ name: 'Nonexistent school', status: 'PASS: 404' })

  await expect(client.request('get', '/system/status', { tenant: false })).rejects.toMatchObject({ status: 403 })
  steps.push({ name: 'School user cannot access system status', status: 'PASS: 403' })

  await expect(client.request('post', '/auth/login', { tenant: false, body: { email: input.email, password: 'intentionally-incorrect-live-check' } })).rejects.toMatchObject({ status: 422, code: 'INVALID_CREDENTIALS' })
  steps.push({ name: 'Invalid credentials', status: 'PASS: 422' })

  staleXsrf = true
  const start = requests.length
  await client.request('post', '/auth/logout', { tenant: false })
  expect(requests.slice(start).map(r => r.status)).toEqual([419, 204, 204])
  steps.push({ name: 'Real stale CSRF → refresh → logout', status: 'PASS: 419 → 204 → 204' })

  await expect(client.request('get', '/auth/me', { tenant: false })).rejects.toMatchObject({ status: 401 })
  await expect(client.request('get', '/tenant/current', {})).rejects.toMatchObject({ status: 401 })
  expect(unauthorized).toBe(3)
  steps.push({ name: 'Session invalidated after logout', status: 'PASS: auth/me and tenant/current 401' })

  expect(process.env.LIVE_TEACHER_PASSWORD, 'LIVE_TEACHER_PASSWORD must be supplied').toBeTruthy()
  const teacher = parseSessionProfile(await client.request('post', '/auth/login', {
    tenant: false, body: { email: process.env.LIVE_TEACHER_EMAIL ?? 'teacher@school130.ru', password: process.env.LIVE_TEACHER_PASSWORD! },
  }))
  const foreignSchool = me.schools.find(s => !teacher.schools.some(t => t.school_id === s.school_id))
  expect(foreignSchool, 'Provide a teacher without membership in one of the multi-user schools').toBeTruthy()
  await expect(client.request('get', '/tenant/current', { schoolId: foreignSchool!.school_id })).rejects.toMatchObject({ status: 403 })
  steps.push({ name: 'Existing school outside teacher memberships', status: 'PASS: 403' })
  await client.request('post', '/auth/logout', { tenant: false })

  const offline = createApiClient({ origin: 'http://127.0.0.1:65534', getSchoolId: () => undefined, getCookie: () => '' })
  await expect(offline.request('get', '/auth/me', {})).rejects.toMatchObject({ status: 0 })
  steps.push({ name: 'Actual refused TCP connection', status: 'PASS: normalized network error' })
  expect(requests.filter(r => r.path === '/api/v1/auth/login' && r.status === 200)[0]).toMatchObject({ allowOrigin: webOrigin, allowCredentials: 'true' })
  evidence.completed = true
})
