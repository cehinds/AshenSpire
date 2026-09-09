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
