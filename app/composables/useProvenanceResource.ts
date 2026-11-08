import { createLatestResource } from '~/utils/latest-resource'
import { canReviewSources } from '~/utils/provenance'
export function useProvenanceResource<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: () => unknown, enabled: () => boolean = () => true) {
  const auth = useAuthStore()
  const context = () => `${auth.authenticated}:${auth.user?.id ?? ''}:${auth.tenant?.school_id ?? ''}:${auth.systemRole}`
  const resource = createLatestResource(load, context)
  watch(() => [context(), dependencies(), enabled()], () => {
    if (auth.authenticated && (auth.tenant || canReviewSources(auth.systemRole)) && enabled()) void resource.refresh()
    else resource.reset()
  }, { immediate: true, flush: 'sync', deep: true })
  onBeforeUnmount(resource.reset)
  return resource
}
