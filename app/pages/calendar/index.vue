<script setup lang="ts">
import { academicYear, calendarQuery, calendarEventDates, calendarDateLabel, monthBounds, monthLabel, shiftMonth, eventCount, type CalendarState } from '~/utils/calendar'
definePageMeta({ access: { catalog: true } })
useHead({ title: 'Календарь событий · Школьные события' })
const api = useApi()
const { filters, update } = useCalendarFilters()
const draft = reactive({ q: filters.value.q, from: filters.value.from, to: filters.value.to, region_code: filters.value.region_code, per_page: String(filters.value.per_page) })
watch(filters, value => Object.assign(draft, { q: value.q, from: value.from, to: value.to, region_code: value.region_code, per_page: String(value.per_page) }))
const validation = computed(() => filters.value.from > filters.value.to ? 'Дата начала не может быть позже даты окончания.' : '')
const queryKey = computed(() => JSON.stringify(calendarQuery(filters.value)))
const { data, pending, error, refresh } = useProvenanceResource(signal => api.request('get', '/calendar-events', { query: calendarQuery(filters.value), signal, reportError: false }), () => queryKey.value, () => !validation.value)
const selectedId = ref('')
watch(data, () => { selectedId.value = '' })
const selected = computed(() => data.value?.data.find(e => e.id === selectedId.value) ?? data.value?.data[0] ?? null)
watch(data, value => {
  if (value && value.meta.total > 0 && value.meta.current_page > value.meta.last_page) void update({ page: value.meta.last_page }, false)
})
const ownEvent = ref(false)
const pageSizes = computed(() => [...new Set([12, 24, 48, 100, filters.value.per_page])].sort((a, b) => a - b).map(value => ({ value: String(value), label: String(value) })))
function apply() { void update({ ...draft, q: draft.q.trim(), region_code: draft.region_code.trim(), per_page: Number(draft.per_page) }) }
function changeMonth(delta: number) { const month = shiftMonth(filters.value.month, delta); void update({ month, ...monthBounds(month) }) }
function selectDate(date: string) { void update({ month: date.slice(0, 7), from: date, to: date }) }
function type(value: CalendarState['type']) { void update({ type: value }) }
function reset() { void update({ q: '', type: '', region_code: '', page: 1, ...monthBounds(filters.value.month) }) }
</script>
<template>
  <div class="calendar-flow">
    <header class="calendar-heading"><p class="muted">{{ academicYear() }}</p><h1>Календарь событий</h1><p class="muted">Поводы для содержательных встреч с классом.</p></header>
    <div class="calendar-toolbar"><div class="month-navigation"><button class="icon-button" aria-label="Предыдущий месяц" @click="changeMonth(-1)"><img src="/icons/chevron-left.svg" width="18" height="18" alt=""></button><h2>{{ monthLabel(filters.month) }}</h2><button class="icon-button" aria-label="Следующий месяц" @click="changeMonth(1)"><img src="/icons/chevron-right.svg" width="18" height="18" alt=""></button></div><div class="view-switch" role="group" aria-label="Представление календаря"><button :aria-pressed="filters.view === 'month'" @click="update({ view: 'month' }, false)">Месяц</button><button :aria-pressed="filters.view === 'list'" @click="update({ view: 'list' }, false)">Список</button></div></div>
    <form class="calendar-filter-form" @submit.prevent="apply">
      <div class="calendar-search"><UiField v-model="draft.q" label="Поиск событий" type="search" placeholder="Поиск по названию или теме события" maxlength="100" /><UiButton type="submit" variant="secondary">Найти</UiButton><UiButton variant="secondary" class="own-event" @click="ownEvent = true">＋ Своё событие</UiButton></div>
      <CalendarTypes :selected="filters.type" @change="type" />
      <details class="calendar-advanced"><summary>Регион и период · {{ filters.region_code ? `регион ${filters.region_code}` : 'Все регионы' }}</summary><div class="calendar-fields"><UiField v-model="draft.region_code" label="Код региона" placeholder="Например, 66" maxlength="10" /><UiField v-model="draft.from" label="С даты" type="date" required /><UiField v-model="draft.to" label="По дату" type="date" :min="draft.from" required /><UiSelect v-model="draft.per_page" label="Событий на странице" :options="pageSizes" /><UiButton type="submit">Применить фильтры</UiButton></div></details>
      <div class="filter-summary"><span>{{ data ? eventCount(data.meta.total) : pending ? 'Загружаем каталог' : 'Нет данных' }}</span><button type="button" class="text-button" @click="reset">Сбросить фильтры</button><span>Фильтры по возрасту и воспитательному направлению пока недоступны.</span></div>
    </form>
    <UiAlert v-if="validation" tone="error">{{ validation }}</UiAlert>
    <div v-if="filters.view === 'month'" class="calendar-composition"><CalendarMonth :month="filters.month" :from="filters.from" :to="filters.to" :events="pending || error ? [] : data?.data" @select="selectDate" /><CalendarPreview :event="validation || pending || error ? null : selected" :date-label="selected ? calendarDateLabel(selected, filters.from, filters.to) : undefined" /></div>
    <section aria-labelledby="results-heading" class="calendar-results"><div class="section-heading"><h2 id="results-heading">События выбранного периода</h2><span v-if="data" class="muted">{{ filters.from }} — {{ filters.to }}</span></div>
      <UiCard v-if="pending"><UiState kind="loading" title="Загружаем события" /></UiCard>
      <UiCard v-else-if="error"><UiState kind="error" title="Не удалось загрузить календарь" :description="error.message"><UiButton @click="refresh">Повторить</UiButton></UiState></UiCard>
      <template v-else-if="data && !validation"><div v-if="data.data.length" class="calendar-event-list"><EventCard v-for="event in data.data" :key="event.id" :event="event" :date="calendarEventDates(event, filters.from, filters.to)[0]" :date-label="calendarDateLabel(event, filters.from, filters.to)" :selectable="filters.view === 'month'" :selected="selected?.id === event.id" @select="selectedId = $event" /></div><UiCard v-else class="calendar-empty"><UiState kind="empty" :title="filters.type === 'regional' ? 'Региональные события не найдены' : 'События не найдены'" description="Измените период или сбросьте фильтры."><UiButton variant="secondary" @click="reset">Сбросить фильтры</UiButton></UiState></UiCard><UiPagination :meta="data.meta" :disabled="pending" @change="update({ page: $event }, false)" /></template>
    </section>
    <div class="catalog-note"><span aria-hidden="true">ⓘ</span><p>Пилотный каталог · Свердловская область. Проверяйте даты и культурные факты по официальным источникам.</p></div>
    <UiAlert class="calendar-guidance-alert"><div class="calendar-guidance"><img src="/icons/info.svg" width="20" height="20" alt=""><div><strong>Календарь — отправная точка, а не обязательный план</strong><p>Дату проведения можно изменить, учитывайте расписание школы и проверяйте материалы перед встречей с детьми.</p></div></div></UiAlert>
    <UiModal v-model="ownEvent" title="Собственное событие"><p>Создание школьного события будет реализовано после проверки FE-002. Текущий раздел позволяет искать и просматривать опубликованные события.</p></UiModal>
  </div>
</template>
