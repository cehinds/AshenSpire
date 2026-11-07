# SPEC history — §5 Content specification and §6 Map generation

Archive of rationale, dates and superseded values moved out of SPEC.md by the concise rewrite. Not rules.

### From §5.1 Classes, creation presets, and levels

- `tuned` starting flask allocation column: "the owner's defaults, `classes.js`, #1273".
- Level curve history:
  - "A fresh run starts at displayed level 1 and the level is EARNED (plan phase 6, §13.4i)".
  - Linear example: "at base 100 and `multScaler` 1.3 (the October 1 default)".
  - "Since 2026-10-02 (owner) the character default is exponential (`linear: false`): base 100, growth 1.75, roundTo 10 — steps 100, 180, 310, 540, 940, 1,640, 2,870, 5,030, 8,800, 15,390, so 35,800 XP reaches level 11."
  - "**Changed (owner, 2026-11-05, §13.4o):** base 200, growth 1.5, roundTo 10, cap level 20 — steps 200 … 7690 (level 19 costs 295,580; 886,350 XP from level 1 to 20); supersedes the ×1.303 curve."
  - "Historical exponential curve receipt (base 5 / growth 1.15 / rounding 10 — owner, 2026-09-24): the steps from level 1 cost 10, 10, 10, 10, 10, 10, 10, 10, 20, 20 — 120 XP to level 11 (the rounding holds the first eight steps at its floor of 10); the old curve's steps were 100, 120, 130, 150, 170, 200, 230, 270, 310, 350 — 2,030 XP."
  - "The historical awards were `balance.xp` combatWin 15 and kill normal 5 / elite 75 / boss 200 (50 and 25 / 75 / 200 before 2026-09-24)."
  - "The equipment skill tracks (`balance.skill.xp`) and the class track (`balance.skill.class.xp`) historically opened at base 5 too (30 and 60 before); the October 1 defaults use base 100, and since 2026-10-02 (owner) both use the exponential curve (`linear: false`, growth 1.75, roundTo 5): steps 100, 175, 305, 535, 940 — 2,055 XP to level 5. The character level uses the same ×1.75 growth."
  - "**Changed (owner, 2026-10-04, §13.4o):** every track's max level costs about 100,000 XP — character base 200 ×1.5 to level 20 (owner, 2026-11-05), class base 400 ×1.224 to level 20, skill base 100 ×1.995 to level 10; applied 2026-10-05." "The 11–12 levels a full run earned (measured: 11.5)".
  - "the ladder that priced purchases (`firstCost + costStep × n`, measured twice against the faucet) is gone with the purse."
- Cinders: "(owner, 2026-09-24). A run opens with `balance.startingCinders` **20** cinders (0 before)." The retired multiplier: owner, 2026-09-24: "I hate the 20x cinder, that needs to die". The owner's exported `progression.rewardMultiplier: 20`.

### From §5.3 Enemy roster

- "Weaknesses (owner, 2026-10-31): every enemy in this roster and the later acts has authored weaknesses".
- "the seat the act-1 rows became" for `encounters/weald.js` (history of the encounter table move).

### From §5.5 Flasks

- Capacity "(`balance.flaskCapacity`; owner, 2026-09-24 — 4 before)". Act change "(owner, 2026-10-27): the owner said "Refull potions between acts", and "potions" means the HP and MP flasks."
- Keepsakes: "(quest-event choice effects; keepsakes, its first caller, were removed with the keepsake cleanup)" — keepsake mechanic removed (2026-11-07); deleted from SPEC as obsolete.
- §5.5.1: "The earlier “3 HP and 3 Mana” vessel reading is superseded by the approved shared pool (4, then 3 since 2026-09-24). It remains history, not a second implementable mode." Class openings "(owner, 2026-09-24; `3 / 1` and `2 / 2` on the pool of 4 before)".
- §5.5.2 quote: "Constantine, 2026-08-08 (D17 message 6): *“…those two are locked in with 3 charges, with upgrade options via relics or quest events or talismans or flask seeds to increase the amount of charges”*." D19: *"future unlocks for larger total amount"*. "(his four words, …)". "machine-enforced since run schema v3" and the "cleanup" rationale: a re-derivation of capacity from the chain alone would silently delete granted charges.
- C1 seam: "Capacity is one freely reallocatable pool; its approved new-run default is 4. The older 3-total and 3-each readings are superseded history, not alternatives."

