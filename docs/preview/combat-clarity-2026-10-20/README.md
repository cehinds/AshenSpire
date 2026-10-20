# Card and reward clarity captures

Separate [compiled combat phone evidence](compiled-combat-1740/README.md) shows
primary range feedback, named actions and sequential per-hit Counter choices
from build 0.7.1.1740, with exact artifact provenance and verified event order.

20 October 2026, source UI at `c8277c4428896828a31e859ef80aaf62926ebd99`.
Runtime UI matches `47f9d36ab9c29ff873d56ab6d16251e787cbb98b`, which built as
**0.7.1.1735**, digest **44abeebe16**, with v23 light/common art. These are source
captures in Chromium 154/Linux, not compiled-build screenshots or physical
Galaxy A32/iPhone/Safari evidence. Phone contexts support touch; states are posed.

| Viewport | Core hand | Closed Core upgrades | Selected reward |
| --- | --- | --- | --- |
| 1440 × 900 | [Hand](hand-core-1440.png) | [Smith](smith-core-1440.png) | [Reward](reward-1440-selected.png) |
| 390 × 844 | [Hand](hand-core-390.png) | [Smith](smith-core-390.png) | [Reward](reward-390-selected.png) |
| 375 × 667 | [Hand](hand-core-375.png) | [Smith](smith-core-375.png) | [Reward](reward-375-selected.png) |
| 320 × 568 | [Hand](hand-core-320.png) | [Smith](smith-core-320.png) | [Reward](reward-320-selected.png) |

The actual [Information door](hand-inspection-1440.png) retains Entry text.
Smith prints the calculated `AR 1 → 2` in Equipment Stats and closed summaries.
Four-choice rewards use authored offers through the production component:
[desktop](reward-four-1440-selected.png), [390](reward-four-390-last-selected.png),
[375](reward-four-375-last-selected.png), [320](reward-four-320-last-selected.png).
The phone images show the lower row after a real tap on the last choice.

All 24 reward states passed equal face/button dimensions, unclipped text,
44px button floors and selection assertions. Core hand/Smith checks passed all
four viewports. Source tests passed 69/69, then 25/25 changed tests; UI validation,
standalone build and 439-site plant check passed. The legacy Smith gate remains
red: the same explicit-profile gate on clean baseline `2bcd337f5` reproduces
all seven common failures and its unchanged post-hold navigation timeout.
No legacy Smith/progression acceptance or physical-device performance is claimed.
