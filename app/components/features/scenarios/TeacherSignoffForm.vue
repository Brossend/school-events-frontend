<script setup lang="ts">
import type { TeacherChecklist } from '~/types/editor'
const model = defineModel<TeacherChecklist>({ required: true })
defineProps<{ block: string; warnings: boolean; busy?: boolean }>()
defineEmits<{ confirm: [] }>()
</script>
<template><form class="teacher-signoff" @submit.prevent="$emit('confirm')"><h3>Подтверждаю, что лично проверил(а):</h3><fieldset :disabled="busy"><label><input v-model="model.safety_checked" type="checkbox"> Безопасность и доступность заданий</label><label><input v-model="model.timing_fit" type="checkbox"> Хронометраж и соответствие классу</label><label><input v-model="model.cultural_context_approved" type="checkbox"> Культурный контекст и первоисточники</label><label v-if="warnings"><input v-model="model.warnings_acknowledged" type="checkbox"> Я ознакомился(ась) со всеми предупреждениями</label><UiTextarea v-model="model.teacher_notes" label="Заметки педагога" rows="3" /></fieldset><UiAlert v-if="block" tone="warning">{{ block }}</UiAlert><p class="muted">Допуск относится только к этой ревизии и состоянию доказательств. Сервер повторно проверит условия при отправке.</p><UiButton type="submit" :disabled="!!block || busy" :loading="busy">Подтвердить проверку</UiButton></form></template>
