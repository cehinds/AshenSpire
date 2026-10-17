# Exhaust (`lifecycle.exhaust`)
An exhausted card moves from the hand to the exhaust pile and stays out for the combat.
- Carried by: cards tagged `lifecycle.exhaust`; cases keep card ids in the top-level `piles.hand` and `piles.exhaust`; the op moves from the front of the hand.
- Lives in: `src/engine/actions.js` (`runOpcode`, case `exhaust`); portable service is `service.json` (op `exhaust`).
- Portability: portable. The `heal-rules` module reads this tag for the cheaper exhausting heal shape.
