export interface SystemStatus { system_status: string; system_role: 'catalog_curator' | 'system_admin' }
export function parseSystemStatus(payload: unknown): SystemStatus {
 const data = payload && typeof payload === 'object' && 'data' in payload ? payload.data : null
 if (!data || typeof data !== 'object' || !('system_status' in data) || typeof data.system_status !== 'string' || !('system_role' in data) || !['catalog_curator', 'system_admin'].includes(String(data.system_role))) throw new Error('Сервер вернул некорректный системный статус.')
 return { system_status: data.system_status, system_role: data.system_role as SystemStatus['system_role'] }
}
