import type { paths } from '../types/openapi'
import type { SchoolOperationOverrides } from '../types/school'
import type { CatalogAdminOperationOverrides } from '../types/catalog-admin'
import type { PilotOperationOverrides } from '../types/pilot'
import type { ComparisonOperationOverrides } from '../types/comparisons'
import type { RegistryOperationOverrides } from '../types/registry'
import type { TraditionOperationOverrides } from '../types/traditions'
import type { EditorOperationOverrides } from '../types/editor'
import type { ExportOperationOverrides, ExportFormat } from '../types/exports'
import { exportDownloadPath, readExportBinary } from './export-download'
import { ApiError, toApiError } from './api-error'

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put'
type ApiPath<M extends Method> = { [P in keyof paths]: M extends keyof paths[P] ? NonNullable<paths[P][M]> extends never ? never : P : never }[keyof paths]
type GeneratedOperation<P extends keyof paths, M extends Method> = M extends keyof paths[P] ? NonNullable<paths[P][M]> : never
type LocalOverrides = SchoolOperationOverrides & CatalogAdminOperationOverrides & PilotOperationOverrides & ComparisonOperationOverrides & RegistryOperationOverrides & ExportOperationOverrides & EditorOperationOverrides & TraditionOperationOverrides
type Operation<P extends keyof paths, M extends Method> = P extends keyof LocalOverrides ? M extends keyof LocalOverrides[P] ? LocalOverrides[P][M] : GeneratedOperation<P, M> : GeneratedOperation<P, M>

type Json<T> = T extends { content: { 'application/json': infer J } } ? J : never
type ResponseOf<O> = O extends { responses: infer R } ? { [S in keyof R]: S extends 200 | 201 | 202 ? Json<R[S]> : S extends 204 ? undefined : never }[keyof R] : never
type BodyOf<O> = O extends { requestBody: infer B } ? Json<B> : never
type BodyOptions<O> = [BodyOf<O>] extends [never] ? { body?: never } : { body: BodyOf<O> }
type ParametersOf<O> = O extends { parameters: infer Q } ? Q : never
type QueryOf<O> = ParametersOf<O> extends { query?: infer Q } ? NonNullable<Q> : never
type PathOf<O> = ParametersOf<O> extends { path: infer P } ? P : never
type ParameterOptions<O> = { query?: QueryOf<O> } & ([PathOf<O>] extends [never] ? { params?: never } : { params: PathOf<O> })

interface ClientConfig {
  origin: string
  getSchoolId: () => string | undefined
  getCookie: () => string
  fetch?: typeof globalThis.fetch
  onUnauthorized?: () => void
  onError?: (error: ApiError) => void
}
interface RequestOptions { schoolId?: string; tenant?: boolean; signal?: AbortSignal; headers?: Record<string, string>; reportError?: boolean }

export function readXsrf(cookie: string): string | undefined {
  const value = cookie.split(';').map(item => item.trim()).find(item => item.startsWith('XSRF-TOKEN='))?.slice(11)
  try { return value ? decodeURIComponent(value) : undefined } catch { return undefined }
}

export function createApiClient(config: ClientConfig) {
  const origin = config.origin.replace(/\/$/, '')
  const transport = config.fetch ?? globalThis.fetch.bind(globalThis)
  let csrfPending: Promise<void> | undefined

  async function csrf() {
    csrfPending ??= (async () => {
      try {
        const response = await transport(`${origin}/sanctum/csrf-cookie`, { credentials: 'include', headers: { Accept: 'application/json' } })
        if (!response.ok) throw toApiError(response.status, await response.json().catch(() => null))
      } catch (error) { throw error instanceof ApiError ? error : toApiError(0, null) }
    })().finally(() => { csrfPending = undefined })
    return csrfPending
  }

  async function request<M extends Method, P extends ApiPath<M>>(
    method: M, path: P, options: RequestOptions & BodyOptions<Operation<P, M>> & ParameterOptions<Operation<P, M>>,
  ): Promise<ResponseOf<Operation<P, M>>> {
    const mutate = method !== 'get'
    const schoolId = options.schoolId ?? config.getSchoolId()
    const contextAtStart = config.getSchoolId()
    const ensureActive = () => { if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError') }
    try {
      ensureActive()
      let resourcePath = String(path).replace(/\{([^}]+)\}/g, (_, key: string) => {
        const value = (options.params as Record<string, unknown> | undefined)?.[key]
        if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`Missing path parameter: ${key}`)
        return encodeURIComponent(String(value))
      })
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
      }
      if (query.size) resourcePath += `?${query.toString()}`
      if (mutate && !readXsrf(config.getCookie())) await csrf()
      for (let attempt = 0; attempt < 2; attempt++) {
        ensureActive()
        const headers = new Headers(options.headers)
        headers.set('Accept', 'application/json')
        if (options.tenant !== false && schoolId) headers.set('X-School-Id', schoolId)
        const token = readXsrf(config.getCookie())
        if (mutate && token) headers.set('X-XSRF-TOKEN', token)
        if (options.body !== undefined) headers.set('Content-Type', 'application/json')
        const response = await transport(`${origin}/api/v1${resourcePath}`, {
          method: method.toUpperCase(), credentials: 'include', headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal,
        })
        ensureActive()
        if (response.status === 419 && attempt === 0) { await csrf(); continue }
        const payload: unknown = response.status === 204 ? undefined : await response.json().catch(() => null)
        if (!response.ok) throw toApiError(response.status, payload)
        return payload as ResponseOf<Operation<P, M>>
      }
      throw toApiError(419, null)
    } catch (cause) {
      ensureActive()
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      const error = cause instanceof ApiError ? cause : toApiError(0, null)
      const current = options.tenant === false || contextAtStart === config.getSchoolId()
      if (current && error.status === 401) config.onUnauthorized?.()
      else if (current && options.reportError !== false && error.status !== 422 && error.status !== 429) config.onError?.(error)
      throw error
    }
  }
  async function downloadExport(id: string, format: ExportFormat, options: { schoolId: string; signal: AbortSignal; checksum?: string }) {
    const contextAtStart = config.getSchoolId(), ensureActive = () => { if (options.signal.aborted || contextAtStart !== config.getSchoolId()) throw new DOMException('Aborted', 'AbortError') }
    try { ensureActive(); const response = await transport(`${origin}${exportDownloadPath(id)}`, { method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation', 'X-School-Id': options.schoolId }, signal: options.signal }); ensureActive(); const result = await readExportBinary(response, id, format, options.signal, options.checksum); ensureActive(); return result }
    catch (cause) { ensureActive(); if (cause instanceof DOMException && cause.name === 'AbortError') throw cause; const error = cause instanceof ApiError ? cause : cause instanceof Error ? new ApiError(0, 'EXPORT_DOWNLOAD_ERROR', cause.message) : toApiError(0, null); if (error.status === 401) config.onUnauthorized?.(); throw error }
  }
  return { request, csrf, downloadExport }
}

export type ApiClient = ReturnType<typeof createApiClient>
