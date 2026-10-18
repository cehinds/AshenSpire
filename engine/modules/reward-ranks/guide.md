# Reward ranks module (`reward-ranks@1.0.0`)

Combat-card rewards are rank `minRank`+ except for a `lowerRankChance` per slot; rank comes from a card's `rank` or its rarity (`rankOfRarity`). `skipOwnedBasics` drops basic cards the character already owns. Off: rewards ignore rank.

Turn off from `game.json`: `{ "modules": { "reward-ranks": false } }`.
