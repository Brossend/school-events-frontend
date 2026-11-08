import { afterAll, expect, it } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const active = process.env.FE011_ISOLATED === '1'
const origin = 'http://localhost:8001', dir = 'docs/fe011/evidence'
const trace: object[] = [], evidence: Record<string, unknown> = { origin, completed: false, trace }
afterAll(async () => { if (active) await writeFile(`${dir}/http-admin.json`, JSON.stringify(evidence, null, 2)) })

it.skipIf(!active)('FE011 real HTTP/PostgreSQL school administration and claim provenance lifecycle', async () => {
  const f = JSON.parse(await readFile(`${dir}/test-fixtures.json`, 'utf8'))
  expect([f.database, f.environment, f.databaseUser, f.queue]).toEqual(['school_events_test', 'testing', 'school_test_user', 'sync'])
  const probe = await fetch(`${origin}/api/v1/test/environment-probe`, { signal: AbortSignal.timeout(30000) }).then(r => r.json())
  expect([probe.environment, probe.database, probe.configured_database]).toEqual(['testing', 'school_events_test', 'school_events_test'])
  evidence.probe = probe
  const stateScript = await readFile('tests/backend/fe011-state.php', 'utf8')
  const snapshot = async (label: string) => {
    const r = spawnSync('docker', ['compose', '-f', 'C:/Users/bross/WebstormProjects/school/docker-compose.yml', 'exec', '-T', '-e', `FE011_RUN=${f.runId}`, 'app-test', 'php'], { input: stateScript, encoding: 'utf8', timeout: 60000, windowsHide: true })
    if (r.status !== 0 || !r.stdout.trim().startsWith('{')) throw new Error(`FE011 scoped database inspection failed: ${label}`)
    const data = JSON.parse(r.stdout)
    await writeFile(`${dir}/postgres-${label}.json`, JSON.stringify(data, null, 2))
    return data
  }
  const before = await snapshot('before')
  const owned = new Set<string>([...Object.values(f.schools).map(s => (s as { id: string }).id), ...Object.values(f.events) as string[], ...Object.values(f.sources) as string[], ...Object.values(f.claims).flatMap(c => Object.values(c as Record<string, string>))])
  const absent = '00000000-0000-4000-8000-000000000011'
  const env = await readFile('C:/Users/bross/WebstormProjects/school/.env.testing', 'utf8')
  const key = env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g, '')
  const password = createHmac('sha256', key).update(`FE011:${f.runId}`).digest('hex')
  function session(role: string, school?: string) {
    const cookies = new Map<string, string>()
    const call = async (method: string, path: string, body?: object, status = 200, extra: Record<string, string> = {}) => {
      const url = new URL(path.startsWith('/sanctum') ? path : `/api/v1${path}`, origin)
      if (url.origin !== origin) throw new Error('FE011 non-isolated destination')
      if (method !== 'GET' && !path.startsWith('/auth/') && !path.startsWith('/sanctum')) {
        for (const id of path.match(/[a-f0-9]{8}-[a-f0-9-]{27}/g) ?? []) if (!owned.has(id) && id !== absent) throw new Error('FE011 foreign mutation target')
        if (body && 'event_source_id' in body && !owned.has(String(body.event_source_id))) throw new Error('FE011 foreign evidence source')
      }
      const headers = new Headers({ Accept: 'application/json', Origin: 'http://localhost:3000', Referer: 'http://localhost:3000/', ...extra })
      headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
      if (school) headers.set('X-School-Id', school)
      if (cookies.has('XSRF-TOKEN')) headers.set('X-XSRF-TOKEN', decodeURIComponent(cookies.get('XSRF-TOKEN')!))
      if (body) headers.set('Content-Type', 'application/json')
      const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual', signal: AbortSignal.timeout(90000) })
      for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0]!, i = pair.indexOf('='); cookies.set(pair.slice(0, i), pair.slice(i + 1)) }
      const binary = response.ok && response.headers.get('Content-Type')?.includes('wordprocessingml')
      const bytes = binary ? Buffer.from(await response.arrayBuffer()) : undefined
      const payload = binary ? { bytes: bytes!.length, sha256: createHash('sha256').update(bytes!).digest('hex') } : await response.json().catch(() => null)
      trace.push({ role, method, path, school: school ?? null, status: response.status, request: path.includes('/auth/') ? '[authentication omitted]' : body, response: path.includes('/auth/') ? '[authentication omitted]' : payload })
      await writeFile(`${dir}/http-admin.json`, JSON.stringify(evidence, null, 2))
      expect(response.status, `${role} ${method} ${path}: ${JSON.stringify(payload?.error ?? '')}`).toBe(status)
      return { ...payload, binary: bytes }
    }
    return { call, select: (id?: string) => { school = id }, login: async () => { await call('GET', '/sanctum/csrf-cookie', undefined, 204); await call('POST', '/auth/login', { email: f.users[role].email, password }) } }
  }
  const A = f.schools.A.id, B = f.schools.B.id, C = f.schools.C.id
  const teacher = session('teacher', A), admin = session('schoolAdmin', A), other = session('other', B), regional = session('regional'), system = session('system'), multi = session('multi', A)
  await session('anonymous').call('GET', `/schools/${A}`, undefined, 401)
  const logins = await Promise.allSettled([teacher, admin, other, regional, system, multi].map(s => s.login()))
  for (const result of logins) if (result.status === 'rejected') throw result.reason
  const profile = (await teacher.call('GET', `/schools/${A}`)).data
  expect([profile.active_teachers_count, profile.traditions_count]).toEqual([2, 1])
  await teacher.call('PATCH', `/schools/${A}`, { city: 'Казань' }, 403)
  await other.call('GET', `/schools/${A}`, undefined, 403)
  await admin.call('PATCH', `/schools/${B}`, { city: 'Казань' }, 403)
  await teacher.call('GET', `/schools/${C}`, undefined, 403)
  await regional.call('GET', `/schools/${A}`, undefined, 403)
  await regional.call('PATCH', `/schools/${A}`, { city: 'Казань' }, 403)
  await system.call('GET', `/schools/${A}`)
  expect((await system.call('GET', '/auth/me')).data.schools).toHaveLength(0)
  await system.call('PATCH', `/schools/${A}`, { short_name: 'FE011 system edit' })
  await admin.call('PATCH', `/schools/${A}`, { short_name: 'FE011 school admin', city: 'Екатеринбург', settings: { phone: '+7 000 000 0011', email: 'fe011@example.test', website: 'https://example.test/fe011', description: 'FE011 synthetic school settings' } })
  const saved = (await admin.call('GET', `/schools/${A}`)).data
  expect(saved.settings.address).toBe(profile.settings.address)
  expect(saved.active_teachers_count).toBe(profile.active_teachers_count)
  const draft = { name: 'x', city: '', inn: 'bad', settings: { email: 'invalid' } }
  const invalid = await admin.call('PATCH', `/schools/${A}`, draft, 422)
  expect(invalid.error ?? invalid.errors).toBeTruthy()
  expect((await admin.call('GET', `/schools/${A}`)).data).toMatchObject({ name: saved.name, city: saved.city, inn: saved.inn })
  evidence.invalidDraft = { submitted: draft, persistedUnchanged: true, draftPreservationUI: 'Parent unit/UI tests own input preservation; HTTP verifies rejection and no persistence' }
  await system.call('GET', `/schools/${absent}`, undefined, 404)
  multi.select(B); expect((await multi.call('GET', `/schools/${B}`)).data.id).toBe(B); multi.select(A)
  await teacher.call('GET', '/system/status', undefined, 403)
  expect((await regional.call('GET', '/system/status')).data.system_role).toBe('catalog_curator')
  expect((await system.call('GET', '/system/status')).data.system_status).toBe('operational')
  await teacher.call('GET', '/catalog/review-queue', undefined, 403)
  const queue = (await regional.call('GET', '/catalog/review-queue?status=pending&per_page=100')).data
  const queueIds = queue.map((s: { id: string }) => s.id)
  expect(queueIds).toContain(f.sources.regional66); expect(queueIds).toContain(f.sources.federal); expect(queueIds).not.toContain(f.sources.regional77)
  const allPage1 = await regional.call('GET', '/catalog/review-queue?status=all&per_page=5&page=1')
  const allPage2 = await regional.call('GET', '/catalog/review-queue?status=all&per_page=5&page=2')
  expect(allPage1.meta.per_page).toBe(5)
  expect(allPage1.meta.current_page).toBe(1)
  expect(allPage2.meta.current_page).toBe(2)
  expect(allPage1.data).toHaveLength(5)
  const firstIds = new Set(allPage1.data.map((s: { id: string }) => s.id))
  const overlappingIds = allPage2.data.filter((s: { id: string }) => firstIds.has(s.id)).map((s: { id: string }) => s.id)
  evidence.queueAllPagination = { first: allPage1, second: allPage2, supportedByActualHTTP: true, overlappingIds, limitation: overlappingIds.length ? 'Actual backend orders created_at DESC without an id tie-breaker; equal-timestamp rows can overlap pages. Do not promise stable cursor pagination.' : null }
  await teacher.call('GET', `/event-sources/${f.sources.schoolB}`, undefined, 404)
  await teacher.call('GET', `/cultural-claims/${f.claims.regional77.primary}`, undefined, 404)
  await regional.call('GET', `/event-sources/${f.sources.regional77}`, undefined, 404)
  for (const kind of ['federal', 'regional77']) {
    await regional.call('PATCH', `/event-sources/${f.sources[kind]}`, { title: 'FE011 forbidden regional mutation' }, 403)
    await regional.call('GET', `/event-sources/${f.sources[kind]}/reviews`, undefined, 403)
    await regional.call('POST', `/event-sources/${f.sources[kind]}/reviews`, { decision: 'approved', comments: 'FE011 forbidden review' }, 403)
    await regional.call('POST', `/cultural-claims/${f.claims[kind].primary}/evidence`, { event_source_id: f.sources[kind], citation_locator: 'Section 11', citation_excerpt: 'FE011 synthetic excerpt for scope verification.', verify: true }, 403)
    await regional.call('DELETE', `/cultural-claims/${f.claims[kind].primary}/evidence/${f.sources[kind]}`, { reason: 'FE011 forbidden detach' }, 403)
  }
  const source = f.sources.regional66, claim = f.claims.regional66.primary, sibling = f.claims.regional66.sibling
  const attach = (id: string, verify: boolean, status = 201) => regional.call('POST', `/cultural-claims/${id}/evidence`, { event_source_id: source, citation_locator: 'Section 11, page 66', citation_excerpt: 'FE011 synthetic evidence excerpt; integration test only.', applicable_academic_year: '2026-2027', notes: 'Synthetic FE011 attestation; not historical expert review.', verify }, status)
  await teacher.call('PATCH', `/event-sources/${source}`, { title: 'FE011 forbidden teacher edit' }, 403)
  await teacher.call('POST', `/event-sources/${source}/reviews`, { decision: 'approved', comments: 'FE011 forbidden review' }, 403)
  await regional.call('PATCH', `/event-sources/${source}`, { url: 'invalid-url' }, 422)
  await regional.call('POST', `/event-sources/${source}/reviews`, { decision: 'invalid', comments: 'x' }, 422)
  await regional.call('POST', `/cultural-claims/${claim}/evidence`, { event_source_id: f.sources.regional77, citation_locator: 'Section 11', citation_excerpt: 'FE011 synthetic excerpt.' }, 422)
  await attach(claim, true, 422)
  await attach(claim, false); await attach(sibling, false)
  const review = await regional.call('POST', `/event-sources/${source}/reviews`, { decision: 'approved', comments: 'FE011 synthetic source review, separate from claim verification.' }, 201)
  f.reviewId = review.data.id
  const detail = async (id = claim) => (await regional.call('GET', `/cultural-claims/${id}`)).data
  expect((await detail()).evidence_records[0].effective_status).toBe('unverified')
  await attach(claim, true)
  expect((await detail()).evidence_records[0].effective_status).toBe('verified_authentic')
  expect((await detail(sibling)).evidence_records[0].effective_status).toBe('unverified')
  const beforeAmendment = await detail()
  await snapshot('verified')
  await regional.call('PATCH', `/event-sources/${source}`, { author: `FE011 amended synthetic author ${randomUUID()}` })
  const amended = await detail()
  expect(amended.evidence_records[0].effective_status).toBe('unverified')
  const retainedAuditIds = new Set(amended.evidence_audit_events.map((e: { id: string }) => e.id))
  expect(beforeAmendment.evidence_audit_events.every((e: { id: string }) => retainedAuditIds.has(e.id))).toBe(true)
  evidence.sourceAmendmentAudit = { before: beforeAmendment, after: amended, invalidationEventReturned: amended.evidence_audit_events.some((e: { action: string }) => e.action === 'invalidated_by_source_amendment'), runtimeDiscrepancy: 'Local controller includes invalidation audit creation; live HTTP may omit it. Preserve actual response and do not change backend to pass.' }
  await snapshot('amended')
  const amendmentQueue = await regional.call('GET', '/catalog/review-queue?status=requires_amendment&per_page=100')
  expect(amendmentQueue.data.some((s: { id: string; status: string }) => s.id === source && s.status === 'requires_amendment')).toBe(true)
  // Exercise rejected filtering on a separate own source; primary scenario evidence remains independent.
  await system.call('POST', `/event-sources/${f.sources.federal}/reviews`, { decision: 'rejected', comments: 'FE011 synthetic rejection to verify queue filter; owned fixture only.' }, 201)
  const rejectedQueue = await regional.call('GET', '/catalog/review-queue?status=rejected&per_page=100')
  expect(rejectedQueue.data.some((s: { id: string }) => s.id === f.sources.federal)).toBe(true)
  await regional.call('POST', `/event-sources/${source}/reviews`, { decision: 'approved', comments: 'FE011 reapproval still does not attest any claim.' }, 201)
  expect((await detail()).evidence_records[0].effective_status).toBe('unverified')
  await attach(claim, true)
  const approvedQueue = await regional.call('GET', '/catalog/review-queue?status=approved&per_page=100')
  const queueSource = approvedQueue.data.find((s: { id: string }) => s.id === source)
  expect(queueSource.status).toBe('approved')
  evidence.queueFilters = { amendment: amendmentQueue, rejected: rejectedQueue, approved: approvedQueue }
  await snapshot('reverified')
  // Scenario generation, verification, signoff and exports use this run's own event/source/claim only.
  const request = await teacher.call('POST', '/scenario-requests', { calendar_event_id: f.events.regional66, scale: 'class_level', format_type: 'class_hour', target_grades: [5, 6], participants_count: 25, duration_minutes: 45, value_direction: 'mutual_aid', family_involvement: false, available_resources: ['Бумага', 'Проектор'] }, 201)
  owned.add(request.data.id)
  const generated = await teacher.call('POST', `/scenario-requests/${request.data.id}/generate`, undefined, 202, { 'Idempotency-Key': randomUUID() })
  f.generation = generated.data
  const run = (await teacher.call('GET', `/generation-runs/${generated.data.run_id}`)).data
  expect(run.status).toBe('completed')
  const scenario = run.scenario_id; owned.add(scenario)
  f.scenarioId = scenario; f.requestId = request.data.id
  const revisionPath = `/scenarios/${scenario}/revisions/1`
  await teacher.call('POST', `${revisionPath}/verify`, undefined, 202)
  const verification = await teacher.call('GET', `${revisionPath}/verifications`)
  evidence.verification = verification
  // The unverified sibling is deliberately left as a negative per-claim proof above, then attested explicitly.
  await attach(sibling, true)
  await teacher.call('POST', `${revisionPath}/verify`, undefined, 202)
  await teacher.call('POST', `${revisionPath}/signoff`, { checklist_confirmed: { safety_checked: true, timing_fit: true, cultural_context_approved: true }, teacher_notes: 'FE011 synthetic isolated test signoff.' })
  const exportResponse = await teacher.call('POST', `${revisionPath}/exports`, { format: 'docx' }, 202, { 'Idempotency-Key': randomUUID() })
  const exportId = exportResponse.data.id; owned.add(exportId); f.exportId = exportId
  const doc = await teacher.call('GET', `/export-jobs/${exportId}/download`)
  await mkdir(`${dir}/documents`, { recursive: true }); await writeFile(`${dir}/documents/fe011-own-scenario.docx`, doc.binary)
  await snapshot('signed-export')
  const prior = await detail()
  await regional.call('DELETE', `/cultural-claims/${claim}/evidence/${source}`, { reason: 'FE011 explicit own-source/own-claim revocation confirmed by test' })
  const revoked = await detail()
  expect(revoked.evidence_records[0]).toMatchObject({ is_detached: true, effective_status: 'unverified', verification_status: 'unverified' })
  expect(revoked.evidence_audit_events.length).toBe(prior.evidence_audit_events.length + 1)
  expect((await detail(sibling)).evidence_records[0].effective_status).toBe('verified_authentic')
  await regional.call('DELETE', `/cultural-claims/${claim}/evidence/${source}`, { reason: 'FE011 duplicate detach' }, 404)
  await teacher.call('GET', `/export-jobs/${exportId}/download`, undefined, 403)
  await teacher.call('POST', `${revisionPath}/exports`, { format: 'docx' }, 403, { 'Idempotency-Key': randomUUID() })
  const history = await teacher.call('GET', `${revisionPath}/exports`)
  evidence.exportHistoryAfterRevocation = history
  expect(history.data.every((job: { is_downloadable: boolean }) => !job.is_downloadable)).toBe(true)
  // Actual 409 proof: stale optimistic revision lock, without changing the live signed fixture.
  await teacher.call('PATCH', revisionPath, { concept: 'FE011 stale lock edit' }, 409, { 'If-Match': '99999' })
  const reviews = await regional.call('GET', `/event-sources/${source}/reviews`)
  evidence.reviews = reviews
  const after = await snapshot('after')
  const latestSqlReview = after.tables.source_reviews.filter((r: { event_source_id: string }) => r.event_source_id === source).sort((a: { reviewed_at: string; id: string }, b: { reviewed_at: string; id: string }) => b.reviewed_at.localeCompare(a.reviewed_at) || b.id.localeCompare(a.id))[0]
  expect(queueSource.latest_review.id).toBe(latestSqlReview.id)
  expect(reviews.data[0].id).toBe(latestSqlReview.id)
  evidence.latestReviewOrdering = { sqlOrder: 'reviewed_at DESC, id DESC', sqlReviewId: latestSqlReview.id, queueReviewId: queueSource.latest_review.id, reviewHistoryId: reviews.data[0].id }
  const count = (state: typeof after, table: string) => state.tables[table].length
  evidence.postgresDiff = Object.fromEntries(['source_reviews', 'cultural_claim_sources', 'cultural_claim_evidence_audit_events', 'scenarios', 'export_jobs'].map(t => [t, { before: count(before, t), after: count(after, t), delta: count(after, t) - count(before, t) }]))
  await writeFile(`${dir}/postgres-diff.json`, JSON.stringify(evidence.postgresDiff, null, 2))
  f.completed = true; f.finalClaim = revoked; f.latestReviewId = latestSqlReview.id; f.expectedStates = { profile: saved, sourceReview: 'approved', primaryClaim: 'unverified; detached', siblingClaim: 'verified_authentic', export: 'ready artifact retained; download denied by live provenance gate', scenario: 'signed but provenance revoked; never automatically resigned' }
  await writeFile(`${dir}/ui-bootstrap.json`, JSON.stringify(f, null, 2))
  await teacher.call('POST', '/auth/logout', undefined, 204)
  await teacher.call('GET', `/schools/${A}`, undefined, 401)
  evidence.completed = true
}, 1200000)
