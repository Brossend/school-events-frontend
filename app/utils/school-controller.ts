import { ref, shallowRef } from 'vue'
import type { SchoolDraft, SchoolProfile, SchoolProfileInput } from '../types/school'
import { ApiError } from './api-error'
import { schoolCriticalChanges, schoolDraft, schoolInputIssues, schoolPatch } from './school'

interface SchoolService {
  context(): string
  permissions(): { read: boolean; edit: boolean }
  get(id: string, signal: AbortSignal): Promise<SchoolProfile>
  update(id: string, body: SchoolProfileInput, signal: AbortSignal): Promise<SchoolProfile>
}
export function createSchoolController(api: SchoolService, target: () => string) {
  const profile = shallowRef<SchoolProfile | null>(null), draft = ref<SchoolDraft | null>(null)
  const pending = ref(false), loading = ref(false), uncertain = ref(false), needsReconcile = ref(false)
  const error = shallowRef<Error | null>(null), issues = ref<Record<string, string>>({}), notice = ref('')
  const confirmation = shallowRef<{ body: SchoolProfileInput; context: string } | null>(null)
  let epoch = 0, active: AbortController | undefined
  function reset() { epoch++; active?.abort(); profile.value = null; draft.value = null; pending.value = false; loading.value = false; uncertain.value = false; needsReconcile.value = false; error.value = null; issues.value = {}; notice.value = ''; confirmation.value = null }
  async function load(reconcile = false) {
    if (pending.value || loading.value || !api.permissions().read) return
    const version = ++epoch, context = api.context(), id = target(), controller = new AbortController()
    active?.abort(); active = controller; loading.value = true; error.value = null; confirmation.value = null
    const valid = () => version === epoch && context === api.context() && !controller.signal.aborted
    try {
      const value = await api.get(id, controller.signal)
      if (!valid()) return
      profile.value = value
      if (!reconcile || !draft.value) draft.value = schoolDraft(value)
      if (reconcile) { uncertain.value = false; needsReconcile.value = false; notice.value = 'Актуальные данные перечитаны. Сравните их с сохранённым вводом перед новым действием.' }
    } catch (cause) { if (valid()) error.value = cause instanceof Error ? cause : new Error('Не удалось загрузить профиль школы.') }
    finally { if (version === epoch) loading.value = false }
  }
  function prepare() {
    if (!profile.value || !draft.value || !api.permissions().edit || pending.value || loading.value || uncertain.value || needsReconcile.value) return
    error.value = null; notice.value = ''; confirmation.value = null
    const body = schoolPatch(profile.value, draft.value)
    issues.value = schoolInputIssues(body)
    if (Object.keys(issues.value).length) return
    if (!Object.keys(body).length) { notice.value = 'Нет изменений для сохранения.'; return }
    if (schoolCriticalChanges(body).length) confirmation.value = { body, context: api.context() }
    else void save(body, api.context())
  }
  async function confirm() {
    const prepared = confirmation.value
    confirmation.value = null
    if (prepared) await save(prepared.body, prepared.context)
  }
  async function save(body: SchoolProfileInput, expectedContext: string) {
    if (!profile.value || !draft.value || !api.permissions().edit || pending.value || loading.value || uncertain.value || needsReconcile.value || expectedContext !== api.context()) return
    // The confirmed payload must still equal the current draft; stale modal approval cannot authorize new edits.
    if (JSON.stringify(body) !== JSON.stringify(schoolPatch(profile.value, draft.value))) return
    const version = ++epoch, context = api.context(), id = target(), baseline = profile.value, controller = new AbortController()
    active?.abort(); active = controller; pending.value = true; error.value = null; issues.value = {}; notice.value = ''
    const valid = () => version === epoch && context === api.context() && !controller.signal.aborted
    let dispatched = false, accepted = false
    try {
      const current = await api.get(id, controller.signal)
      if (!valid() || !api.permissions().edit) return
      if (JSON.stringify(current) !== JSON.stringify(baseline)) {
        profile.value = current
        throw new ApiError(409, 'SCHOOL_PROFILE_CHANGED', 'Профиль изменился на сервере. Ввод сохранён; сравните данные и подтвердите изменения заново.')
      }
      dispatched = true
      await api.update(id, body, controller.signal)
      accepted = true
      if (!valid()) return
      needsReconcile.value = true
      const refreshed = await api.get(id, controller.signal)
      if (!valid()) return
      profile.value = refreshed; draft.value = schoolDraft(refreshed); needsReconcile.value = false
      notice.value = 'Изменения сохранены. Профиль перечитан с сервера.'
    } catch (cause) {
      if (!valid()) return
      const unknown = dispatched && !accepted && (!(cause instanceof ApiError) || cause.status === 0 || cause.status === 408 || cause.status >= 500)
      uncertain.value = unknown
      error.value = accepted ? new Error('Изменения приняты сервером, но профиль не удалось перечитать. Проверьте состояние кнопкой ниже.') : unknown ? new Error('Результат сохранения неизвестен. Повторная запись заблокирована до GET-сверки.') : cause instanceof Error ? cause : new Error('Не удалось сохранить профиль.')
      if (cause instanceof ApiError && cause.status === 422) issues.value = Object.fromEntries(cause.details.map(issue => [issue.field, issue.message]))
      // GET is safe after an ambiguous PATCH. Keep the draft and blocked write until user reviews it.
      if (unknown || dispatched && cause instanceof ApiError && cause.status === 409) {
        try { const value = await api.get(id, controller.signal); if (valid()) profile.value = value } catch { /* Original outcome stays visible. */ }
      }
    } finally { if (version === epoch) pending.value = false }
  }
  function useServerValues() { if (profile.value && !pending.value && !loading.value) { draft.value = schoolDraft(profile.value); issues.value = {}; confirmation.value = null } }
  return { profile, draft, pending, loading, uncertain, needsReconcile, error, issues, notice, confirmation, reset, load, prepare, confirm, useServerValues }
}
