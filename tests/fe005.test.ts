import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as vue from 'vue'
import Constructor from '../app/pages/constructor.vue'
import UiField from '../app/components/ui/UiField.vue'
import UiTextarea from '../app/components/ui/UiTextarea.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import { allowedVersion, directions, formats, newDraft, scales, scenarioBody, validateDraft, type ConstructorDraft } from '../app/utils/scenario-constructor'
import { createScenarioSave } from '../app/utils/scenario-save'
import { createLatestResource } from '../app/utils/latest-resource'
import { ApiError } from '../app/utils/api-error'
function valid(): ConstructorDraft { return { ...newDraft(), occasion: { kind: 'custom', title: 'День добрых дел' }, grades: [5], count: '25', duration: '45', scale: 'class_level', format: 'class_hour', direction: 'mutual_aid' } }
function storage() { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) }, removeItem: (k: string) => { map.delete(k) } } }
afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.clear() })
describe('FE005 canonical DTO and validation', () => {
  it.each(['custom', 'calendar', 'tradition'] as const)('sends exactly one %s occasion and whitelists fields', kind => { const d = valid(); d.occasion = kind === 'custom' ? { kind, title: 'Своё событие' } : { kind, id: 'server-id', title: 'Название' }; const body = scenarioBody(d); expect(['custom_event_title', 'calendar_event_id', 'tradition_version_id'].filter(k => k in body)).toHaveLength(1); expect(body).not.toHaveProperty('school_id'); expect(body).not.toHaveProperty('occasion'); expect(body.target_grades).toEqual([5]) })
  it('validates all required fields without invented defaults', () => { expect(Object.keys(validateDraft(newDraft()))).toEqual(['occasion', 'target_grades', 'participants_count', 'duration_minutes', 'scale', 'format_type', 'value_direction']); expect(() => scenarioBody(newDraft())).toThrow() })
  it.each([['5', '20', true], ['500', '240', true], ['4', '20', false], ['501', '20', false], ['5', '19', false], ['5', '241', false], ['5.5', '45', false], ['25', '', false]])('checks count=%s duration=%s', (count, duration, ok) => { const d = { ...valid(), count, duration }; expect(Object.keys(validateDraft(d)).length === 0).toBe(ok) })
  it.each(Object.keys(scales) as (keyof typeof scales)[])('accepts scale %s', scale => { expect(scenarioBody({ ...valid(), scale }).scale).toBe(scale) })
  it.each(Object.keys(formats) as (keyof typeof formats)[])('accepts format %s', format => { expect(scenarioBody({ ...valid(), format }).format_type).toBe(format) })
  it.each(Object.keys(directions) as (keyof typeof directions)[])('accepts direction %s', direction => { expect(scenarioBody({ ...valid(), direction }).value_direction).toBe(direction) })
  it('rejects arbitrary foreign tradition and accepts only current-school allowlist', () => { const list = [{ title: 'A', versions: [{ id: 'a', academic_year: '2026-2027' }] }]; expect(allowedVersion('b', list)).toBeNull(); expect(allowedVersion('a', list)?.kind).toBe('tradition') })
  it('validates title, grades, resources, constraints boundaries', () => { const d = valid(); d.occasion = { kind: 'custom', title: 'ab' }; d.grades = [12]; d.customResources = 'x'.repeat(256); d.constraints = 'x'.repeat(1001); expect(Object.keys(validateDraft(d))).toEqual(['occasion', 'target_grades', 'available_resources', 'pedagogical_constraints']); d.occasion.title = 'x'.repeat(255); d.grades = [1, 11]; d.customResources = 'x'.repeat(255); d.constraints = 'x'.repeat(1000); expect(validateDraft(d)).toEqual({}) })
})
describe('FE005 conservative mutation', () => {
  it('keeps a confirmed server ID when saving its receipt fails, without another POST', async () => { const store = storage(); let writes = 0; const save = createScenarioSave(() => 'u:a', { ...store, setItem(k, v) { if (++writes > 1) throw new Error('Storage unavailable'); store.setItem(k, v) } }); const post = vi.fn().mockResolvedValue('confirmed-id'); await save.save(post); await save.save(post); expect(save.receipt.value).toEqual({ state: 'saved', id: 'confirmed-id' }); expect(post).toHaveBeenCalledTimes(1); const reload = createScenarioSave(() => 'u:a', store); reload.reset(); expect(reload.receipt.value?.state).toBe('uncertain') })
  it('blocks double submit and preserves saved receipt across remount', async () => { const store = storage(), save = createScenarioSave(() => 'u:a', store); let resolve!: (id: string) => void; const post = vi.fn(() => new Promise<string>(r => { resolve = r })); const first = save.save(post); await save.save(post); expect(post).toHaveBeenCalledTimes(1); resolve('id'); await first; const remount = createScenarioSave(() => 'u:a', store); remount.reset(); expect(remount.receipt.value).toEqual({ state: 'saved', id: 'id' }); await remount.save(post); expect(post).toHaveBeenCalledTimes(1) })
  it.each([0, 500, 502])('never automatically retries ambiguous %s', async status => { const store = storage(), save = createScenarioSave(() => 'u:a', store); const post = vi.fn().mockRejectedValue(new ApiError(status, 'ERROR', 'Ошибка')); await save.save(post); await save.save(post); const remount = createScenarioSave(() => 'u:a', store); remount.reset(); await remount.save(post); expect(post).toHaveBeenCalledTimes(1); expect(remount.receipt.value?.state).toBe('uncertain') })
  it.each([401, 403, 404, 409, 419, 422])('preserves draft for definite %s', async status => { const draft = valid(), save = createScenarioSave(() => 'u:a', storage()); await save.save(async () => { throw new ApiError(status, 'VALIDATION', 'Ошибка', [{ field: 'participants_count', message: 'Численность' }]) }); expect(save.receipt.value).toBeNull(); expect(draft).toEqual(valid()); expect(save.error.value?.status).toBe(status) })
  it('aborts school change and ignores stale success while retaining old receipt', async () => { let ctx = 'u:a', signal!: AbortSignal, resolve!: (id: string) => void; const store = storage(), save = createScenarioSave(() => ctx, store); const first = save.save(s => { signal = s; return new Promise<string>(r => { resolve = r }) }); ctx = 'u:b'; save.reset(); expect(signal.aborted).toBe(true); resolve('old'); await first; expect(save.receipt.value).toBeNull(); ctx = 'u:a'; save.reset(); expect(save.receipt.value).toEqual({ state: 'saved', id: 'old' }) })
  it('blocks interrupted sending after reload and fails closed on unavailable storage', async () => { const store = storage(); store.setItem('fe005:receipt:u:a', '{"state":"sending"}'); const save = createScenarioSave(() => 'u:a', store); save.reset(); expect(save.receipt.value?.state).toBe('uncertain'); const bad = createScenarioSave(() => 'x', { ...store, setItem() { throw new Error() } }); const post = vi.fn(); await bad.save(post); expect(post).not.toHaveBeenCalled(); expect(bad.error.value?.code).toBe('RECEIPT_STORAGE') })
  it('clears stale resource responses', async () => { let school = 'a', resolve!: (value: string) => void; const r = createLatestResource(() => new Promise<string>(done => { resolve = done }), () => school); const pending = r.refresh(); school = 'b'; r.reset(); resolve('a-private'); await pending; expect(r.data.value).toBeNull() })
})
describe('FE005 actual wizard', () => {
  it('maps server 422 to its step, retains values and submits only a canonical tenant-free body', async () => {
    for (const [name, fn] of Object.entries(vue)) vi.stubGlobal(name, fn)
    vi.stubGlobal('definePageMeta', () => {}); vi.stubGlobal('useHead', () => {})
    const request = vi.fn().mockRejectedValue(new ApiError(422, 'VALIDATION', 'Проверьте данные', [{ field: 'participants_count', message: 'Серверная ошибка численности' }]))
    vi.stubGlobal('useAuthStore', () => ({ user: { id: 'u' }, tenant: { school_id: 'a', school_name: 'A' } })); vi.stubGlobal('useRoute', () => ({ query: {} })); vi.stubGlobal('useRouter', () => ({ replace: vi.fn() })); vi.stubGlobal('useApi', () => ({ request })); vi.stubGlobal('useTraditionsApi', () => ({ list: vi.fn() })); vi.stubGlobal('useSchoolResource', () => ({ data: vue.ref(null), error: vue.ref(null), pending: vue.ref(false), refresh: vi.fn() }))
    const w = mount(Constructor, { global: { components: { UiField, UiTextarea, UiButton, UiAlert }, stubs: { NuxtLink: true, UiState: true, UiCard: true, UiPagination: true, ScenarioRequestDetails: true } } })
    await w.get('input[type=text]').setValue('Добрые дела'); await w.get('form').trigger('submit')
    await w.get('input[type=checkbox][value="5"]').setValue(true); await w.get('input[inputmode=numeric]').setValue('25'); await w.get('form').trigger('submit')
    await w.get('input[value=class_level]').setValue(true); await w.get('input[value=class_hour]').setValue(true); await w.get('input[inputmode=numeric]').setValue('45'); await w.get('form').trigger('submit')
    await w.get('input[value=mutual_aid]').setValue(true); await w.get('form').trigger('submit'); await w.get('form').trigger('submit'); await flushPromises()
    expect(request).toHaveBeenCalledTimes(1); expect(request.mock.calls[0]![2].schoolId).toBe('a'); expect(request.mock.calls[0]![2].body).not.toHaveProperty('school_id')
    expect(w.text()).toContain('02 / Укажите участников'); expect(w.text()).toContain('Серверная ошибка численности'); expect((w.get('input[inputmode=numeric]').element as HTMLInputElement).value).toBe('25'); w.unmount()
  })
  it('keeps fields on back, shows required errors, clears on user or school change', async () => {
    for (const [name, fn] of Object.entries(vue)) vi.stubGlobal(name, fn)
    vi.stubGlobal('definePageMeta', () => {}); vi.stubGlobal('useHead', () => {})
    const auth = vue.reactive({ user: { id: 'u' }, tenant: { school_id: 'a', school_name: 'A' } })
    vi.stubGlobal('useAuthStore', () => auth); vi.stubGlobal('useRoute', () => ({ query: {} })); vi.stubGlobal('useRouter', () => ({ replace: vi.fn() })); vi.stubGlobal('useApi', () => ({ request: vi.fn() })); vi.stubGlobal('useTraditionsApi', () => ({ list: vi.fn() })); vi.stubGlobal('useSchoolResource', () => ({ data: vue.ref(null), error: vue.ref(null), pending: vue.ref(false), refresh: vi.fn() }))
    const w = mount(Constructor, { global: { components: { UiField, UiTextarea, UiButton, UiAlert }, stubs: { NuxtLink: true, UiState: true, UiCard: true, UiPagination: true, ScenarioRequestDetails: true } } })
    await w.get('form').trigger('submit'); expect(w.text()).toContain('Введите название от 3 до 255 символов.')
    await w.get('input[type=text]').setValue('День добрых дел'); await w.get('form').trigger('submit'); expect(w.text()).toContain('02 / Укажите участников')
    await w.get('input[inputmode=numeric]').setValue('25'); await w.get('input[type=checkbox]').setValue(true); await w.get('form').trigger('submit'); expect(w.text()).toContain('03 / Выберите формат')
    await w.findAll('button').find(b => b.text() === 'Назад')!.trigger('click'); expect((w.get('input[inputmode=numeric]').element as HTMLInputElement).value).toBe('25')
    auth.tenant = { school_id: 'b', school_name: 'B' }; await flushPromises(); expect(w.text()).toContain('01 / Выберите событие'); expect((w.get('input[type=text]').element as HTMLInputElement).value).toBe('')
    await w.get('input[type=text]').setValue('Секрет школы B'); auth.user.id = 'other'; await flushPromises(); expect((w.get('input[type=text]').element as HTMLInputElement).value).toBe(''); w.unmount()
  })
})
