# FE011 independent code review

Review date: 2026-10-30. Final independent code-review outcome: **PASS — R1–R4, including R4b, verified fixed. No open actionable findings remain in this review scope.**

Scope: the attached FE011 task (`C:/Users/bross/.codex/attachments/2a65e303-fdd6-438b-8e8e-9bf982931033/Вставленный текст.txt`), school profile utilities/controller/API/workspace, catalog controller/API/workspace, reused FE003 provenance components/resources, shared API transport, and the actual Laravel controllers, requests, service, routes and relevant schema. Backend inspection was read-only. Initially only this report was authored. At the user's subsequent explicit request, the reviewer also authored `tests/fe011-review-regressions.test.ts`. No other files were edited; no build, HTTP mutations, database changes or CSS changes were performed.

## Final outcome for parent handoff

The independent reviewer verified all reported code defects closed and retained all 29 regression tests, including the previously failing cross-source rebase test. The independently executed focused run passed **143/143 tests across 5 files**. The parent's subsequent full `npm test` result was checked directly in `docs/fe011/vitest.log`: **588/588 tests across 19 files passed**, run started at 03:37:33. This is the parent's full-suite execution, with its saved result inspected by the reviewer; the reviewer did not rerun or alter that log.

The parent reports a tablet navigation-wrap correction after actual visual inspection. The reviewer confirmed the corresponding `.compact-nav .app-nav { flex-wrap:wrap; }` and flexible link rules are present in `app/assets/css/fe011.css:71`–`72`. The visual result belongs to the parent's browser verification and was not independently re-rendered in this code review.

**No code-review blocker remains for proceeding to the parent's build and archive steps.** Build success, archive contents/checksum and final browser acceptance must be recorded by the parent when completed. The contract gaps documented below remain explicit integration limitations, separate from open frontend defects. This outcome does not claim those release steps have already passed.

## Latest re-review and regression tests

The new regression file runs the actual catalog controller and mounts the actual catalog workspace. Component tests use native model-control stubs and the real `UiButton`, preserving disabled-button behavior. They invoke visible form actions rather than private setup methods. Backend services are stubbed; no live requests or mutations occur.

| Finding | Re-review result | Regression coverage |
| --- | --- | --- |
| R1 | Fixed | All four mutation kinds × source/claim/queue GET failure: 12 controller cases verify one write, blocked submissions and selection, failed recovery, successful GET-only recovery, and no replay. Three mounted-workspace cases verify the accepted-write notice and disabled forms through GET recovery. |
| R2 | Fixed | Four successful-then-failed reconciliation cases (source/claim/queue/history) revoke the old flag and prevent acknowledgement. Accepted and unknown writes both require successful history loading. Ordinary source browsing may still show details when history fails. |
| R3 | Fixed | Three mounted-workspace cases change principal, system role or school role while keeping the same school. All evidence fields, checkbox, reason, bibliography draft, expert comments and decision are checked after the change. |
| R4 | Fixed, including R4b | Two mounted-workspace cases preserve the edited title, take a fresh untouched author, require another explicit confirmation, and PATCH only the title. They cover an external author-only change and an external title-and-author change. A third case verifies that selecting another source prevents an old conflict from restoring the previous source. |
| 422 preservation | Verified | Mounted-workspace test keeps the entered title and displays the server field error without inventing an accepted-write recovery state. |

Latest validation:

- After the parent added `conflict.value = null` in `selectSource()`, reran `npx vitest run tests/fe011-review-regressions.test.ts tests/fe011-school.test.ts tests/fe011-catalog-data.test.ts tests/fe003.test.ts tests/api-client.test.ts`: **143 passed; 5 files; zero failures** (2026-10-30, 03:35 local test-run timestamp). All **29 new regression tests** and all 114 previously focused tests pass. The previously failing R4b regression was retained unchanged; no tests are skipped or marked as expected failures.
- `npx eslint tests/fe011-review-regressions.test.ts`: **passed**.
- Parent full-suite evidence inspected: `docs/fe011/vitest.log`, **588 tests / 19 files passed**. The complete historical 469-test regression is included in the parent's expanded regression responsibility; this log reports aggregate results rather than an individual historical-test inventory. Parent also reports typecheck/ESLint passing after the fixes. Build/archive and browser acceptance remain parent-owned; this review does not certify unfinished release steps.

### R4b — closed: previous source conflict carried into another selection

Locations: `app/utils/catalog-admin-controller.ts:49`–`52` and `app/components/features/catalog/CatalogWorkspace.vue:35`–`43`.

Before the fix, `selectSource()` cleared the source, history, claim and confirmation, but retained `conflict`. The workspace displayed the retained conflict alongside the newly selected source, and `rebaseDraft()` checked only that a conflict and baseline existed. Clicking the old rebase button installed source A as `source.value` while `c.sourceId` and its ID input still identified source B. This replaced B's displayed fields with A's data and could misdirect a subsequent edit.

Reproduced through mounted component actions: edit A's title; change its server author; confirm to get a conflict; load B by ID; open bibliography; click the retained rebase button. B's ID input remains `...0005`, but the title changes from `Другой выбранный источник` to A's `Исторический сборник`.

Regression, now passing: `does not offer a previous source conflict for rebasing a different selected source`, `tests/fe011-review-regressions.test.ts:379` (assertion near line 401).

Fix verified: the parent now clears `conflict.value` before loading a selected source. The unchanged regression confirms that B's fields remain B's after the selection, so the root cause is removed. An additional ID comparison inside rebase would be defensive hardening, not an outstanding blocker for this reproduced bug. The reviewer did not modify controller/workspace because the user restricted ownership to the test file and this report.

## Original findings — historical detail, superseded by the re-review above

### R1 — [P2] A committed catalog mutation loses its recovery barrier when the following GET fails

Location: `app/utils/catalog-admin-controller.ts:110`–`112`; recovery/prepare guards at lines 59–60 and 115. Compare the explicit `needsReconcile` handling in `app/utils/school-controller.ts`.

The write-error catch ends before `synchronize()`. After a successful POST/PATCH/DELETE, a failed synchronization only produces an ordinary error and clears `pending`; neither an accepted-but-unrefreshed state nor a write barrier remains. The success notice still says the action was saved. If claim/source GET succeeds but a subsequent GET fails, forms can already be available with their previous review/evidence input. If the first GET fails, reselecting the object also bypasses any dedicated recovery step.

Runtime reproduction using the actual controller with stub services: attach resolves, refresh claim GET rejects. Result: `writes=1`, `uncertain=false`, `pending=''`, `claim=null`, error `refresh unavailable`. Restore GET, select the same claim and confirm the retained action: `writes=2`. There is no automatic replay, but the UI lacks a distinct GET-only recovery state and makes repeating an already accepted non-idempotent action an easy response to the error.

Requested fix: retain an accepted-but-needs-refresh flag until all required reconciliation reads complete; explain that the write succeeded and only the read failed. Offer GET recovery, preserve drafts, and prevent new writes until that recovery completes. Add a controller/UI regression for success followed by source/claim/queue GET failure, asserting exactly one write throughout recovery.

### R2 — [P2] Failed reconciliation can retain a stale successful-reconciliation flag

Location: `app/utils/catalog-admin-controller.ts:41`–`46`, `107`, `115`–`116`.

`reconcile()` invalidates displayed server data without first clearing `reconciled`. After an unknown write has had one successful automatic GET reconciliation, a later manual reconciliation can fail while leaving `reconciled=true`. The acknowledgement button then clears the uncertain-write barrier even though the latest GET failed and there is no displayed server state to inspect. Separately, `readSource()` swallows history GET errors, so a source/reviews/queue reconciliation can be declared complete without refreshing review history.

Runtime reproduction: review POST rejects with 500; automatic reads succeed. Make the next source GET fail and call `reconcile()`: `{source:null,reconciled:true,uncertain:true,error:'GET offline'}`. Calling `acknowledge()` then yields `{source:null,uncertain:false}`. A separate probe with history GET failing produced `{uncertain:true,reconciled:true,historyError:'history offline'}` and also allowed acknowledgement.

Requested fix: clear the reconciliation flag at the beginning of every reconciliation attempt; set it only for a complete, current-context set of required successful reads. Make synchronization distinguish a partial read from a fully reconciled state. Keep ordinary browsing able to show a source with an unavailable history, but do not use that partial result as successful mutation recovery. Test success-then-failure and partial-history recovery explicitly.

### R3 — [P2] Evidence source input survives a principal/tenant/role reset

Location: `app/components/features/catalog/CatalogWorkspace.vue:16`, `32`–`34`, `51`–`63`; attach field in the evidence form.

The context watcher resets the controller, bibliography draft and comments, but never clears `evidenceSource`. The claim-ID watcher clears locator/excerpt/year/notes/verify/reason but also omits this source ID. A new context opening a claim directly therefore sees the previous context's selected source UUID in an actionable form. This violates the task's explicit requirement to clear old user/school/system-context data; it can also prefill an unrelated or inaccessible source for the new user's evidence action. The server still enforces authorization and cross-event binding.

Runtime reproduction using the current compiled workspace setup and Vue effects: user A selects source `...0001`; change the reactive context to user B in the same school (so the layout tenant key does not remount); user B opens claim `...0002`. Result: `{source:null,claim:'...0002',evidenceSource:'...0001'}`.

Requested fix: explicitly clear all catalog form and confirmation-related values on context reset, including `evidenceSource` and decision/verification selections. Initialize a source ID only from data deliberately selected in the new context. Cover principal and role changes without a tenant-ID change in a component test.

### R4 — [P2] Fresh GET cannot recover a source-edit conflict while retaining the user's draft

Location: `app/utils/catalog-admin-controller.ts:86`; `app/components/features/catalog/CatalogWorkspace.vue:25`–`40` and the “Перечитать статусы” action.

PATCH preflight detects an external bibliography change but does not install the fresh source as the conflict baseline. The user can then explicitly reread statuses and receive the new source, yet the workspace's `baseline` remains old because its initializer only runs when the source ID changes. Preparing the retained draft uses that old baseline and produces the same 409 indefinitely. The available “Заполнить из текущих данных” workaround replaces the draft, requiring the user to discard or manually copy their unsaved work.

Runtime reproduction with the current workspace setup: edit title locally; another curator changes author; confirm returns `SOURCE_CHANGED`. Call `c.reconcile()` and confirm the edit again. Result: `{error:'SOURCE_CHANGED',patchWrites:0,serverAuthor:'Concurrent author change',baselineAuthor:null,preservedDraft:'My revised publication'}`.

Requested fix: provide an explicit conflict-comparison/rebase path that updates the server baseline while preserving user changes and requires a fresh confirmation. Avoid silently overwriting concurrently changed untouched fields when rebasing. Test a change to an untouched bibliography field as well as a conflict in the user's edited field.

## Contract gaps and intentional product restrictions — separate from bugs

- **DELETE reason is optional on Laravel.** `CulturalClaimController::detachEvidence` defaults an omitted/null reason and imposes no maximum. The UI/controller require nonblank text and cap it at 2000 (`catalog-admin-controller.ts:67`, evidence form). This is a stricter product restriction, not server validation. Either document the intentional policy or align it with the API. The important all-active-records scope is correctly explained in the UI and confirmation.
- **Preflight is not atomic concurrency control.** The existing GET then mutation sequence has no version/ETag precondition or idempotency key. A concurrent amendment/detachment between GET and write remains possible. Record this as a backend contract limitation for FE012; do not claim frontend preflight guarantees atomicity or add blind retries. No backend change is requested in FE011.
- **Generated mutation DTOs are incomplete.** The narrow local overrides correctly handle the smaller source PATCH response and evidence attachment/DELETE envelopes. Keep the actual controller shapes authoritative; do not replace these overrides with the generated full-detail assumption. Source-detail linked claim `verification_status` is already dynamically evaluated by Laravel; claim-detail evidence separately supplies stored status, `effective_status`, and `is_detached`.
- **Settings shown only in Figma lack confirmed backend behavior.** The school contract already records academic-year/class/duration/resource-switch gaps. Do not present those as working persisted settings or add arbitrary settings JSON.
- **Regional visibility is not mutation permission.** Federal/null-region sources can appear in the queue while their review/evidence operations return 403. Existing server denials must remain visible. Controller branches also differ for missing events, but the current schema has a nonnullable cascading event FK; this review does not promote a hypothetical orphan fixture into a reachable production bug.

## Initial review checks and boundaries — historical record

- Ran `npx vitest run tests/fe011-school.test.ts tests/fe011-catalog-data.test.ts tests/fe003.test.ts tests/api-client.test.ts`: **4 files, 114 tests passed**. Existing test files were not changed. The full historical 469-test regression and expanded suite remain parent-owned; this focused run does not certify them.
- Ran additional in-memory probes against the actual TypeScript controller and compiled Vue setup via Vite/TypeScript/Vue. These used stub services and no live HTTP. They reproduced R1–R4 without adding files. Vue setup probes used an effect scope with explicit controller reset; they are behavioral probes, not a rendered browser test.
- School paths retain role/target/principal context keys, abort/reset protection, preflight, duplicate-write prevention, preserved drafts/422 details, GET-only unknown-outcome recovery, and a separate accepted-write refresh barrier. `/school` has no tenant-required route rule; school API requests use `tenant:false`, matching Laravel system-admin access without membership. No actionable school bug was established in this pass.
- Catalog service guards include principal/system role/school/school role, validate returned object identities, and allowlist outgoing fields. No blind network/5xx mutation retry was found. The shared client's existing one-time 419 CSRF refresh is a known rejection recovery, distinct from an unknown-outcome replay; retain its existing regression tests.
- FE003 `ClaimContent`/`EvidenceRecord` use effective status and detached state; source approval does not confer claim authenticity. Audit records remain rendered. All-active detach preflight, explicit confirmation and server count checks are present. No alternative provenance gate or automatic scenario signing was found.
- At the initial review, catalog data tests covered DTOs, validators and FE003 reuse without catalog controller/workspace lifecycle tests. The reviewer subsequently added the 29 lifecycle regressions described above, and all now pass.

## Concurrent changes observed

An earlier workspace read lacked cancellation for the async route/context watcher and a guard after `confirmAction()` awaited the controller. The parent updated `CatalogWorkspace.vue` during review: the current file has `viewEpoch`, captured route/context values, checks after awaits, unmount invalidation, a context/source check before draft reinitialization, and bibliography-draft clearing. A current-code probe confirmed the old bootstrap completion no longer overrides user B's later source selection or draft. That earlier issue is **not an open finding**. R3 concerns the source-ID form value still omitted from that reset.

Final code re-review is complete: **PASS**, with R1–R4/R4b closed. No independent visual approval or completed build/archive is implied; those remain parent release evidence.
