# FE-010 Figma inventory and implementation handoff

Read-only research of file `yM3uywBNWGprDE61hxKK3V`, 2026-10-28. Existing session reused. Skills: figma-design-to-code and figma-use. No Figma canvas, app, styles, or backend mutations.

## Evidence

20 full high-fidelity design contexts, each initially requested with screenshot and `skillNames: figma-design-to-code`; no sparse responses. 20 official metadata responses. 20 reference PNG exports obtained with official `download_assets` and downloaded with its prescribed curl workflow. 60 SVGs from context-provided official URLs; no uploaded raster fills. Temporary asset URLs removed from saved contexts and replaced by local public paths. Screenshots are reference evidence only.

`asset-manifest.json` maps every screen to context, screenshot, and exact local assets. `file-screen-inventory.json` includes all section-level screens across the file. `prototype-and-expert.json` contains all 60 pilot reactions, expert evidence, and comparison CTA reaction counts.

## Screens

| Family | 1440 | 768 | 390 | 360 |
|---|---|---|---|---|
| Teacher protocol | 105:1186 | 105:1603 | 105:1980 | 105:2373 |
| Required fields error | 110:1608 | 110:1717 | 110:1809 | 110:1908 |
| Results (no data) | 105:1403 | 105:1800 | 105:2185 | 105:2578 |
| Universal vs personalized | 100:1014 | 100:1209 | 100:1384 | 100:1567 |
| Cultural context vs none | 100:1750 | 100:1945 | 100:2120 | 100:2303 |

For node `105:1403`, read `figma/context-105-1403.txt`, `figma/metadata-105-1403.txt`, and `figma/screenshots/105-1403.png`. Other filenames follow the same convention.

## Shared layout

Inter family, regular/medium/semibold/bold. Background #eef2f8; white cards. Desktop sidebar 220px, header 76px, 4px green-to-teal-to-blue line (#079d66 → #087e94 → #2155bc). Desktop content width 1156px (32px side gutters after sidebar). Tablet has no sidebar, 76px header and compact text navigation; 704px content with 32px gutters. Mobile header 68px, compact navigation with 19px icons, content 358px/328px at 390/360 with 16px gutters. Main content flex-column gap24, top32 desktop/tablet or24 mobile, bottom40.

Actual Figma defines four explicit frame widths, not CSS breakpoint rules. Choose project breakpoints to reproduce these states. Do not copy fixed design frame widths into fluid containers.

## Results: exact high-fidelity structure

Results are explicitly a no-data design despite the frame name “20 педагогов”. Subtitle says no measurement has been made and thresholds are separate from actual results. No charts, KPI tile grid, completed-success sample, or fabricated percentages are present.

1. Eyebrow “ПИЛОТ · 20 ПЕДАГОГОВ”: 12px semibold #08784f; heading “Результаты пилотного теста”: 30px bold #1a3443 desktop/tablet, 23px mobile; subtitle13 #5b7385; heading group gap8.
2. Amber sample panel #fff3e4, radius14, padding22 desktop/tablet or16 mobile, gap8. Heading “0 из 20 · данные ещё не введены”:21 bold desktop/tablet or18 mobile #93591e; explanation12 #765e3d.
3. “Критерии и доказательства”:21 bold #1b3545, then SIX FULL-WIDTH STACKED metric cards, gap12. Each white, 1px #dbe5ec, radius14, padding20 desktop/tablet or16 mobile, internal gap7. Metric title15 semibold #1c4053; target13 semibold #08784f; actual12 #6a7d8c; explanatory text12 #506f80. Targets: median time≥50%; personalized preference≥70%; ≤20% edits for≥70% of teachers; cultural usage≥60%; usefulness≥4/5; critical cultural errors0. Actual value says “нет данных” in all six.
4. Blue method panel #e8f1fc, padding14/radius14/gap7, title13 semibold #1759b6, body12 #375f7a.
5. Full-width secondary protocols CTA48px, border#c7d9e4, radius10, text13 semibold #22536d; footer11 #526779.

Server actuals, sample counts, PASS/FAIL/pending_review and review coverage must fill this visual structure. Do not carry the prototype’s “20 individual percentages” explanatory assumption into server logic where current valid sample differs. User brief calls usefulness of cultural context while design labels generic usefulness; backend contract and task govern semantics.

## Comparisons

1440: two570px white cards separated16; 768: two344px cards separated16; 390/360: vertical stack358/328 with16px card padding (desktop/tablet20). Cards border#d8e5ec/radius14/internal gap13. Title19px desktop/tablet,18mobile. A title#1e4157, B#08784f. Subtitle12 #5c7484. Section label12 semibold #1f4f6c; body13 desktop/tablet or12mobile #39586b; label/body gap5. CTA45px/radius9: A “Просмотреть” #e9f1f8 with#26516b text; B “Выбрать вариант” #08784f/white. Amber caution below: #fff3e4/p12/r12/gap7; heading13 #85591e/body12 #765e40. Comparison heading29 bold #1b3544 desktop; exact smaller widths available in contexts.

Personalization headings: “Один повод — два разных сценария”; universal “Без параметров школы”; adapted example “6Б · 25 человек · 45 минут · 5 групп”. Four sections: Участники / Ход занятия / Организация / Материалы. These are illustration content; use actual saved scenarios/revisions.

Culture heading: “Культурная часть без стереотипов”. Columns Без культурного контекста / С культурным контекстом; sections Тема / Упражнение / Источник / Результат. UNESCO is design example calendar evidence; regional examples explicitly require editorial verification. Never assume a B variant’s facts are verified.

## Protocol and validation

White form border#d7e4eb/r14, padding24 desktop/tablet or18 mobile, gap17. Input wrapper gap5; inputs47px high/#fafcfd/border#c7d9e3/r9/left13. Choices use19px square outlines #b8c9d5/r5, row32px/gap10; use semantically exclusive native controls for exclusive answers. Expert caution #fff5e8/p12/r14. Data note #eaf3fd/p12/r14. Green full-width save48/r10.

The mockup asks code, event theme, baseline/AI minutes, count of edited sections0–7, preferred version, cultural usage, usefulness1–5, critical error count, evidence/comment. The current API remains authoritative: do not add unsupported fields, substitute count for percent, or expose expert review mutations to public respondents. Embedded expert block105:1387 says to record count and expert-act link and explicitly forbids treating it as automatically checked. Placeholder “0 только если эксперт подтвердил отсутствие”.

Validation family preserves form and adds an error overlay; use the high-fidelity error contexts for exact geometry. Prototype Save from normal protocol navigates to required-fields error, and Return navigates back; it does not establish successful submission behavior.

## Missing states and bounded adaptations

Complete section-level inventory across all file modules found no dedicated A/B type chooser, create-pair form, comparison history/list, preparing/error variants, A/B reason-confirmation dialog, locked selection screen, invitations table/create/reissue/revoke/token dialog, questionnaire success/token errors, standalone expert editor/version history, partial sample/review coverage, or completed result state. Existing scenario-constructor and AI-check modules are other product flows, not evidence for these missing FE010 screens.

All sixteen comparison CTAs (view/choose ×2 families ×4 widths) have zero prototype reactions. No hidden selected-state destination was discovered. All60 pilot prototype reactions belong to protocol/error/results navigation, not comparisons. Therefore implement missing states with existing UI-kit and the documented card/input/button tokens; label these as implementation adaptations rather than approved Figma frames. Source API, tenant/RBAC and research-integrity semantics from parent’s backend analysis.

## Local asset use

Public paths are `/icons/fe010/<node-id>-house.svg`, `...-calendar-days.svg`, `...-files.svg`, `...-school.svg` for desktop/mobile as present in each context. Tablet compact navigation contains text, no SVG assets. Keep original SVG root dimensions; use the wrapper size19 mobile/20 desktop as specified. Partner badge and gradient line are native layout/text, not external bitmap assets. No whole-screen screenshot may be used as application UI.

Verification: all 20 PNGs and 60 SVGs downloaded non-empty; three references visually inspected (desktop personalization, mobile results, desktop validation). PNG dimensions and SVG root dimensions are recorded in `figma/download-validation.json`. Sixteen PNGs match frame dimensions exactly. Four validation exports reveal actual design overflow: desktop error export1661px versus frame1440; tablet769 versus768; mobile391 versus390; compact361 versus360. Desktop backdrop110:1709 starts at x221 with width1440 and therefore extends221px beyond its1440px parent. Preserve the reference as exported evidence; implement a viewport-bounded backdrop/dialog using the existing UI-kit to satisfy the task’s no-overflow requirement. This is a documented adaptation to a source-layout defect. This is Figma research only; no app test/build claims.

