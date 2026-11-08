# FE-011 catalog contract

Sources inspected read-only: backend `app/Http/Controllers/Api/V1/{CatalogReviewController,EventSourceController,CulturalClaimController}.php`, `app/Http/Requests/Catalog/{UpdateEventSourceRequest,CreateSourceReviewRequest,AttachClaimEvidenceRequest}.php`, `app/Services/ProvenanceVerificationService.php`, `docs/openapi.yaml`, and backend `AGENTS.md`. No backend setup or writes are needed for this contract review.

## Integration signatures

`app/types/catalog-admin.ts` exports `CatalogQueuePage`, `CatalogQuery`, `SourcePatch`, `SourceReviewInput`, `ClaimEvidenceInput`, `CatalogAdminOperationOverrides`, and reexports FE003 `SourceDetail`, `ClaimDetail`, `Review`. Parent owns API/controller/UI wiring, including adding the overrides to the existing API client's `LocalOverrides` intersection.

`app/utils/catalog-admin.ts` exports:

- `parseCatalogQueue(payload: unknown): CatalogQueuePage` (alias `parseQueue`).
- FE003 `parseSource`, `parseReviews`, `parseClaim` unchanged.
- `sourcePatchIssues(body: SourcePatch): Record<string, string>`.
- `sourceReviewIssues(body: SourceReviewInput): Record<string, string>` (alias `reviewIssues`).
- `claimEvidenceIssues(body: ClaimEvidenceInput): Record<string, string>` (alias `evidenceIssues`).
- `parseSourcePatchReply(payload: unknown, id?: string): SourcePatchResult`; optional ID rejects a response for another source. `parseSourcePatch` also available.
- `parseEvidenceReply(payload: unknown): ClaimEvidenceResult` for the smaller attachment response, followed by GET claim for FE003 evidence rendering.
- `allowedSourcePatch`, `allowedSourceReview`, `allowedClaimEvidence` copy only allowed own properties, preserving explicit null/false and excluding undefined. Validate the resulting body before transport. Validators do not mutate form state.
- `catalogFieldIssues(error)` maps service `evidence_excerpt` to form `citation_excerpt`; other fields remain visible, including reviewer/verifier errors.

Reuse FE003 `SourceContent`, `ClaimContent`, `EvidenceRecord`, `SourceInspector`, and `ProvenanceStatus`. Status rendering remains in `app/utils/provenance.ts`; these helpers do not infer authenticity or implement an alternative provenance gate.

## Read DTOs and pagination

GET `/catalog/review-queue`: `{data: CatalogQueueItem[], meta: {current_page,total,per_page,last_page}}`. Meta is at the envelope root, not under data. Each row includes id, calendar_event_id, nullable calendar_event `{id,title,event_type,region_code,status}`, bibliographic fields, claims_count, status, latest_review, verified_by, verification_date, created_at. No row-level mutation permission or claim-authenticity field exists.

Queries: `status` defaults to `pending`; `pending` includes sources with no review **and** latest `requires_amendment`. `all` skips the decision filter. Other supported statuses are `approved`, `rejected`, `requires_amendment`. Optional region_code/event_type are exact filters. `per_page` defaults to 20 and is clamped by the server to 5–100. Sources sort created_at descending. Latest reviews sort reviewed_at descending, then id descending. Review history preserves this server order.

GET source, GET reviews and GET claim reuse FE003 parsers. Claim GET retains evidence rows including `is_detached`, `detached_at`, `detachment_reason`, stored `verification_status`, dynamic `effective_status`, and `evidence_audit_events`. Keep these separate. Do not replace raw status with an inferred approval status.

## Mutation bodies and responses

| Operation | Allowed JSON body | Actual success response |
| --- | --- | --- |
| PATCH `/event-sources/{id}` | Optional title, author, source_type, url, doi_or_isbn only | 200 `{data:{id,calendar_event_id,source_type,title,author,url,doi_or_isbn,verified_by_user_id,verification_date,created_at}}` |
| POST `/event-sources/{id}/reviews` | Required decision and comments | 201 `{data:{id,event_source_id,decision,comments,reviewer:{id,name,system_role},reviewed_at}}` |
| POST `/cultural-claims/{id}/evidence` | Required event_source_id, citation_locator, citation_excerpt; optional applicable_academic_year, notes, verify | 201 `{data:{id,cultural_claim_id,event_source_id,source:{id,title,author,source_type}\|null,citation_locator,citation_excerpt,verification_status,effective_status,verified_by,verified_at,applicable_academic_year,notes}}` |
| DELETE `/cultural-claims/{id}/evidence/{sourceId}` | Optional reason; `{}` is valid | 200 `{data:{message,detached_records_count}}` |

OpenAPI incorrectly describes PATCH as the full source envelope and omits DELETE reason/count. The narrow local operation overrides correct these plus refine mutation bodies/attachment response. Generated OpenAPI remains unchanged. PATCH and attach replies are **not** full FE003 source/claim detail DTOs; do not pass them to those parsers or manufacture missing arrays/flags. GET after mutation is required for display reconciliation.

DELETE has no FormRequest: null/omitted reason uses `Откреплено куратором каталога`. Frontend intentionally requires a nonblank reason of at most 2000 characters as a product safeguard; this is stricter than Laravel and is not represented as server validation. UI confirmation is required by the task; DELETE soft-detaches **all active rows** for the claim/source pair, resets verification fields, and appends immutable audit rows. Repeating after success yields 404 when no active records remain.

## Validation and 422

PATCH: title if present is required, 3–500 characters. Nullable author max 255, URL max 1000 with Laravel URL validation, DOI/ISBN max 64. Source types: normative_act, scientific_publication, ethnographic_archive, encyclopedia. No verification status, reviewer, event ID, counters, claims or arbitrary fields are writable. Empty PATCH is allowed by the FormRequest.

Review: decision is approved/rejected/requires_amendment; comments required, 5–2000 characters. Approval authenticates the source, never all its claims. Rejection updates linked evidence to rejected_fake; amendment resets linked evidence to unverified. Meaningful bibliographic PATCH changes invalidate previous source approval, append a requires_amendment review, reset linked evidence, and include code intended to append invalidation audit events for previously verified evidence. The live HTTP run did not return that expected per-claim audit; see the runtime discrepancy below.

Attach: event_source_id must be a UUID that exists server-side; locator 3–255, excerpt 10–2000, notes nullable max 2000. Academic year nullable YYYY-YYYY; verify nullable boolean, defaults to true, including explicit null via PHP `?? true`. `verify:false` attaches unverified evidence, not an attestation. For verification, service also rejects generic placeholders and requires consecutive academic years, same-event binding, appropriate source typology, active authorized verifier/reviewer, valid region, and latest approved review. It may return service-only 422 fields such as evidence_excerpt, reviewer, verifier or verified_by_user_id. Notes never substitute for excerpt. These server checks cannot be established by a browser validator alone.

Use existing `toApiError` for both Laravel `{errors:{field:[message]}}` and API `{error:{details:...}}` validation envelopes. Preserve form input and display unmapped service errors at form level. Cross-event binding can produce 422 `CROSS_EVENT_BINDING_FORBIDDEN` with no field details; retain its general message.

## Authorization and freshness

Queue/reviews/mutations require catalog_curator or system_admin. teacher/school_admin do not gain catalog rights from their school role. Regional queue visibility includes federal events and null-region events, but review history, review creation and evidence mutations deny federal, null-region and other-region events with 403 `FORBIDDEN_REGIONAL_SCOPE`. Source PATCH specifically checks federal/allowed-region membership; it differs for orphan events (allows absent event), whereas reviews/evidence deny absent event. Do not translate queue visibility into mutation permission. GET source/claim uses tenant visibility and can return 404; stale queue entries are not permission evidence.

After PATCH/review, reload source, reviews, queue, and any open affected claim. After attach/detach, reload claim and source/queue as needed. Claim GET retains detached evidence and append-only audit history. Effective unverified or is_detached must never render green even if stored status was previously authentic. Provenance changes can invalidate existing scenario/export attestations; never automatically re-sign scenarios.

Parent controller handles in-flight/context guards, duplicate submission prevention, confirmation, clearing stale data on user/tenant changes, and 401/403/404/409/422/5xx/network states. No mutation has an idempotency key; do not retry uncertain writes automatically. Reconcile with GET without treating reconciliation failure as proof the write failed.

## Verification boundary

`tests/fe011-catalog-data.test.ts` tests controller-shaped DTO fixtures, pagination, narrow PATCH/DELETE/attach response contracts, FE003 parser identity, source approval vs claim status, detached/effective status and audit retention, allowlists, FormRequest/service validation, and real 422 envelope shapes. These are frontend contract tests; live HTTP/RBAC/PostgreSQL evidence belongs to the parent integration run. No backend or Figma edits are included.

Validation run on 2026-10-29: full `npm test` passed, 17 files / 538 tests (26 catalog tests); targeted ESLint on the two catalog TS files and test passed. `npm run typecheck` reported only the concurrently added school API settings mismatch at `app/composables/useSchoolProfileApi.ts:21` (`SchoolProfileInput.settings` versus generated `Record<string, never>`), outside this owner's four files. Nuxt also emits duplicate auto-import warnings for the requested FE003 reexports; they point to the same original implementations. Parent should rerun typecheck after its API override wiring. Production build and live integration are parent-owned checks.

Parent integration update: FE003 reexports now use distinct auto-import names CatalogSourceDetail/CatalogClaimDetail/CatalogReview and parseCatalogSource/parseCatalogClaim/parseCatalogReviews. They remain exact aliases of FE003, avoiding duplicate Nuxt auto-import warnings without copying provenance logic.

Final integration: typecheck and ESLint pass with the local school/catalog overrides and distinct FE003 aliases. Full regression passes 588 tests in 19 files, including 29 independent-review regressions. See ../FE-011-review.md for final build, live and release evidence.
