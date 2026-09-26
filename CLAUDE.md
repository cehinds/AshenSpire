# CLAUDE.md

How work is branched, reviewed, and merged is in
[CONTRIBUTING.md](CONTRIBUTING.md). Build and test commands are in
[DEVELOPER.md](DEVELOPER.md); game mechanics are governed by [SPEC.md](SPEC.md).

**Before opening or finishing any pull request, read [A pull request is not
done until the owner can merge it with one click](CONTRIBUTING.md#a-pull-request-is-not-done-until-the-owner-can-merge-it-with-one-click)** — it is
the owner's standing rule for every session: reviewed by another agent or
session, conflicts resolved by you, tests green, re-checked after every merge
to the base until it lands.

**When you need the owner to decide or do something**, ask in this shape, and
nothing longer (owner's rule, 2026-09-26):

- One bullet per question, one line each, ending in the answer you need
  (yes/no, A or B, or the exact thing to do).
  - One sub-bullet for why it matters: what it changes, or what is blocked
    until it is answered.

No paragraphs, no preamble. Put the detail in the PR or a linked file, not in
the question.

(`AGENTS.md` used to hold the working rules and was removed at the owner's
request in `cef8ed00`. The coordination rules it carried — one task per branch,
pull requests into `dev` opened ready for review, and only the owner merging to
`main` — live in CONTRIBUTING.md under *Coordination and release boundary*,
*Branch model* and *Commits & PRs*.)

How AI work is routed between models, efforts, and subagents is in
[docs/ai/AI-ROUTING.md](docs/ai/AI-ROUTING.md); the owner's Forge working mode
(guided learning vs. builder mode, context and memory handling) is in
[docs/ai/FORGE-OPERATING-INSTRUCTIONS.md](docs/ai/FORGE-OPERATING-INSTRUCTIONS.md).
Both are advisory and never override SPEC.md, CONTRIBUTING.md, or DEVELOPER.md.
