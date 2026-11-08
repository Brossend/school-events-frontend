import type { operations } from './openapi'

export const schoolSettingKeys = ['address', 'phone', 'email', 'website', 'description'] as const
export type SchoolSettingKey = typeof schoolSettingKeys[number]
export type SchoolSettingsInput = Partial<Record<SchoolSettingKey, string | null>>
export interface SchoolProfile {
  id: string
  name: string
  short_name: string | null
  region_code: string
  city: string
  inn: string | null
  settings: Record<string, unknown>
  traditions_count: number
  active_teachers_count: number
  created_at: string | null
  updated_at: string | null
}
export interface SchoolProfileInput { name?: string; short_name?: string | null; city?: string; inn?: string | null; settings?: SchoolSettingsInput }
export interface SchoolDraft { name: string; short_name: string; city: string; inn: string; settings: Record<SchoolSettingKey, string> }
export interface SchoolAccessContext { authenticated: boolean; active: boolean; userId: string; systemRole: string; schoolId?: string; schoolRole?: string; targetId: string }
type Reply<O> = Omit<O, 'responses'> & { responses: { 200: { content: { 'application/json': { data: SchoolProfile } } } } }
export interface SchoolOperationOverrides {
  '/schools/{id}': {
    get: Reply<operations['getSchoolProfile']>
    patch: Omit<Reply<operations['updateSchoolProfile']>, 'requestBody'> & { requestBody: { content: { 'application/json': SchoolProfileInput } } }
  }
}
