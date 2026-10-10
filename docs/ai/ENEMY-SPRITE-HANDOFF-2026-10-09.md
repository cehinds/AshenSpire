# Enemy sprite integration handoff — 2026-10-09

Owner request: integrate the current package into the game on `dev`, merge what exists, and leave a handoff. Enemy direction is toward the viewer, angled slightly **screen-left**. The player's intended direction is screen-right; player artwork is outside this package.

## Package

- 33 canonical enemies, 24 independently painted poses each: 792 transparent frames.
- Per enemy: attack (4), counterattack (4), magic attack (3), physical ranged attack (2), sweep (4), block (2), wounded, hit, defeated, preparing and idle.
- Six sequences use a 260 ms authoring duration; runtime scales to the existing action window. The stage introduces no gameplay delay or mechanical events.
- All exported frames use a 512-square canvas and floor at y=480. Source cells are smaller and have been upscaled; these are not native 512-detail paintings.
- Runtime paths: `assets/enemy-poses/expansion/<enemyId>/<pose>.webp`, resolved through the existing art-pack loader.
- Art authoring location: `AshenSpire-art/art/enemy-expansion-2026-10-09/`. The rebuild tool generates projects with embedded whole-pose layers, not articulated anatomy or weapon rigs.
- Local complete package: `D:/repos/.codex/outputs/sprite-expansion-2026-10-09/enemies`. Original preview at `http://127.0.0.1:8807/` while its local server runs.

## Runtime and coverage boundary

`src/ui/enemyExpansionStage.js` registers the shared stage for enemy sprites. Current HP, block and statuses select resting wounded, guard and afflicted art. Defeat remains terminal; reduced motion keeps a static pose. Committed action events select melee, physical ranged, spell and guard sequences through `src/model/enemyActionPose.js`; no future move or hidden-intent data is read.

Counterattack, sweep and preparing frames exist in the package. Their use depends on an explicit matching runtime call/family. Do not claim every enemy move now has a bespoke mapping. Status-effect art aliases wounded; guard-hit reuses block. Sleep/prone alias defeated when explicitly requested. Player sprite production remains separate.

## Known art work to continue

1. Review every contact sheet at game size and during playback. Generated metadata deliberately records zero owner-approved sets; automated alpha and boundary checks do not establish anatomy, grip or visual acceptance.
2. Repair source cell intersections, clipped weapon/effect tips and stray fragments. `manifest.json` records per-frame source-boundary flags. Soldier sweep-02/block-01 were repaired, but sweep-03/04 still need inspection.
3. Inspect Glass Regent and Valkyrie Shade for gray/cyan matte halos; inspect winged silhouettes and long spears for edge intersections.
4. Stitched King uses a fully clothed patchwork-armored variant. Its body design differs from the original exposed stitched figure and needs an explicit art decision before calling it canonical/approved.
5. Eclipse Cantor ranged-02 was replaced with a full-body physical-throw pose after the source cell contained only a projectile.
6. Continue angle-fidelity review: Stitched Hound idle remains more side-on than the supplied soldier reference. The target is front three-quarter/screen-left; generation is not owner acceptance. Validate on a physical phone.
7. The portable project schema passed validation. The earlier workshop browser screenshot remained at “Loading workshop”; do not treat it as a successful editor import. Serve `.mjs` with JavaScript MIME and verify actual project loading.

## Continue safely

Use the isolated game checkout `D:/repos/.codex/worktrees/enemy-sprite-integration/AshenSpire` and art checkout `D:/repos/.codex/worktrees/enemy-sprite-art`. Preserve the dirty primary checkout and the original reference checkout `D:/repos/.codex/worktrees/0460/AshenSpire` at `bcfa0eab3ef60681bb92106b9ada5480fd5ae602`.

Follow the art repository's normal PR/automatic pack publication, then pin the resulting release in the game. Regenerate `art-manifest.json` and build receipts with repository tooling. Merge only after review and required checks, then follow current `CONTRIBUTING.md` for `dev` → `test`. The retired root `alternative/dev` and `alternative/test` branches must remain frozen. This handoff does not authorize a game release or claim owner art acceptance.

## Validation receipt (integration work)

- Canonical roster comparison: 33/33 enemies, 24 frames each, six 260 ms sequences.
- Runtime WebP inspection: all 792 exports are 512×512 with alpha.
- Art repository generator: 792 new light twins, 6,344 existing twins retained;
  7,136 twins verified, 51,926,996 inlined bytes against an 81,500,000-byte budget.
- Art tests: 19 tests passed during packaging; the remaining committed-tree test
  initially observed generation in progress, then passed after generation completed.
- Focused game tests: 11 passed, covering routing, durations, reactions, defeat,
  reduced motion and failed-asset retry through the verified pack resolver.
- Edge headless renderer review: actual `enemySprite` idle/attack/magic playback,
  no page or asset-response errors. Screenshots are under
  `docs/preview/enemy-expansion-2026-10-09/`; this is a renderer harness, not a full
  combat playthrough or physical-phone acceptance.
- The large local full-suite run was stopped during discovered tests to reduce
  disk contention. Its completion is not claimed. Required PR/promotion CI still
  has to establish the final merged result.

### Actual combat smoke check

After integrating current dev/player attacks, 14 focused tests passed. Source combat ran at 1440×1000 and 390×844 in Edge. The test confirmed End Turn, declined reaction offers, and advanced turn 1 → 2 (event log 12 → 45) in both viewports. Enemy art requests and page execution had no errors. Four optional audio probes returned 404; those IDs are absent from the pinned manifest and retain existing procedural fallbacks. Screenshots and the machine-readable receipt are under `docs/preview/enemy-expansion-2026-10-09/`. This supersedes the earlier renderer-only coverage statement; phone emulation is still not a physical-phone test.

### Transfer layout

Runtime high/light frames, source sheets, overrides, references and the rebuild script are committed to the art repository. Generated PNG exports, contact sheets and embedded projects remain in the complete local package and are reproducible with `node build.cjs` plus Sharp. The full ready-to-open export snapshot is additionally preserved locally on art branch `codex/enemy-sprite-expansion` at `f1ecc42`; the lean merge branch is `codex/enemy-sprite-runtime-integration`. This avoids transferring duplicate embedded copies of every painted frame and does not change the runtime pack hashes.

### Delivery checkpoints

Art PR https://github.com/cehinds/AshenSpire-art/pull/20 merged at 0b0ca43e57c36b588998e0a4df35bf340eff0508. Pack CI and automatic publication succeeded. Release hd-assets-v18 published 2026-10-10T06:49:03Z; all high/light/common hashes match the locally verified candidates. Game integration PR: https://github.com/cehinds/AshenSpire/pull/1795. Verify its current merge/promotion status before continuing; do not infer merge from this checkpoint.

Next art pass: rebuild/open the portable projects, inspect all contact sheets at game scale, repair marked cell-edge intersections and matte halos, correct Stitched Hound's side-on idle toward the approved front three-quarter screen-left angle, and obtain a decision on the Stitched King design. Keep committed-action timing and hidden-intent boundaries intact. Run actual combat after replacements and validate on a physical phone. Do not treat the generated approval count as owner acceptance.
