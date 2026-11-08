import { createApp, defineComponent, h, ref } from 'vue'
import ScenarioResult from '../../../app/components/features/scenarios/ScenarioResult.vue'
import ScenarioEditFields from '../../../app/components/features/scenarios/ScenarioEditFields.vue'
import RevisionFields from '../../../app/components/features/scenarios/RevisionFields.vue'
import RevisionModeration from '../../../app/components/features/scenarios/RevisionModeration.vue'
import TeacherSignoffForm from '../../../app/components/features/scenarios/TeacherSignoffForm.vue'
import ScenarioJson from '../../../app/components/features/scenarios/ScenarioJson.vue'
import ScenarioCulturalClaims from '../../../app/components/features/scenarios/ScenarioCulturalClaims.vue'
import ProvenanceStatus from '../../../app/components/features/provenance/ProvenanceStatus.vue'
import UiBadge from '../../../app/components/ui/UiBadge.vue'
import UiAlert from '../../../app/components/ui/UiAlert.vue'
import UiButton from '../../../app/components/ui/UiButton.vue'
import UiCard from '../../../app/components/ui/UiCard.vue'
import UiField from '../../../app/components/ui/UiField.vue'
import UiTextarea from '../../../app/components/ui/UiTextarea.vue'
import UiSelect from '../../../app/components/ui/UiSelect.vue'
import UiState from '../../../app/components/ui/UiState.vue'
import { editorDoc, verification } from '../../fixtures/fe007'
import { blankChecklist, editable } from '../../../app/utils/scenario-editor'
import '@fontsource-variable/inter'
import '../../../app/assets/css/main.css'
import '../../../app/assets/css/fe006.css'
import '../../../app/assets/css/fe007.css'
const state=new URLSearchParams(location.search).get('state')??'editor',doc=editorDoc(),draft=ref(editable(doc)),checklist=ref(blankChecklist())
if(state==='p0'||state==='p1') { const status=state==='p0'?'verification_blocked':'verification_passed_with_warnings'; doc.revision.moderation_status=status; doc.scenario.moderation_status=status }
const root=defineComponent({setup:()=>()=>h('main',{style:'max-width:1176px;margin:0 auto;padding:24px 16px'},[
 h('p',{class:'ui-alert ui-alert--warning',role:'note'},'Изолированный компонентный fixture FE-007. Это не живой backend и не результат HTTP-запроса.'),
 h('h1',`Редактор сценария · ${state}`),
 ...(state==='p0'||state==='p1'?[h(RevisionModeration,{verification:verification(state==='p0'?'blocked':'passed_with_warnings')})]:[]),
 ...(state==='conflict'?[h(UiCard,{class:'editor-conflict'},()=>[h('h2','Конфликт 409: версия изменилась'),h('p','Ваши изменения сохранены для сравнения. Автоматического повтора PATCH нет.'),h('div',{class:'editor-compare'},[h('div',[h('h3','Ваш черновик'),h('p',draft.value.concept+' Локальная правка.')]),h('div',[h('h3','Серверная версия'),h('p',doc.revision.concept+' Другая редакция.')])]),h(UiButton,{},()=> 'Перечитать актуальную версию')])]:[]),
 ...(state==='signoff'?[h(UiCard,{style:'max-width:520px;margin:auto'},()=>[h('h2','Подтверждение педагогом'),h(TeacherSignoffForm,{modelValue:checklist.value,'onUpdate:modelValue':v=>{checklist.value=v},block:'Лично подтвердите все три пункта.',warnings:true})])]:[]),
 ...(state==='confirmed'?[h(UiAlert,{},()=> 'Fixture: сервер принял подтверждение для текущей ревизии. Историческая запись показывается отдельно.')]:[]),
 h(ScenarioResult,{scenario:doc.scenario},{actions:()=>h('div',{class:'editor-actions'},[h(UiButton,{disabled:state==='saving',loading:state==='saving'},()=>[h('img',{src:'/icons/fe007/save.svg',width:17,height:17,alt:''}),'Сохранить новую ревизию']),h('span',state==='saving'?'Сохраняем новую ревизию…':'Есть несохранённые изменения')]),
 ...(state==='editor'||state==='saving'?{purpose:()=>h(ScenarioEditFields,{modelValue:draft.value,section:'purpose',disabled:state==='saving','onUpdate:modelValue':v=>{draft.value=v}})}:{}),
 moderation:()=>h(RevisionModeration,{verification:verification(state==='p0'?'blocked':state==='p1'?'passed_with_warnings':'passed'),disabled:state==='saving'})})
])})
const app=createApp(root)
for(const [name,component]of Object.entries({UiBadge,UiAlert,UiButton,UiCard,UiField,UiTextarea,UiSelect,UiState,RevisionFields,ScenarioJson,ScenarioCulturalClaims,ProvenanceStatus}))app.component(name,component)
app.component('NuxtLink',defineComponent({props:['to'],setup:(props,{slots})=>()=>h('a',{href:typeof props.to==='string'?props.to:props.to?.path},slots.default?.())}))
app.mount('#app')
