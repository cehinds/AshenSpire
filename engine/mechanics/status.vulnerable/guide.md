# Vulnerable (`status.vulnerable`)
Takes 50% more attack damage. 1 stack expires each turn.
- Carried by: statuses on any entity; stacks add (decay: perTurnEnd). Numeric effect rows stay in `src/content/statuses.js`.
- Lives in: `src/engine/combatCardTactics.js`; portable service is `service.json` (ops `applyStatus`, `removeStatus`).
- Portability: portable for apply, remove and the `stacks` query (`{ f: 'stacks', of: 'target', status: 'vulnerable' }`).
