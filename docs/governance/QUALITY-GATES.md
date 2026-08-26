# Quality gates

Policy version: `1.0.0-candidate`

This file is the authoritative gate index. Specialized procedures remain in
[Feature Delivery Loop](../FEATURE-DELIVERY-LOOP.md),
[QA Testing](../QA-TESTING.md), [Architecture Map](../ARCHITECTURE-MAP.md), the
[component model contract](../COMPONENT-MODEL-ARCHITECTURE.md), and the
[runbooks](RUNBOOKS/README.md).

## Universal gates

Every candidate must provide:

1. stable ticket ID, approved scope, authority, owner, dependencies, and
   exclusive claimed paths;
2. exact fresh `dev` base and exact candidate head;
3. acceptance addressed and any accepted deferral;
4. targeted checks and discriminating known-bad/RED evidence where a mechanical
   contract is added or changed;
5. applicable repository tests with an exact terminal outcome;
6. clean `git diff --check` and no unintended paths;
7. rollback boundary;
8. independent non-maker QA at the frozen head; and
9. a truthful receipt separating local, pushed, PR, integrated, hosted,
   resolved, and released states.

`UNKNOWN`, browser exit 2, missing instrumentation, a silent successful process,
an inherited unclassified failure, or evidence from another head is not green.
A gate must emit a counted terminal verdict or be explicitly classified as
diagnostic/non-gating.

## Change-class additions

| Change class | Additional evidence |
|---|---|
| Defect | Reproduction, smallest failing fixture/flow, regression plant, focused repair evidence. |
| Feature or mechanics | SPEC/GDD acceptance, deterministic behavior, persistence/input implications, applicable full suite. |
| UI/art/audio | Functional behavior plus Experience QA, representative desktop and approximately `390x844` phone evidence, relevant pointer/keyboard/touch/gamepad and accessibility checks. Screenshots prove pixels only. |
| Save/schema migration | Frozen fixture provenance, each supported version, round trip, malformed and forward-version handling, rollback compatibility. |
| Documentation/policy | Local Markdown-link resolution, legacy-path mapping, contradiction search, policy status/effective-state review, independent policy QA. |
| Tool/CI | Same-door selftest, known-bad plant, exit/verdict propagation, current-head venue evidence, cost/trigger authority where applicable. |
| Generated content/artifacts | Authoritative source check, deterministic regeneration, orphan/stale detection, one serialized writer, root/build/dist/buildordinal provenance and identity. |

## Candidate freeze and QA rejection

QA records the exact reviewed head and result. A required file change returns
the ticket to `IN PROGRESS`; the next candidate receives a new frozen-head
event and reruns affected evidence. Evidence-only clarification may remain on
the same head only when the ticket contract explicitly allows it.

A rejection records whether the cause is behavior, experience, evidence,
contract, or environment. It includes the smallest reproducible failure and
likely owner but does not authorize QA to repair maker-owned paths.

## Evidence freshness and hosted proof

Each receipt includes evidence time and head SHA. Before integration, refresh
the base and invalidate stale mergeability or test evidence when the base or
candidate changes. Before `HOSTED VERIFIED`, record the deployed SHA and verify
the real hosted flow; a successful Pages job alone is deployment evidence, not
complete runtime evidence.

## Rollback

Rollback is ticket-sized. Documentation policy changes revert their bounded
docs series. Source extractions restore the old public seam. Save migrations do
not rewrite existing player data as part of rollback. Generated artifacts are
regenerated from restored source authority rather than hand-edited. A rollback
requires the same authority as the state-changing action it reverses.
