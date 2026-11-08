import { createGenerationPoller } from '~/utils/generation-poller'
export function useGenerationRun(id: () => string) {
  const auth = useAuthStore(), api = useGenerationApi()
  const context = () => `${auth.user?.id ?? ''}:${auth.tenant?.school_id ?? ''}:${id()}`
  const poller = createGenerationPoller(signal => api.run(id(), auth.tenant!.school_id, signal), context)
  const visibility = () => poller.setVisible(!document.hidden)
  visibility()
  watch(context, () => { poller.stop(); if (auth.authenticated && auth.tenant && id()) poller.start() }, { immediate: true, flush: 'sync' })
  onMounted(() => document.addEventListener('visibilitychange', visibility))
  onBeforeUnmount(() => { document.removeEventListener('visibilitychange', visibility); poller.stop() })
  return poller
}
