# Reward and combat card readability

[PR #2867](https://github.com/cehinds/AshenSpire/pull/2867) · [Feature preview](https://cehinds.github.io/AshenSpire/branches/fix/reward-card-readability/latest/) (hosted publication pending). [Tested feature build ZIP](https://github.com/cehinds/AshenSpire/actions/runs/44475709148/artifacts/14505969093) — successful feature-preview run for source `110a5cb5b3666c3e6bd66f916067c873cbf4fbe4`. Extract the ZIP and open its self-contained HTML. GitHub sign-in is required for artifact downloads.

Captured November 18, 2026 (America/Anchorage), using headless Chromium. UI implementation: `fefe9698c8d4db8371c3a7534281dd72fb1392c6`; base: `66e473a77c74da54bd8701fd5a2614a0e7484985`. The isolated validation build was **0.7.4.199**, digest **87d96cdf30**. Screenshots render source modules after the normal application boot, rather than the bundled HTML. Later receipt and evidence commits do not change these UI components.

Reward captures use four mixed offers mounted with production registries and renderers after `?shot=reward` boots. They demonstrate the chooser; they are not rewards earned in a playthrough. Combat captures use native `?shot=combat` with a registered seeded hand and selected Executioner. No card art was substituted. Four views: phone **390×844**, desktop **1280×800**, wide **1920×1080**, tablet **1024×768**. Additional layout checks cover **360×740** and **727×1188**.

## Acceptance and verification

- **24 PASS / 0 FAIL** from `node tools/qa-sandbox.mjs <acceptance.json> --out <temporary evidence directory> --base origin/dev`, at desktop and phone sizes. [Acceptance specification](../../../qa/reward-card-readability.acceptance.json).
- **32 reward layout scenarios:** one through four offers, name buttons shown/hidden, four viewport sizes. No modal scrolling or hidden footer; additional wide/tablet cases pass. Fonts were loaded and layout settled before measurements.
- **45 motion states:** all five reward families at three widths; hover scales by 1.06, selection/focus only lift.
- **Two multi-select confirmation flows:** selection toggles, Continue lists both choices, and Back retains them.
- **Four combat viewport checks:** all 20 hand-card layout boxes/transforms and every non-rules font, including names/costs, match the control. Non-hand inspection fonts are unchanged. Desktop rules shrink by approximately 2 physical pixels; phones retain their existing stronger reduction.
- **151 core checks, 61 targeted tests:** all pass. Full build, plantsites, style lint, naming/contracts and type checks pass. No configured coverage tooling; coverage is not applicable. Security review found no new I/O, credentials, permissions or persisted data changes.
- Independent implementation review: approved; final commit review recorded in the PR.

Some descriptions can still truncate in very small cards; complete Information remains available. The requested changes do not alter the Information control, combat hand geometry, card names, or cost badges.

## Before and after

| View | Before: base dev | After |
| --- | --- | --- |
| Desktop | [Before](before-desktop.png) | [After](desktop.png) |
| Phone | [Before](before-mobile.png) | [After](mobile.png) |

[Wide rewards](wide.png) · [Tablet rewards](tablet.png) · [Combat desktop](combat-desktop.png) · [Combat phone](combat-phone.png).

The root Release gallery was verified unchanged: the published Release metadata still identifies **0.7.3.232**, commit `270f2831cd06fe68176635410fded0f301999d87`. Existing release captures and their provenance were preserved. Feature preview publication is automatic after the branch build; a pending link must not be treated as a published build.