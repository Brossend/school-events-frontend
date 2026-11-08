import type { components } from '../types/openapi'
export type ScenarioInput = components['schemas']['CreateScenarioRequestDTO']
export type SavedRequest = components['schemas']['ScenarioRequestEnvelope']['data']
export type Occasion = { kind: 'custom'; title: string } | { kind: 'calendar'; id: string; title: string } | { kind: 'tradition'; id: string; title: string }
export interface ConstructorDraft { occasion: Occasion; grades: number[]; count: string; duration: string; scale: ScenarioInput['scale'] | ''; format: ScenarioInput['format_type'] | ''; direction: ScenarioInput['value_direction'] | ''; family: boolean; resources: string[]; customResources: string; constraints: string }
export const steps = ['Событие', 'Участники', 'Формат', 'Цели и ресурсы', 'Проверка данных']
export const scales = { class_level: 'Классное', all_school: 'Общешкольное', family_community: 'Семейное' }
export const formats = { class_hour: 'Классный час', quiz: 'Викторина', quest: 'Квест', workshop: 'Мастер-класс', festival: 'Школьный праздник', roundtable: 'Круглый стол' }
export const directions = { family: 'Семья', mutual_aid: 'Взаимопомощь', historical_memory: 'Историческая память', labor_and_creation: 'Труд и созидание', cultural_diversity: 'Культурное многообразие', civic_responsibility: 'Гражданская ответственность' }
export const resourceOptions = ['Проектор', 'Бумага', 'Фломастеры', 'Компьютер', 'Колонки']
export function newDraft(): ConstructorDraft { return { occasion: { kind: 'custom', title: '' }, grades: [], count: '', duration: '', scale: '', format: '', direction: '', family: false, resources: [], customResources: '', constraints: '' } }
export function resources(d: ConstructorDraft) { return [...new Set([...d.resources, ...d.customResources.split('\n').map(v => v.trim()).filter(Boolean)])] }
export function validateDraft(d: ConstructorDraft): Record<string, string> {
  const e: Record<string, string> = {}, o = d.occasion
  if (o.kind === 'custom' ? o.title.trim().length < 3 || o.title.trim().length > 255 : !o.id) e.occasion = o.kind === 'custom' ? 'Введите название от 3 до 255 символов.' : 'Выберите повод из доступного каталога.'
  if (!d.grades.length || d.grades.some(g => !Number.isInteger(g) || g < 1 || g > 11)) e.target_grades = 'Выберите хотя бы один класс от 1 до 11.'
  for (const [field, raw, min, max] of [['participants_count', d.count, 5, 500], ['duration_minutes', d.duration, 20, 240]] as const) if (!String(raw).trim() || !Number.isInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) e[field] = `Введите целое число от ${min} до ${max}.`
  if (!Object.hasOwn(scales, d.scale)) e.scale = 'Выберите масштаб.'
  if (!Object.hasOwn(formats, d.format)) e.format_type = 'Выберите формат.'
  if (!Object.hasOwn(directions, d.direction)) e.value_direction = 'Выберите воспитательное направление.'
  if (resources(d).some(r => r.length > 255)) e.available_resources = 'Каждый ресурс — не более 255 символов.'
  if (d.constraints.length > 1000) e.pedagogical_constraints = 'Не более 1000 символов.'
  return e
}
export function fieldStep(field: string) { const name = field.split('.')[0]; return ['occasion', 'calendar_event_id', 'tradition_version_id', 'custom_event_title'].includes(name!) ? 1 : ['target_grades', 'participants_count', 'family_involvement'].includes(name!) ? 2 : ['scale', 'format_type', 'duration_minutes'].includes(name!) ? 3 : 4 }
export function scenarioBody(d: ConstructorDraft): ScenarioInput {
  if (Object.keys(validateDraft(d)).length) throw new Error('Заполните обязательные поля.')
  const occasion = d.occasion.kind === 'custom' ? { custom_event_title: d.occasion.title.trim() } : d.occasion.kind === 'calendar' ? { calendar_event_id: d.occasion.id } : { tradition_version_id: d.occasion.id }
  return { ...occasion, scale: d.scale as ScenarioInput['scale'], format_type: d.format as ScenarioInput['format_type'], target_grades: [...d.grades].sort((a, b) => a - b), participants_count: Number(d.count), duration_minutes: Number(d.duration), value_direction: d.direction as ScenarioInput['value_direction'], family_involvement: d.family, available_resources: resources(d), pedagogical_constraints: d.constraints.trim() || null }
}
export function allowedVersion(id: string, traditions: { title: string; versions: { id: string; academic_year: string }[] }[]): Occasion | null { for (const t of traditions) { const v = t.versions.find(v => v.id === id); if (v) return { kind: 'tradition', id, title: `${t.title} · ${v.academic_year}` } } return null }
