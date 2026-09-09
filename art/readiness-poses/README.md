# Combat readiness poses

Prepared, Starstone Charge, and Herald Blood Rite are visual pose states. No
mechanical statuses, costs, durations, hooks, or saves change. Blood Rite is a
presentation name for the existing Herald blood-economy powers listed in
`src/content/combatPoseStates.js`; it is not a new engine status.

Twelve authored poses preserve the three classes' four existing outfits. The
three source sheets were generated with OpenAI imagegen using the shipped idle
art as references. Sources remain here; `node tools/readiness-poses-ship.mjs`
extracts the magenta matte, removes boundary spill, and registers transparent
640px WebP frames at floor y=600. Reaver's existing authored attack-ready and
shield-guard frames represent Gorefire and Bulwark.

`resolveCombatPose` chooses defeat first, then mechanical stance, latest live
readiness status, guarded rest, and neutral idle. Receipt order belongs to the
UI session. A reconnect without receipt history uses stable snapshot order.
Readiness never extends a consumed or expired status. Solo and co-op use the
same resolver, art, persistent glow, and animation return behavior.

Run `node tools/serve.mjs --port 4293 --no-open`, then open
`http://localhost:4293/art/readiness-poses/preview.html`. The gallery exercises
all twelve outfits, attacks, casts, hits, guards, effect removal, reduced motion,
and Herald payment/healing glows through the production stage renderer.

Build the game with `node tools/launch.mjs --build-only`. Build a portable review
page and copy the game with `node tools/readiness-preview-build.mjs <output-dir>`.
Run the unit checks with `node --test tests/combatPose.test.mjs` and the desktop,
phone, source-game, and standalone browser checks with
`node art/readiness-poses/playtest.mjs`. The combat captures use isolated shot
fixtures and real card clicks; they are not full-run balance playtests.

## Soft transitions

Twelve additional authored gather frames sit between neutral idle and readiness.
Entry and exit use the same frames in opposite order over 360ms, with 140ms
crossfades. Aura motifs breathe between 18% and 38% opacity over 4.2 seconds.
Silhouette glows use faint alpha; Herald reaction colors remain readable without
a bright flash. Reduced motion resolves immediately and keeps a steady motif.

Solo and co-op carry each stage presentation timestamp across DOM replacement.
This preserves a fade already in progress and prevents repeated snapshots from
restarting it. The gallery includes a Transition sprites strip for every outfit.
Source prompts are in transition-generation.json; the built-in imagegen tool
created the three transition source sheets. Run
`node art/readiness-poses/transition-check.mjs` for entry/exit opacity, redraw,
rapid reversal, and app/OS reduced-motion checks.
