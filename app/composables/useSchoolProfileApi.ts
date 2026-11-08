import type { SchoolAccessContext, SchoolProfileInput } from '~/types/school'
import { parseSchoolProfile, schoolAllowedInput, schoolContextKey, schoolPermissions, schoolInputIssues } from '~/utils/school'
import { ApiError } from '~/utils/api-error'

export function useSchoolProfileApi(target: () => string) {
  const api = useApi(), auth = useAuthStore()
  // AuthController does not serialize is_active; authenticated /auth/me rejects inactive accounts.
  function access(): SchoolAccessContext { return { authenticated: auth.authenticated, active: auth.authenticated, userId: auth.user?.id ?? '', systemRole: auth.systemRole, schoolId: auth.tenant?.school_id, schoolRole: auth.tenant?.role, targetId: target() } }
  function guard(id: string, edit = false) {
    const c = access(), p = schoolPermissions(c)
    if (id !== c.targetId || !(edit ? p.edit : p.read)) throw new ApiError(403, 'SCHOOL_CONTEXT_CHANGED', 'Нет доступа к выбранной школе. Проверьте текущую школу и права.')
  }
  return {
    access, context: () => schoolContextKey(access()), permissions: () => schoolPermissions(access()),
    async get(id: string, signal: AbortSignal) { guard(id); return parseSchoolProfile(await api.request('get', '/schools/{id}', { params: { id }, tenant: false, signal, reportError: false }), id) },
    async update(id: string, body: SchoolProfileInput, signal: AbortSignal) {
      guard(id, true)
      body = schoolAllowedInput(body)
      const issues = schoolInputIssues(body)
      if (Object.keys(issues).length) throw new ApiError(422, 'SCHOOL_VALIDATION', 'Проверьте введённые данные.', Object.entries(issues).map(([field, message]) => ({ field, message })))
      // No tenant middleware is required by these routes. A system administrator may have no membership.
      return parseSchoolProfile(await api.request('patch', '/schools/{id}', { params: { id }, body, tenant: false, signal, reportError: false }), id)
    },
  }
}
