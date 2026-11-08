import { afterAll, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { createApiClient } from '../app/utils/api-client'
import { parseSessionProfile } from '../app/utils/session'
import { createHmac } from 'node:crypto'

// Fail closed: the mutation destination is fixed to the isolated nginx-test port.
const origin = 'http://localhost:8001'
const active = process.env.FE005_ISOLATED === '1'
const requests: { role: string; path: string; method: string; status: number; school: string | null }[] = []
const evidence: Record<string, unknown> = { origin, completed: false, requests }
type Fixture = { database: string; environment: string; databaseUser: string; runId: string; schools: Record<'A' | 'B', { id: string; name: string }>; users: Record<'author' | 'other' | 'director' | 'multi' | 'admin', { id: string; email: string }>; traditions: Record<'A' | 'B', string>; versions: Record<'A' | 'B', string>; events: Record<'approved' | 'draft' | 'foreign', string>; baselineGenerationRuns: number }
function session(role: string) {
  const cookies = new Map<string, string>(); let schoolId: string | undefined
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).origin !== origin) throw new Error('Non-isolated HTTP refused')
    const headers = new Headers(init?.headers)
    headers.set('Origin', 'http://localhost:3000'); headers.set('Referer', 'http://localhost:3000/')
    headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    const response = await fetch(input, { ...init, headers, signal: AbortSignal.timeout(30000) })
    for (const cookie of response.headers.getSetCookie()) { const entry = cookie.split(';')[0]!, i = entry.indexOf('='); cookies.set(entry.slice(0, i), entry.slice(i + 1)) }
    requests.push({ role, path: new URL(String(input)).pathname + new URL(String(input)).search, method: init?.method ?? 'GET', status: response.status, school: headers.get('X-School-Id') })
    return response
  }
  const api = createApiClient({ origin, fetch: transport, getSchoolId: () => schoolId, getCookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') })
  return { api, select: (id: string) => { schoolId = id } }
}
afterAll(async () => { if (active) await writeFile('docs/fe005/evidence/http-mutations.json', JSON.stringify(evidence, null, 2)) })

it.skipIf(!active)('creates all three occasions on isolated Laravel and enforces tenant and author RBAC', async () => {
  const fixture = JSON.parse(await readFile('docs/fe005/evidence/test-fixtures.json', 'utf8')) as Fixture
  expect([fixture.database, fixture.environment, fixture.databaseUser]).toEqual(['school_events_test', 'testing', 'school_test_user'])
  const env = await readFile('C:/Users/bross/WebstormProjects/school/.env.testing', 'utf8')
  const key = env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g, '')
  const password = createHmac('sha256', key).update(`FE005:${fixture.runId}`).digest('hex')
  const author = session('author'), other = session('other'), director = session('director'), multi = session('multi')
  const A = fixture.schools.A.id, B = fixture.schools.B.id, absent = '00000000-0000-4000-8000-000000000005'
  await expect(author.api.request('get', '/scenario-requests/{id}', { params: { id: absent } })).rejects.toMatchObject({ status: 401 })
  for (const [name, s] of [['author', author], ['other', other], ['director', director], ['multi', multi]] as const) {
    expect(parseSessionProfile(await s.api.request('post', '/auth/login', { tenant: false, body: { email: fixture.users[name].email, password } })).user.id).toBe(fixture.users[name].id); s.select(A)
  }
  const base = { scale: 'class_level' as const, format_type: 'class_hour' as const, target_grades: [5, 6], participants_count: 25, duration_minutes: 45, value_direction: 'mutual_aid' as const, family_involvement: true, available_resources: ['Проектор', 'Бумага'], pedagogical_constraints: 'Доступные задания, без соревнования на скорость.' }
  const created = []
  for (const occasion of [{ custom_event_title: `FE005 HTTP ${fixture.runId}` }, { calendar_event_id: fixture.events.approved }, { tradition_version_id: fixture.versions.A }]) {
    const body = { ...base, ...occasion }
    const response = await author.api.request('post', '/scenario-requests', { body })
    expect(response.data.id).toBeTruthy(); expect(response.data.school_id).toBe(A)
    const read = await author.api.request('get', '/scenario-requests/{id}', { params: { id: response.data.id } })
    expect(read.data).toMatchObject(response.data); expect(read.data.created_at).toBeTruthy(); expect(read.data.user_id).toBe(fixture.users.author.id)
    expect(read.data.context_snapshot).toBeTypeOf('object')
    created.push({ body, response: response.data, read: read.data })
  }
  evidence.created = created
  for (const body of [base, { ...base, custom_event_title: 'Два повода', calendar_event_id: fixture.events.approved }, { ...base, custom_event_title: 'Граница', participants_count: 4 }, { ...base, custom_event_title: 'Граница', duration_minutes: 241 }]) await expect(author.api.request('post', '/scenario-requests', { body })).rejects.toMatchObject({ status: 422 })
  for (const body of [{ ...base, calendar_event_id: fixture.events.draft }, { ...base, tradition_version_id: fixture.versions.B }, { ...base, calendar_event_id: fixture.events.foreign }]) await expect(author.api.request('post', '/scenario-requests', { body })).rejects.toMatchObject({ status: 403 })
  const own = created[0]!.response.id
  await expect(other.api.request('get', '/scenario-requests/{id}', { params: { id: own } })).rejects.toMatchObject({ status: 403 })
  expect((await director.api.request('get', '/scenario-requests/{id}', { params: { id: own } })).data.id).toBe(own)
  multi.select(B)
  await expect(multi.api.request('get', '/scenario-requests/{id}', { params: { id: own } })).rejects.toMatchObject({ status: 403 })
  await expect(multi.api.request('post', '/scenario-requests', { body: { ...base, tradition_version_id: fixture.versions.A } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('get', '/scenario-requests/{id}', { params: { id: absent } })).rejects.toMatchObject({ status: 404 })
  for (const s of [author, other, director, multi]) await s.api.request('post', '/auth/logout', { tenant: false })
  await expect(author.api.request('get', '/scenario-requests/{id}', { params: { id: own } })).rejects.toMatchObject({ status: 401 })
  evidence.isolation = { foreignVersionRejected: true, foreignEventRejected: true, otherAuthorDenied: true, otherSchoolDenied: true, schoolAdminRead: true, logoutDenied: true }
  evidence.completed = true
}, 300000)

