# Reward containment and mobile map response

Captured October 8, 2026 with the production source mounts and styles. The reward receipt is a deterministic fixture matching the reported four-row victory layout. The map uses the existing `shot=map&shotAt=floor:1` fixture. These are source UI checks, not a completed playthrough or a published-build claim.

- Desktop: 833 × 900 and 1440 × 900; every reward row stays inside its column and clear of progression.
- Phone: 390 × 900 with touch input; reward rows stack, map selection shows a usable tray within 150 ms, and Back/reselect/Enter work.
- Before the fix: desktop rows overflowed by 79–138 px and the phone tray took 448 ms to show. The original same-browser fixed probe measured 41 ms; the final combined-base run measured 87 ms under concurrent build load and is recorded in `result.json`.
- No page errors or unexpected failed requests. An optional node-travel recording uses the existing synth fallback in source mode.

Run `node tools/reward-map-layout-qa.mjs` after fetching the common art pack. Set `PLAYWRIGHT_MODULE` if Playwright is outside this checkout, `CHROME` for an explicit Chromium executable, and `UI_FIX_QA_OUT` for the output directory. `UI_FIX_BASELINE=1` serves the three changed presentation files from Git HEAD and records their behavior without the new layout/timing assertions; use it before committing a fix or on a branch whose HEAD is the pre-fix state.

Component catalog: [map composition](../../component-catalog.html#legacy-dungeon-runtime).

Integration with the alternative-default appearance in PR #1757 was checked again against source build identity **0.7.1.1166 / 3f8943d50c**. The [integrated browser report](integrated-1166.json) records contained rewards at 833/1440/390px, the touch Back/reselect/Enter flow, a 41.3ms selection response, and no page or unexpected request errors. These remain production source fixtures, not a published release claim.
