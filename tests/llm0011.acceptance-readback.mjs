// Fresh GET acceptance of every selected result; never generates or edits scenarios.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir='docs/llm001-1/final-v152';
if(process.env.LLM0011_LIVE!=='1')throw Error('Explicit isolated acceptance required');
const live=JSON.parse(await fs.readFile(dir+'/live-http.json','utf8'));
assert.equal(live.completed,true);
const f=JSON.parse(await fs.readFile(dir+'/test-fixtures.json','utf8'));
assert.equal(f.database,'school_events_test');assert.equal(f.databaseUser,'school_test_user');
const env=await fs.readFile('../school/.env.testing','utf8');
const key=env.match(/^APP_KEY=(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const password=crypto.createHmac('sha256',key).update('LLM0011:'+f.runId).digest('hex');
const report={runId:f.runId,completed:false,trace:[],cases:[]},cookies=new Map();
const save=()=>fs.writeFile(dir+'/acceptance-readback.json',JSON.stringify(report,null,2));
async function call(method,path,body,status=200){
 const headers={Accept:'application/json',Origin:'http://localhost:3000',Referer:'http://localhost:3000/','X-School-Id':f.schools.A.id};
 headers.Cookie=[...cookies].map(([k,v])=>`${k}=${v}`).join('; ');
 if(cookies.has('XSRF-TOKEN'))headers['X-XSRF-TOKEN']=decodeURIComponent(cookies.get('XSRF-TOKEN'));
 if(body)headers['Content-Type']='application/json';
 const response=await fetch('http://localhost:8001'+(path.startsWith('/sanctum')?path:'/api/v1'+path),{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
 const data=await response.json().catch(()=>null);
 report.trace.push({method,path,status:response.status});await save();assert.equal(response.status,status);
 return data?.data;
}
function quality(value){
 assert.equal(value.gate_version,'quality-2.3.6');assert.equal(value.technical_checks,'passed');
 assert.equal(value.status,'requires_review');assert.equal(value.cultural_coverage.whole_document_verified,false);
 assert.equal(value.expert_assessment,'not_performed');assert.equal(value.teacher_signoff_required,true);
}
try{
 await call('GET','/sanctum/csrf-cookie',undefined,204);
 await call('POST','/auth/login',{email:f.users.teacher.email,password});
 for(const entry of live.scenarios){
  const value=await call('GET',`/scenarios/${entry.result.scenario_id}`);quality(value.quality_review);
  report.cases.push({case:entry.scale,scenarioId:value.id,quality:value.quality_review});
 }
 for(const entry of live.comparisons){
  const value=await call('GET',`/scenario-comparisons/${entry.id}`);
  assert.equal(value.status,'completed');quality(value.quality_review.A);quality(value.quality_review.B);
  if(entry.type==='cultural_context'){assert.equal(value.is_cultural_available,true);assert.ok(value.quality_review.B.cultural_coverage.supported_assertions.length>0);}
  report.cases.push({case:entry.type,comparisonId:value.id,quality:value.quality_review});
 }
 assert.equal(report.cases.length,5);
 await call('POST','/auth/logout',undefined,204);await call('GET','/auth/me',undefined,401);
 report.completed=true;await save();console.log('PASS: fresh current-gate GET readback of five cases / seven variants.');
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Fresh readback failed; see redacted receipt.');process.exitCode=1;}
