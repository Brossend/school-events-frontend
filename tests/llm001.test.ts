import { describe, expect, it, vi } from 'vitest'
import type { Comparison, ComparisonContext, ComparisonsServices } from '../app/types/comparisons'
import { createComparisonsController } from '../app/utils/comparisons-controller'
import { parseScenario } from '../app/utils/generation'

const id = '00000000-0000-4000-8000-000000000001', school = '00000000-0000-4000-8000-000000000002'
const base: Comparison = { id, school_id: school, comparison_type: 'universal_vs_personalized', status: 'pending', selected_variant: null, selected_by_user_id: null, selection_reason: null, selection_recorded_at: null, cultural_usefulness_rating: null, created_at: '2026-10-30T00:00:00Z', differences_summary: {}, is_cultural_available: false, is_synthetic: true, variants: [] }
const context: ComparisonContext = { user: id, school, role: 'teacher', authenticated: true }
function services() {
  return { request: vi.fn(), list: vi.fn().mockResolvedValue([]), show: vi.fn().mockResolvedValue(base), variants: vi.fn().mockResolvedValue({ comparison_id: id, comparison_type: base.comparison_type, differences_summary: {}, selected_variant: null, selection_reason: null, variants: [] }), create: vi.fn(), select: vi.fn() } satisfies ComparisonsServices
}

describe('LLM001 asynchronous comparison', () => {
  it('uses explicit server generation provenance and leaves legacy provenance unknown', () => {
    const payload = { id, school_id: school, scenario_request_id: id, title: 'Сценарий', status: 'draft', moderation_status: 'verification_passed', current_revision_id: id }
    expect(parseScenario({ data: payload }, school).provider).toBeNull()
    const real = parseScenario({ data: { ...payload, generation: { provider_name: 'litellm', model_identifier: 'GigaChat-3-Pro' } } }, school)
    expect(real.provider).toBe('litellm'); expect(real.model).toBe('GigaChat-3-Pro')
  })
  it('reads pending then completed without another create or premature variant loading', async () => {
    const service = services(), c = createComparisonsController(service, () => context)
    await c.show(id)
    expect(c.comparison.value?.status).toBe('pending'); expect(c.variantData.value).toBeNull()
    expect(service.variants).not.toHaveBeenCalled(); expect(service.create).not.toHaveBeenCalled()
    c.prepare({ selected_variant: 'A', selection_reason: 'Педагогический выбор' })
    expect(c.confirmation.value).toBeNull()
    service.show.mockResolvedValue({ ...base, status: 'completed' })
    await c.reconcile()
    expect(c.comparison.value?.status).toBe('completed'); expect(service.variants).toHaveBeenCalledOnce()
    expect(service.create).not.toHaveBeenCalled(); c.reset()
  })
  it('retains terminal failure from GET and never replays a paid mutation', async () => {
    const service = services(), c = createComparisonsController(service, () => context)
    service.show.mockResolvedValue({ ...base, status: 'failed', differences_summary: { error_code: 'LLM_TIMEOUT', error_message: 'Истекло время ожидания модели.' } })
    await c.show(id); await c.reconcile()
    expect(c.comparison.value?.status).toBe('failed'); expect(c.variantData.value).toBeNull()
    expect(service.create).not.toHaveBeenCalled(); expect(service.select).not.toHaveBeenCalled(); c.reset()
  })
  it('discards a pending read after school switch', async () => {
    let resolve!: (value: Comparison) => void
    const service = services(), current = { ...context }, c = createComparisonsController(service, () => current)
    service.show.mockImplementation(() => new Promise<Comparison>(r => { resolve = r }))
    const read = c.show(id); current.school = id; c.reset(); resolve(base); await read
    expect(c.comparison.value).toBeNull(); expect(service.variants).not.toHaveBeenCalled()
  })
})
