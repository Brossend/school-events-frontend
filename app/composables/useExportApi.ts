import type { ExportContext, ExportServices } from '~/types/exports'
import { parseExportAccepted, parseExportHistory, parseExportJob } from '~/utils/export-data'
import { ApiError } from '~/utils/api-error'
export function useExportApi(context: ExportContext): ExportServices {
  const api = useApi(), auth = useAuthStore(), editor = useScenarioEditorApi(context.scenario, context.school)
  const active = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); if (!auth.authenticated || auth.user?.id !== context.user || auth.tenant?.school_id !== context.school) throw new ApiError(403, 'EXPORT_CONTEXT_CHANGED', 'Контекст пользователя или школы изменился.') }
  const params = { id: context.scenario, version: context.version }
  async function history(signal: AbortSignal) { active(signal); const result = parseExportHistory(await api.request('get', '/scenarios/{id}/revisions/{version}/exports', { params, signal, schoolId: context.school, reportError: false }), context.revision); active(signal); return result }
  return {
    history,
    async snapshot(signal) { active(signal); const [document, verification, entries] = await Promise.all([editor.revision(context.version, signal), editor.checks(context.version, signal), history(signal)]); active(signal); if (document.revision.id !== context.revision) throw new Error('Ревизия не соответствует выбранному контексту.'); return { document, verification, history: entries } },
    async job(id, signal) { active(signal); const result = parseExportJob(await api.request('get', '/export-jobs/{id}', { params: { id }, signal, schoolId: context.school, reportError: false })); active(signal); if (result.id !== id) throw new Error('Сервер вернул другое задание.'); return result },
    async create(format, key, signal) { active(signal); if (!['teacher', 'school_admin'].includes(auth.tenant?.role ?? '')) throw new ApiError(403, 'EXPORT_SCHOOL_ROLE_REQUIRED', 'Для экспорта нужны школьные полномочия.'); const id = parseExportAccepted(await api.request('post', '/scenarios/{id}/revisions/{version}/exports', { params, body: { format }, headers: { 'Idempotency-Key': key }, signal, schoolId: context.school, reportError: false })); active(signal); return id },
    async download(entry, signal) { active(signal); if (entry.revision_id !== context.revision || !entry.is_downloadable || entry.status !== 'ready' || !entry.artifact) throw new ApiError(403, 'EXPORT_DOWNLOAD_BLOCKED', 'Сервер не разрешил скачивание этого документа.'); const result = await api.downloadExport(entry.id, entry.format, { schoolId: context.school, signal, checksum: entry.artifact.sha256_hash }); active(signal); return result },
  }
}
