# FE-011 school owner contract / coordination

Owned: app/types/school.ts, app/utils/school*.ts, app/composables/useSchoolProfileApi.ts, app/components/features/school/*, app/pages/school.vue, tests/fe011-school.test.ts, this document. No backend, Figma, shared API or styles edits.

Parent integration: import `SchoolOperationOverrides` from `app/types/school.ts` into shared api-client LocalOverrides. This corrects actual nullable fields and settings shape. No new routes.

CSS selectors requested: `.school-page`, `.school-profile-header`, `.school-profile-heading`, `.school-profile-grid`, `.school-profile-card`, `.school-profile-details`, `.school-profile-statistics`, `.school-profile-stat`, `.school-profile-form`, `.school-profile-fields`, `.school-profile-actions`, `.school-profile-confirm`, `.school-profile-target`. Existing UiButton, UiField, UiAlert, UiModal are reused. Research Figma handoff required before UI edits.

Read-only investigation: actual SchoolProfileController, UpdateSchoolProfileRequest, School model, settings references in app/tests, docs/openapi.yaml and backend AGENTS.md. Backend AGENTS bootstrap mutation does not apply: backend reads only are authorized; no installation or edits performed.

GET and PATCH `/schools/{id}` return real counts (nonarchived traditions and active users with teacher membership) and timestamps. Region and all counts/dates are read-only. Full name (3–255), short name (nullable, max 100), city (2–100), INN (nullable, 10/12 digits) are writable. Supported settings only: address max 255, phone max 50, email max 255/email, website max 255 string, description max 1000. Website is plain text, not rendered as an unsafe link and not falsely URL-validated: server only requires string.

The School settings cast is array; controller uses array_merge. Send only supported changed keys. Unknown settings are retained in read DTO and never echoed into PATCH, so server preserves its authoritative unknown settings. Empty settings `[]` is accepted from PHP. No arbitrary JSON editor. Settings usage search found no further application behavior beyond the controller/request/model and profile tests; no invented scheduling/notification settings.

Membership permits reads; own-school school_admin permits edits. system_admin permits targeted reads/edits without membership, after explicit existing-ID GET confirmation. catalog_curator regional scope gives no school privilege. `/school` must not set tenant:true route metadata. `/profile` is untouched.

Coordination note: ancestor chat messaging tool rejected parent update (native ancestor limitation); parent can read this coordination file and final handoff. No build will run in this owner session.

## Figma handoff consumed / CSS requirements

High-fidelity contexts: docs/fe011/figma/context-{1-497,42-352,42-537,50-2038}.txt. All four corresponding PNGs visually inspected. Use existing shell; do not reimplement its navigation. Exact save SVG: `/icons/fe011/1-497-save.svg` at intrinsic 17×17 in desktop heading. UI uses real data rather than Figma demo-organization warning. Forms and mutation states are necessary UI-kit additions: research confirms 12 navigation-only reactions and no Save/error destinations.

Parent CSS: desktop `.school-profile-grid` = minmax(0,1fr) 304px / gap24; `.school-profile-form`, `.school-profile-details` vertical gap20; `.school-profile-card` grid gap16 / padding24 / radius16 / border/shadow. `.school-profile-fields` = 2 equal minmax(0,1fr) columns. Desktop heading save visible; hide the bottom save (first `.school-profile-actions` button) only on desktop while retaining reset. At <= 1024 match tablet: one column, hide `.school-profile-details`, hide heading save, show bottom save 100% width / height48; cards padding20 and no border/shadow, labels12 and value13. Tablet region/city fields stack as Figma; mobile all fields stack. Mobile heading24 semibold. Header description/gaps should wrap; all cards/inputs min-width0, overflow-wrap:anywhere for UUID/email. Reset may occupy its own line. Required real counts/dates are in `.school-profile-summary` in main form flow at every width; aside contains only the two optional hints, so it can be hidden safely. Add `.school-profile-server-values` styling as normal card with wrapping dl for user comparison after reconciliation/conflict.

Known Figma/API gaps: academic year, class default, student count, duration, resource switches do not have confirmed typed settings or consuming backend behavior. Omitted instead of pretending these persist or influence generation. Real short name/INN/contact fields and read counts/dates replace those unsupported demo controls. Region is server code because profile API returns no region label.

Mutation guarantees: snapshot confirmation for identity fields, rechecked payload/context, GET preflight, no double write, late response isolation, draft and field-error preservation for 422, unknown PATCH outcomes trigger GET only and block writes until explicit GET verification, successful PATCH always followed by GET; failed success-refresh stays write-blocked until GET succeeds. GET preflight changes cause 409 with updated server baseline and preserved draft; visible server-values disclosure permits comparison. System explicit UUID is never sent as X-School-Id membership: target path is authorized by Laravel directly, tenant:false.

## Owner validation (2026-10-29)

- `npx vitest run tests/fe011-school.test.ts`: **44 passed**.
- Owned-file ESLint (types, both utilities, composable, workspace, page, test): **passed**.
- `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`: **passed**, after parent registered SchoolOperationOverrides. The earlier settings Record<string,never> diagnostic is resolved by the actual override; no weakening cast required.
- No build, full regression, HTTP writes, or PostgreSQL mutations executed by school owner. Parent retains full 469-test regression, integrated build, real isolated backend evidence, and rendered responsive visual QA. Figma reference PNGs at all four widths were inspected here; final runtime screenshots depend on parent's CSS integration.
