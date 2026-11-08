# FE011 Figma inventory and implementation handoff

Read-only research, 2026-10-29. File `yM3uywBNWGprDE61hxKK3V`; one session `5e034bc6-9aa6-482c-ac8e-c92b9bf62dd0`. Skills read from Figma17.0.0: `figma-design-to-code`, `figma-use` and Plugin API index. User reference: `Usertaskattachment2a65e303-fdd6-438b-8e8e-9bf982931033` (identifier supplied in task; no attachment contents were exposed here). No Figma design mutations or backend/app/style edits were performed. Outputs are confined to this inventory, `docs/fe011/figma/` and `public/icons/fe011/`.

## Immediate catalog findings

Confirmed source UI: **88:650** is a source-verification modal over the calendar; **99:1013** is a regional/cultural candidate calendar with source links and editorial warnings; **112:1444** is a scenario checks-and-sources protocol. Full high-fidelity contexts are `figma/context-88-650.txt`, `figma/context-99-1013.txt`, `figma/context-112-1444.txt`. Their four-width families are listed below. These are evidence for the existing FE003 visual language and read UI, not approved standalone catalog mutation forms.

No standalone claim detail/editor, source bibliography editor, expert-review submission/history, curator queue, evidence attach/detach, catalog create/edit/admin, school admin or separate settings frame was found. The source modal does contain an official-source field, teacher checkboxes and a disabled Confirm button; do not describe all forms as absent. What is absent is the dedicated operational/admin form for the required backend mutations. `114:1482` (“Культурный каталог”) actually navigates to `99:1013`, not an admin editor. Source and cultural calendar frame families have zero prototype reactions. Protocol reactions are navigation and return-to-scenario only.

Implement required missing catalog forms as documented UI-kit adaptations, reusing existing FE003 `SourceInspector.vue`, `SourceContent.vue`, `ClaimContent.vue`, `EvidenceRecord`, `ProvenanceStatus` and shared UI components. Current repo reuse points were inspected read-only. Preserve source-level review separately from evidence/claim verification. Details and overflow repair: [catalog handoff](figma/catalog-handoff.md).

## Discovery and evidence

All15 sections and every direct child were freshly enumerated; `figma/file-screen-inventory.json` preserves the full result. A second independent scan inspected names across10,643 nested frames/components, yielding relevant settings/profile/catalog/expert candidates; `figma/nested-discovery.json` saves them. Inventory was not restricted to the four starting school IDs or previous FE003 documents. Relevant descendants, actual reactions and destination IDs were inspected separately. This is bounded negative evidence from the current file structure and named nested frames; it does not claim that future designs or external files cannot contain more forms.

20 high-fidelity `get_design_context` calls requested screenshots, with no sparse response requiring decomposition.20 official metadata files and20 PNG references from official `download_assets`, downloaded with prescribed curl.79 exact SVGs downloaded from context-provided official URLs; no uploaded raster fills. Every context asset URL was replaced by a local `/icons/fe011/...` path. No temporary asset URLs are persisted. Whole-screen PNGs are reference evidence only, never app imagery.

| Family | 1440 | 768 | 390 | 360 |
|---|---|---|---|---|
| School editable profile | 1:497 | 42:352 | 42:537 | 50:2038 |
| Source and reliability modal | 88:650 | 88:890 | 88:1111 | 88:1243 |
| Regional/cultural source cards | 99:1013 | 99:1261 | 99:1490 | 99:1630 |
| Checks and source protocol | 112:1444 | 112:1539 | 112:1617 | 112:1702 |
| Embedded expert warning | 105:1387 | 105:1784 | 105:2169 | 105:2562 |

Filename convention: `figma/context-<ID-with-hyphen>.txt`, `figma/metadata-<ID-with-hyphen>.txt`, `figma/screenshots/<ID-with-hyphen>.png`. Expert entries are embedded blocks in the pilot form, not full expert screens. Additional expert warnings110:1691/1783/1882/1981 belong to pilot validation frames; these were found during nested discovery, not mistaken for editor routes.

## School profile and adaptation

The school section contains exactly four editable profile forms, with basic details, default class parameters and resources. There is no separate saved, validation, read-only profile, admin or settings destination. All four Save button reactions are empty. Twelve school reactions are three navigation links per width. [School handoff](figma/school-layout-handoff.md) records exact layout differences and asset dimensions; it was shared promptly with Ramanujan.

Desktop content1156 = form828 + gap24 + hints304. Sidebar220, header76, content32px gutters, cards24px padding/r16/border/shadow, heading30 bold, Save44px in header. Tablet content704 with32px gutters, no sidebar, text navigation, heading29 semibold, no hints, all basic fields stacked, default-class fields three columns. Mobile content358/328 with16px gutters, header68, four19px nav icons, heading24 semibold, class fields stacked. Tablet/mobile cards use20px padding and omit desktop border/shadow; Save48px full-width at the bottom. Desktop teacher/data-usage hints and detailed resource subtitles are omitted at smaller widths. These are intentional responsive compositions, not a uniform scaling of desktop. Four explicit widths do not define CSS breakpoint rules.

School display values are fictional examples. Profile settings do not confirm cultural facts or replace teacher review. Loading/save/error/forbidden/conflict states and any server-supported fields absent from the mockups need UI-kit/API adaptations. The backend contract governs permissions and payloads.

## Source, claim and expert semantics

Source modal panels88:869/1090/1222/1354 show missing official-source evidence, three teacher checks, caution and disabled Confirm. No actual close/confirm/review submission reaction exists in these frames. Do not derive a verification workflow or authorization from checkbox illustrations.

Cultural cards remain candidates: a found legal source still requires editorial review; UNESCO calendar evidence does not validate local practices; a2026 announcement does not confirm2027 recurrence. Source review must not automatically promote every linked cultural claim. No dedicated claim-evidence review form was found. Existing FE003 detail/history UI remains a functional adaptation using shared components.

Protocol112:* displays unconfirmed demonstration machine categories, sources, unassigned editor/date and separate uncompleted teacher assessment. Each width has five reactions (four navigation links plus return to the width-matched scenario). Embedded expert blocks105:* request count plus expert-act link and explicitly say the field cannot be considered automatically verified. They have no reactions. See `figma/prototype-and-expert.json` for exact text and reaction objects, including the TOC destination.

## Exact exports, assets and source-layout defect

| Node | PNG width × height |
|---|---|
| 1:497 / 42:352 / 42:537 / 50:2038 | 1440×1466 / 768×1428 / 390×1641 / 360×1673 |
| 88:650 / 88:890 / 88:1111 / 88:1243 | 1661×1390 / 769×1961 / 398×2007 / 368×2186 |
| 99:1013 / 99:1261 / 99:1490 / 99:1630 | 1440×1513 / 768×1618 / 390×1924 / 360×2070 |
| 112:1444 / 112:1539 / 112:1617 / 112:1702 | 1440×1133 / 768×1206 / 390×1335 / 360×1389 |
| 105:1387 / 105:1784 / 105:2169 / 105:2562 | 1108×62 / 656×62 / 322×92 / 292×92 |

The four source exports exceed nominal frame widths. Read geometry confirms root clipping is off; desktop backdrop88:868 starts x221 and spans1440, ending1661. Tablet backdrop starts x1. Mobile panels start x24 and have widths366/336, reaching the right edge; rendered stroke bounds add further overflow. `figma/overflow-and-save.json` records actual API geometry. Preserve exports as evidence; implement a viewport-bounded existing `UiModal` and prevent horizontal document overflow.

Every exact SVG path, context variable and design slot is in `figma/asset-manifest.json`; every file byte count, SHA256 and root width/height/viewBox is in `figma/download-validation.json`. School desktop nav/info20×20, Save17×17, checkbox check15×15; school mobile nav19×19; tablet has no SVGs. Other screens retain their exact context dimensions, which must be read from the manifest/validation rather than normalized by a global icon size. Keep downloaded SVG roots intact. Partner badges, initials and gradient lines are native text/layout, not bitmap assets. Existing assets may be reused only when they are exact matches.

## Validation and delivery

`figma/validate-downloads.ps1` checked20 PNG headers/dimensions,79 nonempty SVG roots/hashes,20 context files and absence of temporary asset URLs. Seven references were visually inspected: all four school widths, mobile source modal, desktop cultural calendar and mobile protocol. Sixteen PNGs match their source dimensions; four source overlays have the documented overflow. No application tests/build were run or claimed for this research-only scope.

Ramanujan `01a187a9-6e79-7152-8e0b-8c7a194ed79e` received paths and layout findings in three direct messages. Parent delivery via `send_message_to_thread` was rejected because `01a172ee-3795-7e20-ad91-2bbb734dceba` is a native ancestor; no native agent-messaging tool is exposed here. Immediate catalog findings are preserved above and in `figma/catalog-handoff.md` for the parent's implementation handoff.
