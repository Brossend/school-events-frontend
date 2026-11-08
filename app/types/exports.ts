import type { paths } from './openapi'
import type { EditorDocument, Verification } from './editor'
export const exportFormats = ['pdf', 'docx', 'pptx', 'print_pack_pdf'] as const
export type ExportFormat = typeof exportFormats[number]
export type ExportStatus = 'queued' | 'processing' | 'ready' | 'failed'
export interface ExportJobState { id: string; status: ExportStatus; file_name: string | null; file_size_bytes: number | null; error_message: string | null; created_at: string | null; completed_at: string | null }
export interface ExportEntry { id: string; revision_id: string; format: ExportFormat; status: ExportStatus; is_downloadable: boolean; created_at: string | null; completed_at: string | null; artifact: { id: string; file_name: string; file_size_bytes: number; mime_type: string; sha256_hash: string; expires_at: string | null } | null }
export interface ExportReceipt { key: string; createdAt: number; phase: 'sending' | 'uncertain' | 'accepted' | 'rejected'; jobId?: string }
export interface ExportContext { user: string; school: string; scenario: string; revision: string; version: number }
export interface ExportSnapshot { document: EditorDocument; verification: Verification; history: ExportEntry[] }
export interface ExportBinary { blob: Blob; filename: string; mime: string; bytes: number }
export interface ExportServices { snapshot(signal: AbortSignal): Promise<ExportSnapshot>; history(signal: AbortSignal): Promise<ExportEntry[]>; job(id: string, signal: AbortSignal): Promise<ExportJobState>; create(format: ExportFormat, key: string, signal: AbortSignal): Promise<string>; download(entry: ExportEntry, signal: AbortSignal): Promise<ExportBinary> }
export interface ExportOperationOverrides { '/scenarios/{id}/revisions/{version}/exports': { post: Omit<NonNullable<paths['/scenarios/{id}/revisions/{version}/exports']['post']>, 'responses'> & { responses: { 202: { content: { 'application/json': { data: { id: string; status: ExportStatus; file_name?: string | null; file_size_bytes?: number | null; download_url?: string | null } } } } } } } }
