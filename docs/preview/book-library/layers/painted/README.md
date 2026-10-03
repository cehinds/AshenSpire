# Painted book revision

Book Atelier and the game share three painted bindings and eleven separate
painted metal emblems from the pinned `hd-assets-v6` release. Open
`../atelier.html` through the game preview server, or `compare.html` for
whole-binding color examples and uniform shop-size samples.

## Layers and color

- Covers: classic brass corners, scholar filigree and clasp, stitched field journal.
- Emblems: blade, shield, focus, paired, spell, universal, reaver, starseer, rogue, herald, feat.
- The neutral leather follows the selected color on the front, spine,
  back-cover edge and ribbon. Luminance preserves grain, scuffs and shading.
  The SVG material mask protects warm brass fittings and cream parchment.
- Independent transparent emblems retain their painted relief under metal
  recoloring. Raised, aged and medallion treatments share the detailed source.
  Optional tooling is an additional vector layer.
- Recipes remain compatible with the game. `approved-recipes.json` records
  the owner's imported recipes, which match the original ten defaults.

## Sources and reproduction

All fourteen layers were created with OpenAI's built-in image generator,
referencing the original approved Shield Manual. PNG masters, exact prompts
and the reproducible WebP exporter are retained in
[AshenSpire-art's painted-v2 source package](https://github.com/cehinds/AshenSpire-art/tree/main/art/manual-shop-2026-10-02/painted-v2).
Runtime layers resolve through the game's verified art packs.

`node tools/painted-book-browser.mjs` checks binding color samples, protected
materials, all covers and symbols, draft persistence, export, rejected imports
and 390px/320px layouts. `node tools/book-art-export-preview.mjs` exports
thirty transparent compositions from the production renderer.
