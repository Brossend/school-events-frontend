import type { EditorDocument, Verification } from '../../app/types/editor'
import { scenario, ids } from './fe006'
export const authorId='00000000-0000-4000-8000-000000000701'
export function editorDoc(): EditorDocument { const s=scenario(); return {scenario:s,revision:s.revision!,lock:7,authorId,signoff:null,archived:false} }
export function verification(status: Verification['status']='passed'): Verification { return {id:ids.run,status,p0:status==='blocked'?1:0,p1:status==='passed_with_warnings'?1:0,findings:status==='blocked'||status==='passed_with_warnings'?[{id:ids.key,severity:status==='blocked'?'P0':'P1',rule_code:'FIXTURE_RULE',target_path:'materials.printable_cards.0.front_text',message:'Изолированное тестовое замечание',suggested_fix:'Перечитайте первоисточник.'}]:[]} }
