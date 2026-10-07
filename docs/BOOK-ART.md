# Customizable book artwork

Open [Book Atelier](preview/book-library/layers/atelier.html) through the
repository preview server. All ten books use the production renderer, with
three painted cover styles, freely chosen full-binding and metal colors, three tooling
layers, and eleven painted emblems in raised, aged and medallion treatments.

Layer order: painted book → full-binding leather color → painted emblem → tooling. Page edges and
brass fittings retain their natural colors; front, spine, back edge and ribbon recolor together. The covers share one square
canvas and registration. The symbols are independent transparent painted WebPs and can also
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
The painted-v2 folder retains three blank binding PNG masters and eleven painted
emblem masters (including feat), exact image-generation prompts and a reproducible
WebP exporter. All painted layers were made with OpenAI's built-in image generator
from the project's original approved Shield Manual. No third-party art was downloaded.

Game asset IDs start with `assets/shop/painted/` and resolve through `assetUrl`
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
