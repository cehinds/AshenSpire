# Twin-sword class and outfit animation suite

Open `index.html` for class and armor browsing, synchronized pose comparison,
playback, scrubbing, speed, background and foot-anchor controls. The sequence
editor changes pose order, repeats, timing and the impact step, then downloads
the candidate JSON. Replace `attack-sequence.json` with an accepted sequence
and rerun the exporter to update every appearance together.

The suite covers the current 35 armor catalog entries with 32 distinct class
and outfit paintings. Reaver, Starseer, Herald and Rogue each have their own
four shared-armor appearances. Catalog aliases are retained: Reaver Bastion
Harness uses Warden Mail, Starseer Rimeweave uses Starlit Silks, and Rogue
Waywatcher uses Nightveil. Shared armor does not use a different class's art.

Every atlas uses the same Reaver seed choreography and sixteen stable IDs:
Ready, ATK-01 through ATK-07, Defend, Hurt, Cast, aggressive and defensive
stances, Buff, Portrait and Conversation. Conversation has its own relaxed
full-body painting. Portrait is the only cropped figure. Body poses have two
visible swords and no baked aura, trails or particles. The Herald's physical
metal ornament and outfit jewelry remain part of the character.

The shared attack is Ready → ATK-01 → ATK-02 → ATK-03 → ATK-04 → ATK-05 →
ATK-06 → ATK-07 → Ready, at 120 ms per step and impact index 4. These are
painted key poses, not a skeletal rig or interpolated motion. Variants are
generated as complete atlas edits with the same pose geometry, facing and
weapon directions; class and clothing are the requested changes.

## Equipment coverage

Runtime selection uses the existing `sword` group in each hand with `dual`
grip and one `twinSword` motion profile shared by all outfits. The authored
assignment is **right Straight Sword / left Katana**. The profile's
`supportedHandItems` prevents it from drawing that art for the reverse order.
**Right Katana / left Straight Sword retains the existing game fallback**;
no separately painted hand swap is claimed, and no mirroring is applied.

Equipment rules were inspected in `content/source/weapons.csv`,
`content/source/tagging.csv`, `content/source/weaponCardPackages.json`,
`content/source/equipmentRequirements.csv`, and `src/model/loadout.js`.
Both swords accept either hand and share `item:blade`, producing dual grip.
The Straight Sword still requires Strength 10. Duplicate copies of the same
item ID are rejected/moved by the loadout rules, so two Straight Swords are
not a supported invented pairing. Item requirements, card packages, damage,
balance and legality are unchanged.

## Sources and reproducibility

Built-in OpenAI `image_gen` authored the paintings from project-owned
references. No third-party artwork was downloaded or license asserted.
`prompts.json` records the seed; `provenance/*.json` records each full-atlas
edit, exact prompt and source. Native transparent PNG masters are preserved
under `sources/` (the tool returned 1254px atlases despite the requested
2048px size). `sources/normalized/` retains transparent normalized PNGs.
Runtime exports are 512×512 WebPs. Labels exist only in HTML and sheets.

The task's built-in generation cache was moved from its exact task folder on
C: to `D:/repos/AshenSpire-twin-sword-generated-cache`, with a junction at the
original path, after C: became full. No other task's cache was moved. All
nonempty recovered sources were decoded and matched against saved copies.

Run with Python, Pillow and NumPy from the repository root:

```text
python art/twin-sword-reference-2026-09-19/export.py
python art/twin-sword-reference-2026-09-19/bind.py
node tools/config-build.mjs
node tests/twin-sword-animation.test.mjs
```

The component extractor is adapted from the existing sword/shield pipeline,
with vectorized component bounds for the many small painted edge fragments.
It preserves weapons crossing nominal grid boundaries and never discards or
duplicates opaque pixels. All body poses share one normalized source scale
across the entire suite and the same output foot anchor (256, 480), within
rounding tolerance. Portraits use a separate reference scale. PNG/WebP alpha
is verified byte-for-byte, and clipping rejects the export.

`manifest.json` records source and frame hashes, bounds, extraction ownership,
anchors, scale and coverage. `bind.py` refuses partial appearance coverage or
changed source/frame hashes. It writes `runtime-additions.json` and adds only
the twinSword profile, sets and bindings to the current shared config. It
does not regenerate or replace performance settings or other motion profiles.
The existing equipment-animation renderer routes these assets through
`src/ui/assets.js` and the painted stage.
