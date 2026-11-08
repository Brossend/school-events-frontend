import type { JsonValue } from './generation'
import type { SavedRequest } from '../utils/scenario-constructor'

export type ComparisonType = 'universal_vs_personalized' | 'cultural_context'
export type VariantKey = 'A' | 'B'
export type ComparisonPayload = Record<string, JsonValue>
export interface ComparisonCreate { scenario_request_id: string; comparison_type: ComparisonType }
export type ComparisonCreateTransport = ComparisonCreate & { is_synthetic?: true }
export interface ComparisonSelection { selected_variant: VariantKey; selection_reason: string; cultural_usefulness_rating?: number | null }
export interface ComparisonHistoryItem {
  id: string; school_id: string; comparison_type: ComparisonType; status: string; selected_variant: VariantKey | null;
  selection_reason: string | null; selection_recorded_at: string | null; cultural_usefulness_rating: number | null; created_at: string;
}
export interface ComparisonVariant {
  variant_key: VariantKey; scenario_id: string | null; scenario_payload: ComparisonPayload;
  is_cultural_available: boolean; variant_label?: string; cultural_provenance_data?: JsonValue[];
}
export interface Comparison extends ComparisonHistoryItem { quality_review?: { A: import('./generation').QualityReview | null; B: import('./generation').QualityReview | null };
  selected_by_user_id: string | null; differences_summary: ComparisonPayload; is_cultural_available: boolean;
  is_synthetic: boolean; variants: ComparisonVariant[];
}
export interface ComparisonVariants {
  comparison_id: string; comparison_type: ComparisonType; differences_summary: ComparisonPayload;
  selected_variant: VariantKey | null; selection_reason: string | null; variants: ComparisonVariant[];
}
type Envelope<T> = { data: T }
type Read<T, P = never> = { parameters: { path: P }; responses: { 200: { content: { 'application/json': Envelope<T> } } } }
type Write<T, B, P = never> = { parameters: { path: P }; requestBody: { content: { 'application/json': B } }; responses: { 200: { content: { 'application/json': Envelope<T> } }; 201: { content: { 'application/json': Envelope<T> } } } }
export interface ComparisonOperationOverrides {
  '/scenario-comparisons': { get: Read<ComparisonHistoryItem[]>; post: Write<Comparison, ComparisonCreateTransport> };
  '/scenario-comparisons/{id}': { get: Read<Comparison, { id: string }> };
  '/scenario-comparisons/{id}/variants': { get: Read<ComparisonVariants, { id: string }> };
  '/scenario-comparisons/{id}/selection': { post: Write<Comparison, ComparisonSelection, { id: string }> };
}
export interface ComparisonContext { user: string; school: string; role: string; authenticated: boolean }
export interface ComparisonsServices {
  request(id: string, signal: AbortSignal): Promise<SavedRequest>;
  list(signal: AbortSignal): Promise<ComparisonHistoryItem[]>;
  show(id: string, signal: AbortSignal): Promise<Comparison>;
  variants(id: string, signal: AbortSignal): Promise<ComparisonVariants>;
  create(body: ComparisonCreate, signal: AbortSignal): Promise<Comparison>;
  select(id: string, body: ComparisonSelection, signal: AbortSignal): Promise<Comparison>;
}
