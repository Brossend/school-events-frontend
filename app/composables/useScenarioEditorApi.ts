import type { EditorDocument, EditorServices, HistoricalSignoff } from '~/types/editor'
import { parseScenario, parseRevision, currentVersion, record, string, uuid } from '~/utils/generation'
import { parseVerification } from '~/utils/scenario-editor'
import { ApiError } from '~/utils/api-error'
export function useScenarioEditorApi(id: string, schoolId: string): EditorServices {
  const api = useApi(), auth = useAuthStore(), userId = auth.user?.id
  function active(signal: AbortSignal) { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); if (!auth.authenticated || !userId || auth.user?.id !== userId || auth.tenant?.school_id !== schoolId) throw new ApiError(403, 'EDITOR_CONTEXT_CHANGED', 'Контекст пользователя или школы изменился.') }
  async function load(signal: AbortSignal, selected?: number): Promise<EditorDocument> {
    active(signal)
    const envelope = await api.request('get', '/scenarios/{id}', { params: { id }, schoolId, signal, reportError: false }), raw = record(record(envelope).data), scenario = parseScenario(envelope, schoolId), current = currentVersion(envelope)
    if (scenario.id !== id || current == null || typeof raw.optimistic_lock_version !== 'number' || !Number.isInteger(raw.optimistic_lock_version) || raw.optimistic_lock_version < 0) throw new Error('Сервер не передал актуальную ревизию или optimistic lock.')
    const version = selected ?? current
    const payload = await api.request('get', '/scenarios/{id}/revisions/{version}', { params: { id, version }, schoolId, signal, reportError: false }), r = record(record(payload).data)
    const revision = parseRevision(payload, selected && selected !== current ? { ...scenario, current_revision_id: uuid(r.id) } : scenario)
    if (revision.version_number !== version || revision.is_current !== (version === current)) throw new Error('Ревизия изменилась во время чтения. Перечитайте сценарий.')
    const request = record(record(await api.request('get', '/scenario-requests/{id}', { params: { id: scenario.scenario_request_id }, schoolId, signal, reportError: false })).data)
    if (request.school_id !== schoolId || request.id !== scenario.scenario_request_id) throw new ApiError(403, 'SCHOOL_MISMATCH', 'Запрос относится к другой школе.')
    let signoff: HistoricalSignoff | null = null
    if (r.signoff != null) { const s = record(r.signoff); signoff = { id: uuid(s.id), confirmed_at: s.confirmed_at == null ? null : string(s.confirmed_at), teacher_notes: s.teacher_notes == null ? null : string(s.teacher_notes), is_confirmed: s.is_confirmed === true, user: s.user == null ? null : { id: uuid(record(s.user).id), name: string(record(s.user).name) } } }
    scenario.revision = revision; active(signal)
    return { scenario, revision, lock: raw.optimistic_lock_version, authorId: uuid(request.user_id), signoff, archived: raw.is_archived === true }
  }
  function mutation(doc: EditorDocument, signal: AbortSignal) { active(signal); if (doc.scenario.id !== id || doc.scenario.school_id !== schoolId || !doc.revision.is_current || !['teacher', 'school_admin'].includes(auth.tenant?.role ?? '') || !(doc.authorId === userId || auth.tenant?.role === 'school_admin')) throw new ApiError(403, 'EDITOR_FORBIDDEN', 'Нет школьных полномочий для этого действия.'); return { id, version: doc.revision.version_number } }
  return {
    load, revision: (version, signal) => load(signal, version),
    async checks(version, signal) { active(signal); const response = await api.request('get', '/scenarios/{id}/revisions/{version}/verifications', { params: { id, version }, schoolId, signal, reportError: false }); active(signal); return parseVerification(response) },
    async patch(doc, body, signal) { const params = mutation(doc, signal); return api.request('patch', '/scenarios/{id}/revisions/{version}', { params, body, headers: { 'If-Match': String(doc.lock) }, schoolId, signal, reportError: false }) },
    async verify(doc, signal) { const params = mutation(doc, signal); const response = await api.request('post', '/scenarios/{id}/revisions/{version}/verify', { params, schoolId, signal, reportError: false }); return uuid(record(record(response).data).verification_run_id) },
    async signoff(doc, body, signal) { const params = mutation(doc, signal); if (!body.safety_checked || !body.timing_fit || !body.cultural_context_approved) throw new Error('Подтвердите три пункта чек-листа.'); const input = { checklist_confirmed: { safety_checked: true as const, timing_fit: true as const, cultural_context_approved: true as const }, teacher_notes: body.teacher_notes || null, warnings_acknowledged: body.warnings_acknowledged }; return api.request('post', '/scenarios/{id}/revisions/{version}/signoff', { params, body: input, schoolId, signal, reportError: false }) },
  }
}
