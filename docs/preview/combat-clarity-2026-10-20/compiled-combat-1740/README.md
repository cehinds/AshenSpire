# Compiled combat phone evidence

Captured 20 October 2026 from compiled **0.7.1.1740**, digest `6754f90018`,
source `c39712261ffe301639b5b88f20f30f995e1a7428`, in Chromium 154/Linux at
390 × 844 with native touch input. The artifact SHA-256 and image hashes are
recorded in [provenance.json](provenance.json). These are compiled-game captures;
they are not physical-device or Safari measurements.

| Primary range feedback | Executing action identity |
| --- | --- |
| ![Missed and Out of range appear directly above the target; the compact Strike card has no Precision entry text](phone-out-of-range.png) | ![The incoming move is named Attack · Scythe Pair before its reaction choice](phone-incoming-action.png) |

| First paid Counter return | Separate second-hit choice |
| --- | --- |
| ![The actual Counter return names its committed Greatsword source](phone-hit-1-counter.png) | ![The next reaction choice opens after the first hit and its Counter return finish](phone-hit-2-choice.png) |

The existing screenshot door poses two disposable fixtures: a registered Core
Strike against a target in a valid reach stance, and the canonical Cinder
Mantis two-hit Scythe Pair with registered Core Counter cards. Fixture setup
uses matching source helpers; actual touches, commands, costs, damage and FX
run through the compiled game. Production handlers are not replaced. Pacing is
normal and unthrottled; capture does not pause animations or extend callouts.
The range case also asserts that compact attack text omits Precision.

The range check verifies one card play, a range-caused miss and unchanged target
HP. The sequence check verifies an incoming sprite before its choice, no damage committed before that
choice, one incoming hit and paid return before the next choice, two total
paid returns, one original move execution, no false whole-attack refusal and no
page errors. The event and stage assertions establish the order; a still image
alone cannot prove timing. The artifact predates subsequent Smith-only polish.

## Performance investigation

The separate clean CPU probe uses the normal showcase Core Defend card, native
touch selection/confirmation, 390 × 844 at DPR 3, CPU throttle 4, and 1ms CPU
sampling. Coordinates are resolved before profiling. Each run commits exactly
once without page errors. The paired repeat waits for fonts and all 58
sprite/card images, then lets selection settle before recording.

| Compiled probe | Long tasks after input: count / total ms / max ms | onBeatApplied total ms |
| --- | --- | --- |
| Initial baseline 1740 | 24 / 6517 / 1836 | 1824 |
| Batched fit, rejected `31045d94a` | 21 / 8156 / 3210 | 3179 |
| Observer filter, initial `ad6b11964` | 16 / 5925 / 1364 | 1360 |
| Settled baseline 1740 | 17 / 5291 / 1465 | 1454 |
| Settled observer filter, rejected `ad6b11964` | 11 / 8192 / 2919 | 2906 |

Each probe ends 3.5 seconds after observing the commit; blocked browser work can
extend that wall-clock span. These are individual runs, not averaged benchmarks.
The settled pair observes 16/24 unchanged relevant attributes on baseline and
27/33 on the observer candidate: avoidable invalidations are real, but the
repeat does not establish a latency benefit. Both prototypes remain unmerged
and are absent from these images. **Combat-latency improvement is not claimed.**
Earlier profiles contaminated by the harness's hit-test grid are excluded.
