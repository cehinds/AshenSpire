# Card and reward clarity browser evidence

Captured 20 October 2026 from source commit `c8277c4428896828a31e859ef80aaf62926ebd99` (runtime UI identical to
`47f9d36ab9c29ff873d56ab6d16251e787cbb98b`). The latter built successfully as
**0.7.1.1735**, digest **44abeebe16**, using the verified v23 light/common art
cache. These images show the source application, not the compiled standalone.

Chromium 154 on Linux, headless, device scale 1. Phone views use touch-enabled
viewport emulation; this is not physical Galaxy A32, iPhone, or Safari evidence.
All states are posed fixtures, not completed playthroughs.

| Viewport | Compact Core hand | Closed Core upgrade rows | Reward choices |
| --- | --- | --- | --- |
| 1440 × 900 | [Hand](hand-core-1440.png) | [Smith](smith-core-1440.png) | [Selected](reward-1440-selected.png) |
| 390 × 844 | [Hand](hand-core-390.png) | [Smith](smith-core-390.png) | [Selected](reward-390-selected.png) |
| 375 × 667 | [Hand](hand-core-375.png) | [Smith](smith-core-375.png) | [Selected](reward-375-selected.png) |
| 320 × 568 | [Hand](hand-core-320.png) | [Smith](smith-core-320.png) | [Selected](reward-320-selected.png) |

The real desktop [Information door](hand-inspection-1440.png) retains automatic
Entry text. Compact hand attacks omit it; authored effects remain intact.
Smith shows the actual `AR 1 → 2` tier change in Equipment Stats and closed
summaries, without mixing in the legacy item's base AR.

Four-choice fixtures render the production reward component with authored
Frost Nova, Starstone Arc, Scholar's Insight, and Strike offers. Phone choices
use two columns with ordinary vertical scrolling; the last-choice images prove
the lower row is reachable by touch:

- [Desktop](reward-four-1440-selected.png)
- [390 px, last choice](reward-four-390-last-selected.png)
- [375 px, last choice](reward-four-375-last-selected.png)
- [320 px, last choice](reward-four-320-last-selected.png)

[geometry-final.json](geometry-final.json) records 24 checked states:
three/four offers × four viewports × unselected/first/last selected. Every
state has equal face and button widths/heights (within 1 px), unclipped button
text, buttons at least 44 × 44 px, and correct selection. Phone selections used
real Playwright touch taps. [core-proof.json](core-proof.json) records the three
phone Core hand/Smith checks: closed summaries contain numeric deltas, no
horizontal overflow, compact attacks contain no automatic Entry clause, and no
uncaught page errors. Desktop assertions also passed, including opening the
actual Information control; its initial capture script subsequently stopped at
an incorrectly toggled phone selector, which was corrected before the phone
rerun.

Validation: 69 focused tests passed, followed by 25 changed card/Smith tests on
the final model. Standalone build and UI validation passed. `plantsites` passed
all 439 scanned sites against its existing baseline.

The existing `armament-smithing-ui` gate does **not** pass. With its historical
`gameProfile=current` fixture named explicitly, the clean load-door baseline
`2bcd337f58d1213602de7bce2e50130a14fe0236` reproduces the same legacy AR/STR,
role-usage, typography, and navigation expectations that fail on this UI branch.
The new armor summary check fails on that baseline and passes here. Original
behavioral predicates and deadlines remain intact. This evidence does not claim
broad legacy Smith or progression acceptance.
