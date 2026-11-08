import type { operations } from './openapi'

/** Actual controller payloads; see docs/fe010/pilot-contract.md for OpenAPI differences. */
export interface PilotParticipant {
  id: string
  anonymous_code: string
  subject_area: string
  teaching_experience_years: number
  is_submitted: boolean
  is_synthetic: boolean
  expires_at: string
  is_expired: boolean
  is_revoked: boolean
  used_at: string | null
  has_response: boolean
  created_at: string
  response_id?: string | null // Optional only for compatibility with cached FE010 DTOs.
}
export interface ParticipantInput {
  subject_area: string
  teaching_experience_years: number
  anonymous_code?: string | null
  valid_days?: number | null
  expires_days?: number | null
  is_synthetic?: boolean | null
}
export interface PilotInvite {
  id: string
  anonymous_code: string
  invite_token: string
  expires_at: string
  notice: string
  subject_area?: string
  teaching_experience_years?: number
  is_synthetic?: boolean
}
export interface PilotRevocation { id: string; anonymous_code: string; revoked_at: string; message: string }
export interface PilotResponseInput {
  invite_token: string
  scenario_id: string
  prep_time_baseline_minutes: number
  prep_time_ai_minutes: number
  personalization_selected: boolean
  manual_edit_percentage: number
  cultural_context_used: boolean
  cultural_usefulness_score?: number | null
  comparison_id?: string | null
  feedback_text?: string | null
}
export interface PilotResponse {
  id: string
  participant_id: string
  scenario_id: string
  comparison_id: string | null
  is_synthetic: boolean
  prep_time_baseline_minutes: number
  prep_time_ai_minutes: number
  relative_time_saving: number
  relative_time_saving_percent: number
  personalization_selected: boolean
  manual_edit_percentage: number
  cultural_context_used: boolean
  cultural_usefulness_score: number | null
  feedback_text: string | null
  created_at: string
  // Neither findings nor review history are returned by GET response.
}
export interface PilotReviewHistory { pilot_response_id: string; effective_review: PilotReview | null; versions: PilotReview[] }
export type PilotAuditStatus = 'pending_audit' | 'audited' | 'rejected'
export interface PilotReviewInput { expert_audit_status: PilotAuditStatus; critical_cultural_errors: number; methodological_remarks?: string | null }
export interface PilotReview {
  id: string
  pilot_response_id: string
  expert_name: string
  expert_audit_status: PilotAuditStatus
  critical_cultural_errors: number
  methodological_remarks: string | null
  finding_version: number
  is_effective: boolean
  reviewed_at: string | null
}
export type PilotCriterion = 'time_saving_ge_50' | 'personalization_ge_70' | 'manual_edit_under_20_ge_70' | 'cultural_usage_ge_60' | 'cultural_usefulness_ge_4' | 'zero_critical_cultural_errors'
export type PilotCriterionStatus = 'pending_data' | 'pending_review' | 'pass' | 'fail'
export interface PilotMetrics {
  status: 'no_data' | 'active_pilot' | 'completed'
  total_participants: number
  submitted_responses_count: number
  audited_responses_count: number
  audited_reviews_count: number
  pending_expert_reviews_count: number
  expert_review_coverage_percent: number | null
  median_relative_time_saving_percent: number | null
  personalization_choice_percent: number | null
  self_reported_personalization_choice_percent: number | null
  manual_edit_under_20_percent_ratio: number | null
  cultural_context_usage_percent: number | null
  average_cultural_usefulness_score: number | null
  critical_cultural_errors_count: number | null
  sample_size: number
  target_sample_size: number
  is_survey_completed: boolean
  is_expert_evaluation_completed: boolean
  is_pilot_completed: boolean
  criteria_progress: Record<PilotCriterion, boolean>
  criteria_status: Record<PilotCriterion, PilotCriterionStatus>
  sample_breakdown: {
    personalization: { selected: number; total: number }
    manual_edits: { under_20_percent: number; total: number }
    cultural_context: { used: number; rated_count: number; total: number }
    expert_reviews: { audited: number; pending: number; coverage_percent: number | null; critical_errors: number | null }
  }
}
export interface PilotExport { exported_at: string; scope: 'school' | 'global'; school_id: string | null; metrics: PilotMetrics }
export interface PilotMetricsQuery { scope: 'school' | 'global'; include_synthetic?: boolean | 1 }
export interface PilotAccessContext {
  authenticated: boolean
  active: boolean
  systemRole: string
  curatorScope?: string | null
  curatedRegionCodes?: readonly string[]
  schoolId?: string
  schoolRegionCode?: string
  /** Membership role in schoolId, never a role from a different school. */
  schoolRole?: string
}
export interface PilotPermissions { metrics: boolean; globalMetrics: boolean; export: boolean; globalExport: boolean; participants: boolean; responses: boolean; review: boolean }
export interface PilotMetricCard { key: PilotCriterion; label: string; value: number | null; unit: '%' | '/5' | 'errors'; status: PilotCriterionStatus; sampleSize: number; target: string }
export interface PilotReviewState { kind: 'unknown'; effectiveFinding: null; history: null }
export type PilotInvitation = PilotInvite
export type PilotReviewFinding = PilotReview
export type CreatePilotParticipantInput = ParticipantInput
export type CreatePilotResponseInput = PilotResponseInput
export type CreatePilotReviewInput = PilotReviewInput

type Json<T> = { content: { 'application/json': { data: T } } }
type Reply<O, S extends number, T> = Omit<O, 'responses'> & { responses: { [K in S]: Json<T> } }
type Body<O, B> = Omit<O, 'requestBody'> & { requestBody: { content: { 'application/json': B } } }
type Analytical<O, T> = Omit<Reply<O, 200, T>, 'parameters'> & { parameters: { query?: PilotMetricsQuery } }
export interface PilotOperationOverrides {
  '/pilot/participants': {
    get: Reply<operations['listPilotParticipants'], 200, PilotParticipant[]>
    post: Body<Reply<operations['createPilotParticipant'], 201, PilotInvite>, ParticipantInput>
  }
  '/pilot/participants/{id}/reissue': { post: Reply<operations['reissuePilotParticipantToken'], 200, PilotInvite> }
  '/pilot/participants/{id}/revoke': { post: Reply<operations['revokePilotParticipantToken'], 200, PilotRevocation> }
  '/pilot/responses': { post: Body<Reply<operations['submitPilotResponse'], 201, PilotResponse>, PilotResponseInput> }
  '/pilot/responses/{id}': { get: Reply<operations['getPilotResponse'], 200, PilotResponse> }
  '/pilot/responses/{id}/reviews': { post: Body<Reply<operations['submitPilotReviewFinding'], 200, PilotReview>, PilotReviewInput> }
  '/pilot/metrics': { get: Analytical<operations['getPilotSummaryMetrics'], PilotMetrics> }
  '/pilot/export': { get: Analytical<operations['exportPilotMetrics'], PilotExport> }
}
