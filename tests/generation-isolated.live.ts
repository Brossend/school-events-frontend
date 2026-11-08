import { afterAll, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createGenerationLauncher } from '../app/utils/generation-launcher'
import { parseAccepted, parseRun, parseScenario, parseRevision } from '../app/utils/generation'
import { createApiClient } from '../app/utils/api-client'
import { parseSessionProfile } from '../app/utils/session'
import { createHmac, randomUUID, createHash } from 'node:crypto'

// Fail closed: the mutation destination is fixed to the isolated nginx-test port.
const origin = 'http://localhost:8001'
const active = process.env.FE006_ISOLATED === '1'
const requests: { role: string; path: string; method: string; status: number; school: string | null }[] = []
const evidence: Record<string, unknown> = { origin, completed: false, requests }
type Fixture = { database: string; environment: string; databaseUser: string; runId: string; schools: Record<'A' | 'B', { id: string; name: string }>; users: Record<'author' | 'other' | 'director' | 'multi' | 'admin', { id: string; email: string }>; traditions: Record<'A' | 'B', string>; versions: Record<'A' | 'B', string>; events: Record<'approved' | 'draft' | 'foreign', string>; baselineGenerationRuns: number; queue: string; sourceId: string; claimId: string }
function session(role: string) {
  let dropGenerate = false
  const cookies = new Map<string, string>(); let schoolId: string | undefined
  const transport: typeof fetch = async (input, init) => {
    if (new URL(String(input)).origin !== origin) throw new Error('Non-isolated HTTP refused')
    const headers = new Headers(init?.headers)
    headers.set('Origin', 'http://localhost:3000'); headers.set('Referer', 'http://localhost:3000/')
    headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    const response = await fetch(input, { ...init, headers, signal: AbortSignal.timeout(30000) })
    for (const cookie of response.headers.getSetCookie()) { const entry = cookie.split(';')[0]!, i = entry.indexOf('='); cookies.set(entry.slice(0, i), entry.slice(i + 1)) }
    requests.push({ role, path: new URL(String(input)).pathname + new URL(String(input)).search, method: init?.method ?? 'GET', status: response.status, school: headers.get('X-School-Id') })
    if (dropGenerate && new URL(String(input)).pathname.endsWith('/generate')) { dropGenerate = false; throw new Error('Deliberately lost actual accepted response for recovery test') }
    return response
  }
  const api = createApiClient({ origin, fetch: transport, getSchoolId: () => schoolId, getCookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') })
  return { api, loseNextGenerateReply: () => { dropGenerate = true }, select: (id: string) => { schoolId = id } }
}
afterAll(async () => { if (active) await writeFile('docs/fe006/evidence/http-mutations.json', JSON.stringify(evidence, null, 2)) })

it.skipIf(!active)('executes actual isolated Redis jobs with MockLlmProvider, same-key recovery and PostgreSQL results', async () => {
  const fixture = JSON.parse(await readFile('docs/fe006/evidence/test-fixtures.json', 'utf8')) as Fixture
  expect([fixture.database, fixture.environment, fixture.databaseUser]).toEqual(['school_events_test', 'testing', 'school_test_user'])
  expect(fixture.queue).toMatch(/^fe006_[a-f0-9]{10}$/)
  const env = await readFile('C:/Users/bross/WebstormProjects/school/.env.testing', 'utf8'), key = env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g, '')
  const password = createHmac('sha256', key).update(`FE006:${fixture.runId}`).digest('hex')
  const author = session('author'), other = session('other'), director = session('director'), multi = session('multi')
  const A = fixture.schools.A.id, B = fixture.schools.B.id
  for (const [name, s] of [['author', author], ['other', other], ['director', director], ['multi', multi]] as const) { expect(parseSessionProfile(await s.api.request('post', '/auth/login', { tenant: false, body: { email: fixture.users[name].email, password } })).user.id).toBe(fixture.users[name].id); s.select(A) }
  const body = { calendar_event_id: fixture.events.approved, scale: 'class_level' as const, format_type: 'class_hour' as const, target_grades: [5, 6], participants_count: 25, duration_minutes: 45, value_direction: 'historical_memory' as const, family_involvement: false, available_resources: ['Проектор', 'Бумага'], pedagogical_constraints: 'Синтетические сведения только для проверки интеграции.' }
  const request = await author.api.request('post', '/scenario-requests', { body }), id = request.data.id, idem = randomUUID()
  evidence.requestId = id; evidence.keyHash = createHash('sha256').update(idem).digest('hex')
  const launch = (s = author, key = idem) => s.api.request('post', '/scenario-requests/{id}/generate', { params: { id }, headers: { 'Idempotency-Key': key } })
  await expect(author.api.request('post', '/scenario-requests/{id}/generate', { params: { id } })).rejects.toMatchObject({ status: 422 })
  await expect(launch(director)).rejects.toMatchObject({ status: 403 })
  const accepted = await launch(), runId = parseAccepted(accepted)
  expect(accepted.data.status).toBe('queued'); evidence.accepted = accepted
  const getRun = (s = author) => s.api.request('get', '/generation-runs/{id}', { params: { id: runId } }).then(parseRun)
  expect((await getRun()).status).toBe('queued')
  expect(parseAccepted(await launch())).toBe(runId)
  await expect(launch(author, randomUUID())).rejects.toMatchObject({ status: 409, recovery: { runId } })
  await expect(getRun(other)).rejects.toMatchObject({ status: 403 })
  const lostRequest = await author.api.request('post', '/scenario-requests', { body: { ...body, calendar_event_id: undefined, custom_event_title: 'FE006 потерянный ответ '+fixture.runId } })
  const receiptStore = new Map<string, string>(), storage = { getItem: (k: string) => receiptStore.get(k) ?? null, setItem: (k: string, v: string) => { receiptStore.set(k, v) } }
  const launcher = createGenerationLauncher(() => `${fixture.users.author.id}:${A}:${lostRequest.data.id}`, storage, () => randomUUID())
  const lostLaunch = (key: string, signal: AbortSignal) => author.api.request('post', '/scenario-requests/{id}/generate', { params: { id: lostRequest.data.id }, headers: { 'Idempotency-Key': key }, signal }).then(parseAccepted)
  author.loseNextGenerateReply(); await launcher.launch(lostLaunch); expect(launcher.receipt.value?.phase).toBe('uncertain')
  const originalKey = launcher.receipt.value!.key
  launcher.reset(); await launcher.launch(lostLaunch); expect(launcher.receipt.value?.key).toBe(originalKey); expect(launcher.receipt.value?.runId).toBeTruthy()
  evidence.lostReplyRecovery = { requestId: lostRequest.data.id, runId: launcher.receipt.value!.runId, sameKey: true, simulation: 'actual POST 202 response discarded by transport after server acceptance; replay sent to Laravel' }
  const browserRequest = await multi.api.request('post', '/scenario-requests', { body: { ...body, scale: 'family_community', family_involvement: true, duration_minutes: 90 } })
  await writeFile('docs/fe006/evidence/browser-request.json', JSON.stringify({ requestId: browserRequest.data.id, schoolId: A, user: 'multi', queue: fixture.queue }, null, 2))
  const inspectArgs = ['compose', '-f', 'C:/Users/bross/WebstormProjects/school/docker-compose.yml', 'exec', '-T', '-e', `FE006_SCHOOL_A=${A}`, '-e', `FE006_SCHOOL_B=${B}`, 'app-test', 'php']
  const script = await readFile('tests/backend/fe006-inspect.php', 'utf8')
  // This read verifies both PostgreSQL identity and Redis isolation before any worker is started.
  const { spawnSync } = await import('node:child_process')
  const before = spawnSync('docker', inspectArgs, { input: script, encoding: 'utf8', timeout: 30000, windowsHide: true })
  expect(before.status).toBe(0)
  const contour = JSON.parse(before.stdout)
  expect([contour.database, contour.role, contour.queueConnection, contour.queueName, String(contour.redisDatabase)]).toEqual(['school_events_test', 'school_test_user', 'redis', fixture.queue, '1'])
  expect(contour.redisPrefix).toMatch(/^school_events_test/)
  evidence.contour = { database: contour.database, role: contour.role, queueConnection: contour.queueConnection, queueName: contour.queueName, redisDatabase: contour.redisDatabase, redisPrefix: contour.redisPrefix }
  await writeFile('docs/fe006/evidence/queued-database.json', before.stdout)
  const worker = await promisify(execFile)('docker', ['compose', '-f', 'C:/Users/bross/WebstormProjects/school/docker-compose.yml', 'exec', '-T', 'app-test', 'php', 'artisan', 'queue:work', 'redis', `--queue=${fixture.queue}`, '--stop-when-empty', '--tries=1', '--timeout=120', '--no-ansi'], { timeout: 180000, windowsHide: true })
  await writeFile('docs/fe006/evidence/redis-worker.log', worker.stdout + worker.stderr)
  const completed = await getRun(); expect(completed.status).toBe('completed'); expect(completed.provider_name).toBe('mock'); expect(completed.scenario_id).toBeTruthy(); evidence.completedRun = completed
  expect(parseAccepted(await launch())).toBe(runId)
  await expect(launch(author, randomUUID())).rejects.toMatchObject({ status: 409, recovery: { scenarioId: completed.scenario_id } })
  const scenarioId = completed.scenario_id!
  const scenarioEnvelope = await author.api.request('get', '/scenarios/{id}', { params: { id: scenarioId } }), result = parseScenario(scenarioEnvelope, A)
  const version = scenarioEnvelope.data.current_revision!.version_number!
  const revisionEnvelope = await author.api.request('get', '/scenarios/{id}/revisions/{version}', { params: { id: scenarioId, version } })
  const revision = parseRevision(revisionEnvelope, result)
  expect(revision.version_number).toBe(1); expect(revision.content_payload.stages).toBeInstanceOf(Array); expect(revision.content_payload.cultural_claims).toBeInstanceOf(Array)
  evidence.scenario = scenarioEnvelope.data; evidence.revision = revisionEnvelope.data
  await writeFile('docs/fe006/evidence/generated-scenario.json', JSON.stringify({ ...result, revision, provider: 'mock' }, null, 2))
  await expect(other.api.request('get', '/scenarios/{id}', { params: { id: scenarioId } })).rejects.toMatchObject({ status: 403 })
  await expect(other.api.request('get', '/scenarios/{id}/revisions/{version}', { params: { id: scenarioId, version } })).rejects.toMatchObject({ status: 403 })
  multi.select(B)
  await expect(getRun(multi)).rejects.toMatchObject({ status: 403 })
  await expect(multi.api.request('get', '/scenarios/{id}', { params: { id: scenarioId } })).rejects.toMatchObject({ status: 403 })
  const foreignRequest = await multi.api.request('post', '/scenario-requests', { body: { ...body, calendar_event_id: undefined, custom_event_title: 'FE006 школа B '+fixture.runId } })
  await expect(author.api.request('post', '/scenario-requests/{id}/generate', { params: { id: foreignRequest.data.id }, headers: { 'Idempotency-Key': randomUUID() } })).rejects.toMatchObject({ status: 403 })
  expect((await director.api.request('get', '/scenarios/{id}', { params: { id: scenarioId } })).data.id).toBe(scenarioId)
  for (const s of [author, other, director, multi]) await s.api.request('post', '/auth/logout', { tenant: false })
  await expect(getRun()).rejects.toMatchObject({ status: 401 })
  const after = spawnSync('docker', inspectArgs, { input: script, encoding: 'utf8', timeout: 30000, windowsHide: true }); expect(after.status).toBe(0)
  const persisted = JSON.parse(after.stdout)
  expect(persisted.runs.filter((r: { scenario_request_id: string }) => r.scenario_request_id === id)).toHaveLength(1)
  expect(persisted.runs.filter((r: { scenario_request_id: string }) => r.scenario_request_id === lostRequest.data.id)).toHaveLength(1)
  expect(persisted.scenarios.find((s: { id: string }) => s.id === scenarioId).revisions).toHaveLength(1)
  await writeFile('docs/fe006/evidence/persisted-generation.json', after.stdout)
  evidence.completed = true
}, 300000)

