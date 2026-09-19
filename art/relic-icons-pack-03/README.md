# AshenSpire relic artwork — pack 03

Four existing relics painted with built-in image_gen on 2026-09-19:

| Exact ID | Name | Rarity | Source |
| --- | --- | --- | --- |
| ivoryComb | Ivory Comb | Common | Standard relic reward pool |
| blessedDew | Blessed Dew | Uncommon | Standard relic reward pool |
| gravetendersBell | Gravetender's Bell | Uncommon, quest | Keeper of the Nameless: eligible Accept Thanks choice |
| wyrmHeart | Wyrm Heart | Rare | Standard relic reward pool |

Open [preview.html](preview.html) for lore, acquisition details, downloadable art, and 48/64/128px previews with a dark/light backdrop toggle. [preview.png](preview.png) is the labeled art contact sheet.

## In-game card and lore comparison

[cards.html](cards.html) shows all 63 catalog relics using the actual game renderer at Compact (108px), Glance (152px), Focus (280px), and Inspect (320px), read from current game configuration. Serve the repository for this module-based preview (for example `node tools/serve.mjs --no-open`), then open `/art/relic-icons-pack-03/cards.html`. [Lore notes](lore.md) distinguish established facts from thematic associations, with links to existing sources. Per-relic `*-cards.png` files provide standalone previews.

The card gallery now covers the complete catalog: 63 relics, 252 cards, including all twelve paintings from packs 01–03. Search matches name, ID, lore context and associated class; filters separate painted relics from the 51 awaiting artwork. Missing authored flavor is explicitly identified, while the actual game card retains its fallback text. Additional contextual notes cover the earlier eight paintings without inventing named owners or boss assignments.

Verified in headless Edge: catalog/card counts match, all twelve paintings decode, search and both artwork filters work, and widths remain 108/152/280/320 px. The earlier per-relic verification also confirmed that only Inspect shows the lore row. The page fits a 390px viewport with horizontally scrollable comparison rows. No page errors. These are authored default sizes before user scaling.

## Provenance

Exact generation prompts are in `prompts/<ID>.txt`. The comb needed an additional built-in transparency edit, recorded in `prompts/ivoryComb-alpha-edit.txt`; its first output is retained as `sources/ivoryComb-before-alpha.png`. Selected originals are `sources/<ID>.png`. Prompt augmentation describes visual interpretations, not new canonical lore.

These are project-owned AI-generated images, with no downloaded or external reference artwork. No third-party or CC license is asserted. The bell's cold iron material comes from the event result text. Catalog flavor is copied verbatim, and source paths for acquisition rules are recorded in the selection data and manifest.

## Export verification

Each relic has 512, 256, 128 and 64px transparent WebP exports. Source dimensions and hashes, export dimensions/bytes/hashes, lore and acquisition metadata are in `manifest.json`.

`export.py` uses Pillow: alpha-bound crop, fit within 82% of the square canvas, Lanczos resampling, WebP quality 88/method 6. All decoded exports are checked for dimensions and exact resized alpha preservation. Original source pixels remain intact.

Standard reward odds are 1/N for the eligible unowned pool. The bell is excluded from generic rolls and awarded by a specific quest choice; none of these is a boss-rarity reward.

The four 256px exports are integrated through the shared relic artwork lookup in `assets/relics/`, alongside the eight relics integrated by PR #1202. Existing lore, effects and acquisition rules are unchanged. Earlier galleries: [pack 01](../relic-icons-pack-01/preview.html), [pack 02](../relic-icons-pack-02/preview.html).
