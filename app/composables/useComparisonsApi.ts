import type { ComparisonContext } from '~/types/comparisons'
import { createComparisonsApi } from '~/utils/comparisons-api'

export function useComparisonsApi() {
  const api = useApi(), auth = useAuthStore(), config = useRuntimeConfig()
  const context = (): ComparisonContext => ({ user: auth.user?.id ?? '', school: auth.tenant?.school_id ?? '', role: auth.tenant?.role ?? '', authenticated: auth.authenticated })
  return { context, forContext: () => createComparisonsApi(api, { ...context() }, context, config.public.apiOrigin) }
}
