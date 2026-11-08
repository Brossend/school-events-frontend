import { createApiClient } from '~/utils/api-client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const notifications = useNotificationsStore()
  const api = createApiClient({
    origin: config.public.apiOrigin,
    getSchoolId: () => auth.tenant?.school_id,
    getCookie: () => document.cookie,
    onUnauthorized: () => {
      auth.clear()
      if (window.location.pathname !== '/login') void navigateTo({ path: '/login', query: { redirect: window.location.pathname + window.location.search } })
    },
    onError: error => { notifications.message = error.message },
  })
  return { provide: { api } }
})
