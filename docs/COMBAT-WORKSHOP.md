# Combat foundations workshop

This is the first executable slice of [spec PR #844](https://github.com/cehinds/AshenSpire/pull/844), tracked in [#845](https://github.com/cehinds/AshenSpire/issues/845). The new resolver is opt-in. Existing runs and ordinary combat creation continue using the legacy rules when `ruleset` is absent.

## Play

Run `node tools/serve.mjs --port 8618 --no-open --no-lan`, then open `http://localhost:8618/tests/combat-prototypes.html`. Choose a build and encounter, select an enemy, and play cards. The workshop uses `createCombat`, `dispatch`, and `previewCard`. It does not read or overwrite saved runs.

The expandable rules editor accepts the complete configuration from `src/content/combatRules.js`. Restart the encounter to apply changes. Build decks, attributes, armor, resource caps, and opponent definitions are in `src/content/prototypes/combatBuilds.js`. The prototype bundle passes the production content validator and is excluded from the normal bundle and reward pools.

## Implemented

- Registered tag categories for attack source, delivery, damage type, technique, and theme. Existing tag IDs remain readable. Damage types resolve through registered metadata; a theme alone confers no effect.
- Typed direct-hit damage, bounded physical armor, strongest resistance within a named group, multiplicative resistance across groups, explicit immunity, and proportional flat bonuses. Block is consumed once; typed HP receipts conserve the remaining damage.
- Weapon-weight/family/grip impact against enemy poise, apportioned across a card's hits. A spell has a smaller impact factor. Cards can add impact. Protection prevents repeated stagger within its configured window.
- Deterministic Dodge Roll: Retain, no action cost, weight-priced stamina, one Evade charge, and an explicit once-per-turn limit. Evade prevents a complete hit and its contact buildup. Blocked contact can still apply buildup.
- Explicit turn-start stamina recovery and no automatic mana recovery in the new ruleset.
- Candidate-state execution: failed actions leave cards, pools, queues, events, and RNG unchanged. Exact previews execute on a clone. Save snapshots retain the rules fingerprint, source profiles, Evade, and trigger state.
- Trigger priority, ancestry, activation limits, and play/target/hit chance scopes on a separate persisted RNG stream. Secondary damage does not inherit weapon buildup or impact. Co-op trigger ownership distinguishes seats.
- Add, refresh, replace, strongest, independent, and unique application stacking with caps and explicit owner-turn expiry clocks. Existing buildup meters retain their own threshold behavior.
- Three ten-card prototype decks, five encounter types, and a three-encounter sequence carrying HP, stamina, and mana. The browser workshop uses existing class idle/guard art and persistent glow as a presentation test.

## Verification

`node tests/run-node.mjs` includes `node --test tests/combat-foundations.test.mjs`. The focused suite covers damage/Block/rounding, impact allocation, Bleed contact, deterministic Dodge, recovery, failed-action rollback, previews, saves, trigger loops, and co-op ownership.

`node tools/combat-prototypes-browser.mjs` drives real pointer/touch input at 1365×1000 and 390×844, with reduced motion on the phone. Screenshots and logs are written to `artifacts/combat-foundations/`. It checks all three presets, stance persistence, Dodge retention/consumption, resolved card text, and overflow, then exercises the new-rules adapter in the standalone bundle. The bundled check catches dependency cycles that native source-module tests cannot. It is a controlled workshop, not an end-to-end production run.

Run `node tools/combat-prototypes.mjs --seeds=100` for standard pressure and add `--pressure=2` to double incoming enemy damage. Reports include every scored run, including losses. The fixed policy uses exact previews; it is deliberately shared across builds and is not optimal human play.

## Content-expansion gate remains open

These measurements are provisional. They use equal 80 HP and equal attribute budgets, but authored armor/load classes and resource caps rather than final item-derived statistics. There is no current-dev equipment/deck baseline comparison yet. The policy also does not plan mana conservation across an entire route. Neither the standard-pressure wins nor the stress losses establish full-run balance.

Before enabling the revision in ordinary runs, complete item-derived build profiles, the legacy comparison, source-specific multi-weapon participation, player-poise consequences, condition/trait authoring, run/save migration, and production HUD integration. Then rerun the gate with resource and encounter pacing tuned against those complete builds.

The broader request is still tracked by the separate spec: per-copy quality and rune sockets, whetstone affinities, equipment upgrades and enemy loot lists, Empty Hand creation, class-specific stance art/attacks/effects, weapon-arts costs, and the four 50-card reward pools. This workshop does not claim those features are implemented.
