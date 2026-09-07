# Enemy idle and attack sprites

33 enemies have an idle and a character-specific attack frame. Seven legacy low-poly enemies receive painted replacements: Husk Brute, Stitched Hound, Court Marionette, Ash Revenant, Ember-Starved Pilgrim, Charred Colossus and Blighted Valkyrie. The other 26 keep their existing painted idle image unchanged.

Open `index.html` through a local HTTP server to compare every pair, view its original art, and play an idle → attack → idle transition. `sheets/` retains all 33 full-resolution generated sources. `generation.json` records the reference and prompt for each enemy. Art was generated using built-in image_gen.

`node art/enemy-poses/build.mjs` extracts poses using the repository's `tools/painted-poses.mjs` and exports RGBA PNGs to `assets/enemy-poses/`. Exported frames use the existing 384 × 384 convention, face toward the player's side, and use ground line 364. The two poses in each replacement sheet share one scale. Existing idle images remain byte-identical to their references. Intermediate extraction files are ignored; final assets and source sheets are retained.

The combat renderer preloads the attack frame and displays it during the existing `act-attack` state. It returns to idle when that state ends. Failed attack loads leave the idle visible. These are discrete attack keyframes, not complete multi-frame animations or rigged 3D models. Long weapons and effects fit within the square frame; a wide attack can therefore appear smaller than its standing idle.

## Validation

`inspect.cjs` uses Playwright with installed Edge against a local server on port 4287. It verifies all 33 gallery cards decode, phone width does not overflow, playback returns to idle, and all 33 real enemy-renderer instances switch to attack and restore idle. Results are in `inspection.json`; screenshots show the gallery and renderer fixture. The fixture exercises actual enemySprite code and combat CSS, not an entire gameplay encounter.

The initial Wandering Soldier source contains a checkerboard, removed by the repository's existing extraction process. An image_gen background-removal retry was rejected because it returned scenery. No rejected art is used by the game. Original high-resolution source edges are retained in the source sheets; the export pipeline adds transparent frame padding.

Repository build and check logs are stored beside this file. No publishing, branch push, issue creation, or pull-request creation has been performed.
