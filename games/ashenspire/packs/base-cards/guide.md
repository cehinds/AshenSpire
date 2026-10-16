# Base card pack

The approved proposal supplies **67 playable combat cards and 3 generated status cards**. Two rest services and two rule templates in the original catalog are not combat cards. The old 304-card snapshot is reference material; this pack adds identities and never replaces the balanced legacy definitions or their costs. The core ten-card starter and class-special identities remain unchanged.

## Authoring and provenance

Edit `cards.json`. Each row separates its executable `definition`, canonical `tags`, reward `groups`, feature `requirements`, presentation references, exact source `provenance`, and chosen `authorDefaults`. `sourceManifest.json` records all 70 original IDs and their individual SHA-256 hashes. The compiler requires each source entry exactly once and refuses edited source provenance. Change `definition` and `authorDefaults` when balancing; retain the original proposal strings, including its unresolved questions.

Numbers selected to resolve those questions are **editable author defaults**, not previously approved numeric balance. Typical utility costs 1 SP; spells and arts pay at least 1 base MP. Intangible and Mirrors cost 2 MP. Generated Strike deals 6 damage for 1 SP; generated Smash deals 12 for 2 SP. Smite authors 36 weapon damage plus 6 Sacred damage for 2 SP and 1 MP. Helpers have stable `base.strike` and `base.smash` IDs and are generated, not offered as new reward cards.

Pile defaults are explicit: Hand Shuffle returns three random hand cards to draw then draws three; Scout orders the top three; Recall and Exile Recovery choose one card from discard/exhaust; Chosen Exhaust removes one hand card; Transform changes one chosen card into the helper Strike for this combat. Exhaust heals 8; Ethereal grants 10 Block. Transmute trades a chosen hand card for 2 MP, rather than inventing run inventory items. The Foresight scroll casts the linked Foresight effect once per combat and exhausts; Exile Recovery can recover it.

Dynamic defaults are also data: Affliction Scaling adds 2 damage per distinct named negative status; Reprisal adds half this turn's actual HP loss; Discipline Growth adds 2 Block per distinct type played this turn; Shifting Cost adds 1 SP per previous play, capped at +3; Rising Damage adds 3 damage per previous play. Channel X pays remaining SP for six damage per point; Spread X pays remaining SP to hit up to X living enemies in deterministic order. Multiple Strikes deals three four-damage hits, plus three Ward and three Poise damage in total. Many Forms grants one additional concurrent stance, for a total of two.

`statuses.json` owns status definitions, exact coefficients, triggers, decay and compatibility. Its rules distinguish Poison from Venom, Blight from legacy blights, and proposed Weak from legacy Weak. Read the status guide supplied with that data before changing the behavior. Burden cards use explicit `burden` action-skip/tax metadata; they are not reward cards or empty placeholder effects.

## Groups, profiles and toggles

`groups.json` lists explicit membership. `base.current-rewards` admits all 67 combat designs to the expanded current catalog. `base.core-rewards` admits compatible designs while preserving core's unified damage, no elements/ranks, and no hand retention. Generated burdens and helpers have their own groups. Core excludes elemental designs, persistent split-channel Ward Armor, Ward Break, the Ward-bearing Multiple Strikes, and Retain. Exclusion reasons remain on the author rows; canonical artwork never grants gameplay compatibility.

Per-card `requirements.modules` declares the feature modules needed by its rules. Reward admission checks those requirements, so disabling statuses, stances, defenses or equipment does not offer a card whose only effect is unavailable. Cards off removes these card rewards. The full source catalog remains inspectable. The current profile retains its existing gameplay plus the additional catalog; existing authored cards, starter decks and costs are preserved.

`resourceVariants.json` supplies all four SP/MP configurations for every definition. With only one resource, it pays the combined numeric price; with neither, authored action/card limits remain and no disabled pool is recreated. Resource-restoration cards explicitly restore the available pool or draw cards when neither exists. X cards use a fixed single-target effect when SP is absent. These are declared semantic alternatives, not silently deleted effects. A resource-disabled variant is an explicit exception to the normal MP floor; normal spells/arts still cost at least one MP.

For example, inherit the full core with `{"formatVersion":1,"core":"ashen.core@1.0.0","modules":{}}`. To inspect the expanded legacy profile, select `"core":"ashen.current@1.0.0"`. A core author can select SP-only resources using `"modules":{"resources":{"include":["sp"]}}`; its admitted cards use the explicit SP-only variants. Supported combinations and registry references must pass the checks below.

## Effect vocabulary and presentation

The definitions use the host's closed effect vocabulary: ordinary damage, protection, healing/status/resource effects; `moveCards` for real pile selection/reordering/transformation; `modifyCards` for combat-only instance changes; `addBurden` and `revealIntent`; and stance transitions. Dynamic effects use structured `metric`/`energySpent` formulas, predicates, `effectVariants`, `costGrowth`, and `targetLimit`. The runtime schema and validators own those opcode contracts; unknown operations or references must fail before release. Do not encode rules in card prose or artwork.

`presentation.canonicalCardRef` is a visual reference only. The generated `baseCardPresentation` export gives the shared renderer original face clauses, chosen readable text and canonical art references. It does not copy canonical card mechanics or create new image assets.

## Compile and verify

```sh
node tools/base-cards.mjs
node tools/base-cards.mjs --check
node tools/game-config.mjs build
node --test tests/base-card-pack-source.test.mjs tests/base-card-pack.test.mjs
node tools/game-config.mjs check
```

Keep generated modules in step with their JSON sources. Commit small reviewed changes and push the worker branch with `git push origin HEAD`; the integrator handles the feature branch. This remains a host-adapter pack requiring `ashen.legacy-adapter@1`; portable executable rules are not claimed.
