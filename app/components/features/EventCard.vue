<script setup lang="ts">
import { eventPath, eventTypeLabel, formatDate } from '~/utils/calendar'
import type { EventSummary } from '~/types/events'
withDefaults(defineProps<{ event: EventSummary; date?: string | null; dateLabel?: string; selected?: boolean; selectable?: boolean }>(), { date: undefined, dateLabel: undefined, selected: false, selectable: false })
defineEmits<{ select: [id: string] }>()
</script>
<template>
  <article :class="['event-card', { 'event-card--selected': selected }]">
    <div class="event-card__meta">
      <div :class="['event-date', { 'event-date--blue': event.event_type === 'regional' }]">
        <template v-if="date"><strong>{{ date.slice(8) }}</strong><span>{{ formatDate(date, { month: 'short', day: undefined, year: undefined }).replace('.', '').toUpperCase() }}</span></template>
        <span v-else aria-label="Точная дата недоступна">—</span>
      </div>
      <span class="muted">{{ eventTypeLabel(event.event_type) }}<template v-if="event.region_code"> · регион {{ event.region_code }}</template></span>
    </div>
    <h3><button v-if="selectable" class="event-select" :aria-pressed="selected" @click="$emit('select', event.id)">{{ event.title }}</button><NuxtLink v-else :to="eventPath(event.id)">{{ event.title }}</NuxtLink></h3>
    <p class="event-card__description">{{ event.description }}</p>
    <p class="muted event-card__date">{{ dateLabel || (date ? formatDate(date) : 'Точная дата недоступна') }}</p>
    <NuxtLink :to="eventPath(event.id)" class="event-card__link">Открыть событие<img src="/icons/arrow-up-right.svg" width="17" height="17" alt=""></NuxtLink>
  </article>
</template>
