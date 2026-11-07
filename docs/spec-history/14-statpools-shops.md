# SPEC history — Configurable stat pools (§13.4s) and §14 The deck editor and the three shops

Archive of material moved out of SPEC.md by the SpecConcise pass (2026-11-07). Not rules.

## Configurable stat pools, ratings, Poise and Ward

- Pre-ruleset-7 older formulas (before the owner's 2026-09-24 weights): AR=floor(STR/2), DR=floor(DEX/2), PR=floor(INT/2)+floor(WIS/2), Poise=1+CON+floor(STR/2), Ward=1+WIS+floor(INT/2).
- Rationale for the base of 1: "a vessel of nothing is not a vessel."
- Owner quotes on break behaviour (2026-10-12): "on poise break yes"; "any break but vulnerable to any damage type".
- Ruleset 7 = the default formulas AR=STR, DR=DEX, PR=INT, Ward=1+WIS, Poise=1+CON; the owner's 2026-09-24 weights are the frozen set for earlier runs.

## 13.4s Core card upgrades

- Heading was "13.4s Core card upgrades: free by rank, a stone past that, ten at most (owner ruling, 2026-10-28)".
- Owner ruling 2026-10-28 (Core only). 2026-10-31 owner asks: the Blacksmith cost (every upgrade costs `blacksmith.prices.cardUpgrade` cinders), the picker showing every upgradable owned card, the option list with identity steps, and the choice of 2 or 3 options. 2026-11-01 owner: a cantrip or Basic costs no Mana; `core.mendingTouch` now prints 0 MP.
- Removed as obsolete: the "co-op keeps the single roll" clause (no co-op reader in src/ besides comments).
