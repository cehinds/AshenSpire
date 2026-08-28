# Repository continuity records

`ops/continuity` is the repository-native, read-only-by-default home for the
current coordination pointer and the small record graph it selects. It does
not import, replace, or silently supersede projectless Help Desk/team ledgers.

## Shape

- `POINTER.json` is the sole current pointer. It selects one team, ticket,
  history event, and evidence receipt by bounded relative path and SHA-256.
- `schemas/` defines the persisted pointer, team, ticket, and history shapes.
- `teams/<team-id>/team.json` owns team identity and its active ticket IDs.
- `tickets/<ticket-id>/ticket.json` owns priority, status, owner, scope, and
  append-only history references for one ticket.
- `history/` is append-only. A correction is a new higher-sequence event that
  names what it supersedes; an existing event is never rewritten.
- `evidence/` is immutable after a pointer or history event names its hash. A
  correction is a versioned sibling with a new hash.

## Update rule

1. Work in one named isolated branch/worktree with one writer.
2. Write new evidence and history records; do not edit referenced history.
3. Update the team/ticket records.
4. Replace `POINTER.json` last, with hashes of the exact selected files.
5. Run `node tools/continuity-reconcile.mjs` and its self-test.
6. Seal the local commit/tree and independent review before any integration.

The reconciler reads only the graph selected by `POINTER.json`. It rejects
absolute/traversing paths, symbolic links, hash drift, schema-version drift,
and team/ticket/history cross-link disagreement. It never migrates or repairs
records and never writes to the repository.
