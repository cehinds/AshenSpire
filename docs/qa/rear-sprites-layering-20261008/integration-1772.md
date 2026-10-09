# Rear sprite integration: PR 1772

The owner requested merging the checkpoint on 2026-10-08. This status supersedes
the earlier checkpoint-only delivery boundaries in [README.md](README.md).

PR: https://github.com/cehinds/AshenSpire/pull/1772

The branch merges `origin/dev` at `cd045335c9` and preserves the canonical default
alternative appearance from PR 1757 and reaction ordering from PR 1767. The
duplicate `assets-alternative` copies and pack-builder additions were removed;
rear frames now resolve through the existing `assets-display` catalog. Classic
appearance switching remains available through the existing debug settings.

The integrated diff retains current sprite-art HUD tracking, the maximum pose
envelope, scrollable hands, combat-tool reservations, and the defensive reaction
and automatic Counter flow. It adds the approved placement and shared layer
order, stable hand/body anchors, encounter-scoped co-op fit persistence, loaded
image measurements, and normalized field dimensions. Rear canvas travel is
restricted to melee; generic hurt/stagger feedback does not move its root.
Automatic Counter attacks preserve the held stance.

Independent review caught empty-hand resize/draw drift. A mounted empty hand now
supplies its top anchor before cards return. Unit and browser regression checks
cover that case. The final review found no further actionable issues in the
renderer, appearance switching, HUD tracking, tools or reaction modal layers.

## Verification

- 92 focused integrated tests passed.
- The separate sprite agent passed 58 renderer, appearance and reaction checks.
- Five integrated source layouts passed, including exact co-op actor geometry
  across field remounts with taller intent controls and fewer cards.
- Final package build 1175 passed four classes, 32 actions, 12 held stances,
  20 wrapped reaction checks, and three accepted card plays on desktop and phone.
- Empty-hand resize/draw checks reported zero actor drift on desktop and phone.
  The package adapter waits for the mounted combat fixture after art loading.
- Core suite, 314 package-integrity checks, nine build-identity checks, twelve
  shipping checks and two receipt checks passed. The architecture-only dev merge
  rebuilt without changing build 1175 or its digest `866e089aa9`.
- Current package reports and desktop/phone captures are in
  [integration-1175](integration-1175/). Hosted gates remain recorded in the PR.

Reproduce using the commands in [README.md](README.md), with the official build
command `node tools/launch.mjs --build-only` and package QA URL
`http://localhost:8338/build/AshenSpire.html`. Run the core lane with
`node tests/run-node.mjs --no-selftests --no-discovered`; hosted checks also run
the four discovered-test shards and required browser gates.

## Follow-up requested after merging

The owner supplied another marked screenshot showing detached, oversized enemy
selection plates. After this merge, illustrate compact selection cells anchored
to each enemy's visible body. Neighboring cells should align in a tight grid
without overlap, with reduced padding and clear association to the corresponding
sprite. Preserve readable intent/name/HP, keyboard focus, legal-target checks and
touch access. This follow-up is not folded into PR 1772.

Dev merge, architecture sync, test promotion, alternative sync/CI and owner
acceptance must each be reported separately; none is implied by local checks.
