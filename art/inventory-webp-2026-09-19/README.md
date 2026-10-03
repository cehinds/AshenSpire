# AshenSpire inventory art — first batch

Six new standalone item illustrations generated with built-in `image_gen` on 2026-09-19. This pack is isolated from runtime assets and character animations; nothing existing was replaced.

Open `gallery.html` for labeled previews, light/dark/checker backgrounds, and individual downloads. `preview-gallery.jpg` is a portable contact sheet.

## Catalog coverage

| Group | Catalog ID | Name |
| --- | --- | --- |
| Swords | straightSword | Straight Sword |
| Shields | kiteShield | Kite Shield |
| Reaver armor | reaver/default | Wayfarer Plate |
| Starseer armor | starseer/default | Nightweave |
| Herald armor | herald/default | Rite Vestments |
| Rogue armor | rogue/default | Gutter Leathers |

Weapon IDs come from `content/source/weapons.csv`. Armor uses `classId/id` from `content/source/outfits.csv`, since `default` repeats across classes. Armor illustrations represent their outfit with its principal garment; these are inventory icons, not complete wearable character sprite sets.

## Files and provenance

- `sources/`: six untouched generated PNG originals, 1254 × 1254, true RGBA transparency.
- `webp/`: 18 optimized exports, three sizes per item: 1024, 512 and 256 square. Quality 88, method 6, lossless alpha. Full source canvas fits inside 84% of each export to provide safe padding; no background removal or repainting.
- `prompts.json`: exact individual generation prompts and stable asset IDs. Requested generation size was 1024 square; actual returned source size was 1254 square.
- `manifest.json`: actual dimensions, file sizes, source SHA-256 hashes, alpha bounds, and export verification results.
- `export.py`: reproducible conversion and gallery builder using Pillow.

Style was informed by the existing painted armament contact sheet at `art/painted-items-2026-09-07/all-armaments-contact.png`, plus catalog palette and descriptive fields. No source artwork was passed as an edit target. New generation uses worn metals, antique gold, muted olive, burgundy and indigo.

Validation: each PNG has transparent and opaque pixels; all exports reopen at their declared dimensions and preserve the resized alpha channel byte-for-byte. The labeled contact sheet is visually inspected for silhouette, palette and item identity. Existing gameplay and catalog data are unchanged.
