import { createApp, defineComponent, h } from 'vue'
import GenerationState from '../../../app/components/features/scenarios/GenerationState.vue'
import UiBadge from '../../../app/components/ui/UiBadge.vue'
import UiAlert from '../../../app/components/ui/UiAlert.vue'
import UiButton from '../../../app/components/ui/UiButton.vue'
import { run } from '../../fixtures/fe006'
import type { RunStatus } from '../../../app/types/generation'
import '@fontsource-variable/inter'
import '../../../app/assets/css/main.css'
import '../../../app/assets/css/fe006.css'
const state = new URLSearchParams(location.search).get('state') ?? 'running'
const status: RunStatus = ['queued', 'running', 'completed', 'failed', 'timed_out'].includes(state) ? state as RunStatus : 'running'
const root = defineComponent({ setup: () => () => h('main', { style: 'max-width:1176px;margin:0 auto;padding:24px 16px' }, [h('p', { style: 'padding:14px;background:#fff6e5;color:#785018;border-radius:10px;font-weight:600', role: 'note' }, 'Изолированный компонентный fixture FE-006. Это не живая генерация и не ответ API.'), h('h1', 'Состояние генерации'), h(GenerationState, { run: run(status) })]) })
const app = createApp(root)
app.component('UiBadge', UiBadge); app.component('UiAlert', UiAlert); app.component('UiButton', UiButton)
app.component('NuxtLink', defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: typeof props.to === 'string' ? props.to : props.to?.path }, slots.default?.()) }))
app.mount('#app')
