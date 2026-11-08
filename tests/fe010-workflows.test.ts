import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPilotMutation, isolatedPilotOrigin } from '../app/utils/pilot-mutation'
import { ApiError } from '../app/utils/api-error'
import PilotQuestionnaire from '../app/components/features/pilot/PilotQuestionnaire.vue'
import PilotWorkspace from '../app/components/features/pilot/PilotWorkspace.vue'
import UiField from '../app/components/ui/UiField.vue'
import UiSelect from '../app/components/ui/UiSelect.vue'
import UiTextarea from '../app/components/ui/UiTextarea.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import UiAlert from '../app/components/ui/UiAlert.vue'
import UiBadge from '../app/components/ui/UiBadge.vue'
import UiCard from '../app/components/ui/UiCard.vue'
import UiState from '../app/components/ui/UiState.vue'

const id = '019a0000-0000-7000-8000-000000000003'
const global = { components: { UiField, UiSelect, UiTextarea, UiButton, UiAlert, UiBadge, UiCard, UiState }, stubs: { NuxtLink: { props: ['to'], template: '<a :href="to"><slot/></a>' }, PilotMetrics: { template: '<div>Метрики сервера</div>' }, UiModal: { props: ['modelValue','title'], template: '<section v-if="modelValue" role="dialog"><h2>{{title}}</h2><slot/></section>' } } }
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
describe('FE010 uncertain writes and context cancellation', () => {
  it.each([0,408,500,503])('reconciles %s without repeating a write or allowing double submit', async status => {
    const mutation = createPilotMutation(() => 'school-A'), write = vi.fn(async () => { throw new ApiError(status,'UNKNOWN','Lost') }), read = vi.fn(async () => [])
    await mutation.run(write, read); await mutation.run(write, read)
    expect(write).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(1); expect(mutation.uncertain.value).toBe(true)
  })
  it.each([403,409,422])('keeps definitive %s as an error and never rewrites it automatically', async status => {
    const c = createPilotMutation(() => 'A'), write = vi.fn(async () => { throw new ApiError(status,'REFUSED','Denied') }), read = vi.fn(async () => [])
    await c.run(write,read); expect(write).toHaveBeenCalledTimes(1); expect(c.uncertain.value).toBe(false); expect(c.error.value?.message).toBe('Denied'); expect(read).toHaveBeenCalledTimes(status === 409 ? 1 : 0)
  })
  it.each([new ApiError(503,'READ_FAILED','Preflight unavailable'),new Error('Приглашение изменилось')])('does not report an unknown write when preflight fails', async failure => {
    const c=createPilotMutation(()=>'A'),write=vi.fn(async()=> 'token'),read=vi.fn(async()=>[])
    await c.run(write,read,async()=>{throw failure})
    expect(write).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();expect(c.uncertain.value).toBe(false);expect(c.error.value?.message).toBe(failure.message)
  })
  it('keeps malformed successful POST results uncertain after dispatch', async()=>{
    const c=createPilotMutation(()=>'A'),read=vi.fn(async()=>[])
    await c.run(async()=>{throw new Error('Invalid reply after POST')},read,async()=>{})
    expect(c.uncertain.value).toBe(true);expect(read).toHaveBeenCalledTimes(1)
  })
  it('blocks simultaneous sends and drops a successful late response after a school switch', async () => {
    let context = 'A'; const c = createPilotMutation(() => context), result = deferred<string>(), write = vi.fn(() => result.promise)
    const first = c.run(write); await c.run(write); context = 'B'; c.reset(); result.resolve('PRIVATE-RESULT')
    expect(await first).toBeUndefined(); expect(write).toHaveBeenCalledTimes(1); expect(c.pending.value).toBe(false)
  })
  it('does not leak a late reconciliation into a new write outcome', async () => {
    let context = 'A'; const c = createPilotMutation(() => context), read = deferred<undefined>()
    const first = c.run(async () => { throw new ApiError(500,'LOST','Lost') },() => read.promise)
    await flushPromises(); context = 'B'; c.reset(); expect(await c.run(async () => 'B')).toBe('B'); read.resolve(undefined); await first
    expect(c.error.value).toBeNull(); expect(c.uncertain.value).toBe(false)
  })
  it.each(['http://localhost:8000','https://localhost:8001','http://localhost:8001/foreign','http://user:secret@localhost:8001','http://localhost:8001?synthetic=1','https://example.org:8001'])('disallows synthetic controls for %s', origin => { expect(isolatedPilotOrigin(origin)).toBe(false) })
})
async function questionnaire(submit = vi.fn(async () => ({ id, relative_time_saving_percent: 50, is_synthetic: true }))) {
  vi.stubGlobal('usePublicPilotApi', () => ({ submit })); vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiOrigin:'http://localhost:8001' } }))
  const wrapper = mount(PilotQuestionnaire,{global})
  await wrapper.get('input[type=password]').setValue('SECRET-TEST-PLACEHOLDER')
  await wrapper.findAll('input[type=text]')[0]!.setValue(id)
  const numbers = wrapper.findAll('input[type=number]'); await numbers[0]!.setValue('60'); await numbers[1]!.setValue('30'); await numbers[2]!.setValue('20')
  const selects = wrapper.findAll('select'); await selects[0]!.setValue('yes'); await selects[1]!.setValue('no')
  return {wrapper,submit}
}
async function confirmSurvey(wrapper: Awaited<ReturnType<typeof questionnaire>>['wrapper']) { await wrapper.get('form').trigger('submit'); await wrapper.findAll('button').find(b => b.text() === 'Подтвердить отправку')!.trigger('click'); await flushPromises() }
describe('FE010 public one-shot questionnaire', () => {
  it('makes an already-used invitation terminal and starts a blank form only explicitly',async()=>{
    const{wrapper,submit}=await questionnaire(vi.fn(async()=>{throw new ApiError(409,'USED','Уже отправлено')}));await confirmSurvey(wrapper)
    expect(wrapper.text()).toContain('Приглашение уже использовано');expect(wrapper.find('form').exists()).toBe(false);expect(wrapper.html()).not.toContain('SECRET-TEST-PLACEHOLDER');expect(submit).toHaveBeenCalledTimes(1)
    await wrapper.findAll('button').find(b=>b.text()==='Новая анкета с другим приглашением')!.trigger('click')
    expect(wrapper.get('input[type=password]').element.value).toBe('');expect(wrapper.findAll('input[type=text]')[0]!.element.value).toBe('');expect(submit).toHaveBeenCalledTimes(1);wrapper.unmount()
  })
  it('uses the existing public endpoint DTO once and clears the token after success', async () => {
    const storage = vi.spyOn(Storage.prototype,'setItem'), log = vi.spyOn(console,'log'); const {wrapper,submit} = await questionnaire()
    await confirmSurvey(wrapper); expect(submit).toHaveBeenCalledTimes(1); expect(submit.mock.calls[0]![0]).toMatchObject({scenario_id:id,prep_time_baseline_minutes:60,prep_time_ai_minutes:30,manual_edit_percentage:20,cultural_context_used:false})
    expect(wrapper.text()).toContain('Анкета принята'); expect(wrapper.html()).not.toContain('SECRET-TEST-PLACEHOLDER'); expect(storage).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); wrapper.unmount()
  })
  it('locks an unknown public result because no reconciliation GET exists', async () => {
    const {wrapper,submit} = await questionnaire(vi.fn(async () => { throw new ApiError(0,'NETWORK','Lost') })); await confirmSurvey(wrapper)
    expect(wrapper.text()).toContain('Результат отправки неизвестен'); expect(wrapper.get('input[type=password]').element.value).toBe(''); expect(wrapper.findAll('button').find(b => b.text() === 'Отправить анкету')!.attributes('disabled')).toBeDefined(); expect(submit).toHaveBeenCalledTimes(1); wrapper.unmount()
  })
  it.each([403,404,409,422])('shows token refusal %s without another automatic submit', async status => {
    const {wrapper,submit} = await questionnaire(vi.fn(async () => { throw new ApiError(status,'REFUSED','Приглашение недоступно') })); await confirmSurvey(wrapper); expect(wrapper.text()).toContain('Приглашение недоступно'); expect(submit).toHaveBeenCalledTimes(1); wrapper.unmount()
  })
})
function admin() {
  const auth = reactive({authenticated:true,user:{id},tenant:{school_id:'A',role:'school_admin'},systemRole:'none'})
  const api = {context:() => JSON.stringify(auth),isolated:true,metrics:vi.fn(async()=>null),participants:vi.fn(async()=>[]),create:vi.fn(async()=>({id,anonymous_code:'TEST-01',invite_token:'EPHEMERAL-SECRET-PLACEHOLDER',expires_at:'2026-11-01T00:00:00Z',notice:''})),reissue:vi.fn(),revoke:vi.fn(),response:vi.fn(),review:vi.fn(),export:vi.fn()}
  vi.stubGlobal('useAuthStore',()=>auth);vi.stubGlobal('usePilotApi',()=>api);vi.stubGlobal('useRoute',()=>({query:{}}))
  return {auth,api}
}
describe('FE010 invitation UI secrecy and RBAC', () => {
  it.each(['create','reissue'] as const)('prevents a tab switch from hiding the one-time %s reply',async kind=>{
    const{api}=admin(),reply=deferred<{id:string;anonymous_code:string;invite_token:string;expires_at:string;notice:string}>()
    if(kind==='create')api.create.mockImplementation(()=>reply.promise)
    else { api.participants.mockResolvedValue([{id,anonymous_code:'TEST-01',is_submitted:false,is_revoked:false,is_synthetic:true,subject_area:'История',teaching_experience_years:1,expires_at:'2026-11-01'}] as never);api.reissue.mockImplementation(()=>reply.promise) }
    const w=mount(PilotWorkspace,{global});await flushPromises();await w.findAll('button').find(b=>b.text()==='Приглашения педагогов')!.trigger('click')
    if(kind==='create'){const inputs=w.findAll('input');await inputs[0]!.setValue('История');await inputs[1]!.setValue('10');await w.get('form').trigger('submit')}
    else await w.findAll('button').find(b=>b.text()==='Перевыпустить')!.trigger('click')
    await w.findAll('button').find(b=>b.text()==='Подтвердить действие')!.trigger('click');await flushPromises()
    const results=w.findAll('button').find(b=>b.text()==='Результаты исследования')!;expect(results.attributes('disabled')).toBeDefined();await results.trigger('click')
    reply.resolve({id,anonymous_code:'TEST-01',invite_token:'ONE-TIME-TEST-ONLY',expires_at:'2026-11-01',notice:''});await flushPromises();expect(w.text()).toContain('Сохраните приглашение сейчас');expect(w.text()).toContain('ONE-TIME-TEST-ONLY');w.unmount()
  })
  it('clears expert drafts and confirmation when another questionnaire is loaded',async()=>{
    const{api}=admin(),second='019a0000-0000-7000-8000-000000000004';api.response.mockImplementation(async responseId=>({id:responseId,scenario_id:id,is_synthetic:true,prep_time_baseline_minutes:60,prep_time_ai_minutes:30,relative_time_saving_percent:50,manual_edit_percentage:20,cultural_context_used:false,cultural_usefulness_score:null,feedback_text:null}))
    const w=mount(PilotWorkspace,{global});await flushPromises();await w.findAll('button').find(b=>b.text()==='Экспертная проверка')!.trigger('click');await w.get('input').setValue(id);await w.get('form').trigger('submit');await flushPromises()
    await w.get('input[type=number]').setValue('0');await w.get('textarea').setValue('Only belongs to response A');await w.get('select').setValue('audited')
    await w.get('input[type=text]').setValue(second);await w.findAll('form')[0]!.trigger('submit');await flushPromises()
    expect(w.get('input[type=number]').element.value).toBe('');expect(w.get('textarea').element.value).toBe('');expect(w.get('select').element.value).toBe('pending_audit');expect(w.findAll('button').find(b=>b.text()==='Добавить заключение')!.attributes('disabled')).toBeDefined();expect(api.review).not.toHaveBeenCalled();w.unmount()
  })
  it('reveals an API invitation once without persistence and clears it on tenant change', async () => {
    const {auth,api}=admin(),storage=vi.spyOn(Storage.prototype,'setItem'),w=mount(PilotWorkspace,{global});await flushPromises()
    await w.findAll('button').find(b=>b.text()==='Приглашения педагогов')!.trigger('click'); const inputs=w.findAll('input');await inputs[0]!.setValue('История');await inputs[1]!.setValue('10');await w.get('form').trigger('submit');await w.findAll('button').find(b=>b.text()==='Подтвердить действие')!.trigger('click');await flushPromises()
    expect(api.create).toHaveBeenCalledTimes(1);expect(w.text()).toContain('EPHEMERAL-SECRET-PLACEHOLDER');expect(storage).not.toHaveBeenCalled()
    auth.tenant.school_id='B';await flushPromises();expect(w.text()).not.toContain('EPHEMERAL-SECRET-PLACEHOLDER');w.unmount()
  })
  it('does not fetch participants or expose management for an ordinary teacher', async () => {
    const {auth,api}=admin();auth.tenant.role='teacher';const w=mount(PilotWorkspace,{global});await flushPromises();expect(api.participants).not.toHaveBeenCalled();expect(w.text()).not.toContain('Приглашения педагогов');expect(w.text()).not.toContain('Экспертная проверка');w.unmount()
  })
})
