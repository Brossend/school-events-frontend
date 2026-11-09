/** Keep machine paths in API models; translate them only at the presentation boundary. */
const fields: Record<string, string> = {
  concept: 'Замысел мероприятия', pedagogical_goal: 'Педагогическая цель', pedagogical_tasks: 'Задачи',
  materials: 'Материалы', printable_cards: 'Карточка задания', handouts: 'Рабочий лист', presentation_slides: 'Слайд',
  stages: 'Этап', activities: 'Задание', roles: 'Роль участника', cultural_claims: 'Культурное утверждение',
  title: 'Название', front_text: 'Условие задания', back_text: 'Ответ и пояснение педагогу', template_content: 'Шаблон',
  instructions: 'Инструкция', teacher_actions: 'Действия педагога', student_actions: 'Действия участников',
  duration_minutes: 'Продолжительность', dialogue_prompts: 'Вопросы для обсуждения', speaker_notes: 'Заметки ведущего',
  bullet_points: 'Содержание', source_references: 'Источник', claim_text: 'Факт для проверки',
  target_grades: 'Классы', participants_count: 'Количество участников', value_direction: 'Воспитательное направление',
  available_resources: 'Ресурсы', family_involvement: 'Участие семьи', pedagogical_constraints: 'Особенности класса',
  scale: 'Масштаб', format_type: 'Формат', custom_event_title: 'Название события', occasion: 'Событие',
  teacher_instructions: 'Инструкции педагогу', expected_outcomes: 'Ожидаемые результаты', handout: 'Рабочий лист',
  personal: 'Личностные задачи', meta_subject: 'Метапредметные задачи', subject_specific: 'Предметные задачи',
  teacher_tips: 'Подсказки педагогу', transition_text: 'Переход к следующему этапу', stage_type: 'Тип этапа',
  slide_number: 'Номер слайда', visual_recommendations: 'Рекомендации к оформлению', card_type: 'Вид карточки', quantity_per_group: 'На одну группу',
  knowledge: 'Знания', skills: 'Умения', values: 'Ценностные ориентиры', description: 'Описание',
  pedagogical_mechanism: 'Педагогический приём', mechanism_type: 'Вид педагогического приёма', target_activity_title: 'Основная деятельность',
  preparation_checklist: 'Подготовка', target_audience: 'Участники', format: 'Формат', props: 'Ресурсы и реквизит',
  general_safety_rules: 'Правила безопасности', methodological_recommendations: 'Методические рекомендации', adaptation_for_disabilities_or_small_groups: 'Адаптация и участие каждого',
  calendar_event_id: 'Событие календаря', tradition_version_id: 'Версия школьной традиции',
  age_group: 'Возрастная группа', participants_count_min: 'Минимум участников', participants_count_max: 'Максимум участников', total_duration_minutes: 'Общая продолжительность',
  role_name: 'Роль', target_participants: 'Участники', group_size: 'Размер группы', specific_tasks: 'Задачи участников',
  activity_type: 'Вид задания', rules_and_instructions: 'Правила и инструкции', scoring_or_evaluation: 'Оценка и обратная связь',
  item_name: 'Ресурс', quantity: 'Количество', is_mandatory: 'Обязательно', alternative_if_missing: 'Альтернатива',
  timeline_phase: 'Когда подготовить', task_description: 'Задача подготовки', responsible_person: 'Ответственный',
}
const values: Record<string, string> = {
  organizational_moment: 'Организационный момент', motivation_introduction: 'Введение и мотивация', main_interactive_part: 'Основная интерактивная часть', practical_task: 'Практическая задача', reflection_summary: 'Итоговая рефлексия', ritual_conclusion: 'Завершение',
  family_investigation: 'Семейное исследование', team_mutual_support_task: 'Командная взаимопомощь', historical_source_analysis: 'Работа с историческим источником', collaborative_creative_product: 'Совместное творчество', comparative_cultural_study: 'Сравнение культурных традиций', civic_community_action: 'Общественно полезное дело',
}
export function teacherValue(value: string): string { return Object.hasOwn(values, value) ? values[value]! : value }
/** Canonicalize field addresses without changing the API payload or the draft. */
export function teacherPath(path: string): string {
  return path.replace(/^\$\.?/, '').replace(/\[['"]?([^\]'" ]+)['"]?\]/g, '.$1').replace(/^\./, '')
    .replace(/^(?:(?:revision|content_payload)\.)+/, '')
}
export function teacherError(errors: { field: string; message: string }[] | undefined, path: string): string | undefined {
  const message = errors?.find(issue => teacherPath(issue.field) === teacherPath(path))?.message
  return message ? teacherText(message) : undefined
}
export function teacherField(path: string): string {
  const parts = teacherPath(path).split('.').filter(Boolean)
  const result: string[] = []
  for (const part of parts) {
    if (/^\d+$/.test(part)) { if (result.length) result[result.length - 1] += ` № ${Number(part) + 1}` }
    else if (Object.hasOwn(fields, part)) result.push(fields[part]!)
  }
  return result.length ? result.join(' — ') : 'Материал сценария'
}
export function teacherText(message: string): string {
  const segment = String.raw`(?:\.[A-Za-z_0-9-]+|\[(?:\d+|['"][A-Za-z_0-9-]+['"])\])`
  const roots = Object.keys(fields).filter(key => key.includes('_') || ['concept', 'materials', 'stages', 'activities', 'roles', 'handout'].includes(key))
  return message.split(/(https?:\/\/[^\s<>"']+)/g).map(part => /^https?:\/\//.test(part) ? part : part.replace(new RegExp(String.raw`\$(?:${segment})+|\b(?:revision|content_payload|${roots.join('|')})(?:${segment})*(?![A-Za-z0-9_])`, 'g'), path => teacherField(path))
    .replace(/\b(?:JSON(?: Schema|Path)?|DTO|payload|endpoint|backend|tenant|fingerprint)\b/gi, 'служебные данные')
    .replace(/Teacher Sign-Off/g, 'подтверждение педагогом')
    .replace(/\b(?:teacher_instructions|expected_outcomes|handout)\b/g, key => fields[key] ?? 'Материал сценария')
    .replace(/>=\s*(\d+)/g, 'не менее $1')).join('')
}
export function qualityAdvice(path: string, message: string): string {
  if (/printable_cards/.test(path) && /недостат|содержательн|проверяем|услови/i.test(message)) return `${teacherField(path)}: уточните условие, добавьте необходимые данные и правильный ответ для педагога.`
  return teacherText(message)
}
