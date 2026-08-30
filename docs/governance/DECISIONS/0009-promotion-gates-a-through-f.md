# 0009 — Promotion Gates A–F

- Decision status: **Approved**
- Policy effective condition: independently reviewed governance head contained
  in fresh canonical `dev`
- Decision owner: IT Manager III, Integration & Delivery
- Initiative: `AS-HD-20260826-032`

## Immutable development line

```text
QA-approved exact candidate
  → integrate that exact head to dev
  → hosted verify the exact integrated dev SHA
  → fast-forward test to that exact verified dev SHA
```

Never advance `test` alone while a candidate is ahead of `dev`, and never put a
candidate-only SHA on `test`. Any code, content, configuration, or artifact
change resets Gate A. A changed `test` head invalidates every acceptance and
playtest result recorded for its previous SHA.

## Gates

### Gate A — Exact candidate QA

Freeze one candidate head. Required independent QA and repository gates pass at
that exact head, all findings are classified, and the candidate records its
source and artifact identities. Any code, content, configuration, or artifact
change creates a new candidate and restarts Gate A.

### Gate B — Dev integration and hosted verification

Integrate the Gate-A head to `dev` through the normal reviewable PR process.
Record the exact resulting `dev` SHA and verify the intended hosted development
artifact and player flow against that SHA. A PR, merge, deployment job, or
successful local test alone does not satisfy Gate B.

### Gate C — Exact fast-forward to test

The IT Manager III has standing conditional authority to fast-forward `test`
only when:

1. Gates A and B pass and remain fresh;
2. the proposed `test` target is exactly the hosted-verified `dev` SHA;
3. current `test` is an ancestor of that SHA, so the mutation is a true
   fast-forward;
4. the exact test head, rollback target/procedure, branch protections, and
   mutation evidence are recorded; and
5. there is no P0/P1 `WITHHOLD`, unresolved required reviewer, stale evidence,
   or scope/artifact mismatch.

This fast-forward is a non-release test promotion. It grants no `main`,
`release`, tag, publication, Pages, product, or board authority. If any
condition is `FAIL` or `UNKNOWN`, the IT Manager III records `WAIT` and requests
the exact additional authority or correction.

### Gate D — Five-role exact-test acceptance

At the unchanged exact `test` SHA, record separate recommendations from all five
required roles:

1. QA Team 1;
2. QA Team 2;
3. the assigned Development Lead;
4. IT Manager III, Integration & Delivery; and
5. Project Management Lead.

Add conditional recommendations from the Data Architecture & Systems Lead when
schema, IDs, aliases, lineage, migration, generated manifests, save/content, or
data quality are affected; Experience & Accessibility Review when player-facing
experience is affected; and Delivery Systems Review when build, artifact,
dependency/tooling, deployment, hosted, or rollback surfaces are affected.

Each recommendation names the exact test SHA, evidence, verdict, known defects,
and conditions. Council coordination never combines or replaces independent
verdicts. A P0 or P1 `WITHHOLD` blocks. An accepted P2 remains open and must name
its disclosure, owner, target milestone, risk, and exact accepting authority.
All other known defects remain recorded and are not converted to resolved by
promotion.

### Gate E — Constantine playtest

After Gate D passes, Constantine playtests the unchanged exact `test` SHA. The
receipt records build/artifact identity, flows, result, known accepted defects,
and any requested correction. A changed test head invalidates the council and
playtest receipts for the former SHA. A code/content/configuration/artifact
correction returns to Gate A.

### Gate F — Separate main and release actions

After Gate E, submit a fresh exact-SHA promotion packet. Constantine separately
approves and performs each requested mutation of `main` or `release`, tag,
release publication, Pages source/deployment, and final release-readiness
decision. Authority for one action implies none of the others. Each action
records its source/target SHA, artifact/hash/build/source, required review,
rollback, result, and hosted evidence when applicable.

The desired future Pages source remains `main`; this decision does not switch
it. The Pages conditions and prior-source rollback in decision 0005 still
apply.

## Relationship to earlier decisions

This decision supersedes decision 0005 only where 0005 reserves every `test`
mutation to Constantine or compresses promotion into one packet-readiness
step. It preserves 0005's discretionary `dev` delivery, normal reviewable PR,
exact evidence, WAIT behavior, desired future Pages source, and Constantine's
exclusive control of `main`, `release`, tags, release publication, Pages, and
final release readiness. It also preserves decisions 0006–0008 role, model,
pool, review-independence, and WIP boundaries.

## Rollback or supersession

Revert this bounded governance commit before activation, or append a later
decision that maps every in-flight candidate, `dev`/`test` SHA, acceptance,
playtest, rollback, and outstanding promotion authority to its replacement.
