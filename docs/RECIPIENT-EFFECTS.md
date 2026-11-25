# Recipient effects

These animations decorate resolved events on the affected player or enemy. They do not infer successful hits from selected targets or change combat mechanics. Physical contact, spell contact, Ward, buffs/debuffs, status lifecycle and defensive reactions can share geometry while palette and separate overlay layers carry their meaning. Sweep is one group sprite per action. Range presentation has only melee and reach. Legacy ranged labels normalize to reach. Recipient sprites show in both Full and Lite, including when decorative Effects are off. Reduced motion and Reduce flashes suppress this animation.

## Authoritative configuration

Edit `content/config/ui/presentation/recipientEffects.json`, then run:

```powershell
node tools/config-build.mjs
node tools/config-build.mjs --check
```

`src/content/recipientEffectSettings.js` exports `RECIPIENT_EFFECT_SETTINGS` (`SETTINGS`) from the compiled `uiConfig.presentation.recipientEffects`. The authored sections are:

| Section | Purpose |
| --- | --- |
| `behavior` | Palettes, enable flag, combat warm-up list, three-frame count, versioned atlas entries, status aliases, and content-bounds threshold |
| `motion` | Impact/aura/caster windup durations, melee/reach timing, reaction offset, queue scope, clip cap, gap and overlap |
| `sizing` | Actor-relative footprints, Ward/circle sizing, group Sweep, element/status overlay scale and delivery dimensions |
| `layering` | Global effect opacity, relative layer and frame strengths, tint mix, status offset and stack intensity |

Neutral magic is royal blue (`#4169E1`). `layering.opacity.global` defaults to `0.8` and caps each rendered recipient effect, including its composite planes, caster circles, reach delivery, silhouettes, and the debug mark. Layer and frame factors control relative strength. Card art uses its own settings. All elemental/school circles share `spell-circle` geometry and take their tint procedurally. White highlights are preserved by grayscale-before-tint mixing. Physical neutral artwork and colored element overlays retain their source color. Ward and Evade derive their ghost/mask from the actual protected/reacting actor, never the demonstration human silhouette.

Healing uses a green three-plus V motif. Bleed uses red droplets. Each is a separate result clip. The production scheduler advances each action through casting and movement, attack impacts, defense and reactions, then buffs and statuses. Same-category clips start at least 10 ms apart. A category may start up to 10 ms before the preceding category finishes. At most two clips per category, three across the battlefield, and two on one actor can be active. Capacity holds excess clips in the queue until they fit. A grouped clip counts once toward the battlefield and category limits and occupies one slot on each of its recipients. Master opacity defaults to 80%. The authored controls live under `motion.categoryQueues` and `layering.opacity.global`. Disabling category queues exposes the legacy scope, cap, gap and overlap settings.

Elemental textures and actor silhouettes share their clip's timing. Sweep counts once across all recipients. Caster windup, delivery and impact follow that order for the same action. Every clip keeps its authored duration and frame speed. Queued clips can finish during a turn transition. Skipping or leaving combat clears active and queued clips. The static debug mark identifies the action and recipient type.

Healing moves bottom → middle → top, with its largest source frame in the middle. Bleed uses its own droplet arrangement and moves top → middle → bottom. Per-shape `motion.secondaryOffsetY` stores normalized vertical offsets; source frame scale is preserved. Buff/debuff fill the exact target card bounds and reveal upward from its bottom via the authored card anchors and reveal/rise arrays.

WIS/Wisdom buffs reuse the shared buff shape in cyan (`wisdom` palette); SP/Stamina buffs reuse it in gold (`stamina` palette). Both follow the same exact-card, bottom-anchored reveal. These are palette aliases, not additional baked sprite assets.

MP/Mana uses blue-violet (`mana` palette), distinct from SP/Stamina and AP. Every actual positive attribute/resource grant or beneficial status can reuse this buff geometry; known identities select their palette and other positive identities use the generic neutral skill palette. Visual variants do not introduce new gameplay resources or grant events.

## Atlas and availability

`src/content/recipientEffectAtlas.js` exposes `RecipientEffectAtlasEntry(shape)`, returning `{asset,path,columns,rows,row}`, or `null` for an unknown shape. The 35 original strips retain their `assets/recipient-effects/v5/<shape>.png` IDs. The 12 additional strips use `assets/recipient-effects/v6/<shape>.png` and use their authored colors. Ward shatter uses the protected actor’s remembered Ward tint. Both generations use three columns, one row and 256×256 frames.

Ward break uses `ward-shatter` with the protected actor's Ward mask. Positive Evade and Counter gains have their own clips. An actual evade or countered hit still uses its original reaction clip. Reflect, Poison, Blight, Magic Vulnerable, Mirrors, Bind or Restrained, Weak, Vulnerable and Frail use dedicated motifs on confirmed results. `behavior.statusResultShapes` maps confirmed status IDs to sprite shapes and accepts the `base.` prefix used in Core 2. Zero-change applications, refreshes and stack consumption do not play gain clips.

`RecipientEffectArtAvailable(shape, resolveAsset)` checks whether the supplied asset resolver maps the ID to an inline/pack/high-resolution URL. A bare development path does not prove a file exists. A mounted fight starts decoding the configured contact, caster and element layers without delaying combat. When a clip is still cold or the art is unavailable, it uses the same static marker throughout its lifetime. In explicit source/art-authoring mode the renderer can load that path and fall back on failure. The existing `assetUrl()` seam remains responsible for runtime pack/tier resolution.

## Explicit art export and provenance

Approved pixel strips live in the local reviewed source package. Export never generates new imagery, changes colors, rescales frames, or removes original files. HD and light receive identical approved small PNGs. The demonstration `evade-afterimage` sprite is excluded from runtime; actual actor silhouettes supply that treatment.

```powershell
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art --check
```

The tool requires Pillow. It reads the authoritative atlas, validates all source strips before writing, stages `hd/assets/recipient-effects/v5/` and `light/assets/recipient-effects/v5/`, and preserves original raw PNGs, prompt JSONs and extraction manifests under `provenance/recipient-effects/v5/`. Inputs are selected from `overlay-v6/strips`, `composed-v5/additions/strips`, then `front-on-v4/strips`. It writes `recipient-effects-catalog.json` with schema version 1: each `entries[shape]` records asset ID, grid, frame/image dimensions, source path, SHA-256 and both tier paths; `provenance` records source paths and hashes. `--check` is read-only and fails on any missing/stale output or manifest.

The exporter output remains local intake staging. The approved 35 strips were published through [AI-Art PR #4](https://github.com/cehinds/AI-Art/pull/4) in [ashenspire-hd-assets-v27](https://github.com/cehinds/AI-Art/releases/tag/ashenspire-hd-assets-v27), targeting merge commit `72e3819a854612b9b6036d12ba17208213f2de43`. The current [ashenspire-hd-assets-v30 pin](https://github.com/cehinds/AI-Art/releases/tag/ashenspire-hd-assets-v30) includes the twelve v6 sheets and retains the original reviewed strips and [v5 provenance](https://github.com/cehinds/AI-Art/tree/ashenspire-hd-assets-v29/provenance/recipient-effects/v5). `art-release.json` pins its published ZIP names and verified SHA-256 values; `art-manifest.json` was regenerated from those ZIPs with `node tools/art-manifest.mjs --write`. All three packs were fetched and checked, and all twelve v6 sheets in both tiers match the approved files by SHA-256. The [source package and labelled previews](https://github.com/cehinds/AI-Art/tree/ashenspire/provenance/recipient-effects/v5) retain original prompts, raw sheets and extraction scripts. Without the effect artwork, the static debug fallback remains available.

## Local runtime preview

Start the source server and open `/tools/recipient-effects-runtime-preview.html` on the printed port.

```powershell
node tools/serve.mjs --host 127.0.0.1 --port 4327 --no-open --editor-write
```

In Score Studio, open `/tools/score-studio/` and select **Effects Timing**. The tab uses the same editor and authored file as the standalone preview. Switching tabs pauses playback and keeps unsaved values in place. The All categories and queue limits scenario exercises each category with extra clips waiting for capacity. Use One event to inspect an individual sprite or delivery.

The Timing panel previews scope, clip cap, gap, overlap and opacity as you edit. Use the sample sequence for one recipient or multiple recipients and compare the clip positions on the timeline. The preview uses the production planner and renderer with sample combat receipts.

**Save** writes the selected settings to `content/config/ui/presentation/recipientEffects.json` and rebuilds `src/config/generated/ui.js`. Use the write-enabled loopback source server for saves. A read-only server still supports local preview and JSON download. Reload the page to confirm the saved settings. Clip durations remain at their authored values.

The spell circle belongs to the invoker and is always a self effect, regardless of who receives the spell. It expands outward across three frames using `motion.spellCircleScale` (`0.3`, `0.65`, `1`) inside one fixed, centered caster anchor and uses the global opacity. This scaling applies only to the circle, and missing-art fallback remains static. Invoker and Recipient are independent selectors (Player invokes by default): self buffs keep both on the same actor, while hostile or allied effects place the follow-up on the chosen recipient. Ward grants preserve their caster identity. The public preview API provides `recipientRuntimePreview.configure({invoker, recipient, ...controls})`, `scrub(ms)`, and resolved `recipes`, `timing` and `plan` for deterministic review.

After `node tools/fetch-art.mjs --pack all`, the default page loads the pinned v30 effects and existing actor/background artwork through the normal source server and pinned art cache; no query parameter is required. For explicit local authoring, open `/tools/recipient-effects-runtime-preview.html?artRoot=../scratch/recipient-effects/integration-art/hd/`. This option maps only the effect catalog IDs to that directory without changing the pin or publishing files. Remove the query to return to normal pinned art, or check Debug fallback to compare the art-absent case.

`tools/recipient-effects-catalog.schema.json` describes the machine-readable intake catalog and is copied beside it. The exporter enforces source grid, dimensions, transparency, versioned IDs and byte identity without requiring a schema-validator dependency. The existing bundler discovers all files in the selected art tier's `assets/` tree; the staging package must not be presented as a release-pinned build.

Each authoritative `behavior.atlas` row explicitly declares `optional: true`: these sprites have a built-in static fallback and are not required to build against an older art release. `tools/literal-asset-references.mjs` allows absence only at that row's exact generated `asset` property in `src/config/generated/ui.js`, after validating its versioned shape/path, grid, and agreement with the authored JSON. It does not exempt another reference to the same path, another module, unrelated configuration, unknown IDs, or required entries. All other missing literal assets remain build errors. This changes neither manifest verification nor runtime loading: absent or failed art still uses the single static action/target placeholder, and available art follows the normal pack resolver.

## Verification and local evidence

```powershell
node --test tests/recipient-effects.test.mjs tests/recipient-effect-events.test.mjs tests/recipient-effect-sprites.test.mjs tests/buff-feedback.test.mjs
node tests/recipient-effects.browser.mjs
node tests/recipient-caster-preview.browser.mjs
node tools/config-build.mjs --check
node --test tests/literal-asset-references.test.mjs tests/build-identity.test.mjs
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art --check
```

The browser test starts a read-only local source server, imports the production modules, and requires the explicit staged art package plus the repository's normal actor/background art. It checks rendered pixels and missing-art fallback, then mounts the real combat screen and clicks authored cards through engine dispatch. Synthetic gallery receipts are kept separate from those real combat cases. No generated game build or saved campaign is overwritten.

Ignored local evidence is under `scratch/recipient-effects/runtime-browser/` for the tracked browser test, and `scratch/recipient-effects/integration-qa/evidence/` for the focused review: `report.json`, `real-combat-report.json`, `tool-checks.json`, `wis-sp-mp-buffs.png`, `heal-bleed-motion.png`, `royal-blue-circle.png`, and real-combat screenshots. The review checks actual actor silhouettes, exact card aura bounds, the historical secondary onset on the last primary frame, rising healing/falling blood, and one group Sweep. These historical captures document staged implementation/review. Publication and pin verification are separate: the v27 release and its downloaded artifacts were checked before adopting the new pin.

When the local review helpers are present, reconstruct its labelled PNGs from the saved production-renderer captures with `python scratch/recipient-effects/integration-qa/compose-final.py`. This performs only screenshot cropping/layout and labels; it neither generates nor modifies source sprite art. To refresh those inputs first, serve the checkout on port 4327 and run `node scratch/recipient-effects/integration-qa/run.mjs`. Original screenshots, captured recipe/settings records, source PNGs and provenance remain preserved separately.

The focused caster preview check verifies all four invoker/recipient pairings and that the actual painted circle bounds grow across its three frames while the host anchor stays fixed. Captures and the labelled sequential comparison are saved under `scratch/recipient-effects/caster-review/`.
