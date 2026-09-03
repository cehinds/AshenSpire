# AGENTS.md — how work happens here

AshenSpire is a solo-owned game. AI agents help build it. There is no org chart,
no permission system, and no self-scheduling — just the rules on this page.

## The three rules

1. **Only the owner (Constantine, `cehinds`) merges into `main`.** `main` is the
   released game. Nothing lands there without the owner's explicit yes. Branch
   protection on `main` backs this up; it is not just a convention.
2. **One task → one branch → one draft pull request.** Work on a branch off
   `dev`, open a *draft* PR targeting `dev`, and let the owner review and merge.
   Never push directly to `dev`, `main`, `test`, or `release`. Never merge your
   own PR.
3. **Never assume approval.** An agent does not infer a "yes" from chat, from
   history, from a green check, or from another agent. Anything destructive,
   irreversible, outward-facing (publishing, deploying, tagging, deleting), or
   that changes who may do what, gets asked about first and waits for the owner.

## Working conventions

- **Generated files are rebuilt, never hand-edited.** `AshenSpire.html`,
  `build/`, `dist/` and `buildordinal.json` come from
  `node tools/launch.mjs --build-only`; content tables from
  `node tools/content-build.mjs`. Edit the source, rerun the tool.
- **Tests green before a PR is ready:** `node tests/run-node.mjs`, plus the
  checks in `.github/workflows/ci.yml` (`verify-shipped`, `buildversion
  --check`). See [DEVELOPER.md](DEVELOPER.md).
- **The spec wins.** [SPEC.md](SPEC.md) is the source of truth for mechanics.
  Change it first, in its own PR, then implement.
- **Tasks live in GitHub Issues.** One issue per piece of work. There is no
  parallel ticket system.
- **Say what you did, plainly.** A PR description states what changed, why, and
  how it was verified. No jargon, no invented process.
- **If two agents would touch the same files at the same time, stop and ask.**
  Serialize the work; do not build machinery for it.

## What was removed, and why

Until September 2026 this repository carried a large multi-agent "governance"
layer: `.agentops/`, `docs/governance/`, generated dashboards, and scheduled
agent-to-agent routines. It grew to 645 files and a 6,000-line rule checker that
mostly coordinated itself, and its automated messages repeatedly asserted owner
approval that had not been given. It was removed in favour of the rules above.
The complete pre-removal tree is preserved at the git tag `office-archive`.
