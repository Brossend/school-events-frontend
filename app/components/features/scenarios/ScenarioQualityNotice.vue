<script setup lang="ts">
import { teacherField, teacherText, qualityAdvice } from '~/utils/teacher-language'
import type { QualityReview } from '~/types/generation'
defineProps<{ review?: QualityReview | null }>()
</script>
<template>
  <UiAlert class="quality-notice" :tone="review?.status === 'blocked' ? 'error' : 'warning'">
    <strong>{{ review?.status === 'blocked' ? 'Требуется исправление материала' : 'Требуется содержательная проверка педагогом' }}</strong>
    <p>{{ review?.technical_checks === 'passed' ? 'Формальные проверки качества пройдены. ' : '' }}Автоматическая модерация и подтверждение отдельных источников не удостоверяют весь текст. Проверьте задания, ответы, историю и доступность участия перед подтверждением педагогом.</p>
    <p v-if="!review">Дополнительный отчёт качества недоступен. Материал нельзя считать автоматически проверенным.</p>
    <details v-if="review?.findings.length"><summary>Замечания: {{ review.findings.length }}</summary><ul><li v-for="(finding, index) in review.findings" :key="index"><strong>{{ qualityAdvice(finding.path, finding.message) }}</strong><p v-if="finding.text">{{ teacherText(finding.text) }}</p><p class="muted">{{ teacherField(finding.path) }}</p></li></ul></details>
  </UiAlert>
</template>

<style scoped>
.quality-notice code { white-space: normal; overflow-wrap: anywhere; }
.quality-notice li { margin-top: 12px; }
.quality-notice p { overflow-wrap: anywhere; }
</style>
