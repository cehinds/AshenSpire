# Compact armaments runtime evidence

Production `mountEquipment` with the real content registry and a deterministic Reaver run, tested in headless Edge at 1440 × 1000 (mouse) and 390 × 844 (emulated touch). The final browser run passed **47 checks: 46 behavioral/layout assertions plus a clean browser-health assertion**. No JavaScript exceptions, console errors, or failed HTTP responses were observed.

The run covers complete scaled card thumbnails; compact occupied, empty and locked rows; Inspect and mobile Back without mutation; first-tap inventory disclosure; read-only hold; reserve selection versus activation; replacement and storage return; explicit destination choice; requirement/storage refusals; priced combat callback refusal; and target sizing at 65% UI zoom.

- [Desktop list](desktop-armaments.png)
- [Desktop Inspect](desktop-inspect.png)
- [Mobile list](mobile-armaments.png)
- [Mobile Inspect](mobile-inspect.png)
- [Machine-readable browser receipt](validation.json)

Reproduce from the repository root with `node tools/armament-equip-flow-qa.mjs`, setting `CHROME` to the Edge/Chromium executable and `TEMP`, `TMP`, and `TMPDIR` to a D: temporary directory. The harness creates its own inert host. Current art packs must be available.

Focused model/component/trading regressions passed 19/19, including four new compact-layout contract tests. Component catalog regressions passed 47/47. These screenshots were visually inspected. This evidence does not claim a full game playthrough, physical-device acceptance, or CI/merge validation.
