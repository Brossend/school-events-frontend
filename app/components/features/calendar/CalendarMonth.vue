<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, monthDays, calendarEventDates, type CalendarDates } from '~/utils/calendar'
const props = defineProps<{ month: string; from: string; to: string; events?: ({ id: string; title: string; event_type: string } & CalendarDates)[] }>()
const emit = defineEmits<{ select: [date: string] }>()
const days = computed(() => monthDays(props.month))
const byDay = computed(() => {
  const result: Record<string, NonNullable<typeof props.events>> = {}
  for (const event of props.events ?? []) for (const day of calendarEventDates(event, days.value[0]!.iso, days.value.at(-1)!.iso)) (result[day] ??= []).push(event)
  return result
})
function move(event: KeyboardEvent, iso: string) {
  const offset = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key]
  if (offset === undefined) return
  event.preventDefault()
  const index = days.value.findIndex(d => d.iso === iso) + offset
  const date = days.value[index]?.iso
  if (date) (event.currentTarget as HTMLElement).closest('.month-grid')?.querySelector<HTMLButtonElement>(`button[data-date="${date}"]`)?.focus()
}
</script>
<template>
  <section class="month-grid" aria-label="Выбор даты в календаре">
    <div class="month-weekdays"><span v-for="day in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']" :key="day">{{ day }}</span></div>
    <div class="month-cells"><button v-for="day in days" :key="day.iso" :data-date="day.iso" :class="{ 'other-month': !day.inMonth, weekend: day.weekend, selected: from === day.iso && to === day.iso }" :aria-label="`События на ${formatDate(day.iso)}: ${(byDay[day.iso] ?? []).map(event => event.title).join(', ') || 'нет загруженных событий'}`" :aria-pressed="from === day.iso && to === day.iso" @click="emit('select', day.iso)" @keydown="move($event, day.iso)">{{ day.day }}<span v-if="byDay[day.iso]?.length" class="calendar-day-events"><span v-for="event in byDay[day.iso]!.slice(0,3)" :key="event.id" class="calendar-day-event" :class="`calendar-day-event--${event.event_type}`" :title="event.title">{{ event.title }}</span><span v-if="byDay[day.iso]!.length > 3" class="calendar-day-more">Ещё {{ byDay[day.iso]!.length - 3 }}</span></span></button></div>
    <p class="month-caption">На сетке — события текущей страницы. Выберите день для поиска. Даты получены из календаря и записей проведения; ежегодная дата уступает записи на тот же учебный год.</p>
  </section>
</template>
