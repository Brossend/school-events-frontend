import fs from 'node:fs';
import YAML from 'yaml';
const file='../school/docs/openapi.yaml', doc=YAML.parseDocument(fs.readFileSync(file,'utf8'));
const get=(...path)=>doc.getIn(path)?.toJSON?.() ?? doc.getIn(path);
const set=(path,value)=>doc.setIn(path,JSON.parse(JSON.stringify(value)));
const schema=(name,value)=>set(['components','schemas',name],value);
const ref=name=>({$ref:'#/components/schemas/'+name});
const text={type:'string'}, bool={type:'boolean'}, integer={type:'integer'}, number={type:'number'}, uuid={type:'string',format:'uuid'}, dt={type:['string','null'],format:'date-time'};
const nullable=value=>({...value,type:Array.isArray(value.type)?[...new Set([...value.type,'null'])]:[value.type,'null']});
const object=(properties,required=[])=>({type:'object',...(required.length?{required}:{}),properties});
const array=items=>({type:'array',items});
const envelope=data=>object({data},['data']);
const response=(name,status=200)=>({[status]:{description:'Actual Laravel response',content:{'application/json':{schema:ref(name)}}}});
set(['info','version'],'1.5.0');
schema('UserEnvelope',get('components','schemas','LoginResponse'));
const occurrence=object({id:uuid,academic_year:text,start_date:{type:'string',format:'date'},end_date:{type:['string','null'],format:'date'},source_reference:nullable(text)},['id','academic_year','start_date','end_date','source_reference']);schema('CalendarOccurrence',occurrence);
const dates={date_type:{type:'string',enum:['fixed_annual','floating_rule','single_occurrence']},fixed_month:nullable(integer),fixed_day:nullable(integer),occurrences:array(ref('CalendarOccurrence'))};
for(const name of ['CalendarEventSummary']){const s=get('components','schemas',name);Object.assign(s.properties,dates);schema(name,s);}
const detail=get('components','schemas','CalendarEventEnvelope');Object.assign(detail.properties.data.properties,dates);schema('CalendarEventEnvelope',detail);
const cp=get('paths','/calendar-events','get','parameters').filter(p=>p.name!=='academic_year');cp.push({name:'academic_year',in:'query',schema:{type:'string',pattern:'^[0-9]{4}-[0-9]{4}$'}});set(['paths','/calendar-events','get','parameters'],cp);
const settings=object({address:{...nullable(text),maxLength:255},phone:{...nullable(text),maxLength:50},email:{...nullable(text),format:'email',maxLength:255},website:{...nullable(text),maxLength:255},description:{...nullable(text),maxLength:1000}});settings.additionalProperties=true;schema('SchoolSettings',settings);
const profile=get('components','schemas','SchoolProfileDetail');profile.properties.settings={oneOf:[ref('SchoolSettings'),{type:'array',maxItems:0}]};schema('SchoolProfileDetail',profile);
set(['paths','/schools/{id}','patch','requestBody','content','application/json','schema','properties','settings'],{anyOf:[ref('SchoolSettings'),{type:'null'}]});
const sourceFields={id:uuid,calendar_event_id:uuid,source_type:{type:'string',enum:['normative_act','scientific_publication','ethnographic_archive','encyclopedia']},title:text,author:nullable(text),url:nullable(text),doi_or_isbn:nullable(text),verified_by_user_id:nullable(uuid),verification_date:{type:['string','null'],format:'date'},created_at:{type:'string',format:'date-time'}};
schema('SourcePatchEnvelope',envelope(object(sourceFields,Object.keys(sourceFields))));set(['paths','/event-sources/{id}','patch','responses','200','content','application/json','schema'],ref('SourcePatchEnvelope'));
const patch=get('paths','/event-sources/{id}','patch','requestBody','content','application/json','schema');for(const [k,max]of Object.entries({title:500,author:255,url:1000,doi_or_isbn:64}))patch.properties[k].maxLength=max;patch.properties.title.minLength=3;set(['paths','/event-sources/{id}','patch','requestBody','content','application/json','schema'],patch);
const detached=object({message:text,detached_records_count:integer},['message','detached_records_count']);set(['paths','/cultural-claims/{id}/evidence/{sourceId}','delete','responses','200','content','application/json','schema'],envelope(detached));set(['paths','/cultural-claims/{id}/evidence/{sourceId}','delete','requestBody'],{required:false,content:{'application/json':{schema:object({reason:nullable(text)})}}});
const ev=get('components','schemas','CulturalClaimEvidenceItem');ev.required=ev.required.filter(k=>k!=='created_at');ev.properties.source={anyOf:[object({id:uuid,title:text,author:nullable(text),source_type:text},['id','title','author','source_type']),{type:'null'}]};schema('CulturalClaimEvidenceItem',ev);
for(const [k,max]of Object.entries({citation_locator:255,citation_excerpt:2000,notes:2000}))set(['paths','/cultural-claims/{id}/evidence','post','requestBody','content','application/json','schema','properties',k,'maxLength'],max);
set(['paths','/cultural-claims/{id}/evidence','post','requestBody','content','application/json','schema','properties','verify'],{type:['boolean','null'],default:true});
const part=get('components','schemas','PilotParticipantListEnvelope');Object.assign(part.properties.data.items.properties,{is_synthetic:bool,response_id:nullable(uuid)});part.properties.data.items.required=Object.keys(part.properties.data.items.properties);schema('PilotParticipantListEnvelope',part);
const pres=get('components','schemas','PilotResponseEnvelope');pres.properties.data.properties.cultural_usefulness_score=nullable(integer);pres.properties.data.required=Object.keys(pres.properties.data.properties);schema('PilotResponseEnvelope',pres);
const review=get('components','schemas','PilotReviewFindingEnvelope');review.properties.data.properties.expert_audit_status={type:'string',enum:['pending_audit','audited','rejected']};review.properties.data.required=Object.keys(review.properties.data.properties);schema('PilotReviewFindingEnvelope',review);schema('PilotReviewFinding',review.properties.data);
schema('PilotReviewHistoryEnvelope',envelope(object({pilot_response_id:uuid,effective_review:{anyOf:[ref('PilotReviewFinding'),{type:'null'}]},versions:array(ref('PilotReviewFinding'))},['pilot_response_id','effective_review','versions'])));
const reviewGet={operationId:'getPilotReviewHistory',summary:'Effective expert finding and immutable version history',tags:['Pilot'],security:[{cookieAuth:[]}],parameters:[{name:'id',in:'path',required:true,schema:uuid}],responses:{...response('PilotReviewHistoryEnvelope'),401:{$ref:'#/components/responses/Unauthorized'},403:{$ref:'#/components/responses/Forbidden'},404:{$ref:'#/components/responses/NotFound'}}};set(['paths','/pilot/responses/{id}/reviews','get'],reviewGet);
const metrics=get('components','schemas','PilotMetricsResponse');metrics.properties.data.properties.sample_breakdown=object({personalization:object({selected:integer,total:integer},['selected','total']),manual_edits:object({under_20_percent:integer,total:integer},['under_20_percent','total']),cultural_context:object({used:integer,rated_count:integer,total:integer},['used','rated_count','total']),expert_reviews:object({audited:integer,pending:integer,coverage_percent:nullable(number),critical_errors:nullable(integer)},['audited','pending','coverage_percent','critical_errors'])},['personalization','manual_edits','cultural_context','expert_reviews']);metrics.properties.data.required=Object.keys(metrics.properties.data.properties);schema('PilotMetricsResponse',metrics);schema('PilotMetrics',metrics.properties.data);
for(const path of ['/pilot/metrics','/pilot/export']){const params=get('paths',path,'get','parameters').filter(p=>p.name!=='include_synthetic');params.push({name:'include_synthetic',in:'query',schema:{oneOf:[bool,{type:'integer',enum:[0,1]}]},description:'Explicit synthetic inclusion for authorized scope; frontend allows only isolated app-test.'});set(['paths',path,'get','parameters'],params);}
set(['components','schemas','PilotExportResponse','properties','data','properties','metrics'],ref('PilotMetrics'));
const filters=get('paths','/scenarios','get','parameters').filter(p=>!['q','status','is_archived','from','to','sort'].includes(p.name));for(const [name,s]of Object.entries({q:text,status:{type:'string',enum:['draft','completed','archived']},is_archived:{oneOf:[bool,{type:'string',enum:['all','true','false','0','1']}]},from:{type:'string',format:'date'},to:{type:'string',format:'date'},sort:{type:'string',description:'created_at, updated_at or title with :asc/:desc or _asc/_desc'}}))filters.push({name,in:'query',schema:s});set(['paths','/scenarios','get','parameters'],filters);
const job=get('components','schemas','ExportJobEnvelope');Object.assign(job.properties.data.properties,{error_message:nullable(text),created_at:dt,completed_at:dt});schema('ExportJobEnvelope',job);
// Follow-up response-contract audit: inline evidence omits its parent's ID;
// creation and editor mutation return smaller/different envelopes than GET.
const nestedEvidence=get('components','schemas','CulturalClaimDetail','properties','evidence_records');
const inlineEvidence=structuredClone(get('components','schemas','CulturalClaimEvidenceItem'));
inlineEvidence.required=inlineEvidence.required.filter(k=>k!=='cultural_claim_id');
nestedEvidence.items=inlineEvidence;
set(['components','schemas','CulturalClaimDetail','properties','evidence_records'],nestedEvidence);
const req=get('components','schemas','ScenarioRequestEnvelope');
req.properties.data.required=req.properties.data.required.filter(k=>k!=='created_at');schema('ScenarioRequestEnvelope',req);
for(const p of Object.keys(get('paths')))if(p.includes('/revisions/')&&get('paths',p,'patch')){
 const mutation=structuredClone(get('components','schemas','ScenarioEnvelope'));
 mutation.properties.data.required=mutation.properties.data.required.filter(k=>k!=='current_revision_id');
 schema('ScenarioMutationEnvelope',mutation);
 set(['paths',p,'patch','responses','201','content','application/json','schema'],ref('ScenarioMutationEnvelope'));
}
set(['components','schemas','ScenarioComparisonVariantsEnvelope','properties','data','properties','variants','items','properties','cultural_provenance_data'],array({type:'object'}));
// Convert old OpenAPI 3.0 nullable extensions into valid 3.1 JSON Schema unions.
const normalize=v=>{if(!v||typeof v!=='object')return;if(v.nullable===true){delete v.nullable;if(v.type)v.type=[...new Set([...(Array.isArray(v.type)?v.type:[v.type]),'null'])];else if(v.$ref){const r=v.$ref;delete v.$ref;v.anyOf=[{$ref:r},{type:'null'}];}}for(const child of Object.values(v))normalize(child);};
const complete=doc.toJSON();normalize(complete);
fs.writeFileSync(file,YAML.stringify(complete,{singleQuote:true}));console.log('Updated OpenAPI 1.5.0 from actual controller contracts');
