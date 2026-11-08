import { describe, expect, it } from 'vitest'
import type { CatalogAdminOperationOverrides, ClaimEvidenceInput, SourcePatch, SourceReviewInput } from '~/types/catalog-admin'
import { allowedClaimEvidence, allowedSourcePatch, allowedSourceReview, catalogFieldIssues, claimEvidenceIssues, evidenceIssues, parseCatalogQueue, parseCatalogClaim as parseClaim, parseEvidenceReply, parseQueue, parseCatalogReviews as parseReviews, parseCatalogSource as parseSource, parseSourcePatch, parseSourcePatchReply, reviewIssues, sourcePatchIssues, sourceReviewIssues } from '~/utils/catalog-admin'
import { evidenceState, parseClaim as fe003ParseClaim, parseSource as fe003ParseSource } from '~/utils/provenance'
import { toApiError } from '~/utils/api-error'

const id = '12345678-1234-4234-8234-123456789012'
const review = { id, event_source_id: id, decision: 'approved', comments: 'Проверено по изданию.', reviewer: { id, name: 'Эксперт', system_role: 'catalog_curator', curator_scope: 'federal' }, reviewed_at: '2026-10-29T10:00:00+00:00' }
const source = { id, calendar_event_id: id, calendar_event: { id, title: 'Событие', event_type: 'federal', region_code: null, status: 'published' }, source_type: 'scientific_publication', title: 'История праздника', author: null, url: null, doi_or_isbn: null, claims_count: 1, status: 'approved', latest_review: review, verified_by: { id, name: 'Эксперт' }, verification_date: '2026-10-29', created_at: '2026-10-29T09:00:00+00:00' }
const meta = { current_page: 2, total: 21, per_page: 20, last_page: 2 }
const evidence = { id, event_source_id: id, citation_locator: 'с. 123', citation_excerpt: 'Содержательная проверяемая цитата.', verification_status: 'verified_authentic', effective_status: 'unverified', is_detached: true, detached_at: '2026-10-29T11:00:00+00:00', detachment_reason: 'Требуется уточнение', notes: null, verified_at: null, verified_by: null, applicable_academic_year: '2026-2027', source: { id, title: source.title, url: null } }
const audit = { id, action: 'detached', actor: { id, name: 'Эксперт' }, event_source_id: id, previous_verification_status: 'verified_authentic', new_verification_status: 'unverified', citation_locator: evidence.citation_locator, citation_excerpt: evidence.citation_excerpt, reason: evidence.detachment_reason, created_at: evidence.detached_at }
const claim = { id, calendar_event_id: id, claim_text: 'Историческое утверждение', culture_name: 'Культура', provenance_notes: null, evidence_records: [evidence], evidence_audit_events: [audit] }
const attach: ClaimEvidenceInput = { event_source_id: id, citation_locator: 'с. 123', citation_excerpt: 'Содержательная проверяемая цитата.', verify: true }

describe('FE011 actual catalog response DTOs', () => {
  it('keeps top-level controller pagination and federal visibility without inventing permissions', () => {
    const page = parseQueue({ data: [source], meta })
    expect(page.meta).toEqual(meta)
    expect(page.data[0]).toMatchObject({ status: 'approved', claims_count: 1, calendar_event: { event_type: 'federal', region_code: null } })
    expect(page.data[0]).not.toHaveProperty('can_review')
    expect(page.data[0]).not.toHaveProperty('verification_status')
  })
  it('accepts empty paginated queues and nullable events/reviewers', () => {
    expect(parseQueue({ data: [], meta: { ...meta, current_page: 1, last_page: 1, total: 0 } }).data).toEqual([])
    const page = parseQueue({ data: [{ ...source, calendar_event: null, latest_review: { ...review, reviewer: null }, verified_by: null }], meta })
    expect(page.data[0]?.latest_review?.reviewer).toBeNull()
  })
  it.each([
    { data: [], meta: { ...meta, total: '21' } },
    { data: [], meta: { ...meta, current_page: 0 } },
    { data: [], meta: { ...meta, last_page: 1.5 } },
    { data: [], meta: { ...meta, per_page: -1 } },
    { data: [source] }, { data: {}, meta },
    { data: [{ ...source, status: 'verified_authentic' }], meta },
    { data: [{ ...source, claims_count: -1 }], meta },
  ])('rejects malformed pagination/queue DTO %#', payload => { expect(() => parseQueue(payload)).toThrow() })
  it('reuses FE003 parsers and reads source claim status independently of source approval', () => {
    expect(parseSource).toBe(fe003ParseSource)
    expect(parseClaim).toBe(fe003ParseClaim)
    const parsed = parseSource({ data: { ...source, claims: [{ id, cultural_claim_id: id, claim_text: claim.claim_text, culture_name: claim.culture_name, citation_locator: evidence.citation_locator, citation_excerpt: evidence.citation_excerpt, verification_status: 'unverified', notes: null }] } })
    expect(parsed.latest_review?.decision).toBe('approved')
    expect(parsed.claims[0]?.verification_status).toBe('unverified')
  })
  it('reads actual smaller PATCH response without requiring invented detail fields', () => {
    const { latest_review: _review, verified_by: _person, calendar_event: _event, claims_count: _count, status: _status, ...bibliography } = source
    const parsed = parseSourcePatch({ data: { ...bibliography, verified_by_user_id: null } })
    expect(parsed.verified_by_user_id).toBeNull()
    expect(parsed).not.toHaveProperty('claims')
    expect(() => parseSource({ data: parsed })).toThrow()
    expect(parseSourcePatchReply({ data: parsed }, id)).toEqual(parsed)
    expect(() => parseSourcePatchReply({ data: parsed }, 'another-source')).toThrow()
  })
  it('exports the agreed parent helper names as compatible aliases', () => {
    expect(parseCatalogQueue).toBe(parseQueue)
    expect(sourceReviewIssues).toBe(reviewIssues)
    expect(claimEvidenceIssues).toBe(evidenceIssues)
  })
  it('parses the actual attachment reply without manufacturing audit or detached flags', () => {
    const payload = { data: { id, cultural_claim_id: id, event_source_id: id, source: { id, title: source.title, author: null, source_type: source.source_type }, citation_locator: attach.citation_locator, citation_excerpt: attach.citation_excerpt, verification_status: 'verified_authentic', effective_status: 'unverified', verified_by: { id, name: 'Эксперт' }, verified_at: review.reviewed_at, applicable_academic_year: null, notes: null } }
    const result = parseEvidenceReply(payload)
    expect(result).toEqual(payload.data)
    expect(result).not.toHaveProperty('is_detached')
    expect(result).not.toHaveProperty('evidence_audit_events')
    expect(parseEvidenceReply({ data: { ...payload.data, source: null, verified_by: null } }).source).toBeNull()
    expect(() => parseEvidenceReply({ data: { ...payload.data, effective_status: undefined } })).toThrow()
  })
  it('preserves server review ordering and audit history after detachment', () => {
    expect(parseReviews({ data: [review, { ...review, id: 'older', decision: 'requires_amendment' }] }).map(r => r.decision)).toEqual(['approved', 'requires_amendment'])
    const parsed = parseClaim({ data: claim })
    expect(parsed.evidence_records[0]).toMatchObject({ verification_status: 'verified_authentic', effective_status: 'unverified', is_detached: true })
    expect(parsed.evidence_audit_events[0]).toEqual(audit)
    expect(evidenceState(parsed.evidence_records[0]!).tone).toBe('warning')
  })
  it('never renders stale stored authenticity as effective authenticity', () => {
    const parsed = parseClaim({ data: { ...claim, evidence_records: [{ ...evidence, is_detached: false }] } })
    expect(evidenceState(parsed.evidence_records[0]!).tone).toBe('warning')
    expect(() => parseClaim({ data: { ...claim, evidence_records: [{ ...evidence, is_detached: undefined }] } })).toThrow()
  })
})

describe('FE011 safe request bodies and FormRequest/service validation', () => {
  it('strips computed, authorization, status and cross-event fields from PATCH', () => {
    const input = { title: 'Новое название', author: null, source_type: 'encyclopedia' as const, url: null, doi_or_isbn: null, verified_by_user_id: id, verification_status: 'verified_authentic', calendar_event_id: id, claims: [claim] }
    expect(allowedSourcePatch(input)).toEqual({ title: input.title, author: null, source_type: 'encyclopedia', url: null, doi_or_isbn: null })
    expect(input).toHaveProperty('claims')
    expect(allowedSourcePatch({ title: undefined })).toEqual({})
    expect(allowedSourcePatch(Object.create({ title: 'inherited' }) as SourcePatch)).toEqual({})
  })
  it('allowlists review and attachment bodies without using notes as evidence', () => {
    expect(allowedSourceReview({ decision: 'approved', comments: 'Проверено.', claim_status: 'verified_authentic' } as SourceReviewInput)).toEqual({ decision: 'approved', comments: 'Проверено.' })
    expect(allowedClaimEvidence({ ...attach, verify: false, notes: null, evidence_excerpt: 'wrong', verification_status: 'verified_authentic' } as ClaimEvidenceInput)).toEqual({ ...attach, verify: false, notes: null })
    expect(evidenceIssues({ ...attach, citation_excerpt: '', notes: attach.citation_excerpt })).toHaveProperty('citation_excerpt')
  })
  it('validates only the real optional PATCH fields', () => {
    expect(sourcePatchIssues({})).toEqual({})
    expect(sourcePatchIssues({ title: 'А'.repeat(500), author: null, url: null, doi_or_isbn: null })).toEqual({})
    expect(sourcePatchIssues({ title: 'ab', author: 'a'.repeat(256), source_type: 'invented', url: 'javascript:alert(1)', doi_or_isbn: 'x'.repeat(65) } as unknown as SourcePatch)).toHaveProperty('source_type')
    expect(Object.keys(sourcePatchIssues({ title: '', author: 'a'.repeat(256), url: 'relative', doi_or_isbn: 'a'.repeat(65) }))).toEqual(['title', 'author', 'doi_or_isbn', 'url'])
  })
  it.each(['approved', 'rejected', 'requires_amendment'] as const)('validates %s review with required comments', decision => {
    expect(reviewIssues({ decision, comments: '12345' })).toEqual({})
    expect(reviewIssues({ decision, comments: '1234' })).toHaveProperty('comments')
    expect(reviewIssues({ decision, comments: 'a'.repeat(2001) })).toHaveProperty('comments')
  })
  it('rejects unsupported decision and accepts all exact attachment limits', () => {
    expect(reviewIssues({ decision: 'verified_authentic', comments: 'Valid comments' } as unknown as SourceReviewInput)).toHaveProperty('decision')
    expect(evidenceIssues({ ...attach, citation_locator: 'а'.repeat(255), citation_excerpt: 'я'.repeat(2000), notes: 'a'.repeat(2000), applicable_academic_year: '2026-2027' })).toEqual({})
    expect(evidenceIssues({ ...attach, event_source_id: 'source', citation_locator: 'a'.repeat(256), citation_excerpt: 'b'.repeat(2001), notes: 'c'.repeat(2001) })).toHaveProperty('event_source_id')
  })
  it('applies verification service placeholder and consecutive academic year rules only when verifying', () => {
    expect(evidenceIssues({ ...attach, citation_locator: 'см. источник', citation_excerpt: 'placeholder', applicable_academic_year: '2026-2028' })).toMatchObject({ citation_locator: expect.any(String), citation_excerpt: expect.any(String), applicable_academic_year: expect.any(String) })
    expect(evidenceIssues({ ...attach, verify: false, citation_locator: 'см. источник', citation_excerpt: 'placeholder', applicable_academic_year: '2026-2028' })).toEqual({})
    expect(evidenceIssues({ ...attach, verify: null, applicable_academic_year: '2026-2028' })).toHaveProperty('applicable_academic_year')
  })
  it('maps real 422 envelopes without mutating the entered form', () => {
    const input = { ...attach }
    const error = toApiError(422, { errors: { evidence_excerpt: ['Требуется содержательная выдержка.'], reviewer: ['Рецензент неактивен.'] } })
    expect(catalogFieldIssues(error)).toEqual({ citation_excerpt: 'Требуется содержательная выдержка.', reviewer: 'Рецензент неактивен.' })
    expect(catalogFieldIssues(toApiError(422, { error: { details: [{ field: 'event_source_id', message: 'Источник из другого события.' }] } }))).toEqual({ event_source_id: 'Источник из другого события.' })
    expect(input).toEqual(attach)
  })
  it('types DELETE reason and distinguishes its count response from a full claim', () => {
    type Delete = CatalogAdminOperationOverrides['/cultural-claims/{id}/evidence/{sourceId}']['delete']
    const body: Delete['requestBody']['content']['application/json'] = { reason: 'Нужна повторная проверка.' }
    const response: Delete['responses'][200]['content']['application/json'] = { data: { message: 'Отвязано.', detached_records_count: 2 } }
    expect(body).toEqual({ reason: 'Нужна повторная проверка.' })
    expect(response.data.detached_records_count).toBe(2)
    expect(() => parseClaim(response)).toThrow()
  })
})
