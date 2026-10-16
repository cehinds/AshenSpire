# Formation occupancy (host adapter)

`formation` controls real combatant placement in the alternative battlefield. It does not change damage, range, targeting eligibility, turn order or Classic layout settings. Core and Current use the same host adapter; their bundled JSON differs only in the extra-row flag.

```json
{"formation":{"extraRow":{"enabled":true,"sides":["enemy"],"capacityPerLane":1}}}
```

Core defaults `enabled:false`; Current defaults `enabled:true`. Override that flag in either profile's author modules, or disable the module with `formation:false`. This module explicitly consumes settings in the Current legacy foundation, unlike legacy modules that reject unsupported overrides. Version 1 supports only enemy occupancy in the shared extra band and exactly one extra slot per lane. Player-side extra-row placement is deliberately rejected by its schema.

The visual bands are A enemy-back, B enemy-front, C extra, D player. Those labels are not saved gameplay lane letters. Existing addresses remain unchanged: player A1..F1, enemy-front A3..F3, enemy-back A4..F4. Extra enemy cells are A5..F5. No existing cell is renumbered. With seven enemies, Current uses three lanes and places its seventh enemy in A5; Core uses four lanes and keeps every enemy in columns 3/4. Up to six lanes are supported (18 enemy slots with the extra row, 12 without). Existing valid saved positions are reserved before new allocation; duplicate/illegal positions fail loading.

The engine saves `combat.formationPolicy` and each actor's `formationCell`. Co-op uses the same occupancy contract and graph snapshot. `formationOccupancy(combat)` exposes `{id,cell,side}` rows, and the UI receives those rows with the policy through the battlefield's `data-formation-occupancy` / `data-formation-policy` attributes. Alternative layout maps stable addresses to visual bands; Classic ignores the extra band and retains its existing settings. Occupancy never grants an extra ally or enemy target: the existing living-combatant rules remain authoritative.

Focused checks (profile CLI tests mutate generated artifacts, so run serially):

```sh
node tools/game-config.mjs build
node --test --test-concurrency=1 tests/formation-policy.test.mjs tests/formation-layout.test.mjs tests/formation-movement.test.mjs tests/game-profile.test.mjs
node tools/game-config.mjs check
```
