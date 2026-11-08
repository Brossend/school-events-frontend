import { ref, shallowRef } from 'vue'
import { ApiError } from './api-error'
export function createContextMutation(context: () => string) {
  const pending = ref(false), error = shallowRef<ApiError | null>(null)
  let generation = 0, controller: AbortController | undefined
  function reset() { generation++; controller?.abort(); pending.value = false; error.value = null }
  async function run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
    if (pending.value) return { ok: false }
    reset()
    const token = generation, key = context(), active = new AbortController()
    controller = active; pending.value = true
    const valid = () => token === generation && key === context() && !active.signal.aborted
    try { const data = await work(active.signal); return valid() ? { ok: true, data } : { ok: false } }
    catch (cause) { if (valid()) error.value = cause instanceof ApiError ? cause : new ApiError(0, 'MUTATION_FAILED', cause instanceof Error ? cause.message : 'Не удалось сохранить изменения.'); return { ok: false } }
    finally { if (token === generation) pending.value = false }
  }
  return { pending, error, reset, run }
}
