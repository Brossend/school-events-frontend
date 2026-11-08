import { ref, shallowRef } from 'vue'
import type { CatalogQuery, CatalogQueuePage, SourcePatch, SourceReviewInput, ClaimEvidenceInput } from '../types/catalog-admin'
import type { SourceDetail, ClaimDetail, Review } from '../types/provenance'
import { sourcePatchIssues, reviewIssues, evidenceIssues, allowedSourcePatch, allowedSourceReview, allowedClaimEvidence } from './catalog-admin'
import { ApiError } from './api-error'

export interface CatalogServices {
 queue(query: CatalogQuery, signal: AbortSignal): Promise<CatalogQueuePage>
 source(id: string, signal: AbortSignal): Promise<SourceDetail>
 reviews(id: string, signal: AbortSignal): Promise<Review[]>
 claim(id: string, signal: AbortSignal): Promise<ClaimDetail>
 patchSource(id: string, body: SourcePatch, signal: AbortSignal): Promise<unknown>
 review(id: string, body: SourceReviewInput, signal: AbortSignal): Promise<unknown>
 attach(id: string, body: ClaimEvidenceInput, signal: AbortSignal): Promise<unknown>
 detach(id: string, sourceId: string, reason: string, signal: AbortSignal): Promise<unknown>
}
export type CatalogAction =
 | { kind: 'patch'; sourceId: string; body: SourcePatch; baseline: SourcePatch }
 | { kind: 'review'; sourceId: string; body: SourceReviewInput; latestReviewId: string | null }
 | { kind: 'attach'; claimId: string; body: ClaimEvidenceInput }
 | { kind: 'detach'; claimId: string; sourceId: string; reason: string }
const validId = (id: string) => { if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) throw new ApiError(422, 'INVALID_ID', 'Укажите корректный ID.') }
export function createCatalogAdminController(service: CatalogServices, context: () => string) {
 const query = ref<CatalogQuery>({ status: 'pending', page: 1, per_page: 20 })
 const queue = shallowRef<CatalogQueuePage | null>(null), source = shallowRef<SourceDetail | null>(null), claim = shallowRef<ClaimDetail | null>(null), reviews = shallowRef<Review[]>([])
 const sourceId = ref(''), claimId = ref(''), pending = ref(''), error = shallowRef<Error | null>(null), historyError = shallowRef<Error | null>(null), notice = ref('')
 const confirmation = shallowRef<CatalogAction | null>(null), uncertain = shallowRef<CatalogAction | null>(null), reconciled = ref(false), needsReconcile = ref(false), conflict = shallowRef<SourceDetail | null>(null)
 let epoch = 0, controller: AbortController | undefined
 function invalidate() { source.value = null; claim.value = null; reviews.value = []; queue.value = null; historyError.value = null }
 function reset() { epoch++; controller?.abort(); invalidate(); sourceId.value = ''; claimId.value = ''; pending.value = ''; error.value = null; confirmation.value = null; uncertain.value = null; reconciled.value = false; needsReconcile.value = false; conflict.value = null; notice.value = '' }
 async function operation(name: string, work: (signal: AbortSignal, valid: () => boolean) => Promise<void>) {
  if (pending.value) return
  const version = epoch, key = context(), active = new AbortController(); controller = active; pending.value = name; error.value = null
  const valid = () => version === epoch && key === context() && !active.signal.aborted
  try { await work(active.signal, valid) }
  catch (cause) { if (valid()) { error.value = cause instanceof Error ? cause : new Error('Действие не выполнено.'); if (cause instanceof ApiError && cause.status === 401) { invalidate(); confirmation.value = null } } }
  finally { if (version === epoch) pending.value = '' }
 }
 async function refresh() { await operation('queue', async (s, valid) => { const page = await service.queue({ ...query.value }, s); if (valid()) queue.value = page }) }
 async function setQuery(value: CatalogQuery) { if (pending.value) return; query.value = { ...query.value, ...value }; queue.value = null; await refresh() }
 async function readSource(id: string, s: AbortSignal, valid: () => boolean, strict = false) {
  const value = await service.source(id, s); if (!valid()) return
  if (value.id !== id) throw new Error('Источник не соответствует запросу.')
  source.value = value; historyError.value = null
  try { const list = await service.reviews(id, s); if (valid()) reviews.value = list }
  catch (cause) { if (valid()) { reviews.value = []; historyError.value = cause instanceof Error ? cause : new Error('История недоступна.'); if (strict) throw historyError.value } }
 }
 async function readClaim(id: string, s: AbortSignal, valid: () => boolean) { const value = await service.claim(id, s); if (valid()) { if (value.id !== id) throw new Error('Утверждение не соответствует запросу.'); claim.value = value } }
 async function selectSource(id: string) {
  if (pending.value || uncertain.value || needsReconcile.value) return
  conflict.value = null; source.value = null; reviews.value = []; claim.value = null; sourceId.value = id; claimId.value = ''; historyError.value = null; confirmation.value = null; notice.value = ''
  await operation('source', async (s, valid) => { validId(id); await readSource(id, s, valid) })
 }
 async function selectClaim(id: string) {
  if (pending.value || uncertain.value || needsReconcile.value) return
  claim.value = null; claimId.value = id; confirmation.value = null; notice.value = ''
  await operation('claim', async (s, valid) => { validId(id); await readClaim(id, s, valid) })
 }
 function prepare(action: CatalogAction) {
  if (pending.value || uncertain.value || needsReconcile.value) return
  error.value = null; notice.value = ''
  try {
   let issues: Record<string, string> = {}
   if (action.kind === 'patch') { validId(action.sourceId); if (source.value?.id !== action.sourceId) throw new Error('Загрузите источник.'); action = { ...action, body: allowedSourcePatch(action.body), baseline: allowedSourcePatch(action.baseline) }; issues = sourcePatchIssues(action.body) }
   if (action.kind === 'review') { validId(action.sourceId); if (source.value?.id !== action.sourceId) throw new Error('Загрузите источник.'); action = { ...action, body: allowedSourceReview(action.body) }; issues = reviewIssues(action.body) }
   if (action.kind === 'attach') { validId(action.claimId); if (claim.value?.id !== action.claimId) throw new Error('Загрузите утверждение.'); action = { ...action, body: allowedClaimEvidence(action.body) }; issues = evidenceIssues(action.body) }
   if (action.kind === 'detach') { validId(action.claimId); validId(action.sourceId); if (claim.value?.id !== action.claimId || !action.reason.trim() || action.reason.length > 2000) throw new Error('Укажите утверждение и причину открепления (до 2000 символов).') }
   if (Object.keys(issues).length) throw new ApiError(422, 'VALIDATION_FAILED', 'Проверьте введённые значения.', Object.entries(issues).map(([field, message]) => ({ field, message })))
   confirmation.value = structuredClone(action)
  } catch (cause) { error.value = cause instanceof Error ? cause : new Error('Проверьте действие.') }
 }
 async function synchronize(s: AbortSignal, valid: () => boolean) {
  if (sourceId.value) await readSource(sourceId.value, s, valid, true)
  if (claimId.value && valid()) await readClaim(claimId.value, s, valid)
  if (valid()) { const page = await service.queue({ ...query.value }, s); if (valid()) queue.value = page }
 }
 async function confirm() {
  const action = confirmation.value
  if (!action || pending.value || uncertain.value || needsReconcile.value) return
  confirmation.value = null
  await operation('mutation', async (s, valid) => {
   // Reads are preflight, not a possibly committed write.
   if (action.kind === 'patch' || action.kind === 'review') {
    const latest = await service.source(action.sourceId, s); if (!valid()) return
    if (latest.id !== action.sourceId) throw new Error('Неверный источник.')
    if (action.kind === 'patch' && Object.entries(action.baseline).some(([k,v]) => latest[k as keyof SourceDetail] !== v)) { conflict.value = latest; throw new ApiError(409, 'SOURCE_CHANGED', 'Реквизиты изменились. Сравните изменения и обновите основу черновика перед новым подтверждением.') }
    if (action.kind === 'review' && (latest.latest_review?.id ?? null) !== action.latestReviewId) throw new ApiError(409, 'REVIEW_CHANGED', 'Появилось другое экспертное решение. Перечитайте историю.')
    await service.reviews(action.sourceId, s)
   } else {
    const latestClaim = await service.claim(action.claimId, s); if (!valid()) return
    if (latestClaim.id !== action.claimId) throw new Error('Неверное утверждение.')
    if (action.kind === 'attach') {
     const latestSource = await service.source(action.body.event_source_id, s); if (!valid()) return
     if (latestSource.calendar_event_id !== latestClaim.calendar_event_id) throw new ApiError(422, 'CROSS_EVENT_BINDING_FORBIDDEN', 'Источник и утверждение относятся к разным событиям.')
     await service.reviews(action.body.event_source_id, s)
    } else if (!latestClaim.evidence_records.some(e => e.event_source_id === action.sourceId && !e.is_detached)) throw new ApiError(404, 'EVIDENCE_RECORD_NOT_FOUND', 'Активное доказательство уже отсутствует. Перечитайте сведения.')
   }
   if (!valid()) return
   try {
    if (action.kind === 'patch') await service.patchSource(action.sourceId, action.body, s)
    else if (action.kind === 'review') await service.review(action.sourceId, action.body, s)
    else if (action.kind === 'attach') await service.attach(action.claimId, action.body, s)
    else await service.detach(action.claimId, action.sourceId, action.reason.trim(), s)
   } catch (cause) {
    if (!valid()) return
    const unknown = !(cause instanceof ApiError) || cause.status === 0 || cause.status === 408 || cause.status >= 500
    if (unknown) { uncertain.value = action; reconciled.value = false; invalidate(); try { await synchronize(s, valid); if (valid()) reconciled.value = true } catch { /* Keep uncertainty and require manual GET. */ } }
    throw cause
   }
   if (!valid()) return
   needsReconcile.value = true; invalidate(); notice.value = 'Действие сохранено. Статусы перечитываются с сервера; автоматического подтверждения сценариев нет.'
   await synchronize(s, valid)
   if (valid()) needsReconcile.value = false
  })
 }
 async function reconcile() { if (pending.value) return; reconciled.value = false; await operation('reconcile', async (s, valid) => { invalidate(); await synchronize(s, valid); if (valid()) { needsReconcile.value = false; if (uncertain.value) reconciled.value = true } }) }
 function acknowledge() { if (!pending.value && uncertain.value && reconciled.value) { uncertain.value = null; reconciled.value = false; error.value = null; notice.value = 'Состояние сверено. Новое действие потребует отдельного подтверждения.' } }
 return { query, queue, source, claim, reviews, sourceId, claimId, pending, error, historyError, notice, confirmation, uncertain, reconciled, needsReconcile, conflict, refresh, setQuery, selectSource, selectClaim, prepare, confirm, reconcile, acknowledge, reset }
}
