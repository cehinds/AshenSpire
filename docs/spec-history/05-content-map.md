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

### From §5.6 Events

- What-changed receipt: "(owner ask, 2026-10-31)".
- "Every event is a real trade-off, StS-style."
- Quest chains heading: "(E12, #257)"; completion heading: "(plan phase 10a, proposal §7.5)".

### From §6 Map generation

- Floor anchors, measured: `9: 'treasure'` deletes the treasure rank entirely below 10 floors (4.00 → 0.00 nodes per act, 24 seeds); `noEliteOrShrineBefore: 6` (the single gate the two anchors replaced) gated 36 % of a 15-floor act and 56 % of a 10-floor one; `15: 'shrine'` never fired at any shipped act length because floor 15 is not rollable.
- `restBeforeElite`: E13, Constantine asked for a rest "so eletes, maybe shop, and definitely before a boss"; before-a-boss the top-floor Shrine always kept, before-elites nothing did (124 of 180 maps over the canonical seed stream carried an Elite with no Shrine below it; 0 of 180 now). A single `noEliteOrShrineBefore` opened rests and Elites on the same floor, so a rest could never sit below the first Elite. Enforcing only where the generator relaxes was not enough: 10 of 40 maps broke the promise via a fixed Elite rank. It moved the shortest act from 4 floors to 7.
- `minElites` "was called `minReachableElites` and never measured reachability"; numbers not restated because "three homes carried three different samples within a day of each other".
- Unknown weights: "It was `balance.unknownNode`, a flat global that could not vary per act".
- Node counts: "the previous edition of this sentence carried 59.2 over 50–69, which the 12-floor act made false the moment it landed". A tool that generates one map and reports a number has said nothing.
- Core preview route "(owner, 2026-10-18)". Core branched map "(owner, 2026-10-25)"; `maxBranches` Core cap 3 "(owner, 2026-10-27)".
- Owner quotes, 2026-10-27: "I noticed that the map seems to re[group] at rest points, it should be branching trees without rejoining. so one starting point, but 1-3 separate branches", then "it can remerge but not consistently". Sub-branches: "Refull potions between acts, each branching path should also branch but join into one boss. So 3 main branches each with a boss but those sub branches can branches too", clarified as: main branch count stays 1-3.
- Measured over 200 seeds x 3 acts: 71.6% of branches open with one node (all two-lane branches, half of three-lane ones), 1.26 fork edges and 3.8 distinct paths per branch, remerge 17.7% of eligible gaps.
- Rewards: card choice count "(owner, 2026-11-05)"; merchant prices "(the old rune prices ×3)".

### Second tightening pass (evidence moved out of rules)

- Tests/contracts proving shipped state: `tests/act-change-flask-refill.test.mjs` (act-change refill); `tests/game-profile-map.test.mjs` (distinct bosses, narrow openings, outward forks, rests per existing lane, no collapse at rests, rare remerges over 200 seeds, per-lane elite, branch-local edges, reachability, identical replays) and `tests/core-rest-sites.test.mjs`; `tools/quest-choice-contract.mjs` (gates, ids, engine door for the quest chain).
- Quest completion: `RUN_SHAPE` is unchanged by `questCompleted`; "nothing else emits" `questCompleted`; run-history rows carry no wall clock. Dialogue screen ids W4c, WGQ0–WGQ8. Choice-level quest example: the digger may repay or fight, the mourner is thanked; Second Cairn answers: the vigil, the rest, or a second looting.
- Rogue: "not a selectable shell"; art "needed for every authored Rogue kit"; presets "derived from the registries rather than new Rogue-only branches".
