// Real, bounded live acceptance run. No HTTP fakes. Isolated synthetic school only.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='docs/llm001', origin='http://localhost:8001';
if(process.env.LLM001_LIVE!=='1')throw Error('Set LLM001_LIVE=1 explicitly');
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
assert.equal(f.database,'school_events_test');assert.equal(f.databaseUser,'school_test_user');
const env=await fs.readFile('../school/.env.testing','utf8');
const appKey=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',appKey).update('LLM001:'+f.runId).digest('hex');
const prior=JSON.parse(await fs.readFile(dir+'/live-http-correction-restarted.json','utf8'));
const report={...prior,completed:false,trace:[],initialEvidence:'live-http-correction-restarted.json',correction:'Prompt 1.2.1 clarifies filled handout example; only failed universal pair retried',supersededComparisons:[...(prior.supersededComparisons??[]),...prior.comparisons.filter(c=>c.result.status==='failed')],comparisons:prior.comparisons.filter(c=>c.result.status==='completed')};
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
const teacher=session('teacher',f.schools.A.id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function login(call,role){await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password});}
async function poll(call,path,timeout=420000){const until=Date.now()+timeout;let data;while(Date.now()<until){data=(await call('GET',path)).data;if(['completed','failed'].includes(data.status))return data;await sleep(2500);}throw Error('Timed out reading '+path);}
try{
 await login(teacher,'teacher');
 const key=crypto.randomUUID();
 const body={scenario_request_id:prior.scenarios[0].requestId,comparison_type:'universal_vs_personalized',is_synthetic:true};
 const queued=(await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':key})).data;
 const replay=(await teacher('POST','/scenario-comparisons',body,201,{'Idempotency-Key':key})).data;assert.equal(queued.id,replay.id);
 console.log(JSON.stringify({queued:queued.id,status:queued.status}));
 const result=await poll(teacher,`/scenario-comparisons/${queued.id}`,720000);
 report.comparisons.push({type:body.comparison_type,id:queued.id,result});
 report.completed=report.scenarios.every(s=>s.result.status==='completed')&&report.comparisons.length===2&&report.comparisons.every(c=>c.result.status==='completed');
 await save();console.log(JSON.stringify({status:result.status,completed:report.completed}));
 await teacher('POST','/auth/logout',undefined,204);await save();
 if(!report.completed)process.exitCode=1;
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Correction interrupted; inspect redacted evidence.');process.exitCode=1;}
