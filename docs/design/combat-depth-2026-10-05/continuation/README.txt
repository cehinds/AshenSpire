AshenSpire alternative/dev combat art continuation

Open index.html in this folder, or serve the parent combat-depth-2026-10-05
folder and browse /continuation/index.html. The review gallery is portable
with its parent package; it makes no network requests and does not change saves.

The catalog includes 59 canonical idle actors and 32 named combat settings.
The final scene set uses 69 masters (66 new and 3 approved reused layers),
including eight dedicated portrait foregrounds. See REVIEW.txt for evidence.
All 19 approved hero/armor appearances and 33 opposing enemy masters are retained.
Two companions and five speakers have rear-right alternatives; front originals
remain available in the parent masters folder for portrait/dialogue use.

Every scene has four independently addressable layers and separate desktop
(1536x1024) and phone (768x1024) art-stage transforms. These are battlefield
art compositions, not entire game-screen layouts. Preserve existing HUD/cards/
footer when consuming them. Regional distance, terrain and foreground layers
are intentionally shared; each setting has a unique landmark. Indoor and night
settings select appropriate separate distance plates.

scene-catalog.json paths are relative to this folder. Each layer has PNG size,
SHA256, alpha-threshold bounds, and a transform for each device. Layer transforms
are pixel x/y/width/height on that device canvas and retain source aspect ratio.
Depth coefficients are independent. Actor footAnchor is the bottom-center of
visible alpha at threshold 32, suitable for idle placement, not an animated
contact or action anchor. No outlines are baked into the artwork.

Production:
  inventory.py         scans canonical scene/actor catalogs and 58 library files
  sprite-prompts.json   exact seven original rear-view edit prompts
  repair-prompts.json   targeted silhouette-clearance correction
  scene-prompts.json    region layer and unique landmark generation prompts
  extra-prompts.json    interior/night, surface and portrait foreground variants
  receipts/            built-in image_gen provenance and original pixel hashes
  sprites/, scenes/    unmodified PNG masters copied from image generation
  build.py             assembles metadata and separate device compositions
  contact-sheets.py     renders review evidence from actual catalog transforms
  validate.py          checks coverage, alpha, geometry, hashes and art-only scope
  integrate.py         selects accepted sprites/scenes in the parent art catalog
  hash-package.py      refreshes source checksums without rebuilding the old ZIP

Run from any working directory with Python and Pillow installed:
  python build.py
  python contact-sheets.py
  python validate.py
After all validation issues are resolved, run integrate.py to refresh the parent
art catalog. Do not run the older parent build-catalog.py to rebuild this revision;
that older script reconstructs original front-view file choices.

This branch contains artwork/catalog changes only. It does not integrate assets
into live combat, alter layout editing, or publish playable builds. It must not
be merged into primary dev or standard test as part of this delivery.
