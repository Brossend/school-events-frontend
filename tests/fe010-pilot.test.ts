import { describe, expect, it } from 'vitest'
import type { ParticipantInput, PilotAccessContext, PilotCriterion, PilotMetrics, PilotOperationOverrides, PilotResponseInput } from '../app/types/pilot'
import { parsePilotExport, parsePilotInvitation, parsePilotMetrics, parsePilotParticipants, parsePilotResponse, parsePilotReview, pilotExportJson, pilotMetricCards, pilotMetricsQuery, pilotParticipantIssues, pilotPermissions, pilotResponseIssues, pilotReviewIssues, pilotReviewState, pilotSyntheticMode } from '../app/utils/pilot'

const ids = { participant: '019a0000-0000-7000-8000-000000000001', response: '019a0000-0000-7000-8000-000000000002', scenario: '019a0000-0000-7000-8000-000000000003', school: '019a0000-0000-7000-8000-000000000004' }
const stamp = '2026-10-28T10:00:00+00:00'
const keys: PilotCriterion[] = ['time_saving_ge_50', 'personalization_ge_70', 'manual_edit_under_20_ge_70', 'cultural_usage_ge_60', 'cultural_usefulness_ge_4', 'zero_critical_cultural_errors']
function metrics(n: number, audited = 0, errors = 0): PilotMetrics {
  const completed = n >= 20 && audited === n && errors === 0
  return {
    status: n === 0 ? 'no_data' : completed ? 'completed' : 'active_pilot', total_participants: n, submitted_responses_count: n, audited_responses_count: audited, audited_reviews_count: audited, pending_expert_reviews_count: n - audited, expert_review_coverage_percent: n ? audited / n * 100 : null,
    median_relative_time_saving_percent: n ? 50 : null, personalization_choice_percent: n ? 100 : null, self_reported_personalization_choice_percent: n ? 100 : null, manual_edit_under_20_percent_ratio: n ? 100 : null, cultural_context_usage_percent: n ? 100 : null, average_cultural_usefulness_score: n ? 4 : null, critical_cultural_errors_count: audited ? errors : null,
    sample_size: n, target_sample_size: 20, is_survey_completed: n >= 20, is_expert_evaluation_completed: n >= 20 && audited === n, is_pilot_completed: completed,
    criteria_progress: { time_saving_ge_50: n > 0, personalization_ge_70: n > 0, manual_edit_under_20_ge_70: n > 0, cultural_usage_ge_60: n > 0, cultural_usefulness_ge_4: n > 0, zero_critical_cultural_errors: n > 0 && audited === n && errors === 0 },
    criteria_status: { time_saving_ge_50: n ? 'pass' : 'pending_data', personalization_ge_70: n ? 'pass' : 'pending_data', manual_edit_under_20_ge_70: n ? 'pass' : 'pending_data', cultural_usage_ge_60: n ? 'pass' : 'pending_data', cultural_usefulness_ge_4: n ? 'pass' : 'pending_data', zero_critical_cultural_errors: audited && errors > 0 ? 'fail' : n > 0 && audited === n ? 'pass' : 'pending_review' },
    sample_breakdown: { personalization: { selected: n, total: n }, manual_edits: { under_20_percent: n, total: n }, cultural_context: { used: n, rated_count: n, total: n }, expert_reviews: { audited, pending: n - audited, coverage_percent: n ? audited / n * 100 : null, critical_errors: audited ? errors : null } },
  }
}
function input(): PilotResponseInput { return { invite_token: 'TEST-PLACEHOLDER', scenario_id: ids.scenario, prep_time_baseline_minutes: 1, prep_time_ai_minutes: 0, personalization_selected: true, manual_edit_percentage: 20, cultural_context_used: false } }
function response() { return { id: ids.response, participant_id: ids.participant, scenario_id: ids.scenario, comparison_id: null, is_synthetic: false, prep_time_baseline_minutes: 60, prep_time_ai_minutes: 20, relative_time_saving: 0.6667, relative_time_saving_percent: 66.67, personalization_selected: true, manual_edit_percentage: 20, cultural_context_used: false, cultural_usefulness_score: null, feedback_text: null, created_at: stamp } }
function context(overrides: Partial<PilotAccessContext> = {}): PilotAccessContext { return { authenticated: true, active: true, systemRole: 'none', schoolId: ids.school, schoolRegionCode: '66', schoolRole: 'teacher', ...overrides } }

describe('FE010 actual Pilot DTO boundaries', () => {
  it('types API responses as envelopes and accepts automatic synthetic invitation flags', () => {
    const body: PilotOperationOverrides['/pilot/participants']['post']['requestBody']['content']['application/json'] = { subject_area: 'История', teaching_experience_years: 10, is_synthetic: true }
    const reply: PilotOperationOverrides['/pilot/metrics']['get']['responses'][200]['content']['application/json'] = { data: metrics(0) }
    const query: NonNullable<PilotOperationOverrides['/pilot/metrics']['get']['parameters']['query']> = { scope: 'school', include_synthetic: true }
    expect(body.is_synthetic).toBe(true)
    expect(query.include_synthetic).toBe(true)
    expect(reply.data.status).toBe('no_data')
  })
  it('parses participant flags without fabricating response identifiers', () => {
    const [p] = parsePilotParticipants({ data: [{ id: ids.participant, anonymous_code: 'SYNTHETIC-EXAMPLE', subject_area: 'История', teaching_experience_years: 10, is_submitted: true, is_synthetic: true, expires_at: stamp, is_expired: false, is_revoked: false, used_at: stamp, has_response: true, created_at: stamp }] })
    expect(p?.has_response).toBe(true)
    expect(p).not.toHaveProperty('response_id')
    expect(parsePilotParticipants({ data: [] })).toEqual([])
  })
  it('accepts both invitation response variants without persisting tokens', () => {
    const payload = { data: { id: ids.participant, anonymous_code: 'SYNTHETIC-EXAMPLE', invite_token: 'TEST-PLACEHOLDER', expires_at: stamp, notice: 'Example only' } }
    expect(parsePilotInvitation(payload).invite_token).toBe('TEST-PLACEHOLDER')
    expect(parsePilotInvitation({ data: { ...payload.data, subject_area: 'История', teaching_experience_years: 10, is_synthetic: true } }).is_synthetic).toBe(true)
    expect(parsePilotInvitation(payload)).not.toHaveProperty('is_synthetic')
  })
  it('keeps effective review and history unknown on a fresh GET', () => {
    const r = parsePilotResponse({ data: response() })
    expect(r.cultural_usefulness_score).toBeNull()
    expect(pilotReviewState(r)).toEqual({ kind: 'unknown', effectiveFinding: null, history: null })
    expect(r).not.toHaveProperty('critical_cultural_errors')
  })
  it('parses the version returned only by review POST', () => {
    const r = parsePilotReview({ data: { id: ids.response, pilot_response_id: ids.response, expert_name: 'Эксперт', expert_audit_status: 'audited', critical_cultural_errors: 0, methodological_remarks: null, finding_version: 2, is_effective: true, reviewed_at: stamp } })
    expect(r.finding_version).toBe(2)
    expect(r.critical_cultural_errors).toBe(0)
  })
  it('rejects malformed payloads with a generic error that excludes input secrets', () => {
    expect(() => parsePilotInvitation({ data: { invite_token: 'NEVER-ECHO-THIS' } })).toThrow('Некорректный ответ API')
    expect(() => parsePilotResponse({ data: { ...response(), is_synthetic: 'false' } })).toThrow()
    expect(() => parsePilotMetrics({ data: { ...metrics(1), sample_breakdown: undefined } })).toThrow()
    expect(() => parsePilotMetrics({ data: { ...metrics(1), median_relative_time_saving_percent: NaN } })).toThrow()
  })
})

describe('FE010 form validation follows FormRequests and service', () => {
  it('accepts actual 1 minute baseline, 0 minute AI, null unused culture, and negative savings inputs', () => {
    expect(pilotResponseIssues(input())).toEqual({})
    expect(pilotResponseIssues({ ...input(), prep_time_ai_minutes: 90, cultural_usefulness_score: null })).toEqual({})
  })
  it.each([undefined, null, 0, 6, 4.5])('requires a 1–5 integer score when culture is used (%s)', score => {
    expect(pilotResponseIssues({ ...input(), cultural_context_used: true, cultural_usefulness_score: score })).toHaveProperty('cultural_usefulness_score')
  })
  it('validates optional fields and numeric boundaries without calculating server savings', () => {
    const issues = pilotResponseIssues({ ...input(), invite_token: ' ', scenario_id: 'wrong', comparison_id: 'wrong', prep_time_baseline_minutes: 0, prep_time_ai_minutes: -1, manual_edit_percentage: Infinity, feedback_text: 'x'.repeat(5001) })
    expect(Object.keys(issues)).toHaveLength(7)
    expect(pilotResponseIssues({ ...input(), cultural_context_used: true, cultural_usefulness_score: 5, manual_edit_percentage: 100 })).toEqual({})
  })
  it('accepts participant aliases and checks limits', () => {
    const p: ParticipantInput = { subject_area: 'История', teaching_experience_years: 0, expires_days: 90, valid_days: null, is_synthetic: true }
    expect(pilotParticipantIssues(p)).toEqual({})
    expect(Object.keys(pilotParticipantIssues({ ...p, subject_area: '', teaching_experience_years: 61, anonymous_code: 'x'.repeat(65), valid_days: 0, expires_days: 91 }))).toHaveLength(5)
  })
  it('requires review status and nonnegative integer critical errors', () => {
    expect(pilotReviewIssues({ expert_audit_status: 'pending_audit', critical_cultural_errors: 0 })).toEqual({})
    expect(pilotReviewIssues({ expert_audit_status: 'rejected', critical_cultural_errors: 1, methodological_remarks: 'x'.repeat(5001) })).toHaveProperty('methodological_remarks')
    expect(pilotReviewIssues({ expert_audit_status: 'audited', critical_cultural_errors: -1 })).toHaveProperty('critical_cultural_errors')
  })
})

describe('FE010 metric display uses server results', () => {
  it.each([0, 1, 5, 20])('preserves N=%s and incomplete review status', n => {
    const m = parsePilotMetrics({ data: metrics(n) }), cards = pilotMetricCards(m)
    expect(cards).toHaveLength(6)
    expect(cards.map(c => c.key)).toEqual(keys)
    expect(cards[0]?.sampleSize).toBe(n)
    expect(cards[5]).toMatchObject({ value: null, status: 'pending_review', sampleSize: 0 })
    expect(m.is_pilot_completed).toBe(false)
    expect(m.is_survey_completed).toBe(n >= 20)
    if (!n) expect(cards.slice(0, 5).every(c => c.value === null && c.status === 'pending_data')).toBe(true)
  })
  it('does not turn 5/20 audited with zero errors into PASS', () => {
    const m = parsePilotMetrics({ data: metrics(20, 5) })
    expect(m.expert_review_coverage_percent).toBe(25)
    expect(m.pending_expert_reviews_count).toBe(15)
    expect(m.is_expert_evaluation_completed).toBe(false)
    expect(m.is_pilot_completed).toBe(false)
    expect(pilotMetricCards(m)[5]).toMatchObject({ value: 0, status: 'pending_review', sampleSize: 5 })
  })
  it.each([5, 20])('keeps FAIL for critical errors among %s audited', audited => {
    const m = parsePilotMetrics({ data: metrics(20, audited, 1) })
    expect(pilotMetricCards(m)[5]).toMatchObject({ value: 1, status: 'fail' })
    expect(m.is_pilot_completed).toBe(false)
  })
  it('distinguishes a criterion PASS at N=1 from completion at N=20', () => {
    const small = parsePilotMetrics({ data: metrics(1, 1) })
    expect(pilotMetricCards(small)[5]?.status).toBe('pass')
    expect(small.is_expert_evaluation_completed).toBe(false)
    expect(parsePilotMetrics({ data: metrics(20, 20) }).is_pilot_completed).toBe(true)
  })
  it('preserves negative savings, server status, and the cultural rated denominator', () => {
    const m = metrics(5)
    m.median_relative_time_saving_percent = -20
    m.criteria_status.time_saving_ge_50 = 'fail'
    m.criteria_progress.time_saving_ge_50 = false
    m.average_cultural_usefulness_score = null
    m.criteria_status.cultural_usefulness_ge_4 = 'pending_data'
    m.sample_breakdown.cultural_context.rated_count = 0
    const cards = pilotMetricCards(parsePilotMetrics({ data: m }))
    expect(cards[0]).toMatchObject({ value: -20, status: 'fail' })
    expect(cards[4]).toMatchObject({ value: null, status: 'pending_data', sampleSize: 0 })
  })
})

describe('FE010 RBAC reflects route guards and scoped authority', () => {
  it('allows teacher school aggregates but not individual data, invitation management, review or export', () => {
    expect(pilotPermissions(context())).toEqual({ metrics: true, globalMetrics: false, export: false, globalExport: false, participants: false, responses: false, review: false })
  })
  it('allows school admin within their supplied membership context', () => {
    expect(pilotPermissions(context({ schoolRole: 'school_admin' }))).toMatchObject({ participants: true, responses: true, review: true, export: true, globalMetrics: false })
    expect(pilotPermissions(context({ schoolRole: undefined }))).toMatchObject({ participants: false, responses: false, review: false, metrics: false })
  })
  it('allows regional analytics and review without membership but keeps tenant routes forbidden', () => {
    const c = context({ systemRole: 'catalog_curator', curatorScope: 'regional', curatedRegionCodes: ['66'], schoolRole: undefined })
    expect(pilotPermissions(c)).toEqual({ metrics: true, globalMetrics: false, export: true, globalExport: false, participants: false, responses: false, review: true })
    expect(pilotPermissions({ ...c, schoolRegionCode: '77' })).toMatchObject({ metrics: false, review: false, export: false })
    expect(pilotPermissions({ ...c, curatedRegionCodes: undefined })).toMatchObject({ metrics: false, review: false })
  })
  it('system/global curator privilege does not create a school membership', () => {
    for (const role of ['system_admin', 'catalog_curator']) {
      const c = context({ systemRole: role, curatorScope: 'all_regions', schoolRole: undefined })
      expect(pilotPermissions(c)).toMatchObject({ metrics: true, export: true, review: true, globalMetrics: true, globalExport: true, participants: false, responses: false })
    }
  })
  it('does not invent global curator scope from the actual profile and preserves target-region precedence', () => {
    expect(pilotPermissions(context({ systemRole: 'catalog_curator' }))).toMatchObject({ globalMetrics: false, globalExport: false, metrics: true, review: false })
    expect(pilotPermissions(context({ systemRole: 'catalog_curator', curatorScope: 'regional', curatedRegionCodes: ['77'], schoolRole: 'school_admin' }))).toMatchObject({ metrics: false, participants: false, responses: false, review: false, export: false })
  })
  it.each([{ authenticated: false }, { active: false }])('denies inactive/unauthenticated context %s', overrides => {
    expect(Object.values(pilotPermissions(context({ ...overrides, systemRole: 'system_admin', schoolRole: 'school_admin' }))).every(v => !v)).toBe(true)
  })
})

describe('FE010 synthetic isolation and aggregate JSON export', () => {
  it.each(['http://localhost:8000', 'http://127.0.0.1:8001', 'https://localhost:8001', 'http://localhost:8001.evil.test', 'http://localhost:8001/api/v1', 'http://localhost:8001?synthetic=1', 'http://user@localhost:8001', 'https://production.example'])('rejects synthetic opt-in for %s', origin => {
    expect(pilotSyntheticMode(origin, '1')).toBe(false)
  })
  it('requires exact opt-in and omits include_synthetic in normal requests', () => {
    expect(pilotSyntheticMode('http://localhost:8001', '1')).toBe(true)
    for (const value of [undefined, true, 1, ['1'], 'true', '0']) expect(pilotSyntheticMode('http://localhost:8001', value)).toBe(false)
    expect(pilotMetricsQuery()).toEqual({ scope: 'school' })
    expect(pilotMetricsQuery('global', false)).not.toHaveProperty('include_synthetic')
    expect(pilotMetricsQuery('school', pilotSyntheticMode('http://localhost:8001', '1'))).toEqual({ scope: 'school', include_synthetic: 1 })
  })
  it('exports the actual flat metrics JSON without tokens or individual answers', () => {
    const payload = { data: { exported_at: stamp, scope: 'school', school_id: ids.school, metrics: metrics(20, 5), invite_token: 'NEVER-EXPORT', responses: [response()] } }
    const parsed = parsePilotExport(payload)
    expect(parsed.metrics.sample_size).toBe(20)
    expect(parsed.metrics).not.toHaveProperty('data')
    const output = pilotExportJson(payload)
    expect(JSON.parse(output)).toEqual({ data: parsed })
    expect(output).not.toContain('NEVER-EXPORT')
    expect(output).not.toContain('participant_id')
    expect(output).not.toContain('xlsx')
  })
  it('rejects OpenAPI double-envelope metrics and mismatched export scope', () => {
    const payload = { data: { exported_at: stamp, scope: 'global', school_id: null, metrics: metrics(0) } }
    expect(parsePilotExport(payload).school_id).toBeNull()
    expect(() => parsePilotExport({ data: { ...payload.data, metrics: { data: metrics(0) } } })).toThrow()
    expect(() => parsePilotExport({ data: { ...payload.data, school_id: ids.school } })).toThrow()
  })
})
