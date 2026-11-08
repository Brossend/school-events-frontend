import type { ApiClient } from './api-client'
import type { ComparisonContext, ComparisonCreateTransport, ComparisonsServices } from '../types/comparisons'
import { comparisonType, comparisonsTestBackend, parseComparison, parseComparisons, parseComparisonVariants, selectionBlock } from './comparisons'
import { ApiError } from './api-error'
import { uuid } from './generation'

export function createComparisonsApi(api: ApiClient, context: ComparisonContext, current: () => ComparisonContext, origin: string): ComparisonsServices {
  const scope = JSON.stringify(context)
  function active(signal: AbortSignal, mutate = false) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!context.authenticated || !context.user || !context.school || JSON.stringify(current()) !== scope) throw new ApiError(403, 'COMPARISON_CONTEXT_CHANGED', 'Контекст пользователя или школы изменился.')
    if (mutate && !['teacher', 'school_admin'].includes(context.role)) throw new ApiError(403, 'COMPARISON_MEMBERSHIP_REQUIRED', 'Нужно членство педагога или администратора в выбранной школе.')
  }
  const options = (signal: AbortSignal) => ({ schoolId: context.school, signal, reportError: false })
  const service: ComparisonsServices = {
    async request(id, signal) {
      active(signal); uuid(id)
      const result = await api.request('get', '/scenario-requests/{id}', { ...options(signal), params: { id } })
      active(signal)
      if (result.data.id !== id || result.data.school_id !== context.school) throw new ApiError(403, 'COMPARISON_REQUEST_MISMATCH', 'Запрос не принадлежит текущей школе.')
      return result.data
    },
    async list(signal) { active(signal); const response = await api.request('get', '/scenario-comparisons', options(signal)); active(signal); return parseComparisons(response, context.school) },
    async show(id, signal) { active(signal); uuid(id); const response = await api.request('get', '/scenario-comparisons/{id}', { ...options(signal), params: { id } }); active(signal); return parseComparison(response, context.school, id) },
    async variants(id, signal) { const comparison = await service.show(id, signal); active(signal); const response = await api.request('get', '/scenario-comparisons/{id}/variants', { ...options(signal), params: { id } }); active(signal); return parseComparisonVariants(response, comparison) },
    async create(input, signal) {
      active(signal, true); comparisonType(input.comparison_type); await service.request(input.scenario_request_id, signal); active(signal, true)
      const body: ComparisonCreateTransport = { scenario_request_id: input.scenario_request_id, comparison_type: input.comparison_type, ...(comparisonsTestBackend(origin) ? { is_synthetic: true } : {}) }
      const response = await api.request('post', '/scenario-comparisons', { ...options(signal), headers: { 'Idempotency-Key': crypto.randomUUID() }, body }); active(signal)
      const result = parseComparison(response, context.school)
      if (result.comparison_type !== body.comparison_type) throw new Error('Ответ относится к другому типу сравнения.')
      return result
    },
    async select(id, input, signal) {
      active(signal, true); const comparison = await service.show(id, signal); active(signal, true)
      const blocked = selectionBlock(comparison, input); if (blocked) throw new ApiError(409, 'COMPARISON_SELECTION_BLOCKED', blocked)
      const body = { selected_variant: input.selected_variant, selection_reason: input.selection_reason.trim(), ...(comparison.comparison_type === 'cultural_context' && input.cultural_usefulness_rating != null ? { cultural_usefulness_rating: input.cultural_usefulness_rating } : {}) }
      const response = await api.request('post', '/scenario-comparisons/{id}/selection', { ...options(signal), params: { id }, body }); active(signal); return parseComparison(response, context.school, id)
    },
  }
  return service
}
