import { ref, shallowRef } from 'vue'
import type { Comparison, ComparisonContext, ComparisonHistoryItem, ComparisonSelection, ComparisonsServices, ComparisonType, ComparisonVariants } from '../types/comparisons'
import type { SavedRequest } from './scenario-constructor'
import { ApiError } from './api-error'
import { comparisonType, selectionBlock } from './comparisons'
import { uuid } from './generation'

export function createComparisonsController(service: ComparisonsServices, context: () => ComparisonContext, timeoutMs = 60000) {
  const history = shallowRef<ComparisonHistoryItem[]>([]), comparison = shallowRef<Comparison | null>(null), variantData = shallowRef<ComparisonVariants | null>(null), request = shallowRef<SavedRequest | null>(null)
  const pending = ref(''), error = shallowRef<Error | null>(null), confirmation = shallowRef<ComparisonSelection | null>(null), uncertain = ref<'' | 'create' | 'selection'>('')
  let epoch = 0, controller: AbortController | undefined, uncertainComparisonId = ''
  function reset() { epoch++; controller?.abort(); history.value = []; comparison.value = null; variantData.value = null; request.value = null; pending.value = ''; error.value = null; confirmation.value = null; uncertain.value = ''; uncertainComparisonId = '' }
  const contextKey = () => JSON.stringify(context())
  function allowed(school: string) { const ctx = context(); if (!ctx.authenticated || !ctx.user || !school || ctx.school !== school || !['teacher', 'school_admin'].includes(ctx.role)) throw new ApiError(403, 'COMPARISON_CONTEXT_BLOCKED', 'Нужно членство в текущей школе.') }
  async function operation(name: string, work: (s: AbortSignal, valid: () => boolean) => Promise<void>) {
    if (pending.value) return
    const token = epoch, ctx = contextKey(), active = new AbortController(); controller = active; pending.value = name; error.value = null
    const valid = () => token === epoch && ctx === contextKey() && !active.signal.aborted
    const timer = setTimeout(() => active.abort(), timeoutMs)
    try { await work(active.signal, valid) } catch (e) { if (token === epoch && ctx === contextKey()) { error.value = active.signal.aborted ? new Error('Время ожидания истекло. Перечитайте состояние через GET; POST автоматически не повторяется.') : e instanceof Error ? e : new Error('Не удалось выполнить действие.'); if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { comparison.value = null; variantData.value = null; request.value = null; confirmation.value = null; history.value = [] } } }
    finally { clearTimeout(timer); if (token === epoch) pending.value = '' }
  }
  async function refresh() { await operation('history', async (s, valid) => { const result = await service.list(s); if (valid()) history.value = result }) }
  async function loadRequest(id: string) { request.value = null; await operation('request', async (s, valid) => { uuid(id); const result = await service.request(id, s); if (!valid()) return; allowed(result.school_id); if (result.id !== id) throw new Error('Ответ относится к другому запросу.'); request.value = result }) }
  function apply(value: Comparison) { if (value.school_id !== context().school) throw new ApiError(403, 'COMPARISON_SCHOOL_MISMATCH', 'Сравнение другой школы.'); comparison.value = value; history.value = [value, ...history.value.filter(v => v.id !== value.id)] }
  async function read(id: string, s: AbortSignal, valid: () => boolean) { const result = await service.show(id, s); if (!valid()) return; if (result.id !== id || result.school_id !== context().school) throw new ApiError(403, 'COMPARISON_MISMATCH', 'Сравнение не соответствует текущему контексту.'); apply(result); if (id === uncertainComparisonId && result.selected_variant) { uncertain.value = ''; uncertainComparisonId = '' } if (result.status !== 'completed') { variantData.value = null; return } const variants = await service.variants(id, s); if (valid()) { if (variants.comparison_id !== id || variants.comparison_type !== result.comparison_type) throw new Error('Варианты относятся к другому сравнению.'); variantData.value = variants } }
  async function show(id: string) { if (pending.value) return; comparison.value = null; variantData.value = null; confirmation.value = null; await operation('comparison', (s, valid) => read(id, s, valid)) }
  const definitive = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408
  async function create(id: string, type: ComparisonType) {
    if (pending.value || uncertain.value) return
    await operation('create', async (s, valid) => {
      uuid(id); comparisonType(type); allowed(context().school)
      const source = await service.request(id, s); if (!valid()) return; allowed(source.school_id); if (source.id !== id) throw new Error('Неверный запрос.'); request.value = source
      uncertain.value = 'create'
      try { const result = await service.create({ scenario_request_id: id, comparison_type: type }, s); if (!valid()) return; apply(result); uncertain.value = ''; confirmation.value = null; variantData.value = null; await read(result.id, s, valid) }
      catch (e) { if (!valid()) throw e; if (definitive(e)) uncertain.value = ''; else { try { const rows = await service.list(s); if (valid()) history.value = rows } catch { /* Keep unknown result and require an explicit GET. */ } } throw e }
    })
  }
  function prepare(body: ComparisonSelection) { if (pending.value || uncertain.value || !comparison.value) return; const message = selectionBlock(comparison.value, body); if (message) { error.value = new Error(message); return } error.value = null; confirmation.value = { ...body, selection_reason: body.selection_reason.trim() } }
  async function confirm() {
    const draft = confirmation.value, id = comparison.value?.id
    if (!draft || !id || pending.value || uncertain.value) return
    confirmation.value = null
    await operation('selection', async (s, valid) => {
      const actual = await service.show(id, s); if (!valid()) return; allowed(actual.school_id); if (actual.id !== id) throw new Error('Неверное сравнение.'); apply(actual)
      const message = selectionBlock(actual, draft); if (message) throw new ApiError(409, 'COMPARISON_SELECTION_BLOCKED', message)
      uncertain.value = 'selection'; uncertainComparisonId = id
      try { const result = await service.select(id, draft, s); if (!valid()) return; if (result.id !== id) throw new Error('Неверное сравнение.'); apply(result); uncertain.value = '' }
      catch (e) { if (!valid()) throw e; if (definitive(e)) uncertain.value = ''; try { await read(id, s, valid) } catch { /* GET failure never triggers another POST. */ } throw e }
    })
  }
  async function reconcile() { if (uncertain.value === 'selection' && uncertainComparisonId) { const id = uncertainComparisonId; await operation('reconcile', (s, valid) => read(id, s, valid)) } else if (comparison.value) { const id = comparison.value.id; await operation('reconcile', (s, valid) => read(id, s, valid)) } else await refresh() }
  function acknowledgeNewCreate() { if (pending.value || uncertain.value !== 'create' || !history.value.length) return; uncertain.value = ''; error.value = null }
  return { history, comparison, variantData, request, pending, error, confirmation, uncertain, reset, refresh, loadRequest, show, create, prepare, confirm, reconcile, acknowledgeNewCreate }
}
