import { afterAll, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { createApiClient } from '../app/utils/api-client'
import { parseSessionProfile } from '../app/utils/session'
import { parseTradition, parseTraditions } from '../app/utils/traditions'

// Fail closed: the mutation destination is fixed to the isolated nginx-test port.
const origin = 'http://localhost:8001'
const active = process.env.FE004_ISOLATED === '1'
const requests: { role: string; path: string; method: string; status: number; school: string | null }[] = []
const evidence: Record<string, unknown> = { origin, completed: false, requests }
type Fixture = { database: string; environment: string; databaseUser: string; runId: string; schools: Record<'A' | 'B', { id: string; name: string }>; users: Record<'author' | 'other' | 'director' | 'multi' | 'admin', { id: string; email: string }>; traditions: Record<'A' | 'B', string> }
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
afterAll(async () => { if (active) await writeFile('docs/fe004/evidence/http-mutations.json', JSON.stringify(evidence, null, 2)) })

it.skipIf(!active)('safely persists traditions, immutable annual versions and archive with real RBAC and parallel uniqueness', async () => {
  const fixture = JSON.parse(await readFile(process.env.FE004_FIXTURE_FILE ?? 'docs/fe004/evidence/test-fixtures.json', 'utf8')) as Fixture
  expect(fixture.database).toBe('school_events_test'); expect(fixture.environment).toBe('testing'); expect(fixture.databaseUser).toBe('school_test_user')
  expect(process.env.FE004_TEST_PASSWORD).toBeTruthy()
  evidence.contour = { database: fixture.database, role: fixture.databaseUser, runId: fixture.runId }
  const author = session('author'), other = session('other'), director = session('school-admin'), multi = session('multi'), admin = session('system-admin')
  const A = fixture.schools.A.id, B = fixture.schools.B.id
  const absent = '00000000-0000-4000-8000-000000000004'
  await expect(author.api.request('get', '/traditions/{id}', { params: { id: fixture.traditions.A } })).rejects.toMatchObject({ status: 401 })
  for (const [name, s] of [['author', author], ['other', other], ['director', director], ['multi', multi], ['admin', admin]] as const) {
    const profile = parseSessionProfile(await s.api.request('post', '/auth/login', { tenant: false, body: { email: fixture.users[name].email, password: process.env.FE004_TEST_PASSWORD! } }))
    expect(profile.user.id).toBe(fixture.users[name].id); s.select(A)
  }
  const list = parseTraditions(await author.api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId: A }, query: { is_archived: 'all' } }))
  expect(list.some(t => t.id === fixture.traditions.A)).toBe(true)
  const original = parseTradition(await author.api.request('get', '/traditions/{id}', { params: { id: fixture.traditions.A } }), A)
  expect(original.versions).toHaveLength(3)
  await expect(author.api.request('post', '/schools/{schoolId}/traditions', { params: { schoolId: A }, body: { title: 'X', description: 'Y', established_year: 1700 } })).rejects.toMatchObject({ status: 422 })
  const created = await author.api.request('post', '/schools/{schoolId}/traditions', { params: { schoolId: A }, body: { title: `HTTP традиция ${fixture.runId}`, description: 'Создана настоящим HTTP только в изолированной базе.', established_year: 2001 } })
  const id = created.data.id
  expect(id).toBeTruthy(); evidence.createdTradition = id
  const detail = () => author.api.request('get', '/traditions/{id}', { params: { id } }).then(payload => parseTradition(payload, A))
  expect((await detail()).created_by_user_id).toBe(fixture.users.author.id)
  await expect(other.api.request('patch', '/traditions/{id}', { params: { id }, body: { title: 'Чужое изменение' } })).rejects.toMatchObject({ status: 403 })
  await expect(other.api.request('post', '/traditions/{id}/archive', { params: { id } })).rejects.toMatchObject({ status: 403 })
  await director.api.request('patch', '/traditions/{id}', { params: { id }, body: { title: 'Обновлено администратором школы' } })
  await admin.api.request('patch', '/traditions/{id}', { params: { id }, body: { description: 'Обновлено системным администратором с активным членством школы.' } })
  const body = { academic_year: '2030-2031', parameters_snapshot: { concept: { title: 'Проверенный снимок' }, participants: 'Школьное сообщество' }, notes: 'Неизменяемая версия' }
  await author.api.request('post', '/traditions/{id}/versions', { params: { id }, body })
  const versionBefore = (await detail()).versions[0]!
  expect(versionBefore.parameters_snapshot).toEqual(body.parameters_snapshot)
  await expect(author.api.request('post', '/traditions/{id}/versions', { params: { id }, body })).rejects.toMatchObject({ status: 422, code: 'TRADITION_VERSION_ALREADY_EXISTS' })
  await expect(author.api.request('post', '/traditions/{id}/versions', { params: { id }, body: { ...body, academic_year: '2030-2032' } })).rejects.toMatchObject({ status: 422 })
  const race = await Promise.allSettled([author.api.request('post', '/traditions/{id}/versions', { params: { id }, body: { ...body, academic_year: '2031-2032' } }), other.api.request('post', '/traditions/{id}/versions', { params: { id }, body: { ...body, academic_year: '2031-2032' } })])
  expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  const rejected = race.find(r => r.status === 'rejected')
  expect(rejected?.status === 'rejected' ? rejected.reason : null).toMatchObject({ status: 422, code: 'TRADITION_VERSION_ALREADY_EXISTS' })
  const history = await detail()
  expect(history.versions.filter(v => v.academic_year === '2031-2032')).toHaveLength(1)
  expect(history.versions.find(v => v.id === versionBefore.id)).toEqual(versionBefore)
  evidence.parallelAnnual = { successful: 1, duplicates: 1, errorStatus: 422, persistedYears: history.versions.map(v => v.academic_year), preservedEarlierVersion: true }
  await author.api.request('patch', '/traditions/{id}', { params: { id }, body: { title: 'Концепция обновлена без изменения истории' } })
  expect((await detail()).versions).toEqual(history.versions)
  await author.api.request('post', '/traditions/{id}/archive', { params: { id } })
  const archived = await detail()
  expect(archived.is_archived).toBe(true); expect(archived.versions).toEqual(history.versions)
  for (const [filter, includes] of [['false', false], ['true', true], ['all', true]] as const) {
    const items = parseTraditions(await author.api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId: A }, query: { is_archived: filter } }))
    expect(items.some(t => t.id === id)).toBe(includes)
  }
  await expect(author.api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId: B } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('post', '/schools/{schoolId}/traditions', { params: { schoolId: B }, body: { title: 'Запрещённая традиция', description: 'Межшкольное изменение запрещено.' } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('get', '/traditions/{id}', { params: { id: fixture.traditions.B } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('patch', '/traditions/{id}', { params: { id: fixture.traditions.B }, body: { title: 'Запрещённое изменение' } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('post', '/traditions/{id}/versions', { params: { id: fixture.traditions.B }, body })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('post', '/traditions/{id}/archive', { params: { id: fixture.traditions.B } })).rejects.toMatchObject({ status: 403 })
  await expect(author.api.request('get', '/traditions/{id}', { params: { id: absent } })).rejects.toMatchObject({ status: 404 })
  multi.select(B)
  const BItems = parseTraditions(await multi.api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId: B }, query: { is_archived: 'all' } }))
  expect(BItems.some(t => t.id === id)).toBe(false)
  expect(parseTradition(await multi.api.request('get', '/traditions/{id}', { params: { id: fixture.traditions.B } }), B).versions).toHaveLength(3)
  const parallelSchools = await Promise.all([A, B].map(schoolId => multi.api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId }, schoolId, query: { is_archived: 'all' } }).then(parseTraditions)))
  expect(parallelSchools[0]!.some(t => t.id === fixture.traditions.B)).toBe(false)
  expect(parallelSchools[1]!.some(t => t.id === fixture.traditions.A)).toBe(false)
  evidence.isolation = { differentLists: true, deniedForeignReadAndMutations: true, activeSchoolHeaderMatchesPath: true }
  for (const s of [author, other, director, multi, admin]) await s.api.request('post', '/auth/logout', { tenant: false })
  await expect(author.api.request('get', '/traditions/{id}', { params: { id } })).rejects.toMatchObject({ status: 401 })
  evidence.completed = true
}, 300000)
