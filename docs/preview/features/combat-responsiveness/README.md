# Combat responsiveness verification

Captured 2026-10-21 UTC from the locally packaged light build of source `8cd2d6527887a137d1afec9aa73d8f7a8ee8e59b`, build `0.7.1.1761`, source digest `8f1119e8f4`, HTML SHA256 `40d060e38f2de3763dc592ea31d226d2b03518b59d08ff04fbbacd4e83a6b072`.

[Download the successful CI feature build](https://github.com/cehinds/AshenSpire/actions/runs/39634103203/artifacts/12359599258). CI source `09ec8f791b4bf6484557bd6cd06e8fe0e6b64824` contains the same gameplay implementation plus the latest dev build stamp and generated receipts. The screenshots identify the local build they actually captured; its ordinal is not the later published build number.

The execution environment blocks the GitHub Pages hostname, so the Pages game and channel badges could not be verified here. The artifact above was verified present, unexpired, and produced by a successful workflow. The existing Release gallery remains labeled `0.7.1.1517`; the release branch box was verified unchanged at `1517 / a5b5079cb1`. No release or main promotion was performed.

## Capture setup

Core combat fixture, seed `3`, three enemies, five cards; normal animation pacing and combat speed 1. Captures show a Strike selected after actual touch interactions, with artwork/fonts ready. These are fixture-based interaction captures, not a completed run.

| Image | Viewport |
| --- | --- |
| mobile.png | 390 × 844 |
| desktop.png | 1280 × 800 |
| wide.png | 1920 × 1080 |
| tablet.png | 1024 × 1366 |

Chromium was exercised through the repository's local Playwright harness. Browser plugin runtime tools were unavailable in this environment. Physical phone performance and Safari were not measured.

## Evidence

The paired performance record is in [PERFORMANCE.md](PERFORMANCE.md). Two native touch comparisons in AB/BA order at 4× CPU throttle improved all six measured selections. Stable subsequent selections reduced full battlefield fits from two to zero; first selection retained one fit. The initial duplicate hand build and trailing native confirmation were removed. This is a small simulated sample, not a universal speed percentage.

The orchestrator ran the native target regression at 375×667, 390×844 and 412×915. Held inspection released without playing; fresh same-target/different-target taps and keyboard confirmation landed inside the old 700ms cooldown window (478ms, 580ms, 448ms). Each accepted gesture played exactly one card on the intended target. Post-playback HP targeting and the drag controls passed, with zero uncaught page errors.

The independent reviewer reported no actionable findings in the final production diff. Focused integrated interaction/layout tests passed 36/36; CI passed core and all four discovered shards, receipts, quick-start browser checks and preview gates.

Fresh-context functional verification passed at all four viewports. A 390px touch run changed stances, held a different card for inspection, and completed one normal-speed play with exactly one energy and one stamina spent. A real desktop resize from1280px to1100px changed hand geometry, emitted its layout notification, and preserved the selected offensive card. Authored UI-scale and text-size controls changed geometry and restored correctly; hand reorder and end-turn draw emitted real geometry updates. The empty reaction stack was declined through its authored Back control.

A separate Current-profile Starseer fixture exercised real upcasting: card rc6 rank0→1 kept selection, spent no resources, and played no card. Its fan dimensions and geometry key stayed unchanged, so zero layout notifications was the correct result. A selected card's animated position is not the fan's geometry.

All four screenshots were inspected by the orchestrator. Page identity, meaningful combat content, absence of framework error overlays, and zero uncaught page errors were checked. Console messages included browser autoplay/vibration restrictions and local standalone-server audio404s (`/music/manifest.json`, `/assets/sfx/holdTick.ogg`); these are separate from artwork readiness and the selection measurements. This work does not claim complete audio validation.

The fresh mobile geometry record explains the one remaining first-selection fit: the hand was at top514px before selection, while the last published position was518.2064px. First selection published514px, with width, height and local geometry key unchanged. The cause of the earlier movement was not traced.
