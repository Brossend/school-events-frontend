import type { ParticipantInput, PilotResponseInput, PilotReviewInput } from '~/types/pilot'
import { ApiError } from '~/utils/api-error'
import { createApiClient } from '~/utils/api-client'
import { parsePilotMetrics, parsePilotParticipants, parsePilotInvitation, parsePilotResponse, parsePilotReview, parsePilotReviewHistory, parsePilotExport } from '~/utils/pilot'
import { isolatedPilotOrigin } from '~/utils/pilot-mutation'

export function usePilotApi() {
  const api = useApi(), auth = useAuthStore(), config = useRuntimeConfig()
  const isolated = isolatedPilotOrigin(config.public.apiOrigin)
  const context = () => JSON.stringify([auth.user?.id, auth.tenant?.school_id, auth.tenant?.role, auth.systemRole])
  const school = () => auth.tenant?.school_id
  async function guard<T>(signal: AbortSignal, work: (schoolId: string | undefined) => Promise<T>) {
    const key = context()
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (!auth.authenticated) throw new ApiError(401, 'AUTH_REQUIRED', 'Войдите в систему.')
    const result = await work(school())
    if (signal.aborted || key !== context()) throw new DOMException('Aborted', 'AbortError')
    return result
  }
  return {
    context, isolated,
    metrics: (signal: AbortSignal, synthetic = false, global = false) => guard(signal, async schoolId => parsePilotMetrics(await api.request('get', '/pilot/metrics', { signal, schoolId, tenant: !global, query: { scope: global ? 'global' : 'school', ...(isolated && synthetic ? { include_synthetic: true } : {}) }, reportError: false }))),
    participants: (signal: AbortSignal) => guard(signal, async schoolId => parsePilotParticipants(await api.request('get', '/pilot/participants', { schoolId, signal, reportError: false }))),
    create: (body: ParticipantInput, signal: AbortSignal) => guard(signal, async schoolId => parsePilotInvitation(await api.request('post', '/pilot/participants', { schoolId, signal, body: { ...body, is_synthetic: isolated ? true : undefined }, reportError: false }))),
    reissue: (id: string, signal: AbortSignal) => guard(signal, async schoolId => parsePilotInvitation(await api.request('post', '/pilot/participants/{id}/reissue', { params: { id }, schoolId, signal, reportError: false }))),
    revoke: (id: string, signal: AbortSignal) => guard(signal, async schoolId => (await api.request('post', '/pilot/participants/{id}/revoke', { params: { id }, schoolId, signal, reportError: false })).data),
    response: (id: string, signal: AbortSignal) => guard(signal, async schoolId => parsePilotResponse(await api.request('get', '/pilot/responses/{id}', { params: { id }, schoolId, signal, tenant: false, reportError: false }))),
    reviews: (id: string, signal: AbortSignal) => guard(signal, async schoolId => parsePilotReviewHistory(await api.request('get', '/pilot/responses/{id}/reviews', { params: { id }, schoolId, signal, tenant: false, reportError: false }))),
    review: (id: string, body: PilotReviewInput, signal: AbortSignal) => guard(signal, async schoolId => parsePilotReview(await api.request('post', '/pilot/responses/{id}/reviews', { params: { id }, schoolId, signal, tenant: false, body, reportError: false }))),
    export: (signal: AbortSignal, synthetic = false, global = false) => guard(signal, async schoolId => ({ data: parsePilotExport(await api.request('get', '/pilot/export', { signal, schoolId, tenant: !global, query: { scope: global ? 'global' : 'school', ...(isolated && synthetic ? { include_synthetic: true } : {}) }, reportError: false })) })),
  }
}

export function usePublicPilotApi() {
  const config = useRuntimeConfig()
  // No auth callbacks, tenant header, logging or persistence of the invitation.
  const api = createApiClient({ origin: config.public.apiOrigin, getSchoolId: () => undefined, getCookie: () => document.cookie })
  return { submit: async (body: PilotResponseInput, signal: AbortSignal) => parsePilotResponse(await api.request('post', '/pilot/responses', { body, signal, tenant: false, reportError: false })) }
}
