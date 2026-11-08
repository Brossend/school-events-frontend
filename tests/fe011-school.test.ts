import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { SchoolAccessContext, SchoolOperationOverrides, SchoolProfile, SchoolProfileInput } from '../app/types/school'
import { parseSchoolProfile, schoolAllowedInput, schoolContextKey, schoolCriticalChanges, schoolDate, schoolDraft, schoolInputIssues, schoolPatch, schoolPermissions } from '../app/utils/school'
import { createSchoolController } from '../app/utils/school-controller'
import { ApiError } from '../app/utils/api-error'
import { useSchoolProfileApi } from '../app/composables/useSchoolProfileApi'
import SchoolProfileWorkspace from '../app/components/features/school/SchoolProfileWorkspace.vue'

const id = '019a0000-0000-7000-8000-000000000001', other = '019a0000-0000-7000-8000-000000000002'
function profile(overrides: Partial<SchoolProfile> = {}): SchoolProfile { return { id, name: 'Школа № 1', short_name: null, region_code: '66', city: 'Екатеринбург', inn: null, settings: { address: 'Улица, 1', unknown: { preserve: true } }, traditions_count: 0, active_teachers_count: 7, created_at: '2026-10-20T10:00:00+00:00', updated_at: null, ...overrides } }
function access(overrides: Partial<SchoolAccessContext> = {}): SchoolAccessContext { return { userId: 'user-1', authenticated: true, active: true, systemRole: 'none', schoolId: id, schoolRole: 'school_admin', targetId: id, ...overrides } }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function setup() {
  let c = access(), server = profile()
  const get = vi.fn(async () => structuredClone(server)), update = vi.fn(async (_id: string, body: SchoolProfileInput) => { server = { ...server, ...body, settings: { ...server.settings, ...body.settings } }; return structuredClone(server) })
  const api = { context: () => schoolContextKey(c), permissions: () => schoolPermissions(c), get, update }
  const state = createSchoolController(api, () => c.targetId)
  return { state, api, get, update, setContext: (value: SchoolAccessContext) => { c = value }, setServer: (value: SchoolProfile) => { server = value } }
}
afterEach(() => vi.unstubAllGlobals())

describe('FE011 actual school profile DTO and supported settings', () => {
  it('exports corrected request and envelope types for shared API integration', () => {
    const body: SchoolOperationOverrides['/schools/{id}']['patch']['requestBody']['content']['application/json'] = { inn: null, short_name: null, settings: { address: null, website: 'plain server-supported text' } }
    const response: SchoolOperationOverrides['/schools/{id}']['get']['responses'][200]['content']['application/json'] = { data: profile() }
    expect(body.inn).toBeNull(); expect(response.data.traditions_count).toBe(0)
  })
  it('preserves real zero counts, null dates and unknown settings', () => {
    const p = parseSchoolProfile({ data: profile() }, id)
    expect(p.active_teachers_count).toBe(7); expect(p.traditions_count).toBe(0); expect(p.updated_at).toBeNull()
    expect(p.settings.unknown).toEqual({ preserve: true }); expect(schoolDate(null)).toBe('Не указана')
  })
  it('accepts PHP empty settings arrays', () => { expect(parseSchoolProfile({ data: { ...profile(), settings: [] } }).settings).toEqual({}) })
  it.each([{ traditions_count: -1 }, { active_teachers_count: 1.5 }, { created_at: 'bad' }, { settings: [1] }, { name: undefined }, { short_name: undefined }])('rejects malformed DTO %s', change => { expect(() => parseSchoolProfile({ data: { ...profile(), ...change } })).toThrow('Некорректный ответ API') })
  it('rejects a response for a different target school', () => { expect(() => parseSchoolProfile({ data: profile() }, other)).toThrow() })
  it('sends only changed supported settings so server merge preserves unknown values', () => {
    const p = profile(), d = schoolDraft(p); d.settings.phone = '+7 123'; d.settings.address = ''; (d.settings as Record<string, string>).unknown = 'bad'
    expect(schoolPatch(p, d)).toEqual({ settings: { address: null, phone: '+7 123' } })
    expect(p.settings.unknown).toEqual({ preserve: true })
  })
  it('keeps untouched unrecognized typed values out of PATCH', () => {
    const p = profile({ settings: { phone: { legacy: true }, unknown: 123 } }), d = schoolDraft(p)
    d.city = 'Пермь'; expect(schoolPatch(p, d)).toEqual({ city: 'Пермь' })
  })
  it('filters untyped runtime extras from the outgoing write boundary', () => {
    const untrusted = { name: 'Школа', region_code: '77', active_teachers_count: 900, settings: { address: null, unknown: 'delete history', notifications: true } }
    expect(schoolAllowedInput(untrusted)).toEqual({ name: 'Школа', settings: { address: null } })
  })
  it('validates exact FormRequest limits without imposing URL semantics on website', () => {
    expect(schoolInputIssues({ name: 'ШКЛ', city: 'Ек', inn: '1234567890', settings: { website: 'any string' } })).toEqual({})
    expect(schoolInputIssues({ name: 'xx', city: 'x', inn: '123', short_name: 'x'.repeat(101), settings: { email: 'bad', description: 'x'.repeat(1001), phone: 'x'.repeat(51), address: 'x'.repeat(256), website: 'x'.repeat(256) } })).toHaveProperty('settings.email')
    expect(Object.keys(schoolInputIssues({ name: 'xx', city: 'x', inn: '123', short_name: 'x'.repeat(101), settings: { email: 'bad', description: 'x'.repeat(1001), phone: 'x'.repeat(51), address: 'x'.repeat(256), website: 'x'.repeat(256) } }))).toHaveLength(9)
    expect(schoolInputIssues({ inn: null, short_name: null, settings: { email: null } })).toEqual({})
  })
  it('requires confirmation for identity changes, not contact-only updates', () => { expect(schoolCriticalChanges({ name: 'Школа', inn: null, city: 'Город', settings: { phone: '123' } })).toEqual(['name', 'city', 'inn']); expect(schoolCriticalChanges({ settings: { email: null } })).toEqual([]) })
})

describe('FE011 school authorization boundary', () => {
  it('permits teacher read only and own-school admin writes', () => { expect(schoolPermissions(access({ schoolRole: 'teacher' }))).toEqual({ read: true, edit: false }); expect(schoolPermissions(access())).toEqual({ read: true, edit: true }) })
  it('does not use role from a different school or region', () => { expect(schoolPermissions(access({ targetId: other }))).toEqual({ read: false, edit: false }); expect(schoolPermissions(access({ schoolId: undefined, schoolRole: undefined, systemRole: 'catalog_curator' }))).toEqual({ read: false, edit: false }) })
  it('supports system admin without school membership', () => { expect(schoolPermissions(access({ schoolId: undefined, schoolRole: undefined, systemRole: 'system_admin' }))).toEqual({ read: true, edit: true }) })
  it.each([{ authenticated: false }, { active: false }, { targetId: 'not-uuid' }])('fails closed for invalid context %s', value => { expect(schoolPermissions(access({ ...value, systemRole: 'system_admin' }))).toEqual({ read: false, edit: false }) })
  it('context includes principal, role, tenant and explicit target', () => { const initial = schoolContextKey(access()); for (const change of [{ userId: 'other' }, { schoolId: other }, { schoolRole: 'teacher' }, { systemRole: 'system_admin' }, { targetId: other }]) expect(schoolContextKey(access(change))).not.toBe(initial) })
})

describe('FE011 safe school mutation lifecycle', () => {
  it('initializes draft and performs preflight GET / one PATCH / refresh GET', async () => {
    const { state, get, update } = setup(); await state.load(); state.draft.value!.name = 'Новая школа'; state.prepare()
    expect(update).not.toHaveBeenCalled(); expect(state.confirmation.value?.body).toEqual({ name: 'Новая школа' })
    await state.confirm(); expect(update).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(3); expect(state.profile.value?.name).toBe('Новая школа'); expect(state.notice.value).toContain('сохранены')
  })
  it('preserves input and maps Laravel 422 field errors', async () => {
    const { state, update } = setup(); await state.load(); state.draft.value!.settings.email = 'draft@example.org'
    update.mockRejectedValueOnce(new ApiError(422, 'VALIDATION', 'Ошибка', [{ field: 'settings.email', message: 'Отклонено сервером' }]))
    state.prepare(); await flushPromises(); expect(state.draft.value?.settings.email).toBe('draft@example.org'); expect(state.issues.value['settings.email']).toBe('Отклонено сервером'); expect(state.uncertain.value).toBe(false)
  })
  it('blocks local validation before dispatch', async () => { const { state, update } = setup(); await state.load(); state.draft.value!.name = 'x'; state.prepare(); expect(state.issues.value.name).toBeTruthy(); expect(update).not.toHaveBeenCalled() })
  it('rejects editing for a teacher even through controller actions', async () => { const { state, update, setContext } = setup(); setContext(access({ schoolRole: 'teacher' })); await state.load(); state.draft.value!.name = 'Другая школа'; state.prepare(); await state.confirm(); expect(update).not.toHaveBeenCalled() })
  it('blocks double submission while preflight is pending', async () => {
    const { state, get, update } = setup(); await state.load(); const gate = deferred<SchoolProfile>(); get.mockReturnValueOnce(gate.promise)
    state.draft.value!.settings.phone = '123'; state.prepare(); state.prepare(); expect(state.pending.value).toBe(true)
    gate.resolve(profile()); await flushPromises(); expect(update).toHaveBeenCalledTimes(1)
  })
  it('preflight detects concurrent server changes and preserves draft for reapproval', async () => {
    const { state, setServer, update } = setup(); await state.load(); state.draft.value!.name = 'Новая школа'; state.prepare(); setServer(profile({ name: 'Изменение другого администратора' })); await state.confirm()
    expect(update).not.toHaveBeenCalled(); expect(state.profile.value?.name).toBe('Изменение другого администратора'); expect(state.draft.value?.name).toBe('Новая школа'); expect((state.error.value as ApiError).status).toBe(409)
  })
  it('does not authorize a changed draft with stale modal confirmation', async () => { const { state, update } = setup(); await state.load(); state.draft.value!.name = 'Первое изменение'; state.prepare(); state.draft.value!.name = 'Другое изменение'; await state.confirm(); expect(update).not.toHaveBeenCalled() })
  it('context switch during preflight prevents PATCH and late response restoration', async () => {
    const { state, get, update, setContext } = setup(); await state.load(); const gate = deferred<SchoolProfile>(); get.mockReturnValueOnce(gate.promise)
    state.draft.value!.settings.phone = '123'; state.prepare(); setContext(access({ schoolId: other, targetId: other })); state.reset(); gate.resolve(profile()); await flushPromises()
    expect(update).not.toHaveBeenCalled(); expect(state.profile.value).toBeNull(); expect(state.draft.value).toBeNull()
  })
  it('ignores delayed initial read after principal change', async () => { const { state, get, setContext } = setup(); const gate = deferred<SchoolProfile>(); get.mockReturnValueOnce(gate.promise); const read = state.load(); setContext(access({ userId: 'other' })); state.reset(); gate.resolve(profile()); await read; expect(state.profile.value).toBeNull() })
  it.each([0, 408, 500])('reconciles unknown PATCH status %s with GET and never repeats PATCH', async status => {
    const { state, update, get } = setup(); await state.load(); state.draft.value!.settings.phone = '123'; update.mockRejectedValueOnce(new ApiError(status, 'LOST', 'Lost'))
    state.prepare(); await flushPromises(); expect(state.uncertain.value).toBe(true); expect(get).toHaveBeenCalledTimes(3); state.prepare(); await flushPromises(); expect(update).toHaveBeenCalledTimes(1); expect(state.draft.value?.settings.phone).toBe('123')
    await state.load(true); expect(state.uncertain.value).toBe(false); expect(state.draft.value?.settings.phone).toBe('123'); expect(update).toHaveBeenCalledTimes(1)
  })
  it('keeps uncertain write blocked when GET reconciliation fails', async () => {
    const { state, get, update } = setup(); await state.load(); state.draft.value!.name = 'Новая школа'; state.prepare(); get.mockResolvedValueOnce(profile()).mockRejectedValue(new Error('offline')); update.mockRejectedValueOnce(new Error('offline')); await state.confirm(); await state.load(true)
    expect(state.uncertain.value).toBe(true); expect(state.draft.value?.name).toBe('Новая школа'); expect(update).toHaveBeenCalledTimes(1)
  })
  it.each([401, 403, 404, 409, 422])('preserves draft on known rejection %s', async status => { const { state, update } = setup(); await state.load(); state.draft.value!.name = 'Новая школа'; state.prepare(); update.mockRejectedValueOnce(new ApiError(status, 'REJECTED', 'Отказ')); await state.confirm(); expect(state.draft.value?.name).toBe('Новая школа'); expect(state.error.value).toBeTruthy(); expect(state.uncertain.value).toBe(false) })
  it('blocks writing when success refresh fails and permits GET-only recovery', async () => {
    const { state, get, update } = setup(); await state.load(); state.draft.value!.name = 'Новая школа'; state.prepare(); get.mockResolvedValueOnce(profile()).mockRejectedValueOnce(new Error('refresh failed')); await state.confirm()
    expect(state.needsReconcile.value).toBe(true); expect(state.uncertain.value).toBe(false); state.prepare(); expect(update).toHaveBeenCalledTimes(1); await state.load(true); expect(state.needsReconcile.value).toBe(false); expect(state.profile.value?.name).toBe('Новая школа')
  })
})

describe('FE011 composable and visible profile', () => {
  it('system access uses actual school path without requiring tenant headers', async () => {
    const request = vi.fn(async () => ({ data: profile() }))
    vi.stubGlobal('useApi', () => ({ request })); vi.stubGlobal('useAuthStore', () => ({ authenticated: true, user: { id: 'admin' }, systemRole: 'system_admin', tenant: null }))
    const api = useSchoolProfileApi(() => id); await api.get(id, new AbortController().signal); await api.update(id, { inn: null, settings: { address: null } }, new AbortController().signal)
    expect(request.mock.calls[0]).toMatchObject(['get', '/schools/{id}', { params: { id }, tenant: false }]); expect(request.mock.calls[1]).toMatchObject(['patch', '/schools/{id}', { tenant: false, body: { inn: null, settings: { address: null } } }])
  })
  it('composable blocks foreign-school writes before network dispatch', async () => {
    const request = vi.fn(); vi.stubGlobal('useApi', () => ({ request })); vi.stubGlobal('useAuthStore', () => ({ authenticated: true, user: { id: 'teacher' }, systemRole: 'none', tenant: { school_id: other, role: 'school_admin' } }))
    const api = useSchoolProfileApi(() => id); await expect(api.update(id, { name: 'Новая школа' }, new AbortController().signal)).rejects.toMatchObject({ status: 403 }); expect(request).not.toHaveBeenCalled()
  })
  it('renders server counts, timestamps and read-only teacher fields; tenant change clears data', async () => {
    const auth = reactive({ authenticated: true, user: { id: 'teacher', name: 'Педагог' }, systemRole: 'none', tenant: { school_id: id, role: 'teacher' } })
    const get = vi.fn(async () => profile()), api = { get, update: vi.fn(), permissions: () => schoolPermissions(access({ userId: auth.user.id, schoolRole: auth.tenant.role, schoolId: auth.tenant.school_id, targetId: auth.tenant.school_id })), context: () => JSON.stringify(auth) }
    vi.stubGlobal('useAuthStore', () => auth); vi.stubGlobal('useSchoolProfileApi', () => api); vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiOrigin: 'http://localhost:8001' } }))
    const wrapper = mount(SchoolProfileWorkspace, { global: { stubs: { UiCard: { template: '<section><slot /></section>' }, UiButton: { template: '<button><slot /></button>' }, UiField: { props: ['modelValue', 'disabled', 'label'], template: '<label>{{ label }}<input :value="modelValue" :disabled="disabled"></label>' }, UiTextarea: true, UiAlert: { template: '<div><slot /></div>' }, UiState: true, UiModal: true, NuxtLink: { template: '<a><slot /></a>' } } } })
    await flushPromises(); expect(wrapper.text()).toContain('Активные педагоги7'); expect(wrapper.text()).toContain('Действующие традиции0'); expect(wrapper.text()).toContain(schoolDate(profile().created_at)); expect(wrapper.text()).not.toContain('Сохранить изменения'); expect(wrapper.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    const gate = deferred<SchoolProfile>(); get.mockReturnValueOnce(gate.promise); auth.tenant.school_id = other; expect(wrapper.vm).toBeTruthy(); await flushPromises(); expect(wrapper.text()).not.toContain('Активные педагоги7'); wrapper.unmount(); gate.resolve(profile({ id: other })); await flushPromises()
  })
})
