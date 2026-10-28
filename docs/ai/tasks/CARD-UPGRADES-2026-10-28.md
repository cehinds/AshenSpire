# Card upgrades (Core): design decided

The owner made these decisions on 2026-10-28. Co-op is ignored. This applies to the Core profile only, and Legacy/Current must stay byte-identical.

## Owner rulings
- Card upgrades can be bought at rest sites and at the Blacksmith.
- **Free allowance F:**
  - A Basic or cantrip card gets F = 1.
  - Every other card gets F = 1 + R.
  - R is the player's highest skill-track level, `run.skills[t].level` (0..10), over the tracks whose schools match the card. Use the same schools logic as `trackSchools` in src/model/skills.js:383-392.
- **Cost:**
  - The upgrade number n is the index of the upgrade about to be applied, starting at 1.
  - Upgrade number n is free while n <= F.
  - Past F, each further upgrade costs 1 Smithing Stone. Example: a Basic card's first upgrade is free, and its second costs 1 stone.
  - Hard cap: 10 upgrades per card.
- **Blacksmith reach:** Core shop nodes become a Blacksmith 25% of the time. Today Core never reaches a Blacksmith.
- **Effects:** mostly algorithmic and somewhat random:
  - +damage
  - +block
  - +status stacks
  - an added status
  - −1 cost
  - +hits
  - (maybe) the Retain keyword

## Data model
- Keep `upgraded: boolean` on the card instance. It is read in about 50 places and means "at least 1 upgrade".
- Add the optional `upgradeSteps: Step[]`.
  - The upgrade count is `upgradeSteps.length`, or 1 when `upgraded` is set and the list is absent.
  - An old save with `upgraded: true` and no list reads as `[{k:'authored'}]`.
  - Changing the format moves no save bytes and bumps no schema version.
- **Step 1:**
  - If the card has an authored `upgrade` block, step 1 is `{k:'authored'}`.
  - Otherwise step 1 is rolled.
  - Steps 2 and later are always rolled.
- Rolled steps are **stored**, never re-derived on load, so a later change to the generator never changes a card the player owns.
- **Seeded roll:** `mulberry32(hash(run.seed, instanceId, stepIndex))`.
  - It is stateless, so the preview equals the commit.
  - It does not touch the named RNG streams in src/engine/rng.js.

## Step generator
`rollUpgradeStep(baseDef, appliedSteps, stepIndex, rng)` lives in a new pure leaf module, src/model/cardUpgradeSteps.js. It may import only leaf modules; check with `node tools/bundle-cycles.mjs`. It filters the options below down to the ones the card is eligible for, then makes a weighted pick.

| Step | Weight | Bounds and guards |
|---|---|---|
| `dmg` | 30 | +max(2, ceil(15% of base)) on the first unconditional damage effect |
| `blk` | 25 | +max(2, ceil(20% of base)) on the first unconditional block |
| `stk` | 20 | +1 to an existing applyStatus. Caps: Burn 3, Weak/Vulnerable/Frail 3, Bleed 4 |
| `addStatus` | 8 | Only if the card applies no status. 1 stack from its school: physical gets Bleed or Weak, spell gets Burn or Vulnerable |
| `cost` | 10 | At most once per card. SP never below 1. MP cards keep manaCost >= 1 and `cost` >= `balance.mana.minActionCost` (1). Respect `minStaminaCost` (src/model/validate.js:588-600). Keep `cost` equal to staminaCost |
| `hits` | 5 | At most once per card. Only on single-hit damage <= 8. Hits capped at 3. Per-hit amount = ceil(total × 0.6) |
| `retain` | 5 | **Only if Core actually honours `keywords:['retain']` at end of turn. Verify this first; if it doesn't, leave the option out.** At most once; skip if the card already has Retain or has Exhaust |

- **Global guard:** the total damage or block gain is capped at +100% of the base value.
- **Fallback:** if nothing is eligible, add +1 to the primary number.
- Power, status and curse cards can only take `cost` or `retain`.

## Naming
- Upgrade count 1 keeps today's `Name+`, or the authored upgrade name.
- Count N >= 2 shows `${baseName}+N`, for example "Strike+2".

## Where things change (one commit per step)
1. `src/model/cardUpgrade.js`: `applyUpgradeSteps(base, steps)`, `upgradeCount(instance)` and the naming. Tests.
2. New `src/model/cardUpgradeSteps.js`: the generator and seeded RNG. Tests for bounds, the caps above, determinism (same seed gives the same step) and each eligibility rule.
3. `src/model/registries.js` (the resolve cache key at :641 must include the step signature instead of `upgraded ? 1 : 0`, plus the merge at :655) and `src/model/gameProfile.js:47`: apply the steps.
4. Carry `upgradeSteps` through:
   - `src/model/state.js`: validation. It is optional, and each step must be a known kind.
   - `src/engine/combat.js`, at the copy sites :441, :1841, :2567 and :2918.
   - `src/model/combatSnapshot.js:118`.
   - Combat must play exactly what the face shows.
5. Clear `upgradeSteps` wherever `upgraded` is reset to false: `src/model/smithing.js:497` and `:661`, and `src/model/loadout.js`.
6. New `src/model/cardUpgradeLimits.js`:
   - `freeAllowance(run, def)`, `upgradeCost(run, instance, def)` (0 or 1 stone, or null when the card is at the cap) and `canUpgrade`.
   - Move the Basic test out of `src/model/deckCopyLimit.js:16-29` into a shared helper rather than copying it.
7. New `src/model/cardUpgradeService.js`:
   - `planCardUpgrade(run, registries, instanceId)` is inert. It returns the rolled step, the before and after definitions, and the cost.
   - `commitCardUpgrade` re-plans, refuses a stale quote, spends the stones and appends the step.
8. Rest service `upgradeCard`:
   - Edit `engine/modules/rest/settings.schema.json` and `defaults.json`, `games/ashenspire/packs/core/rests.json`, and `applyService` in `src/model/gameProfileRest.js`.
   - One card per rest visit.
   - Then run `node tools/game-config.mjs build`. Never hand-edit the generated files.
9. Rest UI: `src/ui/models/GameProfileRestModel.js` and `src/ui/components/gameProfileRest.js`.
   - Reuse the picker in `src/ui/components/smithUpgradeModal.js`, with card rows.
   - Preview before and after through `upgradePreviewHtml` (`src/ui/components/card.js:637-657`).
   - Show the cost (Free, or 1 Smithing Stone).
   - Add the strings to the strings CSV.
10. Blacksmith:
    - Generalise `upgradeArt` in `src/model/blacksmith.js:283-332` into a card upgrade on any deck card, at the same cost rule, unlimited per visit while the player can pay.
    - Give Core shop nodes a Blacksmith 25% of the time: `content/source/shops.json` kindWeights, or a Core shop setting, then run content-build.
    - Update `src/ui/screens/blacksmith.js`.
11. Make `src/engine/actions.js:2158-2169` (`upgradeCard`) respect the cap and append a step.
12. SPEC.md: one section with the rules above, marked as an owner ruling dated 2026-10-28.

## Traps
- Touching `engine/kernel` (including `gameConfig.js`) changes the runtime hash and forces a repin (src/model/coreEvasionCompatibility.js, tests/fixcore-evasion-save-compatibility.test.mjs). Keep new logic in `src/model`.
- New modules must stay leaves; the bundler destructures named imports at load. Run `node tools/bundle-cycles.mjs`.
- A stale cache key, or a copy site that drops the field, makes combat play a different card than the face shows. Test that end to end.
- Never commit built HTML or bulk QA JSON.
- MP cards need at least 1 SP. Burn caps at 3.

## Acceptance (the worker runs all of these)
- `node tools/game-config.mjs check`
- `node tools/build-game.mjs --check`
- `node tools/content-build.mjs --check`
- `node tools/config-build.mjs --check`
- `node tools/mechanics-generate.mjs --check`
- `node tools/style-lint.mjs --check`
- `node tools/bundle-cycles.mjs`
- `node tests/run-node.mjs --no-selftests --no-discovered`
- The new tests, plus the existing upgrade, smith, blacksmith, rest and save-compat tests.
- Delete any dist/build you create; disk is tight.
