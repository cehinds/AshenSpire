# Player sprite cleanup — continuation

## PAUSED — owner checkpoint

The owner requested: **"push work to origin with a continuation note and stop
all work for now"** on 2026-11-27. All three workers were interrupted. Do not
resume implementation, testing, review, or publication until the owner resumes.

Current branch: `fix/PlayerSpriteConsistency`. This checkpoint contains unfinished,
unverified source edits and evidence. It is not an accepted fix or release.
Read [execution status and next steps](implementation/EXECUTION.md#paused-checkpoint)
before resuming. No new verification was run after the stop instruction.

Updated: 2026-11-27, America/Anchorage. Implementation approved after readability delivery.

## Status and scope

The owner approved execution. **Implementation is in progress** on
`fix/PlayerSpriteConsistency`, beginning with Starseer hit and Reaver Sweep.
Read [the execution checkpoint](implementation/EXECUTION.md) first for authority,
worker ownership, current findings, and next actions. Historical baseline
evidence remains immutable; new captures belong under `implementation/`.

- [Overview and user stories](README.md)
- [Implementation plan](IMPLEMENTATION-PLAN.md)
- [Evidence checklist](EVIDENCE-CHECKLIST.md)
- [Review and checks](REVIEW.md)

The owner authorized concurrent implementation of the approved cleanup plan,
with routine pushes and continuation updates. Preserve evidence, other edits,
and worktrees. Merge, promotion, game/art releases, and publication retain their
explicit authority requirements. The previous planning-only restriction is
superseded by the owner's execution instruction.

## Baseline

| Item | Recorded value |
| --- | --- |
| Repository | cehinds/AshenSpire |
| Planning branch | codex/player-sprite-cleanup-plan (retained) |
| Implementation branch | fix/PlayerSpriteConsistency |
| Audited source | 49eca254d795d06266aa23941cb2b31fe77b27bf — fetched/live Dev ref at observation |
| Test source ref observed | f33b112f89ad1029f48112dd84266006ddc3fe15 |
| Art pin | cehinds/AI-Art, ashenspire-hd-assets-v30 |
| Original checkout | C:\repos\AshenSpire; unrelated branch and edits preserved |
| Working checkout | Attached sprite-cleanup-plan worktree |

Published observations are separate: Test **0.7.5.134**, digest **4fc712b163**,
high edition; Dev **0.7.5.141**, digest **815d2ca479**, light edition. These
digests are not Git SHAs. Published game Git SHA/art pin parity remains unknown.

## Completed investigation

- 184 inventory rows; 117 available selected-family paths; 33 landmarked and
  84 unmeasured paths.
- 330 rasters found and hashed; no missing files or provided-catalog hash
  mismatches. All 23 owning sources match the baseline.
- Eight static sheets, four production-stage captures, and 12 loaded-image
  receipts matching retained v30 bytes.
- 68 focused tests passed, independently rerun by the coordinator.
- No outstanding consequential review findings after provenance guards were added.

**D-01–D-12 are complete. All implementation checkboxes remain open.**

## Remaining story acceptance

| Story | Remaining work |
| --- | --- |
| US-01: consistent character | Complete visual coverage and class/action fixes. |
| US-02: Reaver Sweep | Calibrate anatomy and held/action physical scale. |
| US-03: Starseer hit | Search canonical AI-Art history and select/create a matching reaction. |
| US-04: review evidence | Final candidate, after-images, preview, and implementation PR evidence. |
| US-05: combat presentation | Verify battlefield/HUD, targeting, timing, and settings after fixes. |

Captures are synthetic production-stage samples at shared 0.52 diagnostic zoom,
not playthroughs or battlefield-fit screenshots. Full-game capture timed out its
expected selector; this is not diagnosed as a game failure. Actual damage
integration, reduced motion, light tier, interruptions, variants, and inspection
acceptance remain open. See the verification report.

## Milestones

| Commit | Delivery |
| --- | --- |
| d842377392a | Baseline, authority, assignments; pushed. |
| 94f46215e72 | Measurements/reference sheets; pushed. Anchors the immutable raster snapshot. |
| f72cf9bae19 | Complete plan, stories, checklist, runtime evidence, checks, review; pushed. |
| Current cleanup commit | Shorter overview, readable scripts, unchanged artifacts and browser output. Coordinator verifies push against live origin before delivery. |

## Resume

1. Read the overview, checklist, and review record. Check local status and the
   live planning branch before writing.
2. Preserve all images/data, especially measurements/raster-hashes.json.
   Reproduction must reject inputs differing from the retained baseline.
3. Check the readability results in REVIEW.md and confirm the latest commit
   matches the live planning branch before continuing.
4. Follow implementation/EXECUTION.md. Complete and validate the approved pilot
   before expanding. Never mark an implementation item done without its evidence.

Readability ownership: A — measurement audit; B — main/report Markdown;
C — visual/runtime scripts; coordinator — evidence verifier, continuation,
review, integration, and push.
