<script setup lang="ts">
import { allowedVersion, directions, fieldStep, formats, newDraft, resourceOptions, resources, scales, scenarioBody, steps, validateDraft, type Occasion, type SavedRequest } from '~/utils/scenario-constructor'
import { createScenarioSave } from '~/utils/scenario-save'
import { ApiError } from '~/utils/api-error'
import { teacherPath, teacherText } from '~/utils/teacher-language'
definePageMeta({ access: { tenant: true } })
useHead({ title: 'Конструктор мероприятия · Школьные события' })
const auth = useAuthStore(), api = useApi(), traditionsApi = useTraditionsApi(), route = useRoute(), router = useRouter()
const context = () => `${auth.user?.id ?? ''}:${auth.tenant?.school_id ?? ''}`
const draft = reactive(newDraft()), step = ref(1), completed = ref(0), issues = ref<Record<string, string>>({}), query = ref(''), search = ref(''), page = ref(1)
const save = createScenarioSave(context, { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: key => window.sessionStorage.removeItem(key) }), { pending: saving, error: saveError, receipt } = save
const saved = shallowRef<SavedRequest | null>(null), reading = ref(false), readError = ref(''), entryError = ref('')
const mode = computed({ get: () => draft.occasion.kind, set: (kind: Occasion['kind']) => { draft.occasion = kind === 'custom' ? { kind, title: '' } : { kind, id: '', title: '' }; issues.value = {} } })
const events = useSchoolResource(signal => api.request('get', '/calendar-events', { query: { q: search.value, page: page.value, per_page: 12 }, signal, reportError: false }), () => [search.value, page.value, context()], () => mode.value === 'calendar')
const traditions = useSchoolResource(signal => traditionsApi.list(auth.tenant!.school_id, 'all', signal), () => context(), () => mode.value === 'tradition' || !!route.query.tradition_version_id)
let entryController: AbortController | undefined, readController: AbortController | undefined
async function readSaved() {
  if (receipt.value?.state !== 'saved') return
  const id = receipt.value.id, ctx = context(), schoolId = auth.tenant!.school_id
  readController?.abort(); const controller = new AbortController(); readController = controller
  reading.value = true; readError.value = ''; saved.value = null
  try { const response = await api.request('get', '/scenario-requests/{id}', { params: { id }, schoolId, signal: controller.signal, reportError: false }); if (ctx !== context() || controller.signal.aborted) return; if (response.data.school_id !== schoolId) throw new ApiError(403, 'SCHOOL_MISMATCH', 'Запрос относится к другой школе.'); saved.value = response.data }
  catch (e) { if (ctx === context() && !controller.signal.aborted) readError.value = e instanceof Error ? e.message : 'Не удалось перечитать запрос.' }
  finally { if (ctx === context() && !controller.signal.aborted) reading.value = false }
}
watch(() => receipt.value?.state === 'saved' ? receipt.value.id : '', id => { if (id) void readSaved() })
watch(context, () => { Object.assign(draft, newDraft()); step.value = 1; completed.value = 0; issues.value = {}; query.value = ''; search.value = ''; page.value = 1; saved.value = null; readError.value = ''; reading.value = false; entryError.value = ''; entryController?.abort(); readController?.abort(); save.reset() }, { immediate: true, flush: 'sync' })
watch(() => [route.query.school, route.query.calendar_event_id, route.query.tradition_version_id, context()], async () => {
  entryController?.abort(); const controller = new AbortController(); entryController = controller
  const calendar = route.query.calendar_event_id, tradition = route.query.tradition_version_id, school = route.query.school
  if (!calendar && !tradition) return
  if (school !== auth.tenant?.school_id || (calendar && tradition)) {
    entryError.value = 'Повод из ссылки сброшен: выберите событие для текущей школы.'
    const clean = { ...route.query }; delete clean.school; delete clean.calendar_event_id; delete clean.tradition_version_id; await router.replace({ query: clean }); return
  }
  if (typeof calendar === 'string') {
    mode.value = 'calendar'; const ctx = context()
    try { const event = await api.request('get', '/calendar-events/{id}', { params: { id: calendar }, signal: controller.signal, reportError: false }); if (ctx === context() && !controller.signal.aborted) draft.occasion = { kind: 'calendar', id: event.data.id, title: event.data.title } }
    catch (e) { if (!controller.signal.aborted) entryError.value = e instanceof Error ? e.message : 'Событие недоступно.' }
  } else if (typeof tradition === 'string') mode.value = 'tradition'
}, { immediate: true })
watch(() => traditions.data.value, list => {
  const id = route.query.tradition_version_id
  if (!list || typeof id !== 'string' || route.query.school !== auth.tenant?.school_id) return
  const occasion = allowedVersion(id, list)
  if (occasion) draft.occasion = occasion
  else entryError.value = 'Версия традиции отсутствует в текущей школе. Выберите доступную версию.'
})
function selectVersion(event: Event) { const id = (event.target as HTMLSelectElement).value; draft.occasion = allowedVersion(id, traditions.data.value ?? []) ?? { kind: 'tradition', id: '', title: '' } }
function newRequest() {
  const o = draft.occasion
  const entry = o.kind !== 'custom' && route.query.school === auth.tenant?.school_id && route.query[o.kind === 'calendar' ? 'calendar_event_id' : 'tradition_version_id'] === o.id ? { ...o } : null
  save.acknowledgeNew(); Object.assign(draft, newDraft()); if (entry) draft.occasion = entry; saved.value = null; completed.value = 0; go(1)
}
async function focusIssue() { await nextTick(); document.querySelector<HTMLElement>('.constructor-errors')?.focus() }
function fieldName(field: string) { const name = teacherPath(field).split('.')[0]; return name === 'occasion' ? (draft.occasion.kind === 'custom' ? 'custom_event_title' : draft.occasion.kind === 'calendar' ? 'calendar_event_id' : 'tradition_version_id') : name }
async function focusField(field: string) {
  step.value = fieldStep(teacherPath(field)); await nextTick()
  const element = document.getElementById(fieldName(field) === 'available_resources' ? 'field-custom_resources' : 'field-' + fieldName(field))
  if (!element) return
  const control = element.matches('input,textarea,select') ? element : element.querySelector<HTMLElement>('input,textarea,select')
  control?.focus()
}
function searchEvents() { search.value = query.value.trim(); page.value = 1 }

function go(next: number) { if (saving.value) return; step.value = next; issues.value = {}; void nextTick(() => document.querySelector<HTMLElement>('#constructor-step')?.focus()) }
function advance() { issues.value = Object.fromEntries(Object.entries(validateDraft(draft)).filter(([field]) => fieldStep(field) === step.value)); if (Object.keys(issues.value).length) { void focusIssue(); return } completed.value = Math.max(completed.value, step.value); go(step.value + 1) }
async function submit() {
  issues.value = validateDraft(draft)
  const first = Object.keys(issues.value)[0]
  if (first) { step.value = fieldStep(first); await focusIssue(); return }
  const schoolId = auth.tenant!.school_id, body = scenarioBody(draft)
  await save.save(async signal => { const response = await api.request('post', '/scenario-requests', { schoolId, body, signal, reportError: false }); if (!response?.data?.id) throw new Error('Не удалось получить подтверждение сохранения условий.'); return response.data.id })
  if (saveError.value?.details.length) { issues.value = Object.fromEntries(saveError.value.details.map(i => [teacherPath(i.field).split('.')[0]!, teacherText(i.message)])); step.value = fieldStep(teacherPath(saveError.value.details[0]!.field)); await focusIssue() }
}
onBeforeUnmount(() => { entryController?.abort(); readController?.abort(); save.reset() })
</script>
<template>
  <div class="constructor-page">
    <header><NuxtLink to="/calendar" class="muted">Календарь / Конструктор</NuxtLink><h1>Конструктор мероприятия</h1><p class="muted">Выберите повод и условия класса. На последнем шаге вы сохраните их и сможете запустить подготовку сценария.</p></header>
    <UiCard v-if="receipt?.state === 'saved'" class="constructor-success"><h2>Запрос сохранён</h2><NuxtLink :to="`/scenario-requests/${receipt.id}`" class="ui-button ui-button--primary">Открыть условия мероприятия</NuxtLink><p>Условия сохранены. Теперь можно запустить подготовку сценария.</p><UiState v-if="reading" kind="loading" title="Загружаем сохранённые условия" /><UiAlert v-else-if="readError" tone="error">{{ teacherText(readError) }} <UiButton variant="secondary" @click="readSaved">Повторить чтение</UiButton></UiAlert><template v-else-if="saved"><ScenarioRequestDetails :request="saved" /><GenerationLaunchPanel :request="saved" /></template><UiButton variant="secondary" @click="newRequest">Новый запрос</UiButton></UiCard>
    <template v-else>
      <nav class="constructor-steps" aria-label="Шаги конструктора"><button v-for="(label, i) in steps" :key="label" :aria-current="step === i + 1 ? 'step' : undefined" :disabled="saving || i > completed" :class="{ current: step === i + 1, complete: i < completed }" @click="go(i + 1)"><span>{{ i + 1 }}</span>{{ label }}</button></nav>
      <UiAlert v-if="entryError" tone="warning">{{ teacherText(entryError) }}</UiAlert>
      <UiAlert v-if="receipt?.state === 'uncertain'" tone="warning"><strong>Не удалось подтвердить сохранение условий.</strong><p>Условия могли сохраниться. Чтобы не создать копию, повторное сохранение заблокировано даже после перезагрузки страницы. Попросите администратора проверить результат.</p><details><summary>Сохранить условия ещё раз</summary><p>Если условия уже сохранены, новая попытка создаст их копию.</p><UiButton variant="secondary" @click="save.acknowledgeNew">Понимаю, сохранить ещё раз</UiButton></details></UiAlert>
      <UiAlert v-if="saveError" tone="error">{{ teacherText(saveError.message) }}</UiAlert>
      <div class="constructor-grid"><form class="constructor-form" novalidate @submit.prevent="step === 5 ? submit() : advance()">
        <h2 id="constructor-step" tabindex="-1">0{{ step }} / {{ ['Выберите событие', 'Укажите участников', 'Выберите формат', 'Цели и ресурсы', 'Проверьте данные'][step - 1] }}</h2>
        <div v-if="Object.keys(issues).length" class="constructor-errors" role="alert" tabindex="-1"><strong>Проверьте поля</strong><ul><li v-for="(message, field) in issues" :key="field"><a :href="`#field-${fieldName(String(field))}`" @click.prevent="focusField(String(field))">{{ teacherText(message) }}</a></li></ul></div>
        <fieldset :disabled="saving"><legend class="sr-only">{{ steps[step - 1] }}</legend>
          <div v-if="step === 1" class="constructor-fields">
            <p class="muted">Выберите один повод: событие календаря, ежегодную версию традиции или своё название.</p>
            <div id="field-occasion" class="constructor-choice"><label v-for="(label, kind) in { calendar: 'Из календаря', tradition: 'Школьная традиция', custom: 'Свой повод' }" :key="kind" :class="{ selected: mode === kind }"><input v-model="mode" type="radio" name="occasion-kind" :value="kind">{{ label }}</label></div>
            <UiField v-if="draft.occasion.kind === 'custom'" id="field-custom_event_title" v-model="draft.occasion.title" label="Название собственного события" required maxlength="255" :error="issues.occasion || issues.custom_event_title" />
            <template v-else-if="mode === 'calendar'"><div class="constructor-search"><UiField v-model="query" label="Поиск события" type="search" maxlength="100" @keydown.enter.prevent="searchEvents" /><UiButton variant="secondary" @click="searchEvents">Найти</UiButton></div><p class="muted">Даты события уточняйте в календаре и первоисточниках. </p><UiState v-if="events.pending.value" kind="loading" title="Загружаем события" /><UiAlert v-else-if="events.error.value" tone="error">{{ teacherText(events.error.value.message) }} <UiButton @click="events.refresh">Повторить</UiButton></UiAlert><template v-else-if="events.data.value"><div id="field-calendar_event_id" class="constructor-choice vertical"><label v-for="event in events.data.value.data" :key="event.id" :class="{ selected: draft.occasion.kind === 'calendar' && draft.occasion.id === event.id }"><input type="radio" name="calendar-event" :checked="draft.occasion.kind === 'calendar' && draft.occasion.id === event.id" @change="draft.occasion = { kind: 'calendar', id: event.id, title: event.title }">{{ event.title }}</label></div><p v-if="!events.data.value.data.length">События не найдены.</p><UiPagination :meta="events.data.value.meta" @change="page = $event" /></template><p v-if="issues.occasion || issues.calendar_event_id" class="constructor-field-error" role="alert">{{ issues.occasion || issues.calendar_event_id }}</p><p v-if="draft.occasion.kind === 'calendar' && draft.occasion.id">Выбрано: {{ draft.occasion.title }}</p></template>
            <template v-else><UiState v-if="traditions.pending.value" kind="loading" title="Загружаем традиции школы" /><UiAlert v-else-if="traditions.error.value" tone="error">{{ teacherText(traditions.error.value.message) }} <UiButton @click="traditions.refresh">Повторить</UiButton></UiAlert><label v-else class="ui-field">Ежегодная версия традиции<select id="field-tradition_version_id" :aria-invalid="!!(issues.occasion || issues.tradition_version_id)" :aria-describedby="issues.occasion || issues.tradition_version_id ? 'tradition-error' : undefined" :value="draft.occasion.kind === 'tradition' ? draft.occasion.id : ''" @change="selectVersion"><option value="">Выберите версию</option><optgroup v-for="t in traditions.data.value" :key="t.id" :label="t.title + (t.is_archived ? ' · архив' : '')"><option v-for="v in t.versions" :key="v.id" :value="v.id">{{ t.title }} · {{ v.academic_year }}</option></optgroup></select></label><p v-if="issues.occasion || issues.tradition_version_id" id="tradition-error" class="constructor-field-error" role="alert">{{ issues.occasion || issues.tradition_version_id }}</p><UiAlert>Версия традиции не подтверждает культурные факты. Проверяйте источники заново.</UiAlert></template>
          </div>
          <div v-else-if="step === 2" class="constructor-fields"><fieldset id="field-target_grades" :aria-invalid="!!issues.target_grades" :aria-describedby="issues.target_grades ? 'error-target_grades' : undefined" aria-required="true"><legend>Классы *</legend><div class="constructor-grades"><label v-for="grade in 11" :key="grade" :class="{ selected: draft.grades.includes(grade) }"><input v-model="draft.grades" type="checkbox" :value="grade">{{ grade }}</label></div><p v-if="issues.target_grades" id="error-target_grades" class="constructor-field-error" role="alert">{{ issues.target_grades }}</p></fieldset><UiField id="field-participants_count" v-model="draft.count" inputmode="numeric" label="Количество участников" required min="5" max="500" step="1" hint="От 5 до 500 человек" :error="issues.participants_count" /><label class="constructor-check"><input v-model="draft.family" type="checkbox">Участие семьи</label></div>
          <div v-else-if="step === 3" class="constructor-fields"><fieldset id="field-scale" :aria-invalid="!!issues.scale" :aria-describedby="issues.scale ? 'error-scale' : undefined"><legend>Масштаб мероприятия *</legend><p class="muted">Кому адресован проект? От этого зависят роли и участие семьи.</p><div class="constructor-choice"><label v-for="(label, value) in scales" :key="value" :class="{ selected: draft.scale === value }"><input v-model="draft.scale" type="radio" name="scale" :value="value">{{ label }}</label></div></fieldset><p v-if="issues.scale" id="error-scale" class="constructor-field-error" role="alert">{{ issues.scale }}</p><fieldset id="field-format_type" :aria-invalid="!!issues.format_type" :aria-describedby="issues.format_type ? 'error-format_type' : undefined"><legend>Формат активности *</legend><div class="constructor-choice vertical"><label v-for="(label, value) in formats" :key="value" :class="{ selected: draft.format === value }"><input v-model="draft.format" type="radio" name="format" :value="value">{{ label }}</label></div></fieldset><p v-if="issues.format_type" id="error-format_type" class="constructor-field-error" role="alert">{{ issues.format_type }}</p><UiField id="field-duration_minutes" v-model="draft.duration" inputmode="numeric" label="Продолжительность, минут" required min="20" max="240" step="1" hint="От 20 до 240 минут" :error="issues.duration_minutes" /></div>
          <div v-else-if="step === 4" class="constructor-fields"><fieldset id="field-value_direction" :aria-invalid="!!issues.value_direction" :aria-describedby="issues.value_direction ? 'error-value_direction' : undefined"><legend>Воспитательное направление *</legend><div class="constructor-choice vertical"><label v-for="(label, value) in directions" :key="value" :class="{ selected: draft.direction === value }"><input v-model="draft.direction" type="radio" name="direction" :value="value">{{ label }}</label></div></fieldset><p v-if="issues.value_direction" id="error-value_direction" class="constructor-field-error" role="alert">{{ issues.value_direction }}</p><fieldset id="field-available_resources"><legend>Доступные ресурсы</legend><div class="constructor-choice"><label v-for="item in resourceOptions" :key="item" :class="{ selected: draft.resources.includes(item) }"><input v-model="draft.resources" type="checkbox" :value="item">{{ item }}</label></div></fieldset><UiTextarea id="field-custom_resources" v-model="draft.customResources" label="Другие ресурсы — по одному на строке" :error="issues.available_resources" /><UiTextarea id="field-pedagogical_constraints" v-model="draft.constraints" label="Особенности класса и ограничения" maxlength="1000" :error="issues.pedagogical_constraints" /><span class="muted">{{ draft.constraints.length }} / 1000</span></div>
          <div v-else class="constructor-review"><p class="muted">Сверьте условия перед сохранением. Запрос будет связан с текущей школой.</p><section><h3>Событие <button type="button" class="text-button" @click="go(1)">Изменить</button></h3><p>{{ draft.occasion.title }}</p><p>{{ auth.tenant?.school_name }}</p></section><section><h3>Участники <button type="button" class="text-button" @click="go(2)">Изменить</button></h3><p>{{ draft.grades.join(', ') }} классы · {{ draft.count }} участников</p><p>Участие семьи: {{ draft.family ? 'да' : 'нет' }}</p></section><section><h3>Формат <button type="button" class="text-button" @click="go(3)">Изменить</button></h3><p>{{ draft.scale && scales[draft.scale] }} · {{ draft.format && formats[draft.format] }} · {{ draft.duration }} минут</p></section><section><h3>Цели и ресурсы <button type="button" class="text-button" @click="go(4)">Изменить</button></h3><p>{{ draft.direction && directions[draft.direction] }}</p><p>{{ resources(draft).join(', ') || 'Ресурсы не указаны' }}</p><p>{{ draft.constraints || 'Дополнительных ограничений нет' }}</p></section><UiAlert>Условия сохранятся в вашей школе. Затем вы отдельно подтвердите подготовку сценария.</UiAlert></div>
        </fieldset>
        <footer class="constructor-actions"><UiButton v-if="step > 1" variant="secondary" :disabled="saving" @click="go(step - 1)">Назад</UiButton><UiButton type="submit" :loading="saving" :disabled="!!receipt || saveError?.code === 'RECEIPT_STORAGE'">{{ step === 5 ? 'Сохранить условия' : 'Продолжить' }}</UiButton></footer>
      </form><aside class="constructor-summary"><h3>Ваш проект</h3><strong>Шаг {{ step }} из 5 · Осталось {{ 5 - step }}</strong><p>{{ draft.occasion.title || 'Повод ещё не выбран' }}</p><p>{{ draft.scale && scales[draft.scale] }}<template v-if="draft.format"> · {{ formats[draft.format] }}</template></p><p class="muted">{{ draft.count ? `${draft.count} участников` : 'Участники не указаны' }}<template v-if="draft.duration"> · {{ draft.duration }} минут</template></p><UiAlert>{{ step < 5 ? `Далее: ${steps[step]}` : 'Проверьте данные перед сохранением.' }}</UiAlert></aside></div>
    </template>
  </div>
</template>
