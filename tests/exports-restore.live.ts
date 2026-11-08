import { it, expect } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { createApiClient } from '../app/utils/api-client'
const active=process.env.FE008_RESTORE==='1'
it.skipIf(!active)('restores own FE008 browser fixture verification and signoff after source reattachment',async()=>{
 const f=JSON.parse(await readFile('docs/fe008/evidence/test-fixtures.json','utf8')),b=JSON.parse(await readFile('docs/fe008/evidence/browser-scenario.json','utf8'))
 expect(f.database).toBe('school_events_test');const origin='http://localhost:8001',cookies=new Map<string,string>(),requests:Record<string,unknown>[]=[]
 const api=createApiClient({origin,getSchoolId:()=>b.school,getCookie:()=>[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),fetch:async(input,init)=>{const headers=new Headers(init?.headers);headers.set('Origin','http://localhost:3000');headers.set('Referer','http://localhost:3000/');headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));const r=await fetch(input,{...init,headers});for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0]!,i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1))}requests.push({path:new URL(String(input)).pathname,status:r.status});return r}})
 const env=await readFile('C:/Users/bross/WebstormProjects/school/.env.testing','utf8'),key=env.match(/^APP_KEY=(.+)$/m)![1]!.trim().replace(/^['"]|['"]$/g,''),password=createHmac('sha256',key).update(`FE008:${f.runId}`).digest('hex')
 await api.request('post','/auth/login',{tenant:false,body:{email:f.users.multi.email,password}})
 const params={id:b.id,version:b.version};await api.request('post','/scenarios/{id}/revisions/{version}/verify',{params});await api.request('post','/scenarios/{id}/revisions/{version}/signoff',{params,body:{checklist_confirmed:{safety_checked:true,timing_fit:true,cultural_context_approved:true},teacher_notes:'Восстановление синтетического browser fixture FE008.'}})
 await api.request('post','/auth/logout',{tenant:false});await writeFile('docs/fe008/evidence/browser-fixture-restored.json',JSON.stringify({origin,requests,completed:true},null,2))
},180000)
