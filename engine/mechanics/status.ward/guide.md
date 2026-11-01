# Ward (`status.ward`)
While Ward is above 0, all damage goes to Poise first, then Block, then HP. Lose 1 stack at the start of your turn.
- Carried by: statuses on any entity.
- Lives in: `src/engine/actions.js` (`gainMeterGuard`).
- Portability: legacy (service.json is empty until the behaviour moves to catalog ops).
