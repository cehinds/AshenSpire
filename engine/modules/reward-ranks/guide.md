# Reward ranks module (`reward-ranks@1.0.0`)

Combat-card rewards are rank `minRank`+ except for a `lowerRankChance` per slot; rank comes from a card's `rank` or its rarity (`rankOfRarity`). `skipOwnedBasics` drops basic cards the character already owns. Off: rewards ignore rank.

Turn off from `game.json`: `{ "modules": { "reward-ranks": false } }`.

`stanceCoverage` (owner, 2026-10-19): while the character owns no card of some basic stance (deck plus collection; the stances are the `stances` module's `include`), each card offer reserves `reservedSlots` slots for a card of a missing stance, restricted to the `preferTiers` versions: `basic` is a card named by a `cardPools` entry (not in `excludePools`), `cantrip` is a card tagged `rank.cantrip`. A stance with no such card is skipped. Once every stance is owned, or none has a candidate, offers roll as before. `enabled: false` turns it off (the Core 1 bundle does).
