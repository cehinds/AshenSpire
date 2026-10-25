# Reward ranks module (`reward-ranks@1.0.0`)

Combat-card rewards are rank `minRank`+ except for a `lowerRankChance` per slot; rank comes from a card's `rank` or its rarity (`rankOfRarity`). `skipOwnedBasics` drops basic cards the character already owns. Off: rewards ignore rank.

Turn off from `game.json`: `{ "modules": { "reward-ranks": false } }`.

`stanceCoverage` (owner, 2026-10-19): while the character owns no card of some basic stance (deck plus collection; the stances are the `stances` module's `include`), each card offer reserves `reservedSlots` slots for a card of a missing stance, restricted to the `preferTiers` versions: `basic` is a card named by a `cardPools` entry (not in `excludePools`), `cantrip` is a card tagged `rank.cantrip`. A stance with no such card is skipped. Once every stance is owned, or none has a candidate, offers roll as before. `enabled: false` turns it off (the Core 1 bundle does).

Weighted card pick (owner, 2026-10-24): a rank-eligible card is drawn with weight `tagWeight × ownedCopyWeight^owned`, in one seeded roll. `owned` counts copies in the deck plus sideboard, so `ownedCopyWeight` (0 to 1, Core 0.35) makes repeat copies rarer; 1 turns the penalty off. `tagWeights` maps a card tag to a weight (a card takes the product of its matching tags, else `default`, else 1): Core weighs casting 1 and every other card 3, with the single-card stances (Smash, Counter, Sweep) at 5, so the basic stances show up beside the ~45 casting cards.
