# Feature delivery loop

This is the reusable AshenSpire process for a player-facing change. It turns a
request into a traceable model/component change, a real playable artifact, and
behavior evidence without confusing local work with delivery.

## 1. Frame the change

Record:

- the observed player problem and source screenshot;
- the expected player outcome;
- an ASCII illustration of each meaningful state;
- the stable component IDs, model owners, renderers, and reused primitives;
- acceptance criteria for visuals, behavior, input, accessibility, and responsive fit;
- whether confirming changes state, spends resources, or leaves the current screen.

Do not implement an ambiguous permanent action. Back/cancel and the commit
boundary must be explicit first.

## 2. Build from existing AshenSpire owners

Prefer the existing component catalog, presentation models, renderers, services,
tokens, and interaction grammar. A screen coordinates state; it does not own a
second copy of reusable component behavior. Keep model projections DOM-free and
make the commit command the only mutation boundary.

Freeze source before regenerating generated artifacts. Do not hand-edit generated
HTML or build ordinals. Preserve unrelated dirty work.

## 3. Verify in layers

1. Syntax and focused model/component contracts.
2. Content and catalog consistency.
3. One exact build regeneration.
4. Exact-artifact Node and shipped-alias checks.
5. Real browser flow in the browser selected for the task.
6. Responsive matrix and touch/keyboard checks where available.
7. Console and command-log review.

A screenshot proves appearance. State assertions prove behavior. A green process
that did not exercise the intended door is not a pass.

## 4. Iterate until the acceptance contract passes

For each failure, record reproduction, observed result, expected result, evidence,
smallest responsible model/component, and the exact retest. Change only that
bounded owner, rebuild, and rerun the same test. Keep failed evidence in the
write-up so the final design decision is auditable.

## 5. Document and hand off

Before requesting integration:

- add the final screenshots and behavior receipt to the feature write-up;
- update `docs/component-catalog.html` and `docs/COMPONENT-CATALOG.md` for every
  changed stable UI component;
- update README, specification, QA process, and relevant focused docs;
- state exact branch, SHA/build/source receipt, checks, and preview URL;
- distinguish local, committed, pushed, PR, merged, hosted, and released states;
- add changelog/status receipts only when their real PR/build identifiers exist.

## Reusable evidence receipt

```text
Feature:
Components changed:
Model / renderer owners:
Artifact: build, source receipt, path
Browser / viewport / input:
Visual evidence:
Behavior assertions:
Console / command log:
Focused checks:
Responsive matrix:
Verdict: PASS | FAIL | BLOCKED | NOT RUN
Delivery state: local | committed | pushed | PR | merged | hosted | released
Next authority required:
```
