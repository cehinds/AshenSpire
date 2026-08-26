# Authority

Policy version: `1.0.0`

Decision: [0001 — Typed truth and authority](DECISIONS/0001-typed-truth-and-authority.md)

## Permanent control plane

- **Help Desk** owns routine intake, contract completeness, routing,
  acknowledgement, lifecycle receipts, and status hygiene. It does not become
  implementation, product, integration, publication, or release authority.
- **Main** is the engineering integrator and sole decision/authority relay.
  Main owns exceptions, scope and architecture decisions, contested ownership,
  unresolved blockers, integration rulings, and questions for Constantine.
- **Constantine** retains every authority reserved by repository policy,
  including release readiness and the release actions listed below.

Capability pools provide expertise. Temporary delivery pods perform bounded
tickets. Neither creates a competing decision channel.

## Authority matrix

| Action | Routine owner | Required evidence or authority |
|---|---|---|
| Record, triage, route, or report status | Help Desk | Complete ticket and truthful Project readback. |
| Implement locally | Named maker/pod lead | `CONTRACT READY`, explicit implementation scope, fresh base, exclusive paths. |
| Resolve ambiguity, scope, exception, ownership, architecture, or integration | Main | Decision packet and recorded answer. |
| Perform independent QA | Assigned non-maker QA | Frozen exact head and applicable gate contract. |
| Push, open/update PR, or mutate Project | Separately named authority | Explicit action-specific authority; local readiness does not imply it. |
| Integrate to `dev` | Main within recorded repository authority | Reviewed exact head, required QA, current base, branch rules. |
| Promote to `release`/`main`, tag, publish a release, or declare release readiness | Constantine | Separate release decision and release runbook. |
| Archive or delete a task, worktree, branch, artifact, or evidence | Main/user as applicable | Durable capture, exact targets, recovery consequence, explicit authority. |

## Decision and exception packets

A packet to Main contains:

1. `EVIDENCE` — exact current state, links, base/head, and conflict;
2. `OPTIONS` — two or three materially different choices when applicable;
3. `REC` — recommendation and trade-off;
4. `NEXT` — smallest action after the decision; and
5. `AUTH` — exact new authority required, or `No new authority`.

Routine status never needs to detour through Main. Work may continue on parts
that do not depend on an open decision, but ownership, scope, and shared paths
must not change until Main records the ruling.

## Delivery facts remain separate

`LOCAL`, `PUSHED`, `PR OPEN`, `REVIEWED`, `DEV INTEGRATED`, `HOSTED VERIFIED`,
`RESOLVED`, and `RELEASED` are not synonyms. Report only the states directly
proved by their typed owner. `RELEASED` remains separate from the ticket
lifecycle and does not follow automatically from `RESOLVED`.
