import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import * as vue from 'vue'
import { teacherError, teacherField, teacherText } from '../app/utils/teacher-language'
import RevisionFields from '../app/components/features/scenarios/RevisionFields.vue'
import ScenarioEditFields from '../app/components/features/scenarios/ScenarioEditFields.vue'
import ScenarioJson from '../app/components/features/scenarios/ScenarioJson.vue'
import Constructor from '../app/pages/constructor.vue'
import UiField from '../app/components/ui/UiField.vue'
import UiTextarea from '../app/components/ui/UiTextarea.vue'
import UiSelect from '../app/components/ui/UiSelect.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import { ApiError } from '../app/utils/api-error'
import { editable } from '../app/utils/scenario-editor'
import { editorDoc } from './fixtures/fe007'

const global = { components: { RevisionFields, ScenarioJson, UiField, UiTextarea, UiSelect, UiButton, UiAlert }, stubs: { NuxtLink: true, UiCard: { template: '<div><slot /></div>' }, UiState: true, UiPagination: true, ScenarioRequestDetails: true, GenerationLaunchPanel: true } }
afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.clear() })
function constructor(request = vi.fn()) {
  for (const [name, value] of Object.entries(vue)) vi.stubGlobal(name, value)
  vi.stubGlobal('definePageMeta', vi.fn()); vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('useAuthStore', () => ({ user: { id: 'u' }, tenant: { school_id: 's' } }))
  vi.stubGlobal('useRoute', () => ({ query: {} })); vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))
  vi.stubGlobal('useApi', () => ({ request })); vi.stubGlobal('useTraditionsApi', () => ({ list: vi.fn() }))
  vi.stubGlobal('useSchoolResource', () => ({ data: vue.ref(null), error: vue.ref(null), pending: vue.ref(false), refresh: vi.fn() }))
  return mount(Constructor, { global, attachTo: document.body })
}
describe('UX001 scenario presentation regressions', () => {
  it.each([
    '$.materials.printable_cards[0].back_text',
    "$['materials']['printable_cards'][0]['back_text']",
    'materials.printable_cards[0].back_text',
    'content_payload.materials.printable_cards.0.back_text',
  ])('translates the complete address %s without eating sentence punctuation', path => {
    const text = teacherText('Проверьте ' + path + '. Затем сохраните.')
    expect(text).toContain('Карточка задания № 1 — Ответ и пояснение педагогу. Затем сохраните.')
    expect(text).not.toMatch(/back_text|printable_cards|content_payload/); expect(text).not.toContain(String.fromCharCode(36))
  })
  it('does not rewrite words inside URLs, identifiers, or English prose', () => {
    expect(teacherText('https://school.test/materials.pdf has title and description; my_materials')).toBe('https://school.test/materials.pdf has title and description; my_materials')
    expect(teacherField('constructor')).toBe('Материал сценария')
  })
  it('associates a bracket-path error with the matching editor field and preserves its value', () => {
    const w = mount(RevisionFields, { props: { value: 'Мой ответ', path: 'materials.printable_cards.0.back_text', label: 'Ответ', errors: [{ field: "$.materials.printable_cards[0].back_text", message: 'Заполните materials.printable_cards[0].back_text' }] }, global })
    const input = w.get('textarea'); expect(input.attributes('aria-invalid')).toBe('true')
    expect(w.get('#' + input.attributes('aria-describedby')).text()).toContain('Ответ и пояснение педагогу')
    expect((input.element as HTMLTextAreaElement).value).toBe('Мой ответ'); w.unmount()
    expect(teacherError([{ field: '$.concept', message: 'Уточните concept' }], 'concept')).toContain('Замысел')
  })
  it('keeps stage type selection and exposes its validation message to assistive technology', async () => {
    const w = mount(RevisionFields, { props: { value: 'practical_task', path: 'stages.0.stage_type', label: 'Тип этапа', errors: [{ field: 'stages.0.stage_type', message: 'Укажите stage_type' }] }, global })
    const select = w.get('select'); expect(select.findAll('option')).toHaveLength(6); expect(select.attributes('aria-invalid')).toBe('true')
    expect(w.get('#' + select.attributes('aria-describedby')).text()).toContain('Тип этапа')
    await select.setValue('reflection_summary'); expect(w.emitted('update')?.[0]).toEqual(['reflection_summary']); w.unmount()
  })
  it('preserves stage IDs and links when reordering, including every editable control', async () => {
    const draft = editable(editorDoc()); draft.stages = [{ id: 'stage_a', title: 'Первый', stage_type: 'practical_task', duration_minutes: 5, teacher_actions: 'Обсуждаем' }, { id: 'stage_b', title: 'Второй', stage_type: 'reflection_summary', duration_minutes: 5, teacher_actions: 'Подводим итог' }]
    const w = mount(ScenarioEditFields, { props: { modelValue: draft, section: 'stages' }, global })
    expect(w.findAll('select')).toHaveLength(2); expect(w.findAll('input[type=number]')).toHaveLength(2)
    await w.get('button[aria-label="Этап 1 ниже"]').trigger('click')
    const result = w.emitted('update:modelValue')![0]![0] as typeof draft
    expect(result.stages.map(s => [s.id, s.order_index])).toEqual([['stage_b', 1], ['stage_a', 2]]); w.unmount()
  })
  it('shows semantic stage information and recommendations without hiding meaningful content', () => {
    const w = mount(ScenarioJson, { props: { value: { stage_type: 'practical_task', mechanism_type: 'team_mutual_support_task', teacher_instructions: { general_safety_rules: ['Проверьте материалы'] }, title: 'Мой текст' } }, global })
    expect(w.text()).toContain('Практическая задача'); expect(w.text()).toContain('Командная взаимопомощь'); expect(w.text()).toContain('Безопасность'); expect(w.text()).toContain('Мой текст')
    expect(w.text()).not.toMatch(/stage_type|team_mutual_support_task|general_safety_rules/); w.unmount()
  })
  it('searches calendar events on Enter without advancing or validating the wizard', async () => {
    const w = constructor(); await w.get('input[value=calendar]').setValue(true)
    await w.get('input[type=search]').setValue('День науки'); await w.get('input[type=search]').trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('01 / Выберите событие'); expect(w.find('.constructor-errors').exists()).toBe(false); w.unmount()
  })
  it('routes server errors across steps and focuses custom resources instead of unrelated checkboxes', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError(422, 'VALIDATION', 'Проверьте DTO', [{ field: 'participants_count', message: 'Уточните participants_count' }, { field: 'available_resources.0', message: 'Уточните available_resources[0]' }]))
    const w = constructor(request)
    await w.get('#field-custom_event_title').setValue('День науки'); await w.get('form').trigger('submit')
    await w.get('input[value="5"]').setValue(true); await w.get('#field-participants_count').setValue('25'); await w.get('form').trigger('submit')
    await w.get('input[value=class_level]').setValue(true); await w.get('input[value=class_hour]').setValue(true); await w.get('#field-duration_minutes').setValue('45'); await w.get('form').trigger('submit')
    await w.get('input[value=mutual_aid]').setValue(true); await w.get('form').trigger('submit'); expect(w.get('button[type=submit]').text()).toBe('Сохранить условия')
    await w.get('form').trigger('submit'); await flushPromises()
    expect(w.text()).not.toContain('DTO'); expect(w.text()).not.toContain('participants_count')
    await w.get('.constructor-errors a[href="#field-available_resources"]').trigger('click'); await flushPromises()
    expect(w.text()).toContain('04 / Цели и ресурсы'); expect(document.activeElement?.id).toBe('field-custom_resources')
    expect(w.get('#field-custom_resources').attributes('aria-invalid')).toBe('true'); w.unmount()
  })
})
