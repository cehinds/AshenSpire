# AshenSpire governance

Policy version: `1.0.0`

This directory is AshenSpire's small permanent governance control plane. It
defines who may decide, where each kind of truth lives, how work moves, what a
ticket must contain, and which quality evidence is required. Detailed delivery
procedures stay in focused runbooks and existing specialist documents.

## Policy set

- [Authority](AUTHORITY.md)
- [Team charters](TEAM-CHARTERS.md)
- [Workflow](WORKFLOW.md)
- [Quality gates](QUALITY-GATES.md)
- [Ticket schema](TICKET-SCHEMA.md)
- [Decision index](DECISIONS/README.md)
- [Runbook index](RUNBOOKS/README.md)

The [legacy coordination path](../COORDINATION-WORKFLOW.md) is a compatibility
entry point only. It must not grow a parallel copy of these rules.

## Deterministic activation

The governance lifecycle state is derived from recorded approval, independent
QA, and canonical branch containment; it is not a manually maintained literal:

- **Proposal** — IT Manager III approval is not recorded.
- **Approved** — IT Manager III approval is recorded, but there is no successful
  independent policy-QA head yet or that exact head is not contained in the
  fresh canonical `dev` head.
- **Active** — the exact governance head named by the successful independent
  policy-QA receipt is contained in the fresh canonical `dev` head.

Refresh the live GitHub `dev` SHA, then evaluate:

```text
git merge-base --is-ancestor <independently-reviewed-governance-head> <fresh-live-dev-sha>
exit 0 = Active
exit 1 = Approved
any other result = UNKNOWN and blocking
```

The ticket records the independently reviewed governance head and QA receipt.
No version, lifecycle, or status text is changed merely because integration
occurred. A later policy revision receives a new reviewed head and repeats the
same containment test.

## Typed truth

| Truth type | Canonical owner | What it proves |
|---|---|---|
| Workflow | Project #4 `Status` | Current lifecycle state. |
| Outcome, acceptance, decisions | Ticket or issue | Required result, approved scope, durable evidence, and decision references. |
| Policy and contracts | Versioned repository documents | Rules that apply to work. |
| Code and integration | Git commit, PR, and CI | Exact code, review, checks, and integration result. |
| Hosted development evidence | GitHub Pages | What exact deployed commit was hosted and verified. |
| Reporting projection | Issue #183 | Human-readable status and Daily Brief projection. |
| Workspace context | Chats and local sessions | Non-authoritative working material only. |

No lower row silently overrides a higher owner's fact. Missing or contradictory
Project state is `unknown`; issue labels, prose, or chat summaries do not infer
it. A local commit, pushed branch, merged PR, deployed preview, resolved ticket,
and release are separate facts.

## Change control

Every policy change has a ticket, an approved decision or delegated authority,
one documentation maker per path, independent policy QA, and a rollback
boundary. Decisions are appended under [DECISIONS](DECISIONS/README.md); an old
decision is superseded by a new record, not silently rewritten.

These documents grant no implementation, push, PR, merge, Project mutation,
publication, deployment, release, archive, or deletion authority.
