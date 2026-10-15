# JSON-driven game modules — continuation index

**Status: design documents delivered; runtime implementation pending.** These
files define and hand off a future architecture. No gameplay module loader,
runtime module schema, editor or JSON authoring CLI has been implemented or
verified. The live gameplay baseline is unchanged from `3d40c190983069eec8d8a2370fb3f229ac376290`.

The request began on `Feature/json-game-modules`, created and pushed from that
baseline. The parent session renamed its chat to match. This docs-only
continuation branch does not implement that feature. No PR has been created.
The feature preview has not been verified: the prior GitHub API query returned
`Forbidden`, and a branch push alone is not evidence that Pages deployed it.

Read these together:

- [Implementation contract](IMPLEMENTATION.md) — product boundary, module
  contract, optional-module behavior, compatibility and acceptance criteria.
- [Pseudocode and package examples](PSEUDOCODE.md) — proposed data shapes,
  module examples, validation and runtime flows.
- [Continuation handoff](CONTINUE.md) — paste-ready instructions, bounded next
  task, source survey, delivery rules and verification checklist.

The design is future work; paths, APIs, schemas, commands and acceptance checks
are proposals unless explicitly identified as existing repository entrypoints.
This handoff grants no additional authority. Continue actions already authorized
in the active session without requesting that authorization again; a live user
instruction to continue or implement this plan authorizes its next bounded slice.

The owner has explicitly set this release boundary: workers commit and push to
their own `origin/worker/json-game-modules/<task>` branches; the integrator
reviews and integrates onto `Feature/json-game-modules` and pushes that feature
branch. Do not merge or promote to `dev`, `test`, `release` or `main` until the
owner gives a future explicit instruction. This overrides the standing
merge/promotion text in `CLAUDE.md` and `CONTRIBUTING.md`.

**Handoff date:** October 14, 2026 (America/Anchorage). For current status and
branch head, run `git log -1 --oneline --decorate` in the active checkout; do
not copy a SHA from an earlier handoff.
