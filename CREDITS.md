# Credits & Asset Licenses

Every third-party asset shipped in this repository is listed here with its source and license. **A PR that adds an asset without a row in this file does not merge.**

Allowed licenses: CC0, CC BY 3.0/4.0 (with attribution), SIL OFL (fonts).

## Painted enemy sprites from the Unity fork

`assets/enemies-unity/painted_*.png` contains twelve unchanged project-owned,
AI-generated enemy frames from [AshenSpire-Unity](https://github.com/cehinds/AshenSpire-Unity/tree/130d7c5/Unity/Assets/AshenSpire/Resources/Art).
The Unity fork generated the artwork with the built-in image-generation tool.
Its extraction manifest is retained as `assets/enemies-unity/provenance.json`.
Frames share a 384 × 384 canvas, a (192, 364) foot anchor and left-facing art.
These are static frames; existing combat effects provide their movement.

## Painted player outfits

Combat technique artwork in `art/painted-combat-2026-09-07/animation-groups/`
was generated with built-in OpenAI imagegen from the existing project-owned
painted references for all sixteen outfits. The 144 shield-guard, parry and
shield-bash frame slots (143 distinct images) ship in `assets/painted-outfits/`.
Source sheets, exact prompts, preserved approved frames and the Starseer
recovery reuse are documented in that folder. These are project-owned
AI-generated assets; no third-party asset license is claimed.

| Assets | Source | Rights |
|---|---|---|
| assets/painted-outfits: 16 outfits, 256 combat frame slots, 32 menu/detail images and 16 portraits | Project-owned artwork generated with OpenAI image generation and reviewed in PRs #728 and #735; originals and generation records in art/painted-combat-2026-09-07 | Project-owned AI-generated assets; no third-party asset license claimed |

Runtime WebP exports are reproducible with tools/painted-outfits-ship.mjs (requires the sharp package). Outfit colors are retained without tint recoloring. Combat uses compact keyframe sequences, with weapons authored into the images.

## Planned sources

- [game-icons.net](https://game-icons.net) — CC BY 3.0 — card art, relic/status/intent icons
- [Kenney.nl](https://kenney.nl) — CC0 — UI panels, buttons, borders
- [OpenGameArt.org](https://opengameart.org) — per-asset CC0/CC-BY — backgrounds, portraits
- [Google Fonts](https://fonts.google.com) — SIL OFL — Cinzel (display), Inter (body)

## Assets in use

**v1 ships zero *third-party* asset files.** The `.webp` files under `assets/` are this project's own, rendered by the Blender pipelines listed below — first-party, CC0, and each with a row here.

> **One exception, disclosed rather than absorbed.** The class sprites
> (`assets/sprites/{reaver,starseer,rogue,herald}_*.webp`) are not Blender
> renders. They are cut out from the class concept art at
> `docs/art-evidence/2026-09-03/concepts/*-concept-v1.png`, which is
> **AI-generated — produced with ChatGPT Codex for this project** (owner
> statement, 2026-09-03). They are first-party in the sense that they were
> commissioned for and by this project and no third party's asset file is
> redistributed; they are **not** hand-authored, and this file does not claim
> they are. `RUNBOOKS/art.md` §11 requires AI-assisted material to retain its
> available provenance, so it is stated here rather than left to inference.
>
> This closes the gap `assets/classes/SUCCESSOR-CONTRACT.md` §5.1 carried as a
> blocker from 2026-08-28: the creator was unrecorded, not unknowable. Every visual is generated at
runtime by `src/ui/assets.js` — the style guide's placeholder recipe (a tinted,
rounded panel + a Unicode glyph + the entity's name). This is a deliberate design
choice (SPEC §2.4): the game is fully playable and visually coherent with no
downloads, and real art can be swapped in later by mapping an id to a URL with a
row in the table below — no game-code changes.

| Asset | Used for | Source | Author | License |
|---|---|---|---|---|
| Generated placeholder sprites | enemy / player / card / relic art (`src/ui/assets.js`) | original to this project | AshenSpire | CC0 |
| Class sprites (`assets/sprites/{reaver,starseer,rogue,herald}_*.webp`) | player figures, one WebP per class × accent tint; inline-SVG fallback when unavailable | **AI-generated with ChatGPT Codex** for this project, then cut out from the concept art at `docs/art-evidence/2026-09-03/concepts/*-concept-v1.png` — background removed, framed to 450×570, one accent rim per tint (regenerate with `node tools/concept-cutout.mjs`). The Blender builders in `tools/sprites-blender.py` still exist and still work, but no longer produce the shipped class art. | AshenSpire (AI-generated, ChatGPT Codex) | CC0 |
| Pose sprites (`assets/poses/*.webp`, and the full set in `art/poses/*.webp`) | the animated combat figure — one WebP per class/outfit × pose × accent tint, played by `src/ui/services/PoseAnimator.js` | **AI-generated painted pose sheets**: the four default 3×3 class sheets supplied by the owner are kept at `docs/art-evidence/2026-09-04/pose-sheets/*.png`; the twelve alternative-outfit sheets generated with ChatGPT Codex under the owner's direction are kept at `docs/art-evidence/2026-09-05/outfit-pose-sheets/*.png`, with approved outfit boards beside them in `outfit-previews/`. Cut into single-pose frames, dyed per tint and encoded by this repo's own tools (`tools/painted-poses.mjs` → `tools/pose-sprites.mjs` → `tools/pose-ship.mjs`); the exact commands are in `art/poses/README.md` and reproduce the committed files. They replaced the Blender figures from `tools/lowpoly-blender.py`, which still exists and still works. | AshenSpire (AI-generated, ChatGPT Codex) | CC0 |
| Painted Reaver attack (`assets/animations/reaver/default-greatsword/right/*.webp`) | 60-step right-facing attack for Wayfarer Plate + right-hand Greatsword; 16 byte-distinct frames with runtime repeats | **AI-generated with ChatGPT Codex** under the owner's direction, refined in the approved `reaver-attack-v1` sequence, deduplicated without altering pixels | AshenSpire (AI-generated, ChatGPT Codex) | CC0 |
| Enemy sprites (`assets/sprites/enemy_*.webp`) | enemy figures | procedurally modeled + rendered by this repo's own Blender pipeline (`tools/sprites-blender.py`, headless; regenerate with `blender --background --factory-startup --python tools/sprites-blender.py -- assets/sprites`) | AshenSpire | CC0 |
| Act backdrops (`assets/bg/bg_act{1,2,3}.webp`) | act-map and combat backgrounds | procedurally modeled + rendered by this repo's own Blender pipeline (`tools/backdrops-blender.py`, headless; regenerate with `blender --background --factory-startup --python tools/backdrops-blender.py -- assets/bg`) | AshenSpire | CC0 |
| Equipment + armour-set art (`assets/equipment/*.webp`) | weapon layers and per-class/per-set bodies, composited at runtime | procedurally modeled + rendered by this repo's own Blender pipeline (`tools/equipment-blender.py`, headless, reading the same `content/source/weapons.csv` + `outfits.csv` the game reads; regenerate with `blender --background --factory-startup --python tools/equipment-blender.py -- assets/equipment`) | AshenSpire | CC0 |
| Equipment component reference strips (`assets/equipment/components/v1/**/*.webp`) | five-view modeling and inventory-art references for 39 class equipment components | generated for this project from project-owner-supplied character paintings; indexed by `assets/equipment/components/v1/manifest.json` | AshenSpire | CC0 |
| Painted equipment turnaround sheets (`docs/low-poly-fighters/*.png`) | the eight reference sheets on the *Low-Poly Fighters — Painted Poses* page (`docs/low-poly-fighters/index.html`) — every equipment piece per class in five orthographic views (top, right, bottom, left, back), two sheets per class: the garments and the kit (hands, feet, weapon) | **AI-generated** painted sheets supplied by the owner (owner statement, 2026-09-05), delivered as `{knight,monk,rogue,wizard}-{wearables,equipment}-turnaround.png` and renamed on commit to the names the page reads. Reference only — nothing loads them at runtime; the shipped per-piece equipment art is the `assets/equipment/*.webp` row above. The painted **pose** sheets that page also shows are covered by the *Pose sprites* row. | AshenSpire (AI-generated) | CC0 |
| Unicode emoji glyphs (⚔ 🩸 💎 ☄ …) | card/relic/status/enemy icons, sigils | Unicode standard; rendered by the player's OS/browser emoji font | Unicode / OS vendor | Not embedded — system-rendered |
| Cinzel (display), Inter (body) | typography | referenced by `font-family` with robust system fallbacks (Georgia / system-ui); **not bundled** in v1 | Google Fonts | SIL OFL (when self-hosted) |

> When real art lands: download from a **Planned source** above, place it under
> `assets/`, reference it from `src/ui/assets.js`, and add a row here (source URL,
> author, license). Self-host the Cinzel/Inter `woff2` under `assets/fonts/` with
> an `@font-face` block and a row here — the fallbacks keep the game readable
> until then.

## Code

Enemy combat states (2026-09-08): 231 additional pose sprites in `assets/enemy-states/` were generated with built-in image_gen from the project's approved enemy idle sprites. Source sheets and generation records are retained in `art/enemy-states/`. Buff auras are runtime silhouette effects.

Enemy pose additions (2026-09-07): seven painted replacement idle sprites and 33 attack sprites in `assets/enemy-poses/` were generated with built-in image_gen using this project's existing enemy artwork as identity references. The remaining 26 idle frames are unchanged copies of their existing credited sources. Source sheets, prompts and processing records are retained in `art/enemy-poses/`.

The fourteen expansion portraits in `assets/enemies-expansion/` were generated for AshenSpire with ChatGPT Codex in September 2026, following the project's Unity-fork painted style. They are project-generated artwork, offered under CC0 like the existing generated game assets. Each transparent idle frame is normalized to 384 × 384 with foot anchor (192, 364); combat movement is supplied by the runtime. The twelve imported Unity portraits remain byte-identical to their credited source.

| Code | Used for | Source | License |
|---|---|---|---|
| mulberry32 PRNG | seeded RNG (`src/engine/rng.js`) | widely published public-domain snippet by Tommy Ettinger | Public domain / CC0 |

## Non-affiliation

AshenSpire is an original fan-inspired work. It contains no assets, music, text, or proper nouns from Elden Ring, and is not affiliated with, endorsed by, or sponsored by FromSoftware Inc. or Bandai Namco Entertainment. Elden Ring is a trademark of its respective owners.

## Painted combat effect sprites

The September 9 card-effect refresh adds 24 lossless transparent frames in `assets/combat-effects` for slash, shield bash, Starstone bolt and blood slash. Source: OpenAI built-in imagegen, with complete prompts and green-matte source plates in [art/card-effect-refresh-2026-09-09/sources.json](art/card-effect-refresh-2026-09-09/sources.json). Project-owned AI-generated artwork, CC0. Reproducible crop, matte extraction and export: `tools/card-effect-art-build.mjs`. The previous frames remain under `art/card-effect-refresh-2026-09-09/before` for visual comparison.

| Assets | Source | Rights |
|---|---|---|
| assets/combat-effects: 336 transparent frames (56 six-frame effects) for projectiles, guards, barriers, stances, auras, afflictions, healing, impact, melee trails and authored card schools | Project-generated with built-in OpenAI imagegen; six-frame source sheets and exact prompts in art/combat-effects-2026-09-07/six-frame-generation.json, guard-status-generation.json and integration-generation.json; exported by tools/combat-effects-ship.mjs | Project-owned AI-generated artwork, CC0 |
| assets/pose-effects: 144 transparent frames (24 six-frame sets) for subtle movement, contact, casting, barriers, status ticks and utility | Original vector recipes authored for this project in [pose-studio/new-effects.mjs](pose-studio/new-effects.mjs); rasterized to lossless WebP | Project-owned procedural artwork, CC0 |

# Combat readiness poses (2026-09-08)

Twelve original outfit pose illustrations generated with OpenAI imagegen for
AshenSpire, using the project's existing painted outfit art as references.
First-party source sheets: `art/readiness-poses/sources/`; transparent shipped
frames: `assets/readiness-poses/`. No external game artwork. Original procedural
diamond, constellation, and halo glows are authored in `paintedOutfits.js`.
Source: this repository; dedicated CC0-1.0 by the project for these new assets.

## Combat field backgrounds (2026-09-08)

Twenty original location paintings in five source sheets under
`art/environments/combat-fields/`, generated with built-in OpenAI imagegen using
the project's own regional concept boards. Runtime WebP atlases are encoded by
`tools/environment-art-build.mjs`. Prompt briefs and panel order are documented
beside the source sheets. Project-owned AI-generated artwork, CC0-1.0.

## Readiness transition sprites (2026-09-08)

Twelve additional project-owned CC0-1.0 pose illustrations created with the
built-in OpenAI imagegen tool from the readiness outfit references. First-party
sources: `art/readiness-poses/sources/*-transition.png`; exact prompts:
`art/readiness-poses/transition-generation.json`. Exported to transparent WebP
through `tools/readiness-poses-ship.mjs`.

## Map detail and engraving (2026-09-09)

Original square-world detail remaster: `art/environments/worlds/fractured-realm-square-detail.png`, generated with OpenAI imagegen from the project-owned original. Project-owned AI artwork, CC0-1.0. Geography retained, fine shapes redrawn; native output remains 1254px, not a 4K master. Original procedural parchment engraving: `src/ui/components/mapFog.js`, CC0-1.0. Source: this repository. Pyramid exports are derived by `tools/map-detail-build.mjs`.

## Title city and tower (2026-09-10)

`assets/bg/title-city-tower.webp` is original project-owned artwork generated
with OpenAI imagegen using the existing `bg_act1.webp` as a palette and mood
reference. It depicts a central stone spire above a medieval city in muted
umber and olive-gold haze. Exported at its native 1586 × 992 resolution as WebP,
quality 90. Used by the startup gate and title menu. No third-party asset
license is claimed.

Three review-only alternatives generated from the approved title artwork are
retained in `art/title-background-variations/`: River Citadel, Forgotten
Observatory, and Ashen Bastion. They use the same native resolution and WebP
export settings and are excluded from the runtime asset bundle.

## Tower entrance preview (2026-09-10)

The River Citadel unlit/lit pair and landscape/portrait entrance hall in
`assets/bg/` are project-owned artwork generated with OpenAI imagegen from
the River Citadel concept and its derived hall. Exported to WebP at quality
90. Prompt specifications and preview scope are in
`art/tower-entry-preview/README.md`. No third-party asset license is claimed.

`assets/bg/tower-city-background.webp` is a generated outdoor-only background
plate derived from the hall reference. The foreground retains the existing
hall paintings with project-authored SVG display masks. City brightness is
controlled independently from the doorway and sconces.

`assets/bg/tower-city-background-unlit.webp` is a generated lighting edit of
that city plate with artificial lights and their reflections removed, exported
to WebP at quality 90 for the menu's separate background layer.
