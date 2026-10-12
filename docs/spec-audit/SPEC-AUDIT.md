# SPEC.md audit against `dev`

Audited 2026-10-11 at `dev` `f42a38e2`. Read-only audit: each SPEC.md section checked against the code that implements it (`src/`, `content/`). Coverage is not exhaustive: §12's per-item verdicts live in `docs/SPEC-RECONCILE.md` and were not re-checked, browser-only claims were not run, and a "Matches" section means no drift was found in the rules checked, not that every sentence was traced. Sections are grouped by status (stale first), then in SPEC order. Each item: the SPEC lines, the code `file:line` showing real behaviour, and the proposed fix.

Owner decisions (2026-10-11): SPEC follows the code. Actions and Stamina are one pool (`energy` is the retired alias). Code defaults that disagree with SPEC are written into SPEC. Never-built sections are removed from SPEC.

## Outcome (PR #1863)

SPEC.md was corrected in this PR, one section range per commit wave, following the owner's decisions above. These items were left unchanged because each needs an owner decision:

- §3.2 L192-194: "content imports nothing", but `src/content/prototypes/combatBuilds.js` imports engine modules, and content imports `framework/` and `config/`.
- §3.8 L536-538: `extractionRefusal` also honours a stored `run.poolDeck` flag; SPEC says it never reads a stored field.
- §4 L810-813: the `"carry"` Stamina rule has no effect on turn 1 (`src/engine/combat.js:503-504` refills).
- §5.1: is `classDef.maxHp` a live HP input or a dead seed?
- §5.1: four Rogue outfits in SPEC, eight rows in `outfits.csv`.
- §5.2: Guard Counter is a direct hit in SPEC, a prepared counter in its card text.
- §6: bosses drop a boss-relic choice of 3 in SPEC, one relic in `src/main.js`.
- §7.2: enemy cap, 5 (UI `maxRows`) or 6 (formation rows)?
- §7.2: which gate checks the five named viewports, and the settings door geometry?
- §7.2.1: Export configuration shows only on debug pages; expose it on release pages?
- §8: release-shots has no CI runner; name one or mark it manual.
- §11: is LAN co-op in the current release set?
- §12.5: the resting-stance animation rules need a browser check.
- §13.4p: new runs stamp `breakMeterVersion` 2, so the one-break-meter rule is not live.
- §13.4r: cards still pay `upcastSurcharge` (`src/engine/combat.js:1213`).
- Scope table L29: "195 cards (40 per class)" against a 36-card pool; card totals were not counted.
- §3.4 L242: `addRunes` is `addCinders` in code (left per the preamble's vocabulary rule).
- §3.6 L391-392: are `staggerBreak` and `resonance` live, and does §13.4k gate them?

## Headline: Actions and Stamina are one resource

- `energy`/`energyMax` are getter aliases of `stamina`/`maxStamina` (`src/model/turnStamina.js:3-12`).
- Card cost is deducted from that one pool: solo plays at `src/engine/combat.js:1387`, the terminal Ashen Blight path at `src/engine/combat.js:1367`, co-op plays at `src/engine/coopCombat.js:817`. All three write `energy`, which is `stamina`.
- The `energy` stat row is "Retired save row; combat reads Stamina" (`src/content/derivedStats.js:74`).
- `balance.mana.minStaminaCost` is 0 (`src/content/balance.js:389`); Mana is the second cost line.
- SPEC text affected: L300-335, L627-628, L800-801, L1245/L1270, L1735, §13.4k L2281-2288.

## Stale (51 sections)

### Scope status — what is built, partly built and planned (SPEC L18-42)

- [ ] **stale** SPEC L27 (row 3): "Run schema 11 (`RUN_SCHEMA_VERSION` in `src/model/state.js`)"
  - Code: `src/model/state.js:108` `export const RUN_SCHEMA_VERSION = 23;`
  - Fix: change "schema 11" to "schema 23" (or drop the number and cite the constant).
- [ ] **stale** SPEC L26 (row 2): "14 CSS `url(../assets/…)` backdrops (for example `styles/combat.css`, `styles/ui.css`) still bypass `assetUrl()`"
  - Code: literal `url('../assets` appears 138 times across `styles/`: `styles/player-polish-icons.css:79`, `styles/player-polish.css:28`, `styles/kit.css:25`, `styles/combat.css:3`, `styles/ui.css:2`, `styles/corrupted-cards.css:1`
  - Fix: restate the count from a grep that CI can rerun, and name the files by count.
- [ ] **unclear** SPEC L29 (row 5): "195 cards (40 per class, 35 colorless)"
  - Code: `src/content/cards/reaver.js:1` header says the pool was "grown to 30", and `src/content/cards/reaver.js:542` says "rounding the pool to 36"; the 36-card pool is also stated in SPEC §1 (L67-79) and §5.1
  - Fix: reconcile "40 per class" with the 36-card pool, or cite the count command; the card total was not counted here.

### 3.1 Layers and design laws (SPEC L139-158)

- [ ] **stale** SPEC L156 (law 4) and L158 (law 6): "`content/balance.js`" and "`content/scripts.js`"
  - Code: the files are `src/content/balance.js` and `src/content/scripts.js` (no `content/balance.js` or `content/scripts.js` at repo root; `content/` holds only `config/ framework/ hud-layout/ source/`)
  - Fix: prefix these paths with `src/`.
- [ ] **stale** SPEC L143-145 (law 5, headless engine): "Nothing under `src/engine/` or `src/model/` references `document`, `window`, `localStorage`, or timers"
  - Code: `src/model/offlineDownload.js:249` and `:261` call `setTimeout`, and `src/model/offlineDownload.js:300` calls `setTimeout` and builds a `DOMException`; `src/engine/save.js:1346` mentions localStorage only in a comment
  - Fix: move `offlineDownload.js` out of `src/model/` into `src/ui/` or an injected-timer seam, or narrow law 5 to name that exception.

### 3.2 File tree — the layer contract (SPEC L160-195)

- [ ] **stale** SPEC L192-194 (the "one rule"): "`content` imports nothing"
  - Code: `src/content/locationScenes.js:1` imports `../model/locationPresentation.js`; `src/content/index.js:11` imports `../model/progressionContent.js`; `src/content/index.js:73` imports `../model/enemyMoveSources.js`; `src/content/music.js:22` imports `../model/schemas.js`
  - Fix: either fix the four imports to move data out of `model/`, or change the rule to "content imports only `model/` schemas and constants".

### 3.3 Domain model, registries, and state (SPEC L196-220)

- [ ] **stale** SPEC L203 (Relic row, "Today:" passive list of nine keys: `runeGainMult, eliteExtraCardReward, flaskPowerMult, revealUnknown, restHealMult, restDenied, powerCostReduction, swapCostDelta, exposureBuildupMult`)
  - Code: `src/model/schemas.js:317-349` `PASSIVE_TYPES` has 19 keys, including `arBonus, drBonus, prBonus, poiseBonus, wardBonus, poiseThresholdAdd, magicalImpactAdd, skillXpMult, retainBlockUpTo` (`schemas.js:318` onward)
  - Fix: replace the nine-key list with "the keys of `PASSIVE_TYPES` in `src/model/schemas.js`", as the Relic row already says it has one home.
- [ ] **unclear** SPEC L219 ("Player intents are a closed set": `playCard`, `endTurn`, `useFlask`, `discardFlask`, `chooseMapNode`, `chooseReward`, `restAction`, `shopAction`, `eventChoice`, `abandonRun`)
  - Code: the solo combat dispatch switch at `src/engine/combat.js:850-915` handles `setReactions`, `chooseReaction`, `predictIntent`, `recoverControl`, `chooseBlightFeat`, `chooseDiscard`, `moveCharacter`, `playCard`, `endTurn`, `useFlask`, `swapArmament`, `changeEquipment` (co-op mirrors `playCard`/`endTurn`/`useFlask` at `src/engine/coopCombat.js:674`, `:889`, `:937`). No symbol named `discardFlask`, `chooseMapNode`, `chooseReward`, `restAction`, `shopAction` or `abandonRun` exists in `src/engine` or `src/model`. Run-level actions are per-screen functions (for example `src/engine/locations.js:121` `restAt`)
  - Fix: say the closed set is the combat dispatch at `combat.js:850-915` and list all twelve names, and describe run-level actions as screen functions.

### 3.4 Effect DSL (opcodes) (SPEC L221-278)

- [ ] **stale** SPEC L239 ("Opcode list (closed set; extending it is an engine PR)")
  - Code: `src/engine/actions.js` handles opcodes beyond the list, including `restoreStamina` (`actions.js:1078`), `restoreMana` (`:1085`), `gainBarrier`, `grantCardCharge`, `grantRollMode` (`:845`), `refillFlasks`, `stagger` (`:1175`), `wardDamage`, `arcaneBuildup`, `buildup`, `addFlaskCapacity`
  - Fix: add these to the list, or state which are engine-owned extensions and when they were added.
- [ ] **unclear** SPEC L242 (run-level `addRunes`)
  - Code: `src/engine/actions.js:1242` `case 'addCinders'`, `src/model/schemas.js:79` and `:562`, `src/engine/combat.js:1774`
  - Fix: this is the known pre-scrub vocabulary debt named in the SPEC preamble (runes = cinders); leave it, or record `addCinders` in the list as the shipped name.

### 3.5 Formulas and the stat-row table (SPEC L279-370)

- [ ] **stale** SPEC L331 (row "Actions / turn (`energy`)", a separate budget row; "Engine id stays `energy`"). Code, exact behaviour:
- [ ] **stale** SPEC L334 (row "Hand size (`handSize`)": base 15, no INT, "1–15", "Flat absolute capacity by default")
  - Code: `src/content/derivedStats.js:92` `handSize: { base: 7, intelligence: 0.2, attributeBaseline: 4, min: 1, max: 20 }`, with the owner's 2026-10-11 change noted in the comment block directly above `openingHand` (`:82`)
  - Fix: restate the row as base 7, INT 0.2 above baseline 4, cap 20.
- [ ] **unclear** SPEC L343 ("Defense `-6 + DEX`", "Strike `-6 + STR`", "Magic `-6 + WIS`" in the Output table)
  - Code: no `-6` base for these outputs was found in `src/content/` or `src/model/`; the basic profiles carry literal `baseValue` and `ratingId` columns, e.g. the data rows after the `#` header comments in `content/source/basicCardProfiles.csv` (`unarmedAttack,...,3,ar`, `unarmedGuard,...,1,dr`)
  - Fix: replace the formulas with a pointer to the `baseValue`/`ratingId` columns of `content/source/basicCardProfiles.csv`, or name the code home of the `-6` rule if it exists.

### 3.7 Status model (SPEC L393-430; outside the 3.1-3.6 brief, inside the line range)

- [ ] **stale** SPEC L399-405 (schema: `meter?: { max, growthMult, onFill }`)
  - Code: no status row in `src/content/statuses.js` uses `meter:`; build-up statuses use `proc:` (`statuses.js:82` bleed, `:103` frost). The engine reads `def.proc` (`src/engine/statuses.js:70`, `:91` sets `inst.meter = { value: 0, max: def.proc.threshold }`)
  - Fix: document the shipped key as `proc: { threshold, burstPercent, burstMin, burstMax, poiseDamage, resistance }`.
- [ ] **stale** SPEC L410-415 (bleed example: `meter: { max: 12, growthMult: 1.5, onFill: percentMaxHp 15, min 8, max 35 }`)
  - Code: `src/content/statuses.js:76` `id: 'bleed'`, `stackMode: 'add'`, `decay: 'none'`, `proc: { threshold: 7 (:83), burstPercent: 15 (:84), burstMin: 8 (:85), burstMax: 35 (:86), poiseDamage: 3 (:87), resistance … }`; no `max: 12` and no `growthMult: 1.5`
  - Fix: replace the example with the shipped `proc` block.
- [ ] **stale** SPEC L427 ("Poise/Stagger uses the same meter model … `onFill` applies a `staggered` status … `growthMult: 1.25`")
  - Code: `src/content/statuses.js:308` `staggered` is `stackMode: 'refresh'`, `decay: 'perTurnEnd'`, `modifiers.damageTakenMult: 1.5`, with no `meter`; `growthMult` appears in no content row (grep of `src/content/`); the poise break meter is in `src/model/breakMeter.js:1-12` (`breakMeterIds` returns `['poise']` or `['poise','ward']`)
  - Fix: say Poise is the break meter in `src/model/breakMeter.js`, with `staggered` as its status, and drop `growthMult: 1.25` unless the code gains it.
- [ ] **unclear** SPEC L416-421 (`scarletRot`, decay `{duration: 3}`, a `ownerTurnStart` hook)
  - Code: no `scarletRot` id; `src/content/statuses.js:218` `id: 'crimsonBlight'` with `decay: { duration: 3 }` (`:223`) and a `hooks` array (`:224`); the rename is in `docs/IP-SCRUB.md:43`
  - Fix: rename the example to `crimsonBlight` (the preamble already allows reading old names through the map).
- [ ] **unclear** SPEC L424 (`frostbite`: `stackMode 'unique'`, `decay 'onConsume'`, "+30% on next big hit")
  - Code: no `frostbite` id; `src/content/statuses.js:97` `id: 'frost'` with `stackMode: 'add'` (`:101`) and `decay: 'none'` (`:102`)
  - Fix: rewrite the example as `frost`, or mark `frostbite` as planned.

### §3.8 Procedural systems — generator table (SPEC L431-440)

- [ ] **stale** SPEC L435: "`mapgen.js` + `floorplan.js`" listed under "Algorithm (code, in `src/engine/`)"
  - Code: src/engine/mapgen.js:11 imports `../model/floorplan.js`; there is no src/engine/floorplan.js (the file is src/model/floorplan.js)
  - Fix: change the row to "`src/engine/mapgen.js` + `src/model/floorplan.js`".
- [ ] **stale** SPEC L436: knob "`encounters/actN.js`"
  - Code: src/content/encounters/ holds marches.js, reach.js, weald.js, one per seat (src/content/encounters/marches.js:1; src/content/index.js:38-40)
  - Fix: change to "`encounters/<seat>.js` (marches, reach, weald)".
- [ ] **stale** SPEC L437: algorithm "rarity rolls + pity/decay counters, `encounters.js`"
  - Code: rarity odds live in src/model/rewardOdds.js (src/engine/encounters.js:65-68 says so); the StS-style decaying flask chance is src/engine/encounters.js:233-240
  - Fix: "rarity odds in `model/rewardOdds.js`; flask decay in `encounters.js`".
- [ ] **unclear** SPEC L437: knob "`balance.js`: odds tables, rune ranges, flask-drop decay"
  - Code: flask decay is src/content/balance.js:573-574 (flaskDropBasePct, flaskDropStepPct); no rune-range knob exists in src/content/balance.js; sockets and runes are authored in src/content/prototypes/combatEquipment.js and checked in src/model/equipmentCombatProfile.js:9-28
  - Fix: name the real rune-range home, or drop "rune ranges" until one exists.

### §3.8 Armaments: what a swap costs (SPEC L442-451)

- [ ] **stale** SPEC L450 (`persistence` in the `basicTag` row): "`persistence` ... profile-wide (`both`, the shipped default) vs this-run-only (`perRun`)"
  - Code: the shipped default is `persistence: 'perRun'` (src/content/balance.js:2087); src/model/loadout.js:820-821 treats any value other than 'perRun' as profile-wide and any value other than 'unlocked' as counting carried items, so `both` is never a stored value and 'unlocked' is also read
  - Fix: "shipped default is `perRun`; any other value is profile-wide; 'unlocked' is also read (loadout.js:820-821)".

### §3.8 The starting deck (SPEC L461-494)

- [ ] **stale** SPEC L477-480: "That is a balance question ... validateEquipment says so as a warning, naming the class and the loadout"
  - Code: the warning is built at src/model/loadout.js:1600-1601 and only exposed through `startingDeckWarnings()` (src/model/loadout.js:1425); `validateEquipment()` (src/model/loadout.js:334-350) returns `problems` only; the sole caller of `startingDeckWarnings` is tests/engine.test.js, so the author never sees this warning in the game or the validator
  - Fix: have `validateEquipment`'s caller surface `startingDeckWarnings`, or reword the spec to say it is a test-visible finding.

### Shield signature Arts (SPEC L625-634)

- [ ] **stale** SPEC L627-628: "Guardian costs 1 Energy ... temporary 1-Energy Enter: Bulwark"
  - Code: src/content/cards/armaments.js:8 says "1 Stamina"; energy is an alias of the one Stamina pool (src/model/turnStamina.js:3-12)
  - Fix: say "1 Stamina" in SPEC.

### §3.10 Event bus (SPEC L641-660)

- [ ] **stale** SPEC L643 ("the authoritative set is `EVENTS`") and L655 (`equipmentChanged(...)`):
  - Code: `equipmentChanged` is emitted at src/engine/combat.js:1183 and `equipmentRearmed` at src/engine/combat.js:1184 (the spec names `equipmentRearmed` at SPEC L448), but neither string appears in `EVENTS` (src/model/schemas.js:114-193); only `armamentSwapped` is listed (src/model/schemas.js:139)
  - Fix: SPEC follows code: say `EVENTS` lists the catalogued events and that `equipmentChanged` and `equipmentRearmed` are emitted outside it.
- [ ] **unclear** SPEC L653 "energyGained, energySpent" (engine id `energy`): the spec never says what `energy` is; it is the retired alias of `stamina` (src/model/turnStamina.js:3-12), shown to the player as Actions/Stamina (combat.js:1383 "Not enough Actions (Stamina)")
  - Fix: write "(legacy event names: `energy` is the retired alias of Stamina, the one cost pool)".
- [x] **built after this audit**: #1849 added `combatReactionUnavailable` and `combatGuardBroken` to the engine and tests, so the merged SPEC retains both event receipts.

### §3.11 Seeded RNG (SPEC L661-667)

- [ ] **stale** SPEC L664-665: "Named streams ... (the closed set is `STREAM_NAMES`, `src/engine/rng.js`)" with a list of 14 names
  - Code: STREAM_NAMES at src/engine/rng.js:10-58 has 23 names; the spec list omits rewardRolls, shopOffers, sigils, enemyIntentVisibility, combatAvoidance, statusRecovery, statusPressure, ashenBlight, enemyIntentClue (src/engine/rng.js:33-57)
  - Fix: say the list is the original set and point to `STREAM_NAMES` (rng.js:10-58), or list all 23.
- [ ] **unclear** SPEC L665-666: "`seats` is drawn exactly once, at run creation"
  - Code: run creation calls `drawSeatOrder` once (src/main.js:1255), which makes one `rng.shuffle('seats', ...)` (src/engine/actmap.js:119-120); a Fisher-Yates shuffle draws n-1 times from the stream (src/engine/rng.js:147-151), and the comment at src/engine/actmap.js:114-118 says "ONE draw"
  - Fix: "one shuffle call on the `seats` stream (n-1 counter steps, rng.js:147-151)".

### §3.12 Save format, and the durable profile (SPEC L668-756)

- [ ] **stale** SPEC L750-751: "`listArchives()` / `getArchive()` / `exportArchive()` / `replacePrimaryWith()` are reachable by the player from Profile on the title screen ... promote an archive back to primary"
  - Code: the public method is `restoreProfile(id)` (src/engine/save.js:1274-1288), which calls the internal `replacePrimaryWith` (src/engine/save.js:560, not on the returned API); the screen calls `saves.restoreProfile` (src/ui/screens/profileArchive.js:181, src/ui/screens/profileNotice.js:149)
  - Fix: replace `replacePrimaryWith()` with `restoreProfile(id)` in SPEC L751.
- [ ] **unclear** SPEC L672-673 "Neither number appears anywhere else, and a second copy of either is a defect" versus SPEC L712 ("Run schemaVersion 20") and L720 ("Run schemaVersion 3"), which restate bump numbers
  - Code: the current run schema is 23 (src/model/state.js:108), so those bullets are history, not current values
  - Fix: keep the bumps as dated history and say "current value: `model/state.js`", or drop the numbers.
- [ ] **unclear** SPEC L687-688 "A live action queue or event buffer is not a committed boundary and refuses the save"
  - Code: src/engine/combatSnapshot.js:45 refuses only when the buffer is open or the queue is nonempty and there is no `pendingAbilityDiscard` or `pendingReaction`; the spec has no exception
  - Fix: add "except a queue held by a pending reaction or ability discard (combatSnapshot.js:45)", or make the code strict.

### §3.14 Content validation (SPEC L764-783)

- [ ] **stale** SPEC L766: "`model/validate.js` runs at boot in dev mode and from the test page"
  - Code: src/main.js:182 calls `validateContent(contentBundle)` with no dev-mode gate, and a failed result shows an on-screen report at src/main.js:183 onward
  - Fix: "runs at every boot (src/main.js:182) and from the test page".
- [ ] **stale** SPEC L779-781 (item 7): "`property` is paired with, or written on, carrier families only — a card-family pairing or tagging row fails with *cards never carry properties*"
  - Code: src/model/validate.js:2893-2899 states the family gate is gone and "every family carries them"; no "cards never carry properties" refusal exists in src/ (grep)
  - Fix: delete the cards-never-carry clause and say any family may carry a property tag; the test title at tests/engine.test.js:8247 still says "never on a card" and should be renamed in the same change.

### Reward-card cost tuning and Actions wording (SPEC L800-808)

- [ ] **stale** SPEC L801: "Resource costs remain explicit card data, paid together with Actions"
  - Code: src/model/turnStamina.js:3-12 binds legacy `energy` as an accessor on `stamina` (and `energyMax` on `maxStamina`); src/engine/combat.js:1387 `p.energy -= cost` pays from that one pool, src/engine/combat.js:1392 only counts `staminaSpentThisTurn`; there is no second Actions pool
  - Fix: say card costs are paid from the single Stamina pool (`energy` is an alias), not "together with" a separate Actions pool.

### Recovery settings (SPEC L817-834)

- [ ] **stale** SPEC L828-829: "Stamina recovers `mechanics.stamina.idleRecoveryPerTurn` after an idle turn"
  - Code: src/engine/combat.js:113 `for (const pool of RECOVERY_POOLS.filter((id) => id !== 'stamina'))` excludes Stamina from idle recovery; src/engine/combat.js:73 comment "Stamina refills at turn start" and combat.js:503 refills it anyway; the stamina rows are hidden under `full` (src/model/recoveryRules.js:93, src/ui/screens/settings.js:310)
  - Fix: say Stamina idle recovery is not applied because the turn-start refill supersedes it, or remove the filter at combat.js:113 and wire it.

### 4.1 Turn loop: numbered sequence (SPEC L886-894)

- [ ] **stale** SPEC L889: "2. Player turn start: lose all block (unless modified), set energy to 3 (base), draw 5"
  - Code: src/engine/combat.js:503 sets energy to `energyMax` (the Stamina row, base 3 plus Strength/Dexterity/Constitution/Wisdom/Intelligence/level terms, src/content/derivedStats.js:98), and src/engine/combat.js:509 draws `turnDrawCount` (Draw row, base 4 plus Intelligence, src/content/derivedStats.js:91), not a fixed 5
  - Fix: "set Stamina to its maximum (Stamina row) and draw the Draw / turn row".
- [ ] **stale** SPEC L890: "excess drawn cards go to discard with a 'hand full' toast"
  - Code: src/engine/actions.js:636 `if (ctx.handRules && hand >= handMax) return;` stops the draw without consuming the draw pile for every run with hand rules (the default); the discard branch at src/engine/actions.js:646-648 is reached only without hand rules (legacy)
  - Fix: default runs stop drawing at Hand size; keep the discard wording for legacy fights only (the later paragraph at L858-860 already says this).
- [ ] **stale** SPEC L891: "discard hand except `Retain` cards" as the turn-end rule
  - Code: src/engine/combat.js:586 `returnUnplayedCards` hands unplayed cards to src/engine/handRules.js:6-10, which shuffles them into the draw pile when `shuffleHand` is set (default true, src/content/handRules.js:14)
  - Fix: label the discard wording as the legacy baseline and state that the default shuffles unplayed cards into the draw pile (L852-854).

### 4.2 Damage math (SPEC L896-926)

- [ ] **stale** SPEC L900-907 (the contractual order block: base, + Strength, × Weak, × Vulnerable, × Staggered, floor)
  - Code: src/engine/actions.js:65 applies the card rating bonus before anything else; actions.js:73-75 adds `damageBySchoolAdd` before Strength; actions.js:77-79 is Strength, Weak, Vulnerable; actions.js:80 multiplies by the Poise/Ward resistance (`ratingDamageMultiplier`); actions.js:89-99 tag-scoped vulnerability; actions.js:101-108 school resistance and school vulnerability; actions.js:111 floor; the tactical matchup multipliers run after the floor (§4.7)
  - Fix: add those steps in order to the block, or state that the block is abbreviated and name actions.js:64-111 as the authority.
- [ ] **stale** SPEC L905: "dmg = dmg * (defender is Staggered ? 1.5 : 1)"
  - Code: the ×1.5 lives only in the `staggered` status row, src/content/statuses.js:314, and that row is applied only by the legacy poise path (src/content/balance.js:355 `onFill`, src/engine/actions.js:604-606). Under the default ratings-on configuration (src/model/combatRatings.js:12 `enabled: true`; src/model/advancedConfig.js:1179 disables it only with `legacyRatings`), a break goes through src/engine/combatRatings.js:64-68, which sets `skipNextTurn` and the intent and applies no status, so the ×1.5 never happens
  - Fix: say the Staggered ×1.5 applies only under legacy ratings, or wire `staggered` into the ratings break path.
- [ ] **stale** SPEC L926: "Card preview numbers ... computed by the same engine function (`previewDamage(card, source, target)`)"
  - Code: no function named `previewDamage` exists; the preview is src/engine/combat.js:1552 `previewCard(combat, cardInstanceId, targetId, upcastRanks)` and src/engine/combatDamagePreview.js:22 `previewDamageHits`, both of which call `computeAttackDamage` (combatDamagePreview.js:29, actions.js:64)
  - Fix: rename to `previewCard` / `computeAttackDamage` in the spec.

### Status effects (SPEC L936-984)

- [ ] **stale** SPEC L983: "Every enemy has `poiseMax` (8–40 by enemy)"
  - Code: `poiseMax` values run from 4 (`src/content/enemies/act1.js:82`) to 40 (Furnace Saint, `src/content/enemies/act3.js:280`)
  - Fix: state the range as 4–40, or drop the number and point to the enemy rows.
- [ ] **stale** SPEC L983: "When full: enemy becomes Staggered ... takes +50% attack damage until the end of the player's next turn, then meter empties and poiseMax ×1.25 (rounded up)"
  - Code: default ratings-on break at src/engine/combatRatings.js:61-68 keeps only the overflow (`meter.value -= meter.max` at combatRatings.js:61), grows the threshold by `thresholdGrowth` 1.25 with `Math.ceil` (combatRatings.js:~70, default at src/model/combatRatings.js:21), and sets skip plus intent; no +50% status is applied. The legacy path (src/engine/actions.js:602 `value -= max`, loop) also keeps overflow rather than emptying it
  - Fix: say the break skips the next turn and grows the threshold; +50% applies only under legacy ratings; the meter keeps overflow.
- [ ] **stale** SPEC L983: "The player has one too ... a fill applies `balance.stagger.player`'s statuses (2 Vulnerable, 2 Weak) and opens the next turn one action short"
  - Code: default ratings-on player break at src/engine/combatRatings.js:64 adds only `pendingActionLoss`; no statuses. The balance note at src/content/balance.js:376-380 says the same ("with ratings on, a break costs actions and applies no status")
  - Fix: state that the 2 Vulnerable / 2 Weak apply only under legacy ratings.

### Stances (SPEC L987-993)

- [ ] **stale** SPEC L987: "4.5 Stances (Vagabond mechanic)"
  - Code: src/content/stances.js:11, 28, 46 use `class: 'reaver'`; the rename is recorded at docs/IP-SCRUB.md:56 ("Vagabond → Reaver")
  - Fix: "(Reaver mechanic)".
- [ ] **stale** SPEC L991: "**Bloodflame Stance:**"
  - Code: src/content/stances.js:10-11 `id: 'gorefire'`, `name: 'Gorefire Stance'`; rename recorded at docs/IP-SCRUB.md:45 ("Bloodflame → Gorefire")
  - Fix: rename to Gorefire Stance in §4.5 (the mechanic matches).
- [ ] **stale** SPEC L987-993 (two stances listed)
  - Code: a third stance, Brace, at src/content/stances.js:41-55 (gain 4 Block on enter, Damage taken ×0.75, +1 Strength on exit) is not in the spec
  - Fix: add a Brace row.

### Tagged combat cards and readable stances (SPEC L1020-1083)

- [ ] **stale** SPEC L1024: "**Contract status: planned.** This section must land in its own specification PR before the implementation PR"
  - Code: the rules are implemented: src/content/combatMatchups.js:19-55 (counter, smash, attack, riders), src/engine/combatMatchups.js:166 (retaliation), src/engine/combatReactions.js:1-24
  - Fix: replace the status line with "implemented; version-1 table, see §4.8 for version 2".
- [ ] **stale** SPEC L1076: "Always show a stance: Attacking, Defending, Countering, Sweeping, Ranged, Smashing, Casting, Preparing or Staggered"
  - Code: src/model/enemyIntentKnowledge.js:12-24 emits Attack, Defend, Counter, Smash, Sweep, Ranged, Casting, Spell, Preparing, Staggered; the list lacks `Spell` and uses different words
  - Fix: align the list to the code labels and add Spell.
- [ ] **stale** SPEC L1061-1071 (damage rider table)
  - Code: src/content/combatMatchups.js:54 has a Poison rider (`poison: { status: 'venom', stacks: 1, requiresHpLoss: true }`) that the table does not list
  - Fix: add a Poison → Venom row.

### 5.1 Classes, creation presets, and levels (SPEC L1155-1241)

- [ ] **stale** SPEC L1157-1158: "make `tuned` the default for new runs"
  - Code: src/content/attributes.js:190 `defaultMode: 'lean'`; content/source/characterCreation.json:3 `visibleModeIds: ["lean","assign"]` (tuned is not offered at creation) and :13 `quickStart.attributeMode: "lean"`; `tuned` appears only as a fallback at src/model/advancedConfig.js:652 `|| 'tuned'` when defaultMode is absent
  - Fix: owner call: make tuned the default (attributes.js:190, characterCreation.json:3 and :13) or restate L1157 to name lean (labelled Standard) as the default.
- [ ] **unclear** SPEC L1173-1174: "classes do not carry a second hidden HP/Actions/hand formula"
  - Code: src/content/classes.js:12, :42, :72, :97 still carry `maxHp` (84/72/74/78), read as the first writer at src/model/state.js:192 (`oldMaxHp = classDef.maxHp + …`) and exposed as Advanced rows at src/model/advancedConfig.js:710-711
  - Fix: owner to confirm whether classDef.maxHp is a dead seed (delete it) or a live input (then L1173-1174 is wrong).
- [ ] **unclear** SPEC L1222-1224: "four Rogue outfits/armour sets"
  - Code: content/source/outfits.csv:2-9 has 8 rows with class `rogue` (default, nightveil, duelist, shadow, waywatcher, wayfarerPlate, nightweave, riteVestments); characterCreation.json classes.rogue.armourIds lists 2
  - Fix: owner to say whether 4 is the target; make the spec count match the rows.

### 5.2 Vagabond card pool — M1 set (SPEC L1243-1274)

- [ ] **stale** SPEC L1243: heading "Vagabond card pool — M1 set (24 cards + upgrades)"
  - Code: no `vagabond` string in src/content or content/; the class is `reaver` (src/content/classes.js:4-6, name 'Reaver'); its cards are src/content/cards/reaver.js (50 rows) and the reward pool is 43 ids (classes.js reaver cardPool)
  - Fix: retitle to Reaver and state that the reward pool is 43 cards plus starters, not 24.
- [ ] **stale** SPEC L1251: "Bloodflame Slash"
  - Code: src/content/cards/reaver.js:84 `gorefireSlash` "Gorefire Slash", cost 1, `manaCost: 1` (a Mana cost the spec table omits), damage 5, applyStatus bleed 3, upgrade bleed 5
  - Fix: rename the row to Gorefire Slash and add a Mana column.
- [ ] **stale** SPEC L1258: "Enter: Bloodflame — Enter Bloodflame Stance"
  - Code: src/content/cards/reaver.js:198 `enterGorefire` "Enter: Gorefire" (draw 1); stance id `gorefire`, name 'Gorefire Stance' at src/content/stances.js:10-11
  - Fix: rename Bloodflame to Gorefire in §5.2 (and the Twinblade "Bloodflame applies per hit" note).
- [ ] **stale** SPEC L1265: "Shieldwall — Gain 12 Block. If in Bulwark: Retain 4 of it next turn"
  - Code: src/content/cards/reaver.js:344-355 applies status `bulwarkEcho` when in Bulwark; src/content/statuses.js:777-792 gives 4×stacks Block at owner turn start, then removes the status; reaver.js:351 text "If in Bulwark Stance: gain 4 Block next turn." (nothing is retained)
  - Fix: restate as "…gain 4 Block next turn" (Retain is not implemented).
- [ ] **stale** SPEC L1270: "Grafted Arms — X-cost: Deal 6 per energy spent … split randomly among enemies"
  - Code: src/content/cards/reaver.js:461-466 `stitchedArms` "Stitched Arms", cost 'X', `damage` 6 per hit with `hits: energySpent` on target `randomEnemy`; textTemplate at reaver.js:465 "…scaling with Stamina spent."
  - Fix: rename to Stitched Arms and say "Stamina spent" (see the cost item below).
- [ ] **stale** SPEC L1245, L1270: "Cost in energy"
  - Code: one Stamina pool; energy aliases stamina (src/model/turnStamina.js:3-12), paid at src/engine/combat.js:1387
  - Fix: say "Cost in Stamina (engine id energy is an alias)".
- [ ] **unclear** SPEC L1255: "Guard Counter — Deal 4. If you have Block: deal 10 instead"
  - Code: effects match (reaver.js:150-156, damage 4 / 10 gated on hasBlock), but the textTemplate at src/content/cards/reaver.js:157 reads "Prepare Melee Counter with {damage} base reply damage…" (a counter, not a hit)
  - Fix: owner to decide whether Guard Counter is a direct hit (spec) or a prepared counter (code text) and make the effect and the text agree.

### 5.3 Enemy roster — Act 1 (M1) (SPEC L1276-1296)

- [ ] **stale** SPEC L1278: "encounters roll from `content/encounters/weald.js`"
  - Code: the file is src/content/encounters/weald.js (26 lines, seat 'weald'); no encounters directory exists under content/
  - Fix: change the path to src/content/encounters/weald.js.
- [ ] **stale** SPEC L1283: "Rot Hound"
  - Code: src/content/enemies/act1.js:38 `blightHound` "Blight Hound" (hp 12–15, poise 6, bite 6 w60, lunge 3×2 w40 — numbers match)
  - Fix: rename to Blight Hound.
- [ ] **stale** SPEC L1284: "Demi-Brute"
  - Code: src/content/enemies/act1.js:56 `huskBrute` "Husk Brute" (hp 30–34, poise 16, club 9 w50, bellow frail w25, brace 8 w25 — numbers match); its Bellow also adds a Slimed card (act1.js:56-75), which the spec row omits
  - Fix: rename to Husk Brute and add "+ Slimed" to the Bellow cell.
- [ ] **stale** SPEC L1288: "Crucible Aspirant (HP 68–72, Poise 24)"
  - Code: src/content/enemies/act1.js:99 `wyrmAspirant` "Wyrm Aspirant" (hp 68–72, poise 24, firstMove consecrate, halberdSweep 11 w50, tailSlam 7 + Weak w30, goldenGuard 12 Block + heal 4 w20 maxConsecutive 1 — numbers match)
  - Fix: rename to Wyrm Aspirant.
- [ ] **stale** SPEC L1290: "The Watchful Omen (HP 140, Poise 30)"
  - Code: src/content/enemies/act1.js:128 `fellWarden` "The Fell Warden", hp [120,120] at act1.js:133, poise 30
  - Fix: rename to The Fell Warden and either set hp to 140 or change the spec to 120.
- [ ] **stale** SPEC L1291-1292: Held Blade "Attack 16 — Delayed"; Cane Strike 9; Hammer Toss 6×2; Twin Daggers 4×4
  - Code: src/content/enemies/act1.js:141-146 heldBlade damage 14 (block 8 while charging — matches); act1.js:139 caneStrike damage 8; act1.js:140 hammerToss damage 5 hits 2; act1.js:148 twinDaggers damage 3 hits 4
  - Fix: correct the spec to 14 / 8 / 5×2 / 3×4, or retune the code (owner call).

### 5.4 Relics (M2 set, 16) (SPEC L1298-1319)

- [ ] **stale** SPEC L1298: heading "Relics (M2 set, 16)"
  - Code: src/content/relics.js has 63 relic rows (`rarity:` count 63); its header (relics.js:1-18) says 40 after the M3 pass
  - Fix: retitle to the M2 table and state that 63 relics ship.
- [ ] **stale** SPEC L1302: "Tarnished Medallion — starter"
  - Code: src/content/relics.js:29-31 `forsakenMedallion` "Forsaken Medallion" (rarity starter)
  - Fix: rename.
- [ ] **stale** SPEC L1303: "Golden Seed — at combat start, heal 3 HP"
  - Code: src/content/relics.js:89-95 `goldenSprout` "Golden Sprout", heal 3 at the start of each combat (balance.js:1827); it also adds one Crimson charge (balance.js:333) which the spec omits
  - Fix: rename to Golden Sprout and add the charge growth.
- [ ] **stale** SPEC L1306: "Rune Pouch — 25% more runes"
  - Code: src/content/relics.js:111-116 `cinderPouch` "Cinder Pouch", runeGainMult 1.25 (paid in cinders)
  - Fix: rename and say cinders.
- [ ] **stale** SPEC L1307: "Beast Eye — Elites drop an extra card reward"
  - Code: src/content/relics.js:119-124 `feralEye` "Feral Eye", `eliteExtraCardReward`; text "Elites offer an extra card reward choice"
  - Fix: rename and align the wording.
- [ ] **stale** SPEC L1309: "Stonesword Key"
  - Code: src/content/relics.js:182-187 `sealstoneKey` "Sealstone Key" (revealUnknown; mechanic matches)
  - Fix: rename.
- [ ] **stale** SPEC L1310: "Fell Omen Brand"
  - Code: src/content/relics.js:190 `fellWardenBrand` "Fell Warden Brand" (draw on Stagger; matches)
  - Fix: rename.
- [ ] **stale** SPEC L1311: "Bloodied Talisman — Bleed bursts deal +25%"
  - Code: src/content/balance.js:1836 `bloodiedTalisman: { loseHp: 5 }` (a flat +5); src/content/relics.js:17-18 records the deliberate retune; relics.js:197-202 text "the victim loses {loseHp} additional HP"
  - Fix: restate the spec as flat +5 per burst (the retune is recorded in relics.js:17).
- [ ] **stale** SPEC L1314: "Erdtree Sapling"
  - Code: src/content/relics.js:277 `goldboughSapling` "Goldbough Sapling" (block 4 at balance.js:1845; effect matches)
  - Fix: rename.

### 5.5 Flasks (potions) (SPEC L1321-1334)

- [ ] **stale** SPEC L1385: "Azure Flask — Restore 20 Mana"
  - Code: src/content/flasks.js:20-29 effects `restoreMana` amount 1, textTemplate "Restore 1 Mana."
  - Fix: spec → Restore 1 Mana (or retune the code; owner call).
- [ ] **stale** SPEC L1388: "Rot Coating — Apply 4 Scarlet Rot"
  - Code: src/content/flasks.js:53-63 `blightCoating` "Blight Coating", applies 4 `crimsonBlight`; no `scarletRot` id exists in src/content or content
  - Fix: rename to Blight Coating and Crimson Blight.
- [ ] **stale** SPEC L1389: "Blood Grease — Your attacks apply +2 Bleed this turn"
  - Code: src/content/flasks.js:65-75 `bloodUnction` "Blood Unction"; src/content/statuses.js:739-751 applies 2 extra Bleed per damageDealt hit this turn
  - Fix: say "2 extra Bleed per hit this turn" and rename.
- [ ] **stale** SPEC L1390: "Wondrous Physick (rare)"
  - Code: src/content/flasks.js:76-80 `wondrousDraught` "Wondrous Draught" (rare; effect matches)
  - Fix: rename.

### 5.6 Events — Unknown nodes (SPEC L1392-1412)

- [ ] **stale** SPEC L1394: "Unknown nodes … (M2 tuning, in `balance.js`)"
  - Code: src/content/mapconfig.js:79 `unknownWeights: { event: 55, fight: 25, shrine: 12, treasure: 8 }`; src/content/balance.js:886 says unknownNode moved there
  - Fix: say content/mapconfig.js `mapConfigs[act].unknownWeights` (as §6 L1433 already does).
- [ ] **stale** SPEC L1396: "Erdtree Avatar"
  - Code: src/content/events.js:30-31 `goldboughAvatar` "Goldbough Avatar" (offer/pray/leave match, 6 damage, 20% heal, Guilt)
  - Fix: rename.
- [ ] **stale** SPEC L1397: "Abandoned Merchant Cart — gain 60–90 runes, 50% fight"
  - Code: src/content/events.js:57-58 (name matches), :67 `addCinders` amount 75 (fixed, not a range), :68 startCombat loneSoldier at 50%
  - Fix: "gain 75 cinders; 50% ambush".
- [ ] **stale** SPEC L1398: "Weeping Peninsula Pilgrim — Give 50 runes (gain a random uncommon relic)"
  - Code: src/content/events.js:76-77 `weepingPilgrim` "Wayward Pilgrim"; :87 `addCinders` -50 (cinders); :88 `addRelic random: true`, which draws from every reward-pool relic of any rarity (src/engine/actions.js:1305-1311; src/model/schemas.js:443-445)
  - Fix: "give 50 cinders (gain a random relic)" and rename.
- [ ] **stale** SPEC L1399: "Ancient Rune Stone — Smash (gain 35 runes)"
  - Code: src/content/events.js:180-181 `ancientRuneStone` "Ancient Cinder Stone"; :197 `addCinders` 35
  - Fix: rename and say cinders.
- [ ] **stale** SPEC L1408: "The Nameless at Rest"
  - Code: src/content/events.js:539-540 `namelessRest` "The Second Cairn"
  - Fix: rename.

### 6. Map generation (SPEC L1414-1441)

- [ ] **stale** SPEC L1419: "each starts at a random column on floor 1 (first 2 paths must start at distinct columns)"
  - Code: src/content/mapconfig.js:74 `entries: 1` shipped; src/engine/mapgen.js:111-117 then starts every walker in one of the entry columns (`starts[rng.int(0, entries-1)]`). Only the unset branch forces distinct starts (mapgen.js:111, `p === 1`)
  - Fix: restate L1419 for the shipped one-entrance rule and say the distinct-start rule applies only when `entries` is unset.
- [ ] **stale** SPEC L1439: "Rewards after combat: runes (Monster 15–25, Elite 35–50, Boss 75–90)"
  - Code: src/content/balance.js:542-544 `rewards.cinders` normal [45,75], elite [105,150], boss [225,270]; the boss reward still comes from `rollRuneReward` but pays cinders (src/main.js:3175)
  - Fix: restate the ranges in cinders.
- [ ] **stale** SPEC L1439: "Merchant prices: cards 45–160 runes, relics 140–300, flasks 50–80, card removal 75 (+25)"
  - Code: src/content/balance.js:624-627 cardCost 135–480, relicCost 420–900, flaskCost 150–240, removeBase 225, removeStep 75 (the ×3 faucet factor, balance.js:612-617)
  - Fix: restate in cinders at ×3.
- [ ] **unclear** SPEC L1439: "bosses drop a boss-relic choice of 3"
  - Code: src/main.js:3182 `relicId: rollRelicReward(…, { rarities: ['boss'] })` builds one relic id, not a set of three
  - Fix: owner to confirm whether the reward screen (src/ui/screens/reward.js) builds a choice of three from that path, or change the spec to one boss relic.

### §7.1 Screens & flow (L1445-1464)

- [ ] **stale** L1454: screens export mount(state,dispatch)/unmount() | src/ui/screens/map.js:130 mountMap(app,opts); no screen exports unmount
  - Fix: describe mountX(app,opts); re-mount releases previous

### §7.2 Run HUD & combat layout (L1465-1737)

- [ ] **stale** L1465: "1280×720 reference" | styles/kit.css:3914, styles/combat.css:1447 measure 1280×800
  - Fix: 1280×800
- [ ] **stale** L1476: src/ui/behaviors/ | dir absent; src/ui/models/BehaviorModel.js:11
  - Fix: drop path
- [ ] **stale** L1708-1709: vitals HP/MP/SP stack | src/ui/models/VitalsPanelModel.js:6-11 HP+MP only; SP in staminaOrb.js:32
  - Fix: vitals = HP/MP, SP = Stamina orb
- [ ] **stale** L1709: quick-access 2×2 incl. flasks | src/ui/models/QuickAccessPanelModel.js:12-22 Armoury+Menu only
  - Fix: flasks live in Potions projection
- [ ] **stale** L1734: hand max 10 | src/content/derivedStats.js:92 handSize base 7, max 20
  - Fix: cite derived handSize
- [ ] **stale** L1735: "Energy orb n/3" | src/ui/components/staminaOrb.js:9,21 Stamina orb, current only, mana ring
  - Fix: rename to Stamina orb
- [ ] **unclear** L1732: up to 5 enemies | src/model/formationLayout.js:2 6 rows×3 cols; ui maxRows 5
  - Fix: state authored cap
- [ ] **unclear** L1732: bleed meter | src/ui/screens/combat.js:1324-1344 generic threshold-proc bar
  - Fix: describe generic procbar
- [ ] **unclear** L1727: verified at 5 viewports | split across tools/hudbars.mjs:216, tools/combat-layer-qa.mjs:14
  - Fix: name gate or drop

### §7.2.1 Advanced configuration (L1738-1847)

- [ ] **stale** L1752-1795: seven sections | src/ui/screens/settings.js:903-933 18 shipped tabs; no Diagnostics tab
  - Fix: list shipped tabs
- [ ] **stale** L1746-1748: CI omission inventory | tests/advanced-config.test.mjs:55-66 has no omission check
  - Fix: build it or mark planned
- [ ] **stale** L1795-1800: Diagnostics excluded-with-reason | no mechanism; debug tabs gated settings.js:942-965
  - Fix: describe gating
- [ ] **unclear** L1820-1823: Export configuration action | debug pages only, settings.js:4105,4166
  - Fix: say debug-only or expose
- [ ] **unclear** L1831-1837: settings door geometry | no headless gate found
  - Fix: cite gate

### §7.4 Feedback & animation (L1903-1911)

- [ ] **stale** L1905-1906: beatOrder sequential, reactionMs 180 | `beatOrder` only in SPEC.md; numbers fire at impact src/ui/fx.js:1059, src/content/combatFeel.js:4-5
  - Fix: mark planned
- [ ] **stale** L1907: "YOU PERISHED"/"EMBER RESTORED" screens | src/ui/screens/gameover.js:61-65 title Victory/Defeat; phrases only aria-label
  - Fix: match code
- [ ] **stale** L1908-1911: failed sample plays silence, not synth | src/ui/audio.js:152-154 falls back to synthSfx
  - Fix: say synth fallback
- [ ] **stale** L1910-1911: music/*.mp3 + manifest committed | .gitignore:569-570 ignores them
  - Fix: build output, gitignored

### §8 Testing (L1935-2008)

- [ ] **stale** L1937-1941, L1957: no UI imports | tests/engine.test.js:107-137 imports src/ui models + settings
  - Fix: "no test needs a DOM"
- [ ] **stale** L1983-1990: "no single home for tabbed surfaces" | src/ui/surfaces.js:1-12 exists
  - Fix: point at surfaces.js
- [ ] **unclear** L1963-1965: --selftest/--mutate wired in CI | only verify-shipped/fullscreen-control (ci.yml:408,430); content-build not wired
  - Fix: list wired gates
- [ ] **unclear** L1974-1982: release-shots capture set | no workflow runs tools/release-shots.mjs
  - Fix: name runner or mark manual

### §9 Milestones (L2009-2028)

- [ ] **stale** L2012: Vagabond 24-card set | src/content/classes.js:17-19 reaver (docs/IP-SCRUB.md:56)
  - Fix: rename / mark historical
- [ ] **aspirational** L2024: 60 fps check | no perf gate

### §10 Forward hooks (L2029-2036)

- [ ] **stale** L2031: Ascension via modifiers[] (empty) | ships as run.custom.ascension src/content/customMods.js:8,41
  - Fix: point at customMods; modifiers[] unused
- [ ] **aspirational** L2033: Physick crafting — not built

### 13.4 The run carries its order; the order is seeded (SPEC L2163-2172)

- [ ] **stale** SPEC L2167: "`createRunState` draws the order **once** on the `seats` stream"
  - Code: `src/model/state.js:242` gives `defaultSeatOrder` (no draw) and its comment says the orchestrator draws it; the draw is `src/main.js:1255` `drawSeatOrder(registries, rng, { firstSeat })`, implemented at `src/engine/actmap.js:119-124`
  - Fix: "the run-start orchestrator (main.js:1255) draws the order once after createRunState; createRunState only sets the default order."

### 13.4d The skill tracks: one ledger, one curve, paid by the combat receipt (plan phase 4a) (SPEC L2198-2215)

- [ ] **stale** SPEC L2209: "`impactDealt` fires for enemies only (the player has no poise until phase 8)"
  - Code: `src/engine/actions.js:914` and `:922` emit `impactDealt` for the target, and `:922` adds `targetPlayerId` when `t.kind === 'player'`; the shipped ratings path emits `ratingImpact` instead (`src/engine/combatRatings.js:79`), so armour XP stays dormant there
  - Fix: "`impactDealt` fires for every target on the no-ratings and foundation paths (actions.js:914, :922); the shipped ratings path emits ratingImpact (combatRatings.js:79), so the armour tracks stay dormant in shipped solo."
- [ ] **stale** SPEC L2209: "The class track has no XP source until phase 5b"
  - Code: `src/main.js:3095` `awardClassXp(...)` runs at combat end; the class track is paid
  - Fix: delete the sentence, or say the class track is paid by `awardClassXp` (`src/main.js:3095`).
- [ ] **stale** SPEC L2214 (falsify): "`xpToNext(registries, 'weapon', 3)` costs 535 XP with the owner defaults"
  - Code: `src/content/balance.js:440` growth 1.995; probe gives 795 (100 × 1.995^... per curve; 535 was the superseded 1.75 curve)
  - Fix: "costs 795 XP at the 2026-10-04 growth 1.995."

### 13.4g The class tree (plan phase 5b) (SPEC L2239-2251)

- [ ] **stale** SPEC L2244: "`perQuest` waits for phase 10a's `questCompleted` event"
  - Code: `src/engine/quests.js:50-54` `completeQuest` pays `balance.classMastery.pay.perQuest` into class mastery and `bankSkillXp` on the class skill on every completion
  - Fix: "a completed quest pays perQuest into class mastery and the class skill at completion (`src/engine/quests.js:50-54`)."

### 13.4i The character level is earned (plan phase 6) (SPEC L2262-2271)

- [ ] **stale** SPEC L2264: "`awardLevelXp(...)` climbs as many steps as the XP buys, each granting the dial's points"
  - Code: `src/main.js:3082` sets `manualLevelUp = true`, so `src/main.js:3104` calls `bankLevelXp` (`src/model/levelup.js:156`), which banks; `awardLevelXp` (`src/model/levelup.js:304`) runs only in the dead `else` branch (`src/main.js:3105`) and a QA fixture (`src/main.js:4137`)
  - Fix: "XP is banked by `bankLevelXp` (levelup.js:156); a level is claimed only by `claimBankedLevel` (levelup.js:170) on the Level up press (§13.4o)."

### 13.4j Recovery is a location's property set (plan phase 7) (SPEC L2272-2280)

- [ ] **stale** SPEC L2275: shipped sets "shrine `restHpPartial, restMana, restFlasks, smith, levelUp`; inn … ; chapel …" (no deckEdit)
  - Code: `content/source/tagging.csv:1838` (shrine deckEdit), `:1846` (inn deckEdit), `:1851` (chapel deckEdit)
  - Fix: add `deckEdit` to the shrine, inn and chapel sets in the spec.

### 13.4k Mana is the third cost line, a focus owns its break, and the player has a Poise meter (plan phase 8) (SPEC L2281-2288)

- [ ] **stale** SPEC L2283: "Mana is never the first cost line. A card that costs Mana costs at least `balance.mana.minActionCost` action and `minStaminaCost` stamina (1 / 1)"
  - Code: `src/content/balance.js:389` `minActionCost: 1, minStaminaCost: 0` (and `:392` "Retired additive Stamina floor; keep zero"); `src/model/validate.js:581-583` checks stamina against that 0; Actions and Stamina are one pool (`src/model/turnStamina.js:3-12`, `src/framework/bridge.js:103`, `src/engine/combat.js:1213-1214`)
  - Fix: "A card that costs Mana costs at least `balance.mana.minActionCost` (1) action; Actions and Stamina are one pool, so Mana is the second cost line and `minStaminaCost` is retired at 0."
- [ ] **stale** SPEC L2287 (falsify): "a Mana card with no stamina line … is refused by name"
  - Code: `src/model/validate.js:583` cannot refuse at a floor of 0
  - Fix: delete the stamina clause; keep the action-floor refusal (`src/model/validate.js:582`).
- [ ] **unclear** SPEC L2285: "`impactDealt` is emitted for every target so the armour skill hooks hear it"
  - Code: emitted only on `src/engine/actions.js:914` (no-ratings path) and `:922` (foundation path); the shipped ratings path emits `ratingImpact` (`src/engine/combatRatings.js:79`), so the armour hooks hear no player impact in shipped solo
  - Fix: say which path emits it, or emit it on the ratings path.

### 13.4n The quest board (plan phase 10b) (SPEC L2316-2325)

- [ ] **stale** SPEC L2322: "quest XP (`questLevelXp`, `perQuest`) is still unpaid — nothing listens to `questCompleted` yet"
  - Code: `src/engine/quests.js:50-54` pays perQuest into class mastery and class skill XP at completion; only the character-XP `questLevelXp` (`src/model/levelup.js:122`) has no caller
  - Fix: "class mastery and the class skill are paid at completion (quests.js:50-54); the character-XP `questLevelXp` (levelup.js:122) is unwired and post-1.0."

### 13.4o Skill level rewards and the Level up door (owner, 2026-10-04) (SPEC L2326-2374)

- [ ] **stale** SPEC L2354: "A card exists at ranks 1 to `balance.skill.rank.max` (10)"
  - Code: the key is `balance.skill.rankMax` (probe: 10; read at `src/model/skills.js:236`; validated `src/model/validate.js:853`)
  - Fix: write `balance.skill.rankMax`.
- [ ] **aspirational** , not yet built (the spec says so): the per-door cap goes (`src/content/balance.js:488` `draftsPerCombat: 1` still live; `src/model/abilityOffers.js:69` still reads it); "passive grants from a level table row" and part C content are listed as not built.

### New-game opening presentation (2026-09-19) (SPEC L2553-2564)

- [ ] **stale** SPEC L2555: "Solo new games may show a configurable six-scene prologue"
  - Code: `src/model/prologue.js` PROLOGUE_DEFAULTS.scenes has 9 scenes (probe5)
  - Fix: "a configurable prologue (9 scenes by default, `PROLOGUE_DEFAULTS.scenes`)."
- [ ] **stale** SPEC L2558: "Optional `run.prologue` is `{version:1, status, scene:0..5, reason?}`"
  - Code: `src/model/prologue.js:705` PROLOGUE_STATE_VERSION = 2; `:736-739` (pendingPrologueScene bounds scene by `scenes.length`); `src/main.js:1298` creates `{ version: PROLOGUE_STATE_VERSION, status: 'pending', scene: 0 }`
  - Fix: "version 2, scene 0 to scenes.length − 1".

### Configurable stat pools, ratings, Poise and Ward (SPEC L2565-2584)

- [ ] **stale** SPEC L2571: "Default formulas (owner, 2026-09-24; `model/ratingFormula.js`): AR = 0.75 STR + 0.5 DEX + 0.25 CON + 0.25 WIS + 0.25 INT; DR = …; PR = …; Poise = 1 + 1 CON + 0.5 STR + 0.2 WIS + 0.1 INT; Ward = 1 + 0.2 DEX + 0.3 CON + 1 WIS + 0.5 INT"
  - Code: new runs read ruleset 7 rows, `src/content/derivedStats.js:101-107` (ar = STR 1, dr = DEX 1, pr = INT 1, ward = 1 + WIS 1, poise = 1 + CON 1), resolved at `src/engine/combatRatings.js:374` via `resolvedRuleRow`; the 2026-09-24 weights survive only as the frozen ruleset-6 `LEGACY_RATING_FORMULA` for runs born before ruleset 7 (`src/model/statRows.js:37-44`)
  - Fix: "New runs read ruleset 7 (derivedStats.js:101-107: AR = STR, DR = DEX, PR = INT, Ward = 1 + WIS, Poise = 1 + CON); the 2026-09-24 weights are the frozen formula for older runs (statRows.js:37-44)."

### §14 intro (L2585-2609)

- [ ] **stale** L2587: "step 7 wise master in progress" | docs/FINISH.md:200 [x] #1438; src/model/shopKinds.js:34
  - Fix: mark step 7 built (#1438)

### §14.1 Deck editor (L2610-2675)

- [ ] **stale** L2643: deckEditRefusal(run, settings, draft) | src/model/deckRules.js:67 deckEditRefusal(count, settings)
  - Fix: correct signature
- [ ] **stale** L2629/L2643: guard allocation via equipmentGuardSlotCount/removedGuardSlotIds | src/model/deckRules.js:273 mints guard basics with no allocation; fields absent; count derived src/model/loadout.js:1904
  - Fix: say guard basics are derived, drop from Cancel list
- [ ] **unclear** L2600: table row equipmentGuardSlotCount/removedGuardSlotIds "only if needed" | not added
  - Fix: mark "not added: guard count derived"

### §14.2 Three shop kinds (L2676-2706)

- [ ] **stale** L2680: shopOffers stream "beside smith" | src/engine/rng.js:46 appended after rewardRolls
  - Fix: "appended at end of STREAM_NAMES"
- [ ] **stale** L2690: SHOP_KIND_SCREENS market+blacksmith, master pending | src/model/shopKinds.js:34 includes master; weights 0 src/content/shops.js:71-74
  - Fix: list master (#1438), weights still 0

### §15.1 Card reward schedule (L2912-2936)

- [ ] **stale** L2920: onLevelUp default false | src/content/balance.js:592 onLevelUp: true
  - Fix: table → true (or flip code)
- [ ] **unclear** L2925: levelCard "after card" | src/model/rewardplan.js:33 levelChoice sits between
  - Fix: "after card and levelChoice"
- [ ] **unclear** L2927: tools/runsim.mjs reads schedule | direct consumer is tools/simrun.mjs:40
  - Fix: name simrun.mjs

### §15.2 Levelling pace (L2937-2957)

- [ ] **stale** L2939: base-100 ×1.75 curve | src/content/balance.js:809 base 200, growth 1.303, multScaler 1.3, roundTo 10 (comment at :801-802 also stale)
  - Fix: state shipped curve (owner picks)

## Unclear (16 sections)

### 1. Product overview (SPEC L67-79)

- [ ] **unclear** SPEC L69-72 (table row "Title"): "title screen `src/ui/screens/title.js:47`"
  - Code: `src/ui/screens/title.js:47` is `onProfile,` (a parameter in an options list), not a title string; the name is at `index.html:8` (`<title>Ashen Spire</title>`) and `src/ui/screens/title.js:146` (`aria-label` "Ashen Spire main menu")
  - Fix: cite `index.html:8` and the title render site, or the line that draws the wordmark.

### 2. Legal and asset constraints (SPEC L82-95)

- [ ] **unclear** SPEC L86-87 (item 4): "Game code never hardcodes an asset path" and every image goes through `src/ui/assets.js`
  - Code: `src/ui/assets.js` exists, but 138 literal `url('../assets` references sit in `styles/*.css` (see Scope row 2 above, e.g. `styles/player-polish.css:5-6`)
  - Fix: say explicitly that CSS backdrops are out of item 4's scope until §2.4 lands, as the Scope row already does.

### 3.6 Trigger DSL and predicates (SPEC L371-392)

- [ ] **unclear** SPEC L391-392 (`staggerBreak` and `resonance` "are §13.4k's (plan phase 8)"): the rules are mounted now: `content/source/tagging.csv:267-269` mounts `staggerBreak` on `ashStaff`, `starstoneStaff`, `wyrmhornStaff`; `:272` mounts `resonance` on `goldboughBranch`; defined in `content/source/nodeEffects.json` (`staggerBreak` and `resonance` keys)
  - Fix: state whether they are live, and whether §13.4k gates them.

### Card mounts: the smith's other two services (SPEC L515-553)

- [ ] **unclear** SPEC L536-538: "`extractionRefusal` answers `poolDeck` from the run's own Custom Climb rules every time, never from a stored field"
  - Code: src/model/cardExtraction.js:191-192 calls `isPoolDeckRun(run)`; src/model/cardRemoval.js:31 returns `isPoolDeckMode(run) || run.poolDeck === true`, so a stored `poolDeck` flag on a fight or synthetic run (set per the comment at src/model/cardRemoval.js:22-29) also refuses
  - Fix: either make `extractionRefusal` read `isPoolDeckMode(run)` only, or change the spec to say the stored fight flag is also honoured.

### Complete armament kits (SPEC L581-610)

- [ ] **unclear** SPEC L583-584: "Weapons, shields, implements, and staves each lend one Strike, one Guard, and one signature Armament Art"
  - Code: content/source/weapons.csv has kinds `weapon`, `shield`, `staff` only (no implement kind; sceptres are kind staff); all 28 hand armaments carry `combatKit` in src/content/generated/weaponCardPackages.js (28 entries)
  - Fix: say "weapons, shields and staves (sceptres are staves)", or add an implement kind.
- [ ] **unclear** SPEC L608-610: "New armed starting decks omit the redundant global technique grant"
  - Code: src/model/loadout.js:1946 skips the technique row only when a composed plan exists (`if (plan) continue;`); no direct check of the global grant was read
  - Fix: cite the test that proves the omission, or add one.

### §3.13 Card text templating (SPEC L760-763)

- [ ] **unclear** SPEC L762: "Tokens bind ... disambiguated by index when repeated: `{damage.2}`"
  - Code: src/model/validate.js:286-289 suffixes the second and later occurrence of a base token by occurrence count (`counts[base]`), not by effect index
  - Fix: "disambiguated by occurrence ordinal (first is bare, second is `.2`)".

### Pools between fights (SPEC L809-816)

- [ ] **unclear** SPEC L810-813: "Every fight opens with Stamina at its maximum ... `\"carry\"` keeps the old rule (Stamina where the last fight left it)"
  - Code: src/engine/runCombat.js:52 reads `staminaAtCombatStart` (carry honoured here), but src/engine/combat.js:416 starts turn 1 through `startPlayerTurn`, which at src/engine/combat.js:503-504 sets `p.energy = energyMax` and `equipmentPoolDeficits.stamina = 0` on every turn including turn 1; so under `carry` the carried value is overwritten before anything reads it. The measured carry-vs-full win counts in src/framework/data/mechanics.js:16 therefore cannot come from this path (not run here)
  - Fix: owner or orchestrator to decide whether `carry` should affect turn 1 (then startPlayerTurn must not overwrite it) or whether the rule is inert and the note should say so.

### §11 Non-goals (L2038-2043)

- [ ] **unclear** L2042-2043: LAN co-op "shipped" | src/net/lan.js:9 exists; tools/release-shots.mjs:125-129 says not in 0.4.x set
  - Fix: state release status

### 12. Planned game expansion — proposed mechanics and acceptance (SPEC L2044-2047)

- [ ] **unclear** SPEC L2044-2047: header says items shipped and per-item verdicts live in docs/SPEC-RECONCILE.md stage 3
  - Code: not audited (the reconcile doc was not read in this audit)
  - Fix: none to SPEC text; the verdict lives in docs/SPEC-RECONCILE.md.

### 12.5 Shared presentation and animation rules (SPEC L2088-2095)

- [ ] **unclear** SPEC L2088-2095: three player animation groups, shield bash and shield guard or parry, resting stance held until the next turn, green/blue/red action-frame auras, reduced-motion rules
  - Code: partial evidence only, `src/ui/combatAura.js:19-20` (stamina and mana receipts drive aura colour), `:44` (rgba colour per key); the resting-stance and shield-bash selection was not located
  - Fix: verify in a browser playtest or name the file that owns the resting-stance rule.

### 13.2 Content binds to the seat, never to the act number (SPEC L2141-2151)

- [ ] **unclear** SPEC L2141-2151 (falsify line): `grep -rn "act:" src/content/encounters/` should give 0 hits
  - Code: comment hits remain at `src/content/encounters/weald.js:4`, `marches.js:4`, `reach.js:4` (rows themselves use `seat:`; `rollEncounter` throws on `act` at `src/engine/encounters.js:37`)
  - Fix: change the falsify grep to match data rows only, e.g. `grep -rnE "^\s*\{ id:.*\bact:"`.
- [ ] **unclear** SPEC L2145-2146: `resolveUnknownNode` "takes tier … and seat for nothing yet"
  - Code: takes `{ tier, act, history }` only; refuses `act` (`src/engine/encounters.js:424-425`)
  - Fix: delete "and seat for nothing yet".

### 13.3 Tier scaling — the seat's numbers are authored at its baseline (SPEC L2152-2162)

- [ ] **unclear** SPEC L2156 and L2159: `balance.seatTiers = { 1: 1.0, 2: <m2>, 3: <m3> }`; placeholders never filled in the spec
  - Code: `src/content/balance.js:940-941` seatTiers {1:1, 2:1.5, 3:1.9}; bossTiers `:958-961` {1:{0.8,0.8}, 2:{2.2,1.5}, 3:{2.2,1.5}} matches the shipped values the spec states
  - Fix: write 1.5 and 1.9 into §13.3 (or point to docs/BALANCE.md by number).

### 13.4p One break meter (owner, 2026-10-05) (SPEC L2375-2392)

- [ ] **unclear** SPEC L2379: "New runs stamp it [breakMeterVersion 1] at creation"
  - Code: `src/main.js:1210` sets `combatExpansionVersion = … : 2` by default, and `src/main.js:1226` stamps `breakMeterVersion: combatExpansionVersion === 2 ? 2 : 1`, so shipped new runs carry version 2; `src/model/state.js:138` and `:197` agree. `src/model/breakMeter.js:4-9` keeps one meter only for version 1, so version 2 keeps the Ward and Arcane meters (`breakMeterIds` returns poise and ward)
  - Fix: either state that version 2 supersedes §13.4p's single meter for new runs, or stamp version 1 in `src/main.js:1226`.

### 13.4q Class mastery (owner, 2026-10-05) (SPEC L2393-2416)

- [ ] **unclear** SPEC L2401: "Each level unlocks one thing, in a fixed rotation (cards → armament → cards → relic …)"
  - Code: `content/source/classMastery.csv` carries the rotation, and `src/model/classMasteryContent.js:34` enforces it only when `bundle.balance.progression` is absent; progression is on, and live milestone grants come from `balance.progression.cadence` (`src/content/balance.js:188`; `src/model/classMilestones.js:13-14`), which §13.4r says takes precedence
  - Fix: state in §13.4q that the rotation is superseded by §13.4r's cadence where progression is enabled, or delete the rotation table.

### 13.4r Modular class rewards, ability grades, class respec and XP presentation (owner, 2026-10-06) (SPEC L2417-2444)

- [ ] **unclear** SPEC L2425: "Remove the earlier separate Stamina surcharge rather than adding it to Actions"
  - Code: `src/engine/combat.js:1213-1214` still adds `def.upcastSurcharge` to the single action/stamina cost; `src/model/upcasting.js:32` sets it to the upcast ranks
  - Fix: say whether upcast ranks are the surcharge §13.4r removes, and if so remove the term at combat.js:1213-1214.

### §14.3 Market (L2707-2753)

- [ ] **unclear** L2730: sigil shelf has no price rule | src/content/shops.js:114 pricePct 100; src/engine/shopKinds.js:235-237
  - Fix: add pricePct line

## Aspirational (2 sections)

### Defensive reactions and actor-turn presentation (SPEC L1122-1150)

- [x] **built after this audit**: #1849 implemented `combatReactionUnavailable` with the documented reason vocabulary and `combatGuardBroken` once per break, with solo/co-op regression coverage.

### 12.4 Branching destinations and roster (SPEC L2076-2087)


## Matches (43 sections)

### Combat and equipment revision: implementation contract (SPEC L43-64)

- Evidence: `docs/COMBAT-EQUIPMENT-RULES.md` and `docs/framework-cutover-report.md` exist; Dodge Roll lives in `src/framework/weight.js` (11 `dodge` hits), as the row says. The "partly built" status is consistent with the code.

### 2.1 The AI-use acknowledgement (SPEC L96-134)

- Evidence: `src/content/aiDisclosure.js:16` and `:48` hold the `approved` flag and wording guard; `src/ui/screens/about.js` and `tools/ai-disclosure.mjs` exist as the spec names them.

### Every card has an owner: the run, or one item (SPEC L495-514)

- Item-owned instances with deterministic ids and owner ref: src/model/loadout.js:2226-2232 (`kit:<piece.id>:<role>`, `grantedBy`, `equipmentRole: 'granted'`, `kitRole`, `profileId`). Reconcile-on-equip not traced further.

### Equipped weapon card packages (SPEC L554-580)

- `WeaponCardPackageModel` src/model/loadout.js:1183; `buildEquippedWeaponCardPlan` src/model/loadout.js:1313; `ceil` right and `floor` left split src/model/loadout.js:1355-1356; `WeaponDeckCompositionService` src/model/loadout.js:1403; plan error names `EquippedWeaponCardPlan` src/model/loadout.js:1373.

### Everyone has the Dodge Roll (SPEC L611-624)

- Empty hand owns it, else body: src/model/loadout.js:2240-2244 (`owner = twoHanded || !empty.length ? 'body' : empty[0]`); instance `weaponArt:unarmed:<art>` with `grantedBy: unarmed:<owner>` src/model/loadout.js:2260-2261; unarmed fallback technique src/content/balance.js:2043.

### §3.9 Action queue (SPEC L635-640)

- FIFO: src/engine/actions.js:1444-1445 (`enqueue` pushes), 1478-1480 (`shift` drain, bounded at 1000 with an error); header rule at src/engine/actions.js:3-14.

### 4.1 Turn loop: hand rules (SPEC L835-884)

- Evidence: src/content/derivedStats.js:82-92 (opening and draw base 4, +0.2 per Intelligence over baseline 4, max 10; hand size base 7, max 20); src/model/handRules.js:192-198 (`value = min(room, wanted)`, room = capacity − hand size, retained cards count against capacity); src/engine/handRules.js:20-35 (shuffleHand join rule when the draw pile is shorter than the next draw); src/content/handRules.js:12-21 (defaults, discardLimit 10, overflow discard, drawMode fixed).

### Card rules (SPEC L928-934)

- Evidence: Power leaves play, src/framework/lifecycle.js:21 `REMOVED_FROM_PLAY`; engine honours it at src/engine/combat.js:1466; Innate to top, src/engine/combat.js:389-395; empty draw pile reshuffles discard on stream `shuffle`, src/engine/actions.js:637-643; Smithing rewards elite 1 and boss 1, normal and treasure 0, src/content/balance.js:690-694; tier-1 cost 1 stone, content/source/itemUpgradeChanges.csv:7 and 12; tier cap 1 (110 armament tier-1 rows, 0 tier-2 rows).

### Enemy intents (SPEC L996-1018)

- Evidence: intent kinds from authored moves (`attack`, `block`, `buff`, `debuff`, src/content/enemies/act1.js:30-66) and engine `unknown` and `staggered` (src/engine/combat.js:765, 776); `maxConsecutive` gate at src/engine/combat.js:800-807; scripted opener `firstMove` at combat.js:770; HP-threshold phases at src/engine/triggers.js:114, 198.
- UNVERIFIED: "revealed Attack values show exact total damage (n×m) including modifiers" (not traced).

### Martial and Spell expansion v2 (SPEC L1085-1107)

- Evidence: new runs default to version 2, src/model/state.js:138; paid Powers get the `exhaust` keyword, src/content/combatExpansionCards.js:76-79; Exhaust destination honoured at src/engine/combat.js:1457-1462.

### Enemy knowledge, Perception and hidden-intent clues (SPEC L1109-1120)

- Evidence: base exact chance 0.30 with Wisdom, Intelligence, level and Perception terms, src/content/enemyKnowledge.js:6-7; three outcomes exact / clue / unknown, src/model/enemyIntentKnowledge.js:33-35; five bestiary stages, src/model/enemyKnowledgeProfile.js:15-17; contract version 1 default, src/model/state.js:139.

### 5.5.1 The grace refill (SPEC L1336-1360)

- MATCHES evidence: applyGraceRefill fires on arrival and is idempotent (src/engine/encounters.js:462-481; caller src/ui/models/LocalServiceModel.js:36); shrine name "Shrine of Emberlight" in content/config/ui/presentation/uiContent.json:26; class openings at src/content/classes.js:13, :43, :73, :98; refusals wired at src/model/validate.js:30. Not verified: the debug range UI.

### 5.5.2 The growth chain (SPEC L1362-1390)

- MATCHES evidence: FLASK_GROWTH_SOURCES = relic, questEvent, talisman, flaskSeed (src/model/schemas.js:465); one live row goldenSprout hp +1 (src/content/balance.js:332-334); questEvent NOT BINDING and talisman held-check at src/model/flaskgrowth.js:110-127; any flaskSeed row refuses at src/model/flaskgrowth.js:391-395; ledger capacity = base + grown + granted at src/model/gracerefill.js:44-53. Not verified: the "run schema v3" number and balance.flaskGrowthMax.

### 12.1 Dodge and action feedback (SPEC L2048-2055)


### 12.2 Trader armaments, weapon arts, and transactions (SPEC L2056-2067)


### 12.3 Combat HUD, piles, and potions (SPEC L2068-2075)


### Approved poker equipment cards (#784) (SPEC L2096-2120)


### 13. Seats — regions bound to content, order seeded (SPEC L2121-2124)


### 13.1 What a seat is (SPEC L2125-2140)


### 13.4a The run carries its zones (plan phase 3a) (SPEC L2173-2180)


### 13.4b The worn zone has four slots and the deck has a floor (plan phase 3b) (SPEC L2181-2189)


### 13.4c The grip is read off the hands (plan phase 3c) (SPEC L2190-2197)


### 13.4e Skill drafts: the level buys a pick from the track's own schools (plan phase 4b) (SPEC L2216-2227)


### 13.4f The class card (plan phase 5a) (SPEC L2228-2238)


### 13.4h Unlocks and the swap (plan phase 5c) (SPEC L2252-2261)


### 13.4l The attribute rebase (plan phase 9) (SPEC L2289-2298)


### 13.4m The lean scale (owner, 2026-09-20) (SPEC L2299-2315)


### 13.5 The last seat opens the causeway (SPEC L2445-2450)


### 13.6 What does not change — the byte-identity claims (SPEC L2451-2461)


### 13.7 Version and delivery (SPEC L2462-2467)


### World Journey: authored atlas and seeded routes (SPEC L2468-2528)


### Shared armor sets (2026-09-19) (SPEC L2529-2533)


### Legacy dungeon integration (2026-09-19) (SPEC L2534-2552)


### §7.3 Input


### §7.5 Visual style


### §14.4 Blacksmith


### §14.5 Wise master


### §14.6 Build order


### §14.7 Deck-editor research


### §15 intro


### §15.3 Drops


### §15.4 Legendary sigils


### §15.5 Build order


## Not verified

- Anything needing a browser (settings door geometry, rendered Bleed and enemy-row counts).
- Co-op/LAN paths; card totals by registry count; §13.4r 240-profile and 80-level falsifiers.
