# Player sprite cleanup — execution

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
