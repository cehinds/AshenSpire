# AshenSpire relic icons — pack 01

Four original starter relics from `src/content/relics.js`, generated with the built-in image_gen tool on 2026-09-19. Review-only art pack; existing assets and runtime references are untouched.

Open **preview.html** for the labeled gallery, dark/light backdrop toggle, and actual-size 48/64/128 px comparisons. **preview.png** is the shareable contact sheet.

The HTML gallery also includes each relic's exact catalog lore, associated class, starting acquisition, normal and boss reward drop rates, and boss ownership. These four are default class starters (Reaver, Starseer, Rogue, Herald respectively), guaranteed when selected at creation; Golden Sprout is an available alternative. Their normal and boss reward drop rates are 0%, and none has a boss owner. Acquisition evidence is recorded per relic in the selection data and manifest, from class definitions, character creation rules, initial state, and `rollRelicReward`. The static PNG remains the compact art contact sheet.

| Exact relic ID | Exact name | Visual interpretation |
| --- | --- | --- |
| forsakenMedallion | Forsaken Medallion | Smooth worn gold face, charcoal metal, burgundy ribbon |
| starstoneShard | Starstone Shard | Broken indigo crystal with restrained luminous seams |
| cutpursesCoin | Cutpurse's Coin | Worn coin with a closed-eye relief suggesting silence |
| goldFigurine | Gold Figurine | Heavy small protective gold idol |

The coin motif and figurine shape are art interpretations, not additional canonical lore. Original lore and mechanics were read from the relic catalog before prompting.

## Files and provenance

- `sources/<exactID>.png`: untouched 1254 × 1254 RGBA generated originals.
- `webp/<exactID>-<size>.webp`: 512, 256, 128, and 64 px square exports.
- `prompts/<exactID>.txt`: exact complete generation prompts.
- `catalog-selection.json`: selected names, IDs, subject briefs, and full prompts.
- `manifest.json`: dimensions, source alpha bounds, byte counts, SHA-256 checksums, and export verification.
- `export.py`: repeatable export and gallery production with Pillow.

Generation used individual built-in image_gen calls, one per relic, without external reference inputs. Existing project equipment art was inspected for context; the requested dark fantasy palette guided the new imagery. No downloaded or third-party artwork was incorporated. AI-generated artwork provenance is recorded here; no CC license is asserted.

## Export policy and verification

Original PNGs remain intact. Exports fit the alpha bounding box within 82% of a square canvas, producing consistent transparent padding. Lanczos resizing, WebP quality 88, method 6, exact transparent RGB preservation. Alpha is preserved and checked byte-for-byte against the resized input after decoding each WebP. All source images contain actual transparency.

Use 64 px for inventory icons, 128 px for larger inventory displays, 256 px for item panels, and 512 px for close inspection. The HTML also previews the 64 px export at 48 px. Source masters retain more texture for future revisions.

Revision order example: `relic-icons-pack-01 / starstoneShard / reduce inner glow`. Keep the ID stable and create a new version of the pack for revisions.
