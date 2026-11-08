<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { TraditionInput } from '~/types/traditions'
import type { ApiError } from '~/utils/api-error'
import { metadataIssues } from '~/utils/traditions'
const props = defineProps<{ initial?: TraditionInput; editing?: boolean; pending?: boolean; error?: ApiError | null }>()
const emit = defineEmits<{ submit: [input: TraditionInput]; cancel: [] }>()
const draft = reactive({ title: props.initial?.title ?? '', description: props.initial?.description ?? '', year: props.initial?.established_year?.toString() ?? '' })
const issues = ref<Record<string, string>>({})
function issue(field: string) { return issues.value[field] || props.error?.field(field) }
function submit() {
  if (props.pending) return
  const input = { title: draft.title.trim(), description: draft.description.trim(), established_year: draft.year === '' ? null : Number(draft.year) }
  issues.value = metadataIssues(input, !!props.editing)
  if (!Object.keys(issues.value).length) emit('submit', input)
}
</script>
<template><form class="tradition-form" novalidate @submit.prevent="submit"><UiAlert v-if="error" tone="error">{{ error.message }}</UiAlert><UiField v-model="draft.title" label="Название традиции" required maxlength="255" :disabled="pending" :error="issue('title')" /><UiTextarea v-model="draft.description" label="Описание и концепция" required :maxlength="editing ? 5000 : undefined" :disabled="pending" :error="issue('description')" /><UiField v-model="draft.year" label="Год основания" type="number" min="1800" :max="editing ? new Date().getFullYear() : 2100" :disabled="pending" :error="issue('established_year')" hint="Необязательное поле" /><div class="actions"><UiButton variant="secondary" :disabled="pending" @click="emit('cancel')">Отмена</UiButton><UiButton type="submit" :loading="pending">{{ editing ? 'Сохранить изменения' : 'Создать традицию' }}</UiButton></div></form></template>
