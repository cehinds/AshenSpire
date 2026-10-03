# Legacy dungeon source artwork

These are the original lossless WebP files formerly shipped directly under `assets/environments/legacy/`. They remain outside the runtime asset sweep so they do not inflate the standalone download. Runtime filenames and dimensions are unchanged.

With the owner's approval, the 27 runtime copies were encoded with Sharp 0.35.4 as WebP using quality 72, alphaQuality 100, and effort 6. Total runtime bytes fell from 32,372,720 to 4,784,668 (85.2% smaller). Every output was decoded and checked for unchanged dimensions and alpha presence; alpha-channel bytes were compared exactly where present. RGB compression is lossy.

`compression.json` records each original SHA-256, original/output byte count, and dimensions. To regenerate a runtime copy, read the corresponding original here and apply `sharp(input).webp({ quality: 72, alphaQuality: 100, effort: 6 })`, writing to the same filename in `assets/environments/legacy/`.

Artwork provenance remains documented in `CREDITS.md`. This packaging change does not change dungeon routes, encounters, rewards, or saves.
