import { canAccess, type AccessRule } from '~/utils/access'

export default defineNuxtRouteMiddleware(async to => {
  // Token-based survey is public and does not bootstrap an authenticated session.
  if (to.path === '/pilot/respond' && to.meta.public) return
  const auth = useAuthStore()
  await auth.initialize()
  if (to.meta.public) return
  if (!auth.authenticated) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  const rule = (to.meta.access ?? {}) as AccessRule
  if (rule.tenant && !auth.tenant) return navigateTo('/profile')
  if (rule.catalog && !auth.tenant && auth.systemRole === 'none') return navigateTo('/profile')
  if (!canAccess(rule, auth.tenant?.role, auth.systemRole)) return navigateTo('/forbidden')
})
