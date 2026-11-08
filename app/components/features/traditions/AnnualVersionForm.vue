<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { AnnualInput, TraditionDetail } from '~/types/traditions'
import type { ApiError } from '~/utils/api-error'
import { annualYearIssue, suggestedAnnualYear } from '~/utils/traditions'
const props = defineProps<{ tradition: TraditionDetail; pending?: boolean; error?: ApiError | null }>()
const emit = defineEmits<{ submit: [input: AnnualInput]; cancel: [] }>()
const draft = reactive({ year: suggestedAnnualYear(props.tradition.versions), date: '', participants: '', notes: '' })
const issues = ref<Record<string, string>>({})
function issue(field: string) { return issues.value[field] || props.error?.field(field) }
function submit() {
  if (props.pending) return
  issues.value = {}
  const yearError = annualYearIssue(draft.year.trim(), props.tradition.versions.map(v => v.academic_year))
  if (yearError) issues.value.academic_year = yearError
  if (draft.notes.length > 2000) issues.value.notes = 'Заметки: не более 2000 символов.'
  if (draft.date && !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) issues.value.planned_date = 'Укажите дату в календаре.'
  if (Object.keys(issues.value).length) return
  emit('submit', { academic_year: draft.year.trim(), notes: draft.notes.trim() || null, parameters_snapshot: {
    concept: { title: props.tradition.title, description: props.tradition.description, established_year: props.tradition.established_year },
    planned_date: draft.date || null, participants: draft.participants.trim() || null,
  } })
}
</script>
<template><form class="tradition-form" novalidate @submit.prevent="submit"><p class="muted">Концепция сохранится отдельным снимком. Предыдущие версии не изменятся.</p><UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert><UiField v-model="draft.year" label="Учебный год" required placeholder="2026-2027" :disabled="pending" :error="issue('academic_year')" /><UiField v-model="draft.date" label="Планируемая дата" type="date" :disabled="pending" :error="issue('planned_date')" hint="Необязательно. Дата не подтверждает культурные источники." /><UiField v-model="draft.participants" label="Участники" placeholder="Класс, школа или семьи" :disabled="pending" /><UiTextarea v-model="draft.notes" label="Заметки к версии" maxlength="2000" :disabled="pending" :error="issue('notes')" /><details><summary>Данные, которые сохранятся</summary><p>{{ tradition.title }}</p><p>{{ tradition.description }}</p><p>Год основания: {{ tradition.established_year ?? 'не указан' }}</p></details><UiAlert tone="warning">Даты и культурные источники не наследуют статус проверки. Новая версия не запускает генерацию сценария.</UiAlert><UiAlert v-if="tradition.is_archived">Традиция останется в архиве после добавления версии.</UiAlert><div class="actions"><UiButton variant="secondary" :disabled="pending" @click="emit('cancel')">Отмена</UiButton><UiButton type="submit" :loading="pending">Создать ежегодную версию</UiButton></div></form></template>
