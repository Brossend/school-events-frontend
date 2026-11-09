import type { ClaimDetail, Evidence, Person, Review, SourceDetail } from '~/types/provenance'
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ каталога.')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Некорректный текст в ответе каталога.')
  return value
}
function nullable(value: unknown): string | null { return value == null ? null : text(value) }
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Некорректный список в ответе каталога.')
  return value
}
function person(value: unknown): Person | null {
  if (value == null) return null
  const v = object(value)
  return { id: text(v.id), name: text(v.name) }
}
function review(value: unknown): Review {
  const v = object(value)
  return { id: text(v.id), decision: text(v.decision), comments: text(v.comments), reviewed_at: text(v.reviewed_at), reviewer: person(v.reviewer) }
}
export function parseReviews(payload: unknown): Review[] { return array(object(payload).data).map(review) }
export function parseSource(payload: unknown): SourceDetail {
  const v = object(object(payload).data)
  return {
    id: text(v.id), calendar_event_id: text(v.calendar_event_id), title: text(v.title), source_type: text(v.source_type),
    author: nullable(v.author), url: nullable(v.url), doi_or_isbn: nullable(v.doi_or_isbn), created_at: text(v.created_at),
    latest_review: v.latest_review == null ? null : review(v.latest_review), verification_date: nullable(v.verification_date), verified_by: person(v.verified_by),
    claims: array(v.claims).map(item => { const c = object(item); return {
      id: text(c.id), cultural_claim_id: text(c.cultural_claim_id), claim_text: nullable(c.claim_text), culture_name: nullable(c.culture_name),
      event_source_id: text(v.id), citation_locator: text(c.citation_locator), citation_excerpt: nullable(c.citation_excerpt), verification_status: text(c.verification_status), notes: nullable(c.notes),
    } }),
  }
}
export function parseClaim(payload: unknown): ClaimDetail {
  const v = object(object(payload).data)
  return {
    id: text(v.id), calendar_event_id: text(v.calendar_event_id), claim_text: text(v.claim_text), culture_name: text(v.culture_name), provenance_notes: nullable(v.provenance_notes),
    evidence_records: array(v.evidence_records).map(item => {
      const e = object(item), s = e.source == null ? null : object(e.source)
      if (typeof e.is_detached !== 'boolean') throw new Error('Ответ не содержит признак отзыва доказательства.')
      return {
        id: text(e.id), event_source_id: text(e.event_source_id), citation_locator: text(e.citation_locator), citation_excerpt: nullable(e.citation_excerpt),
        verification_status: text(e.verification_status), effective_status: text(e.effective_status), is_detached: e.is_detached,
        detached_at: nullable(e.detached_at), detachment_reason: nullable(e.detachment_reason), notes: nullable(e.notes),
        verified_at: nullable(e.verified_at), verified_by: person(e.verified_by), applicable_academic_year: nullable(e.applicable_academic_year),
        source: s ? { id: text(s.id), title: text(s.title), url: nullable(s.url) } : null,
      }
    }),
    evidence_audit_events: array(v.evidence_audit_events).map(item => { const e = object(item); return {
      id: text(e.id), action: text(e.action), created_at: text(e.created_at), actor: person(e.actor), event_source_id: nullable(e.event_source_id),
      previous_verification_status: nullable(e.previous_verification_status), new_verification_status: nullable(e.new_verification_status),
      citation_locator: nullable(e.citation_locator), citation_excerpt: nullable(e.citation_excerpt), reason: nullable(e.reason),
    } }),
  }
}
export function safeSourceUrl(value: string | null | undefined): string | undefined {
  if (!value) return
  try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href } catch { /* Render unsafe/relative URLs as text. */ }
}
export function evidenceState(e: Pick<Evidence, 'effective_status' | 'is_detached' | 'citation_locator' | 'citation_excerpt'>) {
  if (e.is_detached) return { label: 'Свидетельство отозвано', tone: 'warning' as const }
  if (!e.citation_locator?.trim() || !e.citation_excerpt?.trim()) return { label: 'Недостаточно доказательств', tone: 'warning' as const }
  return verificationState(e.effective_status)
}
export function verificationState(status: string) {
  switch (status) {
    case 'verified_authentic': return { label: 'Утверждение подтверждено этим свидетельством', tone: 'success' as const }
    case 'rejected_fake': return { label: 'Свидетельство отклонено как недостоверное', tone: 'warning' as const }
    case 'unverified': return { label: 'Свидетельство не подтверждено', tone: 'warning' as const }
    default: return { label: `Статус не распознан: ${status}`, tone: 'neutral' as const }
  }
}
export function reviewState(decision: string | undefined) {
  switch (decision) {
    case 'approved': return { label: 'Источник одобрен рецензентом', tone: 'success' as const }
    case 'rejected': return { label: 'Источник отклонён рецензентом', tone: 'warning' as const }
    case 'requires_amendment': return { label: 'Источник требует доработки', tone: 'warning' as const }
    case undefined: return { label: 'Источник ожидает рецензии', tone: 'warning' as const }
    default: return { label: `Решение не распознано: ${decision}`, tone: 'neutral' as const }
  }
}
export function canReviewSources(role: string) { return role === 'catalog_curator' || role === 'system_admin' }
export function displayDate(value: string | null | undefined) {
  if (!value) return 'Дата не указана'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Дата не распознана' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'Asia/Yekaterinburg' }).format(date)
}
export function sourceType(value: string) {
  const labels: Record<string, string> = { official_publication: 'Официальная публикация', normative_act: 'Нормативный акт', scientific_publication: 'Научная публикация', ethnographic_archive: 'Этнографический архив', encyclopedia: 'Энциклопедия' }
  return labels[value] ?? value
}
export function auditAction(value: string) {
  const labels: Record<string, string> = { attached: 'Добавлено свидетельство', detached: 'Свидетельство отозвано', reattached: 'Свидетельство возвращено', reverified: 'Повторная проверка', invalidated_by_source_amendment: 'Подтверждение аннулировано после изменения источника' }
  return labels[value] ?? value
}
