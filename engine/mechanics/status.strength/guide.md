# Strength (`status.strength`)
Attacks deal +1 damage per stack.
- Carried by: statuses on any entity; stacks add (decay: none). Numeric effect rows stay in `src/content/statuses.js`.
- Lives in: `src/model/ashenBlight.js`; portable service is `service.json` (ops `applyStatus`, `removeStatus`).
- Portability: portable for apply, remove and the `stacks` query (`{ f: 'stacks', of: 'target', status: 'strength' }`).
