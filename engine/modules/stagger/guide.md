# Stagger module (`stagger@1.0.0`)

Poise break penalty on a character: lose `spLoss` SP next turn and gain `stacks` of `status` (Vulnerable 1: +25% damage taken). Data only until the combat adapter reads it.

`poise` (default `true`): `false` empties every Poise pool and meter, so `poiseDamage` does nothing and no Poise break staggers anyone.
With `poise` off, physical statuses such as Bleed land at once: no Poise meter holds their buildup back.

Turn off from `game.json`: `{ "modules": { "stagger": false } }`.
