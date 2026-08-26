# 0004 — Art policy canonical adoption

- Status: **Approved**
- Effective: upon authorized canonical merge
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

Its status remains **Approved** in the local Phase 2 candidate. It becomes
**Active** only when a separately authorized canonical merge lands the policy.
Approval does not authorize art, runtime, catalog, publication, Project,
deployment, or release changes.

## Rollback or supersession

Before activation, revert the Phase 2 docs series: restore the old path and
links together or remove the unmerged candidate. After activation, append a
superseding decision and preserve one canonical path; never recreate two live
copies.
