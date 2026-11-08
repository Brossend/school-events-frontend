# FE-010 Pilot backend contract: implementation research

Verified by source inspection on 2026-10-28. Backend root: `C:/Users/bross/WebstormProjects/school`. This document concerns Pilot invitations, questionnaires, expert reviews, metrics, and aggregate export. It does not claim runtime or database verification and does not replace a separate ScenarioComparison contract.

## Evidence and scope

Read the supplied FE-010 task and backend [AGENTS.md](/C:/Users/bross/WebstormProjects/school/AGENTS.md). No backend files were changed, no HTTP mutations or database commands were run, and no backend tests, seeders, migrations, diagnostic command, or application bootstrap were executed. PHP and Composer are unavailable on this shell's PATH. Installing Boost would change the backend, so no dependency installation was performed for this source-only investigation.

Authoritative implementation sources (links point into the inspected checkout):

| Source | Responsibility |
| --- | --- |
| [routes/api.php](/C:/Users/bross/WebstormProjects/school/routes/api.php:72) | Public versus authenticated and tenant route groups |
| [bootstrap/app.php](/C:/Users/bross/WebstormProjects/school/bootstrap/app.php:20) | `/api/v1` prefix, stateful API, exception envelopes |
| [PilotParticipantController.php](/C:/Users/bross/WebstormProjects/school/app/Http/Controllers/Api/V1/PilotParticipantController.php) | Invitation administration, exact returned fields |
| [PilotResponseController.php](/C:/Users/bross/WebstormProjects/school/app/Http/Controllers/Api/V1/PilotResponseController.php) | Questionnaire DTO, individual access, review POST DTO |
| [PilotMetricsController.php](/C:/Users/bross/WebstormProjects/school/app/Http/Controllers/Api/V1/PilotMetricsController.php) | Scope selection, synthetic flag, export nesting |
| [CreatePilotParticipantRequest.php](/C:/Users/bross/WebstormProjects/school/app/Http/Requests/Pilot/CreatePilotParticipantRequest.php) | Invitation validation |
| [CreatePilotResponseRequest.php](/C:/Users/bross/WebstormProjects/school/app/Http/Requests/Pilot/CreatePilotResponseRequest.php) | Questionnaire validation |
| [CreatePilotReviewFindingRequest.php](/C:/Users/bross/WebstormProjects/school/app/Http/Requests/Pilot/CreatePilotReviewFindingRequest.php) | Review validation |
| [PilotService.php](/C:/Users/bross/WebstormProjects/school/app/Services/PilotService.php:25) | Token lifecycle, submission checks, review versioning, metric formulas |
| [TenantResolver.php](/C:/Users/bross/WebstormProjects/school/app/Services/TenantResolver.php:25) | Operational versus analytical tenant resolution |
| [IdentifyTenantScope.php](/C:/Users/bross/WebstormProjects/school/app/Http/Middleware/IdentifyTenantScope.php) | Membership guard, school attributes, school header |
| [PreventTenantInjection.php](/C:/Users/bross/WebstormProjects/school/app/Http/Middleware/PreventTenantInjection.php) | Recursive `school_id` rejection across all API endpoints |
| [EnsureActiveUser.php](/C:/Users/bross/WebstormProjects/school/app/Http/Middleware/EnsureActiveUser.php) | Inactive-account rejection |
| [User.php](/C:/Users/bross/WebstormProjects/school/app/Models/User.php), [SchoolMembership.php](/C:/Users/bross/WebstormProjects/school/app/Models/SchoolMembership.php) | Role checks and membership relations |
| [AuthController.php](/C:/Users/bross/WebstormProjects/school/app/Http/Controllers/Api/V1/AuthController.php) | Actual login/me profile projection; curator scope/codes are absent |
| [PilotParticipant.php](/C:/Users/bross/WebstormProjects/school/app/Models/PilotParticipant.php), [PilotResponse.php](/C:/Users/bross/WebstormProjects/school/app/Models/PilotResponse.php), [PilotReviewFinding.php](/C:/Users/bross/WebstormProjects/school/app/Models/PilotReviewFinding.php) | Casts, relationships, expiry/revocation checks |
| [Pilot table migration](/C:/Users/bross/WebstormProjects/school/database/migrations/2026_10_23_000002_create_pilot_tables.php), [hardening migration](/C:/Users/bross/WebstormProjects/school/database/migrations/2026_10_24_000001_add_pilot_hardening_fields.php), [effective-review constraint](/C:/Users/bross/WebstormProjects/school/database/migrations/2026_10_24_000002_add_single_effective_review_constraint.php) | Storage precision, FK/unique/check constraints |
| [docs/openapi.yaml](/C:/Users/bross/WebstormProjects/school/docs/openapi.yaml:1580) | Declared API v1.4.0, compared with implementation below |
| [PilotStudyAndAnalyticsTest.php](/C:/Users/bross/WebstormProjects/school/tests/Feature/PilotStudyAndAnalyticsTest.php) | Existing source assertions for one-use tokens, 5/20 coverage, completion, synthetic origin, RBAC; read, not run |

Where OpenAPI differs, controller/FormRequest/service behavior is the factual contract recorded here. Schema declarations alone are not runtime evidence.

## Transport and route inventory

Paths below are relative to `/api/v1`. All successes are JSON objects with one `data` property; lists have no pagination envelope. Use `Accept: application/json`, JSON content type for bodies, and the existing Sanctum cookie/CSRF flow for browser mutations. OpenAPI documents cookie authentication. A public route is not necessarily CSRF-exempt: `statefulApi()` applies Sanctum's frontend middleware according to Origin/Referer, which includes session and CSRF validation (verified against installed Sanctum middleware and `config/sanctum.php`). A guest can obtain a CSRF cookie without logging in.

| Method/path | HTTP success | Route middleware beyond shared API middleware |
| --- | --- | --- |
| GET `/pilot/participants` | 200, `{data: PilotParticipant[]}` | `auth:sanctum`, `active`, `tenant` |
| POST `/pilot/participants` | 201, `{data: PilotInvite}` | same |
| POST `/pilot/participants/{id}/reissue` | 200, `{data: PilotInvite}` | same |
| POST `/pilot/participants/{id}/revoke` | 200, revocation DTO | same |
| POST `/pilot/responses` | 201, `{data: PilotResponse}` | public: no auth, active, or tenant guard |
| GET `/pilot/responses/{id}` | 200, `{data: PilotResponse}` | `auth:sanctum`, `active`, `tenant` |
| POST `/pilot/responses/{id}/reviews` | 200, `{data: PilotReview}` | `auth:sanctum`, `active`; **no tenant guard** |
| GET `/pilot/metrics` | 200, `{data: PilotMetrics}` | `auth:sanctum`, `active`; analytical resolution in controller |
| GET `/pilot/export` | 200, `{data: PilotExport}` | same, plus school export authorization |

No Pilot GET by token, participant detail GET, response list, participant-to-response lookup, review list/detail GET, revoke reversal, update/delete questionnaire, or individual-answer export route is defined. There is no Pilot-specific throttle on these route declarations. Infrastructure behavior was not inspected.

`school_id` must never be sent in a request payload or query: the global guard traverses `$request->all()` as well as JSON recursively, returning 422 `TENANT_INJECTION_FORBIDDEN` even on public submission. Use `X-School-Id` for authenticated school selection; public response school is derived from the token. IDs in successful payloads are UUID strings; timestamps are ISO 8601 strings. The controllers use `toIso8601String()`; clients should accept offsets rather than assume a particular timezone.

## RBAC and tenancy

Backend roles: `system_role === 'system_admin'`, `system_role === 'catalog_curator'`, school membership roles `school_admin` and `teacher`. Regional scope is exactly `curator_scope === 'regional'`; authorization checks school `region_code` against `curated_region_codes` with strict matching. Other curator scopes are treated as nonregional by backend checks. There is no separate Pilot expert role or expert assignment: authorized administrators/curators can author findings, including school admins.

| Caller | School metrics | School export | Participants and individual GET response | POST review | Global metrics/export |
| --- | --- | --- | --- | --- | --- |
| Teacher member | own member school | denied | denied | denied | denied |
| School admin | own member school | own admin school | own admin school | own admin school | denied |
| Regional curator | school within curated region, without membership via explicit header | same | **membership additionally required by tenant middleware**, then region authorization | within curated region; membership not required | denied |
| Nonregional curator | any selected school | any selected school | **membership additionally required** | any response school | allowed |
| System admin | any selected school | any selected school | **membership additionally required** | any response school | allowed |
| Guest | denied | denied | denied | denied | denied |

Anyone holding a valid invitation can POST the public questionnaire, independent of authenticated role. The token authorizes submission for its participant's school, not scenario browsing or other Pilot reads.

Operational resolution (`TenantResolver::resolve`, participant endpoints, individual GET response, and ordinary scenario routes):

1. Explicit `X-School-Id` must match a membership. Existing foreign school: 403 `FORBIDDEN_TENANT_ACCESS`; unknown school: 404 `SCHOOL_NOT_FOUND`. No fallback on a bad header, even for system admins/curators.
2. Without header: one membership selects that school; multiple memberships use the default; multiple without default return 422 `SCHOOL_SELECTION_REQUIRED`.
3. No memberships: system user receives 403 `SYSTEM_USER_TENANT_FORBIDDEN`; ordinary user receives 403 `NO_ACTIVE_SCHOOL_MEMBERSHIP`.
4. Controller then checks school admin/system/curator permission and region. Cross-school response/participant IDs return 403 after lookup; absent IDs return 404. Successful tenant responses echo `X-School-Id`.

Analytical resolution (`resolveAnalyticalSchool`, metrics/export): explicit header allows a system admin, a nonregional curator, an authorized regional curator, or an ordinary member. Unknown school returns 404 `SCHOOL_NOT_FOUND`; foreign/out-of-region school returns 403 `FORBIDDEN_TENANT_ACCESS`. No header uses one/default membership; no membership or ambiguous selection yields 422 `SCHOOL_SELECTION_REQUIRED`. **No-header membership fallback does not independently recheck regional scope in this resolver**; school export subsequently checks region, while school metrics do not. Use explicit authorized school selection; this is a backend edge case, not permission to request foreign schools.

`scope` defaults to `school`. Only literal `global` uses global mode; unrecognized values fall through to school mode rather than producing validation failure. Global mode bypasses school resolution and ignores school header for filtering. Regional curators and ordinary school roles always receive 403 for global scope. There is no aggregate `region` scope; a regional curator selects an allowed school.

Review POST resolves the target school from `response.participant.school`, not `X-School-Id`, and does not compare the header with the target. A school admin needs admin membership in that target school; regional curator needs target region permission. A header does not grant or constrain this route. The frontend should bind review actions to its current school context and invalidate stale requests on switching school.

The inspected membership model has no active-membership field/scope; resolver comments say “active membership” but the queries check membership existence. Account activity is enforced separately by `active` middleware (403 `ACCOUNT_INACTIVE`). Client-side RBAC is advisory; an incomplete profile cannot prove curator regional authority. The frontend helper fails closed when region information is missing and expects server authorization to remain authoritative.

**Actual profile limitation:** `AuthController::formatUserResponse()` returns user `id`, `name`, `email`, `system_role` and membership entries `school_id`, `name`, `role`, `is_default`. It returns neither `curator_scope` nor `curated_region_codes` (nor `is_active` or school region codes). Do not infer global scope from `catalog_curator`, and do not infer region access from membership or a generated optional type. Without further evidence the only profile-provable global role is `system_admin`. The parent's updated UI plan supports curators by explicitly probing the existing read-only `GET /pilot/metrics?scope=global` with tenant headers disabled: only a 200 confirms global capability and enables its checkbox; a 403 leaves it disabled. This confirmation must remain bound to the authenticated context and be cleared on context changes; network errors do not grant access. The probe grants no ability to select arbitrary school IDs. School requests use actual selected memberships and server authorization. There is no dedicated scoped-capabilities API; absence of one is a discoverability limitation, not evidence that global curators are forbidden by the backend.

## Invitations: inputs, output, lifecycle

`POST /pilot/participants` FormRequest fields:

| Field | Required/type | Constraints/default |
| --- | --- | --- |
| `subject_area` | required string | max 100 |
| `teaching_experience_years` | required integer | 0–60 inclusive |
| `anonymous_code` | optional nullable string | max 64; absent/empty generates a code |
| `valid_days` | optional nullable integer | 1–90; preferred over alias |
| `expires_days` | optional nullable integer | 1–90; used if `valid_days` is null/absent |
| `is_synthetic` | optional nullable boolean | defaults false; only automatic isolated-test frontend mode may send true |

All three Pilot FormRequests return `authorize(): true`; actual authorization occurs in middleware/controller/service. Additional fields generally do not trigger an additional-property error: only validated data is passed to services (apart from token read directly from input). Do not use that behavior to submit unsupported fields.

Example body (illustrative, not a record created during research):

```json
{"subject_area":"История","teaching_experience_years":12,"valid_days":30}
```

Creation 201 data schema:

```ts
{
  id: string; anonymous_code: string; subject_area: string;
  teaching_experience_years: number; is_synthetic: boolean;
  invite_token: string; expires_at: string; notice: string;
}
```

Token generation is `pilot_` plus 36 random characters; storage holds SHA-256 only. Returned `notice` says the plain token is returned once. Generated anonymous code is `TEACHER-<up to 4 uppercased region characters>-<school count+1 padded to 3 digits>`. Codes are globally unique; one detected collision appends a random 4-character suffix. This is not a guaranteed conflict-free retry loop; DB uniqueness can still fail. Max-length custom codes plus a suffix can also exceed storage length. Do not assume anonymous codes convey identity or a stable sequence.

GET participants returns **all** participants for selected school, newest `created_at` first, including synthetic, expired, revoked, and submitted. No search/pagination/synthetic filtering is implemented. Each item has exactly:

```ts
{
  id: string; anonymous_code: string; subject_area: string;
  teaching_experience_years: number; is_submitted: boolean;
  is_synthetic: boolean; expires_at: string; is_expired: boolean;
  is_revoked: boolean; used_at: string | null;
  has_response: boolean; created_at: string;
}
```

**No `response_id`, token, hash, `school_id`, review status, or revocation timestamp is returned in the list.** `has_response` comes from a relation existence check, not an identifier. `is_expired` is current `expires_at->isPast()` and can coexist with `is_submitted`; preserve independent flags instead of treating them as mutually exclusive statuses.

Reissue accepts no defined body fields. It is allowed for expired but unsubmitted/unrevoked participants, replaces the token hash (old token becomes 404), and resets expiry to **30 days**, irrespective of original validity. Submitted or revoked participant: 409 `CONFLICT`. Returned data is only `id`, `anonymous_code`, `invite_token`, `expires_at`, `notice` — no subject, experience, synthetic flag, or submission flags. The shared `PilotInvite` type therefore makes creation-only fields optional.

Revoke accepts no defined body. Submitted participant: 409. Otherwise sets `revoked_at=now()`; repeat revoke succeeds and rewrites the timestamp. Returns `id`, `anonymous_code`, `revoked_at`, `message`. Revoked reissue is forbidden; no un-revoke route exists. Expired/unsubmitted invitations can be revoked.

Only initial create/reissue responses disclose plain tokens. Unknown network outcome cannot recover the same secret from GET. Reissuing is a separate deliberate mutation that invalidates the prior token, not a read retry. Keep secrets in volatile component/controller memory and clipboard only when explicitly requested; exclude from storage, telemetry, console output, screenshots/evidence, exported JSON, and URL query strings. No public invitation URL is constructed by the backend.

## Public questionnaire

`POST /pilot/responses` requires no login or tenant header. FormRequest and service together define:

| Field | Required/type | Actual constraints/semantics |
| --- | --- | --- |
| `invite_token` | required string | service trims before hashing; no declared length/prefix validation |
| `scenario_id` | required UUID | service requires an existing scenario in token participant's school |
| `prep_time_baseline_minutes` | required integer | **min 1**, no FormRequest max |
| `prep_time_ai_minutes` | required integer | **min 0**, may exceed baseline |
| `personalization_selected` | required boolean | self-report, independent of comparison selection |
| `manual_edit_percentage` | required numeric | 0–100 inclusive, stored decimal with 2 places |
| `cultural_context_used` | required boolean | determines usefulness score handling |
| `cultural_usefulness_score` | optional nullable integer in FormRequest | 1–5 if supplied; **service requires nonnull when culture used**; when unused, valid supplied score is discarded and saved null |
| `comparison_id` | optional nullable UUID | persisted without service existence/school/variant/status validation; storage FK still applies |
| `feedback_text` | optional nullable string | max 5000 |

Do not send `is_synthetic`: response origin is copied strictly from participant, irrespective of anonymous client extra fields. Do not send calculated time saving, participant ID, school ID, review results, expert name, or submitted timestamp.

Example request, deliberately using a nonsecret placeholder:

```json
{
  "invite_token": "<token-in-memory-only>",
  "scenario_id": "019a0000-0000-7000-8000-000000000003",
  "prep_time_baseline_minutes": 60,
  "prep_time_ai_minutes": 20,
  "personalization_selected": true,
  "manual_edit_percentage": 15.5,
  "cultural_context_used": true,
  "cultural_usefulness_score": 4,
  "comparison_id": null,
  "feedback_text": "Сократилось время подготовки."
}
```

Both 201 submission and 200 individual GET return exactly this shape (example values):

```json
{
  "data": {
    "id": "019a0000-0000-7000-8000-000000000002",
    "participant_id": "019a0000-0000-7000-8000-000000000001",
    "scenario_id": "019a0000-0000-7000-8000-000000000003",
    "comparison_id": null,
    "is_synthetic": false,
    "prep_time_baseline_minutes": 60,
    "prep_time_ai_minutes": 20,
    "relative_time_saving": 0.6667,
    "relative_time_saving_percent": 66.67,
    "personalization_selected": true,
    "manual_edit_percentage": 15.5,
    "cultural_context_used": true,
    "cultural_usefulness_score": 4,
    "feedback_text": "Сократилось время подготовки.",
    "created_at": "2026-10-28T10:00:00+00:00"
  }
}
```

The response omits `submitted_at` even though persisted. It omits participant details, scenario content/revision, school ID, and **all review fields/history**. Nullable usefulness is normal, not zero. The scenario is validated for existence and school only; no scenario readiness, signoff, archive state, content correctness, or comparison consistency check is made here. A public participant cannot discover/select scenarios through a token GET: a valid school scenario UUID must be supplied through an authorized flow outside this Pilot endpoint set.

Submission is a DB transaction locking the participant; response has unique `participant_id`; participant is atomically marked submitted with `used_at`. Invalid submissions roll back. This protects against duplicate questionnaire use; no client idempotency key or public read-after-submit endpoint exists. After an unknown network outcome, do not blindly resend. Administrators can see `has_response`/submission flags but still cannot obtain response ID from participants list.

### Public errors and precedence

Validation runs before service token checks; a malformed questionnaire can receive 422 before token validity is assessed. For a valid-shaped request service checks in order: hash lookup → revoked → expired → submitted → scenario exists → scenario school → value/cultural checks → insert. Therefore an expired previously submitted token can return expiry 403 rather than used 409.

| Condition | Status / `error.code` | Exact service message |
| --- | --- | --- |
| Unknown/old/replaced token | 404 `NOT_FOUND` | `Пригласительный токен участника пилота не найден или недействителен.` |
| Revoked | 403 `FORBIDDEN` | `Приглашение участника пилотного исследования было отозвано организаторами.` |
| Expired | 403 `FORBIDDEN` | `Срок действия пригласительного токена истек.` |
| Already submitted (unexpired, not revoked) | 409 `CONFLICT` | `Анкета по данному пригласительному токену уже была отправлена в систему.` |
| Missing scenario | 404 `NOT_FOUND` | `Оцениваемый сценарий не найден в системе.` |
| Scenario in another school | 403 `FORBIDDEN` | `Оцениваемый сценарий принадлежит другой образовательной организации.` |
| Culture used with missing/null score | 422 `UNPROCESSABLE_ENTITY` | `При использовании этнокультурного контекста обязательна оценка его полезности (1-5).` |
| Invalid fields (including supplied score outside 1–5) | 422 `VALIDATION_FAILED` | field details from FormRequest |
| `school_id` injected anywhere | 422 `TENANT_INJECTION_FORBIDDEN` | shared middleware message |
| Missing/stale CSRF for a stateful browser mutation | 419 `CSRF_TOKEN_MISMATCH` | shared handler message |

“Foreign token” has no distinct backend error: tokens are not bound to a logged-in user or browser school. Another school's otherwise valid token with a same-school-to-token scenario is accepted; a scenario belonging to a different school from the token fails 403. Do not claim a caller identity check exists. Expired and revoked errors share code/status, so they cannot be distinguished using machine code alone. Unknown token and missing scenario also share code/status. Preserve the server message; there are no dedicated `TOKEN_EXPIRED`/`TOKEN_USED` codes.

## Expert findings

Review POST input:

```ts
{
  expert_audit_status: 'pending_audit' | 'audited' | 'rejected'; // required
  critical_cultural_errors: number; // required integer >= 0
  methodological_remarks?: string | null; // max 5000
}
```

Success is **200**, not 201. Returned data:

```ts
{
  id: string; pilot_response_id: string; expert_name: string;
  expert_audit_status: 'pending_audit' | 'audited' | 'rejected';
  critical_cultural_errors: number; methodological_remarks: string | null;
  finding_version: number; is_effective: boolean; reviewed_at: string | null;
}
```

The server copies expert ID/name from authenticated user, sets reviewed timestamp, and ignores any client version/effective fields. It locks the response and latest finding, increments `finding_version` starting at 1, marks previous effective rows false, and inserts a new effective finding. Existing content remains stored; old effectiveness metadata changes. A partial unique index permits only one effective row per response. Reposting identical content creates another version; there is no edit-in-place HTTP API, optimistic version precondition, or idempotency key. Unknown POST outcome cannot be reconciled through a review GET.

**Persistence is not API availability.** `PilotResponse` has `reviews`/`latestReview` relations, but `formatResponse()` exposes neither, and there is no review-history route. GET response cannot establish current effective finding, audit status, critical error count, remarks, or history. A successful POST gives that one version at that moment; it does not guarantee it remains effective after another expert posts. The frontend must represent unavailable review state as unknown, never “0 errors”, “not reviewed”, an empty verified history, or a claim that the last local POST is the current server finding.

Only effective rows with status **`audited`** contribute to expert metrics. An effective `rejected` or `pending_audit` row does not count as audited, and its error count does not contribute to the critical-error sum. Superseding an audited finding with a pending/rejected finding reduces coverage and removes its previous errors from the counted aggregate. Do not interpret `rejected` as automatically causing the critical-error KPI to fail.

## Metrics: exact schema and definitions

GET `/pilot/metrics?scope=school` (optional `X-School-Id`) or `?scope=global`. Optional `include_synthetic` is read by Laravel `Request::boolean`, default false (standard true forms include `1`, `true`, `on`, `yes`). No distinct server role/environment gate controls this flag: anyone authorized for the metrics scope may request it. **Frontend policy is stricter**: normal mode omits it entirely; isolated synthetic mode requires exact API `http://localhost:8001` plus frontend query `synthetic=1`, an explicit synthetic banner, and may automatically create synthetic invitations. No user checkbox or arbitrary origin switch grants synthetic permission. `include_synthetic=1` means include both flagged and unflagged records, not synthetic-only.

Default filtering requires both `pilot_responses.is_synthetic=false` AND related `pilot_participants.is_synthetic=false`. School filtering is via participant.school_id. Comparisons, comparison synthetic flags, scenario synthetic origin, and diagnostic provenance heuristics are **not** consulted. The diagnostic service separately identifies historical suspected/unclassified records but is not part of the HTTP metric result. Thus “not flagged synthetic” is not proof of verified real-world provenance. Existing legacy records with default false can remain in the default denominator; no claim about the current DB's contents is made here.

The returned flat `data` payload has all these fields:

```ts
type Criterion = 'time_saving_ge_50' | 'personalization_ge_70'
  | 'manual_edit_under_20_ge_70' | 'cultural_usage_ge_60'
  | 'cultural_usefulness_ge_4' | 'zero_critical_cultural_errors';
type CriterionStatus = 'pending_data' | 'pending_review' | 'pass' | 'fail';
type PilotMetrics = {
  status: 'no_data' | 'active_pilot' | 'completed';
  total_participants: number; submitted_responses_count: number;
  audited_responses_count: number; audited_reviews_count: number;
  pending_expert_reviews_count: number;
  expert_review_coverage_percent: number | null;
  median_relative_time_saving_percent: number | null;
  personalization_choice_percent: number | null;
  self_reported_personalization_choice_percent: number | null;
  manual_edit_under_20_percent_ratio: number | null;
  cultural_context_usage_percent: number | null;
  average_cultural_usefulness_score: number | null;
  critical_cultural_errors_count: number | null;
  sample_size: number; target_sample_size: number;
  is_survey_completed: boolean; is_expert_evaluation_completed: boolean;
  is_pilot_completed: boolean;
  criteria_progress: Record<Criterion, boolean>;
  criteria_status: Record<Criterion, CriterionStatus>;
  sample_breakdown: {
    personalization: { selected: number; total: number };
    manual_edits: { under_20_percent: number; total: number };
    cultural_context: { used: number; rated_count: number; total: number };
    expert_reviews: { audited: number; pending: number;
      coverage_percent: number | null; critical_errors: number | null };
  };
};
```

Let N = count of filtered submitted response rows and A = distinct response IDs with an effective audited review. `total_participants`, `submitted_responses_count`, and `sample_size` all equal **N**, not invited participant count. `audited_reviews_count` aliases `audited_responses_count=A`; it is not historical finding count. Target is always 20. No study/cohort/date range is modeled; school/global results include all matching rows and may exceed 20. No participant-specific samples, time series, confidence intervals, comparison win rates, or causal effectiveness estimates are returned.

| Criterion/key | Actual value and denominator | PASS |
| --- | --- | --- |
| Time / `time_saving_ge_50` | Each response stores `round((baseline-ai)/baseline,4)`. Metric sorts `round(storedRatio*100,2)` and takes the median; even N uses rounded mean of middle two. | median >=50 |
| Personalization / `personalization_ge_70` | `round(100 * count(personalization_selected=true)/N,2)`; both personalization fields equal it | >=70 |
| Manual edits / `manual_edit_under_20_ge_70` | `round(100 * count(manual_edit_percentage <=20)/N,2)` | >=70 |
| Culture usage / `cultural_usage_ge_60` | `round(100 * count(cultural_context_used=true)/N,2)` | >=60 |
| Culture usefulness / `cultural_usefulness_ge_4` | Rounded mean score among **culture-used responses with nonnull score**, denominator `rated_count` | mean >=4 |
| Cultural errors / `zero_critical_cultural_errors` | Sum of errors in effective **audited** reviews; null if A=0 | N>0, A>=N, and sum===0 |

Personalization is questionnaire self-report, not `ScenarioComparison.selected_variant`. It is not a verified comparative experiment result. “Under 20” names are historical: the actual comparison is **inclusive <=20**. Percent fields range on a 0–100 scale; time savings may be negative when AI preparation takes longer (no clamp). Per-response `relative_time_saving` is a fraction, not a percentage; use returned percent for display. The DB ratio is `decimal(5,4)` and preparation fields are SQL integers; missing FormRequest maxima do not imply unlimited storable values. Extreme valid-shaped inputs can exceed DB ranges and produce generic 500 rather than a friendly validation response. Manual edit precision is DB-rounded to two decimal places.

For N>0 first four criteria are `pass`/`fail` immediately, even at N=1; usefulness is `pending_data` if no rated scores, otherwise pass/fail. The zero-error criterion is `pending_review` if A=0; for partial A it is `fail` if counted errors>0 and otherwise `pending_review`; at full coverage it is pass/fail based on zero errors. `criteria_progress` booleans alone cannot distinguish missing data, pending review, and failure.

### Completion, no data, and partial review

`is_survey_completed = N>=20`. `is_expert_evaluation_completed = N>=20 && A>=N`. `is_pilot_completed = surveyCompleted && expertEvaluationCompleted && no counted critical errors`. Overall `status` is `no_data` for N=0, `completed` when `is_pilot_completed`, otherwise `active_pilot`.

**Completion does not require the first five KPI thresholds to pass.** N=20/full audit/zero errors may be `completed` while time/personalization/etc. fail. Present research completion separately from threshold success. Conversely zero-error criterion may pass at N=1/full audit while expert evaluation and pilot are still incomplete.

| N | A | Effective audited errors | Expected essential state |
| --- | --- | --- | --- |
| 0 | 0 | null | `no_data`; counts 0; coverage and all six metric values null; first five `pending_data`, errors `pending_review`; all progress/completion flags false |
| 1 | 0 | null | `active_pilot`; observed quantitative pass/fail allowed; errors `pending_review`; survey/expert/pilot false |
| 5 | 0 | null | same collection state, show N=5; no expert count assumed |
| 1 or 5 | all N | 0 | zero-error criterion pass; expert-evaluation completion still false until N>=20 |
| 20 | 0 | null | survey true; expert/pilot false; errors `pending_review`; coverage 0% |
| 20 | 5 | 0 | **5 of 20**, 25% coverage, 15 pending; errors value 0 but **`pending_review`**; expert/pilot false; `active_pilot` |
| 20 | 5 | >0 | errors `fail` immediately; partial coverage; expert/pilot false |
| 20 | 20 | 0 | 100% coverage; survey/expert/pilot true; `completed`; individual KPI failures remain possible |
| 20 | 20 | >0 | survey/expert true; errors fail; pilot false; `active_pilot` |

N=0 is response absence, even if invitation records exist. Null values must render as unavailable; do not coalesce to zero. For error display, preserve both counted errors and review coverage. A=0,N>0 coverage is 0%, whereas N=0 coverage is null. Backend returns the above empty-state `sample_breakdown` with zeros and null coverage/errors, not an omitted object. No synthetic-mode marker, scope echo, school ID, or calculation timestamp is in metric payload; the caller must keep the request context and visibly label synthetic mode.

## Aggregate export is JSON

GET `/pilot/export` uses the same scope/synthetic parameters and metric calculation. School export requires administrator/curator authority beyond the membership permission sufficient for GET metrics. Actual response:

```ts
{
  data: {
    exported_at: string;
    scope: 'school' | 'global';
    school_id: string | null; // null for global
    metrics: PilotMetrics; // flat object, NOT {data: PilotMetrics}
  };
}
```

There is no file attachment header, file name, binary body, XLSX/PDF/CSV renderer, individual answer export, or token field. A client can save the aggregate JSON as `.json` with `application/json`; do not rename it to a spreadsheet/PDF. No backend-supplied synthetic marker exists in the export, so the UI/download naming should retain isolated synthetic context. Default export excludes flagged synthetic records just like default metrics. No DB writes occur in the export implementation.

## Shared error schema

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Переданные данные не прошли валидацию.",
    "details": [{"field":"prep_time_baseline_minutes","message":"<validation message>"}],
    "trace_id": "req-<server-generated-uuid>"
  }
}
```

Validation details are a flat array (potentially multiple entries per field). Generic HTTP errors use `details: []`. Generic code map: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 422 `UNPROCESSABLE_ENTITY`, 429 `TOO_MANY_REQUESTS`; FormRequest 422 is separately `VALIDATION_FAILED`. Tenant middleware/resolver supplies the more specific codes documented above. Inactive authenticated users: `ACCOUNT_INACTIVE`. Uncaught errors use 500 `INTERNAL_SERVER_ERROR` without response stack traces. CSRF uses 419 `CSRF_TOKEN_MISMATCH`. Standard trace middleware assigns a fresh server trace ID; do not log invitation request bodies while collecting trace information.

## OpenAPI discrepancies and implementation limitations

| Declared schema/gap | Actual implementation / frontend consequence |
| --- | --- |
| `CreatePilotResponseDTO` minima baseline=10, AI=5 | FormRequest minima **1 and 0**; use actual validation |
| Usefulness listed required and nonnullable | Optional/nullable unless culture used; response can be null |
| Response creation schema lacks `comparison_id` and uses `additionalProperties:false` | FormRequest accepts nullable UUID `comparison_id` |
| Participant create schema lacks `expires_days`, `is_synthetic`; optional fields not nullable | FormRequest accepts nullable alias/flag/optional fields |
| Participant/invite schemas omit `is_synthetic` | List and create include it; reissue omits it |
| Metric parameters omit `include_synthetic` and school header/selection failures | Controller accepts flag; tenant selection can also return 404/422 |
| Metrics schema lacks `sample_breakdown` | Service always returns it |
| `PilotExportResponse.metrics` references `PilotMetricsResponse`, which already contains `data` | Actual export is `data.metrics.<metric>`, no second envelope |
| Review history described by model relations/requirements | No read route and no finding fields in response DTO |
| Participants only expose `has_response` | No response ID, so admin list cannot navigate to an individual questionnaire using these APIs alone |
| Invite actions imply curator/admin access | Tenant membership is still mandatory for participant endpoints and individual response GET |
| “Pilot completed” could imply all KPI passed | Backend completion only requires sample/audit completion and no counted critical errors |
| Comparison link looks validated | Only UUID validation plus FK; no service ownership/existence/status consistency check; bad FK may become 500 |
| Synthetic filter suggests verified real data | Flag exclusion only; historical provenance not independently verified |

These gaps prevent claiming a complete reloadable expert-review workspace from the existing Pilot API. A frontend can submit a known response ID and show the immediate returned finding, but cannot discover all response IDs or reload current findings/history. No new API or backend fix is authorized by this contract work.

## Frontend artifact integration

Owned files: this document, `app/types/pilot.ts`, `app/utils/pilot.ts`, `tests/fe010-pilot.test.ts`. No UI, composable, generated OpenAPI, API-client, or backend edits are part of this work.

`PilotParticipant`, `PilotInvite`, `PilotResponse`, `PilotReview`, `PilotMetrics`, and `PilotExport` describe unwrapped payloads; `ParticipantInput`, `PilotResponseInput`, and `PilotReviewInput` describe bodies. `PilotOperationOverrides` returns normal `{data: payload}` envelopes and corrects all eight Pilot paths (nine operations) without rewriting generated OpenAPI. The parent reports integrating that override and the parsers into its API layer; merely exporting an override does not alter transport typing. `PilotMetricsQuery.include_synthetic` allows boolean or literal 1; `pilotMetricsQuery()` defaults to `{scope:'school'}` with the flag absent.

Envelope parsers: `parsePilotParticipants`, `parsePilotInvitation`, `parsePilotResponse`, `parsePilotReview`, `parsePilotMetrics`, `parsePilotExport`. They validate payload shape, copy only known fields, preserve nullable fields and server metric statuses, and use generic nonsecret errors. They are not alternate metric calculators or server authorization checks. `pilotExportJson` serializes an allowlisted aggregate envelope, omitting injected individual-answer/token fields. It does not mutate or recompute metrics.

Form helpers: `pilotParticipantIssues`, `pilotResponseIssues`, `pilotReviewIssues`, returning field-to-message dictionaries. `pilotMetricCards` returns six cards with server value/status, relevant denominator, units, label and target. `pilotReviewState(response)` always returns `{kind:'unknown',effectiveFinding:null,history:null}` for this GET DTO. `pilotPermissions(context)` distinguishes analytical scope from routes requiring membership; supplied membership must be for the target `schoolId`. Absent curator scope/region evidence fails closed; server remains authoritative, particularly when profile omits curated region codes.

`pilotSyntheticMode(apiOrigin, queryValue)` requires origin exactly `http://localhost:8001` (optional trailing slash), no credentials/path/query/hash, and query value exactly string `'1'`. It does not accept IP aliases, HTTPS, alternate ports, booleans, arrays, or arbitrary hosts. The parent owns the visible synthetic banner, invocation with frontend `synthetic` query value, automatic invitation flag, and prevention of ordinary-production opt-in. `pilotMetricsQuery(scope, syntheticTestMode)` trusts that already-guarded boolean; it is not an origin authorization boundary by itself. `ParticipantInput` accommodates backend `is_synthetic` but the parent must never expose a user checkbox or pass arbitrary flags through normal flows.

The parent uses a separate runtime origin guard in its UI/controller. Tests of the standalone helpers here do **not** demonstrate that the parent UI uses these helpers, implements identical gating, displays a banner, clears capability state, or guards mutation retries; those integration assertions belong to the parent's tests. Likewise source inspection of the parent composable is not a live authorization check.

Tests cover source-contract shapes, optional/reissue fields, unknown reviews, validation minima/score requirements, N=0/1/5/20, 5/20 zero-error pending review, positive-error failure, small-sample criterion/completion distinction, role/region/membership gates, synthetic guard, and actual aggregate JSON nesting. Test fixtures are local illustrative objects; they do not create backend records or establish live backend correctness.

Verification on 2026-10-28: `npx vitest run tests/fe010-pilot.test.ts` passed **42 tests**; `npx eslint app/types/pilot.ts app/utils/pilot.ts tests/fe010-pilot.test.ts` passed; the latest `npm run typecheck` passed after the parent corrected its concurrent UI profile-field use. These are frontend checks only. No full frontend regression/build, HTTP E2E, or database verification was performed by this file owner.
