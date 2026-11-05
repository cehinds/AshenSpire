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
