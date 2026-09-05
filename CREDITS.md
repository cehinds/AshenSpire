# Credits & Asset Licenses

Every third-party asset shipped in this repository is listed here with its source and license. **A PR that adds an asset without a row in this file does not merge.**

Allowed licenses: CC0, CC BY 3.0/4.0 (with attribution), SIL OFL (fonts).

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

| Code | Used for | Source | License |
|---|---|---|---|
| mulberry32 PRNG | seeded RNG (`src/engine/rng.js`) | widely published public-domain snippet by Tommy Ettinger | Public domain / CC0 |

## Non-affiliation

AshenSpire is an original fan-inspired work. It contains no assets, music, text, or proper nouns from Elden Ring, and is not affiliated with, endorsed by, or sponsored by FromSoftware Inc. or Bandai Namco Entertainment. Elden Ring is a trademark of its respective owners.
