import type { QualityReview } from '../types/generation'
export function parseQualityReview(value: unknown): QualityReview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (!['blocked', 'requires_review'].includes(String(v.status)) || !Array.isArray(v.findings)) return null
  return { status: v.status as QualityReview['status'], technical_checks: typeof v.technical_checks === 'string' ? v.technical_checks : 'unknown', findings: v.findings.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)).map(x => ({ path: String(x.path ?? ''), text: String(x.text ?? ''), message: String(x.message ?? ''), severity: String(x.severity ?? 'review') })) }
}
