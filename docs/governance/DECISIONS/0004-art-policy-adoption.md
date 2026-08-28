# 0004 — Art policy canonical adoption

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: Main
- Initiative: `CQM-PHASE-2`
- History source: `edc726bc50a9f86bd2c2e615915bc69bd0f61351`

## Decision

The approved Art policy moves history-preservingly from
`docs/ART-DESIGN-INTEGRATION-POLICY.md` to the single canonical live path
[`docs/governance/RUNBOOKS/art.md`](../RUNBOOKS/art.md). README and governance
indexes point to that path. No duplicate live policy remains.

The source provenance is:

```text
0eb512dc → 139d8c6f → d19066bf → 8cd90426 → edc726bc
```

Its lifecycle state is derived without a merge-time text mutation. It is
**Approved** while the exact head named by successful independent policy QA is
not contained in fresh canonical `dev`, and **Active** when that containment is
true. An unavailable or invalid containment result is `UNKNOWN` and blocking.
Approval does not authorize art, runtime, catalog, publication, Project,
deployment, or release changes.

## Rollback or supersession

Before activation, revert the Phase 2 docs series: restore the old path and
links together or remove the unmerged candidate. After activation, append a
superseding decision and preserve one canonical path; never recreate two live
copies.
