# Wireframe validation — 2026-09-12

Validated reference source at 0fd283ab with the expanded validator in this change.

- Atlas validator: 152 entries, 608 responsive views, 14 JSON documents, nine isolated HUD renderers, zero failures.
- Catalog IDs are unique and agree with the gallery; parents/children and source bindings resolve; inheritance has no cycles; each view has a diagram and placement table; every entry has model, defaults and pseudocode.
- Embedded code snapshots match source. Published component/HUD JSON matches source defaults. Formation capacity, equal row gaps, guard anchors, selection growth/focus and faction-independent fit pass.
- Rebuilding with node docs/architecture-handoff/build-reference.mjs --source-root D:/repos/AshenSpire leaves all 35 HTML/JSON/Markdown files byte-identical.
- node tests/run-node.mjs: 138 core tests passed, zero failed; additional card removal/touch, selection, action service, projection, starting equipment and armament combat-kit suites passed.
- node tools/verify-shipped.mjs: passed existing shipped-artifact checks.
- node tools/buildversion.mjs --check: eight checks passed.
- Browser smoke check: combat composition renders 12 combatants and five selectable hand cards in wide, compact, iPhone SE and Galaxy S24 modes.

## Scope

Structural and JSON checks cover every catalog entry and all four view definitions. Browser smoke coverage is the combat composition in four modes, not an exhaustive visual or interaction audit of all 608 views. Shipped-artifact checks inspect the existing game bundle; this documentation work does not rebuild or change game runtime behavior.

Run the repeatable atlas checks with node docs/architecture-handoff/validate-reference-atlas.mjs.
