import { describe, expect, it } from 'vitest'
import { canAccess } from '../app/utils/access'
import { parseSessionProfile, safeReturnTo } from '../app/utils/session'

describe('role access', () => {
  it('requires actual school membership even for system admins on tenant routes', () => {
    expect(canAccess({ tenant: true }, undefined, 'system_admin')).toBe(false)
    expect(canAccess({ tenant: true }, 'teacher', 'none')).toBe(true)
  })
  it('separates system access from school administration', () => {
    const rule = { systemRoles: ['system_admin', 'catalog_curator'] as const }
    expect(canAccess({ systemRoles: [...rule.systemRoles] }, 'school_admin', 'none')).toBe(false)
    expect(canAccess({ systemRoles: [...rule.systemRoles] }, undefined, 'catalog_curator')).toBe(true)
    expect(canAccess({ schoolRoles: ['school_admin'] }, 'teacher', 'none')).toBe(false)
  })
})

describe('session contract adapter', () => {
  const payload = { data: { user: { id: 'user-1', name: 'Анна', email: 'teacher@example.org', system_role: 'none' }, schools: [{ school_id: 'school-1', name: 'Школа', role: 'teacher', is_default: true }] } }
  it('reads AuthController actual response including memberships', () => {
    expect(parseSessionProfile(payload).schools[0]?.school_id).toBe('school-1')
  })
  it('rejects the stale UserEnvelope instead of treating it as a valid session', () => {
    expect(() => parseSessionProfile({ data: payload.data.user })).toThrow()
  })
  it('rejects unknown membership roles', () => {
    expect(() => parseSessionProfile({ data: { ...payload.data, schools: [{ ...payload.data.schools[0], role: 'owner' }] } })).toThrow()
  })
})

describe('return navigation', () => {
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/\n/evil'])('rejects unsafe destination %s', destination => {
    expect(safeReturnTo(destination)).toBe('/')
  })
  it('preserves a local route including its query string', () => {
    expect(safeReturnTo('/calendar?q=test')).toBe('/calendar?q=test')
  })
})
