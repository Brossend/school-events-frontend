import type { operations } from './openapi'
import type { Evidence, Review, SourceDetail } from './provenance'
export type { SourceDetail as CatalogSourceDetail, ClaimDetail as CatalogClaimDetail, Review as CatalogReview } from './provenance'

export type SourceType = 'normative_act' | 'scientific_publication' | 'ethnographic_archive' | 'encyclopedia'
export type SourceReviewDecision = 'approved' | 'rejected' | 'requires_amendment'
export type CatalogStatus = 'pending' | SourceReviewDecision
export interface CatalogQuery { status?: CatalogStatus | 'all'; region_code?: string; event_type?: 'federal' | 'regional' | 'cultural_traditional' | 'school_custom'; page?: number; per_page?: number }
export interface CatalogEvent { id: string; title: string; event_type: string; region_code: string | null; status: string }
export interface CatalogQueueItem extends Pick<SourceDetail, 'id' | 'calendar_event_id' | 'source_type' | 'title' | 'author' | 'url' | 'doi_or_isbn' | 'latest_review' | 'verified_by' | 'verification_date' | 'created_at'> {
  calendar_event: CatalogEvent | null
  claims_count: number
  status: CatalogStatus
}
export interface CatalogQueuePage { data: CatalogQueueItem[]; meta: { current_page: number; total: number; per_page: number; last_page: number } }
export interface SourcePatch { title?: string; author?: string | null; source_type?: SourceType; url?: string | null; doi_or_isbn?: string | null }
export interface SourceReviewInput { decision: SourceReviewDecision; comments: string }
export interface ClaimEvidenceInput { event_source_id: string; citation_locator: string; citation_excerpt: string; applicable_academic_year?: string | null; notes?: string | null; verify?: boolean | null }
// PATCH is deliberately not SourceDetail: no claims, latest_review or verified_by object.
export interface SourcePatchResult extends Pick<SourceDetail, 'id' | 'calendar_event_id' | 'source_type' | 'title' | 'author' | 'url' | 'doi_or_isbn' | 'verification_date' | 'created_at'> { verified_by_user_id: string | null }
export interface ClaimEvidenceResult extends Omit<Evidence, 'source' | 'is_detached' | 'detached_at' | 'detachment_reason'> {
  cultural_claim_id: string
  source: { id: string; title: string; author: string | null; source_type: string } | null
}
export interface DetachEvidenceInput { reason?: string | null }
export interface DetachEvidenceResult { message: string; detached_records_count: number }
type Json<T> = { content: { 'application/json': T } }
type Body<T> = { required: true; content: { 'application/json': T } }
type Response<T> = Json<{ data: T }>
export interface CatalogAdminOperationOverrides {
  '/catalog/review-queue': { get: Omit<operations['getCatalogReviewQueue'], 'parameters' | 'responses'> & { parameters: { query?: CatalogQuery }; responses: { 200: Json<CatalogQueuePage> } } }
  '/event-sources/{id}': { patch: Omit<operations['updateEventSource'], 'requestBody' | 'responses'> & { requestBody: Body<SourcePatch>; responses: { 200: Response<SourcePatchResult> } } }
  '/event-sources/{id}/reviews': { post: Omit<operations['createEventSourceReview'], 'requestBody' | 'responses'> & { requestBody: Body<SourceReviewInput>; responses: { 201: Response<Review & { event_source_id: string }> } } }
  '/cultural-claims/{id}/evidence': { post: Omit<operations['attachCulturalClaimEvidence'], 'requestBody' | 'responses'> & { requestBody: Body<ClaimEvidenceInput>; responses: { 201: Response<ClaimEvidenceResult> } } }
  '/cultural-claims/{id}/evidence/{sourceId}': { delete: Omit<operations['detachCulturalClaimEvidence'], 'requestBody' | 'responses'> & { requestBody: Body<DetachEvidenceInput>; responses: { 200: Response<DetachEvidenceResult> } } }
}
