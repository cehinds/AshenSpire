# Rejected intent projection experiment — PR #2239

This change was measured and abandoned, not merged or shipped. The extra cache did not improve full-action responsiveness in this bounded comparison. No claim is made that the measurements identify the cause of the slower samples.

Candidate: source `87aaa153841e24393fbd346a327831cb88a9bd0a`, version `0.7.1.1763`, digest `e2c80900a6`, standalone SHA-256 `8073c3f38c33cc11d362be54655f826795c07557abd2029412deb5491e30e0d3`.

Baseline: source `bdd484f31b9c394093e9e5e66ed2973c0b0ff6e8`, version `0.7.1.1761`, digest `b623462ee1`, standalone SHA-256 `ac9c74462644d468574679c1458accbe1da60be15455372a700298ee1a507a92`. This is the retained runtime from merged PR #2235.

The six runs used order B,C,C,B,B,C with native Defend then Strike, normal shipped pacing, headless Chromium at 375×667, DPR 3, CPU throttle 4×, and an exclusive local browser/CPU lease. Readiness polling was 100 ms. All samples and outliers are retained. Each action paid and resolved once, unlocked controls, and produced no page errors. This is not a physical Galaxy A32, iPhone SE or Safari benchmark.

| Action | Baseline times (s) | Candidate times (s) | Median baseline → candidate |
| --- | --- | --- | --- |
| Defend | 7.906, 9.175, 5.642 | 9.288, 13.423, 8.045 | 7.906 → 9.288 (+17.5%) |
| Strike | 7.963, 7.328, 5.042 | 7.188, 11.253, 7.462 | 7.328 → 7.462 (+1.8%) |

The model passed 26 focused tests and independent source review. PR CI also exposed fixture/checker drift: the static full-render checker and its negative tests still extracted `render()` rather than the new `renderBoard()` body, and two extracted-function fixtures lacked the new projection binding. Those adaptations were deliberately not pursued after rejecting the runtime experiment. The unchanged merged baseline does not have these wrapper-specific failures.

The JSON files preserve complete per-action timings, correctness receipts, source/artifact identity, and the exact run configuration. No performance benefit is claimed. The proposed changelog receipt on this abandoned branch is not a shipped receipt.
