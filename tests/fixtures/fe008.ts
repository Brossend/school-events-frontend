import { editorDoc, verification, authorId } from './fe007'
import { ids } from './fe006'
import type { ExportContext, ExportEntry, ExportFormat, ExportJobState, ExportSnapshot } from '../../app/types/exports'
import { formatInfo } from '../../app/utils/export-data'
export const exportIds={pdf:'00000000-0000-4000-8000-000000000801',docx:'00000000-0000-4000-8000-000000000802',pptx:'00000000-0000-4000-8000-000000000803',print_pack_pdf:'00000000-0000-4000-8000-000000000804'}
export function exportContext():ExportContext{return {user:authorId,school:ids.school,scenario:ids.scenario,revision:ids.revision,version:1}}
export function exportEntry(format:ExportFormat='pdf'):ExportEntry{return {id:exportIds[format],revision_id:ids.revision,format,status:'ready',is_downloadable:true,created_at:'2026-10-27T08:00:00Z',completed_at:'2026-10-27T08:00:02Z',artifact:{id:ids.key,file_name:`scenario-${format}.${formatInfo[format].extension}`,file_size_bytes:12500,mime_type:formatInfo[format].mime,sha256_hash:'a'.repeat(64),expires_at:null}}}
export function exportJob(status:ExportJobState['status']='queued'):ExportJobState{return {id:exportIds.pdf,status,file_name:status==='ready'?'scenario.pdf':null,file_size_bytes:status==='ready'?12500:null,error_message:status==='failed'?'Тестовая ошибка формирования документа':null,created_at:'2026-10-27T08:00:00Z',completed_at:null}}
export function exportSnapshot():ExportSnapshot{const document=editorDoc();document.revision.moderation_status='verification_passed';document.scenario.moderation_status='verification_passed';document.signoff={id:ids.key,confirmed_at:'2026-10-27',teacher_notes:'Синтетический fixture',is_confirmed:true,user:{id:authorId,name:'Тестовый педагог'}};return {document,verification:verification(),history:[exportEntry()]}}
