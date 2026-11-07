# SPEC history — preamble, §1, §2

Archive of material moved out of SPEC.md. Not rules.

## Title and preamble
- Formerly "Spire of the Erdtree / EldenSpire", renamed in the IP scrub, `95c3b87`.
- Known-debt note: "stated once here rather than apologised for per section". The broad mechanical rename act once proposed was dropped by owner decision, 2026-09-27.
- The original brief this spec expands (PROMPT.md) was removed 2026-10-11.
- Stance combat continuation: owner, 2026-10-14. Combat clarity corrections: owner, 2026-10-20.

## Scope status — evidence
Checked 2026-09-27 against `dev` @ `7f78c5d0` (build `0.7.1.625`). Rows 14 and 13.4p–r re-checked 2026-10-10 against `dev` @ `73a1342aa` (build `0.7.1.1262`); other rows as of 2026-09-27.

- top: parts serve live play (the Dodge Roll in `src/framework/weight.js`, §12.1); cutover not performed ([framework-cutover-report](framework-cutover-report.md)).
- 1: 4 classes, 3 seats climbed as 3 tiers, profile and slots.
- 2: attribution `tools/credits-check.mjs`, 40 checks, 33/33 asset directories (FINISH §10). 138 literal `url('../assets/…)` references in six `styles/` files (`grep -rc "url('../assets" styles`; e.g. `styles/combat.css`, `styles/ui.css`) bypass `assetUrl()` and its fallback (DEVELOPER.md, *high-res release*).
- 3: run schema at `RUN_SCHEMA_VERSION` (`src/model/state.js`; `tests/save-migration.test.mjs`); `validateContent` 0 errors.
- 4: §4.7 shared player/enemy tags, deferred Counters, typed riders and persisted stance reads shipped in #1705 with solo engine and browser regressions. Warrior's Vow enters the chosen stance.
- 5: Warrior's Vow (§5.2) offers every stance of the player's class and enters the chosen one. 5.2–5.4 are the historical M1/M2 sets reconciled to canonical names and values of current definitions. Live counts: 292 card definitions in the composed bundle (class reward pools after class-mastery composition: Reaver 53, Starseer 59, Rogue 57, Herald 49), 73 relics (63 base plus 10 class-mastery), 25 events, 7 flasks, 33 enemies (20 regular, 10 boss, 3 elite).
- 6: `engine/mapgen.js`, `tools/mapplan.mjs`. 8: `tests/run-node.mjs`.
- 11: narrow layout and audio shipped.
- 13: Phase 0 of the former seat-adventure proposal (removed 2026-10-11; see git history).
- World Journey etc.: `ui/screens/worldAtlas.js`, `legacyDungeon.js`, `prologue.js`; `src/content/derivedStats.js`.
- 14: SPEC section #1331; step 2 deck rules/sideboard/ordered draw #1343 (`tests/deck-rules.test.mjs`); step 3 deck editor UI #1372 (`tests/deck-editor.test.mjs`); step 4 shop kinds #1371 (`tests/shop-kinds.test.mjs`); step 5 market additions in the PRs FINISH §14 links; step 6 blacksmith #1390 (`tests/blacksmith.test.mjs`); step 7 wise master #1438 (`tests/master.test.mjs`).
- 13.4p–r: §13.4p (D49) one Poise break meter, Ward and Arcane Exposure folded into Poise, #1646 (SPEC) and #1653 (`tests/single-break-meter.test.mjs`, `tests/poise-restamp.test.mjs`). §13.4q (D52) class mastery on the profile, #1654, #1655, #1658 (`tests/class-mastery-profile.test.mjs`, `tests/class-mastery-run.test.mjs`, `tests/class-mastery-content.test.mjs`). §13.4r feat slots and attribute points shared across class swaps, #1811 (`tests/progression-expansion-core.test.mjs`).
- 15: SPEC section #1348; §15.1 #1351 (`tests/card-reward-schedule.test.mjs`); §15.2 #1349 (`tests/level-pace.test.mjs`); §15.3 #1352 (`tests/crafting-drops.test.mjs`); §15.4 #1455 (`tests/legendary-sigils.test.mjs`), to the shapes of #1439.
- Row 13 owner decisions dated 2026-09-27 (post-1.0 list; companions owned by §14.3). Row 11: multiplayer (LAN co-op) removed 2026-10-31.

## Combat and equipment revision
- Scope for 1.0 ruled by owner D3, 2026-09-24.

## 2.1 The AI-use acknowledgement
Rationale: one fact with two hand-maintained copies is a player comparing the store page to the game and reading two different claims. The arrangement is enforced rather than intended. The runtime claim "previously existed twice, in different words, so no comparison could ever have caught them diverging."

> This paragraph used to be a SECOND COPY of that boolean, and it went stale exactly as predicted (Saga, 2026-08-07: "this sentence is a second copy of a boolean and it went stale the day the boolean moved"). It said `approved: true` while the module said `false`, giving the release gate two authoritative answers.
>
> Saga named the honest fix and it is now done: the spec cites the module rather than restating its value. The 2026-08-07 note declined it only to avoid restructuring another seat's file. `docs/SPEC-RECONCILE.md` still carries a third prose copy; it is a historical row recording what change #73 did, annotated rather than rewritten, and the remaining copy that will go stale the next time the flag moves. (AS-HD-040, 2026-09-03.)
