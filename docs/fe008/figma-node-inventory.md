# FE-008 Figma inventory

Read-only research of `yM3uywBNWGprDE61hxKK3V`, 2026-10-27. High-fidelity contexts: `design-<node>.txt`; reference PNGs: `figma/`. No Figma mutations.

| State | Desktop | Tablet | Mobile | Compact |
|---|---|---|---|---|
| Format selection | 82:456 | 82:716 | 82:901 | 82:1093 |
| Preparing | 91:752 | 91:1567 | 91:2148 | 91:2750 |
| Ready | 91:1296 | 91:1955 | 91:2550 | 91:3152 |
| Error | 91:1023 | 91:1760 | 91:2348 | 91:2950 |

DOCX selected: 110:2068. Print references: 104:1186, 104:1220, 104:1254, 104:1288. Slide references: 104:1331, 104:1343, 104:1355, 104:1367, 104:1379. Total: 26 design contexts.

Prototype reactions: 82:700 → 110:2068 (DOCX), 82:714 → 91:752 (create), 91:1294 → 91:752 (retry). No reactions were returned for preparing/ready roots. These are states of one modal, not separate routes.

Selection/ready use white dialogs around 510–520 px, rounded corners, Inter typography, green selection (#e5f5ec / #0f9166); preparing uses a pale blue state panel. The 17×17 download SVG is saved at `public/icons/fe008/download.svg`. Ellipsis/check status marks are text glyphs.

The supplied selection design shows PDF/DOCX. The task adds PPTX and Print Pack using the same card pattern. Composition checkboxes in the design have no API contract and are omitted. No distinct history frame was found in the inspected nodes; revision history uses the existing UI-kit list in the same dialog. Backend documents retain their existing server templates; print/slide references are not recreated in frontend code.

Screenshots from Figma are whole-node renders, not browser captures. Browser files prefixed `fixture-` are explicitly marked synthetic component fixtures; `live-` files come from authenticated app-test sessions. Responsive measurements, including the tablet DPR rounding to 767 CSS px, are recorded in `screenshots/metadata.json`.
