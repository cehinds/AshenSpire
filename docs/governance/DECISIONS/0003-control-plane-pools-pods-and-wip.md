# 0003 — Control plane, pools, pods, routing, and WIP

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: Main
- Initiative: `CQM-PHASE-2`

## Decision

- Main and Help Desk are the small permanent control plane.
- Capability pools supply Art / Tech Art, Engineering, Game Systems,
  Experience Design, QA Guild, and Platform / Release expertise.
- Each contract-ready ticket forms a temporary lead-owned pod with at most
  three helpers and one consolidated receipt.
- Routine intake/status and normal capability routing go to Help Desk.
- Decisions, exceptions, scope/architecture choices, contested ownership,
  unresolved blockers, and integration rulings go to Main.
- WIP is limited to one Main integration item, one active implementation per
  maker, one serialized generated-artifact/browser/Pages lane, and zero
  overlapping path claims.
- Idle capacity performs read-only maintenance; it does not create unassigned
  implementation.

## Consequences

Pools do not become standing teams or parallel authorities. Help Desk can route
work but cannot silently change scope or shared-path ownership. A pod dissolves
after its handoff or cancellation. Its chat remains a workspace, not durable
truth.

## Rollback or supersession

Revert the bounded governance documentation series before activation, or append
a later decision that explicitly changes roles/WIP and includes an ownership
migration plan.
