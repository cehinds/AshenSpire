# Player sprite cleanup — execution

**PAUSED at the owner's request, 2026-11-27. Do not resume until instructed.**

Started: 2026-11-27, America/Anchorage. Owner instruction: **"approved, execute"**.

## Authority and baseline

The approved plan is now in implementation. Proposed default ready references
are the working canonical appearance. Routine commits/pushes and continuation
updates remain authorized. No merge, promotion, game release, or art release is
authorized by this checkpoint.

- Branch: `fix/PlayerSpriteConsistency`.
- Implementation starting commit: `f9c7e97ebd7756ddb06757cacd3031dc6f09e48f`.
- Live/fetched Dev remains `49eca254d795d06266aa23941cb2b31fe77b27bf`.
- Art pin remains `ashenspire-hd-assets-v30`.
- Historical before images/data are immutable. New evidence lives under this
  `implementation/` directory; do not relabel or overwrite the baseline.
- Existing original checkout, art checkout, and other worktrees are preserved.

## First gate

1. Reaver's selected SW09 Sweep: calibrate a common physical scale and supporting
   root for held, windup, contact, finish, and return frames.
2. Starseer taking a hit: preserve the canonical hooded character and visible
   reaction through idle/held/action interruption and return.
3. Verify the pilot in actual combat, at desktop/mobile, before expansion.

### Selected pilot design

- SW09 starts with multiplier **0.60** for all four 1024-pixel frames, native
  root **[520, 734]**, and logical root **[384, 464]** before stage padding.
  Multiple helmet/limb measurements support this candidate; visual acceptance
  and perspective uncertainty remain explicit. No posed-height normalization.
- Ordinary hits retain the currently selected character/frame and existing
  recoil/red-flash clock. This applies to all four player classes, preserving
  action continuity and confirmed guard/evade reaction precedence.
- The canonical hooded Starseer renewal HURT was found and inspected, but its
  package is still an authoring preview with contact/tip/separation issues.
  It is recorded as an optional future deformation source, not silently shipped.
  No new art, art release, or cache edits are required for the selected fix.
- Actual full-game before captures are secured under
  `verification/before-verified/`: desktop/mobile, correct HURT source loaded,
  selected Reaver SW09, and zero page errors. Earlier unverified captures/raw
  diagnosis outputs are retained locally but excluded from accepted evidence.

## Current ownership

| Owner | Current work | Write boundary |
| --- | --- | --- |
| A — sprite_survey | Anatomical/support-anchor calibration; renderer design | New measurement evidence only until baseline combat captures are secured. |
| B — sprite_identity | Canonical source/history search and identity-preserving hit design | New identity evidence only; no art changes or generation yet. |
| C — sprite_verification | Full-game boot/capture path, acceptance fixtures, before evidence | New verification scripts/evidence only; existing tests/source untouched initially. |
| Coordinator | Design decisions, integration, continuation, commits/pushes, review | Shared metadata, status, and release boundaries. |

## Stories

| Story | Execution status |
| --- | --- |
| US-01 — consistent character | In progress: matching reaction search and explicit source-family calibration. |
| US-02 — Reaver Sweep | In progress: stable anatomical references and true supporting-foot/root measurements. |
| US-03 — Starseer hit | In progress: canonical reaction search; existing recoil/flash on canonical artwork is a fallback option. |
| US-04 — reviewable evidence | In progress: old baseline retained; new before/after and acceptance artifacts will identify their exact candidate. |
| US-05 — combat presentation | In progress: full-game capture fixture diagnosis and HUD/target/motion coverage. |

No implementation acceptance is checked yet. The pilot must pass before broader
class/action rollout. Keep incomplete source-art and full-game checks visible.

## Findings since planning

- The previous full-game capture used an invalid hyphenated seed. New-run seed
  validation accepts digits/A–Z, so that fixture left the run null. The new QA
  fixture uses `SPRITEAUDIT20261126`; this is not a gameplay-code change.
- Reaver's existing held semantic feet value (759 native pixels) is below the
  visible supporting soles (about 734). Calibration must correct the support
  reference as well as the scale-policy mismatch.
- Canonical AI-Art `ashenspire` commit
  `75d0ba9650ee17eb7a5af74594b3a8a6a490896f` has tree
  `334a849a42c50e66e2ef64773149e7b8f5ab0406`, matching the inspected local art
  tree. Sparse files alone do not exhaust that tree; renewal reactions are being
  inspected before deciding whether a suitable existing Starseer HURT exists.

## Milestones and next action

This checkpoint records the approval, refreshed baseline, ownership, and first
measurements. Push immediately. Secure actual combat before captures, finish
source/calibration decisions, then assign the single renderer owner and tests.
Subsequent meaningful commits update this file with results and remaining tasks.

## Paused checkpoint

The owner requested a push/continuation checkpoint and stopped all work. Workers
A, B, and C were interrupted. No further tests, implementation, or review were
performed after that instruction; only this save/push operation is authorized.

### Saved work

- `src/content/playerSpriteCalibrations.js`: draft fixed SW09 calibration data,
  multiplier 0.60, native root [520, 734], source hashes and provenance.
- `src/ui/models/PlayerSpritePlacementModel.js`: draft pure placement helper.
- `src/ui/alternativeCardStage.js`: in-progress integration of calibrated SW09
  placement and removal of foreign HURT substitution. Treat this diff as
  **unreviewed and untested**, potentially incomplete.
- `implementation/measurements/`: anatomical survey, helmet grid, and 0.55/0.60/0.65
  candidate comparisons. Candidate 0.60 is selected for pilot testing, not accepted.
- `implementation/identity/`: canonical search/provenance and three unchanged
  renewal source references. The matching hooded HURT exists but is an unshipped
  authoring draft with contact/tip/separation issues. Selected fix retains the
  current character frame and existing recoil/flash; no art was published.
- `implementation/verification/before-verified/`: accepted full-game-context
  before capture set, 12 desktop/mobile PNGs and receipt metadata, zero reported
  page errors. Source was still unchanged when these were captured.
- `implementation/verification/before/`: earlier **unverified/superseded** set;
  Starseer hit timing was not reliable. Preserved as work history, not acceptance.
- Boot diagnosis and capture scripts are preserved. Invalid hyphenated seed was
  the old capture blocker; valid seed is `SPRITEAUDIT20261126`.

### Not complete

- Renderer/helper/data review and targeted regression tests.
- Reproduction of the prior defect turning the new checks red.
- Candidate after-images, motion/interruptions/repeated hits, light/reduced-motion
  and actual engine-damage integration checks.
- Full-game HUD, targeting, clipping and inspection acceptance.
- Remaining player classes/source families still have the legacy posed-height
  policy outside the bounded SW09 pilot. Broader rollout must follow pilot acceptance.
- Core/discovered tests, build, sandbox QA, independent review, feature preview,
  PR evidence, and all implementation acceptance checkboxes.

### Resume order

1. Wait for explicit owner resume. Check this branch against origin and inspect
   the saved source diff before assuming any part is working.
2. Review A's helper/data/renderer API together, then coordinate C's regression
   tests. B is available for identity/read-only review.
3. Run focused checks and inspect actual-game after captures against the immutable
   before-verified set. Correct the pilot before expanding.
4. Update stories/checklist with evidence, run required broader gates, and push
   meaningful milestones with this continuation note updated.

Prior pushed implementation checkpoints: `7f34344b39e` (approval/ownership) and
`4d79f50fc72` (approved scale/reaction contract). The commit containing this
paused note saves all current work; its SHA is available from the branch log.
