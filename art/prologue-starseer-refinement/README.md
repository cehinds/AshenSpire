# Starseer memory: concealed Astrologer

Final art-only refinement for prologue scene 4. Prepared in `D:/repos/AshenSpire-astrologer-art-refinement` on branch `codex/astrologer-art-refinement`, based on `8e0c79df00104279bcb9d1776c387f7082afbadf`. Approved by the user for integration into the `Plan post-class intro sequence` workflow branch, `codex/prologue-burning-timing`. The refinement commit contains only assets and their provenance; no runtime/config changes.

## Integration assets

Copy only these two files into the corresponding paths of the integration checkout when ready:

| Runtime path | Dimensions | Bytes |
| --- | --- | --- |
| `assets/prologue/carry-starseer-desktop.webp` | 1586 x 992 | 239842 |
| `assets/prologue/carry-starseer-mobile.webp` | 941 x 1672 | 225928 |

The runtime names match the requested existing slots. Scene 1 and scene 2 Burning are outside this change.

## Masters and provenance

- `masters/carry-starseer-desktop.png`
- `masters/carry-starseer-mobile.png`
- `generation-prompts.json`: verbatim prompts, original input paths, generated output paths and desktop wardrobe reference used for mobile.
- `asset-manifest.json`: dimensions, sizes, WebP settings and SHA-256 checksums.
- `inspection/`: previews decoded from the compressed WebPs and native-resolution detail crops.
- `export.cjs`: reproducible format conversion using the bundled Sharp library; no repainting or compositing.

Both edits were made with the built-in image tool through the imagegen skill. PNG masters are unchanged copies of its selected outputs. WebPs use quality 88 and effort 6, without resizing, about 90% smaller than the masters.

## Lore and visual review

Read `docs/LORE.md` and `docs/LORE-CAST.md`; the user calls the figure the Astrologer, while these documents call the Starseer's teacher the Astronomer. Preserved the single confession page, slanted lectern, empty unlit hearth, charts, staff and writing pose without revealing the confession or its lore mechanism.

Visually inspected both generated masters, both WebP-derived composition previews (desktop 960 px wide; mobile 390 px wide), and native-resolution WebP detail crops. Both show a matching weathered wizard hat over a hood, with the entire face concealed: no visible eyes, nose, mouth, beard or facial skin. Hands and quill remain clear. The single sheet carries only indistinct marks with no readable confession. The hearth is cold and unlit. Charts, astronomical instruments and staff remain present. Original landscape and portrait dimensions are preserved, with no captions, logos or watermark. No obvious compression artifacts impair the inspected details.

Desktop and mobile art were approved together. Preserve these concealed-face versions when integrating the prologue assets.
