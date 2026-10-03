# Customizable book artwork

Open [Book Atelier](preview/book-library/layers/atelier.html) through the
repository preview server. All ten books use the production renderer, with
three painted cover styles, freely chosen leather and ink colors, three trim
layers, and ten symbols in solid, line and seal treatments.

Layer order: painted book → front leather color → trim → symbol. Page edges,
spine and ribbon retain the neutral painted base. The covers share one square
canvas and registration. The symbols are standalone square SVGs and can also
be reused outside books.

## Change a book later

1. Select its name in Book Atelier and edit cover, color, symbol, treatment
   and trim. The tool saves a browser draft.
2. Choose **Export game recipes**. Keep the JSON for later import; replace
   `src/content/bookArtPresets.js` with the exported module.
3. Run tests and rebuild the game. These recipes change only art; XP, lesson
   tags, prices and class rules remain in their existing content data.

Imports are validated before replacing the draft. Reset restores only the
selected book. The tool does not silently write the checkout.

## Assets and provenance

The source package lives in [AshenSpire-art](https://github.com/cehinds/AshenSpire-art/tree/main/art/manual-shop-2026-10-02).
It contains three transparent cover PNG masters, thirty SVG symbol variants,
three trim SVGs, a color mask, thirty transparent book composition previews,
the original shop/button masters, exact prompts and an exporter. Painted
covers were made with OpenAI's built-in image generator; geometric symbols
and trim are original native SVGs authored by Codex. No third-party art was
downloaded.

Game asset IDs start with `assets/shop/layers/` and resolve through `assetUrl`
from the pinned, verified art packs. High and light runtime files are released
by the art repository. The game does not keep a duplicate runtime art tree.

To add an asset, update the art repository, generate its mobile twin and
manifest, and merge its art PR. Adopt the resulting release pin in the game,
then add its catalog key in `src/content/bookArt.js` and select it in a recipe.
Do not trim a cover independently or bake a symbol into a reusable cover.

The adopted art release includes the art repository's existing uniform light
sprite policy. High-resolution assets, animation sequences, timing and
display rules are unchanged by that alignment.

Browser evidence is in `docs/preview/book-library/`. Validation tools:
`tools/book-art-browser.mjs`, `tools/book-library-built-browser.mjs`,
`tools/book-learning-browser.mjs`, and `tests/book-art.test.mjs`.
