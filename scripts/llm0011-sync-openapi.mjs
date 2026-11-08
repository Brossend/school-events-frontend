import fs from 'node:fs'
import YAML from 'yaml'
const file='../school/docs/openapi.yaml',doc=YAML.parseDocument(fs.readFileSync(file,'utf8'))
doc.setIn(['info','version'],'1.7.0')
const quality={type:['object','null'],required:['status','technical_checks','cultural_coverage','findings'],properties:{gate_version:{type:'string'},status:{type:'string',enum:['blocked','requires_review']},technical_checks:{type:'string',enum:['passed','failed']},expert_assessment:{type:'string',const:'not_performed'},teacher_signoff_required:{type:'boolean',const:true},payload_sha256:{type:'string'},cultural_coverage:{type:'object',required:['status','complete','whole_document_verified'],properties:{status:{type:'string',const:'requires_review'},complete:{type:'boolean',const:false},whole_document_verified:{type:'boolean',const:false},scanned_string_count:{type:'integer'},supported_assertions:{type:'array',items:{type:'object'}},findings:{type:'array',items:{type:'object'}}}},findings:{type:'array',items:{type:'object',required:['code','path','text','message','severity'],properties:{code:{type:'string'},path:{type:'string'},text:{type:'string'},message:{type:'string'},severity:{type:'string',enum:['error','review']}}}},limitations:{type:'array',items:{type:'string'}}}}
doc.setIn(['components','schemas','QualityReview'],quality)
for(const name of ['ScenarioEnvelope','ScenarioRevisionEnvelope'])doc.setIn(['components','schemas',name,'properties','data','properties','quality_review'],{$ref:'#/components/schemas/QualityReview'})
// Comparison response schemas are inline; augment every actual comparison envelope.
doc.setIn(['components','schemas','ScenarioComparisonEnvelope','properties','data','properties','quality_review'],{type:'object',properties:{A:{$ref:'#/components/schemas/QualityReview'},B:{$ref:'#/components/schemas/QualityReview'}}})
let found=0
function walk(node){if(!node||typeof node!=='object')return;if(node.properties?.differences_summary&&node.properties?.is_cultural_available&&node.properties?.variants){node.properties.quality_review={type:'object',properties:{A:{$ref:'#/components/schemas/QualityReview'},B:{$ref:'#/components/schemas/QualityReview'}}};found++}for(const v of Object.values(node))walk(v)}
const data=doc.toJSON();walk(data)
const updated=new YAML.Document(data)
fs.writeFileSync(file,String(updated).replace(/\$ref: "(#[^"\n]+)"/g, "$ref: '$1'"));fs.copyFileSync(file,'docs/llm001-1/openapi.yaml')
console.log('OpenAPI 1.7.0; quality schemas and comparison envelopes:',found)
