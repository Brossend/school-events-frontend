<script setup lang="ts">
import { computed } from 'vue'
import type { PilotMetrics } from '~/types/pilot'
const props = defineProps<{ metrics: PilotMetrics; synthetic?: boolean }>()
const completed = computed(() => props.metrics.is_pilot_completed && props.metrics.sample_size >= props.metrics.target_sample_size && props.metrics.audited_responses_count >= props.metrics.sample_size && props.metrics.critical_cultural_errors_count === 0)
const cards = computed(() => {
  const m = props.metrics, b = m.sample_breakdown
  return [
    { key: 'time_saving_ge_50', title: 'Сокращение времени', value: m.median_relative_time_saving_percent, unit: '%', goal: 'Медиана ≥50%', sample: `N=${m.sample_size}`, description: 'По времени подготовки, указанному педагогами.' },
    { key: 'personalization_ge_70', title: 'Выбор персонализации', value: m.personalization_choice_percent, unit: '%', goal: 'Доля ≥70%', sample: `${b.personalization.selected} из ${b.personalization.total}`, description: 'Ответы анкеты; не результат причинного A/B-эксперимента.' },
    { key: 'manual_edit_under_20_ge_70', title: 'Ручные доработки ≤20%', value: m.manual_edit_under_20_percent_ratio, unit: '%', goal: 'Доля анкет ≥70%', sample: `${b.manual_edits.under_20_percent} из ${b.manual_edits.total}`, description: 'Доля педагогов с указанным объёмом доработок.' },
    { key: 'cultural_usage_ge_60', title: 'Культурный контекст', value: m.cultural_context_usage_percent, unit: '%', goal: 'Использование ≥60%', sample: `${b.cultural_context.used} из ${b.cultural_context.total}`, description: 'Фактическое использование по ответам анкеты.' },
    { key: 'cultural_usefulness_ge_4', title: 'Полезность контекста', value: m.average_cultural_usefulness_score, unit: '/5', goal: 'Средняя оценка ≥4/5', sample: `Оценок: ${b.cultural_context.rated_count}`, description: 'Среднее только по использовавшим и оценившим контекст.' },
    { key: 'zero_critical_cultural_errors', title: 'Критические ошибки', value: m.critical_cultural_errors_count, unit: '', goal: '0 ошибок при полном покрытии', sample: `${m.audited_responses_count} из ${m.sample_size}`, description: 'Учитываются эффективные завершённые экспертные заключения.' },
  ] as const
})
function status(key: keyof PilotMetrics['criteria_status']) {
  const m = props.metrics
  if (key === 'zero_critical_cultural_errors' && m.critical_cultural_errors_count === 0 && m.audited_responses_count < m.sample_size) return 'pending_review'
  return m.criteria_status[key]
}
function label(value: string) { return ({ pass: 'PASS · критерий достигнут', fail: 'FAIL · критерий не достигнут', pending_data: 'Недостаточно данных', pending_review: 'Ожидается экспертиза' })[value] ?? value }
</script>
<template>
  <div class="pilot-metrics">
    <UiAlert v-if="synthetic" tone="warning">Синтетический тестовый контур · агрегаты включают синтетические записи. Это не результаты настоящего пилота.</UiAlert>
    <div class="fe010-summary">
      <div><p class="fe010-eyebrow">ПОЛНОТА ИССЛЕДОВАНИЯ</p><h2>{{ metrics.status === 'no_data' ? 'Анкет пока нет' : completed ? 'Пилот завершён по данным сервера' : metrics.is_expert_evaluation_completed && (metrics.critical_cultural_errors_count ?? 0) > 0 ? 'Экспертиза завершена · выявлены критические ошибки' : metrics.is_survey_completed ? 'Анкеты собраны · экспертиза не завершена' : 'Продолжается сбор анкет' }}</h2><p>Ответов: <strong>{{ metrics.sample_size }} из {{ metrics.target_sample_size }}</strong> · Экспертиза: <strong>{{ metrics.audited_responses_count }} из {{ metrics.sample_size }}</strong></p><p>Покрытие экспертизой: {{ metrics.expert_review_coverage_percent === null ? 'нет данных' : `${metrics.expert_review_coverage_percent}%` }}. Ожидают проверки: {{ metrics.pending_expert_reviews_count }}.</p></div>
      <UiBadge :tone="completed ? 'success' : 'warning'">{{ metrics.status === 'no_data' ? 'no_data' : completed ? 'Завершено' : 'Исследование продолжается' }}</UiBadge>
    </div>
    <h2>Критерии и доказательства</h2>
    <div class="fe010-kpi-grid">
      <article v-for="card in cards" :key="card.key" class="fe010-kpi"><p class="fe010-kpi__title">{{ card.title }}</p><p class="fe010-kpi__target">Целевое значение: {{ card.goal }}</p><p class="fe010-kpi__value">Фактический результат: {{ card.value === null ? 'нет данных' : `${card.value}${card.unit}` }}</p><UiBadge :tone="status(card.key) === 'pass' ? 'success' : 'warning'">{{ label(status(card.key)) }}</UiBadge><p class="muted">{{ card.sample }}</p><p>{{ card.description }}</p></article>
    </div>
    <UiAlert>Статус отдельного критерия не означает завершения исследования. Самоотчёты и предпочтения педагогов не доказывают статистическую эффективность. Отсутствие экспертной проверки не равно нулю ошибок.</UiAlert>
  </div>
</template>
