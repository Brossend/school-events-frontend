import type { components } from './openapi'

export type SessionProfile = components['schemas']['LoginResponse']['data']
export type User = SessionProfile['user']
export type SchoolMembership = SessionProfile['schools'][number]
export type Tenant = components['schemas']['TenantCurrentEnvelope']['data']
export type SystemRole = User['system_role']
export type SchoolRole = SchoolMembership['role']
export type LoginInput = { email: string; password: string; remember?: boolean }
