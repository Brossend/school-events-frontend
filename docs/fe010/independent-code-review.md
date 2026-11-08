# FE010 independent code review

Reviewed 2026-10-29 against `C:/Users/bross/.codex/attachments/04f49abb-a11f-4444-8670-208d7f978aca/Вставленный текст.txt`.

Scope: `app/components/features/pilot/*`, `app/composables/usePilotApi.ts`, `app/utils/pilot-mutation.ts`, comparison utilities/composable/components/page, and relevant shared transport/session code. Laravel controllers, FormRequests, services, tenant resolver and routes were inspected read-only to distinguish implementation defects from existing contract limits. No application or backend code was changed. This report is the only intentional file edit.

## Actionable findings

### R1 — [P2] Loading another questionnaire carries the previous expert decision into its new review

**Locations:** `app/components/features/pilot/PilotWorkspace.vue:60` (`loadResponse`), `:69` (`saveReview`), `:117` (review form).

`loadResponse()` clears `response` and `finding`, but retains `reviewStatus`, `critical`, `remarks`, and `reviewConfirm`. After reviewing response A, loading response B in the same school immediately presents A's draft as B's review. `validReview` becomes true as soon as B arrives if A's error count was populated. Confirming sends those old values to B's `/reviews` endpoint and replaces B's effective finding with a new server version. A previous `audited / 0` decision is especially risky because it can incorrectly count B as reviewed and influence the sixth KPI.

**Reproduction:** load A; enter `audited`, `0`, and a response-specific remark; load B without leaving the page; observe the same values in B's review form; the next confirmation submits them for B. This is a source-traced reproduction, not an executed browser test.

**Fix:** clear all review draft/confirmation state whenever the response identity changes, before starting its GET. Bind confirmation to a captured response ID and exact draft, and invalidate it on reload/identity change. Include the response identity in the confirmation dialog. Add a component regression for A → B proving B requires fresh input and cannot inherit A's confirmation.

### R2 — [P2] Preflight read failures are falsely classified as unknown committed writes

**Locations:** `app/utils/pilot-mutation.ts:14`; `app/components/features/pilot/PilotWorkspace.vue:45` and `:72`.

The callback supplied to `mutation.run()` includes the participant-list or response GET before its POST. The helper classifies any network/408/5xx failure or plain `Error` anywhere in that callback as an uncertain write. Thus a failed GET, or the local `throw new Error('Приглашение изменилось…')`, locks every pilot mutation and tells the user a token may have been lost even though no write was dispatched. This also replaces a useful stale-invitation explanation with an inaccurate unknown-write message.

**Executed in-memory probe:** a preflight rejecting with `ApiError(503)` before incrementing the POST counter produced `posts=0`, `uncertain=true`, and the lost-token warning. No backend request was made by this probe.

**Fix:** distinguish preflight from write dispatch. Perform cancellable preflight under the same double-submit lock, but enter uncertainty tracking only immediately before invoking the POST. Represent local state conflicts as a definitive validation/conflict outcome. Verify failed GET, changed participant, lost POST response, and malformed successful POST response separately: only the latter two should retain uncertainty.

### R3 — [P2] An already-used public invitation remains submit-enabled after its definitive 409

**Locations:** `app/components/features/pilot/PilotQuestionnaire.vue:13`, `:24`, `:45`; `app/utils/pilot-mutation.ts:17`.

The public endpoint returns 409 when an invitation has already submitted a response (`PilotService::submitResponse`). The helper treats it as definitive and leaves `uncertain=false`; the component only sets `submitted` and clears the token after success, or clears the token after uncertainty. Following a 409, all required values and the same token remain populated, so the user can confirm the same one-time submission again. The backend rejects duplicates, but the UI violates the task's requirement to prevent resending an already-used token. This matters after a reload, another-tab submission, or a successful submission whose first response was lost.

**Executed in-memory probe:** calling the same helper twice with 409 yielded `sends=2`, `uncertain=false`. Component source confirms there is no additional terminal-conflict flag; the existing 409 component test checks the error and lack of automatic retry, but does not check a second explicit attempt.

**Fix:** model an already-used invitation as a terminal state for that token, clear the secret, and disable another submission with it. Do not claim the current form was saved, because this response does not disclose the saved response ID/content. Allow a different invitation only through an explicit fresh-form flow. Add a component test that receives 409 and attempts another confirmation.

### R4 — [P2] Switching tabs during invitation issuance silently loses the only returned token

**Locations:** `app/components/features/pilot/PilotWorkspace.vue:40`, `:52`, `:89`, `:98`, `:105`.

Pilot tab buttons remain enabled during create/reissue. Start issuance in the participants tab, switch to results while its POST is pending, and let the POST succeed. `execute()` assigns the returned secret to `invite` while its entire display section is hidden. Returning to participants triggers `watch(tab, clearSecret)`, erasing the token before the user can see or copy it. The server has issued a valid invitation (and for reissue invalidated the former token), but its only readable secret has been discarded. No error or recovery instruction is shown.

**Reproduction:** delay a successful create/reissue response; switch participants → results; resolve the response; switch back. This sequence was traced through source, not executed in a browser.

**Fix:** prevent internal tab changes while issuance is pending, or explicitly handle a successful issuance by showing its one-time secret in a visible dialog independent of the active tab. Keep clearing secrets on school/session change and unmount. Do not persist the token to solve the visibility problem. Add delayed-response tests for both create and reissue.

## Known API limits — separate from frontend bugs

1. **Expert finding reads/discovery are incomplete.** `PilotResponseController::formatResponse` returns no effective finding, audit status/error count, remarks, or version history. The participant list supplies `has_response` but no response ID, and there is no questionnaire-list route. The UI correctly warns about these omissions and asks for the response ID supplied by the participant. A reloadable expert queue/current-finding/history view cannot be completed using these endpoints alone. The immediate POST review result can be displayed, but GET cannot reconcile an uncertain review or restore its finding. Do not substitute zero errors or claim a successful review merely because response GET succeeds.

2. **No public submission-status GET or idempotency key.** An unknown public POST outcome cannot be confirmed anonymously. Blocking retries and directing the participant to the organizer is justified; a blind repeat is not a recovery strategy. R3 concerns a definitive already-used result, not permission to retry unknown writes.

3. **Comparison history lacks source-request and revision identity.** The index/show DTOs do not expose the original `scenario_request_id` or persisted revision IDs. Historical comparisons cannot reconstruct common request parameters, and an unknown create cannot be matched conclusively to a history row. The existing explicit history acknowledgement is a manual recovery compromise, not proof that no earlier create committed. Keep these restrictions visible in delivery documentation.

4. **Operational membership differs from analytical privilege.** Participant endpoints and individual response GET use the normal tenant route group, whose resolver requires selected-school membership even for system users. Metrics/export use analytical resolution and may allow school access without membership. The existing profile does not provide a scoped school directory or enough curator scope/region metadata to construct such a picker. Do not grant ordinary scenario rights from a system role or send arbitrary school IDs to bypass this limitation. The global-curator capability probe is server-authorized; regional curators receive a refusal for global aggregates.

5. **Optional response `comparison_id` is not validated for ownership/consistency by the service.** `CreatePilotResponseRequest` validates UUID shape only; `PilotService::submitResponse` assigns it directly, while separately verifying the scenario's school. A nonexistent UUID can fail its FK and a foreign existing comparison may be attached. Anonymous frontend code cannot securely establish this relationship through authenticated comparison APIs. Record this as an existing backend contract/integrity limitation, not a frontend authorization guarantee. No backend change was made or is requested by this review.

6. **Completion is not all-six-KPI success.** `PilotService::calculateMetrics` defines completion using target sample, full audit coverage, and zero counted critical errors; other criteria can still fail. The UI says completion is according to server data and displays individual criteria separately. Do not describe that completion flag as proof of overall effectiveness.

## Security and KPI checks without a confirmed finding

- Invitation secrets are transient refs, rendered only in the issuance panel and explicitly copied to clipboard. The reviewed production paths do not write them to local/session storage, console, analytics, evidence, or invitation URLs. Public submission uses a separate client without session/error callbacks and `tenant:false`; the public route uses `no-referrer`. This is a source-review conclusion, not an assurance about browser extensions, server infrastructure, or external telemetry.
- `usePilotApi.guard` checks context before/after successful requests; resources and mutations use cancellation/generation checks. Workspace reset clears secret, response, finding, and loaded data on context change/unmount. Comparison context reset is synchronous and its transport validates school and object IDs. I did not confirm a reproducible cross-tenant late-response disclosure. Pilot's context watcher uses Vue's default scheduling; any future refactor should retain context checks after awaits and test delayed reads/writes across school/session changes.
- `PilotMetrics` explicitly prevents zero errors with partial coverage from being shown as the sixth criterion PASS, and its completion condition additionally requires full coverage. A 5/20 audit does not satisfy completion. Null error counts remain null; no finding is represented as unknown. No confirmed false 5/20 completion bug was found.
- Real metrics/export omit `include_synthetic` by default. Pilot synthetic controls are restricted to the exact isolated origin, and invitations created there are forced synthetic. Public questionnaire synthetic identity derives from the participant on the server. The comparison origin guard is less strict about URL path/query/hash than the pilot guard, but still requires the localhost:8001 origin; this inspection did not establish a production-data leak from that difference.
- Export is allowlisted aggregate JSON, not an XLSX/PDF or individual-answer export. Cultural references are displayed as requiring verification, with safe source links; variant availability and teacher preference are not presented as factual verification or statistical proof.

## Verification actually performed

- Ran `npx vitest run tests/fe010-workflows.test.ts tests/fe010-comparisons.test.ts tests/fe010-pilot.test.ts`: **3 files, 117 tests passed**, Vitest 5.0.5, exit 0.
- Ran two no-file, in-memory Node probes against transpiled `pilot-mutation.ts` / `api-error.ts`: confirmed R2's zero-POST uncertainty and R3's repeat eligibility. These are focused probes, not HTTP/component E2E tests.
- No new test files were written. R1 and R4 are source-traced findings and still need targeted component regressions from the parent.
- Did not run the full regression suite, typecheck, ESLint, production build, live HTTP E2E, visual checks, or database verification during this review. The user's reported **462 previously passing tests** remain prior-run context and are not claimed as rerun evidence here.
- `git status` is unavailable because this workspace is not a Git checkout. No Git diff cleanliness claim is made.

Parent should fix R1–R4 and run focused regressions plus the required delivery checks. Existing backend limits should remain explicit in acceptance/release documentation; this review does not authorize backend edits.

## Resolution re-review — 2026-10-29

This addendum supersedes the outstanding R1–R4 fix requests above. Reviewed the updated parent files and seven added workflow regression cases read-only. Only this report was edited during re-review. **R1–R4 are resolved for their reported reproduction paths; no new actionable defect was identified in these fixes.** The API limitations documented above remain applicable.

| Finding | Resolution evidence | Status |
| --- | --- | --- |
| R1: draft carried to another response | `PilotWorkspace.vue:62` rejects loads during a pending mutation, resets review status/count/remarks and both confirmation refs before loading, and advances the response epoch. `prepareReview` captures response ID, epoch, and a separate exact request body; `saveReview` checks identity/epoch and uses that captured body. The returned finding is displayed only when its response ID matches the original response and the response epoch is unchanged. Context reset also clears the captured draft. The new A → B component regression verifies blank count/remarks, reset status, disabled submission and no POST. | Resolved |
| R2: preflight failure called an uncertain write | `pilot-mutation.ts:9` accepts a distinct preflight callback under the existing pending lock. Dispatch tracking remains false until preflight succeeds and the context/epoch/signal check passes. Preflight exceptions retain their useful error without uncertainty or reconciliation. Invitation participant GET and review response GET now use this callback. New cases cover 503/local preflight failure with zero writes and malformed post-dispatch results retaining uncertainty. An independent in-memory probe additionally checked the lock during a delayed preflight and confirmed that context reset prevents POST after that preflight eventually resolves. | Resolved |
| R3: used token remains submit-enabled | `PilotQuestionnaire.vue:26` recognizes a definitive 409, clears token/feedback, and enters a terminal used-invitation view. Both the form and submit handler block the previous attempt; the terminal copy does not claim that this particular form was saved. The only new-form action explicitly clears every field, confirmation and mutation state. The added component regression verifies the terminal view, removal of the secret/form, one submit, and explicit blank-form restart. This does not introduce persistence or pretend to reconcile an unknown public write. | Resolved |
| R4: tab switch discards an unseen token | `PilotWorkspace.vue:104` disables all three internal tab buttons while the mutation lock is pending, including preflight and issuance. Delayed-response regressions for both create and reissue attempt the tab switch and verify that the returned one-time secret remains visible in the participants panel. School/session changes and unmount still clear secrets, as required. | Resolved |

### Verification performed for this re-review

- Independently ran `npx vitest run tests/fe010-workflows.test.ts tests/fe010-comparisons.test.ts tests/fe010-pilot.test.ts`: **3 files, 124 tests passed**, exit 0. The workflow file now contains 30 cases; the supplied `workflow-review-fixes.log` also records 30 passing workflow cases, but the 124-test result here is from this independent rerun.
- Ran a no-file in-memory Node assertion probe against the updated mutation helper: a pending preflight blocks a second invocation, and a school/context reset followed by late preflight resolution dispatches zero POST callbacks. Exit 0. No actual HTTP request or backend mutation was performed.
- Independently ran `npm run typecheck` (`nuxt typecheck`): **passed**, exit 0, with no diagnostics.
- The new draft-reset regression does not open the review confirmation before switching responses, and does not exercise captured-body immutability, loading while POST is pending, or mismatched returned finding identity. Those safeguards were checked by source inspection; their existence is not claimed as executed component coverage. These are optional coverage improvements, not additional confirmed bugs or reasons to reopen R1.
- Did not run the full regression suite, ESLint, production build, live HTTP E2E, visual checks or database verification during this re-review. No claim is made that the earlier 462-test suite was rerun. These focused checks do not replace the parent's remaining delivery verification.
