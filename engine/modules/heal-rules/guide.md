# Heal rules module (`heal-rules@1.0.0`)

Tag-matched heal shapes for any card with `fx:heal`: `fx:heal` costs 3 SP + 2 MP and heals 10% max HP; with `lifecycle.exhaust` it costs 1 SP + 1 MP and exhausts. Most specific match wins. The build checks every heal card's cost against its shape. Off: heal cards are not cost-checked.

Turn off from `game.json`: `{ "modules": { "heal-rules": false } }`.
