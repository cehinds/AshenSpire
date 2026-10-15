# Ashen core content pack guide

`ashen.core-content@1.0.0` supplies the definitions selected by `ashen.core@1.0.0`. It is a data pack: it contains classes, cards, routes, rest policy, shops, rewards and explicit provisional balance policy. It does not contain executable JavaScript or a portable gameplay interpreter.

Edit the JSON in this directory, then run `node tools/game-config.mjs build` from the repository root. The build refreshes the generated profile catalog and lock. Never edit generated files directly. Run `node tools/game-config.mjs validate --input games/ashenspire/game.json` before building and `node tools/game-config.mjs check` to detect stale outputs.

## Pack files

- `classes.json` defines Reaver, Starseer, Rogue and Herald with exactly six total starting attribute points each. Reaver has STR 2; Starseer INT 2; Rogue DEX 2; Herald WIS 2; all other attributes are 1. It also names fixed starting equipment, max HP and the class-special card.
- `starterDeck.json` defines three Strike, three Defend, one Counter, one Smash, one Sweep and one class-special card: ten cards total. Reaver starts with a greatsword, Starseer/Herald with a scepter and Rogue with two daggers.
- `cards.json` supplies the adapter card definitions. Edit effects only using operations accepted by the host card registry; unregistered operations fail validation or execution. It does not define a portable effect VM.
- `resourceVariants.json` gives explicit card costs for `none`, `sp`, `mp`, and `sp,mp` selections. Add a variant when adding a card with costs in a pool that can be disabled; the resolver never silently strips card effects.
- `stats.json` declares a six-point total, the 4 + INT hand formula and confirmed primary gains: STR +1 AR, DEX +1 DR, CON +10 HP and +0.5 SP, WIS +1 MP, INT +1 draw. The exact SP growth aggregation and other secondary dependencies remain delegated to the host adapter.
- `routes.json` describes three acts, seven pre-boss nodes, three bosses, two visible rests per act and the rest floors. Route counts and rest floors are projected from resolved `routes` module settings by `policyBindings`; pack-only edits to those bound values can be overwritten. Edit the `routes` object in `game.json` for local count/floor changes, keeping the map positions and constraints compatible.
- `rests.json` describes Strategize, Smith and Level Up, with exactly one service per visit. Service selection, recovery and Smith policy are projected from resolved `rest` module settings by `policyBindings`; pack-only edits to those fields can be overwritten. Every service restores full HP/SP/MP and refills healing and MP flasks. Manual deck editing is Strategize-only; equipment editor timing is a separate module policy.
- `shops.json` sets the current three offers and price. Price 10 is provisional.
- `rewards.json` sets three offers and one choice across weapon, relic, combat-card, weapon-art, potion and armor categories. Exact selection/eligibility remains constrained by registered host content.
- `classUnlocks.json` makes only Reaver initially available; unique terminal full-run wins or defeats unlock Starseer, Rogue, then Herald. Existing profiles retain their own unlock ledger.
- `provisionalPolicies.json` records values chosen to make the current adapter playable while balance choices remain open. These values are implementation defaults, not additional product confirmations.

The current Smith policy is one free upgrade tier per visit (`smith.free: true`, `tiersPerService: 1`), a provisional choice. Setting `modules.rest.smith.free` to `false` charges upgrade stones instead. Block gained uses the confirmed formula `baseBlock + DR × effects.defenseRatingWeight` (default weight 1); this is a host-adapter setting, not a portable rules instruction.

## Safe edits

Keep IDs unique within their family. References such as `specialCardId`, starter card IDs, equipment IDs, rest floors, unlock class IDs and resource variants must resolve. A renamed card must be changed in its class row, starter deck, variant map and any reward definitions that reference it. A disabled SP or MP pool requires its explicit card variant. A missing or invalid reference should stop profile validation; do not replace it with a free default.

The pack is selected by the core bundle. Module settings resolve through defaults, bundle settings and author overrides; `policyBindings` then copies selected module settings onto corresponding pack fields. Use `games/ashenspire/game.json` for per-game changes to bound mechanics such as route counts/floors and rest service policy; edit pack content for definitions and unbound authored fields. Use `presets/current.json` for the original host game; it has no configured module overrides, and unsupported overrides are rejected rather than ignored.

The core runtime is host-dependent and its export is explicitly nonportable. Source adapters and browser acceptance are still in progress. Treat the provisional policy file as provisional until an owner decision replaces it, and do not claim that every legacy behavior has been migrated into data.
