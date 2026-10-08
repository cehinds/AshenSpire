# Three held stance families

## Owner-selected game poses (2026-10-08)

All twelve choices in `options-20261008/selections.json` now drive the held
Attack, Defend and Prepare (casting) poses in alternative solo and co-op combat.
Reaver's defensive choice deliberately uses attack candidate A3. Starseer's
choices use the earlier boards identified by their recorded hashes.

The selected, unchanged artwork is floor-registered into 512px/256px WebPs in
`assets-alternative/stances/`. `src/content/alternativeSelectedStances.js`
records source viewports, normalization and output hashes. Both the common
asset pack and portable builds include the selected art. Existing action
animation, reactions, auras and timing finish before the held pose appears.
Each player's pose clears on their next turn. Counters retain the existing
presentation pending the owner's separate selection pass.

Open `selected-projects/<class>.rig.json` in Sprite Workshop to inspect the
approved exports. Re-export with the review server running on port 4391:

```powershell
node tools/alternative-selected-stances-export.mjs
```

This uses Playwright (`PLAYWRIGHT_MODULE` may name an installed module) and
Chromium (`CHROME` may name its executable). `STANCE_REVIEW_URL` overrides the
review page URL. Browser Canvas crops the recorded viewport, uses one scale
per class across its three poses, and places the feet at `[256,464]`.

The integration follows the existing alternative base-class stage. It does
not add armour variants or promote the draft enemy adaptations below.

## Initial authoring package (historical)

Independent authoring package and presentation seam for `alternative/dev`, based
on `44d5fbd0425249b191785d2002ce5ea12a868acc`. Offensive covers Attack, Smash and
Sweep; defensive covers Defend; casting covers spell actions. These
are static waiting poses. The existing action-animation stage remains the owner
of action frames, reactions, impacts and timing.

## Preview and projects

The owner's follow-up selection boards are in
[`options-20261008/index.html`](options-20261008/index.html): five new options
for each class's Attack, Defend and Casting, with labels beneath every candidate.
The confirmed choices are recorded alongside the boards; the initial draft
exports below remain separate historical authoring material.

From the repository root:

```powershell
node tools/alternative-stances-serve.mjs --port 4391
```

Open <http://127.0.0.1:4391/pose-studio/stances/index.html>. The preview includes
Full/Lite exports, a canonical coverage atlas, confirmed-card receipts for two
independent seats, and hidden/revealed public enemy intent. It is an authoring
preview; the game imports the approved catalog described above.

Download a Workshop project from the preview, then use Sprite Workshop's
**File → Open project**. Each portable `.rig.json` embeds its three images and a
review queue with 260 ms holds and 600 ms pauses. Enable **Overlays → Anchors /
Names** to inspect floor registration; use the clean preview to inspect anatomy.
The rigs contain flattened paintings, not separate animated limbs or hands.
`reviewed` remains false pending owner approval.

The four player projects also open in the existing Pose Studio via **Open
project**. Its five-slot minimum is met with five identical held frames, with
empty gameplay bindings, effects and dependencies. Enemy projects use Workshop
because Pose Studio's actor catalog accepts player classes only. Sparse
checkouts may pass `--asset-root <existing-checkout>` to the preview server to
read the original Pose Studio's existing assets; that checkout is never written.

## Coverage and provenance

| Coverage | Appearances | Stance cells |
| --- | ---: | ---: |
| Newly painted base player drafts | 4 | 12 |
| Explicit same-class starter-armour equivalents | 4 | 12 |
| Existing enemy painting adaptations | 33 | 99 |
| Unpainted other canonical armour | 27 | 81 |
| Total canonical requirement | 68 | 204 |

123 of 204 cells have exports. The 27 unpainted armour cells are visible in the
atlas and receive no image fallback. The four explicit equivalences are
`reaver-wayfarerPlate → reaver-default`, `rogue-gutterLeathers → rogue-default`,
`starseer-nightweave → starseer-default`, and
`herald-riteVestments → herald-default`. Shared `artClassId` values do not prove
canonical coverage.

Player masters are first-party ImageGen outputs from the project's own rear
character references. Exact prompts, unchanged PNG sheets, crop polygons and
SHA-256 hashes are preserved in `source/`. Reaver has a continuous crimson cape
and two-handed greatsword; Rogue has twin daggers; Starseer casts with book left
and upward staff right; Herald is unarmed and casts with an open book.

Enemies reuse the existing attack / guard / buff paintings. They are held-pose
adaptations, not new paintings. Their 384 px source art is resampled to a 512 px
registered canvas; this does not add native detail. Full exports are 512 px and
Lite exports 256 px. All frames share floor anchor `[256,464]`. The registry
records source identities, input size, source hashes and export hashes.

Rebuild using a checkout containing the recorded enemy sources:

```powershell
python tools/alternative-stances-build.py --source-checkout <source-checkout>
node --test tests/alternative-stances.test.mjs tests/combat-intent-visibility.test.mjs tests/coop-intent-ui.test.mjs tests/coop-intent-projection.test.mjs
```

`--projects-only` regenerates embedded projects and metadata without encoding
raster exports again; `--actor <canonical-id>` rebuilds one painted actor.

## Integration contract

`src/model/alternativeStance.js` accepts resolved cards and observer-public
intent projections. Keep one ledger per combat, outside replaced screen DOM.
Feed each confirmed `cardPlayed` receipt once, with the resolved card snapshot
including equipment-projected tags. A failed or preparing play does nothing;
the latest confirmed card wins. Reset only the active seat on its next turn,
and all seats on a new combat. An unclassified card clears the previous family.

Enemy selection reads **only `publicIntent.stance`** from the existing solo
`previewIntent()` or co-op `coopEnemyIntent()` result for that observer. Do not
feed a private enemy object, infer from damage/effects, reroll visibility, or
read pending moves. Hidden and revealed projections retain the same permitted
broad family.

Resolve player art by the exact `${classId}-${armourId}` canonical ID. Resolve
asset URLs through the game's art loader after publishing the chosen raster
exports through the established art pipeline. No runtime loader manifest is
changed by this package.

Wrap a stage once with `withAlternativeStance(stage, actorId, options)` and call
`setStance(family)`. The wrapper waits for a successful image load before hiding
the original artwork, forwards action calls and timing data unchanged, and
suppresses held art while an action or reaction is active. The host must call
`resumeStance()` **after its complete existing action/reaction timeline**;
`settle()` also resumes it. Use `suspendStance()` around other visual sequences.
There is no guessed completion timer. For Instant or reduced-motion flows, the
host can resume immediately when its own action has completed. Forward public
auras through the existing presentation layer and mirror Full/Lite changes with
`setStanceLite()`. Preserve rest-pose resume options and defeated-state handling.

The initial wrapper is retained for draft preview use. Game integration uses
the merged alternative action stage directly, so its own animation completion
selects the held pose. `validation.json` records the original scoped authoring
checks; the selected runtime has separate source-integrity and stage tests.
