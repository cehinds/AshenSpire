# Heal (`fx:heal`)
Restores HP to a target, never past its max HP.
- Carried by: cards and characters tagged `fx:heal`; the `heal-rules` module cost-checks heal cards and stays in that module.
- Lives in: `src/engine/actions.js` (`runOpcode`, case `heal`); portable service is `service.json` (op `heal`).
- Portability: portable. Query `healAmount` gives a percent-of-max-HP heal.
