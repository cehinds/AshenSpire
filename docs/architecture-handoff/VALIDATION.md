# Documentation validation — 2026-09-12

- Static atlas validation passed: 151 entries, 604 responsive views, complete required metadata and ten HUD renderer checks.
- Real-browser audit passed: 151 entries × four layouts × three preview tabs = 1,812 preview panels; no construction, empty-content, finite-layout or checked item-card ratio failures.
- Targeted visual/interaction checks covered HUD composition, progression award preview, portrait category navigation, selected-card actions, delayed inspect and inspector placement. These exposed and led to fixes for inherited navigation sizing, overlapping meter labels and inspector footer constraints.
- `node tools/verify-shipped.mjs`: six checks passed. `node tools/buildversion.mjs --check`: eight checks passed.
- No full node-suite pass is claimed. Game source and generated game bundles are unchanged. Browser checks exercise documentation fixtures, not production gameplay or physical devices.

Run `node docs/architecture-handoff/build-reference.mjs` then `node docs/architecture-handoff/validate-reference-atlas.mjs`. Serve with `serve-reference.mjs`; the atlas includes a repeatable browser audit under Reference validation. See [CURRENT-SOURCE-AUDIT.md](CURRENT-SOURCE-AUDIT.md) for the inspected checkout and unrelated source conflicts.

## Synchronization audit

All 151 entries were checked for four diagrams, placement tables, pseudocode, configuration, model data, valid inheritance/child references and bound renderer/style sources. The validator now compares every embedded actual-code snapshot against its source file and verifies HUD JSON matches generator defaults. HUD track/fill independence and footer-only Potions are checked in executable reference code. HUD ASCII is generated from the same sample values and scale configuration as the examples. Combatant metadata no longer inherits item-card geometry defaults. The repeated browser audit rendered all 604 views and 1,812 panels without construction or finite-layout failures. These checks establish reference coverage and synchronization, not exhaustive semantic equivalence or production gameplay correctness.
