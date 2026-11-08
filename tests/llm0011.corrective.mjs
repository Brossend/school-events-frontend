// Real, bounded live acceptance run. No HTTP fakes. Isolated synthetic school only.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir='docs/llm001-1/final-v152', origin='http://localhost:8001';
if(process.env.LLM0011_LIVE!=='1')throw Error('Set LLM0011_LIVE=1 explicitly');
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
assert.equal(f.database,'school_events_test');assert.equal(f.databaseUser,'school_test_user');
const env=await fs.readFile('../school/.env.testing','utf8');
const appKey=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',appKey).update('LLM0011:'+f.runId).digest('hex');
const initialFile=process.env.LLM0011_RETRY_FROM||'live-http-primary-v152.json';
const initial=JSON.parse(await fs.readFile(dir+'/'+initialFile,'utf8'));
const reviewScales=(process.env.LLM0011_REVIEW_RETRY_SCALES||'').split(',').filter(Boolean);
assert.ok(reviewScales.every(scale=>scale==='family_community'));
const retryScenarios=initial.scenarios.filter(s=>s.result.status==='failed'||reviewScales.includes(s.scale));
const retryBudget=3*(retryScenarios.length+2*initial.comparisons.filter(c=>c.result.status==='failed').length);
const report={...initial,completed:false,initialEvidence:initialFile,trace:[],scenarios:initial.scenarios.filter(s=>s.result.status==='completed'&&!reviewScales.includes(s.scale)),comparisons:initial.comparisons.filter(c=>c.result.status==='completed'),failedAttempts:[...(initial.failedAttempts||[]),...initial.scenarios.filter(s=>s.result.status==='failed'),...initial.comparisons.filter(c=>c.result.status==='failed')],contentRejectedAttempts:[],explicitRetryBudgetMaxCompletionAttempts:retryBudget};
const save=()=>fs.writeFile(dir+'/live-http.json',JSON.stringify(report,null,2));
function session(role,school){
 const cookies=new Map();
 return async(method,path,body,status=200,extra={})=>{
  const headers={Accept:'application/json',Origin:'http://localhost:3000',Referer:'http://localhost:3000/',...extra};
  if(school)headers['X-School-Id']=school;
  headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
  if(cookies.has('XSRF-TOKEN'))headers['X-XSRF-TOKEN']=decodeURIComponent(cookies.get('XSRF-TOKEN'));
  if(body)headers['Content-Type']='application/json';
  const url=origin+(path.startsWith('/sanctum')?path:'/api/v1'+path);
  const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000),redirect:'manual'});
  for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0],index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1));}
  const data=await response.json().catch(()=>null);
  report.trace.push({role,method,path,status:response.status,...(path.startsWith('/auth/')?{}:{response:data})});await save();
  assert.equal(response.status,status,`${role} ${method} ${path}: ${response.status}`);
  return data;
 };
}
const teacher=session('teacher',f.schools.A.id),other=session('other',f.schools.B.id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function login(call,role){await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password});}
async function poll(call,path,timeout=600000){const until=Date.now()+timeout;let data;while(Date.now()<until){data=(await call('GET',path)).data;if(['completed','failed'].includes(data.status))return data;await sleep(2500);}throw Error('Timed out reading '+path);}
try{
 await login(teacher,'teacher');await login(other,'other');
 for(const item of retryScenarios.filter(s=>reviewScales.includes(s.scale)&&s.result.status==='completed')){
  const fresh=(await teacher('GET',`/scenarios/${item.result.scenario_id}`)).data;
  assert.equal(fresh.quality_review.technical_checks,'failed');
  assert.ok(fresh.quality_review.findings.some(f=>f.code==='RESOURCE_PLAN_RESERVE_CONTRADICTION'));
  report.contentRejectedAttempts.push({...item,currentQualityReview:fresh.quality_review,rejectionReason:'Observed arithmetic contradiction; original completed status and usage retained.'});
 }
 // Fresh read reconciles the timestamp false positive; the original failed
 // harness receipt is retained unchanged, not rewritten as passing.
 report.comparisons=[];
 for(const item of initial.comparisons){
  const fresh=(await teacher('GET',`/scenario-comparisons/${item.id}`)).data;
  if(fresh.status==='completed'){
   assert.equal(fresh.quality_review.A.technical_checks,'passed');assert.equal(fresh.quality_review.B.technical_checks,'passed');
   assert.equal(fresh.quality_review.B.cultural_coverage.whole_document_verified,false);
   report.comparisons.push({...item,result:fresh});
  }
 }
 const preflight=spawnSync('docker',['compose','-f','../school/docker-compose.yml','exec','-T','-e','LLM0011_RUN='+f.runId,'app-test','php'],{input:await fs.readFile('tests/backend/llm0011-state.php','utf8'),encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});assert.equal(preflight.status,0);
 assert.deepEqual([...new Set(JSON.parse(preflight.stdout).generationRuns.map(r=>r.prompt_version))],['school-methodist-1.5.2']);
 delete report.failure;report.retryReason='Explicit bounded retry of terminal failures or a completed result blocked by current gate after content review; HTTP timeout240, shared budget360, same final prompt. Original receipts, original status and unknown usage retained.';await save();
 let remaining=retryBudget;
 for(const failed of retryScenarios){
  if(remaining<3)break;remaining-=3;
  // A completed request is immutable, including a result rejected by a newer gate.
  const request=reviewScales.includes(failed.scale)?(await teacher('POST','/scenario-requests',{
   custom_event_title:`LLM0011 ${f.runId}: мастерская взаимопомощи (${failed.scale})`,
   scale:failed.scale,format_type:'workshop',target_grades:[5,6],participants_count:60,duration_minutes:90,value_direction:'mutual_aid',family_involvement:true,
   available_resources:['бумага','карандаши','доска'],pedagogical_constraints:'Все участники и ситуации вымышленные. Без персональных данных. Включите альтернативу без родителя и без экрана.'
  },201)).data:{id:failed.requestId};
  const key=crypto.randomUUID(),queued=(await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':key})).data;
  assert.equal((await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':key})).data.run_id,queued.run_id);
  const result=await poll(teacher,`/generation-runs/${queued.run_id}`);const item={scale:failed.scale,requestId:request.id,runId:queued.run_id,result,corrects:failed.runId};
  if(result.status==='completed'){
   item.scenario=(await teacher('GET',`/scenarios/${result.scenario_id}`)).data;item.qualityReview=item.scenario.quality_review;await other('GET',`/scenarios/${result.scenario_id}`,undefined,403);await other('GET',`/generation-runs/${queued.run_id}`,undefined,403);
   assert.equal(item.qualityReview.technical_checks,'passed');assert.equal(item.qualityReview.status,'requires_review');
   report.scenarios.push(item);
  }else report.failedAttempts.push(item);
  await save();console.log(JSON.stringify({retryScale:failed.scale,status:result.status,error:result.error_code}));
 }
 for(const failed of initial.comparisons.filter(c=>c.result.status==='failed')){
  if(remaining<6)break;remaining-=6;
  const request={id:JSON.parse(preflight.stdout).comparisons.find(c=>c.id===failed.id).scenario_request_id};
  const key=crypto.randomUUID(),body={scenario_request_id:request.id,comparison_type:failed.type,is_synthetic:true};
  const queued=(await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':key})).data;
  assert.equal((await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':key})).data.id,queued.id);
  const result=await poll(teacher,`/scenario-comparisons/${queued.id}`,1080000),item={type:failed.type,id:queued.id,result,corrects:failed.id};
  if(result.status==='completed'){assert.equal(result.quality_review.B.technical_checks,'passed');report.comparisons.push(item);}else report.failedAttempts.push(item);
  await save();console.log(JSON.stringify({retryComparison:failed.type,status:result.status}));
 }
 const snapshot=spawnSync('docker',['compose','-f','../school/docker-compose.yml','exec','-T','-e','LLM0011_RUN='+f.runId,'app-test','php'],{input:await fs.readFile('tests/backend/llm0011-state.php','utf8'),encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});assert.equal(snapshot.status,0);
 await fs.writeFile(dir+'/postgres-live.json',snapshot.stdout);
 report.observedPromptVersions=[...new Set(JSON.parse(snapshot.stdout).generationRuns.map(r=>r.prompt_version))];assert.deepEqual(report.observedPromptVersions,['school-methodist-1.5.2']);
 report.completed=report.scenarios.length===3&&report.comparisons.length===2;report.explicitRetryBudgetRemaining=remaining;
 await teacher('POST','/auth/logout',undefined,204);await save();if(!report.completed)process.exitCode=1;
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Bounded correction incomplete; inspect evidence.');process.exitCode=1;}
