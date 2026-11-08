import { afterAll, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApiClient } from '../app/utils/api-client'
import { parseSessionProfile } from '../app/utils/session'
import { parseClaim, parseReviews, parseSource } from '../app/utils/provenance'

// Read-only against the existing backend. No business mutations or test seeding.
const origin = (process.env.LIVE_API_ORIGIN ?? 'http://localhost:8000').replace(/\/$/, '')
const webOrigin = process.env.LIVE_WEB_ORIGIN ?? 'http://localhost:3000'
const log: { role: string; path: string; method: string; status: number; hasSchool: boolean }[] = []
const results: Record<string, unknown> = { completed: false, origin, requests: log }
function session(role: string) {
  const cookies = new Map<string, string>()
  let school: string | undefined
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).origin !== origin) throw new Error('Unexpected test destination')
    const headers = new Headers(init?.headers)
    headers.set('Origin', webOrigin); headers.set('Referer', `${webOrigin}/`)
    headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    const response = await fetch(input, { ...init, headers, signal: AbortSignal.timeout(30000) })
    for (const line of response.headers.getSetCookie()) { const entry = line.split(';')[0]!, equals = entry.indexOf('='); cookies.set(entry.slice(0, equals), entry.slice(equals + 1)) }
    log.push({ role, path: new URL(String(input)).pathname, method: init?.method ?? 'GET', status: response.status, hasSchool: headers.has('X-School-Id') })
    return response
  }
  const api = createApiClient({ origin, fetch: transport, getSchoolId: () => school, getCookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') })
  return { api, select: (value: string) => { school = value } }
}
afterAll(async () => {
  await mkdir('docs/fe003/evidence', { recursive: true })
  await writeFile('docs/fe003/evidence/provenance-http.json', JSON.stringify(results, null, 2))
})

it('loads actual event/source/claim DTOs with teacher/curator/admin RBAC', async () => {
  const teacher = session('teacher'), curator = session('regional-curator'), admin = session('admin')
  const absent = '00000000-0000-4000-8000-000000000003'
  await expect(teacher.api.request('get', '/event-sources/{id}', { params: { id: absent } })).rejects.toMatchObject({ status: 401 })
  const profile = parseSessionProfile(await teacher.api.request('post', '/auth/login', { tenant: false, body: { email: 'multi@schools.ru', password: process.env.LIVE_PASSWORD! } }))
  expect(profile.schools.length).toBeGreaterThan(1)
  teacher.select(profile.schools[0]!.school_id)
  const list = await teacher.api.request('get', '/calendar-events', { query: { per_page: 100 } })
  const catalog = await Promise.all(list.data.map(event => teacher.api.request('get', '/calendar-events/{id}', { params: { id: event.id } })))
  const federal = catalog.find(e => e.data.event_type === 'federal' && e.data.sources.length && e.data.cultural_claims.length)!.data
  const regional = catalog.find(e => e.data.event_type === 'regional' && e.data.sources.length && e.data.cultural_claims.length)!.data
  expect(federal).toBeTruthy(); expect(regional).toBeTruthy()
  const sourceId = federal.sources[0]!.id, claimId = federal.cultural_claims[0]!.id
  for (const school of profile.schools) {
    teacher.select(school.school_id)
    const source = parseSource(await teacher.api.request('get', '/event-sources/{id}', { params: { id: sourceId } }))
    const claim = parseClaim(await teacher.api.request('get', '/cultural-claims/{id}', { params: { id: claimId } }))
    expect(source.calendar_event_id).toBe(federal.id); expect(claim.calendar_event_id).toBe(federal.id)
    results[`school-${profile.schools.indexOf(school) + 1}`] = { sourceDecision: source.latest_review?.decision ?? 'pending', claimEvidence: claim.evidence_records.map(e => ({ stored: e.verification_status, effective: e.effective_status, detached: e.is_detached, hasExcerpt: !!e.citation_excerpt })) }
  }
  results.browserRoutes = { event: `/calendar/${regional.id}`, source: `/sources/${regional.sources[0]!.id}`, claim: `/claims/${regional.cultural_claims[0]!.id}`, approvedSource: `/sources/${sourceId}` }
  await expect(teacher.api.request('get', '/event-sources/{id}/reviews', { params: { id: sourceId } })).rejects.toMatchObject({ status: 403 })
  await expect(teacher.api.request('get', '/catalog/review-queue', {})).rejects.toMatchObject({ status: 403 })
  await expect(teacher.api.request('get', '/event-sources/{id}', { schoolId: absent, params: { id: sourceId } })).rejects.toMatchObject({ status: 404 })
  for (const path of ['/event-sources/{id}', '/cultural-claims/{id}'] as const) await expect(teacher.api.request('get', path, { params: { id: absent } })).rejects.toMatchObject({ status: 404 })
  const curatorProfile = parseSessionProfile(await curator.api.request('post', '/auth/login', { tenant: false, body: { email: 'curator@school-events.ru', password: process.env.LIVE_CURATOR_PASSWORD! } }))
  expect(curatorProfile.user.system_role).toBe('catalog_curator')
  const curatorList = await curator.api.request('get', '/calendar-events', { query: { per_page: 100 } })
  expect(curatorList.data.some(e => e.id === regional.id)).toBe(true)
  expect(log.at(-1)?.hasSchool).toBe(false)
  const regionalReviews = parseReviews(await curator.api.request('get', '/event-sources/{id}/reviews', { params: { id: regional.sources[0]!.id } }))
  results.regionalReviews = regionalReviews.length
  await expect(curator.api.request('get', '/event-sources/{id}/reviews', { params: { id: sourceId } })).rejects.toMatchObject({ status: 403 })
  const adminProfile = parseSessionProfile(await admin.api.request('post', '/auth/login', { tenant: false, body: { email: 'admin@school-events.ru', password: process.env.LIVE_ADMIN_PASSWORD! } }))
  expect(adminProfile.user.system_role).toBe('system_admin')
  const fullReviews = parseReviews(await admin.api.request('get', '/event-sources/{id}/reviews', { params: { id: sourceId } }))
  expect(fullReviews.length).toBeGreaterThan(0)
  results.adminReviews = fullReviews.map(r => ({ decision: r.decision, hasComments: !!r.comments }))
  for (const s of [teacher, curator, admin]) await s.api.request('post', '/auth/logout', { tenant: false })
  await expect(teacher.api.request('get', '/cultural-claims/{id}', { params: { id: claimId } })).rejects.toMatchObject({ status: 401 })
  results.completed = true
}, 300000)
