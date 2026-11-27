# Tests

Game and tool tests live in `tests/`. The authoring apps (Pose Studio,
Workbench, editor, UI Studio) and their suites live on the `tools-archive`
branch.

From the repository root, `npm test` runs the fast core lane and
`npm run test:all` runs the full Node test gate through
[`run-node.mjs`](run-node.mjs). A focused test can be run with
`node --test tests/<name>.test.mjs`. The browser engine harness is
[`index.html`](index.html); its test list is derived from `engine.test.js`.

For validation/build commands and CI stage details, use
[`DEVELOPER.md`](../DEVELOPER.md#run-test). For how source, tests and tools fit
together, see the [architecture map](../docs/ARCHITECTURE-MAP.md).

## Authored content and mechanics contracts

Current decks, weights, rarity/rank bands, item pools and prices belong to their
authoritative JSON. Integration tests compare that source with generated data,
registries and actual runs, including recipe copy counts and equipment grants.
Keep the generated-output freshness checks: a JSON edit still needs its build.
Do not pin today's catalog size, named starter composition, item score or combat
result to an earlier balance pass.

Use small explicit scenarios for precise formulas, rounding, RNG order and combat
outcomes. Set the cards, enemies and relevant rule operands deliberately; do not
copy an old game catalog or scoring table to preserve incidental expectations.
Keep behavior assertions: displayed prices equal quotes and payments, operations
change only intended fields, caches refresh, source data stays immutable, and
upgrades, exports and saves retain their definitions. Performance limits and
security/refusal checks remain gates.

Recorded save/profile fixtures have a different contract. Preserve their original
bytes, provenance and strict validation, and assert their historical behavior
against the recorded profile. A test using today's defaults is not a historical
compatibility test merely because it has an old capture.

Examples: `core-starting-decks.test.mjs` checks JSON recipes and actual run births;
`combat-power.test.mjs` checks current score-table membership and freshness;
`card-copy-rank-price.test.mjs` checks displayed quotes and payment; the helpers
`scoring-contract.mjs`, `reward-contract.mjs` and `matchup-contract.mjs` supply
explicit mechanics operands. Keep current-content integration alongside a
controlled mechanics test whenever its inputs have been isolated this way.
