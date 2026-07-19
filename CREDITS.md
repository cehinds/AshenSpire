# Credits & Asset Licenses

Every third-party asset shipped in this repository is listed here with its source and license. **A PR that adds an asset without a row in this file does not merge.**

Allowed licenses: CC0, CC BY 3.0/4.0 (with attribution), SIL OFL (fonts).

## Planned sources

- [game-icons.net](https://game-icons.net) — CC BY 3.0 — card art, relic/status/intent icons
- [Kenney.nl](https://kenney.nl) — CC0 — UI panels, buttons, borders
- [OpenGameArt.org](https://opengameart.org) — per-asset CC0/CC-BY — backgrounds, portraits
- [Google Fonts](https://fonts.google.com) — SIL OFL — Cinzel (display), Inter (body)

## Assets in use

**v1 ships zero bundled third-party asset files.** Every visual is generated at
runtime by `src/ui/assets.js` — the style guide's placeholder recipe (a tinted,
rounded panel + a Unicode glyph + the entity's name). This is a deliberate design
choice (SPEC §2.4): the game is fully playable and visually coherent with no
downloads, and real art can be swapped in later by mapping an id to a URL with a
row in the table below — no game-code changes.

| Asset | Used for | Source | Author | License |
|---|---|---|---|---|
| Generated placeholder sprites | enemy / player / card / relic art (`src/ui/assets.js`) | original to this project | EldenSpire | CC0 |
| Rendered class sprites (`assets/sprites/*.png`) | player figures, one PNG per class × accent tint; inline-SVG fallback when unavailable | procedurally modeled + rendered by this repo's own Blender pipeline (`tools/sprites-blender.py`, headless; regenerate with `blender --background --factory-startup --python tools/sprites-blender.py -- assets/sprites`) | EldenSpire | CC0 |
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

EldenSpire is an original fan-inspired work. It contains no assets, music, text, or proper nouns from Elden Ring, and is not affiliated with, endorsed by, or sponsored by FromSoftware Inc. or Bandai Namco Entertainment. Elden Ring is a trademark of its respective owners.
