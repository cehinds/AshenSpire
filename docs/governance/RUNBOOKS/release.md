# Release runbook

This runbook is an evidence index, not release authority. Constantine retains
promotion to `release` or `main`, release-branch merges, tags, release
publication, public promotion beyond the development preview, final
release-quality control, and release-readiness approval.

The IT Manager III may conditionally fast-forward `test` only at Gate C of
[decision 0009](../DECISIONS/0009-promotion-gates-a-through-f.md), after the
exact QA candidate is integrated to `dev` and its exact resulting `dev` SHA is
hosted verified. This non-release action grants no `main`, `release`, Pages,
tag, publication, or release-readiness authority.

1. **Gate A:** freeze the exact candidate and complete required independent QA,
   gates, source/artifact identity, and finding classification.
2. **Gate B:** integrate that exact candidate to `dev` through a normal
   reviewable PR and hosted-verify the exact resulting `dev` SHA.
3. **Gate C:** when every condition passes, the IT Manager III fast-forwards
   `test` to that exact verified `dev` SHA and records rollback/mutation proof.
4. **Gate D:** QA1, QA2, assigned Development Lead, IT Manager III, and PM each
   recommend at the unchanged exact `test` SHA; Data, Experience &
   Accessibility, and Delivery Systems join when applicable.
5. **Gate E:** Constantine playtests that unchanged exact `test` SHA.
6. **Gate F:** present the exact packet for Constantine's separate `main`,
   `release`, tag, publication, Pages, and final readiness decisions/actions.

Never advance `test` alone when the candidate is ahead of `dev`. Any
code/content/configuration/artifact change resets Gate A; any test-head change
invalidates prior exact-test acceptance and playtest. P0/P1 `WITHHOLD` blocks.
An accepted P2 remains disclosed with owner, milestone, risk, and accepting
authority.

7. Name the exact approved `dev`/`test` commits and candidate artifacts.
8. Confirm required tickets are integrated/resolved, regressions and release
   gates are green at that head, and known exceptions have recorded decisions.
9. Verify generated root/build/dist HTML and `buildordinal.json` provenance and
   byte identity through the one serialized lane.
10. Verify real-Windows/desktop packaging and applicable hosted flows; separate
   source, standalone, desktop, and Pages evidence.
11. Record licences/credits, changelog/version projections, rollback plan, and
   independent release QA.
12. Present Constantine the exact evidence, options, recommendation, smallest
   action, and authority request. Do nothing until the requested action is
   explicitly authorized.
13. After any authorized action, report merge, tag, publication, deployment,
   hosted verification, and release as separate facts.

The desired future Pages source is `main`; no switch is authorized by this
runbook. The promotion packet records the exact candidate already on `main`,
artifact SHA-256/build/source, current and desired Pages source, successful
deployment, hosted live smoke/playtest, and a tested rollback to the prior
source. Constantine explicitly approves and performs the source change. A
Pages job without matching hosted evidence is not complete.

Rollback authority is action-specific. Never infer permission to delete a tag,
release, artifact, branch, or deployment from permission to create it.
