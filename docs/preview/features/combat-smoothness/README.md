# Combat smoothing capture record

Captured and visually inspected on 2026-10-21 UTC in Chromium, using the official local light standalone build **0.7.1.1765 / e8027c64a9**, source `865635034383dd6a823d89deea7d8ac48b5208ed`. HTML SHA-256: `e7bb083bc024e90c17f8bef49e6c9299a2b05d564585291d09d8518c4ee004b6`.

[Verified CI preview download](https://github.com/cehinds/AshenSpire/actions/runs/39645374121/artifacts/12367356543) · [Change, review and performance results](https://github.com/cehinds/AshenSpire/pull/2241)

The CI preview run succeeded on the same PR source, using its synthetic merge commit `00f32191d347d8c475e1c46d917909f97be05631`. Screenshots identify the executed local build above; they are not captures of a deployed Pages build. Direct Pages and badge verification remains blocked by this execution environment. The CI artifact is the verified preview fallback.

The browser connector's execution tool was unavailable; the repository's Playwright setup was used. Fresh contexts: mobile390×844 touch, desktop1280×800 mouse, wide1920×1080 mouse, tablet1024×1366 touch. All used `shot=combat`, `gameProfile=core`, `shotSeed=3`, three enemies and five cards; fonts and images settled before capture. Normal action pacing, hold confirmation off, one-tap play off. Each image shows a Strike selected via native input. These are posed combat fixtures, not campaign playthroughs.

All four page-identity, meaningful-content, error-overlay and stance checks passed. Mobile held inspection preserved resources; target confirmation played exactly once, spent one energy and stamina, and unlocked the hand after normal playback. Desktop resize1280→1100 retained selection and stance. Separate native range checks at320×844 and1280×800 passed keyboard/touch route choice, zero spending while choosing, correct Throw payment and movement-only badge behavior. Packaged Current/Starseer seedB upcast changed rc6 tier0→1 while preserving selection and resources.

No uncaught page errors. Console messages included browser autoplay/vibration restrictions and isolated-server audio404s (`music/manifest.json`, `assets/sfx/holdTick.ogg`, and in the range fixture `cardPlay.ogg`/`relic.ogg`). Audio delivery and physical-phone/Safari performance were not validated. Raw browser JSON stays outside the repository.

The release gallery remains unchanged: the release branch box is0.7.1.1517 / a5b5079cb1, matching its existing capture record. No public component contract or gameplay/pacing rule changed.
