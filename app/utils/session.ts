import type { SessionProfile } from '../types/auth'

// /auth/me's published UserEnvelope is stale. AuthController returns LoginResponse.
// Keep the correction local and validate the shape instead of weakening all API types.
export function parseSessionProfile(payload: unknown): SessionProfile {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Сервер вернул неполный профиль пользователя.')
  const data = payload.data as Partial<SessionProfile> | undefined
  const user = data?.user
  if (!user || typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.email !== 'string'
    || !['none', 'catalog_curator', 'system_admin'].includes(user.system_role) || !Array.isArray(data?.schools)
    || !data.schools.every(s => typeof s.school_id === 'string' && typeof s.name === 'string'
      && ['teacher', 'school_admin'].includes(s.role) && typeof s.is_default === 'boolean')) {
    throw new Error('Формат профиля не совпадает с контрактом сессии. Обратитесь к администратору.')
  }
  return data as SessionProfile
}

export function safeReturnTo(value: unknown, fallback = '/') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value)
    && !value.startsWith('/login') ? value : fallback
}
