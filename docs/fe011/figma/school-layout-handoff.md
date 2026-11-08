# FE011 school layout handoff

Read-only Figma session `5e034bc6-9aa6-482c-ac8e-c92b9bf62dd0`, file `yM3uywBNWGprDE61hxKK3V`. Exact contexts, official metadata and PNG references live beside this file. See `../Figma-inventory.md` for confirmed scope versus UI-kit adaptations.

| Width | Frame | Natural size | Context | Reference |
|---|---|---|---|---|
| Desktop | 1:497 | 1440 × 1466 | context-1-497.txt | screenshots/1-497.png |
| Tablet | 42:352 | 768 × 1428 | context-42-352.txt | screenshots/42-352.png |
| Mobile | 42:537 | 390 × 1641 | context-42-537.txt | screenshots/42-537.png |
| Compact | 50:2038 | 360 × 1673 | context-50-2038.txt | screenshots/50-2038.png |

All four are editable profile forms. There is no distinct profile display/edit switch, saved/error destination, admin screen or settings route in the discovered file. Twelve real reactions are navigation only; all four Save buttons have empty reactions (`overflow-and-save.json`).

Desktop: sidebar220; header76; content32px horizontal and top, gap24, bottom40. Content1156 wide = form828 + gap24 + hints304. Form cards gap20, padding24, radius16, border #d8e4ec, shadow0 4 20 rgba(23,60,39,.06), internal gap16. Main heading30 bold/#182b36; subtitle14/#576b7a. Header Save44 high, radius10, #08784f, padding18 horizontally, icon17 and text14 semibold. Demo alert blue #dbeaff, padding16, radius10, info20. Basic info: name full width; region/locality two equal columns gap16; year full width. Class defaults: three equal columns gap16. Label13 semibold, value14 regular, line-height1.5, white inputs min-height46/radius10/border#d8e4ec, padding12 vertical/14 horizontal. Hints contain teacher48px avatar and data-usage explanation; school profile explicitly does not verify cultural facts.

Tablet: no sidebar; header76 + text-only navigation. Content704 at32px gutters; top32, gap24. Heading29 semibold/#19313f. Cards full-width/padding20/radius16 with no desktop border/shadow. Basic fields all stacked; class three columns gap12 (213.333px each). Label12/#294355, value13/#1f3744; input46 high/#f9fbfd/border#d6e3ed/radius10/left14. Demo alert#e5f0ff/p14/r12/gap6. Resources use19px checkbox, gap10,35px rows. Full-width48px Save/r11 at bottom uses a text checkmark, no SVG. No teacher/data-usage cards.

Mobile390/360: header68; nav icons19 with11px labels in four equal items. Content358/328, gutters16, top24, gap24. Heading24 semibold. Same card/input tokens as tablet; all class fields stack. Card inner widths318/288. Resource labels are shortened and descriptive subtitles omitted. Save full-width48px at bottom. Footer11/#526779 wraps. At360 partner badge narrows and moves; preserve responsive fit instead of copying absolute partner coordinates from390. Four explicit design widths are evidence states, not declared CSS breakpoint values.

Mock fields: school name, region, locality, academic year, class, student count, duration; resources projector/screen, teacher computer, speakers, paper/pens, internet. First four resource choices checked, internet unchecked. These are demonstration values; runtime fields and permissions must follow the existing server contract. Desktop resource wording is longer than tablet/mobile. Preserve distinctions between selected school, editable profile and role authorization; no Figma admin affordance establishes backend permission.

Exact assets: `/icons/fe011/1-497-{house,calendar-days,files,school,info}.svg`20×20; `1-497-save.svg`17×17; `1-497-check.svg`15×15. Mobile `/icons/fe011/{42-537,50-2038}-{house,calendar-days,files,school}.svg`19×19. Tablet has zero external assets. The partner mark and avatar are native text/layout. `asset-manifest.json` records every asset variable, local path and design slot; `download-validation.json` records original SVG root attributes and SHA256. Reuse exact matching existing icons/components where available; keep SVG roots unmodified.

Sent promptly to Ramanujan `01a187a9-6e79-7152-8e0b-8c7a194ed79e`: desktop context/inventory first, then all four contexts/metadata/PNGs/assets, actual reactions and responsive differences. Parent messaging was attempted but rejected because the target is a native ancestor; parent handoff is preserved in `catalog-handoff.md` and final response.
