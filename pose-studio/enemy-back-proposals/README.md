# Enemy rear design review

Delivered: 130 rear design proposals across 13 enemies, with v01 as a provisional draft seed rather than a selected winner. Three elites each include nine held poses (neutral, smash, attack, sweep, counter, defend, evade, spell, preparing), four-frame attack and evade clips, and static hurt and defeated reactions: 57 active exports total. Two neutral-alt spare exports remain excluded from bindings.

All other animation clips and the other nine versions’ motion sets remain unbuilt. Missing poses and clips display explicitly; original identity references are labelled separately. Source prompts, crop approvals, frame hashes, manual anchors, and review receipts remain attached to the manifest. Draft approval does not establish runtime alignment or playable unlocks.

Open index.html through the Workbench static server, or use the feature preview’s Rear designs button. Download manifest exports the review state; the feature build artifact contains the self-contained gallery. Run model.test.mjs and motion.test.mjs with Node 22; browser-qa.mjs verifies the actual static build, sandbox embed, playback, comparisons, and four viewport layouts.
