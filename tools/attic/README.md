# tools/attic/

Tools that nothing in the repo references, moved here from `tools/` by the owner's ruling of 2026-10-17. They were moved, not deleted, and their imports still resolve (they point back at `tools/` and `tools/lib/`; root paths go up one more level). A tool that names its own path (a self-test that re-runs itself, a ceiling list) names `tools/attic/<name>.mjs` now; restoring it means changing that back too.
To bring a tool back, `git mv tools/attic/<name>.mjs tools/<name>.mjs`, undo the extra `../` in its imports and root paths, and add a row to `tools/README.md`.
Nothing in CI, the test runner or any workflow runs from this folder, and it holds no `*.test.mjs` files.
The index of these tools is the Attic section of `tools/README.md`.
