# Recipient effects

These animations decorate resolved events on the affected player or enemy. They do not infer successful hits from selected targets or change combat mechanics. Physical contact, spell contact, Ward, buffs/debuffs, status lifecycle and defensive reactions can share geometry while palette and separate overlay layers carry their meaning. Sweep is one group sprite per action. Range presentation has only melee and reach; legacy ranged labels normalize to reach.

## Authoritative configuration

Edit `content/config/ui/presentation/recipientEffects.json`, then run:

```powershell
node tools/config-build.mjs
node tools/config-build.mjs --check
```

`src/content/recipientEffectSettings.js` exports `RECIPIENT_EFFECT_SETTINGS` (`SETTINGS`) from the compiled `uiConfig.presentation.recipientEffects`. The authored sections are:

| Section | Purpose |
| --- | --- |
| `behavior` | Palettes, three-frame count, versioned atlas entries, neutral palettes and content-bounds threshold |
| `motion` | Impact/aura/caster windup durations, melee/reach timing, reaction offset, frame selection and secondary-overlay start frame |
| `sizing` | Actor-relative footprints, Ward/circle sizing, group Sweep, element/status overlay scale and delivery dimensions |
| `layering` | Primary/circle opacity, per-layer and per-frame opacity, tint mix, status offset and stack intensity |

Neutral magic is royal blue (`#4169E1`). Primary sprites and spell circles use `0.9` opacity. All elemental/school circles share `spell-circle` geometry and take their tint procedurally. White highlights are preserved by grayscale-before-tint mixing. Physical neutral artwork and colored element overlays retain their source color. Ward and Evade derive their ghost/mask from the actual protected/reacting actor, never the demonstration human silhouette.

Healing uses a green three-plus V motif; bleed/blood uses red droplets. These are separate secondary layers, starting when the primary enters its last frame (`motion.secondaryStartFrame`, zero-based). They do not replace fire/frost/etc. texture layers. Debug fallback is one static action × self/target/aoe mark, without status/elemental variations.

Healing moves bottom → middle → top, with its largest source frame in the middle. Bleed uses its own droplet arrangement and moves top → middle → bottom. Per-shape `motion.secondaryOffsetY` stores normalized vertical offsets; source frame scale is preserved. Buff/debuff fill the exact target card bounds and reveal upward from its bottom via the authored card anchors and reveal/rise arrays.

WIS/Wisdom buffs reuse the shared buff shape in cyan (`wisdom` palette); SP/Stamina buffs reuse it in gold (`stamina` palette). Both follow the same exact-card, bottom-anchored reveal. These are palette aliases, not additional baked sprite assets.

MP/Mana uses blue-violet (`mana` palette), distinct from SP/Stamina and AP. Every actual positive attribute/resource grant or beneficial status can reuse this buff geometry; known identities select their palette and other positive identities use the generic neutral skill palette. Visual variants do not introduce new gameplay resources or grant events.

## Atlas and availability

`src/content/recipientEffectAtlas.js` exposes `recipientEffectAtlasEntry(shape)`, returning `{asset,path,columns,rows,row}`, or `null` for an unknown shape. Every runtime ID is `assets/recipient-effects/v5/<shape>.png`: three columns, one row, 256×256 per frame. The versioned path cannot accidentally select the earlier four-row atlas.

`recipientEffectArtAvailable(shape, resolveAsset)` checks whether the supplied asset resolver maps the ID to an inline/pack/high-resolution URL. A bare development path is not proof that a file exists. In explicit source/art-authoring mode the renderer can load that path and fall back on failure. The existing `assetUrl()` seam remains responsible for runtime pack/tier resolution.

## Explicit art export and provenance

Approved pixel strips live in the local reviewed source package. Export never generates new imagery, changes colors, rescales frames, or removes original files. HD and light receive identical approved small PNGs. The demonstration `evade-afterimage` sprite is excluded from runtime; actual actor silhouettes supply that treatment.

```powershell
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art --check
```

The tool requires Pillow. It reads the authoritative atlas, validates all source strips before writing, stages `hd/assets/recipient-effects/v5/` and `light/assets/recipient-effects/v5/`, and preserves original raw PNGs, prompt JSONs and extraction manifests under `provenance/recipient-effects/v5/`. Inputs are selected from `overlay-v6/strips`, `composed-v5/additions/strips`, then `front-on-v4/strips`. It writes `recipient-effects-catalog.json` with schema version 1: each `entries[shape]` records asset ID, grid, frame/image dimensions, source path, SHA-256 and both tier paths; `provenance` records source paths and hashes. `--check` is read-only and fails on any missing/stale output or manifest.

The output is local intake staging, not a published art release. No other project's art checkout is used. An appropriate `cehinds/AI-Art` checkout on its AshenSpire branch is needed for a separately authorized intake/release. No pin or checksum is invented; the existing `art-release.json` and `art-manifest.json` remain unchanged until a verified art release exists. Without that art bundle, the static debug fallback remains available.

## Local runtime preview

Start the repository's source server with `node tools/serve.mjs --host 127.0.0.1` and open `/tools/recipient-effects-runtime-preview.html` on the printed port. This tracked page imports the production model, renderer, settings and art catalog. It offers action/camp/school/range/invoker/recipient/outcome controls and a presentation timeline. Its sample outcomes are explicit preview receipts; the page does not run or modify a saved fight.

The spell circle belongs to the invoker and is always a self effect, regardless of who receives the spell. It expands outward across three frames using `motion.spellCircleScale` (`0.3`, `0.65`, `1`) inside one fixed, centered caster anchor; opacity remains `0.9`. This scaling applies only to the circle, and missing-art fallback remains static. Invoker and Recipient are independent selectors (Player invokes by default): self buffs keep both on the same actor, while hostile or allied effects place the follow-up on the chosen recipient. Ward grants preserve their caster identity. The public preview API provides `recipientRuntimePreview.configure({invoker, recipient, ...controls})`, `scrub(ms)`, and resolved `recipes` for deterministic review.

The default page deliberately uses the static fallback for the unpublished new effect IDs. To apply the local intake package without modifying a pin, open `/tools/recipient-effects-runtime-preview.html?artRoot=../scratch/recipient-effects/integration-art/hd/`. This explicit authoring option maps only the new catalog IDs to the supplied directory through the same asset-map resolver. It does not publish or register those files. Remove the query or check Debug fallback to compare the art-absent case. Existing actor/background artwork is read from the normal source server's art resolution.

`tools/recipient-effects-catalog.schema.json` describes the machine-readable intake catalog and is copied beside it. The exporter enforces source grid, dimensions, transparency, versioned IDs and byte identity without requiring a schema-validator dependency. The existing bundler discovers all files in the selected art tier's `assets/` tree, so the versioned directory needs no hardcoded bundler exception. Its published-manifest checks still apply; the staging package must not be presented as a release-pinned build.

## Verification and local evidence

```powershell
node --test tests/recipient-effects.test.mjs tests/recipient-effect-events.test.mjs tests/recipient-effect-sprites.test.mjs tests/buff-feedback.test.mjs
node tests/recipient-effects.browser.mjs
node tests/recipient-caster-preview.browser.mjs
node tools/config-build.mjs --check
python tools/recipient-effects-export.py --source-root scratch/recipient-effects --output-root scratch/recipient-effects/integration-art --check
```

The browser test starts a read-only local source server, imports the production modules, and requires the explicit staged art package plus the repository's normal actor/background art. It checks rendered pixels and missing-art fallback, then mounts the real combat screen and clicks authored cards through engine dispatch. Synthetic gallery receipts are kept separate from those real combat cases. No generated game build or saved campaign is overwritten.

Ignored local evidence is under `scratch/recipient-effects/runtime-browser/` for the tracked browser test, and `scratch/recipient-effects/integration-qa/evidence/` for the focused review: `report.json`, `real-combat-report.json`, `tool-checks.json`, `wis-sp-mp-buffs.png`, `heal-bleed-motion.png`, `royal-blue-circle.png`, and real-combat screenshots. The review checks actual actor silhouettes, exact card aura bounds, secondary onset on the last primary frame, rising healing/falling blood, and one group Sweep. These are local implementation/review results, not claims that the new art has shipped in the pinned release.

When the local review helpers are present, reconstruct its labelled PNGs from the saved production-renderer captures with `python scratch/recipient-effects/integration-qa/compose-final.py`. This performs only screenshot cropping/layout and labels; it neither generates nor modifies source sprite art. To refresh those inputs first, serve the checkout on port 4327 and run `node scratch/recipient-effects/integration-qa/run.mjs`. Original screenshots, captured recipe/settings records, source PNGs and provenance remain preserved separately.

The focused caster preview check verifies all four invoker/recipient pairings and that the actual painted circle bounds grow across its three frames while the host anchor stays fixed. Captures and the labelled sequential comparison are saved under `scratch/recipient-effects/caster-review/`.
