import type { components, paths } from './openapi'
export type RegistryListResponse = components['schemas']['ScenarioListResponse']
export type RegistryEntry = Omit<RegistryListResponse['data'][number], 'current_revision' | 'created_at' | 'updated_at'> & { created_at: string | null; updated_at: string | null; current_revision: { id: string; version_number: number; moderation_status: string; change_description: string | null } | null }
export interface RegistryPage { data: RegistryEntry[]; meta: components['schemas']['PaginationMeta'] }
export type RegistryAction = 'archive' | 'restore' | 'delete'
export type RegistryView = 'active' | 'draft' | 'completed' | 'archived'
export interface RegistryQuery { page: number; per_page: number; q: string; view: RegistryView; sort: 'created_at:desc' | 'created_at:asc' | 'updated_at:desc' | 'title:asc' }
export interface RegistryContext { user: string; school: string; role: string; authenticated: boolean }
export interface RegistryDetail { id: string; school_id: string; title: string; is_archived: boolean; hasCurrentSignoff: boolean }
export interface RegistryServices { list(query: RegistryQuery, signal: AbortSignal): Promise<RegistryPage>; detail(id: string, signal: AbortSignal): Promise<RegistryDetail>; mutate(id: string, action: RegistryAction, signal: AbortSignal): Promise<void> }
export interface RegistryMarker { id: string; action: RegistryAction; user: string; school: string; sentAt: number }
export interface RegistryDialog { id: string; title: string; action: RegistryAction; phase: 'checking' | 'confirm' | 'sending' | 'uncertain' | 'reconciled' | 'done' | 'blocked' | 'error'; message: string; error?: Error; canPrepareAgain?: boolean }
export interface RegistryOperationOverrides { '/scenarios': { get: Omit<NonNullable<paths['/scenarios']['get']>, 'parameters'> & { parameters: { query?: { page?: number; per_page?: number; q?: string; is_archived?: 'true' | 'false' | 'all'; status?: 'draft' | 'completed'; sort?: RegistryQuery['sort'] } } } } }
