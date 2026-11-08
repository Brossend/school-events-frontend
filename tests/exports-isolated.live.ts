import { it, expect, afterAll } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHmac, randomUUID, createHash } from 'node:crypto'
import { spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createApiClient } from '../app/utils/api-client'
import { record, parseRun, parseAccepted } from '../app/utils/generation'
import { exportFormats } from '../app/types/exports'
import { parseExportHistory, parseExportJob, formatInfo } from '../app/utils/export-data'
const active=process.env.FE008_ISOLATED==='1',origin='http://localhost:8001',dir='docs/fe008/evidence'
const requests:Record<string,unknown>[]=[],evidence:Record<string,unknown>={origin,completed:false,requests}
afterAll(async()=>{if(active)await writeFile(`${dir}/http-exports.json`,JSON.stringify(evidence,null,2))})
function session(role:string){const cookies=new Map<string,string>();let school:string|undefined;const api=createApiClient({origin,getSchoolId:()=>school,getCookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),fetch:async(input,init)=>{if(new URL(String(input)).origin!==origin)throw new Error('Non-isolated URL');const headers=new Headers(init?.headers);headers.set('Origin','http://localhost:3000');headers.set('Referer','http://localhost:3000/');headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));const response=await fetch(input,{...init,headers,signal:AbortSignal.any([AbortSignal.timeout(90000),...(init?.signal?[init.signal]:[])])});for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0]!,i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1))}requests.push({role,method:init?.method??'GET',path:new URL(String(input)).pathname,status:response.status,school:headers.get('X-School-Id'),idempotency:headers.get('Idempotency-Key'),mime:response.headers.get('Content-Type')});return response}});return{api,select:(id:string)=>{school=id}}}
it.skipIf(!active)('FE008 real isolated exports, OOXML/PDF transport, tenancy and live provenance denial',async()=>{
 const fixture=JSON.parse(await readFile(`${dir}/test-fixtures.json`,'utf8'))
 expect([fixture.database,fixture.environment,fixture.databaseUser]).toEqual(['school_events_test','testing','school_test_user']);expect(fixture.queue).toMatch(/^fe008_[a-f0-9]{10}$/)
 const env=await readFile('C:/Users/bross/WebstormProjects/school/.env.testing','utf8'),key=env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g,''),password=createHmac('sha256',key).update(`FE008:${fixture.runId}`).digest('hex')
 const author=session('multi'),other=session('other'),director=session('director'),A=fixture.schools.A.id,B=fixture.schools.B.id
 for(const[role,s]of[['multi',author],['other',other],['director',director]]as const){await s.api.request('post','/auth/login',{tenant:false,body:{email:fixture.users[role].email,password}});s.select(A)}
 const script=await readFile('tests/backend/fe008-state.php','utf8')
 const inspect=(action='inspect')=>{const run=spawnSync('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','-e',`FE008_SCHOOL_A=${A}`,'-e',`FE008_SCHOOL_B=${B}`,'-e',`FE008_SOURCE=${fixture.sourceId}`,'-e',`FE008_ACTION=${action}`,'app-test','php'],{input:script.replace(/^\uFEFF/,''),encoding:'utf8',windowsHide:true,timeout:60000});expect(run.status,run.stderr).toBe(0);return JSON.parse(run.stdout)}
 const before=inspect();expect([before.queueConnection,before.queueName,String(before.redisDatabase)]).toEqual(['redis',fixture.queue,'1']);evidence.contour=before
 const worker=async()=>{const run=await promisify(execFile)('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','app-test','php','artisan','queue:work','redis',`--queue=${fixture.queue}`,'--stop-when-empty','--tries=1','--timeout=120','--no-ansi'],{windowsHide:true,timeout:180000});await writeFile(`${dir}/worker-${Date.now()}.log`,run.stdout+run.stderr)}
 const request=await author.api.request('post','/scenario-requests',{body:{calendar_event_id:fixture.events.approved,scale:'class_level',format_type:'class_hour',target_grades:[5,6],participants_count:25,duration_minutes:45,value_direction:'historical_memory',family_involvement:false,available_resources:['Бумага','Проектор']}}),requestId=request.data.id
 const runId=parseAccepted(await author.api.request('post','/scenario-requests/{id}/generate',{params:{id:requestId},headers:{'Idempotency-Key':randomUUID()}}));await worker()
 const run=parseRun(await author.api.request('get','/generation-runs/{id}',{params:{id:runId}}));expect(run.status).toBe('completed');expect(run.provider_name).toBe('mock');const id=run.scenario_id!
 const revision=async(version=1)=>record((await author.api.request('get','/scenarios/{id}/revisions/{version}',{params:{id,version}})).data)
 const verify=async(version=1)=>{await author.api.request('post','/scenarios/{id}/revisions/{version}/verify',{params:{id,version}});expect(record((await author.api.request('get','/scenarios/{id}/revisions/{version}/verifications',{params:{id,version}})).data).status).toBe('passed')}
 const sign=async(version=1)=>author.api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params:{id,version},body:{checklist_confirmed:{safety_checked:true,timing_fit:true,cultural_context_approved:true},teacher_notes:'Синтетическая проверка FE008, не экспертное согласование.'}})
 const create=(format:typeof exportFormats[number],version=1,key=randomUUID())=>author.api.request('post','/scenarios/{id}/revisions/{version}/exports',{params:{id,version},headers:{'Idempotency-Key':key},body:{format}})
 await verify();await expect(create('pdf')).rejects.toMatchObject({status:403,code:'EXPORT_FORBIDDEN_SIGN_OFF_REQUIRED'});await sign()
 const revisionId=String((await revision()).id),jobs:Record<string,string>={},responses:Record<string,unknown>={}
 await mkdir(`${dir}/documents`,{recursive:true})
 for(const format of exportFormats){const key=randomUUID(),accepted=await create(format,1,key);responses[format]=accepted;jobs[format]=accepted.data.id;expect(accepted.data.status).toBe('ready');const replay=await create(format,1,key);expect(replay.data.id).toBe(accepted.data.id);const jobResponse=await author.api.request('get','/export-jobs/{id}',{params:{id:accepted.data.id}});parseExportJob(jobResponse);responses[`${format}Job`]=jobResponse}
 evidence.responses=responses;evidence.ids={requestId,runId,scenarioId:id,revisionId,jobs}
 const history=()=>author.api.request('get','/scenarios/{id}/revisions/{version}/exports',{params:{id,version:1}})
 const entries=parseExportHistory(await history(),revisionId);expect(entries).toHaveLength(4);expect(entries.every(e=>e.is_downloadable)).toBe(true);evidence.historyBefore=await history()
 const downloads=[]
 for(const entry of entries){const file=await author.api.downloadExport(entry.id,entry.format,{schoolId:A,checksum:entry.artifact!.sha256_hash,signal:new AbortController().signal}),bytes=Buffer.from(await file.blob.arrayBuffer());expect(file.mime).toBe(formatInfo[entry.format].mime);expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.artifact!.sha256_hash);const path=`${dir}/documents/fe008-${entry.format}.${formatInfo[entry.format].extension}`;await writeFile(path,bytes);downloads.push({format:entry.format,job:entry.id,path,mime:file.mime,bytes:bytes.length,sha256:entry.artifact!.sha256_hash})}
 evidence.downloads=downloads
 expect((await director.api.downloadExport(jobs.pdf!,'pdf',{schoolId:A,signal:new AbortController().signal})).bytes).toBeGreaterThan(100)
 await expect(other.api.downloadExport(jobs.pdf!,'pdf',{schoolId:A,signal:new AbortController().signal})).rejects.toMatchObject({status:403});await expect(other.api.request('get','/export-jobs/{id}',{params:{id:jobs.pdf!}})).rejects.toMatchObject({status:403})
 author.select(B);await expect(author.api.downloadExport(jobs.pdf!,'pdf',{schoolId:B,signal:new AbortController().signal})).rejects.toMatchObject({status:403});author.select(A)
 await expect(author.api.downloadExport(randomUUID(),'pdf',{schoolId:A,signal:new AbortController().signal})).rejects.toMatchObject({status:404})
 const denial=async(label:string)=>{let err:unknown;try{await author.api.downloadExport(jobs.pdf!,'pdf',{schoolId:A,signal:new AbortController().signal})}catch(e){err=e}expect(err).toMatchObject({status:403});return{label,error:err instanceof Error?{...err,message:err.message}:err,history:await history()}}
 const denials=[];inspect('detach');denials.push(await denial('revoked evidence'));expect(parseExportHistory(await history(),revisionId).every(e=>!e.is_downloadable)).toBe(true);await expect(create('pdf')).rejects.toMatchObject({status:403});inspect('attach');await verify();await sign()
 for(const kind of['job','signoff','moderation'])for(const value of['stale','null']){inspect(`${kind}-${value}`);denials.push(await denial(`${kind}-${value}`));if(kind!=='job')await expect(create('pdf')).rejects.toMatchObject({status:403});inspect(`${kind}-restore`)}
 evidence.denials=denials
 // Lost HTTP 202 is deliberately ignored; replaying its same key identifies the same persisted job.
 const lostKey=randomUUID(),lost=await create('pdf',1,lostKey),recovered=await create('pdf',1,lostKey);expect(recovered.data.id).toBe(lost.data.id);evidence.lostResponseRecovery={original:lost.data.id,recovered:recovered.data.id,sameKey:true}
 const current=record((await author.api.request('get','/scenarios/{id}',{params:{id}})).data)
 await author.api.request('patch','/scenarios/{id}/revisions/{version}',{params:{id,version:1},headers:{'If-Match':String(current.optimistic_lock_version)},body:{concept:String((await revision()).concept)+' Уточнение для проверки исторического экспорта FE008.'}});await worker()
 await expect(author.api.downloadExport(jobs.pdf!,'pdf',{schoolId:A,signal:new AbortController().signal})).rejects.toMatchObject({status:409,code:'CANNOT_DOWNLOAD_HISTORICAL_EXPORT'});await expect(create('pdf')).rejects.toMatchObject({status:409});expect(parseExportHistory(await history(),revisionId).every(e=>!e.is_downloadable)).toBe(true)
 await verify(2);await expect(create('pdf',2)).rejects.toMatchObject({status:403});await sign(2)
 await writeFile(`${dir}/browser-scenario.json`,JSON.stringify({id,version:2,revisionId:(await revision(2)).id,runId,requestId,user:'multi',school:A},null,2));evidence.persisted=inspect()
 for(const s of[author,other,director])await s.api.request('post','/auth/logout',{tenant:false});await expect(author.api.downloadExport(jobs.pdf!,'pdf',{schoolId:A,signal:new AbortController().signal})).rejects.toMatchObject({status:401});evidence.completed=true
},600000)
