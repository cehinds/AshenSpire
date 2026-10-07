LAYERED CLASS ARMOR / EVERY ARMAMENT PAIR
October 6, 2026

Open http://127.0.0.1:43287/ while the local Editor preview is running.
Choose Poses & effects > Sprite Workshop, then an armor project and loadout.
Alternatively import class-armor-weapons.spritepack.zip in the integrated
Workshop. The pack includes all relative assets. Individual rig documents
depend on their adjacent assets directory. The updated independent-grip
Workshop is required; older installations may not support this grip mode.

COVERAGE
31 distinct rear-facing class/armor appearances cover 35 supported armor
records. Four same-class default/shared armor mappings reuse their authored
master. Every appearance has all 29 right-hand by 29 left-hand choices:
28 canonical armaments plus empty, for 841 poses and 26,071 total.

There are 25 distinct painted weapon designs. The canonical authored aliases
remain explicit: frostSpear uses halberd, cinderAxe uses battleaxe, and
duskChime uses boneSceptre. These are not newly designed variant artworks.
All source armaments have hand=either; the current loadout model defaults
handsRequired to 1. This art coverage does not override game ownership,
stat, or unlock requirements and does not claim two-hand attack poses.

LAYERING
Each document uses a proportional 512 x 512 body with H1/H2 palm anchors.
Weapons retain rigid normalized proportions and separate transforms. The
foreground finger masks reuse actual body pixels to overlap the handles.
Front-facing shields obscure the hand instead. Body and finger layers are
locked initially; weapon layers remain editable. Fit selected weapon targets
only its assigned hand. No body erasure or stretched weapon geometry is used.

SOURCES AND PROVENANCE
Armor source commit: f1bad442950d43739a6f1726d63be3555b24838b.
Canonical weapon data revision: c448cb31c1459581e22642136a224256d4fd3c25.
Weapon art: AshenSpire/art/painted-items-2026-09-07/<armament>.png.
The source snapshot, aliases, full-size artwork and registration metadata
are included. receipts.json records 33 image-tool body generation/repair
operations, exact prompts, references and byte hashes. Two superseded body
outputs are retained as initial sources. Source artwork is not modified by
the mechanical normalization scripts.

Editor integration: d21f40188c50c0ca2f16742e2f612dd38884848a,
branch codex/editor-layered-weapons in AshenedSpire-Editor. Includes Sprite
Workshop, the prior armor/art catalog and matrix, and Combat Studio art study.
workshop-core.mjs is the matching independent-grip validation core.

VALIDATION AND REVIEW
validation.json: all 26,071 documents' poses pass schema, Cartesian coverage,
relative asset, layer order, rigid transform and hand-contact checks;
50,344 weapon/palm contacts and 117,769 layers checked.
image-validation.json: 62 painted palm checks, 28 painted weapon grip checks,
and no edge clipping in 1,736 single-weapon placements across both hands.
review/ contains 28 main-hand previews per appearance, a sword/shield preview
per appearance, and representative mixed loadouts. Contact geometry and
representative visual inspection do not constitute approval of every overlap.
All poses deliberately retain reviewed=false. These are editable idle carry
studies, not runtime-installed equipment or attack animations.

Editor verification: 43 focused tests, four Sites tests, production build and
quick review passed. Representative Starseer and Rogue loadouts, layer edits,
grip restoration, catalog, and desktop/phone art study were browser checked.
Browser save displayed a portable document and download link, but automated
download capture timed out; downloaded-file reimport remains unverified.
No remote push, CI, merge, release, or game runtime installation is claimed.

REBUILD
Use Python with Pillow and Node from this directory:
  python build.py
  node validate.mjs
  python validate-images.py
  python render-review.py
  python checksum.py
The portable ZIP has fixed timestamps and relative entries. SHA256SUMS.txt
records this complete source package except itself and Python bytecode caches.
