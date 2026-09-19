# AshenSpire art desk — first production batch

Open `index.html` directly, or use the local preview at http://127.0.0.1:8791 while its server is running.

## Delivered

Four review sets: Reaver / two-handed greatsword; Rogue / dagger + parrying dagger; Starseer / staff + empty hand; Herald / sword + shield. Each has 14 transparent 512 × 512 WebP pose files, a portrait, a clean atlas, a labeled contact sheet and an animated attack preview (nine steps for Reaver, seven for the other sets).

Pose IDs: `STANCE-READY`, `ATK-01` through `ATK-07`, `DEFEND`, `HURT`, `CAST`, `STANCE-AGGRESSIVE`, `STANCE-DEFENSIVE`, `BUFF`. The portrait is labeled `PORTRAIT`. The gallery provides a Copy reference button for each image. Labels are outside the artwork; clean WebP files contain no text.

Example revision order: **ROGUE / Dagger + Parrying Dagger / ATK-05 — lower the blade.**

Reaver attack playback follows the user-authored sequence in `sequences.json`: ready → ATK-07 → ATK-04 → ATK-02 → ATK-03 → ATK-05 → ATK-01 → ATK-04 → ready. Pose labels and atlas positions stay stable. `update-sequences.py` updates both the animated WebP and gallery manifest; `finalize.py` runs it automatically after exports.

## Scope and status

The latest requested scope is weapon **group** plus ordered hand combination across all four classes, not every named catalog item. `coverage.json` defines 13 motion groups and their named members, including empty hands and authored prototype two-handed grips. It tracks 760 class/hand/grip entries: four are initial samples in review, the rest are pending. Grouping named skins does not imply that all weapon silhouettes have been rendered. Same-family dual wield appears where distinct legal catalog members exist.

The approved Reaver greatsword set is integrated through the equipment animation reference component; the other three sets remain review drafts. This is not a completed animation library. Human visual review is still needed for anatomical consistency, exact hand assignment, weapon retention, and attack continuity. Static stance/defend/hurt/cast/buff poses are single frames; attack uses seven authored attack poses, with the approved Reaver playback also including ready and repeated poses. Buff effects are baked into the corresponding pose.

Maps, weapon/armor item art and relic art were assigned to three separate requested tasks. The earlier Bellfoundry map concept is retained here as `maps/bellfoundry.webp`.

## Provenance and reproduction

Created with the built-in `image_gen` tool. Exact prompts are in `prompts.json`; PNG sources are retained in `sources/`. Existing class idle artwork supplied the Rogue, Starseer and Herald references. Reaver uses the new knight design generated in this batch. Generated sources were copied from the Codex generated-images folder, preserving originals.

The export scripts isolate connected figures to prevent neighboring sprite fragments entering a crop, preserve alpha, use a common scale within each source sequence, and place figures on a common 512-pixel canvas with a nominal foot anchor at (256,480). Supplemental poses are scaled against each set's standing pose. Painted anatomy can still vary between generated frames. WebP quality is 88 for poses, 92 for portraits, and 90 for the map. Lossless alpha is preserved.

Rebuild in this order: `node catalog.mjs`, `python export.py`, `python finalize.py` from this directory (Python needs Pillow). These commands only rebuild this art pack. `check-gallery.cjs` validates the served review gallery with Playwright installed or supplied through PLAYWRIGHT_MODULE.

`manifest.json` is the authoritative file index. `data.js` embeds the manifest and coverage so the gallery can also open directly without a server. Production pending entries are not placeholders or fabricated completed images.
