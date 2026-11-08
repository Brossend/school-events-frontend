# FE010 comparisons contract

Implementation is limited to the comparison types, utilities, composable, feature components, `/comparisons`, and `tests/fe010-comparisons.test.ts`. Laravel, shared API client, global navigation, Nuxt configuration and styles are owned by the parent.

## Sources read

Read-only inspection: `school/AGENTS.md`, `routes/api.php`, `ScenarioComparisonController`, `ScenarioComparisonService`, `CreateScenarioComparisonRequest`, `SelectScenarioComparisonVariantRequest`, `ScenarioRequestController`, `MockLlmProvider`, and `docs/openapi.yaml`. Backend bootstrap/install instructions do not apply because no backend changes are made.

Design: Mill's `Figma-inventory.md` and saved high-fidelity `figma/context-100-1014.txt`, `context-100-1567.txt`, `context-100-1750.txt`, plus the inventory's responsive specifications. Personalization screens: 100:1014 / 100:1209 / 100:1384 / 100:1567; cultural screens: 100:1750 and inventory siblings. There are no approved dedicated create/type chooser, immutable confirmation or history frames; these controls use the existing UiField/UiSelect/UiTextarea/UiButton/UiModal/UiAlert kit. No Figma writes.

## Actual HTTP contract

All paths below are relative to `/api/v1`, use Sanctum credentials, current `X-School-Id`, a captured user/school/role context, AbortSignal, and `reportError: false`.

| Method | Path | Request / response |
| --- | --- | --- |
| GET | `/scenario-requests/{id}` | Existing saved request; verify both returned ID and school before showing/creating |
| GET | `/scenario-comparisons` | `{data: ComparisonHistoryItem[]}`; all school's comparisons, newest first, no server pagination/filter |
| POST | `/scenario-comparisons` | `{scenario_request_id, comparison_type}`; 201 `{data: Comparison}` |
| GET | `/scenario-comparisons/{id}` | `{data: Comparison}` with two persisted variants and immutable selection |
| GET | `/scenario-comparisons/{id}/variants` | `{data: ComparisonVariants}`; real payloads, labels, cultural_provenance_data |
| POST | `/scenario-comparisons/{id}/selection` | `{selected_variant: 'A'|'B', selection_reason, cultural_usefulness_rating?}`; `{data: Comparison}` |

ComparisonOperationOverrides in `app/types/comparisons.ts` must be registered by the parent in the shared API client. The actual Laravel envelope is richer than OpenAPI: show/create/selection include school_id, selected_by_user_id, selection_recorded_at, usefulness, availability, is_synthetic, and created_at. Variant provenance is an array (OpenAPI loosely says object). Runtime parsers reject foreign schools/IDs, missing availability, duplicate variant keys, invalid usefulness and malformed payloads.

Create supports both `universal_vs_personalized` and `cultural_context`. Laravel creates the pair synchronously in a transaction and saves Scenario/ScenarioRevision records, with unavailable cultural B represented by `scenario_id: null`, `is_cultural_available: false`, and an explanatory payload. The client never fabricates stages, roles or a second scenario. UI displays actual concept/goal, audience, stages, roles, format/mechanism, materials/tasks/outcomes, differences_summary and source references. Saved documents link to existing `/scenarios/{id}`.

There is **no request listing endpoint**. Enter an existing request ID or use `/comparisons?request=<saved-request-uuid>` from the saved request page (parent adds the link). Read common source parameters from that fetched saved request. History/show do not expose scenario_request_id, so the client cannot reconstruct an original request from a historical comparison; it does not infer a potentially cloned request from variant B. Neither comparison endpoint exposes persisted revision IDs or live moderation/signoff state. The saved document link provides the existing revision viewer; comparison availability never implies moderation approval.

## Isolation and mutations

No is_synthetic input exists. Only when `new URL(public.apiOrigin).origin === 'http://localhost:8001'` and the URL has no credentials does the transport add literal `is_synthetic: true`; all other origins omit the field. The same guard controls a visible isolated-test banner. Parsed synthetic comparison envelopes also display a synthetic label. Runtime DTOs exposed to the form omit is_synthetic, and the transport builds an allowlisted body rather than forwarding arbitrary caller fields.

Mutations require an authenticated selected-school teacher/school_admin membership; a global system role alone does not grant these UI actions. Laravel remains the final authority. Creation fetches the ScenarioRequest again immediately before POST, including exact school verification even for system administrators. Selection requires an explicit reason of at least 10 trimmed characters, optional integer cultural usefulness 1–5, an available persisted variant and completed comparison. An explicit modal confirms immutable A/B choice and exact reason; final preflight GET rechecks ownership, status and existing selection. Double submission is blocked.

409 never overwrites an existing choice: re-fetch show/variants to display server state. Network/408/5xx/unparseable mutation responses conservatively retain an uncertain state. Selection recovers with GET show/variants; if GET confirms a selection, show that selection. If GET remains unselected or fails, another POST remains blocked. Creation recovers through GET history, without guessing the newly created item: history has neither original request ID nor idempotency key. A separate explicit user acknowledgement after reviewing a nonempty history enables a new create; there is no automatic retry. Shared api-client's existing definitive 419/CSRF retry is tolerated, unchanged.

Operations time out by abort after 60 seconds; uncertain state remains and a manual GET recovery control is offered. Context generation and captured context checks guard each awaited operation, including final preflight; context watcher synchronously resets/aborts and clears request, history, comparison, variants, reason/confirmation, and errors. No comparison payloads, reasons or snapshots are written to localStorage/sessionStorage, logging, analytics or evidence. State lives only in the mounted page/controller.

Provenance references from payloads do not carry current effective verification status. UI explicitly says factual verification is required, shows supplied source names/citations and only safe HTTP(S) links. It never marks facts verified just because B exists or because Laravel's variant_label contains “verified”. Missing evidence remains missing; no zero-error or expert approval is fabricated. Teacher preference is explicitly distinguished from statistical effectiveness.

## Shared CSS needed from parent

No style files were edited. Parent's fe010 CSS should implement:

- `.comparisons-page.fe010-page`: vertical gap24, full available width, min-width:0, overflow-wrap:anywhere.
- `.fe010-heading`, `.fe010-eyebrow`: Figma heading29–30px bold #1b3544 (23 mobile), eyebrow12 semibold #08784f, subtitle13 #5d7685.
- `.comparison-grid`: two equal `minmax(0,1fr)` columns gap16 at desktop/tablet (570px each at1440 content1156;344px each at768 content704), one column on mobile390/360 (358/328 content width).
- `.comparison-card`: white, border1 #d8e5ec, radius14, padding20/gap13, min-width:0; padding16 mobile. h2 19px #1e4157 (18 mobile).
- `.comparison-card--b h2`: #08784f. `.comparison-card--selected`: clearly visible selected outline/badge; never rely on color alone.
- `.comparison-section`: gap5; h3/label12 semibold #1f4f6c; body13 #39586b (12 mobile); lists wrap with safe padding. `.comparison-provenance` uses same rules.
- `.comparison-actions`: flex/wrap gap12; card actions stack full width with45px height/radius9. Secondary view button #e9f1f8/#26516b, choose button #08784f/white.
- `.comparison-create`, `.comparison-selection`, `.comparison-differences`: existing ui-card spacing with readable section gaps; `.comparison-form` grid gap16; controls full width and no fixed content width.
- `.comparison-history`, `.comparison-history__list`: section gap12, list-style:none, padding0, stacked cards gap12; IDs wrap.
- Caution: existing UiAlert warning adapted to #fff3e4/p12/r12, body12 #765e40; selection reason/blockquote must wrap.

Page uses accepted app layout and UI kit; do not duplicate sidebar/header. Include history, creation and selected/uncertain states in the parent visual harness. Check1440/768/390/360, particularly long IDs, source links, source snapshots and stage text.

## Verification

`tests/fe010-comparisons.test.ts` covers both types, actual endpoints/bodies, exact isolated-origin guard, school verification, persisted A/B identities, unavailable cultural B, immutable A/B confirmation/preflight, network/408/500/409 GET recovery, no automatic retry, double submission, context/abort, no storage/logging, distinct stages/roles and provenance rendering. Run alongside all previous345 tests; no previous test was edited. Parent owns combined lint/typecheck/build and HTTP/visual integration across FE010.

Checks run on the shared workspace, 2026-10-28: all52 comparison tests passed; final full Vitest run passed439 tests across14 files (including the original regression files); owned-file ESLint passed; final `npm run typecheck` passed; `npm run build` passed. Earlier typecheck failures were in concurrently edited pilot files and were resolved by their owner before the final run. No HTTP mutations or visual screenshots were performed by this comparison implementation; parent owns isolated HTTP and integrated responsive visual checks after adding comparison CSS.
