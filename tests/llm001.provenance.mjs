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
const report={origin,runId:f.runId,completed:false,trace:[],scenarios:[],comparisons:[],syntheticOnly:true};
const save=()=>fs.writeFile(dir+'/live-provenance-selection.json',JSON.stringify(report,null,2));
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
const teacher=session('teacher',f.schools.A.id), curator=session('regional');
async function login(call,role){await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password});}
try{
 const live=JSON.parse(await fs.readFile(dir+'/live-http.json','utf8'));
 assert.equal(live.completed,true);
 await login(teacher,'teacher');await login(curator,'regional');
 const universal=live.comparisons.find(c=>c.type==='universal_vs_personalized');
 await teacher('POST',`/scenario-comparisons/${universal.id}/selection`,{selected_variant:'A',selection_reason:'Synthetic acceptance: compare saved actual variants.'});
 await teacher('POST',`/scenario-comparisons/${universal.id}/selection`,{selected_variant:'B',selection_reason:'Synthetic attempt to replace immutable selection.'},409);
 const cultural=live.comparisons.find(c=>c.type==='cultural_context');
 assert.equal((await teacher('GET',`/scenario-comparisons/${cultural.id}`)).data.is_cultural_available,true);
 await curator('DELETE',`/cultural-claims/${f.claims.regional66.primary}/evidence/${f.sources.regional66}`);
 assert.equal((await teacher('GET',`/scenario-comparisons/${cultural.id}`)).data.is_cultural_available,false);
 await teacher('POST',`/scenario-comparisons/${cultural.id}/selection`,{selected_variant:'B',selection_reason:'Synthetic attempt to select revoked cultural evidence.'},409);
 await teacher('POST','/auth/logout',undefined,204);await teacher('GET','/auth/me',undefined,401);
 report.completed=true;await save();console.log('PASS: immutable selection, live revoke, logout');
}catch(error){report.failure={name:error.name,message:error.message};await save();console.error('Provenance/selection incomplete; inspect redacted evidence.');process.exitCode=1;}
