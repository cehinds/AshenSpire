# Workflow

Policy version: `1.0.0`

Decision: [0002 — Lifecycle and legacy mapping](DECISIONS/0002-lifecycle-and-legacy-mapping.md)

## Lifecycle

```text
NEW → TRIAGED → CONTRACT READY → ASSIGNED → IN PROGRESS
    → CANDIDATE FROZEN → FUNCTIONAL QA
    → EXPERIENCE QA (when applicable) → READY FOR MAIN
    → DEV INTEGRATED → HOSTED VERIFIED → RESOLVED
```

Side states are `WAITING ON DECISION`, `BLOCKED`, `STALE`, and `CANCELLED`.
`RELEASED` is a separate release fact.

| State | Entry contract |
|---|---|
| `NEW` | Intake exists with a stable ticket ID and requested outcome. |
| `TRIAGED` | Type, risk, affected surfaces, and routing are known. |
| `CONTRACT READY` | Acceptance, dependencies, fresh base, exclusive paths, tests, QA stages, rollback, and exact authority are recorded. |
| `ASSIGNED` | Named lead/maker acknowledged the contract. |
| `IN PROGRESS` | Authorized bounded implementation is underway. |
| `CANDIDATE FROZEN` | Exact candidate head and evidence set are fixed for QA. Any product/code/content change returns to `IN PROGRESS`. |
| `FUNCTIONAL QA` | Independent non-maker verifies behavior, contracts, regression plants, and required gates at the frozen head. |
| `EXPERIENCE QA` | When applicable, independent review covers player-visible UI, art, audio, feel, accessibility, inputs, and representative viewports. |
| `READY FOR MAIN` | Every required QA stage passed at the same frozen head; this is not push, merge, hosted, or release evidence. |
| `DEV INTEGRATED` | Canonical `dev` contains the approved change at an exact commit. |
| `HOSTED VERIFIED` | When applicable, Pages/deployment records and runtime evidence match the exact integrated commit. |
| `RESOLVED` | The ticket outcome and evidence are durably captured; no required work remains. |

`WAITING ON DECISION` names the decision owner and packet. `BLOCKED` names the
blocking condition, owner, retry trigger, and safe work that can continue.
`STALE` means evidence or ownership is too old/ambiguous to act on and must be
refreshed. `CANCELLED` records why the requested outcome will not proceed and
what work/evidence remains.

For governance policy, `DEV INTEGRATED` also supplies the containment fact used
by [deterministic activation](README.md#deterministic-activation): the policy is
Active when fresh canonical `dev` contains the exact successful independent
policy-QA head. No merge-time version or status-text mutation is required.

## Legacy mapping

| Legacy value | Canonical treatment |
|---|---|
| `READY FOR QA` | Transition through `CANDIDATE FROZEN`, then `FUNCTIONAL QA`. |
| `WAITING ON MAIN` | `WAITING ON DECISION`, `decision_owner: Main`. |
| `WAITING ON CONSTANTINE` | `WAITING ON DECISION`, `decision_owner: Constantine`, routed through Main. |
| `CLOSED` | Decide explicitly between `RESOLVED` and `CANCELLED`; do not preserve as an ambiguous terminal synonym. |
| `RELEASED` | Record as a separate release fact, never a workflow replacement. |

Historical entries keep their original text and gain a mapped canonical event;
do not rewrite old evidence to make it appear that the new lifecycle already
existed.

## Ticket flow and receipts

1. Help Desk records, triages, and completes the ticket contract.
2. Main decides only exceptions, scope/architecture choices, contested
   ownership, blockers, integration, and new authority.
3. Help Desk assigns a temporary pod after `CONTRACT READY`; the lead
   acknowledges before ownership is active.
4. The maker implements one ticket from a fresh base in the named isolated
   lane and returns `TICKET|STATUS|OUTCOME / PATH|BASE|HEAD|CLEAN / EVIDENCE /
   BLOCK / NEXT / AUTH` receipts.
5. The candidate freezes once. Functional QA, then Experience QA when
   applicable, use the same head. A changed candidate reopens verification.
6. Main performs or authorizes integration only after `READY FOR MAIN` and a
   current-base check. Help Desk records each resulting fact without collapsing
   integration, hosting, resolution, or release.

Cross-family handoffs retain distinct `SENT`, `RECEIVED`, and `ACKNOWLEDGED`
events. A failed transport does not prove receipt or acceptance and must not
create a duplicate assignment.

## Context and repository hygiene

Chats are non-authoritative. Before recommending archive, deletion, branch or
worktree removal, capture durable decisions/evidence and record task ID, ticket,
owner, last verified SHA/time, dirty or unpushed state, duplicate/superseded
link, recommendation, recovery consequence, and authority state. No archive or
deletion occurs without Main/user authority for exact targets.

Generated root/build/dist HTML and `buildordinal.json` have one serialized
writer. Settle source authority, freeze source, regenerate once, verify
provenance and byte identity, and never hand-resolve generated output.
