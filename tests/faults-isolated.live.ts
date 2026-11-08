import { expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createApiClient } from '../app/utils/api-client'
import { createLatestResource } from '../app/utils/latest-resource'
const dir='docs/fe012/evidence',active=process.env.FE012_ISOLATED==='1',origin='http://localhost:8001'
it.skipIf(!active)('FE012 real server rollback, accepted response loss, reset socket and late tenant response',async()=>{
 const f=JSON.parse(await readFile(`${dir}/ui-bootstrap.json`,'utf8'));expect(f.completed).toBe(true)
 const environment=await readFile('C:/Users/bross/WebstormProjects/school/.env.testing','utf8');const key=environment.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g,'');const password=createHmac('sha256',key).update(`FE012:${f.runId}`).digest('hex')
 const cookies=new Map<string,string>(),trace:{method:string;path:string;status:number}[]=[];const contextState: { school?: string } = {};let drop=false,hold=false
 let held!:()=>void,release!:()=>void;const heldPromise=new Promise<void>(r=>{held=r}),releasePromise=new Promise<void>(r=>{release=r})
 const api=createApiClient({origin,getSchoolId:()=>contextState.school,getCookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),fetch:async(input,init)=>{
  const url=new URL(String(input));if(url.origin!==origin)throw new Error('Non-isolated target')
  const headers=new Headers(init?.headers);headers.set('Origin','http://localhost:3000');headers.set('Referer','http://localhost:3000/');headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '))
  const response=await fetch(input,{...init,headers,signal:init?.signal??AbortSignal.timeout(90000)})
  for(const raw of response.headers.getSetCookie()){const pair=raw.split(';')[0]!,n=pair.indexOf('=');cookies.set(pair.slice(0,n),pair.slice(n+1))}
  trace.push({method:init?.method??'GET',path:url.pathname,status:response.status})
  if(drop&&init?.method==='POST'){drop=false;await response.arrayBuffer();throw new TypeError('Controlled response loss after accepted real write')}
  if(hold){hold=false;held();await releasePromise}
  return response
 }})
 const login=async(role:string)=>{await api.csrf();await api.request('post','/auth/login',{body:{email:f.users[role].email,password},tenant:false,reportError:false})}
 await login('system')
 const queueIds:string[]=[]
 for(let page=1;page<=3;page++){const result=await api.request('get','/catalog/review-queue',{query:{status:'all',per_page:5,page},tenant:false,reportError:false});queueIds.push(...result.data.map(row=>row.id))}
 expect(new Set(queueIds).size).toBe(queueIds.length)
 expect(queueIds.slice(0,7)).toEqual(Object.values(f.sources).sort().reverse())
 await api.request('post','/auth/logout',{tenant:false,reportError:false});await login('regional')
 const source=f.sources.regional66;const before=(await api.request('get','/event-sources/{id}',{params:{id:source},tenant:false,reportError:false})).data
 const hook=await readFile('tests/backend/fe012-audit-fault.php','utf8')
 const php=(mode:string)=>{const r=spawnSync('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','-e',`FE012_RUN=${f.runId}`,'-e',`FE012_SOURCE=${source}`,'-e',`FE012_FAULT_MODE=${mode}`,'app-test','php'],{input:hook,encoding:'utf8',windowsHide:true,timeout:90000});if(r.status!==0)throw new Error('Isolated audit fault hook failed');const generated=JSON.parse(r.stdout);const sql=spawnSync('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','postgres','psql','-U','postgres','-d','school_events_test','-v','ON_ERROR_STOP=1'],{input:generated.sql,encoding:'utf8',windowsHide:true,timeout:90000});if(sql.status!==0)throw new Error('Isolated DBA fault hook failed');return {mode,database:generated.database}}
 try{php('remove');php('install');await expect(api.request('patch','/event-sources/{id}',{params:{id:source},body:{author:'FE012 rollback probe must not persist'},tenant:false,reportError:false})).rejects.toMatchObject({status:500})}
 finally{php('remove')}
 const after=(await api.request('get','/event-sources/{id}',{params:{id:source},tenant:false,reportError:false})).data;expect(after.author).toBe(before.author)
 await api.request('post','/auth/logout',{tenant:false,reportError:false});await login('teacher');contextState.school=f.schools.A.id
 const id=f.ui.scenarioId;const writesBefore=trace.filter(r=>r.path.endsWith(`/${id}/archive`)).length;drop=true
 await expect(api.request('post','/scenarios/{id}/archive',{params:{id},reportError:false})).rejects.toMatchObject({status:0})
 expect(trace.filter(r=>r.path.endsWith(`/${id}/archive`))).toHaveLength(writesBefore+1)
 const state=(await api.request('get','/scenarios/{id}',{params:{id},reportError:false})).data;expect(state.is_archived).toBe(true)
 await api.request('post','/scenarios/{id}/restore',{params:{id},reportError:false})
 let context='A';const resource=createLatestResource(async signal=>(await api.request('get','/schools/{id}',{params:{id:f.schools.A.id},signal,tenant:false,reportError:false})).data,()=>context)
 hold=true;const late=resource.refresh();await heldPromise;context='B';resource.reset();release();await late;expect(resource.data.value).toBeNull()
 const resetServer=createServer((req)=>req.socket.destroy());await new Promise<void>(resolve=>resetServer.listen(0,'127.0.0.1',resolve));const address=resetServer.address();if(!address||typeof address==='string')throw new Error('Fault server address missing')
 try{const offline=createApiClient({origin:`http://127.0.0.1:${address.port}`,getSchoolId:()=>undefined,getCookie:()=>''});await expect(offline.request('get','/auth/me',{tenant:false,reportError:false})).rejects.toMatchObject({status:0})}finally{await new Promise<void>((resolve,reject)=>resetServer.close(error=>error?reject(error):resolve()))}
 await api.request('post','/auth/logout',{tenant:false,reportError:false})
 await writeFile(`${dir}/faults.json`,JSON.stringify({completed:true,runId:f.runId,origin,trace,stableQueueHTTPPages:3,exactNewestTiedOwnSourceOrder:true,realLaravel500Rollback:true,installed:true,removed:true,acceptedWriteLostResponse:true,automaticMutationReplay:false,resetSocketNetworkError:true,lateTenantResponseDiscarded:true,csrf419:'Real Laravel CSRF middleware exercised by passing AuthTest::test_missing_csrf; HTTP APP_ENV=testing uses Laravel standard unit-test bypass. Not claimed as a live HTTP419.'},null,2))
},300000)
