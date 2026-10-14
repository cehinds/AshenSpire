# Enemy sprite integration handoff — 2026-10-09

## Continuation checkpoint — 2026-10-14

Continue on `feature/AddEnemySpriteStances`, reconciled with current dev at
`0cf6166fcc21d5482f82d1bad35ab8965663dfb0`. This continuation targets that feature
branch; it does not authorize merging into dev or test.

The integration rules have changed since the October 9–10 notes below. Current
`DEVELOPER.md` requires art release caches for runtime readers: update the verified `art-release.json`
pin, regenerate `art-manifest.json` with `node tools/art-manifest.mjs --write`,
and fetch the pinned packs with `node tools/fetch-art.mjs --pack all`.
`CONTRIBUTING.md` explicitly retains the tracked light tier under `assets-mobile/`
(owner decision, October 11), so refresh the changed compact twin from the
verified light pack as well. The high/art authoring trees remain external.
Feature pull requests do not commit
`buildordinal.json`; the dev build-stamp workflow owns merged build identity.

PR #1799 is merged. Subsequent dev fixes also restore the expansion idle bob,
remove failed frames until Retry/load restores them, preserve detached-frame
built-in fallbacks, and name non-interactive placeholders for reachability checks.
The exact-head dev preview and phone reachability gates at the head above passed.
The old post-promotion failures below describe historical evidence, not current
unfixed sprite bugs. Focused enemy expansion, art Retry and external-play network
tests passed 15/15 on the reconciled feature branch.

The current art repair covers Stitched Hound idle only. Keep its 512-square canvas,
floor y=480 and painted height 343 so the other 23 frames retain their scale and
action timing. The authored replacement PNG is 328 pixels wide; the final encoded
high WebP measures 329 pixels at alpha >8. Update only `idleWidth` 347 → 329 in
`src/content/enemyExpansion.js`; keep `idleHeight: 343`.
Review the actual renderer at desktop and 390×650 before publishing or pinning.
Physical-phone and owner artwork acceptance remain separate.

Art PR #24 merged at `ed7e7f12f694511f554e98f2341fdcb13c47a71d` and published
`hd-assets-v22`. Published high/light/common pack SHA-256 values match the local
verified packs. The game pin and regenerated manifest contain that release; only
the Stitched Hound idle manifest ID changed. All 7312 high, 7312 light and 146
common files were verified into the v22 cache, and the retained tracked compact
idle was refreshed from its verified light twin.

Source combat smoke used the canonical `a2_kennel` encounter through a temporary
shot-fixture route, with two Stitched Hounds. End Turn and declining reaction
offers advanced turn 1 → 2 and event log 12 → 47 at 1440×1000 and 390×650. No
page or art request errors occurred. Optional existing SFX probes returned 404
for `playerHurt`, `deckShuffle`, `cardDraw` and `turnStinger`; these remain outside
this art repair. Evidence and executable harnesses are under
`D:/repos/.codex/outputs/enemy-hound-review-20261014/`. This is source browser
and phone-emulation evidence, not physical-phone acceptance or a published game
build. `node tools/art-manifest.mjs --check` passed against all three fetched
packs. Focused enemy/Retry/network and manifest tests passed 29/29; the retained
tracked light-art hash check passed separately, for 30/30 checks total.

The final high idle SHA-256 is
`12fc21c34a884469beb277cbef41be92e4ef2132cb1668c91c97cf26ac7b0d42`;
the light idle SHA-256 is
`1da0f00263e3db632dfa211bb228bf9263cbba001d89eac378148d24886eb790`.
Actual renderer comparison passed idle, attack and return to idle at 1100×650
and 390×650, with no page/request errors. Both variants retain the same rendered
foot position (within 0.01px of the floor). All other 791 authoring frames are
byte-identical to the original package. The reviewed replacement has a more
viewer-facing chest and subdued charcoal/copper materials; this replaces the
historical side-on idle concern below, while owner and physical-phone acceptance
remain open.

## Persistent stance continuation — October 14

Persistent stance continuation (owner request, October 14): use the actual chosen
plan's category for held body artwork whether intent is visible or concealed.
The six visual categories are Smash, Attack, Counter, Sweep, Defend and Preparing.
Skill, Power and Spell preparation share Preparing; the `prepared` status is not
a stance. Solo paced snapshots and the co-op host/LAN boundary carry only a
`presentationStance` enum independently of the intent UI. Exact move IDs, numbers,
private knowledge and future rolls remain concealed. All 33 per-enemy six-family
selections received coordinator visual review; physical-phone and owner artwork
acceptance remain separate.

The preliminary runtime passed 22 focused tests and 48 real browser rendering
cases: solo and co-op, 1440×1000 and 390×650, each of six body categories with
hidden and visible intent. Concealed labels remained `?` for every category;
held category and loaded art were identical across visibility states, with no
page or non-optional request errors. The co-op driver feeds the real mount with
`projectLanSnapshot` output, including knowledge-enabled concealed reads; it is
not a two-device network connection. Evidence:
`D:/repos/.codex/outputs/enemy-hound-review-20261014/stance-browser.cjs` and
`stances/report.json`. This proves runtime selection/concealment, not final
stance artwork quality. That preliminary gallery and its pending counter cells
are superseded by the published-asset gallery described below.

The counter category now uses the additive asset ID
`assets/enemy-poses/expansion/<enemyId>/stance-counter.webp`, distinct from all
four committed counterattack frames. The catalog publishes explicit six-category
asset IDs for every enemy, and the stage preloads these held assets separately
from the existing 24-frame clip set. A manifest gate requires every held asset in
both high and light tiers; it passes with the verified v23 release. The approved temporary
Hound counter candidate passed idle → counter → defend → counter and hit-return
checks at desktop and phone size, with unchanged 190px stage height and zero
page errors. Review driver/results are in
`D:/repos/.codex/outputs/enemy-hound-review-20261014/hound-counter-preview.cjs`
and `hound-counter-v2/report.json`. The preliminary 48-case evidence above
predates publication and is superseded by final release checks below.

The five remaining families were visually reviewed against all 33 complete
contact sheets. The catalog now records explicit per-enemy selections, including
clean low-ready `counterattack-02` reuse for Bell Keeper and Stitched King Attack,
and contained `magic-01` charge for 29 Preparing entries; Soldier, Briar Hermit,
Living Armor and Eclipse Cantor retain their clear existing Preparing poses.
Preparing remains one generic category shared by Skill, Power and Spell.
Coordinator game-size review approved three additional grounded held assets:
Stitched Hound `stance-smash` and `stance-sweep`, and Blight Hound `stance-smash`.
Existing Hound attack-03 is airborne; Stitched Hound sweep alternatives face
right, retain a motion trace, or turn away. Do not freeze those action frames as
held cues. Together with 33 new Counters, the package adds 36 assets without
overwriting any of the original 792 frames. Matrix and comparison evidence:
`D:/repos/.codex/outputs/enemy-hound-review-20261014/reviewed-stance-selection.json`
and `selection-comparisons/`. The matrix records 28 pre-existing source-edge
warnings among selected old frames (zero export boundary pixels); these are
not newly introduced clipping or an automated art acceptance receipt.

### Published stance delivery — October 14

Art PR #25 merged at `b9daa888a83b0cf430fc606e983673778dec1a2d` and release
run #38626939206 published `hd-assets-v23`. The high/light/common ZIP digests
were independently matched to GitHub release assets before integration. The
pin and derived manifest include exactly 36 new IDs; no original pose IDs
changed. Verified caches contain 7348 high, 7348 light and 146 common files.
Only the 36 new compact twins were copied into retained `assets-mobile/` after
checking each published light hash. The actual act1/act2/act3 roster assertion
covers all 33 enemies and every six-family mapping in both published tiers.

The focused package contains 74 checks across stance/model, original clips,
Retry, sprite scale, LAN knowledge/privacy, co-op projection/UI, party reaction
rules, manifest and retained compact hashes. Its first run passed 73/74; the
sole stale expectation named Hound Preparing `preparing` rather than the
reviewed `magic-01`. The assertion now follows the explicit catalog, and all
six stance tests passed on rerun, including null intent, defeat, reduced motion,
action return and plan changes. All other 68 checks passed in the package run.

Published-asset browser QA passed all 48 solo/co-op × desktop/390×650 × six
category × hidden/revealed cases. Hidden labels stayed `??`; every held asset
loaded, with zero page and non-optional request errors. The real renderer gallery
loaded all 198 cells without draft labels or counter placeholders. The real
canonical `a2_kennel` fight advanced turn 1→2 and events 12→47 on both viewports;
both Hounds settled to the actual next planned Attack stance (`attack-02`).
The four known optional SFX 404s remain: playerHurt, deckShuffle, cardDraw,
turnStinger. Co-op QA uses the real mount with projected snapshots, not a
two-device network session. Phone dimensions are browser emulation.

Final drivers and evidence are in
`D:/repos/.codex/outputs/enemy-hound-review-20261014/`: `stance-browser.cjs`
and `stances/report.json`, `stance-gallery-final.cjs` and
`stance-gallery-final/report.json`, `combat-final.cjs` and `combat-final/combat.json`.

Editable projects and contacts for all 33 are delivered under
`D:/repos/.codex/outputs/enemy-persistent-stances-20261014/authoring`.
All 33 portable projects passed Workshop schema/image/queue validation. Actual
Workshop Open project and playback succeeded for Hound (including its three new
held poses) and Wandering Soldier: six distinct rendered queue frames each,
no missing artwork or page errors. The localhost editor resolves the historical
Loading workshop blocker below. Chrome plugin file upload still needs a user
extension permission, left unchanged; the bundled Playwright QA fallback loaded
the same projects through the actual editor control. Screenshots and report:
`workshop-qa/`, driver `workshop-import-qa.cjs` in the runtime evidence directory.
Physical-phone testing and final owner artwork acceptance remain pending.

## Historical October 9–10 checkpoint

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

`src/ui/enemyExpansionStage.js` registers the shared stage for enemy sprites. In this historical implementation current HP, block and statuses selected resting wounded, guard and afflicted art. The October 14 continuation above adds the public held plan category, which takes priority over those resting status poses. Defeat remains terminal; reduced motion keeps a static pose. Committed action events still select melee, physical ranged, spell and guard sequences through `src/model/enemyActionPose.js`; held-category selection does not expose exact move data or alter committed action timing.

Counterattack, sweep and preparing frames exist in the package. Their use depends on an explicit matching runtime call/family. Do not claim every enemy move now has a bespoke mapping. Status-effect art aliases wounded; guard-hit reuses block. Sleep/prone alias defeated when explicitly requested. Player sprite production remains separate.

## Known art work to continue

1. Review every contact sheet at game size and during playback. Generated metadata deliberately records zero owner-approved sets; automated alpha and boundary checks do not establish anatomy, grip or visual acceptance.
2. Repair source cell intersections, clipped weapon/effect tips and stray fragments. `manifest.json` records per-frame source-boundary flags. Soldier sweep-02/block-01 were repaired, but sweep-03/04 still need inspection.
3. Inspect Glass Regent and Valkyrie Shade for gray/cyan matte halos; inspect winged silhouettes and long spears for edge intersections.
4. Stitched King uses a fully clothed patchwork-armored variant. Its body design differs from the original exposed stitched figure and needs an explicit art decision before calling it canonical/approved.
5. Eclipse Cantor ranged-02 was replaced with a full-body physical-throw pose after the source cell contained only a projectile.
6. Continue angle-fidelity review across the remaining enemy poses. The target is front three-quarter/screen-left; generation is not owner acceptance. The October 14 Hound idle repair is documented above. Validate on a physical phone.
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

### Merged delivery and post-promotion follow-up

- Game PR #1795 merged into dev at d9a529bf296f3419699ae9ac65fc9579610b4bfe with every feature check green. Build: 0.7.1.1236. Architecture sync succeeded and produced bc6a6b530ecd11ef686bae99755631e4f6d95869.
- Promotion PR #1798 merged into test at 1f48d22b9f046d8f1a77f43a7d11f108ea129601. The full tests workflow, Windows installer, tutorial, map-camera, quick-start, co-op HUD and variant-sync workflow passed. Sync found no eligible named pairs and left frozen root branches untouched.
- Post-promotion preview run 38034887780 failed its blocked-index placeholder assertion: the new stage deliberately retains a hidden failed image, while the gate required zero image elements. Both combat and dialogue successfully redrew after Retry. Follow-up PR #1799 updates the assertion to require a marked placeholder with no loaded visible image. It must pass and merge separately; inspect its current status rather than assuming this file means it merged.
- Broad CI run 38034887740 reported mobile visual reach known-bads (2/4) and all-five-layout failures. The 390x650 baseline has covered combatant controls in combat-xl and covered Info/target controls in combat-overlap. The all-five-layout gate additionally reports combat-xl/overlap failures at 360x640 and 844x390; inspect job 114163152772. Do not call post-promotion CI green. Retrieve current job logs and reproduce at that viewport before changing geometry; this has not yet been isolated to new sprite dimensions versus the preceding HUD changes.
- Local blocked-index rerun encountered multiple loading/time-limit failures under disk contention and does not establish a pass. Dedicated dev-preview run 38035796100 on codex/enemy-retry-gate passed the actual blocked-index Retry step (job 114165830319), as well as normal HTTP/file loading and high-to-light fallback. The original CI evidence establishes successful retry redraw, not a clean complete blocked-index run.
- At this historical checkpoint all 792 new compact files were copied from the verified v18 light cache, and the complete 7136-file local-light-art test passed with exact manifest sizes and hashes. Current runtime readers use verified external pack caches, while CONTRIBUTING.md retains the tracked light tier; follow the October 14 checkpoint above for both parts of new art updates.
