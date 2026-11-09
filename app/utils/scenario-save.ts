import { ref, shallowRef } from 'vue'
import { ApiError } from './api-error'
type Receipt = { state: 'sending' | 'uncertain' } | { state: 'saved'; id: string }
export function createScenarioSave(context: () => string, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const pending = ref(false), error = shallowRef<ApiError | null>(null), receipt = shallowRef<Receipt | null>(null)
  let generation = 0, controller: AbortController | undefined
  const key = (ctx: string) => `fe005:receipt:${ctx}`
  function reset() {
    generation++; controller?.abort(); pending.value = false; error.value = null; receipt.value = null
    try { const raw = storage.getItem(key(context())); if (raw) { const r = JSON.parse(raw); receipt.value = r.state === 'saved' && typeof r.id === 'string' ? { state: 'saved', id: r.id } : { state: 'uncertain' } } }
    catch { error.value = new ApiError(0, 'RECEIPT_STORAGE', 'Недоступно хранилище подтверждения. Сохранение заблокировано, чтобы избежать повторной записи.') }
  }
  async function save(work: (signal: AbortSignal) => Promise<string>) {
    if (pending.value || receipt.value || error.value?.code === 'RECEIPT_STORAGE') return
    const ctx = context(), token = generation, active = new AbortController(); controller = active
    try { storage.setItem(key(ctx), JSON.stringify({ state: 'sending' })) } catch { error.value = new ApiError(0, 'RECEIPT_STORAGE', 'Не удалось записать подтверждение операции. Запрос не отправлен.'); return }
    receipt.value = { state: 'sending' }; pending.value = true; error.value = null
    try {
      const id = await work(active.signal)
      if (!id) throw new Error('Не удалось получить подтверждение сохранения условий')
      // A confirmed server ID remains usable even if storage becomes unavailable.
      // The earlier sending marker still blocks a silent retry after reload.
      try { storage.setItem(key(ctx), JSON.stringify({ state: 'saved', id })) } catch { /* Keep the known ID in memory. */ }
      if (token === generation && ctx === context()) receipt.value = { state: 'saved', id }
    } catch (cause) {
      const definite = cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408
      try { if (definite) storage.removeItem(key(ctx)); else storage.setItem(key(ctx), JSON.stringify({ state: 'uncertain' })) } catch { /* Original sending marker remains conservative. */ }
      if (token === generation && ctx === context()) { receipt.value = definite ? null : { state: 'uncertain' }; error.value = cause instanceof ApiError ? cause : new ApiError(0, 'UNKNOWN_SAVE_RESULT', 'Не удалось подтвердить сохранение условий. Повторное сохранение заблокировано, чтобы не создать копию.') }
    } finally { if (token === generation) pending.value = false }
  }
  function acknowledgeNew() { if (pending.value) return; try { storage.removeItem(key(context())); receipt.value = null; error.value = null } catch { /* Fail closed. */ } }
  return { pending, error, receipt, reset, save, acknowledgeNew }
}
