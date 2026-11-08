<script setup lang="ts">
import type { Comparison, ComparisonSelection, VariantKey } from '~/types/comparisons'
import { selectionBlock } from '~/utils/comparisons'
const props = defineProps<{ comparison: Comparison; pending: boolean; confirmation: ComparisonSelection | null; uncertain: boolean }>()
const emit = defineEmits<{ prepare: [body: ComparisonSelection]; confirm: []; cancel: []; reconcile: [] }>()
const selected = defineModel<VariantKey>('selected', { default: 'A' })
const reason = ref(''), usefulness = ref('')
const modalOpen = computed({ get: () => !!props.confirmation, set: (value: boolean) => { if (!value) emit('cancel') } })
const body = computed<ComparisonSelection>(() => ({ selected_variant: selected.value, selection_reason: reason.value, ...(props.comparison.comparison_type === 'cultural_context' && usefulness.value ? { cultural_usefulness_rating: Number(usefulness.value) } : {}) }))
const blocked = computed(() => selectionBlock(props.comparison, body.value))
watch(() => props.comparison.id, () => { reason.value = ''; usefulness.value = ''; selected.value = 'A' })
</script>
<template>
  <section class="comparison-selection ui-card">
    <template v-if="comparison.selected_variant"><h2>Выбор зафиксирован: вариант {{ comparison.selected_variant }}</h2><p>{{ comparison.selection_reason }}</p><p class="muted">{{ comparison.selection_recorded_at }}<span v-if="comparison.cultural_usefulness_rating != null"> · Полезность: {{ comparison.cultural_usefulness_rating }}/5</span></p><p>Выбор неизменяем. Предпочтение педагога не является доказательством статистической эффективности.</p></template>
    <template v-else><h2>Какой вариант вы предпочитаете?</h2><p>Выбор и причина сохраняются один раз. Перед записью мы перечитаем состояние сравнения.</p><form class="comparison-form" @submit.prevent="emit('prepare', body)"><UiSelect v-model="selected" label="Предпочтительный вариант" :options="[{ value: 'A', label: 'Вариант A' }, ...(comparison.is_cultural_available ? [{ value: 'B', label: 'Вариант B' }] : [])]" :disabled="pending || uncertain" /><UiTextarea v-model="reason" label="Почему вы выбрали этот вариант?" hint="Не менее 10 символов. Не указывайте персональные данные учеников." :disabled="pending || uncertain" required minlength="10" /><UiSelect v-if="comparison.comparison_type === 'cultural_context'" v-model="usefulness" label="Полезность культурного контекста (необязательно)" :options="[{ value: '', label: 'Без оценки' }, ...[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} из 5` }))]" :disabled="pending || uncertain" /><p v-if="blocked" class="muted">{{ blocked }}</p><UiButton type="submit" :disabled="!!blocked || pending || uncertain">Подтвердить выбор…</UiButton></form></template>
    <UiAlert v-if="uncertain" tone="warning">Результат записи неизвестен. Автоматический повтор отключён.<UiButton variant="secondary" :disabled="pending" @click="emit('reconcile')">Перечитать выбор</UiButton></UiAlert>
    <UiModal v-model="modalOpen" title="Зафиксировать неизменяемый выбор?"><template v-if="confirmation"><p>Вы выбираете вариант {{ confirmation.selected_variant }}. Изменить выбор после сохранения нельзя.</p><blockquote>{{ confirmation.selection_reason }}</blockquote><p v-if="confirmation.cultural_usefulness_rating != null">Полезность: {{ confirmation.cultural_usefulness_rating }}/5</p><div class="comparison-actions"><UiButton :disabled="pending" @click="emit('confirm')">Зафиксировать вариант {{ confirmation.selected_variant }}</UiButton><UiButton variant="secondary" :disabled="pending" @click="emit('cancel')">Отмена</UiButton></div></template></UiModal>
  </section>
</template>
