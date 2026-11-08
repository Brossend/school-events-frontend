import { it, expect, afterAll } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac, randomUUID } from 'node:crypto'
import { spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createApiClient } from '../app/utils/api-client'
import { record, parseRun, parseAccepted } from '../app/utils/generation'
import type { RevisionPatch } from '../app/types/editor'
import type { JsonValue } from '../app/types/generation'
const active=process.env.FE007_ISOLATED==='1',origin='http://localhost:8001'
const requests:{role:string;method:string;path:string;status:number;school:string|null;ifMatch:string|null}[]=[]
const evidence:Record<string,unknown>={origin,completed:false,requests}
afterAll(async()=>{if(active)await writeFile('docs/fe007/evidence/http-mutations.json',JSON.stringify(evidence,null,2))})
function session(role:string){const cookies=new Map<string,string>();let school:string|undefined;const api=createApiClient({origin,getSchoolId:()=>school,getCookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),fetch:async(input,init)=>{if(new URL(String(input)).origin!==origin)throw new Error('Non-isolated URL refused');const headers=new Headers(init?.headers);headers.set('Origin','http://localhost:3000');headers.set('Referer','http://localhost:3000/');headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));const response=await fetch(input,{...init,headers,signal:AbortSignal.timeout(45000)});for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0]!,i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1))}requests.push({role,method:init?.method??'GET',path:new URL(String(input)).pathname,status:response.status,school:headers.get('X-School-Id'),ifMatch:headers.get('If-Match')});return response}});return{api,select:(id:string)=>{school=id}}}
it.skipIf(!active)('edits immutable revisions, verifies actual queue jobs, checks conflicts, provenance and signoff in app-test',async()=>{
 const fixture=JSON.parse(await readFile('docs/fe007/evidence/test-fixtures.json','utf8'))
 expect([fixture.database,fixture.environment,fixture.databaseUser]).toEqual(['school_events_test','testing','school_test_user'])
 expect(fixture.queue).toMatch(/^fe007_[a-f0-9]{10}$/)
 const env=await readFile('C:/Users/bross/WebstormProjects/school/.env.testing','utf8'),key=env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g,''),password=createHmac('sha256',key).update(`FE007:${fixture.runId}`).digest('hex')
 const author=session('multi'),other=session('other'),director=session('director'),A=fixture.schools.A.id,B=fixture.schools.B.id
 for(const [role,s]of [['multi',author],['other',other],['director',director]]as const){await s.api.request('post','/auth/login',{tenant:false,body:{email:fixture.users[role].email,password}});s.select(A)}
 const script=await readFile('tests/backend/fe007-state.php','utf8')
 const inspect=(action='inspect')=>{const result=spawnSync('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','-e',`FE007_SCHOOL_A=${A}`,'-e',`FE007_SCHOOL_B=${B}`,'-e',`FE007_SOURCE=${fixture.sourceId}`,'-e',`FE007_ACTION=${action}`,'app-test','php'],{input:script,encoding:'utf8',windowsHide:true,timeout:60000});expect(result.status,result.stderr).toBe(0);return JSON.parse(result.stdout)}
 const before=inspect();expect([before.queueConnection,before.queueName,String(before.redisDatabase)]).toEqual(['redis',fixture.queue,'1']);evidence.contour={database:before.database,role:before.role,queue:fixture.queue,redisDatabase:'1'}
 let workers=0
 const worker=async()=>{const run=await promisify(execFile)('docker',['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T','app-test','php','artisan','queue:work','redis',`--queue=${fixture.queue}`,'--stop-when-empty','--tries=1','--timeout=120','--no-ansi'],{windowsHide:true,timeout:180000});await writeFile(`docs/fe007/evidence/redis-worker-${++workers}.log`,run.stdout+run.stderr)}
 const input={calendar_event_id:fixture.events.approved,scale:'class_level' as const,format_type:'class_hour' as const,target_grades:[5,6],participants_count:25,duration_minutes:45,value_direction:'historical_memory' as const,family_involvement:false,available_resources:['Бумага','Проектор']}
 const request=await author.api.request('post','/scenario-requests',{body:input}),requestId=request.data.id
 const accepted=await author.api.request('post','/scenario-requests/{id}/generate',{params:{id:requestId},headers:{'Idempotency-Key':randomUUID()}}),runId=parseAccepted(accepted)
 await worker();const run=parseRun(await author.api.request('get','/generation-runs/{id}',{params:{id:runId}}));expect(run.status).toBe('completed');expect(run.provider_name).toBe('mock');const id=run.scenario_id!
 evidence.ids={requestId,runId,scenarioId:id};await writeFile('docs/fe007/evidence/browser-scenario.json',JSON.stringify({id,runId,requestId,user:'multi',school:A},null,2))
 const load=async()=>record((await author.api.request('get','/scenarios/{id}',{params:{id}})).data)
 const revision=async(version:number)=>record((await author.api.request('get','/scenarios/{id}/revisions/{version}',{params:{id,version}})).data)
 const checks=async(version:number)=>record((await author.api.request('get','/scenarios/{id}/revisions/{version}/verifications',{params:{id,version}})).data)
 const patch=async(version:number,lock:number,body:Partial<RevisionPatch>)=>author.api.request('patch','/scenarios/{id}/revisions/{version}',{params:{id,version},headers:{'If-Match':String(lock)},body:body as RevisionPatch})
 const verify=(version:number)=>author.api.request('post','/scenarios/{id}/revisions/{version}/verify',{params:{id,version}})
 const body={checklist_confirmed:{safety_checked:true as const,timing_fit:true as const,cultural_context_approved:true as const}}
 const sign=(version:number,ack=false)=>{const input={...body,warnings_acknowledged:ack,teacher_notes:'Синтетическая интеграционная проверка FE007, не экспертное согласование.'};return author.api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params:{id,version},body:input})}
 let current=await load();const first=await revision(1),originalPayload=JSON.parse(JSON.stringify(first.content_payload));await writeFile('docs/fe007/evidence/before-edit.json',JSON.stringify(inspect(),null,2))
 await expect(patch(1,Number(current.optimistic_lock_version),{concept:'Коротко'})).rejects.toMatchObject({status:422});expect((await load()).optimistic_lock_version).toBe(current.optimistic_lock_version)
 await expect(other.api.request('patch','/scenarios/{id}/revisions/{version}',{params:{id,version:1},headers:{'If-Match':String(current.optimistic_lock_version)},body:{concept:'Чужая редакция не должна сохраняться в базе данных.'}})).rejects.toMatchObject({status:403})
 await expect(other.api.request('post','/scenarios/{id}/revisions/{version}/verify',{params:{id,version:1}})).rejects.toMatchObject({status:403})
 await expect(other.api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params:{id,version:1},body})).rejects.toMatchObject({status:403})
 const p=record(first.content_payload),edit:RevisionPatch={concept:String(first.concept)+' Уточнён педагогом в изолированном тесте.',pedagogical_goal:String(first.pedagogical_goal)+' Обсуждение личного вклада.',pedagogical_tasks:record(p.pedagogical_tasks) as Record<string,JsonValue>,stages:p.stages as Record<string,JsonValue>[],materials:record(p.materials) as Record<string,JsonValue>}
 edit.pedagogical_tasks.personal=['Осознание личной ответственности и ценности совместной работы.'];edit.stages[0]!.teacher_actions=String(edit.stages[0]!.teacher_actions)+' Приглашает высказаться желающих.'
 const lock=Number(current.optimistic_lock_version);expect((await patch(1,lock,edit)).data.current_revision!.version_number).toBe(2)
 await expect(patch(1,lock,edit)).rejects.toMatchObject({status:409,code:'OPTIMISTIC_LOCK_CONFLICT'})
 current=await load();await expect(patch(1,Number(current.optimistic_lock_version),edit)).rejects.toMatchObject({status:409,code:'CANNOT_EDIT_HISTORICAL_REVISION'})
 await expect(sign(1)).rejects.toMatchObject({status:422,code:'CANNOT_SIGNOFF_HISTORICAL_REVISION'})
 expect((await revision(1)).content_payload).toEqual(originalPayload);expect((await revision(2)).signoff).toBeNull()
 await worker();expect((await checks(2)).status).toBe('passed');await verify(2);expect((await checks(2)).status).toBe('passed')
 await expect(author.api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params:{id,version:2},body:{checklist_confirmed:{...body.checklist_confirmed,timing_fit:false as unknown as true}}})).rejects.toMatchObject({status:422,code:'SIGNOFF_CHECKLIST_FLAGS_MUST_BE_TRUE'})
 await sign(2);expect(record((await revision(2)).signoff).is_confirmed).toBe(true)
 inspect('detach');await expect(sign(2)).rejects.toMatchObject({status:422,code:'MODERATION_REVERIFICATION_REQUIRED'});expect(record((await revision(2)).signoff).is_confirmed).toBe(true)
 await verify(2);const blocked=await checks(2);expect(blocked.status).toBe('blocked');expect(Number(blocked.p0_violations_count)).toBeGreaterThan(0);evidence.revokedVerification=blocked;await expect(sign(2)).rejects.toMatchObject({status:422,code:'MODERATION_BLOCKED_P0'})
 inspect('attach');await verify(2);expect((await checks(2)).status).toBe('passed');await sign(2)
 edit.stages=edit.stages.map((s,i)=>({...s,duration_minutes:[2,41,2][i]!}));await patch(2,Number((await load()).optimistic_lock_version),edit);await worker();expect((await checks(3)).status).toBe('passed_with_warnings');evidence.warningVerification=await checks(3)
 await expect(sign(3)).rejects.toMatchObject({status:422,code:'WARNINGS_ACKNOWLEDGMENT_REQUIRED'});await sign(3,true)
 edit.stages=edit.stages.map((s,i)=>({...s,duration_minutes:[9,27,9][i]!}));await patch(3,Number((await load()).optimistic_lock_version),edit);await worker();expect((await revision(4)).signoff).toBeNull();expect((await checks(4)).status).toBe('passed')
 author.select(B);await expect(author.api.request('get','/scenarios/{id}',{params:{id}})).rejects.toMatchObject({status:403});await expect(author.api.request('patch','/scenarios/{id}/revisions/{version}',{params:{id,version:4},headers:{'If-Match':'4'},body:edit})).rejects.toMatchObject({status:403});await expect(author.api.request('post','/scenarios/{id}/revisions/{version}/verify',{params:{id,version:4}})).rejects.toMatchObject({status:403});await expect(author.api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params:{id,version:4},body})).rejects.toMatchObject({status:403});author.select(A)
 expect((await director.api.request('get','/scenarios/{id}',{params:{id}})).data.id).toBe(id)
 const after=inspect();const stored=after.scenarios.find((s:{id:string})=>s.id===id);expect(stored.revisions).toHaveLength(4);const baseline=JSON.parse(await readFile('docs/fe007/evidence/before-edit.json','utf8')).scenarios.find((s:{id:string})=>s.id===id);expect(stored.revisions[0].contentSha256).toBe(baseline.revisions[0].contentSha256);await writeFile('docs/fe007/evidence/persisted-revisions.json',JSON.stringify(after,null,2))
 for(const s of[author,other,director])await s.api.request('post','/auth/logout',{tenant:false});await expect(author.api.request('get','/scenarios/{id}',{params:{id}})).rejects.toMatchObject({status:401});evidence.completed=true
},600000)
