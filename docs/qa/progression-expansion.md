# Modular progression validation

Implementation follows SPEC §13.4r and [the detailed plan](../design/progression-expansion.md).

## Content and save boundaries

- Cards, feats and relics are independently registered modules. The module-composition tests exercise all eight combinations and still reject unknown references.
- Forty new class card families supply six procedural grades each. Fifty feats, fifty ability tags and ten relics feed class reward lists through catalog metadata.
- Manual claims persist their offered identities and earned grades. INT, RNG and higher-rank choices are retained across reload and retraining.
- Retraining previews changes before Apply, preserves unrelated loot and current resources, and cannot recreate spent class rewards or repeat skill XP.
- Existing saves select their captured progression and numeric card definitions. Independent review compared 2,640 legacy card faces and 1,476 ability cost faces across default and modified configuration snapshots.

## Browser evidence, 2026-10-06

Production co-op screen checks passed 42 assertions at desktop 1440×1000 and phone 390×844, using the actual authoritative host session. This covered Class → Character → gained skills, manual claims, deferred residual animation, class skill bonuses, seat isolation, failed-save rollback, once-only retry, and restored XP receipt history. Both runs recorded zero browser errors and zero failed requests.

Phone screenshot review found the appended progression section could collapse the reward door's scrollable body and hide Continue. Progression now occupies that same body. The rerun checked the painted Continue button with a center-point hit test and verified the shared scroll container, in addition to inspecting screenshots.

Class retraining was exercised at desktop 1365×900 and phone 390×844 through Preview, Apply and Cancel, including focus restoration. Solo ability-choice checks exercised save refusal, persisted choices, out-of-order claims and duplicate families at different earned grades.

Evidence from this workspace is under `D:/repos/.codex/authoring/progression-implementation/integrated/` (the `coop-production`, `coop-xp` and `xp-sequence` folders) and `D:/repos/.codex/authoring/progression-respec-qa/`.

These browser checks cover the production component and real host authority in one local browser harness. Physical-device and separate-machine LAN acceptance remain unperformed. Build and full-suite results must be read from the associated pull request and CI; this document does not substitute for those gates.

## Initial offers and the Armory hub

Initial ability offers and veteran milestone entitlements are saved as deferred choices after the required class-tree selection. Entering the map does not require an extra reward door. The unchanged Quick Start browser probe passed 13 checks, with six inputs for the normal path and five for the skills-only path. Failed saves restore the whole run and every RNG stream; retry reproduces the same offered identities.

The integration also retains the Armory hub from PR #1671: Character, Armory and Edit Deck navigation, shared attribute allocation, and skill/feat inspection. Inspection reads the run's saved catalog and card grades. Its text-migration fixture remains protected after those rows have entered `dev`, so the guard cannot silently lose its subject after promotion.

## Cost-preview equivalence

The simulator's lazy first-card selection preserves the original leftmost legal choice. The engine avoids a detached pricing clone only when the canonical event bus has no preparation listener, no queued or paused work, and a live nonterminal board. Custom buses, hooks and uncertain contexts retain the detached path; actual plays remain transactional.

Parity tests compare every decision, refusal, saved combat state and RNG counter over 24 real fights across all four classes. Separate checks cover preparation hooks, ally ownership, live Mana discounts, queued work, custom buses and terminal-board event-limit failures. The balance report retains all 300 seeds per encounter and class.
