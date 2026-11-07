# SPEC history — §13.1–13.4n (Seats through the quest board)

Archive of history, rationale and provenance moved out of SPEC.md §13.1–13.4n during the 2026-11-07 concision pass. Not rules; the rules are in SPEC.md.

## §13 intro
- Phase 0 of the former seat-adventure proposal (removed 2026-10-11; see git history). Everything was stated so a command can falsify it.

## §13.3
- The tier 2 and tier 3 values (1.5 and 1.9) were set from the measured HP ratio of the shipped rosters (`tools/runsim.mjs` at 300 seeds prints per-tier win rate before and after).
- Rationale for `bossTiers`: the seat order is drawn per run (§13.4), so a boss's difficulty cannot be authored into its roster row; the Marches boss is a run's first boss in a third of climbs.
- Shipped boss tiers (#1284, A2), tuned with `tools/runsim.mjs <n> --seeded-seats`.
- Strength scaling per tier "is not introduced here; Endless already owns per-loop Strength and a second knob on the same status is a balance decision for the tuning pass, not this contract."
- `balance.seatTiers` lived at `src/content/balance.js:940-941`.

## §13.4
- Run-start orchestrator was at `src/main.js:1255`; `drawSeatOrder` at `src/engine/actmap.js:119-124`. The stream is new, so every existing stream's counters and draws are unchanged for every existing seed.

## §13.4a (plan phase 3a)
- Heading was "The run carries its zones (plan phase 3a)". Authority stays with the legacy fields "until phase 3b"; `worn.head/hands/feet` were `null` "until 3b authors the rows" (3b = §13.4b).
- "a run that leaves a door, and a file any door writes, carries a projection that is true now."
- "the truth is intact" (rationale for re-projecting a wrong projection instead of refusing).

## §13.4b (plan phase 3b)
- `armor` slot id kept for `body` "because renaming it would move every save's `loadout.sets.armor`."
- The floor: "the door refuses what this screen did, never a state it inherited."
- `grantedBy` lock: "The plan's `locked: true` would be a second home for that fact and is not written."

## §13.4c (plan phase 3c)
- "a stored copy would be a second home for one fact."

## §13.4d (plan phase 4a)
- "Removed in part (owner, 2026-11-07, Unity-port cleanup P4b)": the banked-XP claim (`bankSkillXp`, `claimBankedSkillLevel`) is deleted.
- Original owner defaults (2026-10-02): exponential, base 100, growth 1.75, for both tables. **Changed (owner, 2026-10-04, §13.4o)** to the shipped values (skill growth 1.995 cap 10; class base 400 growth 1.224 cap 20), applied 2026-10-05.
- Hook note: `damageDealt`/`blockGained` events "now carry the card".
- The ratings meter's `ratingImpact` source was retired with `impactDealt` (#2633). `awardClassXp` was at `src/main.js:3095`.
- Falsify note: "the kill is read from the HP the hit left".

## §13.4e (plan phase 4b)
- Draft cap: "(per-door cap replaced by §13.4o once built)".
- Schools rationale: "a union over every piece of the type would hand a swordless blade track guard and blood cards"; "The sword you levelled drafts sword cards." Armour and class tracks have no schools "(nothing to draft until 5b's tree)".
- `rarityUnlock`: "the game has no legendary rarity, so the proposal's fourth row has no seat".
- Pool depth: a pool short of a school "is filled by tagging the cards whose text already is that school or by authoring new ones — the Starseer's Ash Focus is a ritual staff, and its ash rites are the Starseer's ritual cards."
- **Retired 2026-10-05 for §13.4o card ranks (B2c).** What the rule was: the threshold upgraded the deck as a standing rule (`awardSkillXp` → `applySkillUpgrades`): every award to a track at or past `balance.skill.upgradeAt` set `upgraded: true` on every ORDINARY deck card of the track's schools and reported the ids; a card that joined later was upgraded at the next award; the load door (`save.js loadRun` → `reconcileSkillUpgrades`, one heal-ledger row) asked the rule of a ledger written before it existed. An equipment-bound basic (`sourceArmamentId`) and an item-owned card (kit, package, weapon art) were the piece's: their upgrade is the smith's tier, re-derived by `stampDeck` on every restamp. A draft taken at or above the threshold arrived upgraded; the shrine kept the untagged cards.
- Not in 4b: smithing re-point is its own PR (4b-ii) — "folding it into the draft door would have been two systems in one review."

## §13.4f (plan phase 5a)
- Ability cards and kit relics were "proposal §4"; relics are property-rule "like every relic since phase 2".
- "Not in this phase: the class tree (5b) and unlocks/swap (5c)"; unsupported second sentences "named in the plan note for the owner".
- `favored` rationale: "No `favored<Group>` rule per group: the group is the carrier's tag."

## §13.4g (plan phase 5b)
- **Removed in part (owner, 2026-11-07, Unity-port cleanup P4b).** The class-tree draft is deleted: `classDraftPool`, `pickClassNode`, `tierOpensAt`, `rollClassDraftIds` have no caller; the bot sim no longer rolls one. `classTreeRows`, `run.coreTags` and the class swap stay.
- Deleted draft rules (historical): a class level queued a draft (`pendingDrafts` on `class:<id>`, one per door); offered as a `classDraft` row (`REWARD_KIND_ORDER` ahead of `skillDraft`; key `classDraft:<classId>:<ordinal>`), a choice among `draftSize` nodes rolled by `rollClassDraftIds` from `classDraftPool` (tiers open at the level, not picked, every `REQUIRES` picked, no `CONFLICTS_WITH` picked) on the `cardRewards` stream; the class-card offer was not rolled while a draft was on the table; the chooser rendered a node tile (`nodeTokens`); `apply.classDraft` spent the queued draft and recorded `pendingReward.chosenDraftNodeIds[row.key]`; `pickClassNode` wrote `run.coreTags`.
- "ten per class today ... the proposal's 'about twelve' is rows, not shape". No `artKey` column was authored for the subclass presentation (a sprite key can join when there is art).
- Quest pay `src/engine/quests.js:50-54`.

## §13.4h (plan phase 5c)
- The boss-reward door the plan named is not shipped: "a reward row is a kind of its own (§13.4e's shape), and the owner placed it post-1.0 (2026-09-27)."

## §13.4i (plan phase 6)
- **Removed in part (owner, 2026-11-07, P4b).** Banked-level claim (`bankLevelXp` `src/model/levelup.js:156`, `claimBankedLevel` `:170`, `pendingLevelCount`) and general feats (`feats.json`, `run.feats`, XP multipliers, `vitalRenewal`) deleted. The old §13.4i text still described XP being banked by `bankLevelXp` and claimed by `claimBankedLevel` on the Level up press; no reader remains in src/. `awardLevelXp` was `levelup.js:304`; QA fixture call `src/main.js:4137`.
- **Guided level rewards (owner, 2026-10-03; superseded IN PART by §13.4o, 2026-10-04):** Accessibility → "Pause XP for level-up rewards" (`guidedLevelUp`, default on) banked earned character and skill XP, paused at each level, opened its reward chooser with Back and resumed surplus XP after the choice; Back stopped automatic prompting for the current reward screen; Continue could leave without advancing levels. Auto-claim and pausing went with §13.4o; "turning the guide off follows the existing manual-level preference". `guidedLevelUp` has no reader in src/.
- Per-level term values as shipped then: HP +5, Mana +1 and Stamina +1 every five levels past the first, Hand +1 every ten; ruleset 6 restated it as a decimal `perLevel`, and §3.5's 2026-09-24 defaults give HP 2 per level.
- Curve receipt before 2026-09-24: 100, 120, 130, 150, 170, 200, 230, 270, 310, 350 and 2,030 to level 11.
- "His level-value dial (`levelUpValue`)"; character XP for quests post-1.0.

## §13.4j (plan phase 7)
- `shrineHealMult` renamed `restHealMult`; `shrineNoRest` (no filter) renamed `restDenied`. `shrineHealPct`/`balance.shrine.healPct` and `shrineHealAmount` are gone. `restMana`'s `toFloorPct` and `missingMana` were new at phase 7; `refillFlasks` a new opcode. The single-floor rule a percentage rest replaced.
- Inn `questBoard` service added in phase 10b.
- **Town budget (deleted as obsolete):** `generateJourney(seed, profileId, atlas, { townsPerActMax })` counted `city` nodes per difficulty act and rolled again over the cap; `main.js` passed `balance.atlas.townsPerActMax` (1). Every shipped city was act 1 and a route held one hub, so it changed no seeded route. `townsPerActMax` has no reader in src/ or content/.

## §13.4k (plan phase 8)
- Focus discount owner quotes (2026-11-01): "armaments that have the focus tag (which is most sceptors) it reduces mana cost by 1 max(mp-1, 0)"; "magic focus mana reduction effect only works on cards with the magic tag property"; one Focus armament gives the discount and it does not stack; the Prepared-stance condition is also owner 2026-11-01.
- Re-cost narrative: the four signature arts cost 1 Stamina beside their 1 Mana (A2 since took the Starseer's Starstone Pebble — with Comet Fragment, Starblade Phalanx, Starlance and Frost Nova — off the Mana line). The proposal's 2 / 2 waits for phase 9, whose Mana-equals-Wisdom pools can afford it (under the then tiers two classes started with one point of each).
- The foundation ruleset's weapon impact that once replaced the player's Poise meter, and the ratings meter's `ratingImpact`, were retired (#2633). The ratings-on variant (`Ratings.applyRatingImpact`, which applied no status) retired with the ratings meter.
- "Since plan phase 9 the Constitution term is the derived `poise` row rather than a balance coefficient (§13.4l)."

## §13.4l (plan phase 9) — removed as obsolete or superseded
- Creation offered `tuned2`: baseline 5 across five attributes, ten points, floor 3, ceiling 12, fixed total 35, `belowBaseline: 'allow'`, `redistribution: 'fixedTotal'`; `tuned`, `standard`, `pointbuy` stayed in the table out of creation. Superseded by §13.4m (`lean`/`assign`).
- Derived-stat ruleset 5 (superseded by ruleset 7, §3.5): `hp = 30 + 4 × CON`, `mana = 1 + WIS`, `stamina = 1 + CON`, `poise = 1 + CON`, `energy = 3 + floor(DEX / 5)`, `draw = 3 + floor(INT / 5)`. Rulesets 1–4 "remain readable: a run restores the snapshot it was written with, and the required row set is a function of the version". Ruleset 6 introduced multi-attribute pool rows.
- A run whose snapshot predates the poise row kept phase 8's term (Constitution one-for-one, `balance.poise.playerPerConstitution` as shipped 1). Pre-ruleset-7 runs are now refused at load (§3.5, `engine/save.js retiredProfileReason`).
- `equipmentRequirements.csv` was first moved onto the 3–12 scale (superseded by 1–4, §13.4m). Before the preset gear check, a failing preset "threw away the whole game configuration behind a generic notice".
- The band was re-measured: `docs/BALANCE.md` §5 regenerated on the rebased content; tier-1 boss band moved up for Reaver and Rogue, left to the M3 balance pass.

## §13.4m (owner, 2026-09-20)
- Owner words: "I'd like the default stats to be low, with everyone having a total pool of points starting off. the default stat for each stat is 1 and assign allows a user to assign 3 points … reduce equipment requirements accross the board for this low stat environment. Also, I'd like to have more stat customization options in general to be able to make this change in the settings."
- Standard label history: briefly "Assigned" on 2026-09-24, then "Standard"; the id stays `lean`. Owner 2026-09-24 on creation: "should have the option of standard (pre assigned class presets) and assign points (x points to assign but configurable in advanced settings)".
- `lean` shipped with `statConversionScale: 1/5` (one lean point read as one tuned2 tier); removed with derived-stat ruleset 6 (owner 2026-09-21: "all calculations should be sum(floor(statmult*stat)) + equipment bonus"). Derived rows are the owner's 2026-09-24 defaults, `base + Σ floor(weight × attribute) + floor(perLevel × (level − 1))`. `statConversionScale` still exists as an optional schema key only.
- Dodge Roll retune (plan A3, 2026-09-24): the d20-habit `floor((DEX − 10) / 2)` read −3 to −5 for every creatable character, leaving a preset's landed dodge guarding 2 at best when Light, 0 Medium, less than nothing Heavy. Medium was 2 / 1 and Heavy 3 / 2 stamina/actions (more than any preset's opening Stamina of 1 or 2). Measured with `node tools/runsim.mjs 240 --seeded-seats`: dodges landed 57–65% of plays for 4.4–6.0 guard (35–44% for 0.6–2.0 before); wins stayed in the 35–65% band (Reaver 112, Starseer 104, Rogue 141, Herald 136 of 240). The `assign` mode (#1294) shares the lean centre 3.
- The `derivedStatRuleSnapshot` bullet once described where the removed conversion scale sat among the override layers.
- Standard row dials: the topic was *Assign points* while one mode was offered; before the 2026-09-24 change typing *Points available to assign* alone could not move the total that bounded it.
- `tuned2` joined `tuned`, `standard`, `pointbuy` out of creation "for the same reason" (in-flight saves admitted against their mode's total).

## §13.4n (plan phase 10b)
- Quest pay `src/engine/quests.js:50-54`; `questLevelXp` `src/model/levelup.js:122`; character XP for quests post-1.0 by owner decision 2026-09-27.
