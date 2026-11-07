# Owner backlog

Owner-requested changes. Tracker only: nothing here is implemented by the tracking session; the managing session runs build/review/merge.

## #1 Remove the selected HUD
- Status: in progress
- Asked: 2026-11-07 — "remove the selected HUD"
- Means: Enemies stop opening the larger selected/target panel; every combatant keeps the overhead mini HUD; targeting, floor tint and tap-to-inspect stay.
- Questions: none
- Link: branch feature/NoSelectedHud

## #2 Keep the current HUD
- Status: done
- Asked: 2026-11-07 — "the current hud is fine"
- Means: Keep today's mini HUD layout (intent above, Block square left of the HP bar when Block > 0, HP number where it is now). The earlier "HP number inside the bar" idea was cancelled.
- Questions: none
- Link: —

## #3 Delete stale GitHub branches
- Status: pending
- Asked: 2026-11-07 — "yes" (owner approved deleting alternative/dev, alternative/release, alternative/test, tools-archive)
- Means: Remove those four branches from the repo. The managing session's GitHub access was refused; the owner deletes them at github.com/cehinds/AshenSpire/branches.
- Questions: none
- Link: —

## #4 All statuses as badges in one row with Precision
- Status: pending
- Asked: 2026-11-07 — "Id like all status's to be batches like automatic sweeP"; clarified: "no: I mean in the same row as precision and status effects since those buffs are status effects just buff status effects"
- Means: Every status effect on a combatant, buffs included (e.g. the clock/speed-lines one), renders as the same small round count badge in one shared row with Precision (the crosshair badge), not scattered in different styles/places. ("Automatic Sweep" in the first ask was Precision.)
- Questions: none
- Link: —

## #5 Enemy Block to the left of the health bar
- Status: pending
- Asked: 2026-11-07 — "move the block to the left of the health bar for enemies" (screenshot: Block shield "7" sits below-left of the bar, under its left end; red box marks the spot at the bar's left end)
- Means: On enemy mini HUDs, the Block badge moves from under the bar to directly left of the HP bar, in line with it. Player HUD and the rest of the layout (#2) stay.
- Questions: none
- Link: —

## #6 Status row under the health bar
- Status: pending
- Asked: 2026-11-07 — "also, I want the precisiuon to be under the health" (screenshot: red box directly under the HP bar)
- Means: The Precision + status badge row (#4) sits directly under the HP bar, instead of left of it/below-left. Pairs with #5 (enemy Block left of the bar).
- Questions: none
- Link: —
