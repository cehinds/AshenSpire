# JSON-driven game modules — continuation index

**Status: design documents delivered; runtime implementation pending.** The
modular runtime, module schemas, editor and JSON authoring/apply tools are future
work. Existing gameplay remains unchanged from source baseline
`3d40c190983069eec8d8a2370fb3f229ac376290`. `SPEC.md` still describes the live
runtime baseline; it does not mean the modular implementation exists.

The previous handoff documentation was committed as `49c5781fe`. The current
continuation work is documentation only. No PR has been created, and no feature
preview has been verified. Current profile progression makes only Reaver
selectable initially, then unlocks Starseer, Rogue and Herald after unique
completed full runs. Each rest visit offers one service—Strategize, Smith
or Level Up—and the chosen service fully restores HP/MP/SP and both flask
types. A past GitHub API query returned `Forbidden`; a branch push by itself
does not establish that Pages deployed a preview.

Check branch/status and this page’s status/release boundary first, then read the
documents in this order:

1. [Current source and core specification](CORE-SPEC.md) — current source
   inventory and the latest decisions for the playable Ashen core bundle,
   profile class unlocks and one-service rest flow.
2. [Implementation contract](IMPLEMENTATION.md) — module boundary, optional
   package behavior, compatibility and acceptance criteria.
3. [Pseudocode and package examples](PSEUDOCODE.md) — proposed data shapes,
   composition and runtime flows.
4. [Continuation handoff](CONTINUE.md) — paste-ready prompt, bounded next task,
   author workflow and delivery checks.

These documents specify future work. Proposed paths, APIs, schemas, commands and
checks must be verified against the current checkout unless explicitly marked
as existing entrypoints. Continue actions already authorized in the active
session without requesting the same authorization again; this handoff grants no
additional authority. A live instruction to continue or implement this plan
authorizes its next bounded slice.

The owner has explicitly set the release boundary: workers commit and push to
their own `origin/worker/json-game-modules/<task>` branches; the integrator
reviews and integrates onto `Feature/json-game-modules` and pushes that branch.
Do not merge or promote to `dev`, `test`, `release` or `main` until a later
explicit owner instruction. This overrides the standing contrary instructions
in `CLAUDE.md` and `CONTRIBUTING.md`.

**Handoff date:** October 14, 2026 (America/Anchorage). For current branch tip
and task status, run `git status --short --branch` and
`git log -1 --oneline --decorate`; never reuse a stale SHA.
