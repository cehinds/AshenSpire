# Selected stance delivery status

The selected Reaver/greatsword poses and runtime integration are complete. Independent source reviews are approved. The final unpatched artifact is build **0.7.1.1417**, digest **b1ec8952f6**, from source commit [`e8efd0244`](https://github.com/cehinds/AshenSpire/commit/e8efd0244), which corrects reaction playback timing/readiness/defeat handling. [PR #1890](https://github.com/cehinds/AshenSpire/pull/1890) merged into Dev at [`5852a791b`](https://github.com/cehinds/AshenSpire/commit/5852a791b59024235c826249a0704bc8d0e034d6).

| Role | Selected source |
| --- | --- |
| Sweep | Smash04 |
| Counter | Smash06 |
| Guard-break | Guard-break06 |
| Evade | Smash08 |
| Smash | Smash05 |

Guard-break03 is contextual reference only, not a sixth selection. Exact crops and hashes remain in the [selection manifest](../../../pose-studio/stances/update-stances/selections.json); export provenance is maintained by the [selected-weapon exporter](../../../tools/selected-weapon-profile-export.mjs). The five full/mobile exports, Sprite Workshop project, and runtime registration are complete.

Runtime eligibility is default-armour Reaver with the sole actual greatsword in either active hand and the other hand empty. Painted holds use both hands. Pure Dodge prepares and holds Evade; mixed counters remain Counter. Guard-break and successful Evade use finite reactions and restore the newest held pose. The pilot does not add new full attack or retaliation sequences.

| Validation | Result |
| --- | --- |
| Independent runtime review | Approved, 34/34 checks |
| Core suite | 150 passed, 0 failed |
| Corrected source assertion | 10/10 |
| Selected poses, mobile fit, unsupported-scope checks | Passed on 0.7.1.1415; art/layout are unchanged in 0.7.1.1417 |
| Actual guard-break and successful-Evade receipts | Passed on final build 0.7.1.1417; no page errors |
| Final-head fast CI | Passed: core suite, all four discovered-test shards, preview, receipts, Workbench and Quick Start browser checks |
| Evidence | [Final 1417 reaction QA](../../preview/update-stances-selected-20261012/1417/README.md) and [1415 held-pose/mobile QA](../../preview/update-stances-selected-20261012/1415/README.md) |

The 0.7.1.1417 change is limited to reaction playback, so the 0.7.1.1415 selected-pose and mobile screenshots remain representative. The browser checks use the actual starter loadout and authored cards. For the finite-reaction proof on 0.7.1.1417, a deterministic registered Colossus Smash supplies the incoming move, while the game engine emits the receipts; Guard-break and successful Evade restore their held poses, and no page errors occurred. The 57/57 focused source review covers reaction timing/readiness/defeat handling and identity/order fixtures. Mobile QA completed its geometry and scope assertions; its shell reported 11 benign Chromium vibration user-activation notices, with zero application exceptions or relevant errors. The selected scope remains default-armour Reaver with a sole greatsword; other weapons, classes, and armor appearances are not covered by this pilot.

The user authorized delivery and merge without another approval request. The separate follow-up is ten new greatsword options each for Sweep, Counter, and Evade, thirty total. All thirty follow-up concepts are integrated and director-reviewed; all thirty are director-approved concept candidates. Sweep17, Counter15 and Evade20 use approved standalone replacements with the same option IDs; their old board figures are superseded, and selection requires the replacement images to load. These concept boards do not replace any selected runtime art. [Follow-up review record](followup-art-review.md) tracks actual sources, flags and provenance. Co-op remains paused.


## Latest sequence-order review (2026-10-12)

The delivered original five runtime poses remain historical PR #1890 scope. New image choices are now being compared as labeled sequences before gameplay wiring. Primary shared Guard / Parry / Resisted interior is D → V → G → H → C → D. Counter adds S → AT1…AT6 → originating stance (canonical C). Attack and Smash use the six supplied attack images and return to their own origin; Evade uses EV1…EV3 and returns to its origin. All six held origins can be compared in the preview; no new runtime sequence is registered or gameplay-validated.

Sources and timing are recorded in [the review README](../../../pose-studio/stances/update-stances/sequence-review/README.md). C is original Counter15, G is Counter20, and V is Evade12. The CT15 two-hand replacement and earlier G=Counter14 interpretation are not active sources for these previews. All slot durations are explicitly review timing.
