# Repository task pipeline

Work moves through `intake`, `ready`, `executing`, risk-selected review and
integration, then `delivered` and `closed`. A task node is the unit of work.

- READY records a moving base ref, not a commit or writer lock.
- EXECUTING pins one base commit, one writer, and necessary resource locks.
- Record only material scope, ownership, execution, deliverable, review,
  blocker, protected-transition, or closure changes.
- A failed or waiting node does not stop independent nodes.
- Terminal review or closure releases the seat and triggers one immediate
  highest-priority safe refill. Dependencies, locks, authority, and review
  capacity remain hard eligibility filters. Record `NO_SAFE_ASSIGNMENT` when
  none qualifies and emit an idle-age alarm only after the configured delay.
- Protected Git, destructive, security/privacy, QA-override, publication,
  deployment, and release actions require separate authority.
- Stable rules, current task state, and disposable startup packets never copy
  one another.
