import { afterAll, expect, it } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHmac, createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
// Raw HTTP JSON is deliberately inspected at the boundary, before frontend parsers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>
const active=process.env.FE012_ISOLATED==='1', origin='http://localhost:8001', dir='docs/fe012/evidence'
const trace:Json[]=[], phases:Json[]=[], secrets=new Set<string>()
const evidence:Json={origin,completed:false,trace,phases,syntheticOnly:true}
const redact=(value:unknown):unknown=>{
 if(typeof value==='string'){let safe=value;for(const secret of secrets)if(secret)safe=safe.replaceAll(secret,'[REDACTED]');return safe.replace(/pilot_[A-Za-z0-9]{20,}/g,'[REDACTED]')}
 if(Array.isArray(value))return value.map(redact)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!/password|invite_token|cookie|authorization|secret/i.test(k)).map(([k,v])=>[k,redact(v)]))
 return value
}
async function save(){await mkdir(dir,{recursive:true});await writeFile(`${dir}/http-full-stack.json`,JSON.stringify(redact(evidence),null,2))}
afterAll(async()=>{if(active)await save()})
function php(script:string,env:Record<string,string>={}){
 const args=['compose','-f','C:/Users/bross/WebstormProjects/school/docker-compose.yml','exec','-T']
 for(const[k,v]of Object.entries(env))args.push('-e',`${k}=${v}`)
 args.push('app-test','php');const r=spawnSync('docker',args,{input:script,encoding:'utf8',windowsHide:true,timeout:90000})
 if(r.status!==0)throw new Error('FE012 isolated PHP checkpoint failed')
 return JSON.parse(r.stdout) as Json
}
it.skipIf(!active)('FE012 full-stack real isolated endpoints and Redis exports',async()=>{
 const f=JSON.parse(await readFile(`${dir}/test-fixtures.json`,'utf8')) as Json
 expect([f.origin,f.database,f.environment,f.databaseUser]).toEqual([origin,'school_events_test','testing','school_test_user'])
 const probe=await fetch(`${origin}/api/v1/test/environment-probe`).then(r=>r.json());expect(probe.database).toBe('school_events_test');evidence.probe=probe;evidence.runId=f.runId
 const env=await readFile('C:/Users/bross/WebstormProjects/school/.env.testing','utf8');const key=env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g,'')
 const password=createHmac('sha256',key).update(`FE012:${f.runId}`).digest('hex');secrets.add(password);secrets.add(key)
 const owned=new Set<string>([...Object.values(f.schools).map((s)=>String((s as Json).id)),...Object.values(f.events) as string[],...Object.values(f.sources) as string[],...Object.values(f.claims).flatMap(c=>Object.values(c as Json)) as string[]])
 const track=(id:unknown)=>{expect(typeof id).toBe('string');expect(String(id)).toMatch(/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i);owned.add(String(id));return String(id)}
 const absent='00000000-0000-4000-8000-000000000012'
 const stateScript=await readFile('tests/backend/fe012-state.php','utf8')
 const snapshot=async(name:string)=>{const data=php(stateScript,{FE012_RUN:f.runId});await writeFile(`${dir}/postgres-${name}.json`,JSON.stringify(redact(data),null,2));return data}
 const phase=async(name:string)=>{phases.push({name,date:new Date().toISOString(),responses:trace.length});await save()}
 function session(role:string,school?:string){
  const cookies=new Map<string,string>()
  const call=async(method:string,path:string,body?:Json,status:number|number[]=200,extra:Record<string,string>={})=>{
   const url=new URL(path.startsWith('/sanctum')?path:`/api/v1${path}`,origin);if(url.origin!==origin)throw new Error('Non-isolated target')
   if(method!=='GET'&&!path.startsWith('/auth/'))for(const id of path.match(/[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}/gi)??[])if(!owned.has(id)&&id!==absent)throw new Error('Foreign mutation target')
   const headers=new Headers({Accept:'application/json',Origin:'http://localhost:3000',Referer:'http://localhost:3000/',...extra})
   headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));if(school)headers.set('X-School-Id',school)
   if(cookies.has('XSRF-TOKEN')&&!headers.has('X-XSRF-TOKEN'))headers.set('X-XSRF-TOKEN',decodeURIComponent(cookies.get('XSRF-TOKEN')!))
   if(body)headers.set('Content-Type','application/json')
   const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(90000)})
   for(const raw of res.headers.getSetCookie()){const pair=raw.split(';')[0]!,n=pair.indexOf('=');cookies.set(pair.slice(0,n),pair.slice(n+1));secrets.add(pair.slice(n+1))}
   const binary=res.ok&&/pdf|wordprocessingml|presentationml/.test(res.headers.get('Content-Type')??'')
   const bytes=binary?Buffer.from(await res.arrayBuffer()):undefined
   const payload=binary?{bytes:bytes!.length,sha256:createHash('sha256').update(bytes!).digest('hex')}:await res.json().catch(()=>null)
   trace.push({role,method,path,school:school??null,status:res.status,request:path.startsWith('/auth/')?'[auth omitted]':redact(body),response:path.startsWith('/auth/')?'[auth omitted]':redact(payload)})
   await save();expect(Array.isArray(status)?status:[status],`${role} ${method} ${path}`).toContain(res.status)
   return {...payload,binary:bytes,httpStatus:res.status} as Json
  }
  return{call,select:(id?:string)=>{school=id},login:async()=>{await call('GET','/sanctum/csrf-cookie',undefined,204);await call('POST','/auth/login',{email:f.users[role].email,password})}}
 }
 const A=f.schools.A.id,B=f.schools.B.id,C=f.schools.C.id
 const teacher=session('teacher',A),admin=session('schoolAdmin',A),regional=session('regional'),system=session('system'),other=session('other',B),multi=session('multi'),guest=session('guest')
 await guest.call('GET','/auth/me',undefined,401)
 for(const user of [teacher,admin,regional,system,other,multi])await user.login()
 await teacher.call('GET','/auth/me');await multi.call('GET','/tenant/current',undefined,422);multi.select(A);await multi.call('GET','/tenant/current');multi.select(B);await multi.call('GET','/tenant/current')
 await teacher.call('GET',`/schools/${B}`,undefined,403);await teacher.call('GET',`/calendar-events/${absent}`,undefined,404)
 await snapshot('before');await phase('auth-school-selection')
 await teacher.call('GET','/dashboard/summary');const calendar=await teacher.call('GET',`/calendar-events?from=2026-10-01&to=2026-11-30&q=FE012&per_page=100`)
 expect(calendar.data.some((e:Json)=>e.id===f.events.regional66&&e.occurrences.some((o:Json)=>o.start_date==='2026-10-30'))).toBe(true)
 await teacher.call('GET',`/calendar-events/${f.events.regional66}`);await teacher.call('GET',`/event-sources/${f.sources.regional66}`);await teacher.call('GET',`/cultural-claims/${f.claims.regional66.primary}`)
 const traditions=await teacher.call('GET',`/schools/${A}/traditions`);expect(traditions.data.length).toBeGreaterThan(0)
 const tradition=track((await teacher.call('POST',`/schools/${A}/traditions`,{title:`FE012 ${f.runId} HTTP tradition ${randomUUID().slice(0,6)}`,description:'Own synthetic annual tradition.'},201)).data.id)
 const version=await teacher.call('POST',`/traditions/${tradition}/versions`,{academic_year:'2026-2027',parameters_snapshot:{duration_minutes:45},notes:'Synthetic annual version'},201);track(version.data.id)
 await teacher.call('POST',`/traditions/${tradition}/versions`,{academic_year:'2026-2027',parameters_snapshot:{duration_minutes:45}},422)
 await teacher.call('GET',`/traditions/${tradition}`);await phase('dashboard-calendar-sources-traditions')
 const source=f.sources.regional66,primary=f.claims.regional66.primary,sibling=f.claims.regional66.sibling
 await regional.call('POST',`/event-sources/${source}/reviews`,{decision:'approved',comments:'FE012 synthetic source review; not a real cultural attestation.'},201)
 const attach=(claimId:string,user=regional)=>user.call('POST',`/cultural-claims/${claimId}/evidence`,{event_source_id:source,citation_locator:'Chapter 12, page 66',citation_excerpt:'FE012 synthetic documentary evidence for isolated regression only.',applicable_academic_year:'2026-2027',verify:true,notes:'Synthetic test evidence.'},201)
 await attach(primary);await attach(sibling)
 await snapshot('verified')
 const claimBefore=(await regional.call('GET',`/cultural-claims/${primary}`)).data
 expect(claimBefore.evidence_records[0].effective_status).toBe('verified_authentic')
 // Two claims: observer ordering regression, real HTTP and persisted audit.
 await regional.call('PATCH',`/event-sources/${source}`,{author:`FE012 amended ${randomUUID()}`})
 for(const claimId of [primary,sibling]){const c=(await regional.call('GET',`/cultural-claims/${claimId}`)).data;expect(c.evidence_records.every((e:Json)=>e.effective_status==='unverified')).toBe(true);expect(c.evidence_audit_events.filter((e:Json)=>e.action==='invalidated_by_source_amendment')).toHaveLength(1)}
 await snapshot('amended');await regional.call('POST',`/event-sources/${source}/reviews`,{decision:'approved',comments:'Explicit reapproval does not reverify claims.'},201)
 expect((await regional.call('GET',`/cultural-claims/${primary}`)).data.evidence_records[0].effective_status).toBe('unverified');await attach(primary);await attach(sibling)
 // Concurrent identical PATCHs serialize: each still-verified claim gets one further audit, not two.
 const concurrencyAuthor=`FE012 concurrent ${randomUUID()}`
 await Promise.all([regional.call('PATCH',`/event-sources/${source}`,{author:concurrencyAuthor}),system.call('PATCH',`/event-sources/${source}`,{author:concurrencyAuthor})])
 for(const claimId of [primary,sibling])expect((await regional.call('GET',`/cultural-claims/${claimId}`)).data.evidence_audit_events.filter((e:Json)=>e.action==='invalidated_by_source_amendment')).toHaveLength(2)
 await regional.call('POST',`/event-sources/${source}/reviews`,{decision:'approved',comments:'Reapproval after concurrent amendment.'},201);await attach(primary);await attach(sibling)
 await phase('catalog-amendment-and-concurrency')
 const requests:Json={};const scenarios:Json={}
 for(const scale of ['class_level','all_school','family_community']){
  const req=(await teacher.call('POST','/scenario-requests',{calendar_event_id:f.events.regional66,scale,format_type:scale==='class_level'?'class_hour':'festival',target_grades:[5,6],participants_count:30,duration_minutes:scale==='class_level'?45:90,value_direction:scale==='family_community'?'family':'mutual_aid',family_involvement:scale==='family_community',available_resources:['Бумага','Проектор']},201)).data
  const requestId=track(req.id);requests[scale]=requestId;await teacher.call('GET',`/scenario-requests/${requestId}`)
  const key=randomUUID();const accepted=(await teacher.call('POST',`/scenario-requests/${requestId}/generate`,undefined,202,{'Idempotency-Key':key})).data;const runId=track(accepted.run_id??accepted.generation_run_id)
  let result:Json={};for(let attempt=0;attempt<100;attempt++){result=(await teacher.call('GET',`/generation-runs/${runId}`)).data;if(['completed','failed'].includes(result.status))break;await new Promise(r=>setTimeout(r,150))}
  expect(result.status,scale).toBe('completed');const scenario=track(result.scenario_id);scenarios[scale]=scenario
  const replay=(await teacher.call('POST',`/scenario-requests/${requestId}/generate`,undefined,202,{'Idempotency-Key':key})).data;expect(replay.run_id??replay.generation_run_id).toBe(runId)
  await teacher.call('GET',`/scenarios/${scenario}`);await phase(`generation-${scale}`)
 }
 evidence.requests=requests;evidence.scenarios=scenarios
 const scenario=scenarios.class_level;let revisionPath=`/scenarios/${scenario}/revisions/1`
 const doc=(await teacher.call('GET',revisionPath)).data;const lock=doc.optimistic_lock_version??1
 await teacher.call('PATCH',revisionPath,{concept:'FE012 stale optimistic request'},409,{'If-Match':'99999'})
 const changed=(await teacher.call('PATCH',revisionPath,{concept:'FE012 synthetic revised concept preserving the original cultural evidence and pedagogical structure.'},201,{'If-Match':String(lock)})).data
 evidence.editor=changed;revisionPath=`/scenarios/${scenario}/revisions/2`
 await teacher.call('GET',`/scenarios/${scenario}/revisions/1`);await teacher.call('GET',revisionPath)
 await teacher.call('POST',`${revisionPath}/verify`,undefined,202)
 let verification:Json={};for(let attempt=0;attempt<100;attempt++){verification=(await teacher.call('GET',`${revisionPath}/verifications`)).data;if(['passed','passed_with_warnings','blocked'].includes(verification.status))break;await new Promise(r=>setTimeout(r,150))}
 expect(['passed','passed_with_warnings']).toContain(verification.status)
 await teacher.call('POST',`${revisionPath}/signoff`,{checklist_confirmed:{safety_checked:true,timing_fit:true,cultural_context_approved:true},teacher_notes:'FE012 own synthetic final acceptance signoff.'})
 await phase('editor-moderation-signoff')
 const exports:Json[]=[];await mkdir(`${dir}/documents`,{recursive:true})
 for(const format of ['pdf','docx','pptx','print_pack_pdf']){
  const key=randomUUID(),accepted=(await teacher.call('POST',`${revisionPath}/exports`,{format},202,{'Idempotency-Key':key})).data;expect(accepted.status).toBe('queued');const job=track(accepted.id);const observed=new Set<string>(['queued'])
  let state:Json={};for(let attempt=0;attempt<150;attempt++){state=(await teacher.call('GET',`/export-jobs/${job}`)).data;observed.add(state.status);if(['ready','failed'].includes(state.status))break;await new Promise(r=>setTimeout(r,100))}
  expect(state.status).toBe('ready');expect([...observed]).toContain('processing')
  const downloaded=await teacher.call('GET',`/export-jobs/${job}/download`);expect(downloaded.binary.length).toBeGreaterThan(500)
  const extension=format==='print_pack_pdf'?'pdf':format;const filename=`fe012-${format}.${extension}`;await writeFile(`${dir}/documents/${filename}`,downloaded.binary)
  exports.push({format,id:job,observed:[...observed],bytes:downloaded.binary.length,sha256:createHash('sha256').update(downloaded.binary).digest('hex'),file:filename})
  const replay=(await teacher.call('POST',`${revisionPath}/exports`,{format},202,{'Idempotency-Key':key})).data;expect(replay.id).toBe(job)
  await phase(`async-export-${format}`)
 }
 evidence.exports=exports;await teacher.call('GET',`${revisionPath}/exports`);await snapshot('signed-exports')
 await teacher.call('GET','/scenarios?q=FE012&is_archived=all&sort=created_at:desc')
 await teacher.call('POST',`/scenarios/${scenario}/archive`);expect((await teacher.call('GET','/scenarios?is_archived=true')).data.some((s:Json)=>s.id===scenario)).toBe(true)
 await teacher.call('POST',`/scenarios/${scenario}/restore`)
 const disposable=scenarios.all_school;await teacher.call('DELETE',`/scenarios/${disposable}`);await teacher.call('GET',`/scenarios/${disposable}`,undefined,404)
 await other.call('GET',`/scenarios/${scenario}`,undefined,403)
 const pair=(await teacher.call('POST','/scenario-comparisons',{scenario_request_id:requests.class_level,comparison_type:'universal_vs_personalized',is_synthetic:true},201)).data;track(pair.id);for(const variant of pair.variants??[])if(variant.scenario_id)track(variant.scenario_id)
 await teacher.call('GET',`/scenario-comparisons/${pair.id}/variants`);await teacher.call('POST',`/scenario-comparisons/${pair.id}/selection`,{selected_variant:'B',selection_reason:'FE012 isolated pedagogical comparison preference.'});await teacher.call('POST',`/scenario-comparisons/${pair.id}/selection`,{selected_variant:'A',selection_reason:'Duplicate must be rejected.'},409)
 const cultural=(await teacher.call('POST','/scenario-comparisons',{scenario_request_id:requests.class_level,comparison_type:'cultural_context',is_synthetic:true},201)).data;track(cultural.id);expect(cultural.is_cultural_available).toBe(true)
 await teacher.call('GET','/scenario-comparisons');await phase('archive-and-ab')
 const invite=(await admin.call('POST','/pilot/participants',{subject_area:'FE012 synthetic test',teaching_experience_years:5,is_synthetic:true},201)).data;secrets.add(invite.invite_token);track(invite.id)
 const questionnaire={invite_token:invite.invite_token,scenario_id:pair.variants[0].scenario_id,comparison_id:absent,prep_time_baseline_minutes:100,prep_time_ai_minutes:35,personalization_selected:true,manual_edit_percentage:10,cultural_context_used:false,feedback_text:'FE012 synthetic questionnaire; not real pilot research.'}
 const publicCall=async(body:Json,status:number|number[])=>{const r=await fetch(`${origin}/api/v1/pilot/responses`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});const result=await r.json();trace.push({role:'anonymous',method:'POST',path:'/pilot/responses',status:r.status,request:redact(body),response:redact(result)});await save();expect(Array.isArray(status)?status:[status]).toContain(r.status);return {...result,httpStatus:r.status} as Json}
 await publicCall(questionnaire,422);expect((await admin.call('GET','/pilot/participants')).data.find((p:Json)=>p.id===invite.id).is_submitted).toBe(false)
 questionnaire.comparison_id=pair.id
 const concurrent=await Promise.all([publicCall(questionnaire,[201,409]),publicCall(questionnaire,[201,409])]);expect(concurrent.map(r=>r.httpStatus).sort()).toEqual([201,409]);const responseId=track(concurrent.find(r=>r.httpStatus===201)!.data.id);evidence.pilotResponseId=responseId
 await admin.call('GET',`/pilot/responses/${responseId}`);await teacher.call('GET',`/pilot/responses/${responseId}`,undefined,403)
 await regional.call('GET',`/pilot/responses/${responseId}/reviews`)
 for(const errors of [1,0])await regional.call('POST',`/pilot/responses/${responseId}/reviews`,{expert_audit_status:'audited',critical_cultural_errors:errors,methodological_remarks:`FE012 synthetic expert revision ${errors}`})
 const review=(await regional.call('GET',`/pilot/responses/${responseId}/reviews`)).data;expect(review.versions).toHaveLength(2);expect(review.effective_review.critical_cultural_errors).toBe(0)
 expect((await admin.call('GET','/pilot/participants')).data.find((p:Json)=>p.id===invite.id).response_id).toBe(responseId)
 await admin.call('GET','/pilot/metrics?scope=school&include_synthetic=1');await admin.call('GET','/pilot/export?scope=school&include_synthetic=1');await regional.call('GET','/pilot/metrics?scope=global',undefined,403)
 await phase('pilot-token-concurrency-reviews-kpi')
 await teacher.call('PATCH',`/schools/${A}`,{city:'Forbidden'},403);await admin.call('PATCH',`/schools/${A}`,{name:'x'},422);await admin.call('PATCH',`/schools/${A}`,{short_name:'FE012 accepted profile',settings:{description:'FE012 synthetic administration'}});await system.call('GET',`/schools/${C}`);await system.call('GET','/system/status')
 // Simultaneous detach: one accepted transition, one definitive 404, one audit per record.
 const detached=await Promise.all([regional.call('DELETE',`/cultural-claims/${primary}/evidence/${source}`,{reason:'FE012 concurrent detach'},[200,404]),system.call('DELETE',`/cultural-claims/${primary}/evidence/${source}`,{reason:'FE012 concurrent detach'},[200,404])]);expect(detached.map(r=>r.httpStatus).sort()).toEqual([200,404])
 expect((await regional.call('GET',`/cultural-claims/${primary}`)).data.evidence_audit_events.filter((a:Json)=>a.action==='detached')).toHaveLength(1)
 for(const item of exports)await teacher.call('GET',`/export-jobs/${item.id}/download`,undefined,403)
 await teacher.call('POST',`${revisionPath}/exports`,{format:'docx'},403,{'Idempotency-Key':randomUUID()})
 expect((await teacher.call('GET',`/scenario-comparisons/${cultural.id}`)).data.is_cultural_available).toBe(false)
 await teacher.call('POST',`/scenario-comparisons/${cultural.id}/selection`,{selected_variant:'B',selection_reason:'Revoked cultural B must not be selected.'},409)
 evidence.ui={scenarioId:scenario,revisionVersion:2,sourceId:source,claimId:primary,siblingClaimId:sibling,comparisonId:pair.id,culturalComparisonId:cultural.id,pilotResponseId:responseId,traditionId:tradition}
 await snapshot('after');await teacher.call('POST','/auth/logout',undefined,204);await teacher.call('GET','/auth/me',undefined,401)
 await phase('school-catalog-live-revocation-logout');evidence.completed=true;evidence.responses=trace.length
 await writeFile(`${dir}/ui-bootstrap.json`,JSON.stringify(redact({...f,completed:true,ui:evidence.ui,requests,scenarios}),null,2));await save()
},900000)
