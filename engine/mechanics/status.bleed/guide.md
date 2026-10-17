# Bleed (`status.bleed`)
Build-up status: points do not decay and burst for percent max HP at the threshold, then reset.
- Carried by: statuses on any entity; stacks add (decay: none). Numeric effect rows stay in `src/content/statuses.js`.
- Lives in: `src/engine/combatCardTactics.js`; portable service is `service.json` (ops `applyStatus`, `removeStatus`).
- Portability: portable for apply, remove and the `stacks` query (`{ f: 'stacks', of: 'target', status: 'bleed' }`).
