import type { ParticipantInput, PilotAccessContext, PilotAuditStatus, PilotCriterion, PilotCriterionStatus, PilotExport, PilotInvite, PilotMetricCard, PilotMetrics, PilotMetricsQuery, PilotParticipant, PilotPermissions, PilotResponse, PilotResponseInput, PilotReview, PilotReviewHistory, PilotReviewInput, PilotReviewState } from '../types/pilot'

const criteria: PilotCriterion[] = ['time_saving_ge_50', 'personalization_ge_70', 'manual_edit_under_20_ge_70', 'cultural_usage_ge_60', 'cultural_usefulness_ge_4', 'zero_critical_cultural_errors']
const audits: PilotAuditStatus[] = ['pending_audit', 'audited', 'rejected']
const statuses: PilotCriterionStatus[] = ['pending_data', 'pending_review', 'pass', 'fail']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function invalid(): never { throw new Error('Некорректный ответ API пилотного исследования.') }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(); return value as Record<string, unknown> }
function text(value: unknown): string { return typeof value === 'string' ? value : invalid() }
function id(value: unknown): string { const result = text(value); return uuid.test(result) ? result : invalid() }
function date(value: unknown): string { const result = text(value); return result.length > 0 && Number.isFinite(Date.parse(result)) ? result : invalid() }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : invalid() }
function count(value: unknown): number { const n = number(value); return Number.isInteger(n) && n >= 0 ? n : invalid() }
function boolean(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid() }
function nullable<T>(value: unknown, read: (value: unknown) => T): T | null { return value === null ? null : read(value) }
function choice<T extends string>(value: unknown, allowed: readonly T[]): T { return allowed.includes(value as T) ? value as T : invalid() }
function data(payload: unknown) { return object(object(payload).data) }

export function parsePilotParticipants(payload: unknown): PilotParticipant[] {
  const list = object(payload).data
  if (!Array.isArray(list)) return invalid()
  return list.map((entry) => {
    const v = object(entry)
    return { id: id(v.id), anonymous_code: text(v.anonymous_code), subject_area: text(v.subject_area), teaching_experience_years: count(v.teaching_experience_years), is_submitted: boolean(v.is_submitted), is_synthetic: boolean(v.is_synthetic), expires_at: date(v.expires_at), is_expired: boolean(v.is_expired), is_revoked: boolean(v.is_revoked), used_at: nullable(v.used_at, date), has_response: boolean(v.has_response), ...(v.response_id === undefined ? {} : { response_id: nullable(v.response_id, id) }), created_at: date(v.created_at) }
  })
}
export function parsePilotInvitation(payload: unknown): PilotInvite {
  const v = data(payload)
  return { id: id(v.id), anonymous_code: text(v.anonymous_code), invite_token: text(v.invite_token), expires_at: date(v.expires_at), notice: text(v.notice), ...(v.subject_area === undefined ? {} : { subject_area: text(v.subject_area) }), ...(v.teaching_experience_years === undefined ? {} : { teaching_experience_years: count(v.teaching_experience_years) }), ...(v.is_synthetic === undefined ? {} : { is_synthetic: boolean(v.is_synthetic) }) }
}
export function parsePilotResponse(payload: unknown): PilotResponse {
  const v = data(payload)
  return { id: id(v.id), participant_id: id(v.participant_id), scenario_id: id(v.scenario_id), comparison_id: nullable(v.comparison_id, id), is_synthetic: boolean(v.is_synthetic), prep_time_baseline_minutes: count(v.prep_time_baseline_minutes), prep_time_ai_minutes: count(v.prep_time_ai_minutes), relative_time_saving: number(v.relative_time_saving), relative_time_saving_percent: number(v.relative_time_saving_percent), personalization_selected: boolean(v.personalization_selected), manual_edit_percentage: number(v.manual_edit_percentage), cultural_context_used: boolean(v.cultural_context_used), cultural_usefulness_score: nullable(v.cultural_usefulness_score, number), feedback_text: nullable(v.feedback_text, text), created_at: date(v.created_at) }
}
export function parsePilotReview(payload: unknown): PilotReview {
  const v = data(payload)
  return { id: id(v.id), pilot_response_id: id(v.pilot_response_id), expert_name: text(v.expert_name), expert_audit_status: choice(v.expert_audit_status, audits), critical_cultural_errors: count(v.critical_cultural_errors), methodological_remarks: nullable(v.methodological_remarks, text), finding_version: count(v.finding_version), is_effective: boolean(v.is_effective), reviewed_at: nullable(v.reviewed_at, date) }
}
export function parsePilotReviewHistory(payload: unknown): PilotReviewHistory {
  const v = data(payload), responseId = id(v.pilot_response_id)
  if (!Array.isArray(v.versions)) return invalid()
  const versions = v.versions.map(row => parsePilotReview({ data: row }))
  const effective = v.effective_review === null ? null : parsePilotReview({ data: v.effective_review })
  if (versions.some(row => row.pilot_response_id !== responseId) || new Set(versions.map(row => row.finding_version)).size !== versions.length) return invalid()
  const active = versions.filter(row => row.is_effective)
  if (active.length > 1 || (effective === null ? active.length !== 0 : !effective.is_effective || active[0]?.id !== effective.id)) return invalid()
  return { pilot_response_id: responseId, effective_review: effective, versions }
}
export function parsePilotMetrics(payload: unknown): PilotMetrics {
  const v = data(payload)
  const progress = object(v.criteria_progress), status = object(v.criteria_status)
  const breakdown = object(v.sample_breakdown)
  const p = object(breakdown.personalization), m = object(breakdown.manual_edits), c = object(breakdown.cultural_context), e = object(breakdown.expert_reviews)
  const result: PilotMetrics = {
    status: choice(v.status, ['no_data', 'active_pilot', 'completed']),
    total_participants: count(v.total_participants), submitted_responses_count: count(v.submitted_responses_count), audited_responses_count: count(v.audited_responses_count), audited_reviews_count: count(v.audited_reviews_count), pending_expert_reviews_count: count(v.pending_expert_reviews_count),
    expert_review_coverage_percent: nullable(v.expert_review_coverage_percent, number), median_relative_time_saving_percent: nullable(v.median_relative_time_saving_percent, number), personalization_choice_percent: nullable(v.personalization_choice_percent, number), self_reported_personalization_choice_percent: nullable(v.self_reported_personalization_choice_percent, number), manual_edit_under_20_percent_ratio: nullable(v.manual_edit_under_20_percent_ratio, number), cultural_context_usage_percent: nullable(v.cultural_context_usage_percent, number), average_cultural_usefulness_score: nullable(v.average_cultural_usefulness_score, number), critical_cultural_errors_count: nullable(v.critical_cultural_errors_count, count),
    sample_size: count(v.sample_size), target_sample_size: count(v.target_sample_size), is_survey_completed: boolean(v.is_survey_completed), is_expert_evaluation_completed: boolean(v.is_expert_evaluation_completed), is_pilot_completed: boolean(v.is_pilot_completed),
    criteria_progress: Object.fromEntries(criteria.map(key => [key, boolean(progress[key])])) as PilotMetrics['criteria_progress'],
    criteria_status: Object.fromEntries(criteria.map(key => [key, choice(status[key], statuses)])) as PilotMetrics['criteria_status'],
    sample_breakdown: { personalization: { selected: count(p.selected), total: count(p.total) }, manual_edits: { under_20_percent: count(m.under_20_percent), total: count(m.total) }, cultural_context: { used: count(c.used), rated_count: count(c.rated_count), total: count(c.total) }, expert_reviews: { audited: count(e.audited), pending: count(e.pending), coverage_percent: nullable(e.coverage_percent, number), critical_errors: nullable(e.critical_errors, count) } },
  }
  return result
}
export function parsePilotExport(payload: unknown): PilotExport {
  const v = data(payload)
  const scope = choice(v.scope, ['school', 'global'])
  const school = nullable(v.school_id, id)
  if ((scope === 'school') !== (school !== null)) return invalid()
  return { exported_at: date(v.exported_at), scope, school_id: school, metrics: parsePilotMetrics({ data: v.metrics }) }
}

/** The caller owns the isolated-mode banner. No credentials, alternate hosts, ports or paths. */
export function pilotSyntheticMode(apiOrigin: string, queryValue: unknown): boolean {
  if (queryValue !== '1') return false
  try {
    const url = new URL(apiOrigin)
    return url.origin === 'http://localhost:8001' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password
  } catch { return false }
}
export function pilotMetricsQuery(scope: 'school' | 'global' = 'school', syntheticTestMode = false): PilotMetricsQuery {
  return syntheticTestMode ? { scope, include_synthetic: 1 } : { scope }
}
export function pilotPermissions(context: PilotAccessContext): PilotPermissions {
  const active = context.authenticated && context.active
  const system = context.systemRole === 'system_admin'
  const curator = context.systemRole === 'catalog_curator'
  // Fail closed when regional scope or target region is unavailable.
  const regional = curator && context.curatorScope === 'regional'
  const global = system || (curator && !!context.curatorScope && !regional)
  const allowedCurator = curator && (global || (regional && !!context.schoolRegionCode && !!context.curatedRegionCodes?.includes(context.schoolRegionCode)))
  const member = !!context.schoolId && (context.schoolRole === 'teacher' || context.schoolRole === 'school_admin')
  const admin = system || (curator ? allowedCurator : context.schoolRole === 'school_admin')
  const school = active && !!context.schoolId
  const analytical = system || (curator && context.curatorScope ? allowedCurator : member)
  return { metrics: school && analytical, globalMetrics: active && global, export: school && admin, globalExport: active && global, participants: school && member && admin, responses: school && member && admin, review: school && admin }
}
export function pilotParticipantIssues(input: ParticipantInput): Record<string, string> {
  const issues: Record<string, string> = {}
  if (!input.subject_area.trim() || input.subject_area.length > 100) issues.subject_area = 'Укажите предметную область (до 100 символов).'
  if (!Number.isInteger(input.teaching_experience_years) || input.teaching_experience_years < 0 || input.teaching_experience_years > 60) issues.teaching_experience_years = 'Стаж: целое число от 0 до 60.'
  if (input.anonymous_code != null && input.anonymous_code.length > 64) issues.anonymous_code = 'Код: до 64 символов.'
  for (const field of ['valid_days', 'expires_days'] as const) {
    const value = input[field]
    if (value != null && (!Number.isInteger(value) || value < 1 || value > 90)) issues[field] = 'Срок: целое число от 1 до 90 дней.'
  }
  if (input.is_synthetic != null && typeof input.is_synthetic !== 'boolean') issues.is_synthetic = 'Некорректный режим данных.'
  return issues
}
export function pilotResponseIssues(input: PilotResponseInput): Record<string, string> {
  const issues: Record<string, string> = {}
  if (!input.invite_token.trim()) issues.invite_token = 'Укажите приглашение.'
  if (!uuid.test(input.scenario_id)) issues.scenario_id = 'Укажите UUID сценария своей школы.'
  if (input.comparison_id != null && !uuid.test(input.comparison_id)) issues.comparison_id = 'Некорректный UUID сравнения.'
  if (!Number.isInteger(input.prep_time_baseline_minutes) || input.prep_time_baseline_minutes < 1) issues.prep_time_baseline_minutes = 'Время без ИИ: целое число минут от 1.'
  if (!Number.isInteger(input.prep_time_ai_minutes) || input.prep_time_ai_minutes < 0) issues.prep_time_ai_minutes = 'Время с ИИ: целое число минут от 0.'
  if (!Number.isFinite(input.manual_edit_percentage) || input.manual_edit_percentage < 0 || input.manual_edit_percentage > 100) issues.manual_edit_percentage = 'Доработки: от 0 до 100%.'
  if (typeof input.personalization_selected !== 'boolean') issues.personalization_selected = 'Укажите выбор персонализации.'
  if (typeof input.cultural_context_used !== 'boolean') issues.cultural_context_used = 'Укажите использование культурного контекста.'
  const score = input.cultural_usefulness_score
  if ((input.cultural_context_used && score == null) || (score != null && (!Number.isInteger(score) || score < 1 || score > 5))) issues.cultural_usefulness_score = 'Оценка полезности: целое число от 1 до 5.'
  if (input.feedback_text != null && input.feedback_text.length > 5000) issues.feedback_text = 'Отзыв: до 5000 символов.'
  return issues
}
export function pilotReviewIssues(input: PilotReviewInput): Record<string, string> {
  const issues: Record<string, string> = {}
  if (!audits.includes(input.expert_audit_status)) issues.expert_audit_status = 'Выберите статус экспертизы.'
  if (!Number.isInteger(input.critical_cultural_errors) || input.critical_cultural_errors < 0) issues.critical_cultural_errors = 'Количество ошибок: целое число от 0.'
  if (input.methodological_remarks != null && input.methodological_remarks.length > 5000) issues.methodological_remarks = 'Замечания: до 5000 символов.'
  return issues
}
export function pilotReviewState(_response: PilotResponse): PilotReviewState {
  return { kind: 'unknown', effectiveFinding: null, history: null }
}
export function pilotMetricCards(metrics: PilotMetrics): PilotMetricCard[] {
  const b = metrics.sample_breakdown
  const rows: [PilotCriterion, string, number | null, PilotMetricCard['unit'], number, string][] = [
    ['time_saving_ge_50', 'Медианное сокращение времени', metrics.median_relative_time_saving_percent, '%', metrics.sample_size, '≥50%'],
    ['personalization_ge_70', 'Выбор персонализации (анкета)', metrics.self_reported_personalization_choice_percent, '%', b.personalization.total, '≥70%'],
    ['manual_edit_under_20_ge_70', 'Анкеты с доработками ≤20%', metrics.manual_edit_under_20_percent_ratio, '%', b.manual_edits.total, '≥70%'],
    ['cultural_usage_ge_60', 'Использование культурного контекста', metrics.cultural_context_usage_percent, '%', b.cultural_context.total, '≥60%'],
    ['cultural_usefulness_ge_4', 'Полезность культурного контекста', metrics.average_cultural_usefulness_score, '/5', b.cultural_context.rated_count, '≥4/5'],
    ['zero_critical_cultural_errors', 'Критические культурные ошибки', metrics.critical_cultural_errors_count, 'errors', b.expert_reviews.audited, '0; проверены все анкеты'],
  ]
  return rows.map(([key, label, value, unit, sampleSize, target]) => ({ key, label, value, unit, sampleSize, target, status: metrics.criteria_status[key] }))
}
/** JSON aggregate export only; allowlist parsing prevents individual answers/tokens in output. */
export function pilotExportJson(payload: unknown): string {
  return JSON.stringify({ data: parsePilotExport(payload) }, null, 2)
}
