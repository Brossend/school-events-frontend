export interface FieldIssue { field: string; message: string }

const messages: Record<number, string> = {
  0: 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.',
  401: 'Сессия завершилась. Войдите снова.',
  403: 'Недостаточно прав для этого действия.',
  409: 'Данные изменились. Обновите страницу перед повторной попыткой.',
  419: 'Не удалось обновить защиту сессии. Повторите попытку.',
  422: 'Проверьте введённые данные.',
  429: 'Слишком много попыток. Попробуйте немного позже.',
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: FieldIssue[] = [],
    public traceId?: string,
    public recovery?: { runId?: string; scenarioId?: string },
  ) { super(message); this.name = 'ApiError' }

  field(name: string) { return this.details.find(issue => issue.field === name)?.message }
}

export function toApiError(status: number, payload: unknown): ApiError {
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const error = data.error && typeof data.error === 'object' ? data.error as Record<string, unknown> : {}
  const details: FieldIssue[] = []
  if (Array.isArray(error.details)) {
    for (const issue of error.details) {
      if (issue && typeof issue.field === 'string' && typeof issue.message === 'string') details.push(issue)
    }
  }
  if (error.details && typeof error.details === 'object' && !Array.isArray(error.details)) {
    for (const [field, issues] of Object.entries(error.details)) {
      if (Array.isArray(issues)) for (const message of issues) if (typeof message === 'string') details.push({ field, message })
    }
  }
  // Laravel may return its standard validation envelope before a controller runs.
  if (data.errors && typeof data.errors === 'object') {
    for (const [field, issues] of Object.entries(data.errors)) {
      if (Array.isArray(issues)) for (const message of issues) if (typeof message === 'string') details.push({ field, message })
    }
  }
  const fallback = messages[status] ?? (status >= 500 ? 'Сервис временно недоступен. Попробуйте позже.' : 'Не удалось выполнить запрос.')
  // Generation conflicts and cached failed responses carry IDs outside field issues.
  // Keep only validated opaque IDs; never retain arbitrary response bodies here.
  const extra = error.details && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details as Record<string, unknown> : {}
  const uuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : undefined
  const recovery = { runId: uuid(extra.generation_run_id ?? extra.run_id ?? data.run_id), scenarioId: uuid(extra.scenario_id) }
  return new ApiError(status, typeof error.code === 'string' ? error.code : `HTTP_${status}`,
    status < 500 && typeof error.message === 'string' ? error.message : fallback,
    details, typeof error.trace_id === 'string' ? error.trace_id : undefined, recovery.runId || recovery.scenarioId ? recovery : undefined)
}
