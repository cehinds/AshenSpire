# Card typography review

PR #1664 reduces all six shared text layers and both resource-cost variants by 2 typographic points (8/3 design pixels at the 360px design width). The font-size default and auto-fit minimum/maximum change together. Text continues to scale with the existing card dimensions; artwork, card geometry, line limits, rules and costs are unchanged.

The shared renderer was exercised with all 220 canonical card identities and 17 equipment profiles at 1440 x 950 and 390 x 950 in fresh browser profiles. Both screenshots show the resulting cards. All 237 images decoded at each viewport, with no horizontal overflow, browser exceptions or failed requests. The outline fallback and a pointer selection were also exercised. This is a focused card presentation check, not a full game playthrough or physical-device acceptance.

Desktop and phone comparisons using the same live rules, widths and font metrics: 103 of 237 descriptions fit fully before the change and 124 after it, with no regressions. Long descriptions can still be truncated by the existing two-line limit; the Information view remains available.

Component catalog: [illustrated-card](../../COMPONENT-CATALOG.md). No component IDs, renderer behavior or reuse surfaces change.

Independent review: font_review approved the implementation with no actionable findings, confirming all 5,304 resolved font/bound changes across the shared template and 220 generated cards and no other semantic changes.
