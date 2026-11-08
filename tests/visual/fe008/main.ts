import { createApp, defineComponent, h, ref } from 'vue'
import ExportFormatPicker from '../../../app/components/features/scenarios/ExportFormatPicker.vue'
import ExportJobState from '../../../app/components/features/scenarios/ExportJobState.vue'
import ExportHistory from '../../../app/components/features/scenarios/ExportHistory.vue'
import UiBadge from '../../../app/components/ui/UiBadge.vue'
import UiAlert from '../../../app/components/ui/UiAlert.vue'
import UiButton from '../../../app/components/ui/UiButton.vue'
import UiCard from '../../../app/components/ui/UiCard.vue'
import UiState from '../../../app/components/ui/UiState.vue'
import { exportEntry, exportJob } from '../../fixtures/fe008'
import type { ExportFormat } from '../../../app/types/exports'
import '@fontsource-variable/inter'
import '../../../app/assets/css/main.css'
import '../../../app/assets/css/fe006.css'
import '../../../app/assets/css/fe008.css'
const state=new URLSearchParams(location.search).get('state')??'selection',format=ref<ExportFormat>('pdf'),entries=[exportEntry()]
if(state==='blocked')entries[0]!.is_downloadable=false
const root=defineComponent({setup:()=>()=>h('main',{style:'padding:24px 12px;min-height:100vh;background:#e7edf0'},[
 h('p',{class:'ui-alert ui-alert--warning',role:'note',style:'max-width:760px;margin:0 auto 20px'},'Изолированный компонентный fixture FE-008. Синтетические данные; это не ответ backend.'),
 h('section',{class:'ui-modal',style:'display:block;position:static;margin:auto;max-height:none;max-width:520px;width:100%'},[
 h('div',{class:'row'},[h('h2','Экспорт сценария'),h('button',{class:'text-button'},'Закрыть')]),
 h('div',{class:'export-workspace'},[
 h('p',{class:'muted'},'Версия 1 · документы формируются сервером'),
 ...(state==='error'?[h(UiAlert,{tone:'error'},()=> 'Fixture: сервис экспорта временно недоступен. Задание не стало failed из-за ошибки сети. Перечитайте состояние.')]:[]),
 ...(state==='blocked'?[h(UiAlert,{tone:'error'},()=> 'Fixture: EXPORT_BLOCKED_BY_PROVENANCE_REVOCATION. Скачивание заблокировано: рецензия на первоисточник отозвана. Требуется повторная проверка сценария.'),h('a',{href:'#review'},'Перейти к проверке и согласованию')]:[]),
 ...(state==='selection'?[h(ExportFormatPicker,{modelValue:format.value,'onUpdate:modelValue':(v:ExportFormat)=>{format.value=v}}),h(UiButton,{},()=> 'Создать экспорт')]:[]),
 ...(['waiting','ready','error'].includes(state)?[h(ExportJobState,{job:exportJob(state==='waiting'?'processing':state==='error'?'failed':'ready'),entry:entries[0]})]:[]),
 ...(['history','blocked'].includes(state)?[h(ExportHistory,{entries,version:1})]:[])
 ])])
])})
const app=createApp(root);for(const[name,c]of Object.entries({UiBadge,UiAlert,UiButton,UiCard,UiState}))app.component(name,c);app.mount('#app')
