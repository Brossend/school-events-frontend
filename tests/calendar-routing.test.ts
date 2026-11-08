import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useCalendarFilters } from '../app/composables/useCalendarFilters'

describe('calendar reactive routing', () => {
  it('updates the URL, resets pagination on filtering and reacts to Back/Forward query changes', async () => {
    const route = reactive({ query: { month: '2026-11', q: 'старый поиск', page: '3' } as Record<string, string> })
    const push = vi.fn(async ({ query }: { query: Record<string, string> }) => { route.query = query })
    vi.stubGlobal('ref', ref); vi.stubGlobal('computed', computed); vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
    vi.stubGlobal('useRoute', () => route); vi.stubGlobal('useRouter', () => ({ push }))
    let control!: ReturnType<typeof useCalendarFilters>
    const harness = defineComponent({ setup() { control = useCalendarFilters(); return () => h('p', control.filters.value.q) } })
    const wrapper = mount(harness)
    expect(control.filters.value.page).toBe(3)
    await control.update({ q: 'новый поиск', type: 'federal' }); await nextTick()
    expect(control.filters.value.page).toBe(1)
    expect(push.mock.calls[0]?.[0].query.q).toBe('новый поиск')
    expect(push.mock.calls[0]?.[0].query.type).toBe('federal')
    await control.update({ page: 2 }, false)
    expect(control.filters.value.page).toBe(2)
    route.query = { month: '2026-11', q: 'поиск из истории', page: '4', view: 'list' }; await nextTick()
    expect(wrapper.text()).toBe('поиск из истории')
    expect(control.filters.value.page).toBe(4)
    expect(control.filters.value.view).toBe('list')
    wrapper.unmount(); vi.unstubAllGlobals()
  })
})
