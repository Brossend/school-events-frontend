import type { JsonValue, ScenarioResult, ScenarioRevision } from './generation'
import type { paths, components } from './openapi'
type WithBody<T, B> = Omit<T, 'requestBody'> & { requestBody: { content: { 'application/json': B } } }
export interface EditorOperationOverrides {
  '/scenarios/{id}/revisions/{version}': { patch: WithBody<NonNullable<paths['/scenarios/{id}/revisions/{version}']['patch']>, RevisionPatch> };
  '/scenarios/{id}/revisions/{version}/signoff': { post: WithBody<NonNullable<paths['/scenarios/{id}/revisions/{version}/signoff']['post']>, components['schemas']['TeacherSignoffRequest'] & { warnings_acknowledged?: boolean }> };
}
export interface RevisionPatch { concept: string; pedagogical_goal: string; pedagogical_tasks: Record<string, JsonValue>; stages: Record<string, JsonValue>[]; materials: Record<string, JsonValue> }
export interface HistoricalSignoff { id: string; confirmed_at: string | null; teacher_notes: string | null; is_confirmed: boolean; user: { id: string; name: string } | null }
export interface EditorDocument { scenario: ScenarioResult; revision: ScenarioRevision; lock: number; authorId: string; signoff: HistoricalSignoff | null; archived: boolean }
export interface Verification { id: string | null; status: 'pending_verification' | 'running' | 'passed' | 'passed_with_warnings' | 'blocked' | 'failed_engine'; p0: number; p1: number; findings: { id: string; severity: 'P0' | 'P1'; rule_code: string; target_path: string; message: string; suggested_fix: string | null }[] }
export interface TeacherChecklist { safety_checked: boolean; timing_fit: boolean; cultural_context_approved: boolean; warnings_acknowledged: boolean; teacher_notes: string }
export interface EditorContext { user: string; school: string; scenario: string; role: string }
export interface EditorServices {
  load(signal: AbortSignal): Promise<EditorDocument>;
  revision(version: number, signal: AbortSignal): Promise<EditorDocument>;
  checks(version: number, signal: AbortSignal): Promise<Verification>;
  patch(doc: EditorDocument, body: RevisionPatch, signal: AbortSignal): Promise<unknown>;
  verify(doc: EditorDocument, signal: AbortSignal): Promise<string>;
  signoff(doc: EditorDocument, body: TeacherChecklist, signal: AbortSignal): Promise<unknown>;
}
