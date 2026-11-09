<script setup lang="ts">
import { ref, shallowRef, computed, onBeforeUnmount } from 'vue'
import type { PilotResponse } from '~/types/pilot'
import { createPilotMutation, isolatedPilotOrigin } from '~/utils/pilot-mutation'
const api = usePublicPilotApi(), config = useRuntimeConfig()
const isolated = isolatedPilotOrigin(config.public.apiOrigin)
const token = ref(''), scenario = ref(''), comparison = ref(''), baseline = ref(''), ai = ref(''), edits = ref('')
const personalized = ref(''), cultural = ref(''), usefulness = ref(''), feedback = ref('')
const mutation = createPilotMutation(() => 'public-questionnaire'), { pending, uncertain, error } = mutation
const submitted = shallowRef<PilotResponse | null>(null), confirmation = ref(false)
const usedInvitation = ref(false)
const uuid = (v: string) => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(v)
const valid = computed(() => token.value.trim() && uuid(scenario.value.trim()) && (!comparison.value || uuid(comparison.value.trim())) && /^\d+$/.test(baseline.value) && Number(baseline.value) >= 1 && /^\d+$/.test(ai.value) && edits.value !== '' && Number(edits.value) >= 0 && Number(edits.value) <= 100 && ['yes', 'no'].includes(personalized.value) && ['yes', 'no'].includes(cultural.value) && (cultural.value !== 'yes' || /^[1-5]$/.test(usefulness.value)))
async function submit() {
  if (!valid.value || pending.value || uncertain.value || submitted.value || usedInvitation.value) return
  confirmation.value = false
  const result = await mutation.run(signal => api.submit({
    invite_token: token.value.trim(), scenario_id: scenario.value.trim(),
    prep_time_baseline_minutes: Number(baseline.value), prep_time_ai_minutes: Number(ai.value),
    manual_edit_percentage: Number(edits.value), personalization_selected: personalized.value === 'yes',
    cultural_context_used: cultural.value === 'yes', cultural_usefulness_score: cultural.value === 'yes' ? Number(usefulness.value) : null,
    comparison_id: comparison.value.trim() || null, feedback_text: feedback.value.trim() || null,
  }, signal))
  if (result) { submitted.value = result; token.value = ''; feedback.value = '' }
  if (uncertain.value) token.value = ''
  if (error.value instanceof Error && 'status' in error.value && error.value.status === 409) { usedInvitation.value = true; token.value = ''; feedback.value = '' }
}
function freshForm() { usedInvitation.value = false; mutation.reset(); token.value = ''; scenario.value = ''; comparison.value = ''; baseline.value = ''; ai.value = ''; edits.value = ''; personalized.value = ''; cultural.value = ''; usefulness.value = ''; feedback.value = ''; confirmation.value = false }
onBeforeUnmount(() => { token.value = ''; feedback.value = ''; mutation.reset() })
const yesNo = [{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }]
</script>
<template>
  <section class="fe010 pilot-questionnaire">
    <header class="fe010-heading"><p class="fe010-eyebrow">ПИЛОТ · ОБРАТНАЯ СВЯЗЬ ПЕДАГОГА</p><h1>Протокол тестирования</h1><p>Одна дата и одинаковая задача для обеих версий. Заполняйте результаты только по факту наблюдения.</p></header>
    <UiAlert v-if="isolated" tone="warning">Синтетический тестовый контур. Эта анкета не является результатом настоящего исследования.</UiAlert>
    <UiCard v-if="submitted" class="fe010-panel" role="status"><h2>Анкета принята</h2><p>Спасибо за обратную связь. Приглашение использовано; повторная отправка недоступна.</p><p>Код ответа для организатора: <code>{{ submitted.id }}</code></p><p>Сокращение времени по расчёту сервера: {{ submitted.relative_time_saving_percent }}%.</p><UiBadge v-if="submitted.is_synthetic" tone="warning">Синтетические данные</UiBadge></UiCard>
    <UiCard v-else-if="usedInvitation" class="fe010-panel fe010-form" role="status"><h2>Приглашение уже использовано</h2><p>Сервер сообщил, что анкета по этому токену уже отправлена. Повторная подача заблокирована. Данные ранее сохранённого ответа здесь недоступны.</p><UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert><UiButton variant="secondary" @click="freshForm">Новая анкета с другим приглашением</UiButton></UiCard>
    <form v-else class="fe010-panel fe010-form" autocomplete="off" @submit.prevent="confirmation = true">
      <UiField v-model="token" label="Одноразовый токен приглашения" type="password" autocomplete="off" :disabled="pending || uncertain" required hint="Получите у организатора. Токен не сохраняется в браузере и не передаётся в URL." />
      <UiField v-model="scenario" label="ID оцениваемого сценария" :disabled="pending || uncertain" required hint="Сценарий должен принадлежать школе приглашения." />
      <UiField v-model="comparison" label="ID A/B-сравнения (необязательно)" :disabled="pending || uncertain" />
      <div class="fe010-form-grid"><UiField v-model="baseline" label="Подготовка без ИИ, минуты" type="number" min="1" step="1" required :disabled="pending || uncertain" /><UiField v-model="ai" label="Подготовка с ИИ, минуты" type="number" min="0" step="1" required :disabled="pending || uncertain" /></div>
      <UiField v-model="edits" label="Объём ручных доработок, %" type="number" min="0" max="100" step="0.01" required :disabled="pending || uncertain" hint="Введите процент фактически выполненных доработок." />
      <UiSelect v-model="personalized" label="Выбрали персонализированный сценарий?" :options="yesNo" placeholder="Выберите ответ" :disabled="pending || uncertain" required />
      <UiSelect v-model="cultural" label="Использовали культурный контекст?" :options="yesNo" placeholder="Выберите ответ" :disabled="pending || uncertain" required />
      <UiSelect v-if="cultural === 'yes'" v-model="usefulness" label="Полезность культурного контекста" :options="[1,2,3,4,5].map(n => ({value:String(n),label:`${n} из 5`}))" placeholder="Оцените полезность" :disabled="pending || uncertain" required />
      <UiTextarea v-model="feedback" label="Отзыв (необязательно)" :maxlength="5000" :disabled="pending || uncertain" hint="Не указывайте ФИО и персональные сведения учащихся." />
      <UiAlert v-if="error" tone="error">{{ error.message }}<p v-if="uncertain">Подтверждение отправки не получено. Перед новой попыткой обратитесь к организатору; не отправляйте анкету повторно.</p></UiAlert>
      <UiButton type="submit" :disabled="!valid || uncertain" :loading="pending">Отправить анкету</UiButton>
      <p class="muted">Время сокращения вычисляет сервер. Ответ описывает ваш опыт и не доказывает причинную эффективность ИИ.</p>
    </form>
    <UiModal v-model="confirmation" title="Отправить анкету один раз?"><p>После отправки это приглашение нельзя использовать повторно. Проверьте фактические значения.</p><div class="actions"><UiButton variant="secondary" @click="confirmation = false">Вернуться</UiButton><UiButton :disabled="!valid || uncertain" :loading="pending" @click="submit">Подтвердить отправку</UiButton></div></UiModal>
  </section>
</template>
