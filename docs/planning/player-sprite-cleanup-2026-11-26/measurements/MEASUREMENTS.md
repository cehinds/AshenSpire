# Player sprite runtime measurements — planning evidence

**Baseline:** game source `49eca254d795d06266aa23941cb2b31fe77b27bf`, art pin `cehinds/AI-Art` / `ashenspire-hd-assets-v30`, audited 2026-11-26. Primary examples: **Reaver Sweep** and **Starseer taking a hit**. This is a body-sprite inventory and static reconstruction of current placement, not an implementation or a completed gameplay/browser test.

## Reproduce and interpret

From the game checkout, run:

```powershell
node docs/planning/player-sprite-cleanup-2026-11-26/measurements/audit.mjs --cache C:\repos\AshenSpire\.art-cache\ashenspire-hd-assets-v30
```

Requires the existing Node runtime and Python with Pillow; `--python <executable>` selects another installed Python. The script reads the pinned cache, imports existing pure catalogs/models, checks 23 owning source files against the named Git baseline after CRLF normalization, and writes only sibling audit evidence. It never writes game code, source artwork or the cache, and never invokes an exporter or a Git mutation.

- [inventory.csv](inventory.csv): 184 pose/alias/hurt/defeated rows, including declared canvas/raster metadata, actual decoded raster sizes and hashes, alpha bounds, semantic landmarks, calibration factors, draw rectangles, sequence/held roles and source provenance where cataloged.
- [action-mappings.json](action-mappings.json): assembled sequences, held paths, conditional Reaver target reactions, profile selection, separate hurt/defeated sources and dynamic origin policy.
- [summary.json](summary.json): class references, padding, counts and missing-landmark paths.
- [source-hashes.json](source-hashes.json): baseline blob hash and local-file SHA-256; separate LF-normalized hash accounts for Windows checkout line endings.
- [raster-hashes.json](raster-hashes.json): 330 decoded physical raster files for 298 asset identifiers, covering common display art and high/light body packages; each existing file has SHA-256, pixel size and alpha >=128 bounds.

All four JSON artifacts are below 256 KiB. `inventory.csv` retains duplicate keys/roles because different selected aliases can point to the same raster; unique-path counts deduplicate them. An "available" path means the assembled family exposes it through a selected sequence, held/rest pose or supported target reaction; this does **not** claim every authored card or save currently triggers that path. The inventory includes unused assembled frame remnants so they cannot be mistaken for the selected action. It excludes scenery, portraits, aura/trail-only effects and other non-body game art.

Actual raster bytes were decoded and hashed, not inferred from catalog declarations. There were **0 missing physical rasters and 0 mismatches against provided catalog export hashes**. Some catalogs omit hashes; those rasters have measured hashes, without claiming a catalog comparison. Source-master path/hash fields are provenance copied from catalogs, not proof that an editable master was opened or verified. The full art archive ZIPs were not rehashed or downloaded. This evidence applies to the local pinned snapshot, not a claimed current live website or release deployment.

## Active selection and its limits

The current path is `playerSprite()` → `createAlternativeCardStage()` first ([assets.js:757–765](../../../../src/ui/assets.js#L757)); the old painted-outfit/class sprite families are fallbacks. [cardAnimationFamily.js:14–59](../../../../src/model/cardAnimationFamily.js#L14) merges base action art, selected counter/sweep art, held stances, and the selected pilot/Smash override. Testing an old pose sheet alone would not cover this active selection.

[combatWeaponPresentation.js:7–18](../../../../src/model/combatWeaponPresentation.js#L7) sets `DEFAULT_COMBAT_WEAPONS=true`: appearance uses fixed starter hands and default armour, while actual equipment still owns mechanics. Consequently per-equipment attack families are currently omitted from family assembly (`cardAnimationFamily.js:21`). This plan must not imply that every cataloged weapon/outfit variant is active combat art.

| Class | Fixed appearance hands | Selected weapon pilot | Selected Smash package | Available unique frame paths | Paths with semantic landmarks |
| --- | --- | --- | --- | ---: | ---: |
| Reaver | Greatsword | `reaver-greatsword-pilot` | Pilot Smash | 39 | 9 |
| Rogue | Dagger + buckler | None | `rogue` | 28 | 8 |
| Starseer | Ash staff | None | `starseer` | 25 | 8 |
| Herald | Bone sceptre | None | `herald` | 25 | 8 |
| Total | | | | **117** | **33** |

Thus **84 available frame paths have no semantic head/feet landmarks**. Across the whole assembled catalog there are 157 unique frame paths and 176 frame/alias rows, plus four hurt and four defeated rows. Missing landmarks are coverage information, not a requirement to normalize all those frames by posed height.

Reaver pilot frames replace selected attack, Smash, Sweep, counter preparations/replies and Evade where the sequence is supported; `reactionPoses` additionally exposes Evade, guard-break, fully-defended and Defend target reactions (`alternativeCardStage.js:259–263`). Other classes retain selected counter/sweep sequences, selected held states and class Smash overrides. `origin` resolves to the **current** held/rest pose at sample time (`alternativeCardStage.js:113,128`), so a Sweep from Idle and a Sweep from held Sweep have different bookends. Card classification and conditional Counter routing still choose among the available sequences; inventory availability is not a card-routing proof.

Fallback/reduced-mode constraints:

- A missing sampled frame uses `ready` inside the stage, while failed preloads mark an artwork placeholder. Separately loaded hurt art retains the current pose until loaded. Test loading and action selection separately.
- Still/rendered/non-combat presentation and reduced motion suppress the hurt replacement; normal-motion hit QA is necessary (`alternativeCardStage.js:234`). Instant pacing still allows the finite hurt clip. Target body reactions can temporarily take precedence over the generic hurt clip.
- Common display frames have full/mobile IDs, but this stage explicitly loads `frame.path`, not `frame.lite` (`alternativeCardStage.js:84–86`). Existing mobile siblings should be checked for consistency without claiming they were the automatically selected phone source. Hurt `assetUrl()` resolves the build/source tier; both actual high/light packages were measured here.
- Combat and desktop card-animation inspection share the family/stage, but inspection playback has its own gating/speed. A still screenshot does not verify a transition, and phone inspection is not the same animation surface as desktop inspection.

## Current placement formula

There are three distinct coordinate systems: source-raster pixels, stage draw units and local CSS pixels, followed by the battlefield's own viewport fit. Do not compare a 256px source landmark directly with a 1024px source landmark.

For a measured frame with raster landmarks `headY`, `feetY`, raster height `H` and initial draw height `D`:

```text
posedSpanStage = (feetY - headY) * D / H
referenceBodyStage = ready landmark span * ready draw height / ready raster height
normalizationFactor = referenceBodyStage / posedSpanStage
final bitmap width/height = authored width/height * normalizationFactor
```

[CombatBodyModel.js:23–34](../../../../src/ui/models/CombatBodyModel.js#L23) scales the entire image about its horizontal anchor and supporting feet. `bodyPlacement()` moves those feet to the held floor; `bodyResize()` preserves the original frame's source-feet position. [alternativeCardStage.js:166–178](../../../../src/ui/alternativeCardStage.js#L166) uses the held rule when not playing or when the sampled path equals the current rest path; other measured action/reaction frames use the second rule. Unmeasured frames retain authored placement. Hurt clipping bypasses these landmarks entirely.

The comments at lines 167–170 refer to retaining transient crouches/jumps, but lines 173–178 apply equal vertical body span to **every measured** frame. Preserving the feet's lift does not preserve the pose's vertical compression. The code is the evidence; do not read the comment as a crouch-scale exemption.

The outer stage initially uses `cssScale = 190 / (464 - ready.bounds[1])`. Ready body references are Reaver 261, Rogue 326, Starseer 294, Herald 303 stage units. Their pre-battlefield semantic CSS spans are 190, 190, 176.214511 and 190 respectively. These are local stage measurements, **not final on-screen combat heights**: `bodyHeightRatio` reports that reference to the battlefield. [CombatViewportSizeModel.js:30–32](../../../../src/ui/models/CombatViewportSizeModel.js#L30) then applies viewport share, stature and the existing player multiplier. Preserve those intended layout controls while reviewing per-pose calibration. `CombatSpriteScaleModel.js` explicitly says its older shared fit is superseded.

## Primary case A: Reaver held Sweep → Sweep action

Selected source option is SW09. Held frame is `assets-display/alternative/reaver-greatsword-pilot-sweep.webp`; action frames add `-windup`, `-contact`, `-finish` before `.webp`. All four full rasters decode at 1024×1024. Each has catalog draw size `[1024,1024]` and draw offset `[-136,-270]`.

| Measurement | Ready | Held Sweep | Windup / contact / finish |
| --- | ---: | ---: | ---: |
| Landmark raster height | 256 | 1024 | Unmeasured |
| Semantic head / supporting feet | 101.5 / 232 | 414 / 759 | Unmeasured |
| Authored vertical semantic span in stage units | 261 | 345 | Unknown |
| Normalization factor | 1 | **0.756521739** | **1** |
| Final bitmap draw width/height | 512 | **774.678261** | **1024** |
| Final semantic vertical span | 261 | 261 | Unknown |

Reaver stage padding is left83, top81, right81; physical canvas is 932×625. At zero travel/recoil, ready draw rectangle is `[211,97,512,512]`. Held Sweep rectangle is `[73.608696,-13.2,774.678261,774.678261]`; its feet land at stage y561. The unmeasured three action rectangles are `[-53,-173,1024,1024]`. The hypothetical action-mode draw of the held raster would have top11.8 rather than -13.2 because `bodyResize()` preserves its original feet y586. The actual bookend uses held registration when it resolves to the held Sweep path.

The selected animation is `origin → pilot-sweep-windup → pilot-sweep-contact → pilot-sweep-finish → origin`, impact index2, zero travel. Its three transient frames lack landmarks. Thus their source-pixel-to-stage scale is **1.321839080×** the held frame's normalized scale. This is a confirmed registration-policy discontinuity. It is **not** proof that the character's anatomy is 32.18% larger: the source drawings differ, the pose bends, and no limb/head calibration has yet established physical equivalence. Also, the held rule numerically *shrinks* this particular 1024px bitmap relative to authored scale; the user's visual complaint must not be reduced to "the normalizer always enlarges every Sweep bitmap."

Before selecting a fix, compare the actual SW09 anatomy at both its authored and runtime registrations with ready and both bookends. Measure stable head/torso/limb references, pose compression, perspective and source proportions. Do not substitute silhouette/weapon bounds for those measurements.

## Primary case B: Starseer takes a hit

Ready is `assets-display/alternative/card-starseer-ready.webp`, 256×256, SHA-256 `33f34a784254ca1494d793c3d9c806f63f96620ae002359d82ac1246c3c7972c`. Its semantic head85 / feet232 produce a ready span294 in the 512-unit draw.

[playerHurtFrames.js:8](../../../../src/content/playerHurtFrames.js#L8) selects the separate **unarmed-magic** package: `assets/animations/unarmed-magic/starseer/HURT.webp`, scale0.8125, dx49.41, dy72.00. Actual high raster512×512 has SHA-256 `6014d268d24694129335242764f28a91e12ed04668b411e8195e1cf33b2c90f0`; light raster256×256 has SHA-256 `f0c00f4e3d66fc5ce092c3ff6ec30234edca5e5c9c15c0b9214ff31ea7f4c417`.

At zero recoil, padded canvas placement is `[177.41,125.349785,416,416]`. Starseer top padding is37.349785; the requested canvas581.349785 height becomes physical integer581 when assigned to `canvas.height`. Hurt has no semantic head/sole landmarks in this path; its generated registration uses opaque alpha bounds, not anatomy. Actual alpha>=128 boxes are ready `[73,75,171,231]`, high hurt `[100,96,379,480]`, light hurt `[50,48,189,240]` (right/bottom exclusive).

Ready alpha height156×2=312 stage units; high hurt alpha height384×0.8125=312. Alpha bottoms also register to ready (`72 + 480×0.8125 = 462`). That confirms the generator's **silhouette-height/floor alignment**, not the character's identity, costume, head proportions, weapon continuity or anatomically correct hit compression. `tools/player-hurt-registration.py:15–25,74–89` deliberately solves equality of alpha-box height and bottom centre. A wrong model can satisfy that equation exactly. Review the visual evidence for identity; changing scale alone cannot repair a different costume/body design.

## Cleanup standard to evaluate, not implement here

1. Choose a canonical visual reference per class and record the approved head/face, hair, silhouette, costume, palette, weapon and body proportions. Use it across ready, held stances, attacks, reactions and defeat. Class identities may differ; each class's own character should remain recognizable.
2. Establish an artist-reviewed standing-equivalent physical calibration per source package (or per frame when source generation drift demands it). Record raster-to-character-unit scale separately from the *posed vertical extent*. Use several stable anatomy measurements or a shared source rig/reference; perspective/foreshortening needs manual review. A head-to-feet vertical span from a bent pose is insufficient to recover physical height.
3. Keep that calibrated physical scale through crouch/Sweep/compression; a bent body naturally has a lower head. Track supporting-foot/root anchors and intentional airborne lift separately. Reuse the exact same calibrated placement for identical bookend rasters. Do not fit every action independently to the same vertical box.
4. Separate calibration from silhouette bounds (edge/clipping reserve), semantic posed landmarks (body/effect positioning), and stable ready/reference geometry (battlefield/HUD placement). Existing viewport multipliers and intentional class/stature relationships remain distinct decisions.
5. Record each row's disposition: keep, registration-only correction, source-selection correction, redraw/regenerate, or unresolved. A proposed ±5% anatomy-reference tolerance is a review starting point, not an automatic proof or an already approved acceptance threshold; justify exemptions for perspective and animation exaggeration. No blanket target can be inferred from this inventory alone.

## Shared-helper and verification consequences

- `CombatBodyModel` is shared: `enemyExpansionStage.js:81` calls `bodyScaleFactor`, and existing enemy tests expect equal head/feet spans. A future player fix should explicitly choose its own calibration boundary; do not silently change enemy bodies through a shared helper.
- `tests/combat-body-model.test.mjs:26` currently requires all four class held states to equal ready vertical body height. `tests/pose-invariant-body-size.test.mjs:8,32` tests enemy equal height and feet-preserving resize. Those assumptions need a scoped design decision and future behavior-based replacements where affected; no tests were altered or runtime suite rerun for this planning-only audit.
- `combatSpriteGeometry.js:102–149,204–217` freezes layout geometry through actions and prefers rest/reference art for body placement. Keep stable mini-HUD/intent/target controls while art bends or jumps. Do not make the HUD chase the current crouch or enlarged weapon silhouette.
- Future implementation evidence should show ready→held Sweep→windup→contact→finish→held/idle on Reaver, and Starseer idle/held→hit→same original pose, with normal and reduced motion, full/light rasters where selected, desktop/mobile and desktop inspection. Measure clipping reserves, root/feet continuity, intended airborne movement, costume/weapon identity and major body proportions. Include sequence playback, not only isolated contact sheets.
- This audit verifies reproducibility and source/raster provenance for planning. It does not establish live browser correctness, select replacement artwork, grant approval to generate assets, or authorize publishing/integration.
