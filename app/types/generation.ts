import type { components } from './openapi'
export type RunStatus = components['schemas']['GenerationRunEnvelope']['data']['status']
export interface GenerationRun { id: string; status: RunStatus; scenario_request_id: string; scenario_id: string | null; revision_id: string | null; provider_name: string | null; moderation_status: string | null; error_code: string | null; error_message: string | null; created_at: string | null; completed_at: string | null }
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export interface ScenarioRevision { quality_review?: QualityReview | null; id: string; scenario_id: string; version_number: number; is_current: boolean; concept: string; pedagogical_goal: string; total_duration_minutes: number; moderation_status: string; moderation_state: Record<string, JsonValue> | null; content_payload: Record<string, JsonValue> }
export interface ScenarioResult { quality_review?: QualityReview | null; id: string; school_id: string; scenario_request_id: string; title: string; status: string; moderation_status: string; current_revision_id: string | null; revision: ScenarioRevision | null; provider: string | null; model?: string | null }
export interface GenerationReceipt { key: string; createdAt: number; runId?: string; scenarioId?: string; phase: 'sending' | 'uncertain' | 'accepted' | 'rejected' }

export interface QualityFinding { path: string; text: string; message: string; severity: string }
export interface QualityReview { status: 'blocked' | 'requires_review'; technical_checks: string; findings: QualityFinding[] }
