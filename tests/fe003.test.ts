import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, watch } from 'vue'
import EventDetailContent from '../app/components/features/provenance/EventDetailContent.vue'
import EventSourceList from '../app/components/features/provenance/EventSourceList.vue'
import SourceContent from '../app/components/features/provenance/SourceContent.vue'
import ClaimContent from '../app/components/features/provenance/ClaimContent.vue'
import EvidenceRecord from '../app/components/features/provenance/EvidenceRecord.vue'
import ReviewHistory from '../app/components/features/provenance/ReviewHistory.vue'
import ProvenanceStatus from '../app/components/features/provenance/ProvenanceStatus.vue'
import UiBadge from '../app/components/ui/UiBadge.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import UiCard from '../app/components/ui/UiCard.vue'
import type { CalendarDetail, Evidence, SourceDetail } from '../app/types/provenance'
import { canReviewSources, evidenceState, parseClaim, parseReviews, parseSource, reviewState, safeSourceUrl } from '../app/utils/provenance'
import { canAccess } from '../app/utils/access'
import { useProvenanceResource } from '../app/composables/useProvenanceResource'
import { createApiClient } from '../app/utils/api-client'

const NuxtLink = defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) })
const global = { components: { NuxtLink, UiBadge, UiAlert, UiCard, ProvenanceStatus, EvidenceRecord, EventSourceList } }
const evidence: Evidence = {
  id: 'e', event_source_id: 's', citation_locator: 'Страница 12', citation_excerpt: 'Подлинная цитата из научной публикации.', notes: null,
  verification_status: 'verified_authentic', effective_status: 'verified_authentic', is_detached: false, detached_at: null, detachment_reason: null,
  verified_by: { id: 'u', name: 'Эксперт' }, verified_at: '2026-10-25T10:00:00Z', applicable_academic_year: '2026-2027', source: { id: 's', title: 'Научный сборник', url: null },
}
const source: SourceDetail = { id: 's', calendar_event_id: 'event', title: 'Исторический сборник', source_type: 'scientific_publication', author: 'Автор', url: 'https://example.org/source', doi_or_isbn: null, created_at: '2026-10-25', latest_review: null, claims: [], verification_date: null, verified_by: null }
const event: CalendarDetail = { id: 'event', title: 'Событие из ответа', description: 'Описание события', event_type: 'regional', region_code: '66', sources: [{ id: 's', title: source.title, url: source.url }], cultural_claims: [{ id: 'c', claim_text: 'Культурное утверждение', culture_name: 'Культура Урала', evidence_records: [evidence] }] }

describe('FE-003 provenance rendering', () => {
  it('renders event, source and claim links, actual evidence and inspect action', async () => {
    const w = mount(EventDetailContent, { props: { event }, global })
    expect(w.get('h1').text()).toBe(event.title)
    expect(w.get('a[href="/sources/s"]').text()).toBe(source.title)
    expect(w.findAll('a[href="/claims/c"]').length).toBe(2)
    expect(w.text()).toContain(evidence.citation_excerpt)
    await w.get('button').trigger('click')
    expect(w.emitted('inspect')).toEqual([['s']])
  })
  it('shows honest empty source/claim states', () => {
    const w = mount(EventDetailContent, { props: { event: { ...event, sources: [], cultural_claims: [] } }, global })
    expect(w.text()).toContain('Первоисточники не указаны')
    expect(w.text()).toContain('Культурные утверждения не добавлены')
    expect(w.find('.ui-badge--success').exists()).toBe(false)
  })
  it.each([undefined, 'approved', 'rejected', 'requires_amendment'])('keeps source decision separate from claim verification: %s', decision => {
    const latest_review = decision ? { id: 'r', decision, comments: 'Экспертное решение', reviewed_at: '2026-10-25', reviewer: null } : null
    const w = mount(SourceContent, { props: { source: { ...source, latest_review } }, global })
    expect(w.text()).toContain(reviewState(decision).label)
    expect(w.text()).not.toContain('Утверждение подтверждено')
    expect(w.text()).toContain('не подтверждает автоматически')
  })
  it.each(['verified_authentic', 'unverified', 'rejected_fake', 'future_status'])('uses effective evidence status: %s', effective_status => {
    const e = { ...evidence, effective_status }
    const w = mount(EvidenceRecord, { props: { evidence: e }, global })
    expect(w.get('.ui-badge').text()).toBe(evidenceState(e).label)
    expect(w.find('.ui-badge--success').exists()).toBe(effective_status === 'verified_authentic')
  })
  it('updates verified evidence to detached without stale green badge', async () => {
    const w = mount(EvidenceRecord, { props: { evidence }, global })
    expect(w.find('.ui-badge--success').exists()).toBe(true)
    await w.setProps({ evidence: { ...evidence, is_detached: true, effective_status: 'unverified', detached_at: '2026-10-25', detachment_reason: 'Ошибка локатора' } })
    expect(w.find('.ui-badge--success').exists()).toBe(false)
    expect(w.text()).toContain('Свидетельство отозвано')
    expect(w.text()).toContain('Ошибка локатора')
  })
  it('never confirms missing quote or locator', () => {
    for (const e of [{ ...evidence, citation_excerpt: null }, { ...evidence, citation_locator: '' }, { ...evidence, citation_excerpt: '   ' }]) {
      expect(evidenceState(e).tone).toBe('warning')
      const w = mount(EvidenceRecord, { props: { evidence: e }, global })
      expect(w.text()).not.toContain('Утверждение подтверждено')
      expect(w.find('.ui-badge--success').exists()).toBe(false)
    }
  })
  it('renders chronological server history including rejection', () => {
    const reviews = parseReviews({ data: [{ id: 'r1', decision: 'rejected', comments: 'Решение отменено', reviewed_at: '2026-10-25', reviewer: null }, { id: 'r2', decision: 'approved', comments: 'Предыдущая проверка', reviewed_at: '2026-10-24', reviewer: { id: 'u', name: 'Эксперт' } }] })
    const w = mount(ReviewHistory, { props: { reviews }, global })
    expect(w.findAll('li')[0]!.text()).toContain('Решение отменено')
    expect(w.text()).toContain('Эксперт')
    expect(w.text()).toContain('Рецензент не указан')
  })
  it('shows no evidence as unconfirmed and renders immutable audit', () => {
    const claim = parseClaim({ data: { id: 'c', calendar_event_id: 'event', claim_text: 'Утверждение', culture_name: 'Культура', evidence_records: [], evidence_audit_events: [{ id: 'a', action: 'detached', created_at: '2026-10-25', reason: 'Отзыв цитаты' }] } })
    const w = mount(ClaimContent, { props: { claim }, global })
    expect(w.text()).toContain('Доказательств нет')
    expect(w.text()).toContain('Отзыв цитаты')
    expect(w.find('.ui-badge--success').exists()).toBe(false)
  })
  it('guards runtime generic DTOs and missing detachment field', () => {
    expect(parseSource({ data: source })).toEqual(source)
    expect(() => parseSource({ data: { ...source, claims: null } })).toThrow()
    expect(() => parseClaim({ data: { id: 'c', calendar_event_id: 'event', claim_text: 't', culture_name: 'n', evidence_records: [{ ...evidence, is_detached: undefined }], evidence_audit_events: [] } })).toThrow('признак отзыва')
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', '//other.test/', 'https://user:secret@example.org'])('does not expose dangerous source URL: %s', url => {
    expect(safeSourceUrl(url)).toBeUndefined()
    const w = mount(SourceContent, { props: { source: { ...source, url } }, global })
    expect(w.find(`a[target="_blank"]`).exists()).toBe(false)
  })
  it('teacher has read access but no review rights; curator works without school', () => {
    expect(canAccess({ catalog: true }, 'teacher', 'none')).toBe(true)
    expect(canReviewSources('none')).toBe(false)
    expect(canAccess({ catalog: true }, undefined, 'catalog_curator')).toBe(true)
    expect(canReviewSources('catalog_curator')).toBe(true)
    expect(canAccess({ catalog: true }, undefined, 'none')).toBe(false)
  })
})

describe('FE-003 context cancellation and error transport', () => {
  it('loads catalog for curator without a school and stops on role loss', async () => {
    const auth = reactive({ authenticated: true, user: { id: 'curator' }, tenant: null, systemRole: 'catalog_curator' })
    vi.stubGlobal('useAuthStore', () => auth); vi.stubGlobal('watch', watch); vi.stubGlobal('onBeforeUnmount', vi.fn())
    try {
      const load = vi.fn().mockResolvedValue('regional catalog')
      const r = useProvenanceResource(load, () => 'calendar')
      await nextTick(); await nextTick()
      expect(r.data.value).toBe('regional catalog')
      expect(load).toHaveBeenCalledOnce()
      auth.systemRole = 'none'
      expect(r.data.value).toBeNull()
      expect(load).toHaveBeenCalledOnce()
      r.reset()
    } finally { vi.unstubAllGlobals() }
  })
  it('clears A while loading B, ignores late A, and clears on logout', async () => {
    const auth = reactive({ authenticated: true, user: { id: 'u' }, tenant: { school_id: 'A' }, systemRole: 'none' })
    const pending: { signal: AbortSignal; resolve: (value: string) => void }[] = []
    vi.stubGlobal('useAuthStore', () => auth); vi.stubGlobal('watch', watch); vi.stubGlobal('onBeforeUnmount', vi.fn())
    try {
      const r = useProvenanceResource(signal => new Promise<string>(resolve => { pending.push({ signal, resolve }) }), () => 'source')
      auth.tenant.school_id = 'B'
      expect(pending[0]!.signal.aborted).toBe(true)
      expect(r.data.value).toBeNull()
      pending[1]!.resolve('B private'); await nextTick(); await nextTick()
      pending[0]!.resolve('A private'); await nextTick(); await nextTick()
      expect(r.data.value).toBe('B private')
      auth.authenticated = false
      expect(r.data.value).toBeNull()
      r.reset()
    } finally { vi.unstubAllGlobals() }
  })
  it.each([401, 403, 404, 409, 422])('preserves server denial/conflict status %s', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: `FE003_${status}`, message: 'Отказ сервера' } }), { status }))
    const client = createApiClient({ origin: 'http://localhost', fetch: fetcher, getSchoolId: () => 'school-a', getCookie: () => '' })
    await expect(client.request('get', '/event-sources/{id}', { params: { id: 'source' }, reportError: false })).rejects.toMatchObject({ status, code: `FE003_${status}` })
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).get('X-School-Id')).toBe('school-a')
  })
})
