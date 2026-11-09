import { afterEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import Register from '../app/pages/register.vue'
import LoginForm from '../app/components/features/auth/LoginForm.vue'
import Navigation from '../app/components/layout/AppNavigation.vue'
import Invitations from '../app/pages/invitations.vue'
import UiField from '../app/components/ui/UiField.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import { ApiError } from '../app/utils/api-error'
import { teacherField, teacherText, qualityAdvice } from '../app/utils/teacher-language'

const Link = vue.defineComponent({ props: ['to'], setup: (p, { slots }) => () => vue.h('a', { href: typeof p.to === 'string' ? p.to : p.to?.path }, slots.default?.()) })
const global = { components: { UiField, UiButton, UiAlert, NuxtLink: Link }, stubs: { UiBadge: { template: '<span><slot /></span>' }, UiModal: { template: '<div><slot /></div>' } } }
function setup() {
  for (const [key, value] of Object.entries(vue)) vi.stubGlobal(key, value)
  vi.stubGlobal('definePageMeta', vi.fn()); vi.stubGlobal('useHead', vi.fn()); vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useRoute', () => ({ path: '/register', query: {} }))
  const request = vi.fn().mockResolvedValue({ data: { registered: true } })
  vi.stubGlobal('useApi', () => ({ request }))
  return request
}
async function fill(w: ReturnType<typeof mount>, confirm = 'ExamplePassword2026!') {
  await w.get('input[name=invitation_code]').setValue('a'.repeat(64)); await w.get('input[name=name]').setValue('Педагог проверки')
  await w.get('input[name=email]').setValue('teacher@example.test'); await w.get('input[name=password]').setValue('ExamplePassword2026!'); await w.get('input[name=password_confirmation]').setValue(confirm)
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('UX001 invitation registration', () => {
  it('registers teacher without client-controlled school/role and clears credentials', async () => {
    const request = setup(); const w = mount(Register, { global }); expect(w.get('form').attributes('method')).toBe('post'); await fill(w); await w.get('form').trigger('submit'); await flushPromises()
    expect(request).toHaveBeenCalledTimes(1); expect(request.mock.calls[0]![1]).toBe('/auth/register')
    const body = request.mock.calls[0]![2].body; expect(body).not.toHaveProperty('school_id'); expect(body).not.toHaveProperty('role')
    expect(w.text()).toContain('Вы зарегистрированы'); expect(w.find('input[type=password]').exists()).toBe(false); w.unmount()
  })
  it('rejects password mismatch beside the confirmation without sending a request', async () => {
    const request = setup(); const w = mount(Register, { global }); await fill(w, 'Mismatch2026!'); await w.get('form').trigger('submit')
    expect(request).not.toHaveBeenCalled(); expect(w.get('input[name=password_confirmation]').attributes('aria-invalid')).toBe('true'); expect(w.text()).toContain('Повторите тот же пароль.'); w.unmount()
  })
  it.each([422, 409, 429])('keeps entered fields and gives an action on registration HTTP %s', async status => {
    const request = setup(); request.mockRejectedValue(new ApiError(status, 'INVITATION_INVALID', 'Попросите администратора выдать новое приглашение.'))
    const w = mount(Register, { global }); await fill(w); await w.get('form').trigger('submit'); await flushPromises()
    expect(w.text()).toContain('Попросите администратора'); expect((w.get('input[name=email]').element as HTMLInputElement).value).toBe('teacher@example.test'); expect(request).toHaveBeenCalledTimes(1); w.unmount()
  })
  it('does not show invitation management to a teacher', () => {
    const request = setup(); vi.stubGlobal('useAuthStore', () => ({ systemRole: 'none', tenant: { school_id: 'a', role: 'teacher' } }))
    const w = mount(Invitations, { global }); expect(w.text()).toContain('администратор вашей школы'); expect(w.find('form').exists()).toBe(false); expect(request).not.toHaveBeenCalled(); w.unmount()
  })
  it('preserves creation errors while refreshing invitation history', async () => {
    const request = setup(); request.mockImplementation((method: string) => method === 'get' ? Promise.resolve({ data: { items: [], last_page: 1 } }) : Promise.reject(new ApiError(422, 'INVALID', 'Проверьте почту педагога.')))
    vi.stubGlobal('useAuthStore', () => ({ systemRole: 'none', tenant: { school_id: 'a', school_name: 'Школа', role: 'school_admin' } }))
    const w = mount(Invitations, { global }); await flushPromises(); await w.get('form').trigger('submit'); await flushPromises(); expect(w.text()).toContain('Проверьте почту педагога.'); w.unmount()
  })
  it('uses the school explicitly opened by a system administrator with another active membership', async () => {
    const request = setup(); request.mockResolvedValue({ data: { items: [], last_page: 1 } })
    vi.stubGlobal('useRoute', () => ({ query: { school: 'selected-school' } }))
    vi.stubGlobal('useAuthStore', () => ({ systemRole: 'system_admin', tenant: { school_id: 'active-school', school_name: 'Другая школа', role: 'teacher' } }))
    const w = mount(Invitations, { global }); await flushPromises()
    expect(request.mock.calls[0]![2].params.schoolId).toBe('selected-school')
    expect(w.text()).not.toContain('Другая школа'); w.unmount()
  })
  it('clears a one-time code and invitation list when administrative rights are lost', async () => {
    const request = setup(); request.mockImplementation((method: string) => Promise.resolve({ data: method === 'get' ? { items: [], last_page: 1 } : { code: 'private-invitation-code' } }))
    const auth = vue.reactive({ user: { id: 'admin' }, systemRole: 'none', tenant: { school_id: 'a', role: 'school_admin' } })
    vi.stubGlobal('useAuthStore', () => auth)
    const w = mount(Invitations, { global }); await flushPromises(); await w.get('form').trigger('submit'); await flushPromises()
    expect(w.text()).toContain('private-invitation-code')
    auth.tenant.role = 'teacher'; await flushPromises()
    expect(w.text()).not.toContain('private-invitation-code'); expect(w.find('form').exists()).toBe(false)
    auth.tenant.role = 'school_admin'; await flushPromises()
    expect(w.text()).not.toContain('private-invitation-code'); w.unmount()
  })
})
describe('UX001 teacher language and entry points', () => {
  it('translates dot and bracket paths, including one-based card numbers', () => {
    expect(teacherField('$.materials.printable_cards[0].back_text')).toBe('Материалы — Карточка задания № 1 — Ответ и пояснение педагогу')
    expect(teacherField('stages.2.teacher_actions')).toBe('Этап № 3 — Действия педагога')
    expect(teacherText('Уточните $.materials.printable_cards.0.front_text')).not.toContain('$.')
    expect(qualityAdvice('$.materials.printable_cards.0', 'Нужны содержательные условия и проверяемый ответ')).toContain('правильный ответ для педагога')
  })
  it('shows working remember option and registration without dead demo login', async () => {
    setup(); const auth = { busy: false, login: vi.fn().mockResolvedValue(undefined), needsSchool: false, tenant: { school_id: 'a' } }
    vi.stubGlobal('useAuthStore', () => auth); vi.stubGlobal('useNotificationsStore', () => ({ clear: vi.fn() }))
    const w = mount(LoginForm, { global }); expect(w.get('form').attributes('method')).toBe('post'); expect(w.text()).not.toContain('Войти в деморежим'); expect(w.get('a[href="/register"]').text()).toContain('приглашение')
    await w.get('input[type=email]').setValue('t@example.test'); await w.get('input[name=password]').setValue('ExamplePassword2026!'); await w.get('input[type=checkbox]').setValue(true); await w.get('form').trigger('submit'); await flushPromises()
    expect(auth.login).toHaveBeenCalledWith({ email: 't@example.test', password: 'ExamplePassword2026!', remember: true }); w.unmount()
  })
  it('groups research and does not grant administrative navigation to a teacher', () => {
    setup(); vi.stubGlobal('useAuthStore', () => ({ systemRole: 'none' })); const w = mount(Navigation, { global })
    expect(w.get('a[href="/research"]').text()).toBe('Исследования и сравнения'); expect(w.find('a[href="/pilot"]').exists()).toBe(false); expect(w.find('a[href="/system"]').exists()).toBe(false); expect(w.get('a[href="/constructor"]').text()).toBe('Создать мероприятие'); w.unmount()
  })
})
