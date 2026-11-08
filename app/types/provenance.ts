import type { components } from './openapi'
export type CalendarDetail = components['schemas']['CalendarEventEnvelope']['data']
export type SourceReference = CalendarDetail['sources'][number]
export type EvidenceSummary = CalendarDetail['cultural_claims'][number]['evidence_records'][number]
export interface Person { id: string; name: string }
export interface Review { id: string; decision: string; comments: string; reviewed_at: string; reviewer: Person | null }
export interface SourceClaim extends EvidenceSummary { id: string; cultural_claim_id: string; claim_text: string | null; culture_name: string | null }
export interface SourceDetail {
  id: string; calendar_event_id: string; title: string; source_type: string
  author: string | null; url: string | null; doi_or_isbn: string | null
  latest_review: Review | null; verification_date: string | null; verified_by: Person | null
  claims: SourceClaim[]; created_at: string
}
// Refine OpenAPI generic objects and fields missing from its evidence DTO.
export interface Evidence extends EvidenceSummary {
  id: string; effective_status: string; is_detached: boolean; detached_at: string | null
  detachment_reason: string | null; verified_by: Person | null; verified_at: string | null
  applicable_academic_year: string | null; source: SourceReference | null
}
export interface AuditEvent {
  id: string; action: string; created_at: string; actor: Person | null
  event_source_id: string | null; previous_verification_status: string | null
  new_verification_status: string | null; citation_locator: string | null
  citation_excerpt: string | null; reason: string | null
}
export interface ClaimDetail {
  id: string; calendar_event_id: string; claim_text: string; culture_name: string
  provenance_notes: string | null; evidence_records: Evidence[]; evidence_audit_events: AuditEvent[]
}
