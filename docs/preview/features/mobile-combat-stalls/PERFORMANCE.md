# Combat performance evidence — 2026-10-21

The retained change fixes stationary rest and target input, reduces some rendering work, and **does not establish that mobile performance is resolved**. These are local Chromium measurements, not physical Galaxy A32, iPhone SE or Safari results.

Each experiment used a quiet machine, 375×667 at DPR 3 with 4× CPU throttling, the same seeded encounter and native Defend/Strike input. Shipped normal pacing remained enabled. Time starts at confirming pointerdown and ends when the paid card is absent, its receipt resolves exactly once, the hand unlocks and End Turn is enabled. Passive frame timestamps and long-task observations do not read layout every frame. No timeline/selector profiling ran during these comparisons. Every action paid/resolved once and targeted the expected actor. The order was baseline, candidate, candidate, baseline, baseline, candidate; three runs per build. All samples, including large stalls, are retained. Style/script/layout counters overlap and must not be summed.

## Retained changes versus build 1758

Baseline: `fd15cbc1b594f950da89286e32ee060d7a83a262`, 0.7.1.1758 / `1536df5e54`, HTML SHA256 `aec11d36fdfe7f6c5814d15c257fa1b9da961fbd876932a5654827d89e654ca8`.
Candidate: `bdd484f31b9c394093e9e5e66ed2973c0b0ff6e8`, 0.7.1.1761 / `b623462ee1`, HTML SHA256 `ac9c74462644d468574679c1458accbe1da60be15455372a700298ee1a507a92`. The final retained runtime matches this source byte-for-byte; later edits document evidence and remove a rejected experiment.

| Action | Baseline samples (seconds) | Candidate samples (seconds) | Median |
| --- | --- | --- | --- |
| Defend | 9.536, 7.300, 58.773 | 4.722, 6.650, 8.997 | 9.536 → 6.650 |
| Strike | 6.831, 7.611, 8.582 | 17.265, 7.848, 7.282 | 7.611 → 7.848 |

Defend improved in this small comparison; Strike did not. Full counters and frame/long-task observations: [performance-summary.json](performance-summary.json). No sample was discarded as a presumed flake or environmental pause.

## Rejected glow-cache experiment

A separate normal CPU-only diagnostic identified repeated aura drawing. A bounded immutable soft-glow cache passed 192 real-canvas image comparisons and independent correctness review, but did not improve full-action timing consistently. It also added up to 16 MiB of retained canvas pixels per renderer, so it was reverted entirely.

This second experiment compares the retained bdd package above with experimental `46d0b60bdaa151e1b43154a4fc0f42f81dd30c5b`, 0.7.1.1761 / `e3932b8a9c`, SHA256 `2f317e38c21eb91bee2fedb0e8a1e7bff4f7149db34a475a1875f4a506bc54e4`. Its samples are independent of the earlier experiment and are not pooled.

| Action | Retained samples (seconds) | Experimental samples (seconds) | Median |
| --- | --- | --- | --- |
| Defend | 5.398, 5.268, 5.984 | 6.361, 5.202, 5.630 | 5.398 → 5.630 |
| Strike | 7.057, 6.156, 5.377 | 5.363, 6.525, 8.029 | 6.156 → 6.525 |

Long-task medians also increased: Defend 4069 → 4286 ms; Strike 4915 → 5271 ms. [Complete summary](rejected-aura-summary.json). The implementation is preserved in Git history for review, not shipped. Targeting, stationary art and labels remain independently verified; further mobile investigation is separate from that correctness evidence.
