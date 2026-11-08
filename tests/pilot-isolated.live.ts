import { it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createApiClient } from '../app/utils/api-client'

type Row = Record<string, unknown>
type Fixture = { database: string; environment: string; databaseUser: string; queueConnection: string; runId: string; schools: Record<string, { id: string; name: string }>; users: Record<string, { id: string; email: string }>; events: Record<string, string> }
type Options = { body?: unknown; params?: Record<string, string>; query?: Record<string, string | number>; tenant?: boolean }
type Request = (method: 'get' | 'post', path: string, options: Options) => Promise<{ data: unknown }>
const active = process.env.FE010_ISOLATED === '1', origin = 'http://localhost:8001', dir = 'docs/fe010/evidence'
const row = (value: unknown) => value as Row
const id = (value: unknown) => String(row(value).id)
const requests: Row[] = [], snapshots: Row[] = [], evidence: Row = { origin, completed: false, requests, snapshots, syntheticTestOnly: true }
const secrets = new Set<string>()
function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let safe = value
    for (const secret of secrets) if (secret) safe = safe.replaceAll(secret, '[REDACTED]')
    return safe.replace(/pilot_[A-Za-z0-9]{20,}/g, '[REDACTED]')
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|cookie|password|authorization|secret/i.test(key)).map(([key, val]) => [key, redact(val)]))
  return value
}
async function save(name: string, value: unknown) { await writeFile(`${dir}/${name}`, JSON.stringify(redact(value), null, 2)) }
function php(script: string, env: Record<string, string> = {}) {
  const args = ['compose', '-f', 'C:/Users/bross/WebstormProjects/school/docker-compose.yml', 'exec', '-T']
  for (const [key, value] of Object.entries(env)) args.push('-e', `${key}=${value}`)
  args.push('app-test', 'php')
  const result = spawnSync('docker', args, { input: script.replace(/^\uFEFF/, ''), encoding: 'utf8', windowsHide: true, timeout: 60000 })
  if (result.status !== 0) throw new Error(`Guarded fixture PHP failed (${result.status}): ${String(redact(result.stderr)).slice(0, 400)}`)
  try { return JSON.parse(result.stdout) } catch { throw new Error('Guarded fixture returned invalid JSON') }
}
function session(role: string) {
  const cookies = new Map<string, string>(); let school: string | undefined
  const api = createApiClient({ origin, getSchoolId: () => school, getCookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), fetch: async (input, init) => {
    const url = new URL(String(input)); if (url.origin !== origin) throw new Error('Non-isolated HTTP refused')
    const headers = new Headers(init?.headers)
    headers.set('Origin', 'http://localhost:3000'); headers.set('Referer', 'http://localhost:3000/'); headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    const response = await fetch(input, { ...init, headers, signal: AbortSignal.timeout(90000) })
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]!, n = pair.indexOf('='); cookies.set(pair.slice(0, n), pair.slice(n + 1)); secrets.add(pair.slice(n + 1)) }
    requests.push({ role, method: init?.method ?? 'GET', path: url.pathname + url.search, school, status: response.status, mime: response.headers.get('Content-Type') })
    return response
  } })
  const request = api.request as unknown as Request
  return { select: (value?: string) => { school = value }, call: async (method: 'get' | 'post', path: string, options: Options = {}) => (await request(method, path, options)).data }
}
type Session = ReturnType<typeof session>
async function denied(work: Promise<unknown>, status: number, label: string) {
  let actual = 200
  try { await work } catch (error) { actual = Number(row(error).status) }
  expect(actual, label).toBe(status)
}
async function publicSubmit(body: Row, status = 201) {
  const response = await fetch(`${origin}/api/v1/pilot/responses`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })
  requests.push({ role: 'anonymous-no-cookies', method: 'POST', path: '/api/v1/pilot/responses', status: response.status })
  expect(response.status, 'public questionnaire HTTP status').toBe(status)
  const payload: unknown = await response.json()
  return row(payload).data
}
it.skipIf(!active)('FE010 isolated actual HTTP comparison, invitation, questionnaire, reviews, KPI and tenancy evidence', async () => {
  await mkdir(dir, { recursive: true })
  try {
    const fixture = php(await readFile('tests/backend/fe010-fixtures.php', 'utf8')) as Fixture
    expect([fixture.database, fixture.environment, fixture.databaseUser, fixture.queueConnection]).toEqual(['school_events_test', 'testing', 'school_test_user', 'sync'])
    await save('test-fixtures.json', fixture)
    evidence.runId = fixture.runId
    console.info(`FE010 isolated runId=${fixture.runId}`)
    const stateScript = await readFile('tests/backend/fe010-state.php', 'utf8')
    const inspect = (action = 'inspect', participant = '') => php(stateScript, { FE010_RUN_ID: fixture.runId, FE010_ACTION: action, FE010_PARTICIPANT: participant })
    evidence.contour = inspect()
    const env = await readFile('C:/Users/bross/WebstormProjects/school/.env.testing', 'utf8')
    const key = env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g, '')
    const password = createHmac('sha256', key).update(`FE010:${fixture.runId}`).digest('hex'); secrets.add(password); secrets.add(key)
    const sessions: Record<string, Session> = {}
    for (const role of Object.keys(fixture.users)) {
      const s = session(role); sessions[role] = s
      await s.call('post', '/auth/login', { tenant: false, body: { email: fixture.users[role]!.email, password } })
      s.select(fixture.schools.A!.id)
    }
    const admin = sessions.admin!, teacher = sessions.teacher!, regional = sessions.regional!, system = sessions.system!, multi = sessions.multi!
    const schools = fixture.schools, A = schools.A!.id, B = schools.B!.id, C = schools.C!.id
    const scenarioIds: Record<string, string> = {}, requestIds: Record<string, string> = {}, comparisonIds: Record<string, string> = {}
    const requestBody = (event = fixture.events.approved) => ({ calendar_event_id: event, scale: 'class_level', format_type: 'class_hour', target_grades: [5, 6], participants_count: 25, duration_minutes: 45, value_direction: 'mutual_aid', family_involvement: false, available_resources: ['Бумага', 'Проектор'] })
    const comparison = async (label: string, kind = 'universal_vs_personalized', event = fixture.events.approved) => {
      const request = await admin.call('post', '/scenario-requests', { body: requestBody(event) }); requestIds[label] = id(request)
      const result = row(await admin.call('post', '/scenario-comparisons', { body: { scenario_request_id: id(request), comparison_type: kind, is_synthetic: true } }))
      comparisonIds[label] = id(result)
      const variants = row(await admin.call('get', '/scenario-comparisons/{id}/variants', { params: { id: id(result) } }))
      expect((variants.variants as unknown[]).length).toBe(2)
      const pair = result.variants as Row[]
      expect(pair[0]!.scenario_id).toBeTruthy()
      if (result.is_cultural_available) { expect(pair[1]!.scenario_id).toBeTruthy(); expect(pair[0]!.scenario_id === pair[1]!.scenario_id).toBe(false); expect(JSON.stringify(pair[0]!.scenario_payload) === JSON.stringify(pair[1]!.scenario_payload)).toBe(false) }
      evidence[`comparison-${label}`] = result
      return result
    }
    const first = await comparison('personalized'); scenarioIds.A = String((first.variants as Row[])[0]!.scenario_id)
    const cultural = await comparison('cultural', 'cultural_context'); expect(cultural.is_cultural_available).toBe(false)
    const unavailable = await comparison('unavailable', 'cultural_context', fixture.events.unverified); expect(unavailable.is_cultural_available).toBe(false)
    const selection = { selected_variant: 'B', selection_reason: 'Синтетическая проверка педагогического предпочтения FE010.', cultural_usefulness_rating: 4 }
    await teacher.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(first) }, body: selection })
    await denied(teacher.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(first) }, body: { ...selection, selected_variant: 'A' } }), 409, 'immutable selection')
    expect(row(await teacher.call('get', '/scenario-comparisons/{id}', { params: { id: id(first) } })).selected_variant).toBe('B')
    await denied(teacher.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(cultural) }, body: selection }), 409, 'verified source blocked by snapshot status mismatch')
    await denied(teacher.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(unavailable) }, body: selection }), 409, 'unavailable cultural B')
    await teacher.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(unavailable) }, body: { ...selection, selected_variant: 'A' } })
    expect((await teacher.call('get', '/scenario-comparisons') as unknown[]).length).toBe(3)
    for (const label of ['B', 'C', 'One', 'Five', 'Partial', 'Real']) {
      admin.select(schools[label]!.id)
      const c = await comparison(label); scenarioIds[label] = String((c.variants as Row[])[0]!.scenario_id)
    }
    admin.select(A)
    let invitationIndex = 0
    const invite = async (synthetic = true) => {
      const p = row(await admin.call('post', '/pilot/participants', { body: { subject_area: 'История · FE010 SYNTHETIC TEST', teaching_experience_years: 7, anonymous_code: `FE010-${fixture.runId}-${++invitationIndex}`, valid_days: 30, is_synthetic: synthetic } }))
      const token = String(p.invite_token); secrets.add(token)
      return { participantId: id(p), token }
    }
    const body = (token: string, scenario = scenarioIds.A!, n = 0): Row => ({ invite_token: token, scenario_id: scenario, prep_time_baseline_minutes: 100, prep_time_ai_minutes: n < 10 ? 20 : 60, personalization_selected: n < 14, manual_edit_percentage: n < 14 ? 20 : 30, cultural_context_used: n < 12, cultural_usefulness_score: n < 12 ? (n < 6 ? 4 : 5) : null, feedback_text: 'FE010 SYNTHETIC HTTP fixture, not actual research.' })
    const p = await invite(), replacement = row(await admin.call('post', '/pilot/participants/{id}/reissue', { params: { id: p.participantId } })), replacementToken = String(replacement.invite_token); secrets.add(replacementToken)
    expect(replacementToken === p.token).toBe(false)
    await publicSubmit(body(p.token), 404)
    await publicSubmit(body(replacementToken, scenarioIds.B!), 403)
    await admin.call('post', '/pilot/participants/{id}/revoke', { params: { id: p.participantId } })
    await publicSubmit(body(replacementToken), 403)
    await denied(admin.call('post', '/pilot/participants/{id}/reissue', { params: { id: p.participantId } }), 409, 'revoked reissue')
    const expired = await invite(); inspect('expire', expired.participantId); await publicSubmit(body(expired.token), 403)
    await publicSubmit(body('pilot_invalid_fe010_unknown_invitation'), 404)
    const list = await admin.call('get', '/pilot/participants'); expect(JSON.stringify(list).includes('invite_token')).toBe(false)
    const metrics = async (label: string, includeSynthetic = true) => {
      const actual = row(await admin.call('get', '/pilot/metrics', { query: includeSynthetic ? { include_synthetic: 1 } : {} }))
      snapshots.push({ label, school: label.startsWith('Real') ? schools.Real!.id : A, includeSynthetic, actual })
      return actual
    }
    expect((await metrics('N0')).status).toBe('no_data')
    const responseIds: string[] = []
    const review = async (s: Session, response: string, errors = 0, audit = 'audited') => row(await s.call('post', '/pilot/responses/{id}/reviews', { params: { id: response }, body: { expert_audit_status: audit, critical_cultural_errors: errors, methodological_remarks: 'FE010 synthetic fixture expert version.' } }))
    for (let n = 0; n < 20; n++) {
      const invitation = await invite(), input = body(invitation.token, scenarioIds.A, n)
      const response = row(await publicSubmit({ ...input, is_synthetic: false, critical_cultural_errors: 0 }))
      expect(response.is_synthetic).toBe(true); expect(response.relative_time_saving_percent).toBe(n < 10 ? 80 : 40)
      responseIds.push(id(response))
      if (n === 0) {
        await publicSubmit(input, 409)
        await denied(admin.call('post', '/pilot/participants/{id}/reissue', { params: { id: invitation.participantId } }), 409, 'used reissue')
        await denied(admin.call('post', '/pilot/participants/{id}/revoke', { params: { id: invitation.participantId } }), 409, 'used revoke')
        const one = await metrics('N1'); expect(one.sample_size).toBe(1); expect(one.critical_cultural_errors_count).toBeNull()
      }
      if (n === 4) expect((await metrics('N5')).sample_size).toBe(5)
    }
    const twenty = await metrics('N20-no-reviews'); expect(twenty.sample_size).toBe(20); expect(twenty.is_pilot_completed).toBe(false)
    for (const response of responseIds.slice(0, 5)) await review(admin, response)
    const partial = await metrics('N20-reviewed5'); expect(partial.audited_responses_count).toBe(5); expect(partial.expert_review_coverage_percent).toBe(25); expect(row(partial.criteria_status).zero_critical_cultural_errors).toBe('pending_review'); expect(partial.is_expert_evaluation_completed).toBe(false)
    const failedReview = await review(regional, responseIds[0]!, 1); expect(failedReview.finding_version).toBe(2)
    const failed = await metrics('N20-critical-error'); expect(row(failed.criteria_status).zero_critical_cultural_errors).toBe('fail')
    const corrected = await review(system, responseIds[0]!); expect(corrected.finding_version).toBe(3)
    for (const response of responseIds.slice(5)) await review(admin, response)
    const completed = await metrics('N20-reviewed20'); expect(completed.is_pilot_completed).toBe(true); expect(completed.audited_responses_count).toBe(20)
    // Independent expected metrics are calculated from planned survey inputs, not persisted server metrics.
    const inputs = Array.from({ length: 20 }, (_, n) => body('', scenarioIds.A, n)), savings = inputs.map(r => (Number(r.prep_time_baseline_minutes) - Number(r.prep_time_ai_minutes)) / Number(r.prep_time_baseline_minutes) * 100).sort((a, b) => a - b)
    const culturalInputs = inputs.filter(r => r.cultural_context_used)
    const expected: Row = { median_relative_time_saving_percent: (savings[9]! + savings[10]!) / 2, personalization_choice_percent: inputs.filter(r => r.personalization_selected).length / inputs.length * 100, manual_edit_under_20_percent_ratio: inputs.filter(r => Number(r.manual_edit_percentage) <= 20).length / inputs.length * 100, cultural_context_usage_percent: culturalInputs.length / inputs.length * 100, average_cultural_usefulness_score: culturalInputs.reduce((sum, r) => sum + Number(r.cultural_usefulness_score), 0) / culturalInputs.length, critical_cultural_errors_count: 0 }
    const kpi = Object.entries(expected).map(([field, value]) => ({ field, expected: value, actual: completed[field], equal: value === completed[field] }))
    expect(kpi.every(k => k.equal)).toBe(true); expect(Object.values(row(completed.criteria_status)).every(v => v === 'pass')).toBe(true)
    await save('kpi-expected-vs-actual.json', { methodology: '20 planned inputs: 10*80% + 10*40% savings; 14/20 personalization; 14/20 <=20% edits; 12/20 cultural use; six 4 and six 5 ratings; 20 effective audited reviews with zero errors.', kpi })
    const realDefault = await metrics('A-real-default', false); expect(realDefault.sample_size).toBe(0)
    const exported = row(await admin.call('get', '/pilot/export', { query: { include_synthetic: 1 } })); expect(exported.metrics).toEqual(completed); await save('aggregation-export.json', exported)
    // Keep independent live UI states available; every record is labelled synthetic even in the real-origin filter test.
    const uiResponses: Record<string, string[]> = { A: responseIds }
    for (const [label, count, auditCount] of [['One', 1, 0], ['Five', 5, 0], ['Partial', 20, 5]] as const) {
      admin.select(schools[label]!.id); uiResponses[label] = []
      for (let n = 0; n < count; n++) { const invitation = await invite(), response = id(await publicSubmit(body(invitation.token, scenarioIds[label], n))); uiResponses[label]!.push(response); if (n < auditCount) await review(admin, response) }
      evidence[`live-${label}`] = await admin.call('get', '/pilot/metrics', { query: { include_synthetic: 1 } })
    }
    admin.select(schools.Real!.id)
    const realInvitation = await invite(false), realResponse = row(await publicSubmit({ ...body(realInvitation.token, scenarioIds.Real, 19), is_synthetic: true }))
    expect(realResponse.is_synthetic).toBe(false)
    const beforeSynthetic = row(await admin.call('get', '/pilot/metrics'))
    const syntheticInvitation = await invite(true); await publicSubmit(body(syntheticInvitation.token, scenarioIds.Real, 0))
    const afterSynthetic = row(await admin.call('get', '/pilot/metrics')); expect(afterSynthetic).toEqual(beforeSynthetic); expect(afterSynthetic.sample_size).toBe(1)
    const including = row(await admin.call('get', '/pilot/metrics', { query: { include_synthetic: 1 } })); expect(including.sample_size).toBe(2)
    evidence.syntheticSeparation = { school: schools.Real!.id, notice: 'Both are generated test fixtures in isolated DB. is_synthetic=false exercises real-origin filtering only; not real research.', realResponseId: id(realResponse), beforeSynthetic, afterSynthetic, including }
    admin.select(A)
    await denied(teacher.call('get', '/pilot/participants'), 403, 'teacher list invitations')
    await denied(teacher.call('post', '/pilot/participants', { body: { subject_area: 'Test', teaching_experience_years: 1 } }), 403, 'teacher create invitation')
    await denied(teacher.call('get', '/pilot/responses/{id}', { params: { id: responseIds[0]! } }), 403, 'teacher read response')
    await denied(review(teacher, responseIds[0]!), 403, 'teacher review')
    await denied(teacher.call('get', '/pilot/export'), 403, 'teacher export')
    expect(row(await teacher.call('get', '/pilot/metrics')).sample_size).toBe(0)
    for (const s of [multi, teacher]) {
      s.select(B)
      if (s === teacher) await denied(s.call('get', '/scenario-comparisons'), 403, 'foreign school header')
      else {
        await denied(s.call('get', '/scenario-comparisons/{id}', { params: { id: id(first) } }), 403, 'cross school comparison')
        await denied(s.call('post', '/scenario-comparisons', { body: { scenario_request_id: requestIds.personalized, comparison_type: 'universal_vs_personalized', is_synthetic: true } }), 403, 'cross school request comparison')
        await denied(s.call('post', '/scenario-comparisons/{id}/selection', { params: { id: id(first) }, body: selection }), 403, 'cross school selection')
      }
      s.select(A)
    }
    admin.select(B)
    await denied(admin.call('get', '/pilot/responses/{id}', { params: { id: responseIds[0]! } }), 403, 'cross school response')
    await denied(admin.call('post', '/pilot/participants/{id}/revoke', { params: { id: expired.participantId } }), 403, 'cross school invitation')
    admin.select(A)
    for (const school of [A, B]) { regional.select(school); await regional.call('get', '/pilot/metrics'); await regional.call('get', '/pilot/export'); await regional.call('get', '/pilot/participants') }
    regional.select(C)
    await denied(regional.call('get', '/pilot/metrics'), 403, 'regional other region metrics')
    await denied(regional.call('get', '/pilot/export'), 403, 'regional other region export')
    await denied(regional.call('get', '/pilot/participants'), 403, 'regional other region invitations')
    admin.select(C)
    const cInvitation = await invite(), cResponse = id(await publicSubmit(body(cInvitation.token, scenarioIds.C, 0)))
    await denied(review(regional, cResponse), 403, 'regional other region review')
    regional.select(A)
    await denied(regional.call('get', '/pilot/metrics', { query: { scope: 'global' } }), 403, 'regional global metrics')
    await denied(regional.call('get', '/pilot/export', { query: { scope: 'global' } }), 403, 'regional global export')
    system.select(C); await system.call('get', '/pilot/metrics'); await system.call('get', '/pilot/export'); await review(system, cResponse)
    system.select()
    await system.call('get', '/pilot/metrics', { query: { scope: 'global' } })
    await system.call('get', '/pilot/export', { query: { scope: 'global' } })
    await denied(system.call('get', '/scenario-comparisons'), 403, 'system no membership ordinary comparisons')
    await denied(system.call('post', '/scenario-requests', { body: requestBody() }), 403, 'system no membership ordinary scenarios')
    await denied(system.call('get', '/pilot/participants'), 403, 'system no membership invitations require ordinary tenant')
    system.select(A)
    await denied(system.call('get', '/scenario-comparisons'), 403, 'system forged school ordinary comparisons')
    const noMembership = sessions.noMembership!; noMembership.select()
    await denied(noMembership.call('get', '/scenario-comparisons'), 403, 'ordinary no membership comparisons')
    await denied(noMembership.call('get', '/pilot/metrics'), 422, 'ordinary no membership missing analytical selection')
    noMembership.select(A)
    await denied(noMembership.call('get', '/pilot/metrics'), 403, 'ordinary no membership forged analytical school')
    await denied(review(noMembership, responseIds[0]!), 403, 'ordinary no membership review')
    await sessions.systemMember!.call('get', '/scenario-comparisons')
    await sessions.systemMember!.call('get', '/pilot/participants')
    admin.select(A)
    const validationInvitation = await invite()
    await publicSubmit({ ...body(validationInvitation.token), prep_time_baseline_minutes: 0 }, 422)
    await publicSubmit({ ...body(validationInvitation.token), cultural_usefulness_score: null }, 422)
    const pendingVersion = await review(admin, cResponse, 0, 'pending_audit')
    expect(pendingVersion.finding_version).toBe(2)
    evidence.reviewReadContract = await admin.call('get', '/pilot/responses/{id}', { params: { id: responseIds[0]! } })
    evidence.contractLimitations = ['Verified source HTTP snapshot exposes effective_status but comparison checks status; cultural B remains unavailable despite verified fixture sources. No backend or snapshot alteration performed.', 'Response GET omits effective review and review history. PostgreSQL evidence proves append-only versions.', 'Invitation and response-read endpoints use strict membership tenant routes; system/curator without membership cannot use these routes.', 'Review authorization derives target school from response, independent of selected X-School-Id; UI must guard current context.', 'Synthetic inclusion query means real plus synthetic, not synthetic-only. Main A contains synthetic-only records; Real school isolates real-origin filter check.', 'All test fixtures, including is_synthetic=false filter probes, are generated in school_events_test and are not actual research.']
    await save('postgresql-state.json', inspect())
    await save('browser-bootstrap.json', { completed: true, runId: fixture.runId, origin, syntheticTestOnly: true, schools, users: fixture.users, scenarioIds, requestIds, comparisonIds, responseIds: uiResponses, passwordDerivation: 'In memory only: HMAC-SHA256(APP_KEY from backend .env.testing, FE010:<runId>). Do not print or persist derived credentials.', invitationNotice: 'Create a fresh invitation through HTTP for public form screenshots; no invitation secret persisted.', states: { no_data: 'Zero', N1: 'One', N5: 'Five', partial5of20: 'Partial', completed20of20: 'A', realOriginFilterOnly: 'Real' } })
    evidence.completed = true
  } finally { await save('http-pilot.json', evidence) }
}, 1800000)
