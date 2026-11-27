# Player sprite cleanup plan

Planning baseline: 2026-11-26 (America/Anchorage). **Investigation in progress;
no sprite fixes implemented.**

The primary acceptance cases are **Starseer taking a hit** and **Reaver performing
Sweep**, following the owner's clarification. The broader audit covers all four
player classes. [Continuation and milestone record](CONTINUATION.md).

## User stories and delivery status

Checkboxes in this table refer to the delivered player behavior, not to whether
an investigation has been written. Investigation and implementation are tracked
separately to avoid claiming a fix from a baseline screenshot.

| ID | User story | Investigation | Player behavior implemented/accepted |
| --- | --- | --- | --- |
| US-01 | As a player, I recognize the same class character through every stance, action, and reaction. | In progress: runtime inventory and identity audit. | [ ] Not started. |
| US-02 | As a player, my Reaver bends during Sweep without changing physical scale or popping between held and action poses. | Scale-policy discontinuity reproduced from source; runtime evidence pending. | [ ] Not started. |
| US-03 | As a player, my Starseer retains the same character design when taking a hit. | Separate HURT source identified; labeled image comparison pending. | [ ] Not started. |
| US-04 | As a reviewer, I can reproduce the baseline and follow measurements, images, and tests for each task. | Baseline checkpoint pushed; evidence collection in progress. | [ ] Evidence package and review pending. |
| US-05 | As a player, sprite cleanup preserves readable combat, HUD placement, targeting, and supported display/motion settings. | Shared consumers and coverage under investigation. | [ ] Not started. |

## Baseline identity

- Repository: `cehinds/AshenSpire`.
- Source: `49eca254d795d06266aa23941cb2b31fe77b27bf`, fetched `origin/dev` and
  independently checked against live `git ls-remote` for this investigation.
- Test source ref observed: `f33b112f89ad1029f48112dd84266006ddc3fe15`.
- Art repository/pin: `cehinds/AI-Art`, `ashenspire-hd-assets-v30`.
- Planning branch: `codex/player-sprite-cleanup-plan`.
- Published build identity: pending verification; source HEAD is not a claim
  about the version currently served by GitHub Pages.

This checkout is separate from the owner's original checkout and its existing
edits. Production code, tests, catalogs, art masters, and pinned cache are not
modified by this planning task.

## Early verified finding

The selected Reaver profile is `reaver-greatsword-pilot`, with the selected SW09
Sweep sequence. Its ready semantic head-to-feet span is 130.5 pixels on a
256-pixel raster, drawn as 261 logical stage units. The held SW09 frame has a
345-unit semantic span on its 1024-pixel raster. Current per-pose normalization
therefore applies `261 / 345 = 0.756521739` to that held frame. The following
unmeasured action frames do not take this correction. Their scale-policy ratio
to the held image is `1 / 0.756521739 = 1.321839080`.

This confirms inconsistent treatment of source families and posed height; it
does **not** establish anatomical size from a vertical measurement alone. The
selected Reaver case must not be described simply as "the renderer enlarges
every crouch": the held SW09 image is shrunk, and action images bypass that
normalization. Detailed measurements and visual evidence follow in the final
plan.

## Planned artifact index

- `measurements/`: reproducible inventory, coordinate definitions, factors,
  coverage counts, and source references.
- `visuals/`: inspected before-only raster contact sheets, registration diagrams,
  identity findings, and provenance notes.
- `verification/`: published/local baseline distinction, test results,
  runtime captures, and capture conditions/limitations.
- `EVIDENCE-CHECKLIST.md`: task IDs, priority, investigation evidence, and
  unchecked future implementation acceptance.

## Current next step

Integrate the three workers' evidence, independently verify the key measurements
and images, and write the phased implementation plan with ownership and explicit
acceptance. Keep all proposed after-fix behavior and replacement artwork clearly
distinguished from the untouched baseline.
