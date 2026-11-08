import { createContextMutation } from '~/utils/context-mutation'
export function useTraditionMutation(id: () => string = () => '') {
  const auth = useAuthStore()
  const key = () => `${auth.authenticated}:${auth.user?.id ?? ''}:${auth.tenant?.school_id ?? ''}:${auth.tenant?.role ?? ''}:${auth.systemRole}:${id()}`
  const mutation = createContextMutation(key)
  watch(key, mutation.reset, { flush: 'sync' })
  onBeforeUnmount(mutation.reset)
  return mutation
}
