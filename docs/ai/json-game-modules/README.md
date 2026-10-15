# JSON-driven game modules — continuation index

**Status: architecture and implementation are not yet present.** The files in
this directory are planning and handoff material only. No gameplay, module
loader, module schema, editor or JSON authoring CLI has been implemented or
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

All three files describe a future design. Paths, APIs, schemas, commands and
acceptance checks in them are proposals unless they are explicitly identified as
existing repository entrypoints. Do not treat a handoff prompt as new authority
to implement or publish the feature: continue implementation only when the live
user authorizes it in the active task.

The owner has explicitly set this release boundary: work may be committed,
pushed and integrated only on `origin/Feature/json-game-modules`. Do not merge
or promote to `dev`, `test`, `release` or `main` until the owner gives a future
explicit instruction. That current instruction overrides the standing
merge/promotion text in `CLAUDE.md` and `CONTRIBUTING.md`.

**Handoff date:** October 14, 2026 (America/Anchorage). For current status and
branch head, run `git log -1 --oneline --decorate` in the active checkout; do
not copy a SHA from an earlier handoff.
