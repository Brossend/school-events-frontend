import type { CalendarQuery } from '../types/events'

export const eventTypes = [
  { value: '', label: 'Все' }, { value: 'federal', label: 'Федеральные' },
  { value: 'regional', label: 'Региональные' }, { value: 'cultural_traditional', label: 'Национально-культурные' },
  { value: 'school_custom', label: 'Школьные' },
] as const
export const eventTypeLabel = (type: string) => eventTypes.find(t => t.value === type)?.label ?? type
export const eventPath = (id: string) => `/calendar/${encodeURIComponent(id)}`
export const scenarioPath = (id: string) => `/events/${encodeURIComponent(id)}`
export function eventCount(count: number) {
  const tail = count % 100, last = count % 10
  return `${count} ${tail >= 11 && tail <= 14 ? 'событий' : last === 1 ? 'событие' : last >= 2 && last <= 4 ? 'события' : 'событий'}`
}

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yekaterinburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}
export function monthBounds(month: string) {
  const [year, m] = month.split('-').map(Number)
  return { from: `${month}-01`, to: `${month}-${new Date(Date.UTC(year!, m!, 0)).getUTCDate()}` }
}
export function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, m! - 1 + delta, 1)).toISOString().slice(0, 7)
}
export function monthLabel(month: string) {
  const text = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`)).replace(' г.', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
export function monthDays(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(`${monthBounds(month).to}T12:00:00Z`).getUTCDate()
  const cells = Math.ceil((offset + count) / 7) * 7
  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(first); date.setUTCDate(1 - offset + index)
    const iso = date.toISOString().slice(0, 10)
    return { iso, day: date.getUTCDate(), inMonth: iso.startsWith(month), weekend: index % 7 >= 5 }
  })
}
export function annualDate(month: number, day: number, date = today()): string | null {
  const year = Number(date.slice(0, 4))
  for (let y = year; y < year + 9; y++) {
    const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (validDate(iso) && iso >= date) return iso
  }
  return null
}
export function formatDate(date: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!date || Number.isNaN(Date.parse(date))) return 'Дата не указана'
  return new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Yekaterinburg', ...options }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date))
}
export function academicYear(date = today()) {
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 9 ? 1 : 0)
  return `${year} / ${year + 1} учебный год`
}

export interface CalendarState { month: string; view: 'month' | 'list'; q: string; type: NonNullable<CalendarQuery['type']> | ''; region_code: string; from: string; to: string; page: number; per_page: number }
export function readCalendarState(query: Record<string, unknown>, defaultMonth = today().slice(0, 7), defaultView: CalendarState['view'] = 'month'): CalendarState {
  const str = (key: string) => typeof query[key] === 'string' ? query[key] as string : ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(str('month')) ? str('month') : validDate(str('from')) ? str('from').slice(0, 7) : defaultMonth
  const bounds = monthBounds(month)
  const integer = (key: string, fallback: number, max: number) => /^\d+$/.test(str(key)) ? Math.min(Math.max(Number(str(key)), 1), max) : fallback
  return {
    month, view: str('view') === 'list' ? 'list' : str('view') === 'month' ? 'month' : defaultView,
    q: str('q').trim().slice(0, 100), type: (eventTypes.some(t => t.value === str('type')) ? str('type') : '') as CalendarState['type'],
    region_code: str('region_code').trim().slice(0, 10), from: validDate(str('from')) ? str('from') : bounds.from, to: validDate(str('to')) ? str('to') : bounds.to,
    page: integer('page', 1, 1000000), per_page: integer('per_page', 12, 100),
  }
}
export function calendarQuery(state: CalendarState): CalendarQuery {
  return { q: state.q || undefined, type: state.type || undefined, region_code: state.region_code || undefined, from: state.from, to: state.to, page: state.page, per_page: state.per_page }
}
export function calendarUrl(state: CalendarState): Record<string, string> {
  const query: Record<string, string> = { month: state.month, from: state.from, to: state.to, view: state.view }
  for (const [key, value] of Object.entries(calendarQuery(state))) if (value !== undefined && value !== '' && !(key === 'page' && value === 1)) query[key] = String(value)
  return query
}


export interface CalendarOccurrence { id: string; academic_year: string; start_date: string; end_date: string | null; source_reference: string | null }
export interface CalendarDates { date_type?: string; fixed_month?: number | null; fixed_day?: number | null; occurrences?: CalendarOccurrence[] }
/** Date-only values stay date-only; never infer a date from an event title. */
export function calendarEventDates(event: CalendarDates, from: string, to: string): string[] {
  if (!validDate(from) || !validDate(to) || from > to) return []
  const result = new Set<string>()
  const occurrences = event.occurrences ?? []
  for (const occurrence of occurrences) {
    if (!validDate(occurrence.start_date) || occurrence.end_date && !validDate(occurrence.end_date)) continue
    const end = occurrence.end_date ?? occurrence.start_date
    if (end < occurrence.start_date) continue
    let day = occurrence.start_date < from ? from : occurrence.start_date
    const last = end > to ? to : end
    while (day <= last) {
      result.add(day)
      const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); day = date.toISOString().slice(0,10)
    }
  }
  if (event.date_type === 'fixed_annual' && event.fixed_month && event.fixed_day) {
    for (let year = Number(from.slice(0,4)); year <= Number(to.slice(0,4)); year++) {
      const day = `${year}-${String(event.fixed_month).padStart(2,'0')}-${String(event.fixed_day).padStart(2,'0')}`
      const academicStart = year - (event.fixed_month < 9 ? 1 : 0)
      const explicit = occurrences.some(row => row.academic_year === `${academicStart}-${academicStart + 1}`)
      if (!explicit && validDate(day) && day >= from && day <= to) result.add(day)
    }
  }
  return [...result].sort()
}

export function calendarDateLabel(event: CalendarDates, from: string, to: string): string {
  const occurrence = event.occurrences?.find(row => validDate(row.start_date) && row.start_date <= to && (row.end_date ?? row.start_date) >= from)
  if (occurrence) return occurrence.end_date && occurrence.end_date !== occurrence.start_date ? `${formatDate(occurrence.start_date)} — ${formatDate(occurrence.end_date)}` : formatDate(occurrence.start_date)
  const day = calendarEventDates(event, from, to)[0]
  return day ? formatDate(day) : 'Дата проведения не указана'
}
