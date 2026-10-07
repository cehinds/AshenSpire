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

After integrating the current creation defaults and primary attribute bonuses, completed-boot pointer checks reached the first played card in six inputs for both a random seed and the pinned skills-only seed. Two unchanged local canonical attempts timed out at the initial 20-second document-ready wait before reaching the title; these are retained as failures, separate from the completed-boot flow evidence.

The integration also retains the Armory hub from PR #1671: Character, Armory and Edit Deck navigation, shared attribute allocation, and skill/feat inspection. Inspection reads the run's saved catalog and card grades. Its text-migration fixture remains protected after those rows have entered `dev`, so the guard cannot silently lose its subject after promotion.

The current creation stat/relic dialogs passed 38 browser assertions across desktop and phone, including viewport fit, Escape dismissal, focus return, preserved selection and entry to the map. Forty affected creation/progression unit tests passed. Independent snapshot review passed 50 model tests and 111 reward-confirmation checks; an old-rule earned character retained its stat coefficients, XP, earned ledger and spent pools through atomic retraining and save/reload under the new defaults.

## Cost-preview equivalence

The simulator's lazy first-card selection preserves the original leftmost legal choice. The engine avoids a detached pricing clone only when the canonical event bus has no preparation listener, no queued or paused work, and a live nonterminal board. Custom buses, hooks and uncertain contexts retain the detached path; actual plays remain transactional.

Parity tests compare every decision, refusal, saved combat state and RNG counter over 24 real fights across all four classes. Separate checks cover preparation hooks, ally ownership, live Mana discounts, queued work, custom buses and terminal-board event-limit failures. The balance report retains all 300 seeds per encounter and class.

## Reviewed targeting integration

The complete Node suite on integration baseline `d890c5439` exited zero: 167 suite checks passed, zero failed; its discovered batch covered 302 files and 2,761 tests with zero failures. Later installer/map/targeting commits require their own current-head CI and affected checks; the baseline result does not certify those subsequent edits.

Independent review of that targeting integration found a truncated component-catalog tail, incorrect owner binding in co-op smoke tools, and redundant full previews for ordinary friendly cards. The tail is restored. Bot queries bind the requested co-op seat in a detached candidate, and live target queries skip the numeric preview only under the same conservative bus/queue/hook conditions as pricing. Actual plays remain transactional.

Measured full-combat copies for ordinary cards are zero for a solo target query, one for a detached co-op owner query, and one for the actual solo or co-op play. Preparing listeners retain one copy for a bound query and two for a detached owner query. Charged self cards preserve enemy aiming, wrong-side atomic refusal, charge consumption and RNG purity. New and corrected parity fixtures compare legal defensive plays, every decision, saved state and RNG across all four classes. The focused parity run passed 15 tests; broader targeting/entry/owner checks passed 57 tests, and a separate progression/owner review passed 41 tests. These runs overlap and their counts must not be added together.

The complete balance report regenerated successfully after the targeting fixes, retaining 300 seeds per class/encounter row (48 section-five rows, 14,400 encounter cases). It is byte-identical to the committed current-stat report: SHA-256 `67190aa4b22dcfe117ca698d8c553a00bc1b1cb0749f56b31ed1024fb9b2aa71`. No balance-report drift was hidden or waived.

The incoming target strip originally failed center-point access on two layouts because an intent control covered a button. Measured placement now reserves a clear band, and overhead packing uses final ribbon-adjusted vertical bounds across formation rows. Nineteen affected geometry tests pass. The normal 14-screen-pixel anchor is retained unless a measured ribbon intersection needs clearance; artwork heights and grounds match the pre-fix measurements.

The accepted browser run exited zero across eight layouts: 320×568, 375×667, 390×844 and 1440×900, each with two and three enemies. It checked 48-pixel target access, actual target-button card commits, wrong-side pointer atomicity, intent exposure and ribbon/HUD/hand/overhead clearance, with zero runtime exceptions. Map history exited zero across four entrance/visited-route layouts, preserving committed history during inspection. Evidence is in `integrated/remote-ac7-target-accepted/` and `integrated/remote-ac7-map-route-final/` under the workspace authoring directory. Earlier target collisions, bootstrap timeouts and invalid supplemental animation fences remain recorded. An extra posed player-Information pointer probe remains unresolved fixture evidence; this run does not certify that separate inspection route.
