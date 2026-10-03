# AshenSpire relic art — pack 02

New artwork for four existing catalog relics: Golden Sprout (`goldenSprout`), Cracked Lantern (`crackedLantern`), Bloodstained Chalice (`bloodstainedChalice`), Crown of Stitches (`crownOfStitches`).

Open [the gallery](preview.html) for exact lore, acquisition rules, boss ownership, and inventory-size previews. [Pack 01](../relic-icons-pack-01/preview.html) contains the first four starter relics.

## Sources and exports

Generated individually with built-in image_gen on 2026-09-19. Exact prompts are in `prompts/<ID>.txt`; untouched generated RGBA PNGs are in `sources/<ID>.png`. No external reference images or downloaded artwork were used. These are AI-generated artwork; no CC license is asserted.

Transparent WebPs in `webp/` are available at 512, 256, 128 and 64 pixels. Original dimensions, file sizes, SHA-256 hashes, lore and acquisition evidence are recorded in `manifest.json`. The gallery separates original catalog lore from visual interpretations.

Exports preserve the source alpha, fit the visible bounds within 82% of the canvas, and use Lanczos resampling and WebP quality 88/method 6. Every decoded export is checked for dimensions and byte-identical resized alpha. Run `export.py` with Pillow to reproduce the outputs.

## Acquisition accuracy

Standard relic rolls choose uniformly among eligible, unowned common/uncommon/rare relics. Chances depend on the remaining pool, so the gallery gives 1/N rather than a misleading fixed rate. Boss rolls similarly choose among unowned boss relics; Crown of Stitches is in the shared six-relic boss pool, not assigned to a particular boss. Its initial chance is 1/6 (16.67%) per boss relic roll. Golden Sprout can also be chosen at character creation.

Evidence: `src/content/relics.js`, `src/engine/encounters.js` (rollRelicReward), `src/main.js` (boss and elite reward calls), and `src/content/generated/characterCreation.js`.

This is an isolated review art pack. Runtime content, existing artwork and prior pack files remain unchanged. Request revisions using the exact catalog ID.
