# Workflow

Policy version: `1.0.0`

Decisions: [0002 — Lifecycle and legacy mapping](DECISIONS/0002-lifecycle-and-legacy-mapping.md),
[0005 — Dev delivery, promotion readiness, and Pages source](DECISIONS/0005-dev-delivery-promotion-and-pages.md),
[0006 — Adaptive model and effort selection](DECISIONS/0006-adaptive-model-and-effort-selection.md),
[0007 — Standing coordination roles and completion council](DECISIONS/0007-standing-coordination-roles-and-completion-council.md),
[0008 — Capability-pool and review-station RACI](DECISIONS/0008-capability-pool-and-review-station-raci.md),
and [0009 — Promotion Gates A–F](DECISIONS/0009-promotion-gates-a-through-f.md)

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
| `WAITING ON MAIN` | `WAITING ON DECISION`, `decision_owner: IT Manager III`; `Main` is retained only as the legacy value. |
| `WAITING ON CONSTANTINE` | `WAITING ON DECISION`, `decision_owner: Constantine`, routed through the IT Manager III. |
| `CLOSED` | Decide explicitly between `RESOLVED` and `CANCELLED`; do not preserve as an ambiguous terminal synonym. |
| `RELEASED` | Record as a separate release fact, never a workflow replacement. |

Historical entries keep their original text and gain a mapped canonical event;
do not rewrite old evidence to make it appear that the new lifecycle already
existed.

## Ticket flow and receipts

1. Help Desk records, triages, and completes the ticket contract.
2. The Project Management Lead supplies portfolio, milestone, dependency, WIP,
   capacity, handoff, and risk recommendations. The Data Architecture & Systems
   Lead reviews applicable cross-domain data contracts and may record
   `WITHHOLD` when unsafe.
3. The IT Manager III decides technical exceptions, scope/architecture choices,
   technical sequencing, path/maker ownership, blockers, integration, and new
   authority routing. Help Desk assigns a temporary pod only after the decision
   is recorded at `CONTRACT READY`; the lead acknowledges before ownership is
   active.
   A numbered assignment `#7` or later cannot enter `ASSIGNED` until acceptance,
   dependencies, exact base, exclusive paths, and QA requirements are recorded.
4. Every assignment or reassignment records `MODEL | EFFORT | WHY | ESCALATE
   WHEN`. The pairing is risk-and-station based, not rank based. It remains
   fixed for the active turn unless an escalation receipt authorizes the change;
   `max` effort includes an exceptional reason.
5. The maker implements one ticket from a fresh base in the named isolated
   lane and returns `TICKET|STATUS|OUTCOME / PATH|BASE|HEAD|CLEAN / EVIDENCE /
   BLOCK / NEXT / MODEL|EFFORT|WHY|ESCALATE WHEN / AUTH` receipts.
6. The candidate freezes once. Functional QA, then Experience QA when
   applicable, use the same head. A changed candidate reopens verification.
7. At `READY FOR MAIN`, the Project Management Lead convenes the completion
   council. Every lead sends Help Desk and the IT Manager III available
   independent work, dependencies/path or serialized-lane overlap,
   recommendation, smallest next action, and exact authority. No lead silently
   self-assigns a shared path.
8. The IT Manager III records the itemized independence result and
   chooses `WAIT` or normal-PR delivery to `dev` under
   [0005](DECISIONS/0005-dev-delivery-promotion-and-pages.md). A `PASS` permits
   discretion; it does not create a duty. `FAIL` or `UNKNOWN` requires `WAIT`.
   Every wait records its rationale and retry trigger.
9. Help Desk records each resulting fact without collapsing integration,
   hosting, resolution, promotion-packet readiness, or release.
10. At `RESOLVED`, the Project Management Lead repeats the completion council
    so independent work, overlaps, dependencies, recommendation, and authority
    remain visible without creating an assignment.

Cross-family handoffs retain distinct `SENT`, `RECEIVED`, and `ACKNOWLEDGED`
events. A failed transport does not prove receipt or acceptance and must not
create a duplicate assignment.

New implementation routes through Feature / Architecture or Incident / Defect
capability pools and temporary pods. `App Team2`, `IT Support2`, and `IT
Support3` remain legacy task labels only; existing bounded lanes survive until
closure or explicit reassignment. A temporary Experience & Accessibility Review
pool may assist applicable tickets. When QA lanes compete, an IT Manager
III-chaired QA Coordination Pool may sequence resources, but independent
reviewers alone author and retain their verdicts.

## Promotion readiness

Promotion follows [Gates A–F](DECISIONS/0009-promotion-gates-a-through-f.md):

1. **A — candidate QA:** required independent QA and gates pass at one exact
   frozen candidate.
2. **B — dev and hosted:** integrate that exact head to `dev` through the
   normal reviewable PR process, then hosted-verify the exact resulting `dev`
   SHA.
3. **C — test fast-forward:** the IT Manager III may fast-forward `test` only
   to that exact hosted-verified `dev` SHA when every Gate-C condition passes.
   This is a non-release promotion.
4. **D — exact-test acceptance:** QA1, QA2, assigned Development Lead, IT
   Manager III, and Project Management Lead each record a recommendation at the
   unchanged `test` SHA. Data, Experience & Accessibility, and Delivery Systems
   reviewers join when their surfaces apply.
5. **E — Constantine playtest:** Constantine playtests that unchanged exact
   `test` SHA after Gate D passes.
6. **F — main/release actions:** Constantine separately approves and performs
   each exact-SHA `main`, `release`, tag, publication, Pages, and final
   release-readiness action.

Never advance `test` alone while a candidate is ahead of `dev`. A
code/content/configuration/artifact change resets Gate A. Any changed `test`
head invalidates prior Gate-D acceptance and Gate-E playtest evidence. P0/P1
`WITHHOLD` blocks; an accepted P2 remains disclosed, owned, risked, and assigned
to a target milestone. Promotion gates are delivery facts, not new lifecycle
states, and do not collapse `DEV INTEGRATED`, `HOSTED VERIFIED`, `RESOLVED`, or
`RELEASED`.

## Context and repository hygiene

Chats are non-authoritative. Before recommending archive, deletion, branch or
worktree removal, capture durable decisions/evidence and record task ID, ticket,
owner, last verified SHA/time, dirty or unpushed state, duplicate/superseded
link, recommendation, recovery consequence, and authority state. No archive or
deletion occurs without IT Manager III/user authority for exact targets.

Generated root/build/dist HTML and `buildordinal.json` have one serialized
writer. Settle source authority, freeze source, regenerate once, verify
provenance and byte identity, and never hand-resolve generated output.
