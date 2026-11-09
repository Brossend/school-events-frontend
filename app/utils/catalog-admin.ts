import type { CatalogQueueItem, CatalogQueuePage, CatalogStatus, ClaimEvidenceInput, ClaimEvidenceResult, SourcePatch, SourcePatchResult, SourceReviewInput } from '~/types/catalog-admin'
import { parseReviews } from './provenance'
export { parseSource as parseCatalogSource, parseReviews as parseCatalogReviews, parseClaim as parseCatalogClaim } from './provenance'

export const sourceTypes = ['official_publication', 'normative_act', 'scientific_publication', 'ethnographic_archive', 'encyclopedia'] as const
export const reviewDecisions = ['approved', 'rejected', 'requires_amendment'] as const
export const catalogStatuses = ['pending', ...reviewDecisions] as const
export const sourcePatchFields = ['title', 'author', 'source_type', 'url', 'doi_or_isbn'] as const
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ каталога.')
  return value as Record<string, unknown>
}
function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Некорректный текст каталога.'); return value }
function nullable(value: unknown): string | null { return value == null ? null : text(value) }
function integer(value: unknown, min = 0): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error('Некорректная пагинация каталога.'); return value }
export function parseQueue(payload: unknown): CatalogQueuePage {
  const root = object(payload), meta = object(root.meta)
  if (!Array.isArray(root.data)) throw new Error('Сервер не вернул очередь каталога.')
  const data: CatalogQueueItem[] = root.data.map(value => {
    const v = object(value), event = v.calendar_event == null ? null : object(v.calendar_event)
    if (!catalogStatuses.includes(v.status as CatalogStatus)) throw new Error('Неизвестный статус очереди каталога.')
    const reviewer = v.verified_by == null ? null : object(v.verified_by)
    return {
      id: text(v.id), calendar_event_id: text(v.calendar_event_id), title: text(v.title), source_type: text(v.source_type),
      author: nullable(v.author), url: nullable(v.url), doi_or_isbn: nullable(v.doi_or_isbn), created_at: text(v.created_at),
      claims_count: integer(v.claims_count), status: v.status as CatalogStatus,
      calendar_event: event ? { id: text(event.id), title: text(event.title), event_type: text(event.event_type), region_code: nullable(event.region_code), status: text(event.status) } : null,
      latest_review: v.latest_review == null ? null : parseReviews({ data: [v.latest_review] })[0]!,
      verified_by: reviewer ? { id: text(reviewer.id), name: text(reviewer.name) } : null,
      verification_date: nullable(v.verification_date),
    }
  })
  return { data, meta: { current_page: integer(meta.current_page, 1), total: integer(meta.total), per_page: integer(meta.per_page, 1), last_page: integer(meta.last_page, 1) } }
}
export function parseSourcePatch(payload: unknown): SourcePatchResult {
  const v = object(object(payload).data)
  return { id: text(v.id), calendar_event_id: text(v.calendar_event_id), title: text(v.title), source_type: text(v.source_type), author: nullable(v.author), url: nullable(v.url), doi_or_isbn: nullable(v.doi_or_isbn), verified_by_user_id: nullable(v.verified_by_user_id), verification_date: nullable(v.verification_date), created_at: text(v.created_at) }
}
export function parseSourcePatchReply(payload: unknown, id?: string): SourcePatchResult {
  const result = parseSourcePatch(payload)
  if (id !== undefined && result.id !== id) throw new Error('Ответ относится к другому первоисточнику.')
  return result
}
export function parseEvidenceReply(payload: unknown): ClaimEvidenceResult {
  const v = object(object(payload).data), source = v.source == null ? null : object(v.source), verifier = v.verified_by == null ? null : object(v.verified_by)
  return {
    id: text(v.id), cultural_claim_id: text(v.cultural_claim_id), event_source_id: text(v.event_source_id),
    citation_locator: text(v.citation_locator), citation_excerpt: nullable(v.citation_excerpt),
    verification_status: text(v.verification_status), effective_status: text(v.effective_status),
    verified_at: nullable(v.verified_at), verified_by: verifier ? { id: text(verifier.id), name: text(verifier.name) } : null,
    applicable_academic_year: nullable(v.applicable_academic_year), notes: nullable(v.notes),
    source: source ? { id: text(source.id), title: text(source.title), author: nullable(source.author), source_type: text(source.source_type) } : null,
  }
}
function pick<T>(value: T, fields: readonly (keyof T)[]): T {
  const output: Partial<T> = {}
  for (const field of fields) if (Object.hasOwn(value as object, field) && value[field] !== undefined) output[field] = value[field]
  return output as T
}
// Build transport bodies from explicit allowlists, never by spreading form/detail objects.
export function allowedSourcePatch(input: SourcePatch): SourcePatch { return pick(input, sourcePatchFields) }
export function allowedSourceReview(input: SourceReviewInput): SourceReviewInput { return pick(input, ['decision', 'comments']) }
export function allowedClaimEvidence(input: ClaimEvidenceInput): ClaimEvidenceInput { return pick(input, ['event_source_id', 'citation_locator', 'citation_excerpt', 'applicable_academic_year', 'notes', 'verify']) }
function lengthIssue(value: unknown, min: number, max: number, required: boolean): boolean {
  if (value == null) return required
  if (typeof value !== 'string') return true
  const length = Array.from(value.trim()).length
  return length < min || length > max
}
export function sourcePatchIssues(input: SourcePatch): Record<string, string> {
  const issues: Record<string, string> = {}
  if (Object.hasOwn(input, 'title') && lengthIssue(input.title, 3, 500, true)) issues.title = 'Название: от 3 до 500 символов.'
  if (input.source_type !== undefined && !sourceTypes.includes(input.source_type)) issues.source_type = 'Выберите допустимый тип источника.'
  if (lengthIssue(input.author, 0, 255, false)) issues.author = 'Автор: не более 255 символов.'
  if (lengthIssue(input.doi_or_isbn, 0, 64, false)) issues.doi_or_isbn = 'DOI или ISBN: не более 64 символов.'
  if (input.url != null && input.url !== '') {
    let valid = false
    try { const url = new URL(input.url); valid = ['https:', 'http:', 'ftp:', 'ftps:'].includes(url.protocol) && !!url.hostname } catch { /* Invalid URL is a field issue. */ }
    if (lengthIssue(input.url, 0, 1000, false) || !valid) issues.url = 'Укажите корректный URL длиной до 1000 символов.'
  }
  return issues
}
export function reviewIssues(input: SourceReviewInput): Record<string, string> {
  const issues: Record<string, string> = {}
  if (!reviewDecisions.includes(input.decision)) issues.decision = 'Выберите экспертное решение.'
  if (lengthIssue(input.comments, 5, 2000, true)) issues.comments = 'Замечания: от 5 до 2000 символов.'
  return issues
}
const placeholders = new Set(['см. источник', 'в тексте', 'везде', 'весь текст', 'весь закон', 'весь указ', 'общий', 'нет', 'n/a', 'none', 'test', 'placeholder', 'цитата', 'выдержка'])
export function evidenceIssues(input: ClaimEvidenceInput): Record<string, string> {
  const issues: Record<string, string> = {}, verify = input.verify !== false
  if (typeof input.event_source_id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(input.event_source_id)) issues.event_source_id = 'Укажите UUID первоисточника.'
  if (lengthIssue(input.citation_locator, 3, 255, true) || verify && typeof input.citation_locator === 'string' && placeholders.has(input.citation_locator.trim().toLowerCase())) issues.citation_locator = 'Укажите точный локатор цитаты: от 3 до 255 символов.'
  if (lengthIssue(input.citation_excerpt, 10, 2000, true) || verify && typeof input.citation_excerpt === 'string' && placeholders.has(input.citation_excerpt.trim().toLowerCase())) issues.citation_excerpt = 'Укажите содержательную цитату: от 10 до 2000 символов.'
  if (lengthIssue(input.notes, 0, 2000, false)) issues.notes = 'Примечания: не более 2000 символов.'
  if (input.verify != null && typeof input.verify !== 'boolean') issues.verify = 'Выберите режим проверки.'
  if (input.applicable_academic_year != null && input.applicable_academic_year !== '') {
    const match = /^(\d{4})-(\d{4})$/.exec(input.applicable_academic_year)
    if (!match || verify && Number(match[2]) !== Number(match[1]) + 1) issues.applicable_academic_year = verify ? 'Укажите последовательные годы, например 2026-2027.' : 'Укажите учебный год в формате YYYY-YYYY.'
  }
  return issues
}
// Preserve service-only 422 fields (reviewer/verifier) as visible form errors.
// evidence_excerpt is a backend service alias, never a request-body field.
export function catalogFieldIssues(error: { details: { field: string; message: string }[] }): Record<string, string> {
  const entries = error.details.map(issue => [issue.field === 'evidence_excerpt' ? 'citation_excerpt' : issue.field, issue.message])
  return Object.fromEntries(entries)
}
export { parseQueue as parseCatalogQueue, reviewIssues as sourceReviewIssues, evidenceIssues as claimEvidenceIssues }
