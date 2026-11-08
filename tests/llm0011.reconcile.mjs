// GET-only job recovery after a client disconnect. No generation POSTs.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const dir='docs/llm001-1/final-v152', origin='http://localhost:8001';
if(process.env.LLM0011_LIVE!=='1')throw Error('Explicit isolated live scope required');
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
const initial=JSON.parse(await fs.readFile(dir+'/live-http-corrective-interrupted.json','utf8'));
const primary=JSON.parse(await fs.readFile(dir+'/live-http-primary-v151.json','utf8'));
const snapshot=spawnSync('docker',['compose','-f','../school/docker-compose.yml','exec','-T','-e','LLM0011_RUN='+f.runId,'app-test','php'],{input:await fs.readFile('tests/backend/llm0011-state.php','utf8'),encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
assert.equal(snapshot.status,0);const db=JSON.parse(snapshot.stdout);
assert.equal(db.database,'school_events_test');assert.equal(db.role,'school_test_user');
assert.ok(db.generationRuns.every(r=>!['running','queued'].includes(r.status)),'Wait for the already-sent job to finish; do not cancel it');
assert.ok(db.comparisons.every(c=>c.status!=='pending'));
assert.deepEqual([...new Set(db.generationRuns.map(r=>r.prompt_version))],['school-methodist-1.5.2']);
const env=await fs.readFile('../school/.env.testing','utf8');
const appKey=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',appKey).update('LLM0011:'+f.runId).digest('hex');
const cookies=new Map(),trace=[];
async function call(method,path,body,status=200){
 const headers={Accept:'application/json',Origin:'http://localhost:3000',Referer:'http://localhost:3000/','X-School-Id':f.schools.A.id};
 headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
 if(cookies.has('XSRF-TOKEN'))headers['X-XSRF-TOKEN']=decodeURIComponent(cookies.get('XSRF-TOKEN'));
 if(body)headers['Content-Type']='application/json';
 const response=await fetch(origin+(path.startsWith('/sanctum')?path:'/api/v1'+path),{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
 const data=await response.json().catch(()=>null);assert.equal(response.status,status,`${method} ${path}`);
 trace.push({method,path,status:response.status,...(path.startsWith('/auth/')?{}:{response:data})});return data;
}
await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users.teacher.email,password});
const result={...initial,trace,priorEvidence:'live-http-corrective-interrupted.json',scenarios:[],comparisons:[],completed:false,recoveryUsesNoGenerationPost:true};
for(const original of primary.scenarios){
 const candidate=db.generationRuns.filter(r=>r.scenario_request_id===original.requestId).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id))[0];
 const run=(await call('GET',`/generation-runs/${candidate.id}`)).data;
 assert.equal(run.provider_name,'litellm');assert.equal(run.model_identifier,'GigaChat-2-Max');
 const item={scale:original.scale,requestId:original.requestId,runId:candidate.id,result:run,recoveredAfterClientInterruption:!initial.scenarios.some(s=>s.runId===candidate.id)};
 if(run.status==='completed'){item.scenario=(await call('GET',`/scenarios/${run.scenario_id}`)).data;item.qualityReview=item.scenario.quality_review;assert.equal(item.qualityReview.technical_checks,'passed');}
 result.scenarios.push(item);
}
for(const original of primary.comparisons){const candidate=db.comparisons.filter(c=>c.comparison_type===original.type).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id.localeCompare(a.id))[0];const fresh=(await call('GET',`/scenario-comparisons/${candidate.id}`)).data;result.comparisons.push({...original,id:candidate.id,result:fresh});}
await call('POST','/auth/logout',undefined,204);await call('GET','/auth/me',undefined,401);
result.completed=result.scenarios.every(s=>s.result.status==='completed')&&result.comparisons.every(c=>c.result.status==='completed');
await fs.writeFile(dir+'/live-http-reconciled-v151.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({recovered:result.scenarios.map(s=>({scale:s.scale,status:s.result.status})),paidGenerationCalls:0}));
