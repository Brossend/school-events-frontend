import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { parseQualityReview } from '../app/utils/quality-review'
import { parseScenario } from '../app/utils/generation'
import ScenarioQualityNotice from '../app/components/features/scenarios/ScenarioQualityNotice.vue'
import ScenarioCulturalClaims from '../app/components/features/scenarios/ScenarioCulturalClaims.vue'
const school='00000000-0000-4000-8000-000000000001'
const scenario={ id:school, school_id:school, scenario_request_id:school, title:'Live test',status:'draft',moderation_status:'verification_passed',current_revision_id:school }
const report={status:'requires_review',technical_checks:'passed',findings:[{path:'$.materials.presentation_slides.0.speaker_notes',text:'Неподтверждённый исторический текст',message:'Проверьте источник',severity:'review'}]}
const global={stubs:{UiAlert:{template:'<section role="alert"><slot /></section>'}}}
describe('LLM001.1 quality is distinct from technical moderation',()=>{
 it('keeps the manual-review state even after formal checks pass',()=>{
  const parsed=parseQualityReview(report)
  expect(parsed?.status).toBe('requires_review')
  const wrapper=mount(ScenarioQualityNotice,{props:{review:parsed},global})
  expect(wrapper.text()).toContain('Требуется содержательная проверка педагогом')
  expect(wrapper.text()).toContain(report.findings[0]!.path)
  expect(wrapper.text()).toContain('не удостоверяют весь текст')
 })
 it('cannot turn absent or unexpected server quality metadata into a pass',()=>{
  expect(parseQualityReview({status:'passed',findings:[]})).toBeNull()
  expect(parseQualityReview(null)).toBeNull()
  const wrapper=mount(ScenarioQualityNotice,{props:{review:null},global})
  expect(wrapper.text()).toContain('отчёт качества недоступен')
 })
 it('renders blocked material and preserves section text safely',()=>{
  const wrapper=mount(ScenarioQualityNotice,{props:{review:parseQualityReview({...report,status:'blocked',technical_checks:'failed',findings:[{...report.findings[0],text:'<script>unsafe</script>'}]})},global})
  expect(wrapper.text()).toContain('Требуется исправление материала')
  expect(wrapper.find('script').exists()).toBe(false)
 })
 it('retains quality report independently of moderation status in scenario parsing',()=>{
  const result=parseScenario({data:{...scenario,quality_review:report}},school)
  expect(result.moderation_status).toBe('verification_passed')
  expect(result.quality_review?.status).toBe('requires_review')
 })
 it('never infers absence of historical prose from an empty declared-claim list',()=>{
  const wrapper=mount(ScenarioCulturalClaims,{props:{value:[]},global})
  expect(wrapper.text()).toContain('Исторические сведения могут находиться в других разделах')
  expect(wrapper.text()).not.toContain('не включены в этот ответ')
 })
 it('does not extend source matching to a model interpretation',()=>{
  const wrapper=mount(ScenarioCulturalClaims,{props:{value:[{claim_text:'Подтверждённая дата',claimed_meaning:'Не подтверждённая трактовка',evidence_records:[]}]},global:{stubs:{...global.stubs,ProvenanceStatus:true}}})
  expect(wrapper.text()).toContain('Трактовка модели — требуется проверка')
  expect(wrapper.text()).toContain('только к выделенному утверждению')
 })
})
