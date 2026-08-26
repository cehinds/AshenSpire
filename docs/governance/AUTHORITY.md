# Authority

Policy version: `1.0.0`

Decisions: [0001 — Typed truth and authority](DECISIONS/0001-typed-truth-and-authority.md),
[0005 — Dev delivery, promotion readiness, and Pages source](DECISIONS/0005-dev-delivery-promotion-and-pages.md),
[0007 — Standing coordination roles and completion council](DECISIONS/0007-standing-coordination-roles-and-completion-council.md),
[0008 — Capability-pool and review-station RACI](DECISIONS/0008-capability-pool-and-review-station-raci.md),
and [0009 — Promotion Gates A–F](DECISIONS/0009-promotion-gates-a-through-f.md)

## Permanent control plane

- **Help Desk** owns routine intake, contract completeness, routing,
  acknowledgement, lifecycle receipts, and status hygiene. It does not become
  implementation, product, integration, publication, or release authority.
- **Project Management Lead** owns portfolio and milestone recommendations,
  dependency/blocker/WIP/capacity visibility, completion councils, handoffs,
  risk/decision-log stewardship, promotion-readiness planning, and stakeholder
  summaries. It recommends; it does not decide technical assignment or
  integration.
- **Data Architecture & Systems Lead** owns schema/ID/alias/deprecation,
  source-generator-projection lineage, migration/version/compatibility,
  generated manifests, save/content/data quality, and cross-domain data-contract
  review. It may `WITHHOLD` an unsafe data contract with exact evidence.
- **IT Manager III, Integration & Delivery** is the mandatory technical relay
  and the role formerly named `Main`. It owns exceptions, technical scope and
  architecture reconciliation, technical sequencing, path/maker ownership,
  contested ownership, unresolved technical blockers, incident/P0 command,
  integration and delivery gates, and questions for Constantine.
- **Constantine** retains every authority reserved by repository policy,
  including `main`/`release`, tags, publication, Pages, final release readiness,
  and the release actions listed below.

Capability pools provide expertise. Temporary delivery pods perform bounded
tickets. Standing coordination roles do not silently gain implementation paths
or product, board, promotion, publication, or release authority.

## Authority matrix

| Action | Routine owner | Required evidence or authority |
|---|---|---|
| Record, triage, route, or report status | Help Desk | Complete ticket and truthful Project readback. |
| Implement locally | Named maker/pod lead | `CONTRACT READY`, explicit implementation scope, fresh base, exclusive paths. |
| Recommend portfolio/milestone sequencing, expose dependencies/WIP/capacity, convene completion councils, or summarize stakeholders | Project Management Lead | Current ticket/Project evidence, risk/decision log, and recommendation; no technical assignment or integration mutation. |
| Review a cross-domain data contract or withhold an unsafe one | Data Architecture & Systems Lead | Exact invariant, schema/ID/lineage/version/compatibility evidence, affected paths, and smallest safe correction. |
| Resolve technical ambiguity, scope, exception, ownership, architecture, assignment, sequencing, or integration | IT Manager III | Decision packet and recorded answer, including Data Architecture clearance or exact authority for an exception to any `WITHHOLD`. |
| Perform independent QA | Assigned non-maker QA | Frozen exact head and applicable gate contract. |
| Sequence competing QA lanes | Temporary QA Coordination Pool chaired by IT Manager III | Recorded collision, serialized resource, reviewer availability, and order; reviewers retain sole verdict authorship. |
| Perform Delivery Systems Review | IT Manager III with CQM, Data Architecture, and Platform consultation | Exact lineage, generated-lane, tooling/dependency, integration/deployment, evidence, and rollback findings; no remote mutation follows automatically. |
| Push a genuinely independent completed topic head and open/update its normal PR to `dev` | IT Manager III at its discretion under [0005](DECISIONS/0005-dev-delivery-promotion-and-pages.md), or separately named authority | Itemized independence `PASS`, immutable exact head, required QA/gates, fresh base/head/PR/mergeability, unchanged scope, and recorded evidence. |
| Integrate to `dev` through the normal reviewable PR process | IT Manager III at its discretion under [0005](DECISIONS/0005-dev-delivery-promotion-and-pages.md) | The same `PASS` evidence plus current required review and CI. `READY FOR MAIN` creates no duty to deliver. |
| Mutate Project | Separately named authority | Explicit action-specific authority; local readiness does not imply it. |
| Fast-forward `test` to the exact hosted-verified `dev` SHA | IT Manager III under Gate C of [0009](DECISIONS/0009-promotion-gates-a-through-f.md) | Gates A/B passed and fresh; exact SHA equality; true fast-forward; rollback/protection/mutation evidence; no blocking P0/P1 `WITHHOLD`, missing reviewer, stale evidence, or mismatch. This is non-release. |
| Record five-role exact-test acceptance | QA1, QA2, assigned Development Lead, IT Manager III, and Project Management Lead; conditional reviewers under Gate D | Separate exact-SHA recommendations, known-defect ledger, and no P0/P1 `WITHHOLD`; accepted P2 has disclosure, owner, milestone, risk, and accepting authority. |
| Perform exact-test playtest | Constantine | Gate D passed at the unchanged `test` SHA; exact build/artifact/flow evidence and known accepted defects. |
| Mutate `release`/`main`, change Pages source, tag, publish a release, or declare final release readiness | Constantine | Separate action-specific exact-SHA decision, complete Gate-F promotion/rollback packet, and release runbook. |
| Archive or delete a task, worktree, branch, artifact, or evidence | IT Manager III/user as applicable | Durable capture, exact targets, recovery consequence, explicit authority. |

## Decision and exception packets

A packet to the IT Manager III contains:

1. `EVIDENCE` — exact current state, links, base/head, and conflict;
2. `OPTIONS` — two or three materially different choices when applicable;
3. `REC` — recommendation and trade-off;
4. `NEXT` — smallest action after the decision; and
5. `AUTH` — exact new authority required, or `No new authority`.

Routine status never needs to detour through the IT Manager III. Work may
continue on parts that do not depend on an open decision, but ownership, scope,
and shared paths must not change until the IT Manager III records the ruling.

## Delivery facts remain separate

`LOCAL`, `PUSHED`, `PR OPEN`, `REVIEWED`, `DEV INTEGRATED`, `HOSTED VERIFIED`,
`RESOLVED`, and `RELEASED` are not synonyms. Report only the states directly
proved by their typed owner. `RELEASED` remains separate from the ticket
lifecycle and does not follow automatically from `RESOLVED`.
