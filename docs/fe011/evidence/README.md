# FE011 isolated HTTP/PostgreSQL evidence

Scope: `tests/admin-isolated.live.ts`, `tests/backend/fe011*.php`, and this evidence directory. Laravel and Figma remain unchanged. Unit/network failure and visual checks belong to the parent implementation task.

The source attachment was read from `.codex/attachments/2a65e303-fdd6-438b-8e8e-9bf982931033/Вставленный текст.txt`.

## Fixture bootstrap

`ui-bootstrap.json` is written early, then updated with final scenario/export/review IDs and expected states after the suite passes. `test-fixtures.json` preserves the initial seed receipt. Synthetic schools A/B have region 66; C has region 77. Eight labeled users include a teacher, school admin, another-school teacher, foreign-region teacher, regional curator without school membership, system admin without school membership, inactive teacher, and teacher with A/B memberships. Inactive membership does not count toward active teachers. One live and one archived tradition prove the count excludes archived traditions.

Login password is computed only in memory as `HMAC-SHA256(APP_KEY, "FE011:" + runId)`, with the literal APP_KEY string from the isolated `.env.testing`. No password, APP_KEY, cookies or CSRF tokens are stored in these artifacts. Login/me responses are omitted from the HTTP trace.

Seed by piping `tests/backend/fe011-fixtures.php` to `docker compose -f ../school/docker-compose.yml exec -T app-test php` and save its JSON stdout to both fixture/bootstrap files. The seed refuses environments other than `testing`, databases other than `school_events_test`, roles other than `school_test_user`, and queues other than `sync`. Always use a fresh seed for a fresh full suite; records from previous runs are intentionally retained.

Run from the frontend workspace in PowerShell:

```powershell
$env:FE011_ISOLATED='1'
npx vitest run --config vitest.live.config.ts tests/admin-isolated.live.ts
```

## Evidence interpretation

`http-admin.json` is checkpointed after each response and has `completed: true` only after all assertions succeed. It records actual statuses, business request/response payloads, role and school context, without authentication material. Redirects and automatic mutation retries are disabled. The exact localhost:8001 origin is fixed, the HTTP database probe is verified before authenticated work, and all UUID mutation targets plus evidence source IDs must be in the owned fixture/HTTP-created ID set.

`postgres-*.json` snapshots query only this run's schools and their own events, sources, claims, append-only audits, scenarios and exports. `postgres-diff.json` summarizes changes in scoped table counts. The state inspector is read-only. No cleanup or record deletion is performed. Evidence detachment is an actual supported domain DELETE that retains its record and creates an audit event.

`documents/fe011-own-scenario.docx`, when present, is downloaded through real authenticated HTTP before evidence revocation. Later HTTP denial and export-history `is_downloadable: false` demonstrate that retaining a ready artifact does not bypass the live provenance gate.

## Observed API constraints to preserve

- School profile routes are outside tenant middleware. A system admin with zero memberships can GET/PATCH a school directly. A regional curator without membership cannot read/edit the profile. UI school context requirements must not be presented as backend RBAC restrictions.
- Supported profile fields are name, nullable short name, city, nullable INN, and settings address/phone/email/website/description. Region and computed counts are not edited. Settings are merged; an unrelated existing supported address survives a phone/email/description update. A 422 must leave persisted state unchanged; draft retention is a separate parent UI/unit assertion.
- Regional curator queue visibility includes federal sources; federal and foreign-region mutations and review-history access are forbidden. Source details are governed by event visibility. School membership and catalog authority are distinct.
- Source approval alone does not attest claims. Bibliographic edits create a requires_amendment review and revoke effective evidence status. The local controller includes per-claim invalidation-audit creation, but the live HTTP discovery returned only earlier attach/reverify audits after amendment. `http-amendment-discovery.json` preserves this runtime discrepancy; do not claim the missing audit was returned. Reapproval still requires each claim to be explicitly verified.
- Detached evidence returns server `effective_status: unverified`, retains its row, and preserves prior and new audit history. The UI must use server status and must not automatically sign scenarios again.
- Queue `all` is only supported for UI after actual HTTP evidence. Decision ordering is `reviewed_at DESC, id DESC`; the suite compares queue/history review IDs with scoped PostgreSQL ordering.
- Actual `status=all&per_page=5&page=1/2` calls returned 200 and correct pagination metadata, but overlapping IDs across pages. The controller orders sources only by `created_at DESC`; equal timestamps lack a stable tie-breaker. `http-pagination-discovery.json` preserves the discovery. Treat source-list pagination as unstable; this is separate from deterministic latest-review selection.
- OpenAPI is incomplete: settings schema is generic despite nested FormRequest rules; profile/source update schemas do not define optimistic concurrency or idempotency. Do not invent these guarantees. A separate actual stale scenario-lock request supplies 409 coverage.
- No users/password administration, new API, backend catalog patch, Figma change, or foreign fixture mutation is part of this task.

Known integration limits from the parent specification remain unchanged: cultural A/B status/effective_status mismatch; no read endpoint for current pilot expert conclusion; insufficient comparison_id validation; incomplete OpenAPI/calendar dates; MockLlmProvider family-scenario failure.

## Completed run

The successful live test passed in 234.22 seconds with 94 real responses. `http-admin.json` and `ui-bootstrap.json` both have `completed: true`. Status coverage is 200/201/202/204/401/403/404/409/422. ESLint and PHP syntax checks pass. `validation.json` records source hashes unchanged and the secret scan result. `nginx-own-http.log` contains 111 transport log lines matched to this run's owned IDs, including retained discovery attempts.

Discovery attempts reused this same isolated owned run; no records were removed to hide them. Accordingly, the final scoped before/after snapshots begin with two evidence rows and three audit events. The successful attempt retained both evidence rows and added six audit events, four source reviews, one scenario and one ready DOCX export. The primary evidence row ends detached and unverified; its sibling remains verified. The old DOCX artifact remains persisted, while download and creation are denied by live provenance checks. The stale optimistic-lock PATCH returned 409 without creating a new revision.

The final bootstrap includes exact source/claim/review/scenario/revision/export IDs, expected server states and the primary claim's returned audit history. Use it for parent UI checks; authentication and network-failure unit tests remain separate.
