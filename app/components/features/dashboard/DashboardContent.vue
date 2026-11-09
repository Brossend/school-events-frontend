<script setup lang="ts">
import { computed } from 'vue'
import type { Dashboard } from '~/types/events'
import { academicYear, annualDate, eventPath, eventTypeLabel, formatDate, scenarioPath } from '~/utils/calendar'
const props = defineProps<{ dashboard: Dashboard; name: string }>()
const lead = computed(() => props.dashboard.upcoming_events[0])
const statuses = { draft: 'Черновик', completed: 'Проверен педагогом', archived: 'В архиве' }
</script>
<template>
  <div class="dashboard-flow">
    <div class="page-heading"><div><h1>Здравствуйте, {{ name.split(' ')[0] }}!</h1><p class="muted">Спланируем событие, которое объединит класс.</p></div><UiBadge class="academic-badge">{{ academicYear() }}</UiBadge></div>
    <section class="dashboard-hero" aria-label="Подготовка мероприятия">
      <div class="dashboard-hero__copy"><span class="hero-badge">Сбер × УрФУ · ИИ-помощник</span><h2>Идея события.<br>Сценарий под ваш класс.</h2><p>Выберите событие, класс и ресурсы. ИИ соберёт сценарий, а вы проверите детали.</p><NuxtLink to="/constructor" class="ui-button hero-action"><img src="/icons/plus.svg" width="17" height="17" alt="">Создать мероприятие</NuxtLink></div>
      <NuxtLink v-if="lead" :to="eventPath(lead.id)" class="hero-occasion"><span>БЛИЖАЙШИЙ ПОВОД</span><strong>{{ String(lead.fixed_day).padStart(2, '0') }}</strong><p>{{ formatDate((lead.next_date ?? annualDate(lead.fixed_month, lead.fixed_day)), { month: 'long', day: undefined, year: undefined }) }}</p><h3>{{ lead.title }}</h3><small>{{ eventTypeLabel(lead.event_type) }}</small></NuxtLink>
    </section>
    <div class="section-heading"><h2>Ближайшие события</h2><NuxtLink to="/calendar">Календарь →</NuxtLink></div>
    <div v-if="dashboard.upcoming_events.length" class="upcoming-grid"><EventCard v-for="event in dashboard.upcoming_events" :key="event.id" :event="event" :date="(event.next_date ?? annualDate(event.fixed_month, event.fixed_day))" /></div>
    <UiCard v-else><UiState kind="empty" title="Ближайших событий пока нет" description="События появятся после публикации в календаре." /></UiCard>
    <div class="dashboard-bottom">
      <UiCard class="recent-projects"><div class="section-heading"><h2>Продолжить работу</h2><NuxtLink to="/events">Все мероприятия →</NuxtLink></div><p class="dashboard-school muted">{{ dashboard.school.name }}</p>
        <dl class="dashboard-counts" aria-label="Сводные показатели"><div><dt>Активные</dt><dd>{{ dashboard.counts.total_scenarios }}</dd></div><div><dt>Черновики</dt><dd>{{ dashboard.counts.draft_scenarios }}</dd></div><div><dt>Проверены</dt><dd>{{ dashboard.counts.completed_scenarios }}</dd></div><div><dt>В архиве</dt><dd>{{ dashboard.counts.archived_scenarios }}</dd></div><div><dt>Традиции</dt><dd>{{ dashboard.counts.traditions_count }}</dd></div></dl>
        <div v-if="dashboard.recent_scenarios.length" class="scenario-list"><article v-for="scenario in dashboard.recent_scenarios" :key="scenario.id"><h3><NuxtLink :to="scenarioPath(scenario.id)">{{ scenario.title }}</NuxtLink></h3><div class="row"><UiBadge :tone="scenario.status === 'completed' ? 'success' : 'neutral'">{{ statuses[scenario.status] }}</UiBadge><time v-if="scenario.updated_at" :datetime="scenario.updated_at">{{ formatDate(scenario.updated_at, { hour: '2-digit', minute: '2-digit' }) }}</time></div></article></div>
        <UiState v-else kind="empty" title="Вы ещё не создавали мероприятия" description="Выберите событие в календаре, чтобы начать подготовку." />
      </UiCard>
      <UiCard class="preparation-tips"><h2>Перед проведением</h2><ol><li>Сверьте даты и источники</li><li>Проверьте возраст и задания</li><li>Подготовьте материалы и роли</li></ol><p class="muted">Проект ИИ — черновик. Решение о проведении всегда за педагогом.</p></UiCard>
    </div>
  </div>
</template>
