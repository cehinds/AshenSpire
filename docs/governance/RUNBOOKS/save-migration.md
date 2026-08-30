# Save migration runbook

1. Record current and target schema versions, exact affected run/meta owners,
   compatibility window, rejection behavior, and player rollback consequence.
2. Freeze provenance-labelled fixtures for every supported historical version
   before changing runtime migration code. First characterization may be its
   own tests-only ticket.
3. Implement deterministic, version-to-version migrations. Do not combine a
   structural extraction with new save behavior unless separately approved.
4. Verify each historical fixture, same-door save/load round trips, malformed
   data, missing fields, current version, and forward/unknown version handling.
5. Prove gameplay state after load, not only JSON shape. Run the relevant full
   suite and saveroundtrip gate with exact terminal outcomes.
6. Independent QA reviews fixture provenance, migration order, byte/schema
   stability, and a real resumed flow at the frozen head.

Rollback must not silently rewrite player saves. Restore the previous reader
and retain fixtures/evidence needed to diagnose compatibility.
