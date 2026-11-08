import { ref, shallowRef } from 'vue'
import type { GenerationReceipt, GenerationRun } from '../types/generation'
import { ApiError } from './api-error'
import { uuid } from './generation'
export function generationStorageKey(context: string) { return `fe006:generation:${context}` }
export function readGenerationReceipt(storage: Pick<Storage, 'getItem'>, context: string): GenerationReceipt | null {
  const raw = storage.getItem(generationStorageKey(context)); if (!raw) return null
  const v = JSON.parse(raw); uuid(v.key); if (!Number.isFinite(v.createdAt) || !['sending', 'uncertain', 'accepted', 'rejected'].includes(v.phase)) throw new Error('Некорректная квитанция запуска.'); if (v.runId) uuid(v.runId); if (v.scenarioId) uuid(v.scenarioId)
  return { key: v.key, createdAt: v.createdAt, phase: v.phase === 'sending' ? 'uncertain' : v.phase, ...(v.runId ? { runId: v.runId } : {}), ...(v.scenarioId ? { scenarioId: v.scenarioId } : {}) }
}
export function createGenerationLauncher(context: () => string, storage: Pick<Storage, 'getItem' | 'setItem'>, makeKey = () => crypto.randomUUID(), now = () => Date.now()) {
  const pending = ref(false), error = shallowRef<ApiError | null>(null), receipt = shallowRef<GenerationReceipt | null>(null)
  let generation = 0, controller: AbortController | undefined
  const storageError = () => new ApiError(0, 'GENERATION_STORAGE', 'Недоступно хранилище ключа запуска. POST заблокирован; восстановите доступ к хранилищу.')
  function reset() { generation++; controller?.abort(); pending.value = false; error.value = null; receipt.value = null; try { receipt.value = readGenerationReceipt(storage, context()) } catch { error.value = storageError() } }
  function persist(ctx: string, value: GenerationReceipt) { storage.setItem(generationStorageKey(ctx), JSON.stringify(value)) }
  async function launch(post: (key: string, signal: AbortSignal) => Promise<string>, previous?: GenerationRun) {
    if (pending.value || error.value?.code === 'GENERATION_STORAGE') return
    const ctx = context(), token = generation
    try { receipt.value = readGenerationReceipt(storage, ctx) } catch { error.value = storageError(); return }
    let current = receipt.value
    if (previous) {
      if (!['failed', 'timed_out'].includes(previous.status) || (current?.runId && current.runId !== previous.id) || !ctx.endsWith(`:${previous.scenario_request_id}`)) { error.value = new ApiError(409, 'RETRY_NOT_TERMINAL', 'Сначала перечитайте завершённую неудачную попытку.'); return }
      current = null
    } else if (current?.runId || current?.scenarioId) return
    if (current && now() - current.createdAt >= 23 * 60 * 60 * 1000) { error.value = new ApiError(409, 'KEY_RECOVERY_EXPIRED', 'Срок безопасного восстановления ключа истёк. Не создавайте новую попытку без сверки результата с администратором.'); return }
    current = { ...(current ?? { key: makeKey(), createdAt: now() }), phase: 'sending' }
    try { persist(ctx, current) } catch { error.value = storageError(); return }
    receipt.value = current; pending.value = true; error.value = null; const active = new AbortController(); controller = active
    try {
      const runId = uuid(await post(current.key, active.signal)), accepted: GenerationReceipt = { ...current, phase: 'accepted', runId }
      try { persist(ctx, accepted) } catch { /* Earlier sending marker retains the same key. */ }
      if (token === generation && ctx === context()) receipt.value = accepted
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : new ApiError(0, 'UNKNOWN_GENERATION_RESULT', 'Результат запуска неизвестен. Используйте восстановление с прежним ключом.')
      const recover = apiError.recovery
      const definite = apiError.status >= 400 && apiError.status < 500 && apiError.status !== 408
      const result: GenerationReceipt = { ...current, phase: recover?.runId || recover?.scenarioId ? 'accepted' : definite ? 'rejected' : 'uncertain', ...(recover?.runId ? { runId: recover.runId } : {}), ...(recover?.scenarioId ? { scenarioId: recover.scenarioId } : {}) }
      try { persist(ctx, result) } catch { /* Keep same-key recovery possible. */ }
      if (token === generation && ctx === context()) { receipt.value = result; error.value = apiError }
    } finally { if (token === generation) pending.value = false }
  }
  return { pending, error, receipt, reset, launch }
}
