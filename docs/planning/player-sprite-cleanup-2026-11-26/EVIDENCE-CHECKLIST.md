# Evidence checklist and story acceptance

Planning checklist: checked means the investigation artifact was delivered and
reviewed. Implementation checklist: checked would mean the changed player
behavior was verified in a matching candidate. **No implementation items are
complete in this planning delivery.**

Each future implementation task must link its changed files/asset IDs, rationale,
measurements and units, matched before/after visuals, motion evidence where
applicable, test command/results, candidate identity, and limitations.

## Investigation delivery

- [x] **D-01 / P0** Preserve the original checkout and record a separate source
  baseline, art pin, task authority, and worker ownership.
  Evidence: [continuation](CONTINUATION.md).
- [x] **D-02 / P0** Identify live published Dev/Test build versions and distinguish
  them from the inspected source baseline. Evidence:
  [published observations](verification/published-baseline.json); owning published
  Git SHA/art pin remain explicitly unknown.
- [x] **D-03 / P0** Inventory the selected runtime families, action mappings,
  coordinate systems, and fallback/variant limitations. Evidence:
  [measurements](measurements/MEASUREMENTS.md) and
  [action mappings](measurements/action-mappings.json).
- [x] **D-04 / P1 / US-02** Quantify Reaver ready/held/action Sweep registration,
  including the selected SW09 pilot, and review visual evidence. Evidence:
  [measurements](measurements/MEASUREMENTS.md) and
  [registered reference](visuals/reaver-sweep-current-before.png).
- [x] **D-05 / P1 / US-03** Identify Starseer's normal HURT source and demonstrate
  the character-design mismatch with inspected baseline images. Evidence:
  [identity report](visuals/IDENTITY.md) and
  [ready/hit comparison](visuals/starseer-hit-reference.png).
- [x] **D-06 / P1** Audit shared helper consumers and test assumptions; record
  proportionate baseline test commands/results. Evidence:
  [verification report](verification/VERIFICATION.md), 68 focused tests passing;
  coordinator independently reran the same 11 test files successfully.
- [x] **D-07 / P1** Capture primary production-stage baseline states and state
  whether each image is a raster reconstruction, deterministic runtime capture,
  or full-game context. Evidence: [capture receipts](verification/runtime-capture-record.json)
  and [verification limitations](verification/VERIFICATION.md). Full-game capture
  is not supplied; the successful images are synthetic production-stage samples.
- [x] **D-08 / P2 / US-01** Produce all-class identity reference sheets and
  distinguish verified visual findings from unverified source candidates.
  Evidence: [identity report and eight image links](visuals/IDENTITY.md).
- [x] **D-09 / P2** Record coverage gaps: missing landmarks, variants, tiers,
  motion modes, interruptions, and full-game context where not exercised.
  Evidence: [measurement coverage](measurements/summary.json) and
  [verification matrix](verification/VERIFICATION.md).
- [x] **D-10 / P1-P3** Deliver prioritized work, standards, dependencies, file
  ownership, remedies, acceptance, and concurrent implementation assignments.
  Evidence: [implementation plan](IMPLEMENTATION-PLAN.md).
- [x] **D-11 / P2 / US-04** Validate document/image links, measurements, file
  sizes, and independent review findings. Evidence: [integrity result](VALIDATION.json),
  [reproduction scripts](README.md), and [review record](REVIEW.md).
- [x] **D-12 / P2 / US-04** Push meaningful milestones, updating continuation
  notes and story status between them. Evidence: [milestone/continuation record](CONTINUATION.md)
  and the planning branch's commits. Coordinator verifies final local/live remote
  equality after the final push; no merge or promotion is included.

## P0 — Future implementation baseline

- [ ] **B-01** Reconfirm the implementation target build, source commit, art
  version, and exact runtime profile before starting changes.
- [ ] **B-02** Retain untouched baseline images/sequences and input hashes.
- [ ] **B-03** Assign a single owner to each shared/generated file for the wave.

## P1 — Pose measurements and source calibration (US-02)

- [ ] **S-01** Establish canonical proportions and physical reference scale.
- [ ] **S-02** Record standing and crouching measurements separately; do not
  treat vertical compression as a change in physical stature.
- [ ] **S-03** Calibrate independently authored raster families, documenting
  logical/raster conversion and any justified frame exceptions.
- [ ] **S-04** Correct Reaver's selected SW09 held/action scale treatment.
- [ ] **S-05** Verify Sweep lowers the silhouette without enlarged anatomy or
  unexplained physical scale changes.
- [ ] **S-06** Attach source/reference measurements and matched before/after
  overlays; review comparable helmet, torso, and limb anatomy.

## P1 — Starseer character identity (US-03)

- [ ] **I-01** Confirm the chosen canonical appearance against its active ready
  image and document any owner appearance decision.
- [ ] **I-02** Locate matching existing HURT artwork or produce a reference-led
  replacement; review source provenance and original preservation.
- [ ] **I-03** Verify headwear, clothing, accessories, anatomy, perspective, and
  visual treatment remain the same character.
- [ ] **I-04** Register the reaction without forcing recoil height to standing
  height; preserve intentional movement.
- [ ] **I-05** Attach ready → hit → ready before/after evidence and interrupted
  action reaction coverage.

## P1 — Shared rendering and geometry (US-05)

- [ ] **G-01** Inspect every shared sizing-helper consumer before modifying it.
- [ ] **G-02** Preserve intended viewport/battlefield scale and settled geometry.
- [ ] **G-03** Verify enemy presentation has no unintended regression.
- [ ] **G-04** Verify HUD placement, targeting, sprites, effects, and clipping.
- [ ] **G-05** Preserve timing, impact cues, and independently registered trails.

## P1 — Motion and transitions (US-02, US-03)

- [ ] **M-01** Review Reaver ready/held → Sweep → held/ready at normal and slow speed.
- [ ] **M-02** Review Starseer taking hits from held poses and during actions.
- [ ] **M-03** Verify no unexplained size jumps, ground snapping, or foot sliding.
- [ ] **M-04** Preserve deliberate steps, lunges, and airborne movement.
- [ ] **M-05** Attach before/after clips or timestamped frame sequences that show
  the transitions, not just selected isolated frames.

## P1 — Regression checks

- [ ] **T-01** Classify old tests by player/enemy/shared consumer.
- [ ] **T-02** Replace incorrect player equal-height assumptions selectively.
- [ ] **T-03** Add meaningful calibration, registration, and transition checks.
- [ ] **T-04** Demonstrate relevant checks distinguish the previous defect.
- [ ] **T-05** Record applicable commands, actual results, and limitations.

## P2 — Remaining classes, variants, and settings (US-01, US-05)

- [ ] **C-01** Complete a per-class/action/variant visual acceptance matrix.
- [ ] **C-02** Verify default combat paths for all four player classes.
- [ ] **C-03** Verify reachable variants, profiles, and load-failure fallbacks.
- [ ] **C-04** Verify desktop/mobile layouts and actual high/mobile loaded tiers
  independently; viewport width alone is insufficient evidence of tier selection.
- [ ] **C-05** Verify normal/reduced motion and relevant effects settings.
- [ ] **C-06** Verify combat and card/character inspection presentations.
- [ ] **C-07** List deferred/unverified combinations explicitly.

## P2 — Replacement-art controls

- [ ] **A-01** Document canonical visual references before authoring replacements.
- [ ] **A-02** Review the small pilot alongside neighboring frames before expanding.
- [ ] **A-03** Preserve originals, provenance, generation/edit history, and
  applicable source/usage records; never infer licensing from a local filename.
- [ ] **A-04** Perform final calibration/export only after source correction.

## P2 — PR evidence and handoff (US-04)

- [ ] **E-01** Link evidence and completion rationale for every checked task.
- [ ] **E-02** Match before/after viewports, settings, frame/time, and physical scale.
- [ ] **E-03** Label landmarks, units, scale, ground reference, asset IDs, build,
  commit, art version, and capture date.
- [ ] **E-04** Retain large recordings/raw dumps in linked review artifacts;
  keep repository summaries compact and verify link retention.
- [ ] **E-05** Capture final after-images from the integrated candidate only.
- [ ] **E-06** Provide a verified candidate preview with matching commit/art pin.
- [ ] **E-07** Complete applicable build/test/review gates; leave unsupported
  claims or unfinished tasks unchecked.

## P3 — Cosmetic polish

- [ ] **P-01** Review palette and lighting continuity.
- [ ] **P-02** Check transparency edges, halos, and export quality.
- [ ] **P-03** Review weapon, accessory, and effect continuity.
- [ ] **P-04** Document any remaining cosmetic differences and their priority.

## First implementation acceptance gate

- [ ] **AC-01 / US-02** Reaver Sweep preserves calibrated physical scale while
  bending naturally and transitioning without an unexplained size jump.
- [ ] **AC-02 / US-03** Starseer taking a hit preserves its canonical character
  identity, believable recoil, registration, and return pose.
- [ ] **AC-03** Both cases have measurements, matched before/after images,
  transition evidence, and passing applicable regression checks.
- [ ] **AC-04 / US-05** Shared rendering/geometry checks show no introduced
  enemy, HUD, targeting, timing, or clipping regressions.

After this gate passes, expand the verified approach to remaining P2 items.
This baseline-only planning task does not satisfy AC-01 through AC-04.
