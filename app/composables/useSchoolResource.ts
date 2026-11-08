import { createLatestResource } from '~/utils/latest-resource'

export function useSchoolResource<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: () => unknown = () => null, enabled: () => boolean = () => true) {
  const auth = useAuthStore()
  const resource = createLatestResource(load, () => auth.tenant?.school_id ?? '')
  watch(() => [auth.tenant?.school_id, dependencies(), enabled()], () => {
    if (auth.tenant && enabled()) void resource.refresh()
    else resource.reset()
  }, { immediate: true, flush: 'sync', deep: true })
  onBeforeUnmount(resource.reset)
  return resource
}
