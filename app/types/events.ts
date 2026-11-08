import type { components, operations } from './openapi'

export type CalendarQuery = NonNullable<operations['listCalendarEvents']['parameters']['query']>
export type EventSummary = components['schemas']['CalendarEventSummary']
export type EventDetail = components['schemas']['CalendarEventEnvelope']['data']
export type EventList = components['schemas']['CalendarEventListResponse']
export type Counts = components['schemas']['DashboardSummaryDetail']['counts']

// Dashboard arrays are only `type: object` in OpenAPI. Refined from the existing
// DashboardController output and runtime-validated in parseDashboard.
export interface UpcomingEvent extends EventSummary { fixed_month: number; fixed_day: number }
export interface RecentScenario {
  id: string; title: string; status: 'draft' | 'completed' | 'archived'
  moderation_status: string; is_archived: boolean
  created_at: string | null; updated_at: string | null; current_revision_id: string | null
}
export interface Dashboard {
  school: components['schemas']['DashboardSummaryDetail']['school']
  upcoming_events: UpcomingEvent[]; recent_scenarios: RecentScenario[]; counts: Counts
}
