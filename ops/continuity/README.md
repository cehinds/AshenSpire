# Repository continuity records

`ops/continuity` is the repository-native, read-only-by-default home for the
current coordination pointer and the small record graph it selects. It does
not import, replace, or silently supersede projectless Help Desk/team ledgers.

## Shape

- `POINTER.json` is the sole current coordination pointer. It selects one team,
  ticket, history tip, and evidence receipt by bounded relative path and SHA-256.
- `schemas/` retains versioned persisted coordination, feature-channel, and
  escalation shapes. V1 records remain readable; current records use V2.
- `teams/<team-id>/team.json` owns team identity and its active ticket IDs.
- `tickets/<ticket-id>/ticket.json` owns priority, status, owner, scope, and
  append-only history references for one ticket.
- `history/` is append-only. Each active ticket hash-locks its complete bounded
  frontier; a correction is a higher-sequence event naming its predecessor.
- `evidence/` is immutable after a pointer or history event names its hash. A
  correction is a versioned sibling with a new hash.
- `feature/<ticket>/` stores origin-backed DEV/TEST/RELEASE commit pointers,
  their append-only promotion history, and durable evidence—never copied trees.
- `escalation/` stores the three-seat blocker cell, deduplicated Help Desk
  queue, exact promotion guards, owner packets, attempts, age, wake, safe
  continuing work, and append-only escalation/closure history.
- `authority/`, canonical `tickets/`, `teams/`, plural `features/`, and
  `migrations/` provide the operating-model layout. The migration manifest is
  pointer-selected evidence and hash-locks compatibility projections. A
  projection contains only its canonical identity and `authoritySource`; it
  never copies current authority, lifecycle, assignment, or channel state.

## Update rule

1. Work in one named isolated branch/worktree with one writer.
2. Write new evidence and history records; do not edit referenced history.
3. Update every affected active ticket and its feature/escalation channel.
4. Replace `POINTER.json` last, with hashes of the exact selected files.
5. Run `node tools/continuity-reconcile.mjs` and its self-test.
6. Seal the local commit/tree and independent review before any integration.

The reconciler reads the selected pointer plus bounded complete active-ticket,
history, feature-channel, and escalation graphs. It rejects stale frontiers,
broken chains, duplicate authority, absolute/traversing paths, symbolic links,
hash or exact-schema drift, noncanonical lifecycle/blocker state, local-only
commit custody, and invalid revision promotions. It never migrates or repairs
records and never writes to the repository.
