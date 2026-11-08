# FE010 isolated HTTP evidence

All records in this directory describe generated integration fixtures, never actual research. Mutations target only `http://localhost:8001` (nginx-test → app-test → school_events_test). Fixture PHP fails closed unless APP_ENV=testing, database=school_events_test and current PostgreSQL role=school_test_user. No application source, migration, provider, queue configuration or existing fixture is changed; no tables or records are deleted.

Run from the frontend root in PowerShell:

```powershell
$env:FE010_ISOLATED='1'
node node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/pilot-isolated.live.ts
```

The suite invokes its own PHP seeding/inspection scripts through `docker compose exec -T app-test php`. It creates only its run's schools, accounts, catalog event/source/provenance fixtures. Comparisons, persisted scenario pairs, invitations, questionnaire responses and reviews are created using actual HTTP. The sole lifecycle fixture adjustment is expiring its own unsubmitted invitation, guarded by run ownership. Existing synchronous queue configuration is checked, not changed.

`test-fixtures.json` contains run and account IDs/emails; `browser-bootstrap.json` additionally maps school IDs, comparison/request/scenario IDs and response IDs to UI states. Credentials must be derived and consumed in memory: HMAC-SHA256 using APP_KEY from the backend testing environment as key and `FE010:<runId>` as the message. No credential, invitation secret, cookie, secret hash or authorization header is written to evidence. Invitation values remain ephemeral and must be obtained afresh through HTTP for a public-form screenshot; keep their input fields masked or out of screenshots.

Live UI fixtures are retained: Zero = N0; One = N1; Five = N5; Partial = 20 responses with 5 audited; A = 20 responses with 20 audited. These are synthetic-only schools; request `include_synthetic=1` explicitly in the isolated test view. Default metrics exclude them. Real is a separate origin-filter probe with one is_synthetic=false and one is_synthetic=true generated record, both clearly test fixtures in the test database. Do not call these records real research. The backend inclusion flag means real plus synthetic, not synthetic-only.

Evidence files:

- `http-pilot.json`: sanitized request status trace, metric ladder snapshots, comparison payloads, synthetic separation and API limitations; completed=true only after every assertion succeeds.
- `kpi-expected-vs-actual.json`: independently calculated expected six KPI values against actual HTTP metrics.
- `aggregation-export.json`: actual aggregated JSON export, checked equal to the metrics endpoint; no claim of XLSX/PDF export.
- `postgresql-state.json`: guarded, own-run rows proving persisted scenarios/revisions, selection, sample origin and append-only effective review versions. Secret/hash columns are never selected.
- `browser-bootstrap.json`: retained UI fixture/account mapping, with no credentials or invitation values.

Observed backend limitations:

1. ContextSnapshotBuilder serializes claim authenticity as `effective_status`; ScenarioComparisonService checks `status`. An HTTP-created cultural comparison remains unavailable even with an approved source and verified_authentic evidence. The suite preserves and verifies this limitation instead of modifying snapshots or Laravel. Both comparison types are created over HTTP; cultural B selection is checked for 409.
2. GET response exposes questionnaire fields but neither effective expert finding nor review version history. PostgreSQL evidence independently proves versions and the effective flag; UI must state the missing read capability.
3. Ordinary invitation-management and response-read endpoints use school-membership tenant middleware. A system account without membership can access authorized analytics/reviews, but cannot use ordinary school operations. A curator also needs membership for those ordinary tenant routes.
4. Review authorization derives school from the response itself; selected X-School-Id does not constrain it. The frontend must validate its current context before posting.
5. OpenAPI questionnaire minima/nullability differ from FormRequest in places. HTTP tests follow the actual FormRequest and service contract.
