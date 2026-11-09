<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { PilotInvite, PilotParticipant, PilotResponse, PilotReview, PilotReviewInput } from '~/types/pilot'
import { createLatestResource } from '~/utils/latest-resource'
import { createPilotMutation } from '~/utils/pilot-mutation'
const auth = useAuthStore(), api = usePilotApi(), route = useRoute()
const tab = ref('results'), synthetic = ref(false), globalScope = ref(false)
const globalAllowed = ref(false), globalChecking = ref(false), globalError = ref('')
const privileged = computed(() => auth.tenant?.role === 'school_admin' || ['system_admin','catalog_curator'].includes(auth.systemRole))
// AuthController omits curator_scope; an existing scoped GET must confirm access.
const canGlobal = computed(() => auth.systemRole === 'system_admin' || auth.systemRole === 'catalog_curator' && globalAllowed.value)
const canSchoolAdmin = computed(() => privileged.value && !!auth.tenant)
const scopeKey = () => `${api.context()}:${synthetic.value}:${globalScope.value}`
const metricsResource = createLatestResource(signal => api.metrics(signal, synthetic.value, globalScope.value), scopeKey)
const { data: metrics, pending: metricsLoading, error: metricsError } = metricsResource
const participantResource = createLatestResource(signal => api.participants(signal), api.context)
const { data: participants, pending: participantsLoading, error: participantsError } = participantResource
const mutation = createPilotMutation(api.context), { pending, uncertain, error } = mutation
const subject = ref(''), experience = ref(''), code = ref(''), validDays = ref('30')
const invite = shallowRef<PilotInvite | null>(null), copied = ref('')
const action = shallowRef<{ kind: 'create' | 'reissue' | 'revoke'; participant?: PilotParticipant } | null>(null)
const confirmation = ref(false), responseId = ref(''), response = shallowRef<PilotResponse | null>(null), finding = shallowRef<PilotReview | null>(null), reviewVersions = shallowRef<PilotReview[]>([]), reviewReadError = ref('')
const responseLoading = ref(false), responseError = ref(''), reviewStatus = ref('pending_audit'), critical = ref(''), remarks = ref('')
let responseEpoch = 0, responseAbort: AbortController | undefined
const uuid = (id: string) => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)
const validInvite = computed(() => subject.value.trim().length > 0 && subject.value.length <= 100 && /^\d+$/.test(experience.value) && Number(experience.value) <= 60 && /^\d+$/.test(validDays.value) && Number(validDays.value) >= 1 && Number(validDays.value) <= 90 && code.value.length <= 64)
const validReview = computed(() => response.value && /^\d+$/.test(critical.value) && ['pending_audit','audited','rejected'].includes(reviewStatus.value))
async function refreshMetrics() { if (auth.tenant || globalScope.value && canGlobal.value) await metricsResource.refresh() }
let globalAbort: AbortController | undefined
async function checkGlobal() {
  if (globalChecking.value || auth.systemRole !== 'catalog_curator') return
  const key = api.context(), controller = new AbortController(); globalAbort = controller; globalChecking.value = true; globalError.value = ''
  try { await api.metrics(controller.signal, false, true); if (key === api.context() && !controller.signal.aborted) { globalAllowed.value = true; globalScope.value = true } }
  catch (cause) { if (key === api.context() && !controller.signal.aborted) globalError.value = cause instanceof Error ? cause.message : 'Глобальный доступ не подтверждён.' }
  finally { if (key === api.context()) globalChecking.value = false }
}
async function refreshParticipants() { if (canSchoolAdmin.value) await participantResource.refresh() }
function clearSecret() { invite.value = null; copied.value = '' }
function prepare(kind: 'create' | 'reissue' | 'revoke', participant?: PilotParticipant) { if (pending.value || uncertain.value) return; clearSecret(); action.value = { kind, participant }; confirmation.value = true }
async function execute() {
  const target = action.value
  if (!target || !canSchoolAdmin.value || target.kind === 'create' && !validInvite.value) return
  confirmation.value = false; action.value = null; clearSecret()
  const value = await mutation.run(async signal => {
    if (target.kind === 'create') return api.create({ subject_area: subject.value.trim(), teaching_experience_years: Number(experience.value), ...(code.value.trim() ? { anonymous_code: code.value.trim() } : {}), valid_days: Number(validDays.value) }, signal)
    if (target.kind === 'reissue') return api.reissue(target.participant!.id, signal)
    await api.revoke(target.participant!.id, signal)
    return null
  }, async signal => { participantResource.data.value = await api.participants(signal) }, async signal => {
    if (target.kind === 'create') return
    const current = await api.participants(signal), row = current.find(p => p.id === target.participant?.id)
    if (!row || row.is_submitted || row.is_revoked) throw new Error('Приглашение изменилось. Перечитайте список.')
  })
  if (value) invite.value = value
  await refreshParticipants()
}
async function copyToken() {
  const value = invite.value?.invite_token
  if (!value) return
  try { await navigator.clipboard.writeText(value); copied.value = 'Токен скопирован. Передайте его участнику безопасным способом.' } catch { copied.value = 'Копирование недоступно. Выделите токен вручную.' }
}
async function loadResponse() {
  if (pending.value) return
  reviewStatus.value = 'pending_audit'; critical.value = ''; remarks.value = ''; reviewConfirm.value = false; reviewDraft.value = null
  responseAbort?.abort(); const epoch = ++responseEpoch, key = api.context(), controller = new AbortController(); responseAbort = controller
  response.value = null; finding.value = null; reviewVersions.value = []; reviewReadError.value = ''; responseError.value = ''; responseLoading.value = true
  try { if (!privileged.value || !uuid(responseId.value.trim())) throw new Error('Укажите корректный ID анкеты и выберите доступную школу.'); const value = await api.response(responseId.value.trim(), controller.signal); if (epoch === responseEpoch && key === api.context()) { response.value = value; await loadReviews(value.id, controller.signal, epoch, key) } }
  catch (cause) { if (epoch === responseEpoch && !controller.signal.aborted) responseError.value = cause instanceof Error ? cause.message : 'Анкета недоступна.' }
  finally { if (epoch === responseEpoch) responseLoading.value = false }
}
async function loadReviews(id: string, signal: AbortSignal, epoch = responseEpoch, key = api.context()) {
  reviewReadError.value = ''; finding.value = null; reviewVersions.value = []
  try {
    const history = await api.reviews(id, signal)
    if (!signal.aborted && epoch === responseEpoch && key === api.context() && response.value?.id === id) {
      if (history.pilot_response_id !== id) throw new Error('История не соответствует выбранной анкете.')
      finding.value = history.effective_review; reviewVersions.value = history.versions
    }
  } catch (cause) { if (!signal.aborted && epoch === responseEpoch && key === api.context()) reviewReadError.value = cause instanceof Error ? cause.message : 'История недоступна.' }
}
async function openParticipantResponse(id: string) { responseId.value = id; tab.value = 'review'; await loadResponse() }
const reviewConfirm = ref(false)
const reviewDraft = shallowRef<{ id: string; version: number; body: PilotReviewInput } | null>(null)
function prepareReview() {
  if (!validReview.value || !response.value || pending.value || uncertain.value) return
  reviewDraft.value = { id: response.value.id, version: responseEpoch, body: { expert_audit_status: reviewStatus.value as PilotReviewInput['expert_audit_status'], critical_cultural_errors: Number(critical.value), methodological_remarks: remarks.value.trim() || null } }
  reviewConfirm.value = true
}
async function saveReview() {
  const draft = reviewDraft.value
  if (!draft || draft.version !== responseEpoch || draft.id !== response.value?.id || !privileged.value) return
  const id = draft.id, responseVersion = draft.version; reviewConfirm.value = false; reviewDraft.value = null; finding.value = null
  const value = await mutation.run(signal => api.review(id, draft.body, signal), signal => loadReviews(id, signal, responseVersion), signal => api.response(id, signal))
  if (value && responseVersion === responseEpoch && response.value?.id === id && value.pilot_response_id === id) { await loadReviews(id, new AbortController().signal, responseVersion); await refreshMetrics() }
}
const exporting = ref(false), exportError = ref(''); let exportAbort: AbortController | undefined
async function download() {
  if (exporting.value || !privileged.value) return
  exporting.value = true; exportError.value = ''; const key = scopeKey(), controller = new AbortController(); exportAbort = controller
  try { const data = await api.export(controller.signal, synthetic.value, globalScope.value); if (controller.signal.aborted || key !== scopeKey()) return; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `pilot-${synthetic.value ? 'synthetic-test-' : ''}aggregates.json`; link.click(); URL.revokeObjectURL(url) }
  catch (cause) { if (!controller.signal.aborted && key === scopeKey()) exportError.value = cause instanceof Error ? cause.message : 'Экспорт недоступен.' }
  finally { if (key === scopeKey()) exporting.value = false }
}
function reset() { metricsResource.reset(); participantResource.reset(); mutation.reset(); clearSecret(); globalAbort?.abort(); globalChecking.value = false; globalAllowed.value = false; globalError.value = ''; responseEpoch++; responseAbort?.abort(); exportAbort?.abort(); exporting.value = false; exportError.value = ''; responseLoading.value = false; response.value = null; finding.value = null; reviewVersions.value = []; reviewReadError.value = ''; responseError.value = ''; responseId.value = ''; remarks.value = ''; critical.value = ''; action.value = null; confirmation.value = false; reviewConfirm.value = false; reviewDraft.value = null }
watch(() => api.context(), () => { reset(); globalScope.value = !auth.tenant && canGlobal.value; void refreshMetrics(); void refreshParticipants() })
watch([synthetic, globalScope], () => { metricsResource.reset(); exportAbort?.abort(); exporting.value = false; void refreshMetrics() })
watch(tab, clearSecret)
onMounted(() => { globalScope.value = !auth.tenant && canGlobal.value; const id = route.query.response; if (typeof id === 'string' && uuid(id)) { responseId.value = id; tab.value = 'review'; void loadResponse() } void refreshMetrics(); void refreshParticipants() })
onBeforeUnmount(reset)
</script>
<template>
  <div class="fe010 pilot-workspace">
    <header class="fe010-heading"><p class="fe010-eyebrow">ПИЛОТ · 20 ПЕДАГОГОВ</p><h1>{{ tab === 'results' ? 'Результаты пилотного теста' : tab === 'participants' ? 'Приглашения педагогов' : 'Экспертная проверка' }}</h1><p>Фактические результаты, обратная связь педагогов и полнота экспертной проверки.</p></header>
    <UiAlert v-if="api.isolated" tone="warning">Синтетический тестовый контур · localhost:8001. Данные этой проверки не являются результатами настоящего исследования.</UiAlert>
    <nav class="fe010-tabs" aria-label="Разделы пилота"><button :disabled="pending" :aria-pressed="tab === 'results'" @click="tab = 'results'">Результаты исследования</button><button v-if="canSchoolAdmin" :disabled="pending" :aria-pressed="tab === 'participants'" @click="tab = 'participants'">Приглашения педагогов</button><button v-if="privileged" :disabled="pending" :aria-pressed="tab === 'review'" @click="tab = 'review'">Экспертная проверка</button><NuxtLink to="/pilot/respond">Анкета по приглашению</NuxtLink><NuxtLink v-if="auth.tenant" to="/comparisons">A/B-сравнения</NuxtLink></nav>
    <template v-if="tab === 'results'">
      <div class="fe010-toolbar"><label v-if="canGlobal"><input v-model="globalScope" type="checkbox"> Глобальные агрегаты</label><UiButton v-if="auth.systemRole === 'catalog_curator' && !globalAllowed" variant="secondary" :loading="globalChecking" @click="checkGlobal">Проверить доступ к глобальным агрегатам</UiButton><label v-if="api.isolated"><input v-model="synthetic" type="checkbox"> Включить синтетические записи (только тестовый контур)</label><UiButton variant="secondary" :loading="metricsLoading" @click="refreshMetrics">Обновить показатели</UiButton><UiButton v-if="privileged && metrics" variant="secondary" :loading="exporting" @click="download">Скачать агрегаты JSON</UiButton></div>
      <UiAlert v-if="globalError" tone="error">{{ globalError }}</UiAlert>
      <UiAlert v-if="!auth.tenant && !globalScope" tone="warning">Выберите школу в профиле. Для регионального куратора глобальная выборка недоступна. Обратитесь к организатору, если нужная школа недоступна.</UiAlert>
      <UiState v-if="metricsLoading" kind="loading" title="Загружаем результаты" /><UiState v-else-if="metricsError" kind="error" title="Показатели недоступны" :description="metricsError.message" /><PilotMetrics v-else-if="metrics" :metrics="metrics" :synthetic="api.isolated && synthetic" />
      <UiAlert v-if="exportError" tone="error">{{ exportError }}</UiAlert>
    </template>
    <template v-if="tab === 'participants' && canSchoolAdmin">
      <form class="fe010-panel fe010-form" @submit.prevent="prepare('create')"><h2>Пригласить педагога</h2><p>Без ФИО и контактных данных. Токен появится один раз после успешного ответа.</p><UiField v-model="subject" label="Предметная область" maxlength="100" :disabled="pending" required /><div class="fe010-form-grid"><UiField v-model="experience" label="Педагогический стаж, лет" type="number" min="0" max="60" step="1" :disabled="pending" required /><UiField v-model="validDays" label="Срок приглашения, дней" type="number" min="1" max="90" step="1" :disabled="pending" required /></div><UiField v-model="code" label="Анонимный код (необязательно)" maxlength="64" :disabled="pending" /><UiButton type="submit" :disabled="!validInvite || uncertain" :loading="pending">Создать приглашение</UiButton></form>
      <section v-if="invite" class="fe010-panel fe010-secret" aria-label="Одноразовый токен"><h2>Сохраните приглашение сейчас</h2><p>{{ invite.anonymous_code }} · Повторно посмотреть токен нельзя. Он исчезнет при закрытии или смене контекста.</p><code>{{ invite.invite_token }}</code><div class="actions"><UiButton @click="copyToken">Скопировать токен</UiButton><UiButton variant="secondary" @click="clearSecret">Скрыть токен</UiButton></div><p role="status">{{ copied }}</p><p>Адрес анкеты: /pilot/respond. Передайте токен отдельно; не добавляйте его в URL.</p></section>
      <div class="fe010-toolbar"><h2>Участники</h2><UiButton variant="secondary" :loading="participantsLoading" @click="refreshParticipants">Обновить участников</UiButton></div>
      <UiState v-if="participantsLoading" kind="loading" title="Загружаем участников" /><UiState v-else-if="participantsError" kind="error" title="Список недоступен" :description="participantsError.message" />
      <div v-else class="fe010-participants" role="list"><article v-for="participant in participants" :key="participant.id" class="fe010-participant" role="listitem"><div><strong>{{ participant.anonymous_code }}</strong><p>{{ participant.subject_area }} · Стаж {{ participant.teaching_experience_years }} лет</p></div><div><UiBadge :tone="participant.is_submitted ? 'success' : 'neutral'">{{ participant.is_submitted ? 'Анкета отправлена' : participant.is_revoked ? 'Приглашение отозвано' : participant.is_expired ? 'Срок истёк' : 'Ожидается ответ' }}</UiBadge><UiBadge v-if="participant.is_synthetic" tone="warning">Синтетический участник</UiBadge><p>Действует до {{ participant.expires_at ? new Date(participant.expires_at).toLocaleDateString('ru-RU') : '—' }}</p></div><div class="actions"><UiButton v-if="participant.response_id" variant="secondary" :disabled="pending" @click="openParticipantResponse(participant.response_id)">Открыть анкету и экспертизу</UiButton><UiButton variant="secondary" :disabled="participant.is_submitted || participant.is_revoked || pending || uncertain" @click="prepare('reissue', participant)">Перевыпустить</UiButton><UiButton variant="danger" :disabled="participant.is_submitted || participant.is_revoked || pending || uncertain" @click="prepare('revoke', participant)">Отозвать</UiButton></div></article><p v-if="participants?.length === 0">Приглашений пока нет.</p></div>
      <UiAlert>Открытие анкеты доступно по ID ответа, возвращённому сервером. Доступ к сведениям и заключениям проверяется Laravel.</UiAlert>
    </template>
    <section v-if="tab === 'review' && privileged" class="fe010-panel fe010-form"><h2>Экспертная проверка</h2><form class="fe010-toolbar" @submit.prevent="loadResponse"><UiField v-model="responseId" label="ID анкеты" required /><UiButton type="submit" :loading="responseLoading" :disabled="pending">Загрузить анкету</UiButton></form><UiAlert v-if="responseError" tone="error">{{ responseError }}</UiAlert>
      <template v-if="response"><UiBadge v-if="response.is_synthetic" tone="warning">Синтетическая анкета</UiBadge><dl class="fe010-details"><dt>Сценарий</dt><dd><NuxtLink :to="`/scenarios/${response.scenario_id}`">{{ response.scenario_id }}</NuxtLink></dd><dt>Подготовка без / с ИИ</dt><dd>{{ response.prep_time_baseline_minutes }} / {{ response.prep_time_ai_minutes }} минут</dd><dt>Сокращение по расчёту сервера</dt><dd>{{ response.relative_time_saving_percent }}%</dd><dt>Ручные доработки</dt><dd>{{ response.manual_edit_percentage }}%</dd><dt>Культурный контекст</dt><dd>{{ response.cultural_context_used ? 'Использован' : 'Не использован' }} · Оценка {{ response.cultural_usefulness_score ?? 'не указана' }}</dd><dt>Отзыв</dt><dd>{{ response.feedback_text || 'Не оставлен' }}</dd></dl>
        <UiAlert v-if="reviewReadError" tone="error">{{ reviewReadError }} Эффективное заключение неизвестно; отсутствие данных не означает 0 ошибок.</UiAlert><UiAlert v-else-if="!finding">Эффективное заключение ещё не создано. Отсутствие экспертизы не означает 0 ошибок.</UiAlert>
        <section v-if="finding" class="fe010-summary" role="status"><h3>Текущее эффективное заключение · версия {{ finding.finding_version }}</h3><p>Статус: {{ finding.expert_audit_status }} · Критических ошибок: {{ finding.critical_cultural_errors }}</p><p>{{ finding.methodological_remarks || 'Замечаний не указано' }}</p><p>Заключение действует: {{ finding.is_effective ? 'Да' : 'Нет' }}. Обновите страницу, чтобы увидеть последнее заключение.</p></section>
        <details v-if="reviewVersions.length"><summary>История версий · {{ reviewVersions.length }}</summary><article v-for="version in reviewVersions" :key="version.id" class="fe010-summary"><h3>Версия {{ version.finding_version }} · {{ version.is_effective ? 'Действующая' : 'Историческая' }}</h3><p>{{ version.expert_name }} · {{ version.reviewed_at }}</p><p>{{ version.expert_audit_status }} · Критических ошибок: {{ version.critical_cultural_errors }}</p><p>{{ version.methodological_remarks || 'Без замечаний' }}</p></article></details><form class="fe010-form" @submit.prevent="prepareReview"><h3>Добавить новую версию заключения</h3><UiSelect v-model="reviewStatus" label="Статус экспертизы" :options="[{value:'pending_audit',label:'Проверка не завершена'},{value:'audited',label:'Экспертиза завершена'},{value:'rejected',label:'Отклонено'}]" :disabled="pending" /><UiField v-model="critical" label="Количество критических культурных ошибок" type="number" min="0" step="1" required :disabled="pending" /><UiTextarea v-model="remarks" label="Методические замечания" maxlength="5000" :disabled="pending" /><UiButton type="submit" :loading="pending" :disabled="!validReview || uncertain">Добавить заключение</UiButton></form>
      </template>
    </section>
    <UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert><UiAlert v-if="uncertain" tone="warning">Автоматического повтора не было. Список перечитан, если сервер доступен. Для приглашения утраченный токен не восстанавливается; перевыпуск требует нового явного подтверждения. Для заключения сверяйте текущую версию и историю через GET. Новая отправка требует отдельного подтверждения.<UiButton variant="secondary" @click="mutation.reset()">Результат проверен — разрешить новое действие</UiButton></UiAlert>
    <UiModal v-model="confirmation" :title="action?.kind === 'create' ? 'Создать одноразовое приглашение?' : action?.kind === 'reissue' ? 'Перевыпустить приглашение?' : 'Отозвать приглашение?'"><p v-if="action?.participant">Участник: {{ action.participant.anonymous_code }}</p><p>{{ action?.kind === 'reissue' ? 'Прежний токен перестанет действовать. Новый токен будет показан один раз.' : action?.kind === 'revoke' ? 'Участник не сможет отправить анкету по этому приглашению. Обратная операция API отсутствует.' : 'Создаётся приглашение без персональных данных. Сохраните токен после ответа сервера.' }}</p><div class="actions"><UiButton variant="secondary" @click="confirmation = false">Отмена</UiButton><UiButton :loading="pending" @click="execute">Подтвердить действие</UiButton></div></UiModal>
    <UiModal v-model="reviewConfirm" title="Добавить новую версию экспертизы?"><p v-if="reviewDraft">Анкета: {{ reviewDraft.id }} · Статус: {{ reviewDraft.body.expert_audit_status }} · Критических ошибок: {{ reviewDraft.body.critical_cultural_errors }}</p><p>Сервер создаст новую версию и заменит эффективное заключение. Старые версии сохранятся на сервере.</p><div class="actions"><UiButton variant="secondary" @click="reviewConfirm = false">Отмена</UiButton><UiButton :loading="pending" @click="saveReview">Подтвердить заключение</UiButton></div></UiModal>
  </div>
</template>
