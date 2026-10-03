# Skill-book shop asset kit

The subsequent mechanics extension is documented in [BOOK-LIBRARY.md](BOOK-LIBRARY.md):
immediate lessons, cross-class spells, universal books and reusable class cards.
The asset exports below remain the same four reusable art files.

Owner request: “make these options uniform in size, and acutually have a book on it
[ [book sprite] [details] [buy]] show me a preview”. After the preview:
“ok, break these down into assets and make this”.

## Files and mapping

| Master | Runtime asset | Use |
| --- | --- | --- |
| `masters/shield-manual.png` | `assets/shop/books/shield-manual.webp` | Shield Manual |
| `masters/blade-manual.png` | `assets/shop/books/blade-manual.webp` | Blade Manual |
| `masters/skill-book.png` | `assets/shop/books/skill-book.webp` | Neutral book for Focus Treatise, Paired Steps Primer and future books |
| `masters/brass-button.png` | `assets/shop/brass-button.webp` | Blank button frame; native text and interaction |

`approved-preview.png` is the approved concept. `preview.html` mounts the
production shop with a disposable two-book visit and no saved-game writes.
Append `?all=1`, `?cinders=100`, or `?xp=73` for all books, unaffordable offers,
or a configured Shield XP award. Serve the repository with `tools/serve.mjs`.
`qa/` contains browser captures and the test receipt.

Generated with the built-in `image_gen` tool on October 2, 2026. The shield,
blade and button use the approved preview as their sole reference. The neutral
book uses the extracted shield master as its reference. These are regenerated
asset cutouts, not pixel-identical crops. No third-party license is claimed.

`export.mjs` trims transparent padding and encodes 320×320 books plus a
320×112 button. It retains the PNG masters and emits `exports.json`. Run with
Node and `sharp` installed, or set `SHARP_MODULE` to a shared installation.
Mobile twins were produced by the canonical `tools/mobile-art.mjs` encoder in
an isolated staging tree containing these four files, then copied to their
matching runtime paths. Regenerate `art-manifest.json` after asset changes.

The component uses a native Buy button and the existing review/hold purchase
path. XP, prices, availability, inventory and stock remain model-owned. Every
row on the book shelf shares the tallest row's height. The shelf expands into
the previous detail pane; books no longer repeat the same details or Buy in a
second panel. No engine or balance rules change.

## Generation prompts

### Shield master

Extract only the ochre brown Shield Manual book from the TOP LEFT of the reference UI into one isolated game sprite. Faithfully preserve the same painted book design: three-quarter front view, embossed quartered shield on ochre leather cover, gold brass corner fittings, thick parchment pages, brown ribbon bookmark, spine on the left. Remove all UI, text, background and lines. Entire single book in frame with only 5 percent transparent padding. Transparent background, clean alpha, no floor shadow beyond the object, no text. Square canvas. This is a reusable sprite for the approved AshenSpire shop.

### Blade master

Extract only the deep green Blade Manual book from the BOTTOM LEFT of the reference UI into one isolated game sprite. Faithfully preserve the same painted book design: three-quarter front view, embossed straight sword and subtle filigree on deep green leather cover, gold brass corner fittings, thick parchment pages, green ribbon bookmark, spine on the left. Remove all UI, text, background and lines. Entire single book in frame with only 5 percent transparent padding. Transparent background, clean alpha, no floor shadow beyond the object, no text. Square canvas. Match the reference shield book's size and angle. This is a reusable sprite for the approved AshenSpire shop.

### Button master

Extract one of the brass Buy button frames from the RIGHT of the reference UI into a reusable game button texture. Remove the word Buy entirely: center must be EMPTY plain aged brass texture so live HTML can display any label. Preserve embossed double brass edge, subtle rounded corners, tiny corner rivets and dark gold inset face. Front-on flat UI rectangle, 2.4:1 aspect ratio, edges horizontal/vertical, no perspective. Single button only, tight transparent padding, transparent background, no book, no text, no price, no other UI.

### Neutral book master

Create a matching generic skill-book sprite from this exact book. Change ONLY the cover: remove the shield crest entirely, replace it with subtle neutral gold filigree, dark reddish brown leather. Preserve the shape, angle, spine, brass corner fittings, parchment pages, bookmark and size. Single closed book, no writing, no weapon symbols, no shield, no specific magical emblem. It will be the neutral artwork for other skill books in this same game shop. Transparent background. Clean alpha cutout, no red fringe. Square canvas.
# Modular edition

The current game uses the [layered book kit and Book Atelier](layers/README.md).
Its three covers, thirty symbols and per-book recipes replace the baked book
WebPs. The original approved art and validation below remain as provenance.
`export.mjs` below is the historical baked-asset exporter; use
`layers/export.mjs` for the current runtime assets.
