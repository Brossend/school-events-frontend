import type { RegistryContext, RegistryServices } from '~/types/registry'
import { parseRegistryDetail, parseRegistryPage, registryQuery } from '~/utils/registry'
import { ApiError } from '~/utils/api-error'
export function useRegistryApi(): RegistryServices {
 const api=useApi(),auth=useAuthStore()
 const current=():RegistryContext=>({user:auth.user?.id??'',school:auth.tenant?.school_id??'',role:auth.tenant?.role??'',authenticated:auth.authenticated})
 function capture(signal:AbortSignal){const c=current();if(signal.aborted)throw new DOMException('Aborted','AbortError');if(!c.authenticated||!c.school)throw new ApiError(403,'REGISTRY_SCHOOL_REQUIRED','Выберите активную школу.');return c}
 function active(c:RegistryContext,signal:AbortSignal){if(signal.aborted||JSON.stringify(c)!==JSON.stringify(current()))throw new DOMException('Aborted','AbortError')}
 return {
  async list(query,signal){const c=capture(signal),result=await api.request('get','/scenarios',{query:registryQuery(query),schoolId:c.school,signal,reportError:false});active(c,signal);return parseRegistryPage(result)},
  async detail(id,signal){const c=capture(signal),result=await api.request('get','/scenarios/{id}',{params:{id},schoolId:c.school,signal,reportError:false});active(c,signal);return parseRegistryDetail(result,c.school,id)},
  async mutate(id,action,signal){const c=capture(signal);if(!['teacher','school_admin'].includes(c.role))throw new ApiError(403,'REGISTRY_ROLE_REQUIRED','Для действия нужны школьные полномочия.');if(action==='delete')await api.request('delete','/scenarios/{id}',{params:{id},schoolId:c.school,signal,reportError:false});else await api.request('post',action==='archive'?'/scenarios/{id}/archive':'/scenarios/{id}/restore',{params:{id},schoolId:c.school,signal,reportError:false});active(c,signal)}
 }
}
