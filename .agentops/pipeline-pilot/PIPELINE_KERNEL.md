# Task pipeline pilot

Work moves through `intake -> ready -> executing -> review -> integrate ->
delivered -> closed`. A ticket may skip stages that its risk route does not
require.

Rules:

- A task node is the unit of execution. Teams are capability pools.
- `ready` nodes name a base ref but do not pin a base commit.
- Entering `executing` pins the current base commit and records one material
  event.
- Repository movement while a node remains `ready` creates no event.
- Only scope, ownership, execution, deliverable, review, blocker, protected
  transition, or closure changes are material events.
- A failed stage blocks only its node. Other ready nodes continue.
- Push, PR, merge, deployment, publication, release, destructive work, and QA
  overrides remain separately authorized protected transitions.

An agent cold-starts from the assigned node, the applicable authority fragment,
and the applicable risk route. It must not preload unrelated tickets or event
history.

The deterministic saturation fixture models concurrent tickets without
performing protected transitions. It verifies that every normal stage can be
occupied at once, freed execution capacity refills from the oldest eligible
ready node, dependencies wake exactly once, overlapping resource locks remain
serialized, and a full review stage applies backpressure without stopping
unrelated work.

When a seat's node reaches terminal review or closed, the scheduler immediately
offers that seat the highest-priority compatible READY node that has satisfied
dependencies, non-overlapping locks, sufficient authority, and review capacity.
It records `NO_SAFE_ASSIGNMENT` instead of forcing an unsafe match. A released
seat still unfilled beyond the configured threshold emits an idle-age alarm;
the alarm does not weaken eligibility rules or create a duplicate assignment.
