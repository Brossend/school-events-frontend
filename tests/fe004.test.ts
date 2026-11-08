import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, useId } from 'vue'
import TraditionList from '../app/components/features/traditions/TraditionList.vue'
import TraditionDetailContent from '../app/components/features/traditions/TraditionDetailContent.vue'
import TraditionMetadataForm from '../app/components/features/traditions/TraditionMetadataForm.vue'
import AnnualVersionForm from '../app/components/features/traditions/AnnualVersionForm.vue'
import UiCard from '../app/components/ui/UiCard.vue'
import UiBadge from '../app/components/ui/UiBadge.vue'
import UiState from '../app/components/ui/UiState.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import UiField from '../app/components/ui/UiField.vue'
import UiTextarea from '../app/components/ui/UiTextarea.vue'
import type { TraditionDetail } from '../app/types/traditions'
import { annualYearIssue, metadataIssues, parseTradition, parseTraditions, readTraditionFilter, suggestedAnnualYear, traditionPermissions } from '../app/utils/traditions'
import { createContextMutation } from '../app/utils/context-mutation'
import { ApiError } from '../app/utils/api-error'
import { createApiClient } from '../app/utils/api-client'
import { useTraditionsApi } from '../app/composables/useTraditionsApi'

const NuxtLink = defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) })
const global = { components: { NuxtLink, UiCard, UiBadge, UiState, UiAlert, UiButton, UiField, UiTextarea } }
const tradition: TraditionDetail = { id: 't1', school_id: 'a', title: 'Мастерская добрых дел', description: 'Концепция совместной работы школы.', established_year: 2000, is_archived: false, created_by_user_id: 'author', created_at: '2025-10-01', updated_at: '2026-10-25', active_version: { id: 'v1', academic_year: '2026-2027', notes: 'Текущая версия', created_at: '2026-10-25' }, versions: [{ id: 'v1', academic_year: '2026-2027', notes: 'Текущая версия', created_at: '2026-10-25', parameters_snapshot: { participants: 'Школа A' } }, { id: 'v0', academic_year: '2025-2026', notes: 'История школы', created_at: '2025-10-01', parameters_snapshot: { participants: 'Семьи' } }] }
afterEach(() => vi.unstubAllGlobals())

describe('FE-004 render and permissions', () => {
  it('renders actual title, year, count, current version and detail route', () => {
    const w = mount(TraditionList, { props: { traditions: [tradition] }, global })
    expect(w.text()).toContain('Версий в истории: 2')
    expect(w.text()).toContain('Текущая версия: 2026-2027')
    expect(w.get('h2 a').attributes('href')).toBe('/traditions/t1')
    expect(w.text()).not.toContain('23 ученика')
  })
  it('renders empty list without demo cards', () => {
    expect(mount(TraditionList, { props: { traditions: [] }, global }).findAll('article')).toHaveLength(0)
  })
  it('renders separate immutable history and current server selection', () => {
    const w = mount(TraditionDetailContent, { props: { tradition, schoolName: 'Школа A', canEdit: true, canVersion: true }, global })
    expect(w.text()).toContain('Школа A')
    expect(w.findAll('.tradition-version')).toHaveLength(2)
    expect(w.get('.tradition-version--current').text()).toContain('2026-2027')
    expect(w.text()).toContain('Историческая версия')
    expect(w.findAll('input')).toHaveLength(0)
  })
  it('hides edit/archive for non-author but permits a new annual version', () => {
    const permissions = traditionPermissions(tradition, 'a', 'other', 'teacher', 'none')
    const w = mount(TraditionDetailContent, { props: { tradition, schoolName: 'A', canEdit: permissions.edit, canVersion: permissions.version }, global })
    expect(w.text()).not.toContain('Редактировать сведения')
    expect(w.text()).not.toContain('Архивировать традицию')
    expect(w.text()).toContain('Создать ежегодную версию')
  })
  it.each([['author', 'teacher', 'none'], ['other', 'school_admin', 'none'], ['other', 'teacher', 'system_admin']])('allows metadata edits for %s/%s/%s', (user, role, system) => {
    expect(traditionPermissions(tradition, 'a', user, role, system).edit).toBe(true)
    expect(traditionPermissions(tradition, 'b', user, role, system).edit).toBe(false)
  })
  it('denies mutation without current membership or user', () => {
    expect(traditionPermissions(tradition, undefined, 'author', undefined, 'system_admin')).toEqual({ edit: false, version: false })
    expect(traditionPermissions(tradition, 'a', undefined, 'teacher', 'none').version).toBe(false)
  })
  it('shows archived state with history, no archive-again or restore action', async () => {
    const w = mount(TraditionDetailContent, { props: { tradition: { ...tradition, is_archived: true }, schoolName: 'A', canEdit: true, canVersion: true }, global })
    expect(w.text()).toContain('В архиве')
    expect(w.text()).not.toContain('Архивировать традицию')
    expect(w.text()).not.toContain('Восстановить')
    await w.findAll('button')[0]!.trigger('click')
    expect(w.emitted('annual')).toHaveLength(1)
  })
  it('requests archive intent before any operation', async () => {
    const w = mount(TraditionDetailContent, { props: { tradition, schoolName: 'A', canEdit: true, canVersion: true }, global })
    await w.findAll('button').find(b => b.text() === 'Архивировать традицию')!.trigger('click')
    expect(w.emitted('archive')).toHaveLength(1)
  })
})

describe('FE-004 forms and contract adapters', () => {
  it('validates required metadata and emits actual create payload', async () => {
    vi.stubGlobal('useId', useId)
    const w = mount(TraditionMetadataForm, { global })
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('от 3 до 255')
    await w.get('input[type="text"]').setValue('Новая традиция')
    await w.get('textarea').setValue('Описание нашей новой традиции')
    await w.get('input[type="number"]').setValue('2001')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')?.[0]?.[0]).toEqual({ title: 'Новая традиция', description: 'Описание нашей новой традиции', established_year: 2001 })
  })
  it('preserves draft on 422 and renders field error', async () => {
    vi.stubGlobal('useId', useId)
    const w = mount(TraditionMetadataForm, { props: { initial: tradition, editing: true }, global })
    await w.get('input[type="text"]').setValue('Изменённое название')
    await w.setProps({ error: new ApiError(422, 'VALIDATION_FAILED', 'Проверьте данные', [{ field: 'title', message: 'Название отклонено сервером' }]) })
    expect((w.get('input[type="text"]').element as HTMLInputElement).value).toBe('Изменённое название')
    expect(w.text()).toContain('Название отклонено сервером')
  })
  it('does not submit a disabled pending form', async () => {
    vi.stubGlobal('useId', useId)
    const w = mount(TraditionMetadataForm, { props: { initial: tradition, pending: true }, global })
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.get('textarea').attributes('disabled')).toBeDefined()
  })
  it('keeps create/edit validation differences from real Laravel', () => {
    const input = { title: 'Традиция', description: 'Достаточное описание', established_year: 2099 }
    expect(metadataIssues(input, false, 2026)).toEqual({})
    expect(metadataIssues(input, true, 2026).established_year).toBeTruthy()
    expect(metadataIssues({ ...input, established_year: 1799 }, false).established_year).toBeTruthy()
  })
  it('validates consecutive annual year and existing duplicate', () => {
    expect(annualYearIssue('2026/2027', [])).toBeTruthy()
    expect(annualYearIssue('2026-2028', [])).toBeTruthy()
    expect(annualYearIssue('2026-2027', ['2026-2027'])).toContain('уже существует')
    expect(annualYearIssue('2027-2028', ['2026-2027'])).toBe('')
    expect(suggestedAnnualYear(tradition.versions, new Date('2026-10-25'))).toBe('2027-2028')
  })
  it('creates independent snapshot without altering past versions', async () => {
    vi.stubGlobal('useId', useId)
    const original = JSON.stringify(tradition)
    const w = mount(AnnualVersionForm, { props: { tradition }, global })
    await w.get('form').trigger('submit')
    const emitted = w.emitted('submit')?.[0]?.[0]
    expect(emitted).toMatchObject({ academic_year: '2027-2028', parameters_snapshot: { concept: { title: tradition.title }, planned_date: null, participants: null } })
    expect(JSON.stringify(tradition)).toBe(original)
  })
  it('shows server annual conflict without losing input', () => {
    vi.stubGlobal('useId', useId)
    const w = mount(AnnualVersionForm, { props: { tradition, error: new ApiError(422, 'TRADITION_VERSION_ALREADY_EXISTS', 'Версия уже существует', [{ field: 'academic_year', message: 'Выберите другой учебный год' }]) }, global })
    expect(w.text()).toContain('Выберите другой учебный год')
  })
  it('parses real archive and complete history; rejects malformed history', () => {
    expect(parseTraditions({ data: [tradition] })[0]?.is_archived).toBe(false)
    expect(parseTradition({ data: tradition }, 'a').created_by_user_id).toBe('author')
    expect(() => parseTradition({ data: tradition }, 'b')).toThrow('другой школе')
    expect(() => parseTraditions({ data: [{ ...tradition, versions: undefined }] })).toThrow()
    expect(() => parseTraditions({ data: [{ ...tradition, is_archived: undefined }] })).toThrow()
  })
  it('normalizes archive URL filter', () => {
    expect(readTraditionFilter('all')).toBe('all'); expect(readTraditionFilter('true')).toBe('true')
    expect(readTraditionFilter(['true'])).toBe('false'); expect(readTraditionFilter('unsafe')).toBe('false')
  })
  it('preserves legacy array snapshots without treating them as editable metadata', () => {
    const parsed = parseTradition({ data: { ...tradition, versions: [{ ...tradition.versions[0], parameters_snapshot: ['legacy', { title: 'Историческая концепция' }] }] } }, 'a')
    expect(parsed.versions[0]?.parameters_snapshot).toEqual(['legacy', { title: 'Историческая концепция' }])
  })
  it('sends real is_archived query and typed create/version payloads', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'created' } }), { status: 201 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'version' } }), { status: 201 }))
    const api = createApiClient({ origin: 'http://localhost:8001', getSchoolId: () => 'a', getCookie: () => 'XSRF-TOKEN=token', fetch: fetcher })
    await api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId: 'a' }, query: { is_archived: 'all' } })
    expect(fetcher.mock.calls[0]?.[0]).toContain('is_archived=all')
    const created = await api.request('post', '/schools/{schoolId}/traditions', { params: { schoolId: 'a' }, body: { title: 'Название', description: 'Достаточное описание' } })
    expect(created.data.id).toBe('created')
    await api.request('post', '/traditions/{id}/versions', { params: { id: 'created' }, body: { academic_year: '2027-2028', parameters_snapshot: { concept: { title: 'Название' } }, notes: null } })
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body)).parameters_snapshot.concept.title).toBe('Название')
  })
  it('blocks foreign school path before the transport is called', async () => {
    const request = vi.fn()
    vi.stubGlobal('useApi', () => ({ request })); vi.stubGlobal('useAuthStore', () => ({ authenticated: true, tenant: { school_id: 'a' } }))
    const service = useTraditionsApi(), signal = new AbortController().signal
    await expect(service.create('b', { title: 'Название', description: 'Описание традиции', established_year: null }, signal)).rejects.toMatchObject({ status: 403 })
    expect(request).not.toHaveBeenCalled()
  })
})

describe('FE-004 mutation safety', () => {
  it('ignores duplicate submit while first request is running', async () => {
    const m = createContextMutation(() => 'a'), work = vi.fn<() => Promise<string>>()
    let finish: (value: string) => void = () => {}
    work.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const first = m.run(work)
    expect(await m.run(work)).toEqual({ ok: false })
    expect(work).toHaveBeenCalledOnce(); finish('saved')
    expect(await first).toEqual({ ok: true, data: 'saved' })
  })
  it('aborts school A mutation and ignores its late success in B', async () => {
    let school = 'a', finish: (value: string) => void = () => {}, signal: AbortSignal | undefined
    const m = createContextMutation(() => school)
    const request = m.run(s => { signal = s; return new Promise<string>(resolve => { finish = resolve }) })
    school = 'b'; m.reset(); finish('private A')
    expect(signal?.aborted).toBe(true); expect(await request).toEqual({ ok: false })
    expect(m.error.value).toBeNull()
  })
  it('does not surface old 403/422 after context reset', async () => {
    let reject: (error: Error) => void = () => {}
    const m = createContextMutation(() => 'a')
    const request = m.run(() => new Promise((_, no) => { reject = no }))
    m.reset(); reject(new ApiError(403, 'DENIED', 'Old error'))
    await request; expect(m.error.value).toBeNull()
  })
  it('preserves duplicate-year server error for the form', async () => {
    const m = createContextMutation(() => 'a')
    await m.run(async () => { throw new ApiError(422, 'TRADITION_VERSION_ALREADY_EXISTS', 'Уже существует', [{ field: 'academic_year', message: 'Версия уже создана' }]) })
    expect(m.error.value?.field('academic_year')).toBe('Версия уже создана')
    expect(m.pending.value).toBe(false)
  })
})
