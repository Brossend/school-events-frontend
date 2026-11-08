import { parseQualityReview } from './quality-review'
import type { Comparison, ComparisonHistoryItem, ComparisonPayload, ComparisonSelection, ComparisonType, ComparisonVariant, ComparisonVariants, VariantKey } from '../types/comparisons'
import type { JsonValue } from '../types/generation'
import { ApiError } from './api-error'
import { record, string, uuid } from './generation'

export const comparisonTypes: Record<ComparisonType, string> = { universal_vs_personalized: 'Универсальный и персонализированный', cultural_context: 'Культурный контекст' }
export function comparisonsTestBackend(origin: string): boolean { try { const url = new URL(origin); return url.origin === 'http://localhost:8001' && !url.username && !url.password } catch { return false } }
export function comparisonType(value: unknown): ComparisonType { if (value !== 'universal_vs_personalized' && value !== 'cultural_context') throw new Error('Неизвестный тип сравнения.'); return value }
function choice(value: unknown): VariantKey | null { if (value === null || value === 'A' || value === 'B') return value; throw new Error('Неизвестный вариант сравнения.') }
function nullable(value: unknown) { return value === null ? null : string(value) }
function bool(value: unknown) { if (typeof value !== 'boolean') throw new Error('Сервер не указал доступность варианта.'); return value }
function rating(value: unknown): number | null { if (value === null) return null; if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) throw new Error('Оценка должна быть от 1 до 5.'); return value }
function json(value: unknown, depth = 0): JsonValue { if (depth > 24) throw new Error('Слишком глубокая структура сравнения.'); if (value === null || typeof value === 'string' || typeof value === 'boolean') return value; if (typeof value === 'number' && Number.isFinite(value)) return value; if (Array.isArray(value)) return value.map(v => json(v, depth + 1)); return Object.fromEntries(Object.entries(record(value)).map(([k, v]) => [k, json(v, depth + 1)])) }
function payload(value: unknown): ComparisonPayload { return json(record(value)) as ComparisonPayload }
function historyItem(value: unknown, school: string): ComparisonHistoryItem {
  const v = record(value)
  if (v.school_id !== school) throw new ApiError(403, 'COMPARISON_SCHOOL_MISMATCH', 'Сравнение относится к другой школе.')
  return { id: uuid(v.id), school_id: school, comparison_type: comparisonType(v.comparison_type), status: string(v.status), selected_variant: choice(v.selected_variant), selection_reason: nullable(v.selection_reason), selection_recorded_at: nullable(v.selection_recorded_at), cultural_usefulness_rating: rating(v.cultural_usefulness_rating), created_at: string(v.created_at) }
}
function variants(value: unknown, detailed = false): ComparisonVariant[] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error('Ожидались два серверных варианта A/B.')
  const result = value.map(item => { const v = record(item), key = choice(v.variant_key); if (!key) throw new Error('Нет ключа варианта.'); const variant: ComparisonVariant = { variant_key: key, scenario_id: v.scenario_id === null ? null : uuid(v.scenario_id), scenario_payload: payload(v.scenario_payload), is_cultural_available: bool(v.is_cultural_available) }; if (detailed) { variant.variant_label = string(v.variant_label); if (!Array.isArray(v.cultural_provenance_data)) throw new Error('Некорректные культурные источники.'); variant.cultural_provenance_data = v.cultural_provenance_data.map(v => json(v)) } return variant })
  if (new Set(result.map(v => v.variant_key)).size !== 2) throw new Error('Ключи вариантов повторяются.')
  return result.sort((a, b) => a.variant_key.localeCompare(b.variant_key))
}
export function parseComparisons(response: unknown, school: string) { const list = record(response).data; if (!Array.isArray(list)) throw new Error('Некорректная история сравнений.'); return list.map(v => historyItem(v, school)) }
export function parseComparison(response: unknown, school: string, id?: string): Comparison {
  const v = record(record(response).data), item = historyItem(v, school)
  if (id && item.id !== id) throw new Error('Ответ относится к другому сравнению.')
  return { ...item, quality_review: v.quality_review && typeof v.quality_review === 'object' ? { A: parseQualityReview(record(v.quality_review).A), B: parseQualityReview(record(v.quality_review).B) } : undefined, selected_by_user_id: v.selected_by_user_id === null ? null : uuid(v.selected_by_user_id), differences_summary: payload(v.differences_summary), is_cultural_available: bool(v.is_cultural_available), is_synthetic: bool(v.is_synthetic), variants: variants(v.variants) }
}
export function parseComparisonVariants(response: unknown, comparison: Comparison): ComparisonVariants {
  const v = record(record(response).data)
  if (v.comparison_id !== comparison.id || v.comparison_type !== comparison.comparison_type) throw new Error('Варианты относятся к другому сравнению.')
  const result = variants(v.variants, true)
  if (result.some(a => comparison.variants.find(b => b.variant_key === a.variant_key)?.scenario_id !== a.scenario_id)) throw new Error('Изменился состав вариантов. Перечитайте сравнение.')
  return { comparison_id: comparison.id, comparison_type: comparison.comparison_type, differences_summary: payload(v.differences_summary), selected_variant: choice(v.selected_variant), selection_reason: nullable(v.selection_reason), variants: result }
}
export function selectionBlock(comparison: Comparison, body: ComparisonSelection): string {
  if (comparison.selected_variant) return 'Выбор уже зафиксирован и не подлежит изменению.'
  if (comparison.status !== 'completed') return 'Дождитесь завершения подготовки пары.'
  const v = comparison.variants.find(v => v.variant_key === body.selected_variant)
  if (!v?.scenario_id || !v.is_cultural_available || (body.selected_variant === 'B' && !comparison.is_cultural_available)) return 'Этот вариант недоступен для выбора.'
  if (body.selection_reason.trim().length < 10) return 'Объясните выбор: не менее 10 символов.'
  try { if (body.cultural_usefulness_rating != null) rating(body.cultural_usefulness_rating) } catch { return 'Оценка должна быть целым числом от 1 до 5.' }
  return ''
}
export function comparisonStatus(status: string) { return ({ completed: 'Пара готова', pending: 'Подготовка пары', queued: 'В очереди', running: 'Подготовка пары', failed: 'Ошибка подготовки' } as Record<string, string>)[status] ?? `Статус сервера: ${status}` }
export function variantTitle(type: ComparisonType, key: VariantKey) { return type === 'universal_vs_personalized' ? (key === 'A' ? 'Универсальный сценарий' : 'Персонализированный сценарий') : (key === 'A' ? 'Без культурного контекста' : 'С культурным контекстом') }
export function comparisonObjects(value: JsonValue | undefined): ComparisonPayload[] { return Array.isArray(value) ? value.filter((v): v is ComparisonPayload => !!v && typeof v === 'object' && !Array.isArray(v)) : [] }
const payloadLabels: Record<string, string> = { age_group: 'Возрастная группа', grades: 'Классы', target_grades: 'Классы', participants_count_min: 'Участников от', participants_count_max: 'Участников до', family_involvement: 'Участие семьи', format_type: 'Формат', type: 'Тип', scale: 'Масштаб', total_duration_minutes: 'Продолжительность, мин.', mechanism_type: 'Педагогический механизм', title: 'Название', description: 'Описание', target_activity_title: 'Активность', personal: 'Личностные', meta_subject: 'Метапредметные', subject_specific: 'Предметные', knowledge: 'Знания', skills: 'Навыки', values: 'Ценности', presentation_slides: 'Слайды', slide_number: 'Слайд', bullet_points: 'Основные тезисы', visual_recommendations: 'Иллюстрации', speaker_notes: 'Заметки ведущего', handouts: 'Раздаточные материалы', checklist: 'Список подготовки' }
const payloadValues: Record<string, string> = { class_level: 'Классное', all_school: 'Общешкольное', family_community: 'Семейное', class_hour: 'Классный час', quiz: 'Викторина', quest: 'Квест', workshop: 'Мастер-класс', festival: 'Школьный праздник', roundtable: 'Круглый стол', basic_5_9: '5–9 классы', primary_1_4: '1–4 классы', senior_10_11: '10–11 классы', team_mutual_support_task: 'Командное задание с взаимопомощью' }
export function comparisonText(value: JsonValue | undefined): string { if (value == null) return ''; if (Array.isArray(value)) return value.map(comparisonText).filter(Boolean).join(' · '); if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${payloadLabels[k] ?? k}: ${comparisonText(v)}`).join('; '); if (typeof value === 'boolean') return value ? 'Да' : 'Нет'; return payloadValues[String(value)] ?? String(value) }
