import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { CatalogAction, CatalogServices } from '../app/utils/catalog-admin-controller'
import type { CatalogQueuePage, SourcePatch } from '../app/types/catalog-admin'
import type { ClaimDetail, SourceDetail } from '../app/types/provenance'
import { createCatalogAdminController } from '../app/utils/catalog-admin-controller'
import { ApiError } from '../app/utils/api-error'
import CatalogWorkspace from '../app/components/features/catalog/CatalogWorkspace.vue'
import UiButton from '../app/components/ui/UiButton.vue'

const sourceId = '019a0000-0000-7000-8000-000000000001'
const claimId = '019a0000-0000-7000-8000-000000000002'
const schoolId = '019a0000-0000-7000-8000-000000000003'
const eventId = '019a0000-0000-7000-8000-000000000004'
const title = 'Исторический сборник'
const revisedTitle = 'Уточнённое название сборника'
const freshAuthor = 'Автор после независимого уточнения'

function source(): SourceDetail {
  return { id: sourceId, calendar_event_id: eventId, title, author: null, source_type: 'scientific_publication', url: null, doi_or_isbn: null, latest_review: null, verification_date: null, verified_by: null, claims: [], created_at: '2026-10-29T10:00:00Z' }
}
function claim(): ClaimDetail {
  return {
    id: claimId, calendar_event_id: eventId, claim_text: 'Проверяемое утверждение', culture_name: 'Культура', provenance_notes: null,
    evidence_records: [{ id: 'evidence-1', event_source_id: sourceId, citation_locator: 'с. 25', citation_excerpt: 'Содержательная цитата из первоисточника.', verification_status: 'unverified', effective_status: 'unverified', is_detached: false, detached_at: null, detachment_reason: null, notes: null, verified_at: null, verified_by: null, applicable_academic_year: null, source: { id: sourceId, title, url: null } }],
    evidence_audit_events: [],
  }
}
const page: CatalogQueuePage = { data: [], meta: { current_page: 1, total: 0, per_page: 20, last_page: 1 } }
type Read = 'source' | 'claim' | 'queue' | 'reviews'

function harness(context = () => 'principal-A:school:catalog_curator:teacher') {
  let serverSource = source(), readFailure: Read | null = null, failAfterWrite: Read | null = null
  let writeError: Error | null = null
  const check = (read: Read) => { if (readFailure === read) throw new Error(`${read} GET unavailable`) }
  const written = () => {
    readFailure = failAfterWrite
    if (writeError) throw writeError
    return {}
  }
  const services = {
    queue: vi.fn<CatalogServices['queue']>(async () => { check('queue'); return structuredClone(page) }),
    source: vi.fn<CatalogServices['source']>(async () => { check('source'); return structuredClone(serverSource) }),
    reviews: vi.fn<CatalogServices['reviews']>(async () => { check('reviews'); return [] }),
    claim: vi.fn<CatalogServices['claim']>(async () => { check('claim'); return claim() }),
    patchSource: vi.fn<CatalogServices['patchSource']>(async (_id, body) => { const result = written(); serverSource = { ...serverSource, ...body }; return result }),
    review: vi.fn<CatalogServices['review']>(async () => written()),
    attach: vi.fn<CatalogServices['attach']>(async () => written()),
    detach: vi.fn<CatalogServices['detach']>(async () => written()),
  }
  const controller = createCatalogAdminController(services, context)
  return {
    services, controller, context,
    failRead: (read: Read | null) => { readFailure = read },
    failAfterWrite: (read: Read | null) => { failAfterWrite = read },
    rejectWrite: (error: Error | null) => { writeError = error },
    amendSource: (patch: SourcePatch) => { serverSource = { ...serverSource, ...patch } },
    writes: () => services.patchSource.mock.calls.length + services.review.mock.calls.length + services.attach.mock.calls.length + services.detach.mock.calls.length,
  }
}
type Harness = ReturnType<typeof harness>
function action(kind: CatalogAction['kind']): CatalogAction {
  switch (kind) {
    case 'patch': return { kind, sourceId, body: { title: revisedTitle }, baseline: { title, author: null } }
    case 'review': return { kind, sourceId, body: { decision: 'approved', comments: 'Решение по проверенному изданию.' }, latestReviewId: null }
    case 'attach': return { kind, claimId, body: { event_source_id: sourceId, citation_locator: 'с. 25', citation_excerpt: 'Содержательная цитата из первоисточника.', verify: false } }
    case 'detach': return { kind, claimId, sourceId, reason: 'Требуется уточнение цитаты' }
  }
}
async function loadBoth(h: Harness) {
  await h.controller.selectSource(sourceId)
  await h.controller.selectClaim(claimId)
}
async function attemptAnotherWrite(h: Harness, prepared: CatalogAction) {
  h.controller.prepare(prepared)
  await h.controller.confirm()
  expect(h.controller.confirmation.value).toBeNull()
  expect(h.writes()).toBe(1)
}

describe('FE011 independent R1: accepted writes recover through GET only', () => {
  const cases = (['patch', 'review', 'attach', 'detach'] as const).flatMap(kind =>
    (['source', 'claim', 'queue'] as const).map(read => ({ kind, read })),
  )
  it.each(cases)('$kind accepted, then $read GET fails: exactly one write until recovery', async ({ kind, read }) => {
    const h = harness(), c = h.controller, prepared = action(kind)
    await loadBoth(h)
    h.failAfterWrite(read)
    c.prepare(prepared)
    await c.confirm()

    expect(h.writes()).toBe(1)
    expect(c.needsReconcile.value).toBe(true)
    expect(c.uncertain.value).toBeNull()
    expect(c.pending.value).toBe('')
    expect(c.error.value?.message).toBe(`${read} GET unavailable`)
    await attemptAnotherWrite(h, prepared)
    const sourceReads = h.services.source.mock.calls.length, claimReads = h.services.claim.mock.calls.length
    await c.selectSource(sourceId)
    await c.selectClaim(claimId)
    expect(h.services.source).toHaveBeenCalledTimes(sourceReads)
    expect(h.services.claim).toHaveBeenCalledTimes(claimReads)

    await c.reconcile()
    expect(c.needsReconcile.value).toBe(true)
    c.acknowledge()
    await attemptAnotherWrite(h, prepared)

    h.failRead(null)
    await c.reconcile()
    expect(c.needsReconcile.value).toBe(false)
    expect(c.error.value).toBeNull()
    expect(c.source.value?.id).toBe(sourceId)
    expect(c.claim.value?.id).toBe(claimId)
    expect(c.queue.value).toEqual(page)
    expect(h.writes()).toBe(1)
    await c.confirm()
    expect(h.writes()).toBe(1)
  })
})

describe('FE011 independent R2: reconciliation must be complete and current', () => {
  it.each(['source', 'claim', 'queue', 'reviews'] as const)('a failed %s GET revokes previous successful reconciliation', async read => {
    const h = harness(), c = h.controller, prepared = action('review')
    await loadBoth(h)
    h.rejectWrite(new ApiError(500, 'UNKNOWN_WRITE', 'Unknown review outcome'))
    c.prepare(prepared)
    await c.confirm()
    expect(c.uncertain.value?.kind).toBe('review')
    expect(c.reconciled.value).toBe(true)

    h.failRead(read)
    await c.reconcile()
    expect(c.reconciled.value).toBe(false)
    expect(c.error.value?.message).toBe(`${read} GET unavailable`)
    c.acknowledge()
    expect(c.uncertain.value?.kind).toBe('review')
    await attemptAnotherWrite(h, prepared)

    h.failRead(null)
    await c.reconcile()
    expect(c.reconciled.value).toBe(true)
    expect(c.uncertain.value).not.toBeNull()
    c.acknowledge()
    expect(c.uncertain.value).toBeNull()
    expect(c.reconciled.value).toBe(false)
    expect(h.writes()).toBe(1)
  })

  it.each(['accepted', 'unknown'] as const)('history failure cannot complete %s-write reconciliation', async outcome => {
    const h = harness(), c = h.controller, prepared = action('review')
    await loadBoth(h)
    h.failAfterWrite('reviews')
    if (outcome === 'unknown') h.rejectWrite(new ApiError(500, 'UNKNOWN_WRITE', 'Unknown review outcome'))
    c.prepare(prepared)
    await c.confirm()
    expect(c.source.value?.id).toBe(sourceId)
    expect(c.historyError.value?.message).toBe('reviews GET unavailable')
    expect(c.reviews.value).toEqual([])
    expect(c.reconciled.value).toBe(false)
    expect(c.needsReconcile.value).toBe(outcome === 'accepted')
    c.acknowledge()
    await attemptAnotherWrite(h, prepared)
    h.failRead(null)
    await c.reconcile()
    if (outcome === 'unknown') c.acknowledge()
    expect(c.needsReconcile.value).toBe(false)
    expect(c.uncertain.value).toBeNull()
    expect(c.historyError.value).toBeNull()
    expect(h.writes()).toBe(1)
  })

  it('ordinary source browsing still shows available details when history fails', async () => {
    const h = harness()
    h.failRead('reviews')
    await h.controller.selectSource(sourceId)
    expect(h.controller.source.value).toEqual(source())
    expect(h.controller.historyError.value?.message).toBe('reviews GET unavailable')
    expect(h.controller.error.value).toBeNull()
    expect(h.controller.reconciled.value).toBe(false)
    expect(h.writes()).toBe(0)
  })
})

// Keep the real workspace/controller and button behavior; stub only presentation
// and model controls so the tests exercise user actions without Nuxt bootstrap.
const Field = defineComponent({
  props: { label: String, modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  template: '<label><span>{{ label }}</span><input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)"></label>',
})
const Textarea = defineComponent({
  props: { label: String, modelValue: String, disabled: Boolean },
  emits: ['update:modelValue'],
  template: '<label><span>{{ label }}</span><textarea :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" /></label>',
})
const Select = defineComponent({
  props: ['label', 'modelValue', 'disabled', 'options'],
  emits: ['update:modelValue'],
  template: '<label><span>{{ label }}</span><select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>',
})
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})
function mountWorkspace() {
  const auth = reactive({ userId: 'principal-A', schoolId, systemRole: 'catalog_curator', schoolRole: 'teacher' })
  const h = harness(() => JSON.stringify(auth))
  vi.stubGlobal('useCatalogAdminApi', () => ({ ...h.services, context: h.context }))
  vi.stubGlobal('useRoute', () => ({ query: {} }))
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiOrigin: 'http://localhost:8000' } }))
  const wrapper = mount(CatalogWorkspace, { global: {
    components: { UiButton },
    stubs: {
      UiField: Field, UiTextarea: Textarea, UiSelect: Select,
      UiAlert: { template: '<aside><slot /></aside>' }, UiCard: { template: '<section><slot /></section>' },
      UiModal: { props: ['modelValue', 'title'], template: '<section v-if="modelValue" role="dialog"><h2>{{ title }}</h2><slot /></section>' },
      UiState: true, SourceContent: true, ClaimContent: true, SourceInspector: true, ReviewHistory: true, ProvenanceStatus: true,
    },
  } })
  wrappers.push(wrapper)
  return { ...h, wrapper, auth }
}
function control(wrapper: VueWrapper, label: string) {
  const field = wrapper.findAll('label').find(item => item.find('span').exists() && item.get('span').text() === label)
  if (!field) throw new Error(`Missing field: ${label}`)
  return field.get('input, textarea, select')
}
function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(item => item.text() === label)
  if (!match) throw new Error(`Missing button: ${label}`)
  return match
}
async function click(wrapper: VueWrapper, label: string) {
  await button(wrapper, label).trigger('click')
  await flushPromises()
}
async function openSource(wrapper: VueWrapper, id = sourceId) {
  await control(wrapper, 'ID источника').setValue(id)
  const form = wrapper.findAll('form').find(item => item.text().includes('Загрузить источник'))!
  await form.trigger('submit')
  await flushPromises()
}
async function openClaim(wrapper: VueWrapper) {
  await control(wrapper, 'ID культурного утверждения').setValue(claimId)
  const form = wrapper.findAll('form').find(item => item.text().includes('Загрузить утверждение'))!
  await form.trigger('submit')
  await flushPromises()
}
async function submitPatch(wrapper: VueWrapper) {
  const form = wrapper.findAll('form').find(item => item.text().includes('Библиографические реквизиты'))!
  await form.trigger('submit')
  await flushPromises()
}
function value(wrapper: VueWrapper, label: string) {
  return (control(wrapper, label).element as HTMLInputElement).value
}

describe('FE011 independent R1: visible accepted-write recovery', () => {
  it.each(['source', 'claim', 'queue'] as const)('keeps the form write-blocked after %s GET fails and recovers without replay', async read => {
    const h = mountWorkspace(), w = h.wrapper
    await flushPromises()
    await openSource(w)
    await openClaim(w)
    await click(w, 'Реквизиты')
    await control(w, 'Название источника').setValue(revisedTitle)
    h.failAfterWrite(read)
    await submitPatch(w)
    await click(w, 'Подтвердить действие')
    expect(w.text()).toContain('Запись принята сервером, но обновление сведений не завершено.')
    expect(button(w, 'Загрузить источник').attributes('disabled')).toBeDefined()
    expect(button(w, 'Загрузить утверждение').attributes('disabled')).toBeDefined()
    expect(h.writes()).toBe(1)
    if (read !== 'source') {
      expect(button(w, 'Сохранить реквизиты…').attributes('disabled')).toBeDefined()
      await click(w, 'Сохранить реквизиты…')
      expect(w.find('[role="dialog"]').exists()).toBe(false)
    }
    await click(w, 'Перечитать состояние')
    expect(w.text()).toContain('Новые действия заблокированы до GET-сверки.')
    expect(h.writes()).toBe(1)
    h.failRead(null)
    await click(w, 'Перечитать состояние')
    expect(w.text()).not.toContain('Новые действия заблокированы до GET-сверки.')
    expect(button(w, 'Сохранить реквизиты…').attributes('disabled')).toBeUndefined()
    expect(value(w, 'Название источника')).toBe(revisedTitle)
    expect(h.writes()).toBe(1)
  })

  it('preserves the visible bibliography draft and field error after a 422 rejection', async () => {
    const h = mountWorkspace(), w = h.wrapper
    await flushPromises()
    await openSource(w)
    await click(w, 'Реквизиты')
    await control(w, 'Название источника').setValue(revisedTitle)
    h.rejectWrite(new ApiError(422, 'VALIDATION_FAILED', 'Отклонено сервером', [{ field: 'title', message: 'Название требует уточнения' }]))
    await submitPatch(w)
    await click(w, 'Подтвердить действие')
    expect(value(w, 'Название источника')).toBe(revisedTitle)
    expect(w.text()).toContain('Название требует уточнения')
    expect(w.text()).not.toContain('Новые действия заблокированы до GET-сверки.')
    expect(h.writes()).toBe(1)
  })
})

describe('FE011 independent R3: visible form state belongs to the current context', () => {
  it.each(['principal', 'system role', 'school role'] as const)('clears every form after a %s change in the same school', async change => {
    const h = mountWorkspace(), w = h.wrapper
    await flushPromises()
    await openSource(w)
    await click(w, 'Реквизиты')
    await control(w, 'Название источника').setValue('Секретный черновик пользователя A')
    await click(w, 'Экспертное решение')
    await control(w, 'Решение эксперта').setValue('approved')
    await control(w, 'Замечания и обоснование').setValue('Несохранённое решение пользователя A')
    await openClaim(w)
    await control(w, 'Локатор цитаты').setValue('с. 555')
    await control(w, 'Дословная цитата').setValue('Несохранённая цитата пользователя A')
    await control(w, 'Применимый учебный год (необязательно)').setValue('2026-2027')
    await control(w, 'Примечание к доказательству').setValue('Примечание пользователя A')
    await control(w, 'Причина открепления').setValue('Причина пользователя A')
    await w.get('input[type="checkbox"]').setValue(true)
    expect(value(w, 'ID доказывающего источника')).toBe(sourceId)

    if (change === 'principal') h.auth.userId = 'principal-B'
    else if (change === 'system role') h.auth.systemRole = 'system_admin'
    else h.auth.schoolRole = 'school_admin'
    await flushPromises()
    expect(h.auth.schoolId).toBe(schoolId)
    expect(value(w, 'ID источника')).toBe('')
    expect(value(w, 'ID культурного утверждения')).toBe('')
    expect(w.find('[role="dialog"]').exists()).toBe(false)

    await openClaim(w)
    for (const label of ['ID доказывающего источника', 'Локатор цитаты', 'Дословная цитата', 'Применимый учебный год (необязательно)', 'Примечание к доказательству', 'Причина открепления']) expect(value(w, label)).toBe('')
    expect((w.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    await openSource(w)
    await click(w, 'Реквизиты')
    expect(value(w, 'Название источника')).toBe(title)
    await click(w, 'Экспертное решение')
    expect(value(w, 'Решение эксперта')).toBe('requires_amendment')
    expect(value(w, 'Замечания и обоснование')).toBe('')
    expect(h.writes()).toBe(0)
  })
})

describe('FE011 independent R4: conflict rebase preserves only deliberate edits', () => {
  it.each([false, true])('retains edited title and fresh untouched author (server also edits title: %s)', async serverAlsoEditsTitle => {
    const h = mountWorkspace(), w = h.wrapper
    await flushPromises()
    await openSource(w)
    await click(w, 'Реквизиты')
    await control(w, 'Название источника').setValue(revisedTitle)
    h.amendSource({ author: freshAuthor, ...(serverAlsoEditsTitle ? { title: 'Название другого куратора' } : {}) })
    await submitPatch(w)
    expect(h.writes()).toBe(0)
    await click(w, 'Подтвердить действие')
    expect(h.writes()).toBe(0)
    expect(value(w, 'Название источника')).toBe(revisedTitle)
    expect(w.text()).toContain(freshAuthor)

    await click(w, 'Обновить основу, сохранив мои изменения')
    expect(value(w, 'Название источника')).toBe(revisedTitle)
    expect(value(w, 'Автор')).toBe(freshAuthor)
    expect(h.writes()).toBe(0)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await submitPatch(w)
    expect(h.writes()).toBe(0)
    expect(w.get('[role="dialog"]').text()).toContain('Изменить реквизиты источника?')
    await click(w, 'Подтвердить действие')
    expect(h.services.patchSource).toHaveBeenCalledExactlyOnceWith(sourceId, { title: revisedTitle }, expect.any(AbortSignal))
    expect(h.writes()).toBe(1)
    expect(value(w, 'Название источника')).toBe(revisedTitle)
    expect(value(w, 'Автор')).toBe(freshAuthor)
  })

  it('does not offer a previous source conflict for rebasing a different selected source', async () => {
    const h = mountWorkspace(), w = h.wrapper
    await flushPromises()
    await openSource(w)
    await click(w, 'Реквизиты')
    await control(w, 'Название источника').setValue(revisedTitle)
    h.amendSource({ author: freshAuthor })
    await submitPatch(w)
    await click(w, 'Подтвердить действие')
    expect(w.text()).toContain('Обновить основу, сохранив мои изменения')

    const otherId = '019a0000-0000-7000-8000-000000000005'
    h.services.source.mockImplementation(async id => ({ ...source(), id, title: id === otherId ? 'Другой выбранный источник' : title }))
    await openSource(w, otherId)
    await click(w, 'Реквизиты')
    expect(value(w, 'Название источника')).toBe('Другой выбранный источник')
    const staleRebase = w.findAll('button').find(item => item.text() === 'Обновить основу, сохранив мои изменения')
    if (staleRebase) {
      await staleRebase.trigger('click')
      await flushPromises()
    }
    expect(value(w, 'ID источника')).toBe(otherId)
    expect(value(w, 'Название источника')).toBe('Другой выбранный источник')
    expect(h.writes()).toBe(0)
  })
})
