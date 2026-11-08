import type { AnnualVersion, TraditionDetail, TraditionInput, TraditionItem, TraditionFilter } from '~/types/traditions'
import { ApiError } from './api-error'
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ традиций.'); return value as Record<string, unknown> }
function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Некорректный текст традиции.'); return value }
function optionalText(value: unknown) { return value == null ? null : text(value) }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Сервер не вернул историю версий.'); return value }
function version(value: unknown): AnnualVersion {
  const v = object(value)
  return { id: text(v.id), academic_year: text(v.academic_year), notes: optionalText(v.notes), created_at: optionalText(v.created_at), ...(v.parameters_snapshot == null ? {} : { parameters_snapshot: Array.isArray(v.parameters_snapshot) ? v.parameters_snapshot : object(v.parameters_snapshot) }) }
}
function item(value: unknown): TraditionItem {
  const v = object(value)
  if (typeof v.is_archived !== 'boolean' || v.established_year != null && (!Number.isInteger(v.established_year) || typeof v.established_year !== 'number')) throw new Error('Некорректные метаданные традиции.')
  return { id: text(v.id), title: text(v.title), description: text(v.description), established_year: v.established_year == null ? null : v.established_year as number, is_archived: v.is_archived, active_version: v.active_version == null ? null : version(v.active_version), versions: array(v.versions).map(version) }
}
export function parseTraditions(payload: unknown): TraditionItem[] { return array(object(payload).data).map(item) }
export function parseTradition(payload: unknown, schoolId: string): TraditionDetail {
  const v = object(object(payload).data)
  if (v.school_id !== schoolId) throw new ApiError(403, 'TRADITION_SCHOOL_MISMATCH', 'Традиция принадлежит другой школе. Вернитесь к списку текущей школы.')
  return { ...item(v), school_id: text(v.school_id), created_by_user_id: optionalText(v.created_by_user_id), created_at: optionalText(v.created_at), updated_at: optionalText(v.updated_at) }
}
export function traditionPermissions(tradition: Pick<TraditionDetail, 'school_id' | 'created_by_user_id'>, schoolId: string | undefined, userId: string | undefined, schoolRole: string | undefined, systemRole: string) {
  const member = !!userId && !!schoolRole && !!schoolId && tradition.school_id === schoolId
  return { edit: member && (tradition.created_by_user_id === userId || schoolRole === 'school_admin' || systemRole === 'system_admin'), version: member }
}
export function readTraditionFilter(value: unknown): TraditionFilter { return value === 'true' || value === 'all' ? value : 'false' }
export function metadataIssues(input: TraditionInput, editing: boolean, year = new Date().getFullYear()): Record<string, string> {
  const errors: Record<string, string> = {}
  if (input.title.trim().length < 3 || input.title.length > 255) errors.title = 'Название: от 3 до 255 символов.'
  if (input.description.trim().length < 10 || editing && input.description.length > 5000) errors.description = editing ? 'Описание: от 10 до 5000 символов.' : 'Описание: не менее 10 символов.'
  if (input.established_year != null && (!Number.isInteger(input.established_year) || input.established_year < 1800 || input.established_year > (editing ? year : 2100))) errors.established_year = `Год основания: от 1800 до ${editing ? year : 2100}.`
  return errors
}
export function annualYearIssue(value: string, years: string[]) {
  const match = /^(\d{4})-(\d{4})$/.exec(value)
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return 'Укажите последовательные годы, например 2026-2027.'
  if (years.includes(value)) return 'Версия на этот учебный год уже существует. Откройте её в истории.'
  return ''
}
export function suggestedAnnualYear(versions: AnnualVersion[], now = new Date()) {
  const current = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  let start = Math.max(current, ...versions.map(v => Number(v.academic_year.slice(0, 4)) + 1).filter(Number.isFinite))
  while (versions.some(v => v.academic_year === `${start}-${start + 1}`)) start++
  return `${start}-${start + 1}`
}
