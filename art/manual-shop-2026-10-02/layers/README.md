# Modular book artwork

Open `atelier.html` through the repository preview server. The Book Atelier
uses the production renderer and has presets for all ten current manuals,
spellbooks, universal tomes and class books.

## Included assets

- Three transparent painted PNG masters: cracked classic leather, a smooth
  scholar's grimoire, and a stitched field journal (`masters/`).
- Three 320px WebP cover bases and matching mobile assets.
- Ten separate SVG symbols: Blade, Shield, Focus, Paired, Spell, Universal,
  Reaver, Starseer, Rogue and Herald. Each has solid, line and seal variants:
  **30 independently reusable symbol assets**.
- Three decorative overlays (corners, frame, arcane circle), plus the cover
  tint mask. Runtime layers live in `assets/shop/layers/`; editable SVG copies
  live in `vectors/`.
- Ten game recipes combining those layers. Colors are freely editable hex
  values; they do not require additional image generation.

Layer order is painted base → front leather tint → trim → symbol. Page edges,
spine and ribbon retain the neutral painted base. The three covers share a
square canvas and common registration; never trim one independently. Symbols
remain square standalone icons, positioned onto the front plane by the shared
renderer. They may also be reused outside books.

## Change a book later

1. Select its name in Book Atelier and choose cover, color, symbol, treatment
   and decoration. A browser draft is saved automatically.
2. Select **Export game recipes**. Keep `book-art-recipes.json` for later
   import; replace `src/content/bookArtPresets.js` with the exported module.
3. Run the normal tests and game rebuild. This changes artwork only. XP,
   lesson tags, prices and class rules remain in their existing content data.

The preview does not silently write the checkout. Invalid imports leave the
draft untouched. Reset restores only the selected book to its shipped recipe.

To add another cover/symbol, add its layer in both runtime tiers, extend
`src/content/bookArt.js`, add its recipe, and regenerate the art manifest.
`export.mjs` recreates all vector layers and encodes the retained PNG masters
(set `SHARP_MODULE` if using a shared Sharp installation). It does not repaint
the generated masters. `node tools/art-manifest.mjs --write` registers them.

## Provenance

Painted covers were created with OpenAI's built-in image-generation tool on
2026-10-02, using the approved neutral book as the source. No third-party art
was downloaded. Separate geometric SVG symbols, masks and trim were authored
as editable native vector assets by Codex, not generated raster emblems.
Prompts and source filenames are in `provenance.json`; usage is recorded in
the repository's CREDITS table. No outside license or attribution obligation
is asserted for these project-authored assets.

Browser receipts and screenshots live in `qa/`. `tools/book-art-browser.mjs`
checks customization, persistence, both downloads, invalid imports, mobile
layout and real shop rendering. `tests/book-art.test.mjs` verifies all recipes,
asset combinations, mobile twins and unsafe input refusal.
