import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import DashboardContent from '../app/components/features/dashboard/DashboardContent.vue'
import EventCard from '../app/components/features/EventCard.vue'
import UiBadge from '../app/components/ui/UiBadge.vue'
import UiCard from '../app/components/ui/UiCard.vue'
import UiState from '../app/components/ui/UiState.vue'
import UiPagination from '../app/components/ui/UiPagination.vue'
import UiButton from '../app/components/ui/UiButton.vue'
import CalendarMonth from '../app/components/features/calendar/CalendarMonth.vue'
import CalendarTypes from '../app/components/features/calendar/CalendarTypes.vue'
import { parseDashboard } from '../app/utils/dashboard'
import { readCalendarState, calendarQuery, calendarUrl, monthDays, monthBounds, annualDate, eventPath, shiftMonth } from '../app/utils/calendar'
import { createLatestResource } from '../app/utils/latest-resource'

const payload = { data: {
  school: { id: 's1', name: 'Школа 1', short_name: null, region_code: '66', city: 'Екатеринбург' },
  upcoming_events: [{ id: 'event-1', title: 'День единства', description: 'Встреча класса', event_type: 'federal', region_code: null, fixed_month: 11, fixed_day: 4 }],
  recent_scenarios: [{ id: 'scenario-1', title: 'Наш сценарий', status: 'draft', moderation_status: 'pending_verification', is_archived: false, created_at: null, updated_at: '2026-10-25T10:00:00Z', current_revision_id: null }],
  counts: { total_scenarios: 3, draft_scenarios: 2, completed_scenarios: 1, archived_scenarios: 0, traditions_count: 4 },
} }
const NuxtLink = defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) })
const global = { components: { NuxtLink, EventCard, UiBadge, UiCard, UiState, UiButton } }

describe('dashboard rendering with backend data', () => {
  it('shows actual greeting, event links, counts and scenario status', () => {
    const wrapper = mount(DashboardContent, { props: { dashboard: parseDashboard(payload), name: 'Михаил Петров' }, global })
    expect(wrapper.text()).toContain('Здравствуйте, Михаил!')
    expect(wrapper.text()).toContain('Школа 1')
    expect(wrapper.get('a[href="/calendar/event-1"]').text()).toContain('День единства')
    expect(wrapper.get('a[href="/events/scenario-1"]').text()).toBe('Наш сценарий')
    expect(wrapper.get('.dashboard-counts').text()).toContain('Активные3')
    expect(wrapper.text()).toContain('Черновик')
    expect(wrapper.text()).not.toContain('25 учеников')
    wrapper.unmount()
  })
  it('shows empty states and server zeros, never demo cards', () => {
    const empty = parseDashboard({ data: { ...payload.data, upcoming_events: [], recent_scenarios: [], counts: { total_scenarios: 0, draft_scenarios: 0, completed_scenarios: 0, archived_scenarios: 0, traditions_count: 0 } } })
    const wrapper = mount(DashboardContent, { props: { dashboard: empty, name: 'Анна' }, global })
    expect(wrapper.text()).toContain('Ближайших событий пока нет')
    expect(wrapper.text()).toContain('Вы ещё не создавали мероприятия')
    expect(wrapper.findAll('.event-card')).toHaveLength(0)
    expect(wrapper.find('.hero-occasion').exists()).toBe(false)
    wrapper.unmount()
  })
  it('rejects malformed dashboard arrays and invalid dates', () => {
    expect(() => parseDashboard({ data: { ...payload.data, upcoming_events: [{}] } })).toThrow()
    expect(() => parseDashboard({ data: { ...payload.data, upcoming_events: [{ ...payload.data.upcoming_events[0], fixed_month: 13 }] } })).toThrow()
  })
})

describe('calendar URL and supported API filters', () => {
  it('changes the type without accidentally submitting the surrounding search form', async () => {
    const submit = vi.fn()
    const form = document.createElement('form'); form.addEventListener('submit', submit); document.body.appendChild(form)
    const wrapper = mount(CalendarTypes, { props: { selected: '' }, attachTo: form })
    const regional = wrapper.findAll('button').find(button => button.text() === 'Региональные')!
    regional.element.click(); await nextTick()
    expect(wrapper.emitted('change')).toEqual([['regional']])
    expect(submit).not.toHaveBeenCalled()
    wrapper.unmount(); form.remove()
  })
  it('round-trips filters, dates, view and actual pagination through the URL', () => {
    const state = readCalendarState({ q: 'День & школа', type: 'regional', region_code: '66', from: '2026-11-01', to: '2026-11-30', page: '2', per_page: '24', view: 'list' })
    expect(readCalendarState(calendarUrl(state))).toEqual(state)
    expect(calendarQuery(state)).toEqual({ q: 'День & школа', type: 'regional', region_code: '66', from: '2026-11-01', to: '2026-11-30', page: 2, per_page: 24 })
    expect(calendarQuery(state)).not.toHaveProperty('view')
    expect(calendarQuery(state)).not.toHaveProperty('month')
  })
  it('ignores unsupported category/sort/age and normalizes invalid pagination/type', () => {
    const state = readCalendarState({ type: 'invented', category: 'music', sort: 'title', age: '5-9', page: '-2', per_page: '10000', from: '2026-02-30' }, '2026-11')
    expect(state.type).toBe('')
    expect(state.from).toBe('2026-11-01')
    expect(state.page).toBe(1)
    expect(state.per_page).toBe(100)
    expect(calendarQuery(state)).not.toHaveProperty('category')
    expect(calendarQuery(state)).not.toHaveProperty('sort')
  })
  it('defaults to the chosen responsive view without erasing explicit URL view', () => {
    expect(readCalendarState({}, '2026-11', 'list').view).toBe('list')
    expect(readCalendarState({ view: 'month' }, '2026-11', 'list').view).toBe('month')
  })
  it('handles calendar boundaries, Monday alignment and leap years', () => {
    expect(monthBounds('2028-02').to).toBe('2028-02-29')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    const cells = monthDays('2026-11')
    expect(cells[0]?.iso).toBe('2026-10-26')
    expect(cells).toHaveLength(42)
    expect(annualDate(2, 29, '2026-10-25')).toBe('2028-02-29')
  })
  it('never invents dates on event cards and uses a safe event detail route', async () => {
    const event = { id: 'e/1', title: 'Событие', description: 'Описание', event_type: 'regional' }
    const wrapper = mount(EventCard, { props: { event, selectable: true }, global })
    expect(wrapper.text()).toContain('Точная дата недоступна')
    expect(wrapper.get('a').attributes('href')).toBe(eventPath('e/1'))
    expect(eventPath('e/1')).toBe('/calendar/e%2F1')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['e/1']])
    wrapper.unmount()
  })
  it('uses server pagination and prevents previous/next outside bounds', async () => {
    const wrapper = mount(UiPagination, { props: { meta: { current_page: 1, last_page: 3, per_page: 12, total: 31 } }, global })
    expect(wrapper.get('button[aria-label="Предыдущая страница"]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[aria-label="Следующая страница"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([[2]])
    await wrapper.setProps({ meta: { current_page: 3, last_page: 3, per_page: 12, total: 31 } })
    expect(wrapper.get('button[aria-label="Следующая страница"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('supports selecting a real calendar day and keyboard movement', async () => {
    const wrapper = mount(CalendarMonth, { props: { month: '2026-11', from: '2026-11-01', to: '2026-11-30' }, attachTo: document.body })
    await wrapper.get('button[data-date="2026-11-04"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['2026-11-04']])
    await wrapper.get('button[data-date="2026-11-04"]').trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-11-05')
    wrapper.unmount()
  })
})

function deferred<T>() { let resolve!: (v: T) => void; let reject!: (e: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
describe('latest request and tenant isolation', () => {
  it('aborts the old request and ignores its late success even if transport ignores abort', async () => {
    const a = deferred<string>(), b = deferred<string>(), signals: AbortSignal[] = []
    let school = 'A'
    const load = vi.fn((signal: AbortSignal) => { signals.push(signal); return school === 'A' ? a.promise : b.promise })
    const resource = createLatestResource(load, () => school)
    const first = resource.refresh()
    school = 'B'
    const second = resource.refresh()
    expect(signals[0]?.aborted).toBe(true)
    expect(resource.data.value).toBeNull()
    b.resolve('school B'); await second
    a.resolve('school A'); await first
    expect(resource.data.value).toBe('school B')
    expect(resource.pending.value).toBe(false)
  })
  it('ignores late errors and clears previous data synchronously on refresh', async () => {
    const old = deferred<string>()
    const load = vi.fn().mockResolvedValueOnce('initial').mockReturnValueOnce(old.promise).mockResolvedValueOnce('new')
    const resource = createLatestResource<string>(load, () => 'A')
    await resource.refresh()
    const pending = resource.refresh()
    expect(resource.data.value).toBeNull()
    await resource.refresh()
    old.reject(new Error('obsolete failure')); await pending
    expect(resource.error.value).toBeNull()
    expect(resource.data.value).toBe('new')
  })
  it('shows actual API errors and discards responses after disposal/context change', async () => {
    const resource = createLatestResource<string>(async () => { throw new Error('API failed') }, () => 'A')
    await resource.refresh()
    expect(resource.error.value?.message).toBe('API failed')
    expect(resource.pending.value).toBe(false)
    const wait = deferred<string>()
    const disposed = createLatestResource(() => wait.promise, () => 'A')
    const call = disposed.refresh(); disposed.reset(); wait.resolve('private A'); await call; await nextTick()
    expect(disposed.data.value).toBeNull()
  })
})
