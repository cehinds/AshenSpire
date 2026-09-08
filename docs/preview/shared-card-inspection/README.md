# Shared card inspection validation

The production renderers now share `cardInspection.js`. Equipment faces keep a 350 × 490 canvas, with 270px of artwork and 180px of information inside the 450px inner face. The inspector uses a 220px card column and complete readable details, stacking on phones. Starting Equipment separates browsing from its explicit Choose action and preserves the selected loadout and auto-advance.

Validated in Edge/Chromium through Playwright at 1440 × 1000 and 390 × 844. The Browser plugin was unavailable. `PLAYWRIGHT_MODULE` can point to the installed Playwright module; otherwise the tool resolves `playwright` normally.

- `node tools/card-inspection-qa.mjs`: 64 checks passed. Desktop click, touch selection/second-tap Information, keyboard opening, Escape/focus return, long text and scrolling, empty search, unaffordable purchase and empty Smith selection, actual starting armour passed to Begin, Inventory/merchant/Smith no-commit checks, combat no-play checks, preserved hold inspection and drag play, regenerated standalone boot and inspection.
- `node tools/weapon-card-preview.mjs`: 244 checks passed across 25 armaments, 62 potions/relics, merchant, reward collection/back, Inventory and existing hold progress. On this Windows host, `CHROME` points to installed Edge.
- `node tests/run-node.mjs`: 136 passed, 0 failed.
- `node --test tests/equipmentCard.test.mjs tests/combat-touch-inspect.test.mjs`: 4 tests passed.
- Shipped artifacts regenerated with `node tools/launch.mjs --build-only`; build-version and shipped-alias checks passed (8 and 6 checks).
- Component catalog descriptions and miniatures updated in `docs/component-catalog.html`.

Screenshots in this directory cover desktop and phone inspection, Starting Equipment, merchant, Inventory, Smith and playing cards. They use disposable production screen mounts and the actual game's combat fixture. No real saved run was changed.

Promotion validation: merged current dev (`6ca16fbf`) and regenerated conflicting build artifacts. The 136 repository tests, 4 focused tests and 64 desktop/phone checks passed again; these screenshots reflect that merged source. Touch-hidden Information buttons now leave hit testing and reveal persistently for keyboard focus; native Information activation is separate from the game cursor. The 390 × 650 screenreach check still reports four covered fan cards in each of combat and combat-xl, matching those same two successfully mounted states on unchanged dev. Other baseline mounts timed out, so this comparison does not claim a complete baseline pass. The gate remains enabled.

Limits: phone input is browser emulation, not a physical phone or Safari; gamepad hardware was not exercised. The older `inspecthold.mjs` instrument cannot run unchanged on this Windows/current-UI combination (path import and obsolete selector assumptions); the new browser check directly verifies hold inspection and drag play instead. The inherited dev version authority is still 0.5.5; this task does not change version authority following the informational 0.6 announcement.
