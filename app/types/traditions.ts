import type { operations } from './openapi'
export type TraditionFilter = 'false' | 'true' | 'all'
export interface AnnualVersion { id: string; academic_year: string; notes: string | null; created_at: string | null; parameters_snapshot?: Record<string, unknown> | unknown[] }
export interface TraditionItem { id: string; title: string; description: string; established_year: number | null; is_archived: boolean; active_version: AnnualVersion | null; versions: AnnualVersion[] }
export interface TraditionDetail extends TraditionItem { school_id: string; created_by_user_id: string | null; created_at: string | null; updated_at: string | null }
export interface TraditionInput { title: string; description: string; established_year: number | null }
export interface AnnualInput { academic_year: string; parameters_snapshot: Record<string, unknown>; notes: string | null }

// Narrow, documented corrections to the existing controller contract. Generated OpenAPI is unchanged.
type JsonResponse<T> = { content: { 'application/json': T } }
export interface TraditionOperationOverrides {
  '/schools/{schoolId}/traditions': {
    get: Omit<operations['listSchoolTraditions'], 'parameters'> & { parameters: { path: { schoolId: string }; query?: { is_archived?: TraditionFilter } } }
    post: Omit<operations['createSchoolTradition'], 'responses'> & { responses: { 201: JsonResponse<{ data: { id: string; title: string; description: string; established_year: number | null } }> } }
  }
  '/traditions/{id}/versions': {
    post: Omit<operations['createTraditionVersion'], 'requestBody' | 'responses'> & { requestBody: { content: { 'application/json': AnnualInput } }; responses: { 201: JsonResponse<{ data: AnnualVersion & { tradition_id: string } }> } }
  }
}
