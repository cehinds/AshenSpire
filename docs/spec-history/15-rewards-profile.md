# SPEC history — §15 Rewards and §16 JSON profile

Archive of history, rationale and provenance moved out of SPEC.md §15-§16. Not rules.

## §15 (header)
- Original title: "Reward schedule, levelling pace, crafting drops and legendary sigils (owner brief, 2026-09-26)".
- Removed (Unity-port cleanup P2b), the legacy reward door: `main.js beginPendingReward`/`mountPendingReward`, the `roll*` offer family, `rollDrop`/`collectArmament`, the sigil and Smithing Stone treasure offers, `reward.js`'s legacy rows (class milestone/draft, skill draft, level choice, flask, armament, relic, sigil, card rows, per-level Level up claims) and the `rewardBattle*`/`rewardTreasure*` Advanced settings. Non-Core runs and saves are refused at load. Old saves with `run.pendingReward` or `run.deferredProgression` still load and validate (refused unless Core), but nothing writes them.
- Status: built (2026-10-02: step 1, this section, #1348; §15.1 #1351; §15.2 #1349; §15.3 #1352; step 5 legendary sigils §15.4 #1455, to the shapes pinned in #1439).
- The owner asked for: a choice of when card rewards come (after battle, on level-up, both or neither); a percent chance for a card reward; XP settings that show what they do ("I change them and I'm levelling up way too much"); more non-card rewards: armaments and equipment, smithing-stone drop chances, legendary runes with unique properties built on the tag system.
- "Runes" are named sigils for the reason §14.3 gives: "runes" is the old currency word.

## §15.1
- Stance coverage and later Core 2 picks (owner 2026-10-24/25): shipped tag weights were casting 1, smash/counter/sweep 10, default 3, `ownedCopyWeight` 0.2. Shop prices (2026-10-25): a quarter of the first table.
- Reward mix and unowned bias (owner, 2026-10-27): "make the rewards 70% chance of cards, 20% potions, 10% weapons. and make it way less likely to get cards you already have, it should lean towards new cards every time. I feel like I get the same 5 cards usually." Root cause of "the same 5 cards": tag weight 10 on smash/counter/sweep over 3, owned-copy weight only 0.2, one weapon art taking half the card group, no memory of earlier screens. Chests: "Chests keep relics." Later that day: "try to favor cantrip or basic cards for the first few nodes and then more higher cards (mana cost cards) after node 3." Elites and bosses roll the same table because the configured Core run has no separate one.
- Skills, powers and variety (owner, 2026-11-05): "Offer more skills and powers" and "the same cards are offered every run". Sameness root cause: the reserved stance-coverage slot picked a missing stance uniformly then a card, so a stance with few basics (sweep) put the same 2 to 3 cards in most first doors. Softened: smash/counter/sweep 2 to 1.5; early-depth basicOrCantrip 2.5 to 1.8. Measured over 50 first doors (Reaver): distinct cards 48 to 63, top card 28% to 22% of doors, top five 39% to 26% of card slots (`tests/reward-door-size-mix.test.mjs`).
- Elemental cantrips (owner, 2026-11-01): "also the spark cantrip, have similar cantrips for fire and frost and healing, and rot. look at the cantrip lists for dnd 5.5e and pf 1e. use those as references but the goal is to have cards for each." Families adapt the ROLE of a reference cantrip with original names and text.
- Owned potions and offered cards (owner, 2026-10-31): "Changed" notes; with nothing held / empty history existing seeds are unchanged.
- Weapon-art pool and `skipOwned` scope change: owner 2026-11-05.

## §15.2
- Historical September 24 exponential curve (`balance.level.xp` base 5, growth 1.15, roundTo 10) cost 10 XP per level up to level 9; awards paid 15 per win plus 5, 75 or 200 per normal, elite or boss kill: a three-kill normal fight (30 XP) was worth 3 levels, a one-kill elite (90 XP) 8, a one-kill boss (215 XP) 13. Not current defaults. The October 1 linear curve preceded the current base-200 x1.5 curve (owner, 2026-11-05).
- Owner decision: the base-5 curve explained the fast levelling; the October 1 curve contract superseded it.
- Stale `balance.js` comments about the old 100/120... curve were corrected. No balance number changed.

## §15.3
- "Armour is out of scope, stated."

## §15.4
- Since #1376 the no-`triggers`/`modifiers` rule holds for every sigil (§14.3); a non-legendary differs only in being slotted rather than attuned.
- "The shapes step 5 builds to" (2026-10-02, SPEC-only, before the feature PR per CONTRIBUTING ground rule 1).
- Removed with the legacy reward door: menu kind `sigil` after `relic` in `REWARD_KIND_ORDER`, row key `sigil`, state `pendingReward.states.sigil`; the drop's placement at `main.js onCombatEnd` and the map-treasure door (`enterNode`, `case 'treasure'`) checkpointed through `beginPendingReward` (so `resumeRun` remounted an unclaimed sigil row), the World Journey `completeJourneyNode` ordering, and the legacy dungeon treasure room.

## §15.5
- Each item was a PR into `dev`, test-first, with a receipt. Step 4 added `smithingStonesRefined` if §14.4 had not landed.

## §16
- Original title: "Versioned JSON game profile (Feature/json-game-modules addendum, 2026-10-15)". Described as an addendum.
- Class special replaced by a weapon art: owner 2026-11-01. Attribute spending beyond rests: owner 2026-10-27.

## §15.3 (addendum)
- "Until §14.4 lands they show in the inventory" (refined stones): superseded, §14.4 has landed.
