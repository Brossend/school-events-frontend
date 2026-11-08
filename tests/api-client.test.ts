import { describe, expect, it, vi } from 'vitest'
import { createApiClient, readXsrf } from '../app/utils/api-client'
import { toApiError } from '../app/utils/api-error'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const credentials = { email: 'teacher@example.org', password: 'test-password' }

describe('Sanctum API transport', () => {
  it('encodes typed path and query parameters without forwarding UI state', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ data: [] }))
    const client = createApiClient({ origin: 'http://localhost:8000', getSchoolId: () => 'A', getCookie: () => '', fetch })
    await client.request('get', '/calendar-events', { query: { q: 'День & школа', type: 'regional', page: 2, per_page: 12 } })
    const url = new URL(String(fetch.mock.calls[0]![0]))
    expect(url.searchParams.get('q')).toBe('День & школа')
    expect(url.searchParams.get('page')).toBe('2')
    await client.request('get', '/calendar-events/{id}', { params: { id: 'id/with slash' } })
    expect(String(fetch.mock.calls[1]![0])).toContain('/calendar-events/id%2Fwith%20slash')
  })

  it('does not emit global errors for aborted or obsolete school requests', async () => {
    let school = 'A'
    const onError = vi.fn(), onUnauthorized = vi.fn()
    let resolve!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise<Response>(r => { resolve = r }))
    const client = createApiClient({ origin: '', getSchoolId: () => school, getCookie: () => '', fetch, onError, onUnauthorized })
    const controller = new AbortController()
    const old = client.request('get', '/dashboard/summary', { signal: controller.signal })
    controller.abort(); school = 'B'; resolve(json({}, 401))
    await expect(old).rejects.toMatchObject({ name: 'AbortError' })
    expect(onError).not.toHaveBeenCalled()
    expect(onUnauthorized).not.toHaveBeenCalled()
    const obsolete = client.request('get', '/dashboard/summary', {})
    school = 'C'; resolve(json({}, 403))
    await expect(obsolete).rejects.toMatchObject({ status: 403 })
    expect(onError).not.toHaveBeenCalled()
  })

  it('initializes CSRF and sends decoded XSRF cookie with credentials; login has no tenant body/header', async () => {
    let cookie = ''
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async url => {
      if (String(url).endsWith('/sanctum/csrf-cookie')) { cookie = 'XSRF-TOKEN=token%3D'; return new Response(null, { status: 204 }) }
      return json({ data: {} })
    })
    const client = createApiClient({ origin: 'http://localhost:8000/', getSchoolId: () => 'school-1', getCookie: () => cookie, fetch })
    await client.request('post', '/auth/login', { body: credentials, tenant: false })
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = fetch.mock.calls[1]!
    expect(url).toBe('http://localhost:8000/api/v1/auth/login')
    expect(options?.credentials).toBe('include')
    expect(new Headers(options?.headers).get('X-XSRF-TOKEN')).toBe('token=')
    expect(new Headers(options?.headers).has('X-School-Id')).toBe(false)
    expect(JSON.parse(options?.body as string)).toEqual(credentials)
  })

  it('refreshes CSRF exactly once for 419 and retries with the new token', async () => {
    let cookie = 'XSRF-TOKEN=old'
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({}, 419))
      .mockImplementationOnce(async () => { cookie = 'XSRF-TOKEN=new'; return new Response(null, { status: 204 }) })
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => cookie, fetch })
    await client.request('post', '/auth/logout', {})
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(new Headers(fetch.mock.calls[2]![1]?.headers).get('X-XSRF-TOKEN')).toBe('new')
  })

  it('does not loop when the retried request still returns 419', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async url => String(url).includes('csrf-cookie') ? new Response(null, { status: 204 }) : json({}, 419))
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => 'XSRF-TOKEN=t', fetch })
    await expect(client.request('post', '/auth/logout', {})).rejects.toMatchObject({ status: 419 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('adds explicit school context in the header and never writes it to the body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ data: {} }))
    const client = createApiClient({ origin: '', getSchoolId: () => 'default-school', getCookie: () => '', fetch })
    await client.request('get', '/tenant/current', { schoolId: 'chosen-school' })
    const options = fetch.mock.calls[0]![1]!
    expect(new Headers(options.headers).get('X-School-Id')).toBe('chosen-school')
    expect(options.body).toBeUndefined()
  })

  it('invalidates the session on 401', async () => {
    const onUnauthorized = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({}, 401))
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => '', fetch, onUnauthorized })
    await expect(client.request('get', '/auth/me', {})).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('deduplicates concurrent CSRF initialization', async () => {
    let cookie = ''
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async url => {
      if (String(url).includes('csrf-cookie')) { await Promise.resolve(); cookie = 'XSRF-TOKEN=t'; return new Response(null, { status: 204 }) }
      return new Response(null, { status: 204 })
    })
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => cookie, fetch })
    await Promise.all([client.request('post', '/auth/logout', {}), client.request('post', '/auth/logout', {})])
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('csrf-cookie'))).toHaveLength(1)
  })

  it('does not retry 5xx mutations and hides internal server messages', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json({ error: { message: 'SQL internal details' } }, 500))
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => 'XSRF-TOKEN=t', fetch })
    await expect(client.request('post', '/auth/logout', {})).rejects.toMatchObject({ status: 500, message: 'Сервис временно недоступен. Попробуйте позже.' })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('normalizes network failures', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createApiClient({ origin: '', getSchoolId: () => undefined, getCookie: () => '', fetch })
    await expect(client.request('get', '/auth/me', {})).rejects.toMatchObject({ status: 0 })
  })
})

describe('errors and cookies', () => {
  it('maps contract validation issues and trace id', () => {
    const error = toApiError(422, { error: { code: 'VALIDATION_FAILED', message: 'Ошибка', details: [{ field: 'email', message: 'Неверная почта' }], trace_id: 'trace-1' } })
    expect(error.field('email')).toBe('Неверная почта')
    expect(error.traceId).toBe('trace-1')
  })
  it('maps Laravel validation before controllers', () => {
    expect(toApiError(422, { errors: { email: ['Email is required'] } }).field('email')).toBe('Email is required')
  })
  it.each([403, 409, 429, 503])('provides a useful default message for %s', status => {
    expect(toApiError(status, '<html>not JSON</html>').message.length).toBeGreaterThan(20)
  })
  it('only decodes the exact cookie and tolerates malformed encodings', () => {
    expect(readXsrf('OTHER-XSRF-TOKEN=x; XSRF-TOKEN=abc%3D; session=private')).toBe('abc=')
    expect(readXsrf('XSRF-TOKEN=%broken')).toBeUndefined()
  })
})
