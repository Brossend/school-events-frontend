// Real, bounded live acceptance run. No HTTP fakes. Isolated synthetic school only.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir='docs/llm001', origin='http://localhost:8001';
if(process.env.LLM001_LIVE!=='1')throw Error('Set LLM001_LIVE=1 explicitly');
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
assert.equal(f.database,'school_events_test');assert.equal(f.databaseUser,'school_test_user');
const env=await fs.readFile('../school/.env.testing','utf8');
const appKey=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',appKey).update('LLM001:'+f.runId).digest('hex');
const report={origin,runId:f.runId,completed:false,trace:[],scenarios:[],comparisons:[],syntheticOnly:true};
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
const teacher=session('teacher',f.schools.A.id), curator=session('regional'), other=session('other',f.schools.B.id),guest=session('guest');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function login(call,role){await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password});}
async function poll(call,path,timeout=420000){const until=Date.now()+timeout;let data;while(Date.now()<until){data=(await call('GET',path)).data;if(['completed','failed'].includes(data.status))return data;await sleep(2500);}throw Error('Timed out reading '+path);}
try{
 const probe=await fetch(origin+'/api/v1/test/environment-probe').then(r=>r.json());assert.equal(probe.database,'school_events_test');report.probe=probe;
 await guest('GET','/auth/me',undefined,401);await login(teacher,'teacher');await login(curator,'regional');await login(other,'other');
 await teacher('GET','/auth/me');await teacher('GET','/tenant/current');
 const inputs=[['class_level',45,30,'class_hour'],['all_school',60,150,'quest'],['family_community',90,60,'workshop']];
 for(const[scale,duration,count,format]of inputs){
  const request=(await teacher('POST','/scenario-requests',{custom_event_title:`LLM001 ${f.runId}: мастерская взаимопомощи (${scale})`,
   scale,format_type:format,target_grades:[5,6],participants_count:count,duration_minutes:duration,value_direction:'mutual_aid',family_involvement:scale==='family_community',
   available_resources:['бумага','карандаши','доска'],pedagogical_constraints:'Все участники и ситуации вымышленные. Без персональных данных. Включите альтернативу без родителя и без экрана.'},201)).data;
  const key=crypto.randomUUID();const queued=(await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':key})).data;
  const replay=(await teacher('POST',`/scenario-requests/${request.id}/generate`,{},202,{'Idempotency-Key':key})).data;assert.equal(replay.run_id,queued.run_id);
  const result=await poll(teacher,`/generation-runs/${queued.run_id}`);const item={scale,requestId:request.id,runId:queued.run_id,result};report.scenarios.push(item);await save();
  assert.equal(result.provider_name,'litellm');
  if(result.status==='completed'){
   assert.ok(!result.model_identifier.startsWith('mock'));assert.ok(result.scenario_id);assert.ok(result.revision_id);
   const scenario=(await teacher('GET',`/scenarios/${result.scenario_id}`)).data;
   item.scenario=scenario;
   const end=Date.now()+60000;while(Date.now()<end){const current=(await teacher('GET',`/generation-runs/${queued.run_id}`)).data;if(!['running','pending_verification'].includes(current.moderation_status)){item.moderation=current.moderation_status;break;}await sleep(1500);}
   await other('GET',`/scenarios/${result.scenario_id}`,undefined,403);await other('GET',`/generation-runs/${queued.run_id}`,undefined,403);
  }
  await save();console.log(JSON.stringify({scale,status:result.status,model:result.model_identifier,usage:[result.prompt_tokens,result.completion_tokens],error_code:result.error_code}));
 }
 // Read-only provenance attestation in a synthetic test school, bound to an actual normative primary source.
 const source=f.sources.regional66,claim=f.claims.regional66.primary;
 await curator('POST',`/event-sources/${source}/reviews`,{review_status:'approved',decision:'approved',methodology_notes:'LLM001 isolated binding check of a public normative source.',comments:'Synthetic reviewer; validates software binding only.'},201);
 await curator('POST',`/cultural-claims/${claim}/evidence`,{event_source_id:source,citation_locator:'Статья 1: изменение статьи 112 ТК РФ, абзац о 4 ноября',citation_excerpt:'4 ноября — День народного единства.',notes:'LLM001 synthetic acceptance binding to public law; not an ethnographic expert opinion.',verify:true},201);
 const culturalRequest=(await teacher('POST','/scenario-requests',{calendar_event_id:f.events.regional66,scale:'class_level',format_type:'class_hour',target_grades:[5,6],participants_count:30,duration_minutes:45,value_direction:'mutual_aid',family_involvement:false,available_resources:['бумага','карандаши','доска'],pedagogical_constraints:'Не добавляйте обрядов, исторических легенд или неподтверждённых фактов.'},201)).data;
 for(const[type,requestId]of [['universal_vs_personalized',report.scenarios[0].requestId],['cultural_context',culturalRequest.id]]){
  const key=crypto.randomUUID();const queued=(await teacher('POST','/scenario-comparisons',{scenario_request_id:requestId,comparison_type:type,is_synthetic:true},201,{'Idempotency-Key':key})).data;
  const replay=(await teacher('POST','/scenario-comparisons',{scenario_request_id:requestId,comparison_type:type,is_synthetic:true},201,{'Idempotency-Key':key})).data;assert.equal(replay.id,queued.id);
  const result=await poll(teacher,`/scenario-comparisons/${queued.id}`,720000);report.comparisons.push({type,id:queued.id,result});await save();
  console.log(JSON.stringify({comparison:type,status:result.status,is_cultural_available:result.is_cultural_available}));
 }
 const script=await fs.readFile('tests/backend/llm001-state.php','utf8');
 const snapshot=spawnSync('docker',['compose','-f','../school/docker-compose.yml','exec','-T','-e','LLM001_RUN='+f.runId,'app-test','php'],{input:script,encoding:'utf8',windowsHide:true});
 assert.equal(snapshot.status,0);await fs.writeFile(dir+'/postgres-live.json',snapshot.stdout);
 report.completed=report.scenarios.every(s=>s.result.status==='completed')&&report.comparisons.every(c=>c.result.status==='completed');
 await teacher('POST','/auth/logout',undefined,204);await guest('GET','/auth/me',undefined,401);await save();
 if(!report.completed)process.exitCode=1;
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Live acceptance interrupted; inspect redacted evidence.');process.exitCode=1;}
