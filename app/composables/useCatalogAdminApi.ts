import type { CatalogQuery, SourcePatch, SourceReviewInput, ClaimEvidenceInput } from '~/types/catalog-admin'
import { allowedSourcePatch, allowedSourceReview, allowedClaimEvidence, parseQueue, parseSourcePatchReply, parseEvidenceReply } from '~/utils/catalog-admin'
import { parseSource, parseClaim, parseReviews, canReviewSources } from '~/utils/provenance'
import { ApiError } from '~/utils/api-error'

export function useCatalogAdminApi() {
  const api = useApi(), auth = useAuthStore()
  const context = () => JSON.stringify([auth.authenticated, auth.user?.id, auth.systemRole, auth.tenant?.school_id, auth.tenant?.role])
  async function guard<T>(signal: AbortSignal, work: (school: string | undefined) => Promise<T>) {
    const key = context()
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!auth.authenticated || !canReviewSources(auth.systemRole)) throw new ApiError(403, 'CATALOG_ROLE_REQUIRED', 'Нужны полномочия куратора каталога.')
    const value = await work(auth.tenant?.school_id)
    if (signal.aborted || key !== context()) throw new DOMException('Aborted', 'AbortError')
    return value
  }
  return {
    context,
    queue: (query: CatalogQuery, signal: AbortSignal) => guard(signal, async schoolId => parseQueue(await api.request('get', '/catalog/review-queue', { query, schoolId, signal, reportError: false }))),
    source: (id: string, signal: AbortSignal) => guard(signal, async schoolId => { const value = parseSource(await api.request('get', '/event-sources/{id}', { params: { id }, schoolId, signal, reportError: false })); if (value.id !== id) throw new Error('Ответ относится к другому источнику.'); return value }),
    reviews: (id: string, signal: AbortSignal) => guard(signal, async schoolId => parseReviews(await api.request('get', '/event-sources/{id}/reviews', { params: { id }, schoolId, signal, reportError: false }))),
    claim: (id: string, signal: AbortSignal) => guard(signal, async schoolId => { const value = parseClaim(await api.request('get', '/cultural-claims/{id}', { params: { id }, schoolId, signal, reportError: false })); if (value.id !== id) throw new Error('Ответ относится к другому утверждению.'); return value }),
    patchSource: (id: string, body: SourcePatch, signal: AbortSignal) => guard(signal, async schoolId => parseSourcePatchReply(await api.request('patch', '/event-sources/{id}', { params: { id }, body: allowedSourcePatch(body), schoolId, signal, reportError: false }), id)),
    review: (id: string, body: SourceReviewInput, signal: AbortSignal) => guard(signal, async schoolId => { const value = await api.request('post', '/event-sources/{id}/reviews', { params: { id }, body: allowedSourceReview(body), schoolId, signal, reportError: false }); if (value.data.event_source_id !== id) throw new Error('Решение относится к другому источнику.'); return parseReviews({ data: [value.data] })[0]! }),
    attach: (id: string, body: ClaimEvidenceInput, signal: AbortSignal) => guard(signal, async schoolId => { const value = parseEvidenceReply(await api.request('post', '/cultural-claims/{id}/evidence', { params: { id }, body: allowedClaimEvidence(body), schoolId, signal, reportError: false })); if (value.cultural_claim_id !== id || value.event_source_id !== body.event_source_id) throw new Error('Ответ относится к другому доказательству.'); return value }),
    detach: (id: string, sourceId: string, reason: string, signal: AbortSignal) => guard(signal, async schoolId => { const value = await api.request('delete', '/cultural-claims/{id}/evidence/{sourceId}', { params: { id, sourceId }, body: { reason }, schoolId, signal, reportError: false }); if (!value.data || !Number.isInteger(value.data.detached_records_count) || value.data.detached_records_count < 1) throw new Error('Нет подтверждения открепления доказательства.'); return value.data }),
  }
}
