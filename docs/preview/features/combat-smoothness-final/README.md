# Combat selection capture record

Captured and visually inspected on 2026-10-21 UTC in Chromium, using the official local light standalone build **0.7.1.1765 / 0299f854ad**, source `45517c80e02d4007228ef82305f28f0199ce788c`. HTML SHA-256: `42e02e42c188a1436cc9c31a8f82a0e8066ccd8afb780e783038a7ebd6e2b887`.

[Verified CI preview download](https://github.com/cehinds/AshenSpire/actions/runs/39649466135/artifacts/12369016137) · [Implementation, review and results](https://github.com/cehinds/AshenSpire/pull/2241)

The feature-preview run succeeded on the same source commit and its artifact was unexpired when checked. These screenshots show the executed local build, not a deployed Pages page. Direct Pages and badge verification is blocked by this environment; the CI artifact is the preview fallback. The browser connector execution tool was unavailable, so the repository Playwright setup was used.

Fresh contexts: mobile 390×844 touch, desktop 1280×800 mouse, wide 1920×1080 mouse, tablet 1024×1366 touch. All use `shot=combat`, `gameProfile=core`, seed 3, three enemies, five cards, normal pacing, hold confirmation off and one-tap play off. Fonts and images settled before capture. Each image shows Strike selected via native input. These are posed combat fixtures, not campaign playthroughs.

All four identity, meaningful-content, error-overlay and stance checks passed. Mobile held inspection preserved resources; target confirmation played exactly once, spent one energy and stamina, and unlocked the hand. Desktop resizing from 1280 to 1100 retained selection and stance. The original fixed one-second sample was too early (hand still 1280 wide); a bounded continuation waiting for the actual geometry update passed. The original failed record is preserved outside the tree. Separate range and packaged upcast checks passed on the identical combat module before the final narrowing.

Separate performance probes show hit-chance/badge updates reduced from two to one per selection, with identical stance canvas pixels. Completed timing comparisons favored the retained change; an unexplained baseline selection timeout and unusually slow resumed baseline prevent a reliable percentage speedup claim. Physical phones and Safari were not measured.

No uncaught page errors in these captures. Browser autoplay/vibration restrictions and scratch-server audio 404s remain; audio delivery was not validated. Bulk browser JSON remains outside the repository.

The release gallery remains unchanged at 0.7.1.1517 / a5b5079cb1, matching release branch metadata. No public component contract, gameplay rule or animation pacing changed.
