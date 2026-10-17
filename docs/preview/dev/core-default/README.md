# Core default: native visual evidence

Captured on 2026-10-17 from the portable **0.7.1.1543** build at `http://127.0.0.1:4462/AshenSpire.html`, using Chromium and JPEG quality 85. [Open the screenshot gallery](index.html).

These are native screenshot fixtures (`shot=combat` / `shot=map`, `gameProfile=core`, seed 3). The combat fixture requests three enemies. Ready and Smash use the mounted stage's own `setStance` method. No DOM cloning, replacement artwork, or CSS overrides were used. The fixture captures appearance; it does not certify a card play, damage, rewards, or a completed run.

Body height measures the semantic head/helmet top to supporting feet, excluding the weapon, effects, transparent canvas and decorative extensions. Ready and held Smash preserve that distance and the floor. The complete mini HUD follows the body head with a five physical pixel gap. The same native shared header supplies HP, relics, menu controls and Cinders in combat and on the map.

| Form | Viewport | Ready / Smash body height | Measured HUD gap | Screenshots |
| --- | --- | --- | --- | --- |
| Desktop | 1440 × 900 | 206.18 px / 206.18 px | 5.01 px | [Ready](desktop-ready.jpg) · [Smash](desktop-smash.jpg) · [Map](desktop-map.jpg) |
| Tablet | 820 × 1180 | 169.37 px / 169.37 px | 5.01 px | [Ready](tablet-ready.jpg) · [Smash](tablet-smash.jpg) · [Map](tablet-map.jpg) |
| Mobile | 390 × 844 | 93.09 px / 93.09 px | 5.01 px | [Ready](mobile-ready.jpg) · [Smash](mobile-smash.jpg) · [Map](mobile-map.jpg) |

No horizontal page overflow was measured in these six combat captures. Weapons can extend above the head and outside the body envelope; they do not determine normalized body height. Transient action motion has separate engine and stage tests. Raw geometry JSON remains outside the repository.
