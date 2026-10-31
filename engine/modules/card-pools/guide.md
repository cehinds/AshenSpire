# Card pools module (`card-pools@1.0.0`)

Default-deck pool keys (`{ "pool": "strike", "copies": 3 }`) resolve by class and the equipped weapon's gear-type tag through `cardPools.json`. Off: every pool gives its class default or `byTag.default`, whatever the weapon.

Turn off from `game.json`: `{ "modules": { "card-pools": false } }`.
