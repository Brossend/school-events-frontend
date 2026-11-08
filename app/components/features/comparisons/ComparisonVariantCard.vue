<script setup lang="ts">
import type { ComparisonType, ComparisonVariant } from '~/types/comparisons'
import { comparisonObjects, comparisonText, variantTitle } from '~/utils/comparisons'
import { safeSourceUrl } from '~/utils/provenance'

const props = defineProps<{ variant: ComparisonVariant; type: ComparisonType; selected: boolean; selectable: boolean; pending?: boolean }>()
defineEmits<{ choose: [] }>()
const expanded = ref(false)
const payload = computed(() => props.variant.scenario_payload)
const stages = computed(() => comparisonObjects(payload.value.stages))
const roles = computed(() => comparisonObjects(payload.value.roles))
const claims = computed(() => props.variant.cultural_provenance_data ?? (Array.isArray(payload.value.cultural_claims) ? payload.value.cultural_claims : []))
const unavailable = computed(() => !props.variant.is_cultural_available || !props.variant.scenario_id)
</script>
<template>
  <article :class="['comparison-card', { 'comparison-card--b': variant.variant_key === 'B', 'comparison-card--selected': selected }]">
    <div class="row"><h2>{{ variantTitle(type, variant.variant_key) }}</h2><UiBadge>{{ selected ? `Выбран ${variant.variant_key}` : `Вариант ${variant.variant_key}` }}</UiBadge></div>
    <UiAlert v-if="unavailable" tone="warning">{{ comparisonText(payload.message) || 'Сохранённый вариант недоступен.' }}</UiAlert>
    <template v-else>
      <section class="comparison-section"><h3>Концепция и цель</h3><p>{{ comparisonText(payload.concept) || 'Концепция не предоставлена' }}</p><p>{{ comparisonText(payload.pedagogical_goal) }}</p></section>
      <section class="comparison-section"><h3>Участники</h3><p>{{ comparisonText(payload.target_audience) || 'Параметры не предоставлены' }}</p></section>
      <section class="comparison-section"><h3>Ход занятия</h3><ol v-if="stages.length"><li v-for="(stage, index) in stages" :key="index"><strong>{{ comparisonText(stage.title) }}</strong><span v-if="stage.duration_minutes"> · {{ comparisonText(stage.duration_minutes) }} мин.</span><p>{{ comparisonText(stage.student_actions) }}</p><template v-if="expanded"><p>{{ comparisonText(stage.teacher_actions) }}</p><p>{{ comparisonText(stage.dialogue_prompts) }}</p><p>{{ comparisonText(stage.teacher_tips) }}</p><p>{{ comparisonText(stage.transition_text) }}</p></template></li></ol><p v-else>Этапы не предоставлены сервером.</p></section>
      <section class="comparison-section"><h3>Роли и организация</h3><ul v-if="roles.length"><li v-for="(role, index) in roles" :key="index"><strong>{{ comparisonText(role.role_name) }}</strong><p>{{ comparisonText(role.description) }}</p><p v-if="expanded">{{ comparisonText(role.specific_tasks) }}</p></li></ul><p v-else>Роли не предоставлены сервером.</p></section>
      <section class="comparison-section"><h3>Персонализация</h3><p>{{ comparisonText(payload.format) || 'Формат не предоставлен' }}</p><p>{{ comparisonText(payload.pedagogical_mechanism) }}</p><template v-if="expanded"><h3>Материалы</h3><p>{{ comparisonText(payload.materials) || 'Не предоставлены' }}</p><h3>Педагогические задачи</h3><p>{{ comparisonText(payload.pedagogical_tasks) || 'Не предоставлены' }}</p><h3>Ожидаемые результаты</h3><p>{{ comparisonText(payload.expected_outcomes) || 'Не предоставлены' }}</p></template></section>
    </template>
    <section class="comparison-section comparison-provenance"><h3>Культурные источники</h3><p v-if="!claims.length">Культурные утверждения не предоставлены.</p><template v-for="(claim, index) in comparisonObjects(claims)" :key="index"><p><strong>{{ comparisonText(claim.culture_name) }}</strong> {{ comparisonText(claim.claim_text) }}</p><p class="muted">Достоверность требует проверки: API сравнения не передаёт актуальный статус свидетельств.</p><ul><li v-for="(source, sourceIndex) in comparisonObjects(claim.source_references)" :key="sourceIndex"><a v-if="safeSourceUrl(comparisonText(source.url_or_archive_ref))" :href="safeSourceUrl(comparisonText(source.url_or_archive_ref))" target="_blank" rel="noopener noreferrer">{{ comparisonText(source.title) || comparisonText(source.source_title) || 'Источник' }}</a><span v-else>{{ comparisonText(source.title) || comparisonText(source.source_title) || 'Источник без названия' }}</span><p>{{ comparisonText(source.citation_locator) }}</p><p>{{ comparisonText(source.citation_excerpt) }}</p></li></ul></template></section>
    <div class="comparison-actions"><UiButton v-if="!unavailable" variant="secondary" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Свернуть сценарий' : 'Просмотреть сценарий' }}</UiButton><NuxtLink v-if="variant.scenario_id" :to="`/scenarios/${variant.scenario_id}`">Открыть сохранённый документ</NuxtLink><UiButton v-if="selectable && !unavailable" :disabled="pending" @click="$emit('choose')">Выбрать вариант {{ variant.variant_key }}</UiButton></div>
  </article>
</template>
