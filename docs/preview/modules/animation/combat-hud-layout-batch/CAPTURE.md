# Combat HUD layout batching capture

Captured locally on 2026-10-17 from source `026f2839e0ea86308a88acf32418b55c34628191`, canonical cache build **0.7.1.1556**, digest `4f155934c2`, served at `dist/AshenSpire.html?shot=combat`. This is a posed solo combat fixture. It documents rendering after batching geometry reads before HUD writes; screenshots do not measure latency or demonstrate a completed playthrough or hosted execution. No capture-only layout CSS was applied. Fonts loaded and zero failed image elements were recorded at all four viewports. All images were inspected.

The public [feature route](https://cehinds.github.io/AshenSpire/branches/fix/CombatHudLayoutBatch/latest/) and fresh CI artifact identity remain pending independent verification. Local build metadata is not an artifact/public identity claim.

| Phone · 390 × 844 | Desktop · 1440 × 900 | Wide · 1280 × 720 | Tablet · 768 × 1024 |
| --- | --- | --- | --- |
| ![Solo combat on phone](mobile.png) | ![Solo combat on desktop](desktop.png) | ![Solo combat in wide layout](wide.png) | ![Solo combat on tablet](tablet.png) |

Source validation separately recorded the unmodified native quick-start probe at 232/666 ms and 30 focused Node tests passing. The rendered HUD check passed six 1440px candidate geometry checks before a later hover interception prevented full completion; it is not claimed green. See `capture-record.json` for exact viewport checks. Component reference: [catalog](../../../../COMPONENT-CATALOG.md), [HTML combatant-frame entry](../../../../component-catalog.html?q=combatant-frame#grid).
