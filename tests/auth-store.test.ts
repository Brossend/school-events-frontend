import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../app/stores/auth'
import { ApiError } from '../app/utils/api-error'

const request = vi.fn()
const navigateTo = vi.fn()
const profile = (multiple = false) => ({ data: {
  user: { id: 'u1', name: 'Анна', email: 'anna@example.org', system_role: 'none' },
  schools: [
    { school_id: 's1', name: 'Школа 1', role: 'teacher', is_default: !multiple },
    ...(multiple ? [{ school_id: 's2', name: 'Школа 2', role: 'school_admin', is_default: false }] : []),
  ],
} })

beforeEach(() => {
  request.mockReset()
  navigateTo.mockReset()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useNuxtApp', () => ({ $api: { request } }))
  vi.stubGlobal('navigateTo', navigateTo)
  setActivePinia(createPinia())
})

describe('session lifecycle', () => {
  it('commits only the latest rapid school selection', async () => {
    request.mockResolvedValueOnce(profile(true))
    const auth = useAuthStore(); await auth.initialize()
    let first!: (value: unknown) => void, second!: (value: unknown) => void
    request.mockImplementationOnce(() => new Promise(r => { first = r })).mockImplementationOnce(() => new Promise(r => { second = r }))
    const a = auth.selectSchool('s1'), b = auth.selectSchool('s2')
    second({ data: { school_id: 's2', school_name: 'Школа 2', role: 'school_admin' } }); await b
    first({ data: { school_id: 's1', school_name: 'Школа 1', role: 'teacher' } }); await a
    expect(auth.tenant?.school_id).toBe('s2')
    expect(auth.busy).toBe(false)
  })

  it('does not restore school or busy state after the session is cleared', async () => {
    request.mockResolvedValueOnce(profile(true))
    const auth = useAuthStore(); await auth.initialize()
    let resolve!: (value: unknown) => void
    request.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const call = auth.selectSchool('s1'); auth.clear()
    resolve({ data: { school_id: 's1', school_name: 'Школа 1', role: 'teacher' } }); await call
    expect(auth.tenant).toBeNull()
    expect(auth.busy).toBe(false)
  })

  it('bootstraps only once, with backend-confirmed default tenant', async () => {
    request.mockResolvedValueOnce(profile()).mockResolvedValueOnce({ data: { school_id: 's1', school_name: 'Школа 1', role: 'teacher' } })
    const auth = useAuthStore()
    await Promise.all([auth.initialize(), auth.initialize()])
    await auth.initialize()
    expect(request).toHaveBeenCalledTimes(2)
    expect(auth.authenticated).toBe(true)
    expect(auth.tenant?.school_id).toBe('s1')
    expect(auth.busy).toBe(false)
  })

  it('requires explicit selection when several schools have no default', async () => {
    request.mockResolvedValueOnce(profile(true))
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.needsSchool).toBe(true)
    expect(auth.tenant).toBeNull()
    expect(request).toHaveBeenCalledOnce()
  })

  it('cannot select a school outside the session memberships', async () => {
    request.mockResolvedValueOnce(profile(true))
    const auth = useAuthStore()
    await auth.initialize()
    await expect(auth.selectSchool('foreign-school')).rejects.toThrow()
    expect(request).toHaveBeenCalledOnce()
  })

  it('keeps confirmed tenant when a switch is rejected', async () => {
    request.mockResolvedValueOnce(profile(true)).mockResolvedValueOnce({ data: { school_id: 's1', school_name: 'Школа 1', role: 'teacher' } }).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Нет доступа'))
    const auth = useAuthStore()
    await auth.initialize()
    await auth.selectSchool('s1')
    await expect(auth.selectSchool('s2')).rejects.toThrow('Нет доступа')
    expect(auth.tenant?.school_id).toBe('s1')
    expect(auth.busy).toBe(false)
  })

  it('preserves session when logout fails, clears it only after server acknowledgement', async () => {
    request.mockResolvedValueOnce(profile(true)).mockRejectedValueOnce(new ApiError(0, 'HTTP_0', 'Offline')).mockResolvedValueOnce(undefined)
    const auth = useAuthStore()
    await auth.initialize()
    await expect(auth.logout()).rejects.toThrow('Offline')
    expect(auth.authenticated).toBe(true)
    await auth.logout()
    expect(auth.authenticated).toBe(false)
    expect(auth.tenant).toBeNull()
    expect(navigateTo).toHaveBeenCalledWith('/login')
  })

  it('loads system users without requesting tenant-only endpoints', async () => {
    request.mockResolvedValueOnce({ data: { user: { ...profile().data.user, system_role: 'catalog_curator' }, schools: [] } })
    const auth = useAuthStore()
    await auth.initialize()
    expect(auth.systemRole).toBe('catalog_curator')
    expect(auth.needsSchool).toBe(false)
    expect(request).toHaveBeenCalledOnce()
  })
})
