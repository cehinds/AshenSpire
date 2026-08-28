# 0001 — Typed truth and authority

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: Main
- Initiative: `CQM-PHASE-2`

## Decision

- Project #4 `Status` owns workflow state.
- The ticket or issue owns outcome, acceptance, evidence, and decisions.
- Versioned repository documents own policy and contracts.
- Git commits, PRs, and CI own code and integration evidence.
- GitHub Pages owns hosted development evidence.
- Issue #183 is a reporting projection.
- Chats and local sessions are non-authoritative workspaces.

Main is the engineering integrator and sole decision/authority relay. Help Desk
owns routine intake, contract completeness, routing, lifecycle receipts, and
status hygiene. Missing or contradictory Project state is `unknown`; labels,
comments, issue state, or chat prose do not fill it in.

## Consequences

Reports must distinguish local, pushed, reviewed, integrated, hosted, resolved,
and released facts. A durable decision is recorded in the ticket and, when it
changes permanent policy, in this directory. Issue #183 may summarize those
facts but cannot become the workflow database.

## Rollback or supersession

Revert the bounded governance documentation series before activation, or append
a later decision that explicitly supersedes this record. Do not rewrite the
historical approval packet.
