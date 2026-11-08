<script setup lang="ts">
import type { EventSummary } from '~/types/events'
import { eventPath, eventTypeLabel } from '~/utils/calendar'
defineProps<{ event: EventSummary | null; dateLabel?: string }>()
const auth = useAuthStore()
</script>
<template>
  <UiCard class="calendar-preview">
    <template v-if="event"><UiBadge tone="success">Выбранное событие</UiBadge><p class="muted">{{ eventTypeLabel(event.event_type) }}</p><p v-if="dateLabel" class="muted">{{ dateLabel }}</p><h2>{{ event.title }}</h2><p>{{ event.description }}</p><UiAlert tone="warning">Сведения и точные даты уточняйте по первоисточникам. Этот просмотр не заменяет проверку достоверности.</UiAlert><NuxtLink :to="eventPath(event.id)" class="text-button">Открыть событие →</NuxtLink><NuxtLink :to="{ path: '/constructor', query: { school: auth.tenant?.school_id, calendar_event_id: event.id } }" class="ui-button ui-button--primary"><img src="/icons/plus-light.svg" width="17" height="17" alt="">Создать мероприятие</NuxtLink><small class="muted">Сохраните условия мероприятия в конструкторе. Дату проведения уточняет педагог.</small></template>
    <UiState v-else kind="empty" title="Событие не выбрано" description="Выберите событие из списка найденных результатов." />
  </UiCard>
</template>
