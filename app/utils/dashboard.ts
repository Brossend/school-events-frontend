import type { Dashboard, UpcomingEvent, RecentScenario, Counts } from '../types/events'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ дашборда.')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Некорректные текстовые данные дашборда.')
  return value
}
function nullable(value: unknown) { return value === null ? null : text(value) }
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('Некорректные показатели дашборда.')
  return value
}
export function parseDashboard(payload: unknown): Dashboard {
  const data = record(record(payload).data), school = record(data.school), counts = record(data.counts)
  if (!Array.isArray(data.upcoming_events) || !Array.isArray(data.recent_scenarios)) throw new Error('Не получены списки дашборда.')
  const upcoming_events: UpcomingEvent[] = data.upcoming_events.map(value => {
    const e = record(value), month = number(e.fixed_month), day = number(e.fixed_day)
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(2000, month, 0)).getUTCDate()) throw new Error('Некорректная дата события.')
    return { id: text(e.id), title: text(e.title), description: text(e.description), event_type: text(e.event_type), region_code: nullable(e.region_code), fixed_month: month, fixed_day: day, ...(typeof e.next_date === 'string' ? { next_date: e.next_date } : {}) }
  })
  const recent_scenarios: RecentScenario[] = data.recent_scenarios.map(value => {
    const s = record(value)
    if (!['draft', 'completed', 'archived'].includes(text(s.status)) || typeof s.is_archived !== 'boolean') throw new Error('Некорректный статус сценария.')
    return { id: text(s.id), title: text(s.title), status: s.status as RecentScenario['status'], is_archived: s.is_archived, moderation_status: text(s.moderation_status), created_at: nullable(s.created_at), updated_at: nullable(s.updated_at), current_revision_id: nullable(s.current_revision_id) }
  })
  return {
    school: { id: text(school.id), name: text(school.name), short_name: nullable(school.short_name), region_code: text(school.region_code), city: text(school.city) },
    upcoming_events, recent_scenarios,
    counts: Object.fromEntries(['total_scenarios', 'draft_scenarios', 'completed_scenarios', 'archived_scenarios', 'traditions_count'].map(key => [key, number(counts[key])])) as Counts,
  }
}
