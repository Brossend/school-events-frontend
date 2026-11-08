// One explicit check of the remaining cases after regression-tested PATCH fixes.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir='docs/llm001-1/final-v152',origin='http://localhost:8001';
if(process.env.LLM0011_LIVE!=='1'||process.env.LLM0011_FINAL_CONTRACT!=='1')throw Error('Explicit final isolated contract run required');
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
const primary=JSON.parse(await fs.readFile(dir+'/live-http-primary-v151.json','utf8'));
const previous=JSON.parse(await fs.readFile(dir+'/live-http-before-contract.json','utf8'));
const stateScript=await fs.readFile('tests/backend/llm0011-state.php','utf8');
function snapshot(){const r=spawnSync('docker',['compose','-f','../school/docker-compose.yml','exec','-T','-e','LLM0011_RUN='+f.runId,'app-test','php'],{input:stateScript,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});assert.equal(r.status,0);return JSON.parse(r.stdout);}
const db=snapshot();assert.equal(db.database,'school_events_test');assert.equal(db.role,'school_test_user');
assert.ok(db.generationRuns.every(r=>!['queued','running'].includes(r.status)));assert.ok(db.comparisons.every(c=>c.status!=='pending'));
for(const row of JSON.parse(await fs.readFile('docs/llm001-1/core-contract-hashes.json','utf8'))){assert.equal(crypto.createHash('sha256').update(await fs.readFile('../school/'+row.path)).digest('hex'),row.sha256);}
const env=await fs.readFile('../school/.env.testing','utf8'),key=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',key).update('LLM0011:'+f.runId).digest('hex');
const failures=[...new Map((previous.failedAttempts||[]).map(x=>[(x.scale?'run:':'comparison:')+(x.runId||x.id),x])).values()];
const remainingVariants=(previous.scenarios.some(s=>s.scale==='all_school'&&s.result.status==='completed')?0:1)+2*primary.comparisons.filter(c=>!previous.comparisons.some(p=>p.type===c.type&&p.result.status==='completed')).length;
const report={...previous,initialEvidence:'live-http-before-contract.json',completed:false,trace:[],failedAttempts:failures,contractCheck:{maximumNewCompletionCalls:remainingVariants*3,defaultRepairs:1,explicitRepairs:2,reason:'Indexed slide repair preserves existing materials; only missing cases are generated, never synthesize missing output locally.'}};
const save=()=>fs.writeFile(dir+'/live-http.json',JSON.stringify(report,null,2));
function session(role,school){const cookies=new Map();return async(method,path,body,status=200,extra={})=>{
 const headers={Accept:'application/json',Origin:'http://localhost:3000',Referer:'http://localhost:3000/',...extra};if(school)headers['X-School-Id']=school;
 headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');if(cookies.has('XSRF-TOKEN'))headers['X-XSRF-TOKEN']=decodeURIComponent(cookies.get('XSRF-TOKEN'));if(body)headers['Content-Type']='application/json';
 const response=await fetch(origin+(path.startsWith('/sanctum')?path:'/api/v1'+path),{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 for(const raw of response.headers.getSetCookie()){const p=raw.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}
 const data=await response.json().catch(()=>null);report.trace.push({role,method,path,status:response.status,...(path.startsWith('/auth/')?{}:{response:data})});await save();assert.equal(response.status,status,`${method} ${path}: ${response.status}`);return data;
};}
const teacher=session('teacher',f.schools.A.id),other=session('other',f.schools.B.id);
async function login(call,role){await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password});}
async function poll(path,limit){const end=Date.now()+limit;while(Date.now()<end){const value=(await teacher('GET',path)).data;if(['completed','failed'].includes(value.status))return value;await new Promise(r=>setTimeout(r,2500));}throw Error('Bounded GET observation expired; never replay a generation POST automatically');}
try{
 await login(teacher,'teacher');await login(other,'other');
 if(!report.scenarios.some(s=>s.scale==='all_school'&&s.result.status==='completed')){
  const original=primary.scenarios.find(s=>s.scale==='all_school'),source=db.requests.find(r=>r.id===original.requestId);
  // Respect the existing per-request refusal, then use its explicit new-request workflow.
  const refusal=await teacher('POST',`/scenario-requests/${source.id}/generate`,{},409,{'Idempotency-Key':crypto.randomUUID()});assert.equal(refusal.error.code,'GENERATION_MAX_ATTEMPTS_EXCEEDED');
  const body=Object.fromEntries(['custom_event_title','scale','format_type','target_grades','participants_count','duration_minutes','value_direction','family_involvement','available_resources','pedagogical_constraints'].map(k=>[k,source[k]]));
  const request=(await teacher('POST','/scenario-requests',body,201)).data;
  const token=crypto.randomUUID(),queued=(await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':token})).data;
  assert.equal((await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':token})).data.run_id,queued.run_id);
  const result=await poll(`/generation-runs/${queued.run_id}`,600000),item={scale:'all_school',requestId:request.id,runId:queued.run_id,result,replacesFailedRequest:source.id};
  if(result.status==='completed'){assert.equal(result.provider_name,'litellm');assert.equal(result.model_identifier,'GigaChat-2-Max');item.scenario=(await teacher('GET',`/scenarios/${result.scenario_id}`)).data;item.qualityReview=item.scenario.quality_review;assert.equal(item.qualityReview.technical_checks,'passed');await other('GET',`/scenarios/${result.scenario_id}`,undefined,403);await other('GET',`/generation-runs/${queued.run_id}`,undefined,403);report.scenarios.push(item);}else report.failedAttempts.push(item);
  await save();console.log(JSON.stringify({contract:'all_school',status:result.status,error:result.error_code}));
 }
 for(const original of primary.comparisons){
  if(report.comparisons.some(c=>c.type===original.type&&c.result.status==='completed'))continue;
  const source=db.comparisons.find(c=>c.id===original.id),token=crypto.randomUUID(),body={scenario_request_id:source.scenario_request_id,comparison_type:original.type,is_synthetic:true};
  const queued=(await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':token})).data;assert.equal((await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':token})).data.id,queued.id);
  const result=await poll(`/scenario-comparisons/${queued.id}`,1080000),item={type:original.type,id:queued.id,result,corrects:original.id};
  if(result.status==='completed'){assert.equal(result.quality_review.A.technical_checks,'passed');assert.equal(result.quality_review.B.technical_checks,'passed');assert.equal(result.quality_review.B.cultural_coverage.whole_document_verified,false);await other('GET',`/scenario-comparisons/${queued.id}`,undefined,403);report.comparisons.push(item);}else report.failedAttempts.push(item);
  await save();console.log(JSON.stringify({contract:original.type,status:result.status,error:result.differences_summary?.error_code}));
 }
 const final=snapshot();await fs.writeFile(dir+'/postgres-live.json',JSON.stringify(final,null,2));report.observedPromptVersions=[...new Set(final.generationRuns.map(r=>r.prompt_version))];assert.deepEqual(report.observedPromptVersions,['school-methodist-1.5.2']);
 report.scenarios.sort((a,b)=>['class_level','all_school','family_community'].indexOf(a.scale)-['class_level','all_school','family_community'].indexOf(b.scale));
 report.completed=report.scenarios.length===3&&report.scenarios.every(s=>s.result.status==='completed')&&report.comparisons.length===2&&report.comparisons.every(c=>c.result.status==='completed');
 await teacher('POST','/auth/logout',undefined,204);await teacher('GET','/auth/me',undefined,401);await save();if(!report.completed)process.exitCode=1;
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Final contract check incomplete; original receipts preserved.');process.exitCode=1;}
