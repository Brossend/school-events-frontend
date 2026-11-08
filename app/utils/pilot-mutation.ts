import { ref, shallowRef } from 'vue'
import { ApiError } from './api-error'

// A lost response is not a rejected write. Reconciliation never repeats the write.
export function createPilotMutation(context: () => string) {
  const pending = ref(false), uncertain = ref(false), error = shallowRef<Error | null>(null)
  let epoch = 0, active: AbortController | undefined
  function reset() { epoch++; active?.abort(); pending.value = false; uncertain.value = false; error.value = null }
  async function run<T>(write: (signal: AbortSignal) => Promise<T>, reconcile?: (signal: AbortSignal) => Promise<unknown>, preflight?: (signal: AbortSignal) => Promise<unknown>): Promise<T | undefined> {
    if (pending.value || uncertain.value) return
    const version = ++epoch, key = context(), controller = new AbortController()
    active = controller; pending.value = true; error.value = null
    const valid = () => version === epoch && key === context() && !controller.signal.aborted
    let dispatched = false
    try {
      if (preflight) await preflight(controller.signal)
      if (!valid()) return
      dispatched = true
      const value = await write(controller.signal); return valid() ? value : undefined
    }
    catch (cause) {
      if (!valid()) return
      const unknown = dispatched && (!(cause instanceof ApiError) || cause.status === 0 || cause.status === 408 || cause.status >= 500)
      uncertain.value = unknown
      error.value = unknown ? new Error('Результат отправки неизвестен. Повторная отправка заблокирована. Проверьте состояние на сервере; утраченный токен восстановить нельзя.') : cause instanceof Error ? cause : new Error('Предварительная проверка не выполнена.')
      if (reconcile && dispatched && (unknown || cause instanceof ApiError && cause.status === 409)) {
        try { await reconcile(controller.signal) } catch { /* Preserve the original write outcome. */ }
      }
    } finally { if (version === epoch) pending.value = false }
  }
  return { pending, uncertain, error, run, reset }
}

export function isolatedPilotOrigin(origin: string) {
  try { const url = new URL(origin); return url.origin === 'http://localhost:8001' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash } catch { return false }
}
