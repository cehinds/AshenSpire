# Combat tag and intent evidence

Shared production intent renderer and co-op projection checked at 960×720 and 390×844. Switching between successful and failed character reads shows exact damage or the casting stance with a question mark. Hidden tooltip and inspector omit the move name and damage; switching back restores the successful read without rolling again.

Component catalog filter/detail interaction checked. No console errors or missing resources in the isolated checks. Full live network gameplay was not exercised by this fixture.

The real co-op screen also passed `node tools/coop-hud-top.mjs --intent-privacy-only`: open the successful-read inspector, switch couch seats with Tab, verify it closes, reopen with the failed read and verify exact damage stays hidden, then Leave and verify inspector cleanup. The same check runs in the ordinary CI probe. Host snapshot fixture, not a live network session.

That probe also checks Guard Counter's untargeted preparation and Binding Parry's explicit source confirmation. No enemy is requested for deferred reply damage. The click-to-impact probe samples five immediate damaging cards (370 ms median); deferred Counters have dedicated preparation coverage. Tutorial checks passed 200/200 across eight viewports; resize and first-run remain CI cases. Motion checks passed 32/32. An End Turn height assertion failed equally on the original runtime and this candidate at 1200×730 with a medium seven-card hand; its configured height is below the shared tap floor. No assertion was removed or relaxed.

The [hit sequence fixture](intent-hit-preview.html) uses the current production overhead, tooltip, co-op intent model and enemy move catalog. Its 1024×680 capture shows `2+5+5` (12 total) after one Counter reduction, ordinary `5×3` (15 total), and a failed read with only its stance. Checked both labels and catalog text in Chromium; no page errors and no horizontal overflow at 1024 or 390 pixels. Serve this repository with `node tools/serve.mjs` and open `docs/qa/combat-tags-20261007/intent-hit-preview.html` to reproduce.

Focused node checks cover the saved Counter formula after restoring under changed live tuning, cloned co-op matchup rules, seat-specific host previews, hidden per-hit fields, unchanged defenses/RNG during projection, and unchanged uniform-hit text. Generic Counter and Smash tag hints describe their effects without repeating default multipliers that a configured fight may change. This fixture does not establish live socket privacy; recipient filtering has its separate transport regression.

![Successful read](intent-revealed-desktop.png)
![Hidden read](intent-hidden-mobile.png)
![Component catalog](intent-catalog-mobile.png)
![Co-op successful read](coop-intent-revealed.png)
![Co-op failed read](coop-intent-hidden.png)
![Counter preparation](coop-counter-preparation.png)
![Per-seat hit sequence](intent-hit-sequence.png)
