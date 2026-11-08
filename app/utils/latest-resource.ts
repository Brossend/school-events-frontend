import { shallowRef, ref } from 'vue'

export function createLatestResource<T>(load: (signal: AbortSignal) => Promise<T>, getContext: () => string) {
  const data = shallowRef<T | null>(null), error = shallowRef<Error | null>(null), pending = ref(false)
  let version = 0, controller: AbortController | undefined
  function reset() { version++; controller?.abort(); data.value = null; error.value = null; pending.value = false }
  async function refresh() {
    reset()
    const current = version, context = getContext()
    const active = new AbortController()
    controller = active
    pending.value = true
    const valid = () => version === current && !active.signal.aborted && context === getContext()
    try { const result = await load(active.signal); if (valid()) data.value = result }
    catch (cause) { if (valid()) error.value = cause instanceof Error ? cause : new Error('Не удалось загрузить данные.') }
    finally { if (version === current) pending.value = false }
  }
  return { data, error, pending, refresh, reset }
}
