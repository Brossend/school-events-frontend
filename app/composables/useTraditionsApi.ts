import type { AnnualInput, TraditionFilter, TraditionInput } from '~/types/traditions'
import { parseTradition, parseTraditions } from '~/utils/traditions'
import { ApiError } from '~/utils/api-error'
export function useTraditionsApi() {
  const api = useApi(), auth = useAuthStore()
  function school(id: string) { if (!auth.authenticated || !id || auth.tenant?.school_id !== id) throw new ApiError(403, 'TRADITION_CONTEXT_CHANGED', 'Активная школа изменилась. Обновите данные перед действием.') }
  return {
    async list(schoolId: string, filter: TraditionFilter, signal: AbortSignal) { school(schoolId); return parseTraditions(await api.request('get', '/schools/{schoolId}/traditions', { params: { schoolId }, query: { is_archived: filter }, schoolId, signal, reportError: false })) },
    async detail(id: string, schoolId: string, signal: AbortSignal) { school(schoolId); return parseTradition(await api.request('get', '/traditions/{id}', { params: { id }, schoolId, signal, reportError: false }), schoolId) },
    async create(schoolId: string, body: TraditionInput, signal: AbortSignal) { school(schoolId); const response = await api.request('post', '/schools/{schoolId}/traditions', { params: { schoolId }, schoolId, body, signal, reportError: false }); if (!response?.data?.id) throw new Error('Сервер не вернул идентификатор сохранённой традиции. Проверьте список перед повтором.'); return response.data.id },
    async update(id: string, schoolId: string, body: TraditionInput, signal: AbortSignal) { school(schoolId); await api.request('patch', '/traditions/{id}', { params: { id }, schoolId, body, signal, reportError: false }) },
    async annual(id: string, schoolId: string, body: AnnualInput, signal: AbortSignal) { school(schoolId); await api.request('post', '/traditions/{id}/versions', { params: { id }, schoolId, body, signal, reportError: false }) },
    async archive(id: string, schoolId: string, signal: AbortSignal) { school(schoolId); await api.request('post', '/traditions/{id}/archive', { params: { id }, schoolId, signal, reportError: false }) },
  }
}
