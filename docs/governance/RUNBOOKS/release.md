# Release runbook

This runbook is an evidence index, not release authority. Constantine retains
promotion to `release` or `main`, release-branch merges, tags, release
publication, public promotion beyond the development preview, final
release-quality control, and release-readiness approval.

The IT Manager III may declare an exact test/release **promotion packet ready
for Constantine review** only after strong QA playtest. That packet-readiness
fact is not final release readiness and grants no branch, Pages, tag,
publication, or release mutation. See [decision
0005](../DECISIONS/0005-dev-delivery-promotion-and-pages.md).

1. Name the exact approved `dev` commit and candidate artifacts.
2. Confirm required tickets are integrated/resolved, regressions and release
   gates are green at that head, and known exceptions have recorded decisions.
3. Verify generated root/build/dist HTML and `buildordinal.json` provenance and
   byte identity through the one serialized lane.
4. Verify real-Windows/desktop packaging and applicable hosted flows; separate
   source, standalone, desktop, and Pages evidence.
5. Record licences/credits, changelog/version projections, rollback plan, and
   independent release QA.
6. Present Constantine the exact evidence, options, recommendation, smallest
   action, and authority request. Do nothing until the requested action is
   explicitly authorized.
7. After any authorized action, report merge, tag, publication, deployment,
   hosted verification, and release as separate facts.

The desired future Pages source is `main`; no switch is authorized by this
runbook. The promotion packet records the exact candidate already on `main`,
artifact SHA-256/build/source, current and desired Pages source, successful
deployment, hosted live smoke/playtest, and a tested rollback to the prior
source. Constantine explicitly approves and performs the source change. A
Pages job without matching hosted evidence is not complete.

Rollback authority is action-specific. Never infer permission to delete a tag,
release, artifact, branch, or deployment from permission to create it.
