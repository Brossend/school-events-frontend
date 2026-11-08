import { ref, shallowRef } from 'vue'
import type { GenerationRun } from '../types/generation'
import { ApiError } from './api-error'
import { terminal } from './generation'
export function createGenerationPoller(load: (signal: AbortSignal) => Promise<GenerationRun>, context: () => string, options: { interval?: number; maxWait?: number; maxErrors?: number; requestTimeout?: number; now?: () => number } = {}) {
  const data = shallowRef<GenerationRun | null>(null), error = shallowRef<Error | null>(null), pending = ref(false), pauseReason = ref('')
  const interval = options.interval ?? 2000, maxWait = options.maxWait ?? 600000, maxErrors = options.maxErrors ?? 6, now = options.now ?? (() => Date.now())
  let generation = 0, controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined, visible = true, enabled = false, failures = 0, started = 0
  function clearTimer() { if (timer) clearTimeout(timer); timer = undefined }
  function stop() { enabled = false; generation++; clearTimer(); controller?.abort(); pending.value = false; data.value = null; error.value = null; pauseReason.value = '' }
  function schedule(delay: number) { clearTimer(); if (!enabled || !visible || (data.value && terminal(data.value.status))) return; if (now() - started >= maxWait) { pauseReason.value = 'local_limit'; return } timer = setTimeout(() => { void read() }, delay) }
  async function read() {
    if (!enabled || !visible || pending.value) return
    clearTimer(); const token = generation, ctx = context(), active = new AbortController(); controller = active; pending.value = true
    let timedOut = false
    const deadline = setTimeout(() => { timedOut = true; active.abort() }, options.requestTimeout ?? 20000)
    const valid = () => token === generation && ctx === context() && (!active.signal.aborted || timedOut) && enabled
    try { const run = await load(active.signal); if (!valid()) return; if (timedOut) throw new ApiError(0, 'POLL_REQUEST_TIMEOUT', 'Истекло время чтения состояния. Серверная задача не отменялась.'); data.value = run; error.value = null; failures = 0; if (terminal(run.status)) { enabled = false; clearTimer() } }
    catch (cause) { if (!valid()) return; error.value = timedOut ? new ApiError(0, 'POLL_REQUEST_TIMEOUT', 'Истекло время чтения состояния. Серверная задача не отменялась.') : cause instanceof Error ? cause : new Error('Не удалось прочитать состояние.'); failures++; if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) { data.value = null; pauseReason.value = 'access'; enabled = false } else if (failures >= maxErrors) pauseReason.value = 'network_limit' }
    finally { clearTimeout(deadline); if (token === generation) { pending.value = false; if (enabled && !pauseReason.value) schedule(Math.min(30000, interval * 2 ** failures)) } }
  }
  function start() { stop(); enabled = true; started = now(); failures = 0; if (visible) void read(); else pauseReason.value = 'hidden' }
  function refresh() { if (pending.value) return; enabled = true; started = now(); failures = 0; pauseReason.value = visible ? '' : 'hidden'; if (visible) void read() }
  function setVisible(value: boolean) { visible = value; clearTimer(); if (!value) { if (enabled) pauseReason.value = 'hidden'; return } if (pauseReason.value === 'hidden') { pauseReason.value = ''; if (enabled) { started = now(); if (!pending.value) void read() } } }
  return { data, error, pending, pauseReason, start, stop, refresh, setVisible }
}
