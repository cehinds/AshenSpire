# Smith narrow-row visual check

Captured 2026-10-20 with headless Chromium at 320×844 (current and Core profiles) and 390×844 (current profile). The page used the real Shrine Smith flow: `?gameProfile=current&shot=rest&shotSmithingStones=1`, selecting `armament/straightSword`; and `?gameProfile=core&shot=rest`, selecting `armament/greatsword`.

The source UI was served from `cehinds/AshenSpire` worktree `worker/CombatClarity/smith-gate` at `f147b56d5ab1400c048c92c92c98ebed1663d20a`. The narrow Smith rules from `worker/CombatClarity/smith-labels` commit `85223fd52` were applied as a page stylesheet during capture. The current profile shows `5 → 8`, `2 → 5`, and `STR 2 → 1`; the Core profile shows `AR 1 → 2` and affected-card values. The displayed text was visually checked for clipping; document horizontal overflow was zero. Card folds remain closed in these captures.
