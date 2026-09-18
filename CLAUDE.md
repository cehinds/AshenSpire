# CLAUDE.md

How work is branched, reviewed, and merged is in
[CONTRIBUTING.md](CONTRIBUTING.md). Build and test commands are in
[DEVELOPER.md](DEVELOPER.md); game mechanics are governed by [SPEC.md](SPEC.md).

**Before opening or finishing any pull request, read *A pull request is not
done until the owner can merge it with one click* in CONTRIBUTING.md** — it is
the owner's standing rule for every session: reviewed by another agent or
session, conflicts resolved by you, tests green, re-checked after every merge
to the base until it lands.

(`AGENTS.md` used to hold the working rules and was removed at the owner's
request in `cef8ed00`. The coordination rules it carried — one task per branch,
draft pull requests into `dev`, and only the owner merging to `main` — live in
CONTRIBUTING.md under *Coordination and release boundary* and *Branch model*.)

How AI work is routed between models, efforts, and subagents is in
[docs/ai/AI-ROUTING.md](docs/ai/AI-ROUTING.md); the owner's Forge working mode
(guided learning vs. builder mode, context and memory handling) is in
[docs/ai/FORGE-OPERATING-INSTRUCTIONS.md](docs/ai/FORGE-OPERATING-INSTRUCTIONS.md).
Both are advisory and never override SPEC.md, CONTRIBUTING.md, or DEVELOPER.md.
