# Proposed implementation and acceptance

Status: proposal for work after this planning delivery. No item below is a claim
that a runtime or art fix has shipped. The first cases are **Starseer hit reaction**
and **Reaver Sweep**. See [story status and evidence index](README.md) and
[task checklist](EVIDENCE-CHECKLIST.md).

## Outcome and standards

The same class character moves through different poses at a consistent physical
scale. Equal physical scale does not require equal posed vertical height. Each
class retains its authored stature; this project does not make all classes equal
in size. Keep the existing viewport-level player-size policy unless a measured
defect independently requires a change.

### Appearance reference

Use each active default ready image as the **proposed** character reference.
Worker B's visual audit identifies what that means for headwear, clothing,
accessories, weapons, palette, silhouette, perspective, and rendering style.
Those proposals are not claims of owner approval. Prefer existing matching
artwork over generating a new character interpretation. Preserve every original
and its provenance. Confirm source/usage records instead of inventing a license.

### Calibration and registration

1. Keep native raster coordinates, logical frame/canvas coordinates, local stage
   units, and final CSS/screen pixels distinct. Record conversions explicitly.
2. Establish an upright-equivalent physical reference from comparable anatomy.
   Use head size, shoulders, torso, and limb segments where visible; account for
   occlusion and foreshortening. A crown-to-sole vertical interval is a pose
   measurement, not a reliable stature measurement for a bent figure.
3. Calibrate each independently authored source family to that reference once.
   Preserve calibrated scale across related frames. Per-frame exceptions require
   a documented source-art reason, not an automatic fit to posed bounds.
4. Normalize raster resolution to declared logical coordinates before applying
   calibration. A 1024-pixel master and its 256-pixel mobile export must represent
   the same physical character and logical registration.
5. Register support contacts/pivot independently of body size. Grounded foot
   changes may follow a deliberate step; airborne frames retain their authored
   lift. Do not snap every frame's lowest alpha pixel to the floor.
6. Keep transparent padding, weapon reach, capes, trails, and spell effects out
   of anatomy calibration. Maintain appropriate draw envelopes for clipping.
7. Formation sizing and stable HUD/target geometry use a settled reference
   envelope; they must not follow the transient head position during a crouch.

Proposed numeric checks: exact reuse of the calibrated scale within a source
sequence unless an exception is recorded; at most one CSS pixel of unintended
ground drift in stationary held-pose captures at each acceptance viewport;
matching logical registration between high/mobile exports within export
rounding. These are proposed test tolerances, not measured pass results.
Anatomical tolerance must be selected from comparable reference landmarks during
the pilot; do not use a universal head-size percentage across different views.

## Priority and dependency rules

| Priority | Meaning | Examples |
| --- | --- | --- |
| P0 | Evidence cannot support a trustworthy conclusion until resolved. | Wrong source/build/asset pin; irreproducible baseline; incorrect active profile. |
| P1 | Reported defect or essential correctness. | Reaver held/action scale policy; Starseer wrong-character HURT; grounding, timing, shared helper regression; tests enforcing the wrong player invariant. |
| P2 | Remaining coverage and durable review evidence. | Other reachable classes/actions/variants; source provenance controls; device/motion coverage; final capture/preview verification. |
| P3 | Cosmetic refinements after correctness. | Small palette, lighting, edge, accessory, or effect differences. |

An issue can move up a priority when evidence shows a larger impact. Missing
full-game coverage is an explicit verification gap, not proof of a regression.

## Phases and worker ownership

Three workers can operate concurrently under one coordinator. One file owner
per wave; no worker independently edits a shared/generated catalog.

| Phase | Worker A: rendering/measurements | Worker B: identity/art | Worker C: tests/evidence | Coordinator gate |
| --- | --- | --- | --- | --- |
| 0 — baseline | Verify selection and units. | Locate the exact pinned images. | Identify published vs source builds. | One named source baseline and art pin; preserve existing edits. |
| 1 — audit | Inventory, factors, coverage gaps, shared consumers. | Before-only sheets; character continuity; source candidates. | Test assumptions, capture harness, device/settings matrix. | Recheck key lines, measurements, images; agree on proposed standards. |
| 2 — authorized pilot | Fix player-specific calibration/registration selection. | Find or author matching Starseer HURT; preserve references. | Prepare regression assertions and capture automation against the agreed contract. | Disjoint ownership; final export waits for source correction; assemble exact candidate. |
| 3 — pilot acceptance | Inspect measured stage placement and shared effects. | Review visual identity/anatomy and adjacent frames. | Run automated checks, motion captures, mobile/desktop geometry checks. | Accept both primary cases only with inspected evidence. |
| 4 — rollout | Extend confirmed approach to affected player source families. | Correct prioritized class/action gaps. | Run coverage matrix and review evidence per slice. | Parallel class work allowed after common renderer contract settles. |
| 5 — polish/handoff | Resolve remaining measured issues. | P3 palette/lighting/export edges. | Final reproducible evidence, tests, preview checks. | All finished items linked; others visibly unchecked. |

### Wave-specific files and traps

- A owns player rendering/registration changes in
  `src/ui/alternativeCardStage.js` and a player-specific model/metadata path chosen
  after the pilot design. Review `src/ui/models/CombatBodyModel.js` consumers
  before proposing shared edits. Do not globally change enemy scale policy as a
  shortcut. Do not fix the superseded legacy formation model instead of the live
  viewport path.
- B owns source masters/exports in the separately resolved AI-Art checkout.
  Locate a verified `ashenspire` source baseline; a local art feature branch is
  not canonical authority. Preserve original and replacement provenance. Export
  only after source review; never write into `.art-cache`.
- C owns the specifically affected player-scale/transition tests and evidence
  capture tools. Existing enemy-only tests are not automatically wrong merely
  because the player contract changes. Discovery/scaffolding can run early;
  final assertions wait for the agreed scale/registration contract.
- Coordinator owns shared generated catalogs, art pin coordination, integration,
  continuation/status documents, and review of each worker diff. The Reaver
  selected pilot, not the legacy counter/sweep art, is the primary Sweep case.
- Source replacement precedes final calibration/export; integrated candidate
  precedes final after-images. Art release/pin changes and external actions
  require the relevant explicit authority at implementation time.

## First bounded slice

### US-02 — Reaver Sweep (P1)

1. Use the actual `reaver-greatsword-pilot` SW09 path.
2. Compare ready, held Sweep, windup, contact, finish, and return to held/ready.
3. Correct the mismatch between measured held-frame normalization and unmeasured
   action-frame treatment. Establish common source calibration without equating
   posed head-to-feet intervals.
4. Review comparable helmet, shoulders, torso, and limb anatomy. Source-art
   inconsistency may require a separate correction; removing a runtime factor
   alone is not assumed to solve it.
5. Verify grounded support, intended movement, trail registration, timing,
   clipping envelope, HUD stability, and card-inspection presentation.

Acceptance: bending visibly lowers the character while preserving calibrated
physical scale, with no unexplained held/action/return size jump. Evidence must
include numbers and motion, not just favorable isolated frames.

### US-03 — Starseer taking a hit (P1)

1. Compare the active ready character with the normally selected HURT source.
2. Search existing source packages for a matching reaction before creating art.
   A matching hat alone is insufficient: check cloak, outfit, accessories,
   anatomy, perspective, and equipped class-reference weapon treatment.
3. Register the matching reaction to the ready reference without inflating its
   bent/recoiling silhouette to standing height.
4. Capture ready → hit → ready in normal motion and hit interruption during
   an action. Also check reduced motion, which can bypass the image replacement.
5. Verify the normal reaction and any body-reaction path separately; absence of
   the defect under reduced motion does not establish normal-motion acceptance.

Acceptance: the reaction depicts the same Starseer character, with believable
recoil, stable scale, and correct return to the applicable rest pose.

## Verification and PR evidence

- Run the proportionate existing baseline tests to document current behavior.
  Passing old tests does not disprove either visual defect.
- Update only relevant assertions after the player calibration contract is
  implemented. Demonstrate that regression checks distinguish the prior defect.
- Capture desktop 1280×800 and mobile 390×844 at minimum for the final candidate;
  include wider/tablet layouts if affected geometry or repository rules require.
- Keep normal/reduced motion, high/mobile asset tier, and viewport width as
  separate dimensions. A narrow viewport is not proof that a light asset loaded.
- Record source commit, art pin, version/digest if present, selected profile,
  viewport, display scale, motion settings, action frame/time, and actual image
  URLs. Deterministic forced states are labeled as such, not playthroughs.
- Include matched before/after overlays and sequences with shared scale/ground
  references. Do not independently fit thumbnails to their cells.
- Check action interruption, repeated hits, return to held stance, combat and
  inspection, fallback loading, HUD/target geometry, and retained intentional
  movement. Show remaining gaps instead of inferring success.
- Keep compact measurements and evidence indexes in the repository; large raw
  recordings/dumps belong in retained linked artifacts. Never commit built HTML
  or bulk QA JSON. Verify review links and retention.
- The final implementation PR needs the repository's relevant build/test/review
  gates and exact-candidate visual evidence. This planning branch is not a game
  preview or release approval.

## Limitations and remedies

| Limitation | Remedy | Priority |
| --- | --- | --- |
| Published channel may lag the source baseline. | Record both identities and inspect shared files/asset pin; do not conflate captures. | P0 |
| Vertical landmarks cannot prove anatomical scale. | Source-family calibration, comparable anatomy, image overlays, and motion review. | P1 |
| Different character design cannot be repaired with resizing. | Matching-source search, then reference-led replacement if needed. | P1 |
| Mixed raster/logical sizes and partial landmark coverage hide discontinuities. | Explicit unit conversions and all selected held/action mappings. | P1 |
| Shared helpers can change enemy/HUD behavior. | Player-scoped change where practical; inspect every consumer and test affected behavior. | P1 |
| Static sheets can hide pops, interruption bugs, or recoil mismatch. | Deterministic sequences plus normal-speed full-game checks. | P1 |
| Tests may enforce the defect or exercise enemies only. | Classify tests by consumer; replace player assumptions selectively. | P1 |
| Exhaustive combinations can expand scope substantially. | Reachability matrix; default primary cases first, selectable variants next. | P2 |
| New artwork can drift from the reference. | Review a small pilot with adjacent frames before expanding. | P2 |
| Evidence can be oversized, unavailable, or misleading. | Compact index, matched conditions, retained artifacts, verified links. | P2 |
| Canonical source masters/provenance may be unavailable locally. | Resolve the art repository baseline; label candidates and unknown licenses accurately. | P2 |
| Minor palette/edge differences remain. | Polish after identity, physical scale, and transitions pass. | P3 |

## Exit boundary

This planning delivery is complete when its baseline, measured findings, images,
coverage limitations, story status, phased assignments, and evidence checklist
have been reviewed and pushed with a current continuation note. Runtime fixes,
replacement art, after-images, final acceptance, PR creation, promotion, and
publication remain outstanding. Do not mark them complete from this document.
