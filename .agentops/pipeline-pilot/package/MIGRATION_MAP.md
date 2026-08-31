# AgentOps to task-pipeline migration map

## Objective

Adopt the task pipeline one ticket at a time without replacing current
AgentOps authority, rewriting evidence, or forcing inactive assignments to
track every movement of the development branch.

## Mapping

| Current AgentOps concept | Pipeline target | Migration rule |
|---|---|---|
| `BOOTSTRAP.md` plus many governance contracts | stable `PIPELINE_KERNEL.md`, `AUTHORITY.json`, `RISK_ROUTES.json` | Extract only rules needed to start or protect a transition; retain old contracts as read-only sources until cutover. |
| `work/<ticket>/CURRENT.json` | `state/tasks/<ticket>/<node>.json` | Split a ticket into independently executable nodes. Do not migrate completed work into active state. |
| `leases/*.json` | node `resource_locks` | Acquire only when entering work; READY nodes hold no writer lock. |
| per-event JSON files | ticket `EVENTS.jsonl` | Import old chains as immutable history. Append only material scope, owner, execution, result, review, blocker, protected-transition, and closure changes. |
| role/team seat assignment | `required_capability`, owner, writer | Teams remain capability pools; create no durable event for an idle proposed seat. |
| one universal lifecycle | risk-selected route | Choose the smallest route that protects the actual hazard. |
| generated HUD/governance views | optional projections | Views remain non-authoritative and may be regenerated from task state. |
| provider-specific chat recovery | `startup/START_HERE.md` plus thin Codex/Claude pointers | A clean session reads one node and only its cited stable fragments. |

## Strangler sequence

1. Install the package locally without touching `.agentops/`.
2. Select one reversible ticket and express it as two to four task nodes.
3. Keep AgentOps as the authority boundary while the pipeline is observational.
4. Prove clean Codex and Claude reconstruction, resource serialization,
   dependency wake, review backpressure, and zero READY-head churn.
5. Reconcile the pilot result into the existing ticket once; do not duplicate
   its event history.
6. After owner approval, designate one source of current task truth and retain
   the former runtime as read-only history.
7. Migrate active tickets individually. Never bulk-convert stale or completed
   state.

## Upgrade and rollback

- Package versions use semantic versioning. Schemas carry their own version.
- A compatible upgrade must validate the current install hashes, stage the new
  package in a temporary sibling directory, validate it, then atomically swap.
- An incompatible schema change requires an explicit migration function and a
  pre-upgrade snapshot; it must not reinterpret history in place.
- Rollback is allowed only when installed files match the recorded hashes and
  no unlisted content exists under `.task-pipeline/`.
- Git history remains the durable recovery path after repository adoption; the
  local installer never commits, pushes, merges, publishes, or releases.

## Cutover decisions

The pilot needs no owner decision. A future live cutover does: choose the first
authoritative ticket, the date after which pipeline task state becomes current
truth, and which existing AgentOps projections become read-only.
