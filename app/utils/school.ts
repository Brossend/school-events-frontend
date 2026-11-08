import { schoolSettingKeys, type SchoolAccessContext, type SchoolDraft, type SchoolProfile, type SchoolProfileInput } from '../types/school'

export function schoolIdValid(id: string) { return /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id) }
export function schoolPermissions(c: SchoolAccessContext) {
  const valid = c.authenticated && c.active && schoolIdValid(c.targetId)
  const own = c.schoolId === c.targetId && !!c.schoolRole
  return { read: valid && (own || c.systemRole === 'system_admin'), edit: valid && (own && c.schoolRole === 'school_admin' || c.systemRole === 'system_admin') }
}
export function schoolContextKey(c: SchoolAccessContext) { return JSON.stringify([c.userId, c.authenticated, c.active, c.systemRole, c.schoolId, c.schoolRole, c.targetId]) }
export function parseSchoolProfile(payload: unknown, targetId?: string): SchoolProfile {
  const fail = () => { throw new Error('Некорректный ответ API профиля школы.') }
  if (!payload || typeof payload !== 'object' || !('data' in payload)) return fail()
  const d = payload.data as SchoolProfile
  if (!d || typeof d !== 'object' || !schoolIdValid(d.id) || targetId && d.id !== targetId) return fail()
  for (const k of ['name', 'region_code', 'city'] as const) if (typeof d[k] !== 'string') return fail()
  for (const k of ['short_name', 'inn', 'created_at', 'updated_at'] as const) if (d[k] !== null && typeof d[k] !== 'string') return fail()
  for (const k of ['created_at', 'updated_at'] as const) if (d[k] !== null && !Number.isFinite(Date.parse(d[k]))) return fail()
  for (const k of ['traditions_count', 'active_teachers_count'] as const) if (!Number.isSafeInteger(d[k]) || d[k] < 0) return fail()
  // PHP serializes its empty associative array as []; nonempty settings are objects.
  if (!d.settings || typeof d.settings !== 'object' || Array.isArray(d.settings) && d.settings.length !== 0) return fail()
  return { id: d.id, name: d.name, short_name: d.short_name, region_code: d.region_code, city: d.city, inn: d.inn, settings: { ...d.settings }, traditions_count: d.traditions_count, active_teachers_count: d.active_teachers_count, created_at: d.created_at, updated_at: d.updated_at }
}
export function schoolDraft(profile: SchoolProfile): SchoolDraft {
  const settings = {} as SchoolDraft['settings']
  for (const key of schoolSettingKeys) settings[key] = typeof profile.settings[key] === 'string' ? profile.settings[key] as string : ''
  return { name: profile.name, short_name: profile.short_name ?? '', city: profile.city, inn: profile.inn ?? '', settings }
}
export function schoolPatch(profile: SchoolProfile, draft: SchoolDraft): SchoolProfileInput {
  const body: SchoolProfileInput = {}, before = schoolDraft(profile)
  if (draft.name !== before.name) body.name = draft.name.trim()
  if (draft.city !== before.city) body.city = draft.city.trim()
  for (const key of ['short_name', 'inn'] as const) if (draft[key] !== before[key]) body[key] = draft[key].trim() || null
  for (const key of schoolSettingKeys) if (draft.settings[key] !== before.settings[key]) { body.settings ??= {}; body.settings[key] = draft.settings[key].trim() || null }
  return body
}
export function schoolCriticalChanges(body: SchoolProfileInput) { return ['name', 'short_name', 'city', 'inn'].filter(key => Object.hasOwn(body, key)) }
export function schoolAllowedInput(input: SchoolProfileInput): SchoolProfileInput {
  const body: SchoolProfileInput = {}
  for (const key of ['name', 'short_name', 'city', 'inn'] as const) if (Object.hasOwn(input, key)) Object.assign(body, { [key]: input[key] })
  if (input.settings && typeof input.settings === 'object') for (const key of schoolSettingKeys) if (Object.hasOwn(input.settings, key)) { body.settings ??= {}; body.settings[key] = input.settings[key] }
  return body
}
export function schoolInputIssues(body: SchoolProfileInput): Record<string, string> {
  const issues: Record<string, string> = {}
  for (const [key, min, max] of [['name', 3, 255], ['city', 2, 100]] as const) if (body[key] !== undefined && (typeof body[key] !== 'string' || Array.from(body[key].trim()).length < min || Array.from(body[key]).length > max)) issues[key] = `От ${min} до ${max} символов.`
  if (body.short_name != null && (typeof body.short_name !== 'string' || Array.from(body.short_name).length > 100)) issues.short_name = 'Не более 100 символов.'
  if (body.inn != null && !/^\d{10}(\d{2})?$/.test(body.inn)) issues.inn = 'ИНН должен содержать 10 или 12 цифр.'
  for (const key of schoolSettingKeys) {
    const value = body.settings?.[key], max = key === 'description' ? 1000 : key === 'phone' ? 50 : 255
    if (value != null && (typeof value !== 'string' || Array.from(value).length > max)) issues[`settings.${key}`] = `Не более ${max} символов.`
    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) issues['settings.email'] = 'Укажите корректный email.'
  }
  return issues
}
export function schoolDate(value: string | null) { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Не указана' }
