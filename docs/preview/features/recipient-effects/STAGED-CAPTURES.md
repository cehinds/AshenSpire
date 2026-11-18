# Staged artwork: controlled source-preview captures

These are **controlled production-renderer previews**, not screenshots of the pinned standalone build and not a battle playthrough. The pictured effect art was explicitly resolved from the local approved intake package; it has not been claimed as part of the v26 art release.

- Source commit: `f01f84b93f14c23eafc4ffbe3dd87571a06809c9` (`feature/recipient-effects-integration`, after the dev merge).
- Captured: **2026-11-18**, UTC; local evidence record `2026-11-18T19:47:43.095102+00:00`.
- Source tool: `tools/recipient-effects-runtime-preview.html?artRoot=../scratch/recipient-effects/integration-art/hd/`.
- Shown state: **Player invoker → Enemy recipient**, spell camp, neutral royal-blue caster circle, **150 / 600 ms** on the preview timeline. The circle is on the invoker. Native controls selected this state; the page was scrolled where necessary to keep the foreground effect visible.
- Build identity: **source worktree, not a generated/published build**. The checkout's inherited `0.7.4.165 / 0159ff6f60` stamp is not asserted as the identity of these changed source modules. Built-game evidence is recorded separately when its actual artifact is captured.

| Screenshot | Browser viewport |
| --- | --- |
| [staged-desktop.png](staged-desktop.png) | 1280 × 800 |
| [staged-phone.png](staged-phone.png) | 390 × 844 |
| [staged-wide.png](staged-wide.png) | 1920 × 1080 |
| [staged-tablet.png](staged-tablet.png) | 1024 × 768 |

All four browser-rendered captures were inspected. The circle remains on the player; phone controls wrap, and no actor is used as an invented universal silhouette. The separate local sandbox run passed **224 checks** across these viewport sizes. Actual engine-backed card clicks and enemy turns were separately verified by `tests/recipient-effects.browser.mjs`; they are not inferred from these paused preview frames.

Originals remain preserved at `scratch/recipient-effects/sandbox-qa/feature-captures/`, with `captures.json` and `../capture-record.json`. This folder is feature-branch review evidence; a published playable URL and actual built-game captures belong in the feature README only after that build has been verified.
