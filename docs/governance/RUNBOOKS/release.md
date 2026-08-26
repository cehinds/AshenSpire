# Release runbook

This runbook is an evidence index, not release authority. Constantine retains
promotion to `release` or `main`, release-branch merges, tags, release
publication, public promotion beyond the development preview, final
release-quality control, and release-readiness approval.

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

Rollback authority is action-specific. Never infer permission to delete a tag,
release, artifact, branch, or deployment from permission to create it.
