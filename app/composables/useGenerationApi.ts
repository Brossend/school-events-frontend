import { ApiError } from '~/utils/api-error'
import { currentVersion, parseAccepted, parseRevision, parseRun, parseScenario } from '~/utils/generation'
export function useGenerationApi() {
  const api = useApi(), auth = useAuthStore()
  function school(id: string) { if (!auth.authenticated || !id || auth.tenant?.school_id !== id) throw new ApiError(403, 'GENERATION_CONTEXT_CHANGED', 'Контекст школы изменился. Перечитайте данные.') }
  async function run(id: string, schoolId: string, signal: AbortSignal) {
    school(schoolId)
    const result = parseRun(await api.request('get', '/generation-runs/{id}', { params: { id }, schoolId, signal, reportError: false }))
    if (result.id !== id) throw new Error('Ответ относится к другому запуску.')
    // Run JSON has no school_id. Resolve its request before exposing data, including for system_admin.
    const request = await api.request('get', '/scenario-requests/{id}', { params: { id: result.scenario_request_id }, schoolId, signal, reportError: false })
    if (request.data.school_id !== schoolId) throw new ApiError(403, 'SCHOOL_MISMATCH', 'Запуск относится к другой школе.')
    school(schoolId); return result
  }
  return {
    run,
    async launch(id: string, schoolId: string, key: string, signal: AbortSignal) { school(schoolId); return parseAccepted(await api.request('post', '/scenario-requests/{id}/generate', { params: { id }, schoolId, headers: { 'Idempotency-Key': key }, signal, reportError: false })) },
    async scenario(id: string, schoolId: string, signal: AbortSignal, runId?: string) {
      school(schoolId)
      const response = await api.request('get', '/scenarios/{id}', { params: { id }, schoolId, signal, reportError: false })
      const scenario = parseScenario(response, schoolId)
      if (scenario.id !== id) throw new Error('Ответ относится к другому сценарию.')
      const version = currentVersion(response)
      if (version !== null) scenario.revision = parseRevision(await api.request('get', '/scenarios/{id}/revisions/{version}', { params: { id, version }, schoolId, signal, reportError: false }), scenario)
      if (runId) { const generation = await run(runId, schoolId, signal); if (generation.scenario_id !== id || generation.scenario_request_id !== scenario.scenario_request_id) throw new ApiError(403, 'RUN_SCENARIO_MISMATCH', 'Запуск не соответствует этому сценарию.'); scenario.provider = generation.provider_name }
      school(schoolId); return scenario
    },
  }
}
