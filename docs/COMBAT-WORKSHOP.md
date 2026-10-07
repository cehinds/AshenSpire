# Combat foundations workshop

This is the first executable slice of [spec PR #844](https://github.com/cehinds/AshenSpire/pull/844), tracked in [#845](https://github.com/cehinds/AshenSpire/issues/845). The new resolver is opt-in. Existing runs and ordinary combat creation continue using the legacy rules when `ruleset` is absent.

## Play

### Game test build

Open `AshenSpire.html?shot=combat-test` on the preview server, or use `index.html?shot=combat-test` for source development. Select a build, an individual encounter or the three-fight route, enemy strength, and a seed. The equipment controls let you compare armor, legal grip, and a Blood Rune before starting. The live receipt shows requirements, load, armor, Dodge cost, source impact, contact buildup, and rune-inclusive weapon value. This uses the shipped battlefield, hand, target confirmation, animation, and resource HUD. The route carries health, stamina, and mana to the next fight; it offers no automatic refill. Equipment remains locked for a route, including keyboard and quick-menu routes; Armoury shows the exact equipment receipt and offers a return to build selection.

Dodge's card description and Evade indicator reflect the new deterministic rule. Measured Guard and Astral Focus use existing guard art with persistent blue and violet auras. Enemies reuse the game's authored sprites. This is a combat test mode, not a complete new campaign: rune loot, affinities, new stance artwork, production equipment migration, and expanded reward decks remain pending. The `shot` storage seam keeps all profile/run writes in memory.

### Equipment experiment (#934)

`src/content/prototypes/combatEquipment.js` owns the experiment's explicit armor weights/ratings, load bands, allowed grips, native hand counts, quality/socket capacities, and Blood Rune. Weapon weights, attack identity, and attribute requirements come from the current catalog. Every preset uses Fine equipment at the same progression tier; no reinforcement bonuses are added. Armor choices are test items using existing class visuals, not newly authored production drops. HP, stamina and mana caps remain controlled build values.

`deriveEquipmentCombatProfile` validates instance identity, hand occupancy, requirements, grip compatibility, rune compatibility, sockets, tags and buildup before returning a detached profile. One-handing the greatsword requires 18 Strength (ceil(12 × 1.5)); two-handing requires 12. Other requirements are unchanged. Weapons can prohibit one-handed use. Empty hands produce no weapon source and the existing resolver uses unarmed fallback. This does not add another character-creation flow.

Only worn items contribute weight, defense or attack sources. Defense changes do not alter armor weight. A socketed Blood Rune adds its configured contact buildup and theme only to attacks using that item; it adds its value once. Removing it and deriving a new profile removes those grants and value. The combat adapter freezes the profile before payment and existing saves retain that resolved snapshot. No mid-route gear mutation, inventory purchase/install/remove transaction, rune drops, smithing, or ordinary-run save migration is enabled here. Displayed item values are experiment receipts, not a new shop economy.

Try the greatsword with no armor and one-handed grip to compare light Dodge against Plate; remove the dagger rune to isolate technique Bleed from weapon Bleed; try the rune on a staff to see compatibility refusal. Configuration changes are validated before a fight begins.

Run `node tools/combat-test-browser.mjs` after rebuilding. It checks all three builds at desktop and phone sizes through real pointer/touch controls, including Dodge, stance auras, storage isolation, and route carryover. The continuation check uses an explicitly weakened enemy to reach the victory screen; it is a UI/state test, not a balance measurement.

### Standalone workshop

The user-friendly standalone tool now lives in its own private repository, [AshenSpire Combat Workshop](https://github.com/cehinds/AshenSpire-Combat-Workshop). Its pinned engine snapshot is documented there. Start it with `npm start` in that repository and open `http://localhost:8623/`. The page below remains a small engine regression fixture.

Run `node tools/serve.mjs --port 8618 --no-open --no-lan`, then open `http://localhost:8618/tests/combat-prototypes.html`. Choose a build and encounter, select an enemy, and play cards. The workshop uses `createCombat`, `dispatch`, and `previewCard`. It does not read or overwrite saved runs.

The expandable rules editor accepts the complete configuration from `src/content/combatRules.js`. Restart the encounter to apply changes. Build decks, attributes, armor, resource caps, and opponent definitions are in `src/content/prototypes/combatBuilds.js`. The prototype bundle passes the production content validator and is excluded from ordinary run registries and reward pools. Its definitions are bundled so the explicit game test entry also works in the standalone HTML.

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

The published measurements predate the equipment experiment and are provisional. They used equal 80 HP and equal attribute budgets, but authored armor/load classes and resource caps. The current default item projections preserve those defense/load values, but this is not a new balance measurement. There is no current-dev equipment/deck baseline comparison yet. The policy also does not plan mana conservation across an entire route. Neither the standard-pressure wins nor the stress losses establish full-run balance.

Before enabling the revision in ordinary runs, complete item-derived build profiles, the legacy comparison, source-specific multi-weapon participation, player-poise consequences, condition/trait authoring, run/save migration, and production HUD integration. Then rerun the gate with resource and encounter pacing tuned against those complete builds.

The broader request is still tracked by the separate spec: per-copy quality and rune sockets, whetstone affinities, equipment upgrades and enemy loot lists, Empty Hand creation, class-specific stance art/attacks/effects, weapon-arts costs, and the four 50-card reward pools. This workshop does not claim those features are implemented.
