# Enemy relics module (`enemy-relics@1.0.0`)

Enemies carry relics from `enemyRelics.json` (attribute points only, `self.<attribute|sp|mp|hp>=±N`; bonuses capped at `equipment.maxPoints` across `equipment.maxStats` attributes; penalties free and floored by the characters module). Off: enemies carry no relics.

Turn off from `game.json`: `{ "modules": { "enemy-relics": false } }`.
