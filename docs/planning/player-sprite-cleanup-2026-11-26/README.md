# Player sprite cleanup plan

**The investigation is complete; sprite fixes and implementation acceptance are
still open.** The first cleanup slice is **Starseer taking a hit** and **Reaver
performing Sweep**, followed by the remaining player classes.

## What we found

| Case | Finding | Next action |
| --- | --- | --- |
| **P1 — Starseer hit** | Ready shows a hooded staff user; HURT substitutes a pointed-hat character with different clothing. Equal alpha height does not establish character identity. | Find or author a matching reaction, then register it against the canonical character. |
| **P1 — Reaver Sweep** | The selected SW09 held image uses a `0.756521739` scale factor; its unmeasured action frames use `1`. This is a scale-policy difference, not proof of a particular anatomical size change. | Calibrate ready and the complete SW09 family together. Removing normalization alone would enlarge the held image. |
| **P2 — Wider cleanup** | Other HURT images show identity drift. Partial landmarks and mixed source families need review across all four classes. | Extend the pilot's verified method to reachable class/action/variant combinations. |

Method: identify active assets → establish each class's reference → measure source
and runtime placement → correct the two primary cases → verify motion and shared
geometry → expand coverage. Preserve physical proportions while letting crouched
poses occupy less vertical space. See the [method, priorities, worker assignments,
and acceptance gates](IMPLEMENTATION-PLAN.md).

## Primary before images

These samples use the unchanged production stage, deterministic posed time, and
a shared **0.52 diagnostic zoom**. They are synthetic comparison-harness captures,
not battlefield screenshots, deployed-game captures, or playthroughs.

![Starseer ready, hit, and returned-ready baseline](verification/runtime-starseer-1280-before.png)

![Reaver ready, held Sweep, and Sweep contact baseline](verification/runtime-reaver-1280-before.png)

Static references: [Starseer ready/HURT](visuals/starseer-hit-reference.png) ·
[Reaver SW09 sequence](visuals/reaver-sweep-current-before.png).
Mobile-width harness strips: [Starseer 390×844](verification/runtime-starseer-390-before.png) ·
[Reaver 390×844](verification/runtime-reaver-390-before.png).
Reaver's actual `origin` bookends use the current held/rest pose; the static
sheet's final ready panel is a reference comparator. No after-images exist yet.

## User stories and status

| ID | User story | Investigation delivered | Implementation/final acceptance |
| --- | --- | --- | --- |
| US-01 | As a player, I recognize the same class character through every stance, action, and reaction. | [x] Default-family inventory and selected-pose identity sheets. Exhaustive visual acceptance remains open. | [ ] Not started. |
| US-02 | As a player, my Reaver bends during Sweep without changing physical scale or popping between held and action poses. | [x] SW09 scale-policy difference measured, reconstructed, and sampled in the production renderer. Anatomy calibration remains open. | [ ] Not started. |
| US-03 | As a player, my Starseer retains the same character design when taking a hit. | [x] Wrong-character HURT source and alpha-height registration demonstrated. Matching replacement not established. | [ ] Not started. |
| US-04 | As a reviewer, I can reproduce the baseline and follow measurements, images, and tests for each task. | [x] Evidence, scripts, hashes, and task-linked checklist delivered; validation/review recorded separately. | [ ] Final implementation PR evidence and candidate preview remain open. |
| US-05 | As a player, sprite cleanup preserves readable combat, HUD placement, targeting, and supported display/motion settings. | [x] Shared consumers and verification matrix documented. Full-game regression acceptance remains open. | [ ] Not started. |

## Baseline and limits

Planning date: **2026-11-26, America/Anchorage**. Source:
`49eca254d795d06266aa23941cb2b31fe77b27bf`, fetched `origin/dev` and checked against
live `git ls-remote`. Art: `cehinds/AI-Art`, **`ashenspire-hd-assets-v30`**.
Repository: `cehinds/AshenSpire`; branch: `codex/player-sprite-cleanup-plan`.
The observed Test source ref was `f33b112f89ad1029f48112dd84266006ddc3fe15`.

Published Test **0.7.5.134** (`4fc712b163`, high) and Dev **0.7.5.141**
(`815d2ca479`, light) were observed separately. Their content digests do not
identify a Git SHA or art pin; published/local parity remains unverified.
The [verification report](verification/VERIFICATION.md) records those observations,
**68/68 focused tests passing**, capture conditions, and coverage gaps. A full-game
capture attempt timed out at its stage selector; that is not a diagnosed game failure.

Readiness: the measured pilot can be planned, but canonical artwork, anatomy
calibration, fixes, full-game/device/motion acceptance, final after-images, and a
candidate preview remain open. Production code, tests, catalogs, art masters,
the pinned cache, and the owner's original checkout were preserved.

## Evidence and handoff

- [Evidence checklist](EVIDENCE-CHECKLIST.md) — completed investigation and unchecked future tasks.
- [Measurements and inventory](measurements/MEASUREMENTS.md) — formulas, units, counts, hashes, and reproduction commands.
- [Visual identity report](visuals/IDENTITY.md) — eight before-only sheets, proposed references, and candidate limitations.
- [Verification report](verification/VERIFICATION.md) — focused tests, capture reproduction, and published observations.
- [Integrity result](VALIDATION.json) · [evidence verifier](verify-evidence.mjs) · [independent review](REVIEW.md).
- [Continuation and milestone record](CONTINUATION.md) — pushed planning commits and resume instructions.

This delivery includes no implementation PR, merge, promotion, release, or publication.
