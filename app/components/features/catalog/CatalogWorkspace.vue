<script setup lang="ts">
import { ref, reactive, shallowRef, computed, watch, onBeforeUnmount } from 'vue'
import type { SourcePatch, SourceType, SourceReviewDecision } from '~/types/catalog-admin'
import { createCatalogAdminController } from '~/utils/catalog-admin-controller'
import { sourceType, reviewState, evidenceState, displayDate } from '~/utils/provenance'
import { sourceTypes, catalogFieldIssues } from '~/utils/catalog-admin'
import { ApiError } from '~/utils/api-error'
const api = useCatalogAdminApi(), route = useRoute(), config = useRuntimeConfig()
const c = createCatalogAdminController(api, api.context)
const { source, claim, queue, reviews, pending, error, historyError, notice, confirmation, uncertain, reconciled, needsReconcile, conflict } = c
const status = ref('pending'), sourceInput = ref(''), claimInput = ref(''), tab = ref('source')
const inspector = ref(false), inspectorId = ref<string | null>(null)
const draft = reactive({ title: '', author: '', source_type: 'scientific_publication' as SourceType, url: '', doi_or_isbn: '' })
const baseline = shallowRef<SourcePatch | null>(null), initializedId = ref('')
const decision = ref<SourceReviewDecision>('requires_amendment'), comments = ref('')
const evidenceSource = ref(''), locator = ref(''), excerpt = ref(''), year = ref(''), notes = ref(''), verify = ref(false)
const detachReason = ref('')
const syntheticTest = computed(() => config.public.apiOrigin === 'http://localhost:8001')
const fieldErrors = computed(() => error.value instanceof ApiError ? catalogFieldIssues(error.value) : {})
const sourceHistoryDenied = computed(() => historyError.value instanceof ApiError && historyError.value.status === 403)
const sourceOptions = sourceTypes.map(value => ({ value, label: sourceType(value) }))
const statusOptions = [{ value: 'pending', label: 'Ожидают проверки / доработки' }, { value: 'approved', label: 'Одобрены' }, { value: 'rejected', label: 'Отклонены' }, { value: 'requires_amendment', label: 'Требуют доработки' }]
const reviewOptions = [{ value: 'approved', label: 'Одобрить источник' }, { value: 'rejected', label: 'Отклонить источник' }, { value: 'requires_amendment', label: 'Вернуть на доработку' }]
const activeSources = computed(() => [...new Set(claim.value?.evidence_records.filter(e => !e.is_detached).map(e => e.event_source_id) ?? [])])
function initializeDraft() {
  const value = source.value
  if (!value) return
  baseline.value = { title: value.title, author: value.author, source_type: value.source_type as SourceType, url: value.url, doi_or_isbn: value.doi_or_isbn }
  Object.assign(draft, { title: value.title, author: value.author ?? '', source_type: value.source_type, url: value.url ?? '', doi_or_isbn: value.doi_or_isbn ?? '' })
  initializedId.value = value.id
}
watch(() => source.value?.id, id => { if (id && initializedId.value !== id) { initializeDraft(); comments.value = ''; decision.value = 'requires_amendment'; evidenceSource.value = id } })
watch(() => c.sourceId.value, id => { sourceInput.value = id; if (initializedId.value !== id) { baseline.value = null; initializedId.value = ''; comments.value = '' } })
watch(() => c.claimId.value, id => { claimInput.value = id; locator.value = ''; excerpt.value = ''; year.value = ''; notes.value = ''; verify.value = false; detachReason.value = ''; evidenceSource.value = source.value?.id ?? '' })
function rebaseDraft() {
  if (!conflict.value || !baseline.value) return
  const latest = conflict.value
  const current: SourcePatch = { title: draft.title.trim(), author: draft.author.trim() || null, source_type: draft.source_type, url: draft.url.trim() || null, doi_or_isbn: draft.doi_or_isbn.trim() || null }
  for (const key of Object.keys(current) as (keyof SourcePatch)[]) {
    if (current[key] === baseline.value[key]) Object.assign(draft, { [key]: latest[key] ?? '' })
  }
  baseline.value = { title: latest.title, author: latest.author, source_type: latest.source_type as SourceType, url: latest.url, doi_or_isbn: latest.doi_or_isbn }
  source.value = latest; conflict.value = null; error.value = null
}
function patch() {
  if (!source.value || !baseline.value) return
  const value: SourcePatch = { title: draft.title.trim(), author: draft.author.trim() || null, source_type: draft.source_type, url: draft.url.trim() || null, doi_or_isbn: draft.doi_or_isbn.trim() || null }
  const body = Object.fromEntries(Object.entries(value).filter(([k,v]) => baseline.value![k as keyof SourcePatch] !== v)) as SourcePatch
  if (!Object.keys(body).length) { error.value = new Error('Изменений нет.'); return }
  c.prepare({ kind: 'patch', sourceId: source.value.id, body, baseline: { ...baseline.value } })
}
function review() { if (source.value) c.prepare({ kind: 'review', sourceId: source.value.id, body: { decision: decision.value, comments: comments.value.trim() }, latestReviewId: source.value.latest_review?.id ?? null }) }
function attach() { if (claim.value) c.prepare({ kind: 'attach', claimId: claim.value.id, body: { event_source_id: evidenceSource.value.trim(), citation_locator: locator.value.trim(), citation_excerpt: excerpt.value.trim(), applicable_academic_year: year.value || null, notes: notes.value.trim() || null, verify: verify.value } }) }
async function confirmAction() {
  const kind = confirmation.value?.kind, key = api.context(), id = c.sourceId.value
  await c.confirm()
  if (key === api.context() && id === c.sourceId.value && kind === 'patch' && !uncertain.value && notice.value && source.value) initializeDraft()
}
function peek(id: string) { inspectorId.value = id; inspector.value = true }
async function changeStatus() { await c.setQuery({ status: status.value as 'pending' | 'approved' | 'rejected' | 'requires_amendment', page: 1 }) }
let viewEpoch = 0
watch(() => [api.context(), route.query.source, route.query.claim], async () => {
  const epoch = ++viewEpoch, context = api.context(), requestedSource = route.query.source, requestedClaim = route.query.claim
  c.reset(); baseline.value = null; initializedId.value = ''; comments.value = ''; sourceInput.value = ''; claimInput.value = ''; inspector.value = false; inspectorId.value = null; tab.value = 'source'
  evidenceSource.value = ''; locator.value = ''; excerpt.value = ''; year.value = ''; notes.value = ''; verify.value = false; detachReason.value = ''; decision.value = 'requires_amendment'
  Object.assign(draft, { title: '', author: '', source_type: 'scientific_publication', url: '', doi_or_isbn: '' })
  await c.refresh()
  if (epoch !== viewEpoch || context !== api.context()) return
  if (typeof requestedSource === 'string') await c.selectSource(requestedSource)
  if (epoch !== viewEpoch || context !== api.context()) return
  if (typeof requestedClaim === 'string') { await c.selectClaim(requestedClaim); if (epoch === viewEpoch && context === api.context()) tab.value = 'evidence' }
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { viewEpoch++; c.reset() })
</script>
<template>
 <div class="fe011 catalog-workspace">
  <header class="fe011-heading"><p class="fe011-eyebrow">КУЛЬТУРНЫЙ КАТАЛОГ · РАБОЧЕЕ МЕСТО КУРАТОРА</p><h1>Источники и доказательства</h1><p>Экспертиза источника и подтверждение конкретного культурного утверждения — отдельные действия.</p></header>
  <UiAlert v-if="syntheticTest" tone="warning">Изолированный тестовый контур localhost:8001. Для проверок используйте только собственные синтетические источники и утверждения.</UiAlert>
  <UiAlert v-if="error" tone="error">{{ error.message }}<ul v-if="Object.keys(fieldErrors).length"><li v-for="(message,field) in fieldErrors" :key="field">{{ field }}: {{ message }}</li></ul></UiAlert>
  <UiAlert v-if="notice">{{ notice }}</UiAlert>
  <UiAlert v-if="needsReconcile" tone="warning">Запись принята сервером, но обновление сведений не завершено. Новые действия заблокированы до GET-сверки.<UiButton variant="secondary" :disabled="!!pending" @click="c.reconcile">Перечитать состояние</UiButton></UiAlert>
  <UiAlert v-if="uncertain" tone="warning">Результат {{ uncertain.kind === 'detach' ? 'открепления' : 'записи' }} неизвестен. Автоматического повтора не было. Свежие сведения ниже не доказывают отмену прежнего запроса.<div class="actions"><UiButton variant="secondary" :disabled="!!pending" @click="c.reconcile">Перечитать состояние</UiButton><UiButton v-if="reconciled" variant="secondary" :disabled="!!pending" @click="c.acknowledge">Сведения проверены — начать новое действие</UiButton></div></UiAlert>
  <details class="catalog-queue-disclosure" :open="!source && !claim"><summary>Очередь источников · {{ queue?.meta.total ?? 'загрузка' }}</summary><section class="fe011-panel catalog-queue"><div class="fe011-toolbar"><h2>Очередь источников</h2><UiButton variant="secondary" :loading="pending === 'queue'" :disabled="!!pending" @click="c.refresh">Обновить очередь</UiButton></div><div class="fe011-toolbar"><UiSelect v-model="status" label="Последнее экспертное решение" :options="statusOptions" :disabled="!!pending" @update:model-value="changeStatus" /><p class="muted">Очередь ограничена серверными полномочиями. Наличие источника в списке не даёт права его изменить.</p></div>
   <UiState v-if="pending === 'queue'" kind="loading" title="Загружаем очередь" />
   <div v-else-if="queue" class="catalog-queue-list"><article v-for="item in queue.data" :key="item.id" class="catalog-queue-item"><div><h3>{{ item.title }}</h3><p>{{ item.calendar_event?.title ?? 'Событие не указано' }}</p><p class="muted">{{ sourceType(item.source_type) }} · Регион {{ item.calendar_event?.region_code ?? 'не указан' }} · Связей с утверждениями: {{ item.claims_count }}</p><ProvenanceStatus :state="reviewState(item.latest_review?.decision)" /></div><div class="actions"><UiButton variant="secondary" :disabled="!!pending || (!!uncertain || needsReconcile)" @click="tab = 'source'; c.selectSource(item.id)">Открыть источник</UiButton><UiButton variant="secondary" :disabled="!!pending" @click="peek(item.id)">Быстрый просмотр</UiButton></div></article><p v-if="!queue.data.length">Источников с выбранным состоянием нет.</p><nav class="pagination" aria-label="Страницы источников"><UiButton variant="secondary" :disabled="!!pending || queue.meta.current_page <= 1" @click="c.setQuery({page:queue.meta.current_page-1})">Назад</UiButton><span>Страница {{ queue.meta.current_page }} из {{ Math.max(1,queue.meta.last_page) }} · Всего {{ queue.meta.total }}</span><UiButton variant="secondary" :disabled="!!pending || queue.meta.current_page >= queue.meta.last_page" @click="c.setQuery({page:queue.meta.current_page+1})">Далее</UiButton></nav></div>
  </section></details>
  <section class="fe011-panel fe011-form"><h2>Открыть источник или утверждение по ID</h2><div class="fe011-form-grid"><form class="fe011-form" @submit.prevent="tab = 'source'; c.selectSource(sourceInput.trim())"><UiField v-model="sourceInput" label="ID источника" :disabled="!!pending || (!!uncertain || needsReconcile)" required /><UiButton type="submit" variant="secondary" :disabled="!!pending || (!!uncertain || needsReconcile)">Загрузить источник</UiButton></form><form class="fe011-form" @submit.prevent="tab = 'evidence'; c.selectClaim(claimInput.trim())"><UiField v-model="claimInput" label="ID культурного утверждения" :disabled="!!pending || (!!uncertain || needsReconcile)" required /><UiButton type="submit" variant="secondary" :disabled="!!pending || (!!uncertain || needsReconcile)">Загрузить утверждение</UiButton></form></div></section>
  <UiState v-if="pending === 'source' || pending === 'claim'" kind="loading" title="Загружаем сведения каталога" />
  <nav v-if="source || claim" class="fe011-tabs" aria-label="Действия каталога"><button :disabled="!!pending || !source" :aria-pressed="tab === 'source'" @click="tab = 'source'">Источник</button><button :disabled="!!pending || !source" :aria-pressed="tab === 'edit'" @click="tab = 'edit'">Реквизиты</button><button :disabled="!!pending || !source" :aria-pressed="tab === 'review'" @click="tab = 'review'">Экспертное решение</button><button :disabled="!!pending || !source" :aria-pressed="tab === 'history'" @click="tab = 'history'">История решений</button><button :disabled="!!pending" :aria-pressed="tab === 'evidence'" @click="tab = 'evidence'">Доказательства</button><UiButton variant="secondary" :disabled="!!pending" @click="c.reconcile">Перечитать статусы</UiButton></nav>
  <UiCard v-if="source && tab === 'source'" class="fe011-panel"><SourceContent :source="source" /><div class="actions"><UiButton v-for="item in source.claims" :key="item.id" variant="secondary" :disabled="!!pending || (!!uncertain || needsReconcile)" @click="tab = 'evidence'; c.selectClaim(item.cultural_claim_id)">Доказательства: {{ item.culture_name ?? 'утверждение' }}</UiButton></div></UiCard>
  <form v-if="source && tab === 'edit'" class="fe011-panel fe011-form" @submit.prevent="patch"><h2>Библиографические реквизиты</h2><UiAlert v-if="conflict" tone="warning">На сервере появились изменения: <ul><li v-for="(value,key) in baseline" :key="key">{{ key }}: было «{{ value }}», сейчас «{{ conflict[key] }}»</li></ul>Ваши изменения сохраняются. Неизменённые вами поля будут взяты с сервера.<UiButton variant="secondary" @click="rebaseDraft">Обновить основу, сохранив мои изменения</UiButton></UiAlert><UiAlert tone="warning">Изменение реквизитов аннулирует прежнюю экспертизу источника и может лишить связанные сценарии и документы допуска.</UiAlert><UiField v-model="draft.title" label="Название источника" minlength="3" maxlength="500" required :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" :error="fieldErrors.title" /><UiField v-model="draft.author" label="Автор" maxlength="255" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" :error="fieldErrors.author" /><UiSelect v-model="draft.source_type" label="Вид источника" :options="sourceOptions" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" /><UiField v-model="draft.url" label="URL документа" maxlength="1000" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" :error="fieldErrors.url" /><UiField v-model="draft.doi_or_isbn" label="DOI / ISBN" maxlength="64" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" :error="fieldErrors.doi_or_isbn" /><div class="actions"><UiButton type="submit" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied">Сохранить реквизиты…</UiButton><UiButton variant="secondary" :disabled="!!pending" @click="initializeDraft">Заполнить из текущих данных</UiButton></div></form>
  <form v-if="source && tab === 'review'" class="fe011-panel fe011-form" @submit.prevent="review"><h2>Новое экспертное решение</h2><p>Источник: {{ source.title }}</p><ProvenanceStatus :state="reviewState(source.latest_review?.decision)" /><UiSelect v-model="decision" label="Решение эксперта" :options="reviewOptions" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" /><UiTextarea v-model="comments" label="Замечания и обоснование" required minlength="5" maxlength="2000" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied" :error="fieldErrors.comments" /><UiAlert>Одобрение источника не подтверждает связанные утверждения. Для каждого нужны локатор, цитата и отдельное подтверждение доказательства.</UiAlert><UiButton type="submit" :disabled="!!pending || (!!uncertain || needsReconcile) || sourceHistoryDenied">Подтвердить экспертное решение…</UiButton></form>
  <section v-if="source && tab === 'history'" class="fe011-panel fe011-form"><h2>История экспертных решений</h2><p>{{ source.title }}</p><UiState v-if="historyError" kind="error" title="История недоступна" :description="historyError.message" /><ReviewHistory v-else :reviews="reviews" /></section>
  <UiAlert v-if="source && historyError && tab !== 'history'" tone="warning">{{ historyError.message }} Полномочия изменения нельзя определить по видимости очереди.</UiAlert>
  <template v-if="tab === 'evidence'">
   <UiAlert v-if="!claim">Загрузите конкретное утверждение по ID или выберите его в карточке источника. Список всех утверждений этим API не предоставляется.</UiAlert>
   <template v-else><section class="fe011-panel"><ClaimContent :claim="claim" /></section><form class="fe011-panel fe011-form" @submit.prevent="attach"><h2>Прикрепить доказательство</h2><p>Утверждение: {{ claim.claim_text }}</p><UiField v-model="evidenceSource" label="ID доказывающего источника" required :disabled="!!pending || (!!uncertain || needsReconcile)" :error="fieldErrors.event_source_id" /><UiField v-model="locator" label="Локатор цитаты" required minlength="3" maxlength="255" :disabled="!!pending || (!!uncertain || needsReconcile)" :error="fieldErrors.citation_locator" /><UiTextarea v-model="excerpt" label="Дословная цитата" required minlength="10" maxlength="2000" :disabled="!!pending || (!!uncertain || needsReconcile)" :error="fieldErrors.citation_excerpt" /><UiField v-model="year" label="Применимый учебный год (необязательно)" placeholder="2026-2027" :disabled="!!pending || (!!uncertain || needsReconcile)" :error="fieldErrors.applicable_academic_year" /><UiTextarea v-model="notes" label="Примечание к доказательству" maxlength="2000" :disabled="!!pending || (!!uncertain || needsReconcile)" :error="fieldErrors.notes" /><label class="fe011-checkbox"><input v-model="verify" type="checkbox" :disabled="!!pending || (!!uncertain || needsReconcile)"> Подтвердить именно это утверждение на основании цитаты</label><p class="muted">Без отметки доказательство добавляется как неподтверждённое. Фактический допуск определяет серверная проверка.</p><UiButton type="submit" :disabled="!!pending || (!!uncertain || needsReconcile)">Прикрепить доказательство…</UiButton></form>
    <section class="fe011-panel fe011-form"><h2>Открепить доказательство</h2><UiAlert tone="warning">Открепляются все активные свидетельства выбранного источника для этого утверждения. История сохраняется; ранее подтверждённые сценарии и экспорты могут потерять допуск.</UiAlert><UiTextarea v-model="detachReason" label="Причина открепления" maxlength="2000" :disabled="!!pending || (!!uncertain || needsReconcile)" /><article v-for="id in activeSources" :key="id" class="catalog-detach-row"><p>{{ claim.evidence_records.find(e => e.event_source_id === id)?.source?.title ?? id }}</p><ProvenanceStatus :state="evidenceState(claim.evidence_records.find(e => e.event_source_id === id && !e.is_detached)!)" /><UiButton variant="danger" :disabled="!!pending || (!!uncertain || needsReconcile) || !detachReason.trim()" @click="c.prepare({kind:'detach',claimId:claim.id,sourceId:id,reason:detachReason})">Открепить источник…</UiButton></article><p v-if="!activeSources.length">Активных доказательств для открепления нет.</p></section>
   </template>
  </template>
  <UiModal :model-value="!!confirmation" :title="confirmation?.kind === 'detach' ? 'Открепить доказательства источника?' : confirmation?.kind === 'attach' ? 'Прикрепить доказательство утверждения?' : confirmation?.kind === 'patch' ? 'Изменить реквизиты источника?' : 'Зафиксировать экспертное решение?'" @update:model-value="value => { if (!value) confirmation = null }"><template v-if="confirmation"><p v-if="'sourceId' in confirmation">Источник: {{ confirmation.sourceId }}</p><p v-if="'claimId' in confirmation">Утверждение: {{ confirmation.claimId }}</p><p v-if="confirmation.kind === 'review'">{{ reviewState(confirmation.body.decision).label }} · {{ confirmation.body.comments }}</p><p v-if="confirmation.kind === 'attach'">Источник: {{ confirmation.body.event_source_id }} · Локатор: {{ confirmation.body.citation_locator }}. {{ confirmation.body.verify ? 'Запрошено подтверждение конкретного утверждения.' : 'Добавляется неподтверждённое доказательство.' }}</p><p v-if="confirmation.kind === 'detach'">Причина: {{ confirmation.reason }}. Все активные связи этого источника с утверждением будут отозваны.</p><UiAlert tone="warning">Изменения доказательств могут аннулировать допуск сценариев и экспортов. Автоматической повторной подписи не будет.</UiAlert><div class="actions"><UiButton variant="secondary" @click="confirmation = null">Отмена</UiButton><UiButton :variant="confirmation.kind === 'detach' ? 'danger' : 'primary'" :loading="!!pending" @click="confirmAction">Подтвердить действие</UiButton></div></template></UiModal>
  <SourceInspector v-model="inspector" :source-id="inspectorId" />
  <p class="muted">{{ source ? `Источник прочитан: ${displayDate(source.created_at)}` : 'Выберите источник для просмотра и экспертизы.' }}</p>
 </div>
</template>
