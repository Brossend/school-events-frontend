import { calendarUrl, readCalendarState, type CalendarState } from '~/utils/calendar'

export function useCalendarFilters() {
  const route = useRoute(), router = useRouter()
  const mobile = ref(false)
  const media = window.matchMedia('(max-width: 599px)')
  mobile.value = media.matches
  const listener = () => { mobile.value = media.matches }
  media.addEventListener('change', listener)
  onBeforeUnmount(() => media.removeEventListener('change', listener))
  const filters = computed(() => readCalendarState(route.query, undefined, mobile.value ? 'list' : 'month'))
  function update(patch: Partial<CalendarState>, resetPage = true) {
    const next = { ...filters.value, ...patch }
    if (resetPage && !('page' in patch)) next.page = 1
    return router.push({ path: '/calendar', query: calendarUrl(next) })
  }
  return { filters, update }
}
