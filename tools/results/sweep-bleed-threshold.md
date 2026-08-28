# Bleed threshold sweep — the pick and its evidence

*Rune Falk, 2026-08-07, at Constantine's word: "let rune pick the threshold against
the sim." Harness: `node tools/measure-classes.mjs 1000 --policy=reaverkit` at each
value (only the bleed row's `proc.threshold` edited between runs; full per-run output
in `sweep-bleed-t*.txt` beside this file; the T=12 baseline is
`falsifier-1000-reaverkit.txt`). Pre-registered green, set before the first build:
stranding DOWN and Reaver's Wilson CI fully out of the [1.4%, 3.2%] datum band.*

| threshold | Reaver wins | Wilson 95% CI | clears band? | bleed stranded | act-1 deaths | net attrition/combat |
|---|---|---|---|---|---|---|
| 12 (old) | 19/1000 = 1.9% | [1.2, 2.9] | no | 55.5% | 270 | 30.71 |
| 10 | 29/1000 = 2.9% | [2.0, 4.1] | no (overlaps) | 50.8% | — | — |
| 8 | 34/1000 = 3.4% | [2.4, 4.7] | no (overlaps) | 45.4% | 207 | 28.85 |
| **7 (pick)** | **46/1000 = 4.6%** | **[3.5, 6.1]** | **yes** | **42.0%** | — | — |
| 6 | 52/1000 = 5.2% | [4.0, 6.8] | yes | 36.3% | 134 | 27.02 |

**The pick: 7 — the smallest threshold that fully clears the pre-registered green.**
Why 7 over 6: least intervention that meets the criterion, and it lands exactly inside
the 6–9-point band the #61 diagnosis named (act-1 enemies die holding 6–9 points — at
7, the first burst arrives on the enemies that were stranding it). At 7, Reaver
(46/1000, [3.5, 6.1]) sits at statistical parity with Starseer under the same policy
(50/1000, [3.8, 6.5]) and far below Herald (199/1000) — the floor class rises to the
middle, past nobody. T=6 also clears with more margin; it is one row edit away if the
next gate wants the margin instead of the minimum.

Adjacent knobs: burstPercent was NOT load-bearing in this sweep — on act-1 hp pools
the burst is min-clamped (15% of ≤53 hp < 8), so the win-rate movement is all
threshold. It stays 15, untouched, PROVISIONAL.

Boundary: this is the naive-bot floor under one kit-aware policy; the number is
PROVISIONAL in the row and Constantine's hands stay free. Sunna's PX gate and Vira's
mechanics re-check are unaffected by the value (schema types knobs, never ranks
them) — both notified the shipped default moved 12 → 7.
