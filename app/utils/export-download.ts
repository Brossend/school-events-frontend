import type { ExportBinary, ExportFormat } from '../types/exports'
import { formatInfo } from './export-data'
import { ApiError, toApiError } from './api-error'
import { uuid } from './generation'
export function safeExportFilename(disposition: string | null, id: string, format: ExportFormat): string {
  const fallback = `school-events-${id}-${format}`, extension = formatInfo[format].extension
  let name = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? disposition?.match(/filename="([^"]*)"/i)?.[1] ?? disposition?.match(/filename=([^;]+)/i)?.[1] ?? fallback
  try { name = decodeURIComponent(name) } catch { name = fallback }
  // Deliberately remove control characters from server-supplied filenames.
  // eslint-disable-next-line no-control-regex
  name = name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+|[. ]+$/g, '').replace(/\.[^.]*$/, '').trim().slice(0, 150)
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = fallback
  return `${name}.${extension}`
}
export async function readExportBinary(response: Response, id: string, format: ExportFormat, signal?: AbortSignal, checksum?: string): Promise<ExportBinary> {
  const active = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError') }
  active()
  if (!response.ok) throw toApiError(response.status, await response.json().catch(() => null))
  const expected = formatInfo[format].mime, mime = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
  if (mime !== expected) throw new ApiError(0, 'EXPORT_MIME_MISMATCH', 'Сервер вернул неожиданный тип документа. Скачивание остановлено.')
  const declared = Number(response.headers.get('Content-Length') ?? 0), max = 128 * 1024 * 1024
  if (declared > max) throw new Error('Файл превышает поддерживаемый размер 128 МБ.')
  const bytes = await response.arrayBuffer(); active()
  if (bytes.byteLength === 0 || bytes.byteLength > max) throw new Error('Сервер вернул пустой или слишком большой документ.')
  const head = new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength)), pdf = format === 'pdf' || format === 'print_pack_pdf'
  if (pdf ? String.fromCharCode(...head) !== '%PDF-' : head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 3 || head[3] !== 4) throw new Error('Содержимое ответа не соответствует формату документа.')
  if (checksum) { if (!/^[a-f0-9]{64}$/i.test(checksum)) throw new Error('Некорректная контрольная сумма.'); const digest = await crypto.subtle.digest('SHA-256', bytes); active(); const actual = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join(''); if (actual !== checksum.toLowerCase()) throw new Error('Контрольная сумма документа не совпала. Скачивание остановлено.') }
  return { blob: new Blob([bytes], { type: expected }), filename: safeExportFilename(response.headers.get('Content-Disposition'), id, format), mime: expected, bytes: bytes.byteLength }
}
export function createExportBlobSaver() {
  const cleanups = new Set<() => void>()
  function save(file: ExportBinary, signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); const url = URL.createObjectURL(file.blob), anchor = document.createElement('a'); let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { if (timer) clearTimeout(timer); anchor.remove(); URL.revokeObjectURL(url); signal?.removeEventListener('abort', cleanup); cleanups.delete(cleanup) }
    cleanups.add(cleanup); signal?.addEventListener('abort', cleanup, { once: true }); anchor.href = url; anchor.download = file.filename; anchor.hidden = true; document.body.appendChild(anchor)
    try { anchor.click(); timer = setTimeout(cleanup, 1000) } catch (e) { cleanup(); throw e }
  }
  return { save, clear: () => { for (const cleanup of [...cleanups]) cleanup() } }
}
export function exportDownloadPath(id: string) { return `/api/v1/export-jobs/${uuid(id)}/download` }
