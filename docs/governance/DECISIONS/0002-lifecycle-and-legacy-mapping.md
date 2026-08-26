# 0002 — Lifecycle and legacy mapping

- Status: **Approved**
- Effective: upon authorized canonical merge
- Decision owner: Main
- Initiative: `CQM-PHASE-2`

## Decision

The canonical lifecycle is:

```text
NEW → TRIAGED → CONTRACT READY → ASSIGNED → IN PROGRESS
    → CANDIDATE FROZEN → FUNCTIONAL QA
    → EXPERIENCE QA (when applicable) → READY FOR MAIN
    → DEV INTEGRATED → HOSTED VERIFIED → RESOLVED
```

Side states are `WAITING ON DECISION`, `BLOCKED`, `STALE`, and `CANCELLED`.
`RELEASED` remains a separate release fact.

Legacy mapping is:

- `READY FOR QA` → `CANDIDATE FROZEN` then `FUNCTIONAL QA`;
- `WAITING ON MAIN` → `WAITING ON DECISION` with Main as decision owner;
- `WAITING ON CONSTANTINE` → `WAITING ON DECISION` with Constantine as
  decision owner and Main as relay;
- `CLOSED` → an explicit `RESOLVED` or `CANCELLED` decision; and
- `RELEASED` → separate release evidence, not a workflow status.

## Migration rule

Preserve historical values and append mapped events. No bulk rewrite may make
old tickets appear to have followed a lifecycle that did not yet exist. Project
option changes and ticket migrations require separate board authority and a
deterministic, reviewable mapping receipt.

## Rollback or supersession

Before activation, revert the bounded governance series. After activation,
append a superseding decision and migrate state deterministically; never delete
the old event vocabulary from history.
