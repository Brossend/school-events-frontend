import type { SchoolRole, SystemRole } from '../types/auth'

export interface AccessRule { tenant?: boolean; catalog?: boolean; schoolRoles?: SchoolRole[]; systemRoles?: SystemRole[] }
export function canAccess(rule: AccessRule, schoolRole: SchoolRole | undefined, systemRole: SystemRole) {
  if (rule.catalog && !schoolRole && !['catalog_curator', 'system_admin'].includes(systemRole)) return false
  if (rule.tenant && !schoolRole) return false
  if (rule.schoolRoles && (!schoolRole || !rule.schoolRoles.includes(schoolRole))) return false
  if (rule.systemRoles && !rule.systemRoles.includes(systemRole)) return false
  return true
}
