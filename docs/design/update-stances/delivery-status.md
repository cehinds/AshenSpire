# Selected stance delivery and runtime sequence status

The original five Reaver/greatsword poses and PR #1890 runtime integration are complete. Independent source reviews are approved. That delivery’s final unpatched artifact is build **0.7.1.1417**, digest **b1ec8952f6**, from source commit [`e8efd0244`](https://github.com/cehinds/AshenSpire/commit/e8efd0244), which corrects reaction playback timing/readiness/defeat handling. [PR #1890](https://github.com/cehinds/AshenSpire/pull/1890) merged into Dev at [`5852a791b`](https://github.com/cehinds/AshenSpire/commit/5852a791b59024235c826249a0704bc8d0e034d6).

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
| Selected promotion heavy run | Run 38276157811 attempt 2 succeeded; diagnostic full-run rerun114962509344 passed7/7 with no console errors on test73f763cd. |
| Final-head fast CI | Passed: core suite, all four discovered-test shards, preview, receipts, Workbench and Quick Start browser checks |
| Evidence | [Final 1417 reaction QA](../../preview/update-stances-selected-20261012/1417/README.md) and [1415 held-pose/mobile QA](../../preview/update-stances-selected-20261012/1415/README.md) |

The 0.7.1.1417 change is limited to reaction playback, so the 0.7.1.1415 selected-pose and mobile screenshots remain representative. The browser checks use the actual starter loadout and authored cards. For the finite-reaction proof on 0.7.1.1417, a deterministic registered Colossus Smash supplies the incoming move, while the game engine emits the receipts; Guard-break and successful Evade restore their held poses, and no page errors occurred. The 57/57 focused source review covers reaction timing/readiness/defeat handling and identity/order fixtures. Mobile QA completed its geometry and scope assertions; its shell reported 11 benign Chromium vibration user-activation notices, with zero application exceptions or relevant errors. The selected scope remains default-armour Reaver with a sole greatsword; other weapons, classes, and armor appearances are not covered by this pilot.

The user authorized delivery and merge without another approval request. The separate follow-up is ten new greatsword options each for Sweep, Counter, and Evade, thirty total. All thirty follow-up concepts are integrated and director-reviewed; all thirty are director-approved concept candidates. At the earlier concept-director pass, Sweep17, Counter15 and Evade20 used approved standalone replacements with the same option IDs. The owner subsequently chose original-board Counter15 for the sequence preview; that exact image overrides the replacement preference, which remains preserved as an unselected alternate. At that concept-review stage, the boards did not replace runtime art; the later approved source choices are implemented in PR #1897 below. [Follow-up review record](followup-art-review.md) tracks actual sources, flags and provenance. Co-op remains paused.


## Approved runtime sequence update (PR #1897)

The owner approved implementation and merge. Production exports and registration are complete in [sequence-production.json](../../../pose-studio/stances/update-stances/sequence-production.json), with exact hashes and preserved Smash05/Guard-break06 recorded in [export provenance](../../../pose-studio/stances/update-stances/sequence-production-provenance.json). Runtime source and production assets are integrated. Final independent compiled-browser validation is approved, and [PR #1897](https://github.com/cehinds/AshenSpire/pull/1897) merged into Dev at [`a2327fdd820331aed0cf0a3afc65a11ab0adaaee`](https://github.com/cehinds/AshenSpire/commit/a2327fdd820331aed0cf0a3afc65a11ab0adaaee) after green PR checks. [Runtime proof and final desktop/phone captures](runtime-qa/README.md) identify the tested candidates: final Counter build **0.7.1.1426 / 972390821c**, source **544714e66**, passed 22/22 assertions; the unchanged non-Counter cases passed 31/31 plus 6/6 reduced-motion checks on **0.7.1.1425 / ad3fb4fb84**, source **07751afbe**. The subsequent stamped Dev build and promotion are separate from these local proof identities.

The profile remains solo default-armour Reaver holding the sole greatsword in either active hand with the other hand empty. Sweep18, original Counter15, Counter12 Defend/Immune, Smash05 and Evade15 are the current held sources. Attack/Smash play AT1–AT6; successful Evade plays EV1–EV3. Zero-health-loss Guard/Parry/Resisted uses D → V → G → H → C → D with holds 2–3–1–2–3–2. Guard-tag Counter adds S and AT1–AT6; Evasion-tag Counter uses EV1–EV3 followed by AT1–AT6 without an intermediate stance return. Engine receipts choose the qualifying reaction and consumed retaliation; each action restores its actual originating hold. Invulnerability, successful Evade and guard-break remain separate outcomes. Other loadouts and co-op are unchanged; co-op remains paused.

The 350 ms unit belongs only to the [readable review GIFs](../../../pose-studio/stances/update-stances/sequence-review/README.md). Gameplay uses existing animation-speed timing with the approved phase ratios. A/B alternatives remain unselected. The requested new Sweep/Smash example art belongs to a separate review branch and is not included in this runtime PR. The user superseded the earlier jump/vault studies with low iai-inspired Sweep draws and surrounding whirlwind trails, plus heavy jumping ground-slam Smash sequences. The revised gallery remains unpublished while the corrected underhand Sweep stance and revised action art are prepared; old studies are preserved as source history.


## New Smash selection and revised Sweep review

The owner selected **SM03 · Twisting aerial slam** from the [revised five-slot gallery](../../../pose-studio/stances/update-stances/smash-sweep-examples/README.md) for Smash. Its approved source is `smash/ground-slam-revision-2/SM03/`, with start stance → takeoff → airborne load → ground impact → the same starting stance. Production export and runtime implementation are being prepared separately; this selection does not claim they are already registered or browser-validated. The other nine Smash examples remain reference choices. Revised iai-inspired Sweep examples and their final owner selection remain pending. This later selection is separate from the already merged PR #1897 runtime proof above.
