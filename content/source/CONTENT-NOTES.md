# Content authoring notes (relics, stances, flasks, statuses, events, cards, enemies, classes)

The relics are `content/source/relics.json`, compiled to `src/content/generated/relics.js` by
`tools/content-build.mjs`. These are the design notes that lived as comments in the old
`src/content/relics.js` (JSON has no comments). Keep a note under its relic id when you change one.

## File header

src/content/relics.js — the relic pool (SPEC §5.4 base set + M3 growth to 40)

WHAT IS STILL HERE, AND WHAT MOVED (plan phase 2). A relic's run-system
behaviour — rewards, shops, shrines, map, costs — is the closed passive-key
set, and it is still here, because a relic's passives are upgraded PER COPY
at the smith (model/itemUpgrades.js resolveUpgradedRelic) and a property rule
is one global row with nowhere to record a tier. Its COMBAT behaviour is not:
the triggers left for content/source/nodeEffects.json, keyed by a
property tag that shares the relic's id, and the relic mounts them through
the same door equipment does (engine/properties.js). A relic that authors
`triggers` here again is refused by name, with the file to move them to.

The sentence below each relic did NOT move, and that is deliberate: it covers
the whole relic, both halves, and splitting it would renumber its own
`{block.2}` tokens for no reader's benefit. It reads its numbers from both
homes (model/validate.js relicTokens).
One deliberate retune vs. the SPEC table: Bloodied Talisman deals a flat
+5 on Bleed bursts instead of +25% (the burst amount isn't visible to a
trigger; flat rider keeps it pure data — revisit in the M3 balance pass).

M3 content pass: 20 → 40. New relics reuse only shipped statuses/opcodes and
proven trigger shapes. One design note worth keeping: relics that GRANT BLOCK
on turn 1 fire on `playerTurnStart` (once), never `combatStart` — combat-start
block is wiped by the turn-1 block-expiry (SPEC §4.1). See Goldleaf Charm.

## Section and per-relic notes

### starter

- **forsakenMedallion** — SPEC §5.1 said "first Power each combat costs 1 less"; passives are unconditional, so the shipped design leans into the class identity instead: open every combat with the combo already primed.
- **starstoneShard** — A2 Starseer starvation: Max HP +14 (34 -> 48) and Magic damage 1 -> 2; Mana stays 1. With every #1284 row live, `node tools/runsim.mjs 120 --seeded-seats` (seat order drawn per run): Starseer 51/120 wins, 40 without the +14 HP (elite deaths 6 -> 14), 21 with this relic as it shipped before (+1 Magic, no HP; 27 elite and 25 normal deaths).
- **cutpursesCoin** — SPEC §5.1's overheal-to-block needs overflow math no trigger can see; the shipped design keeps the fantasy: every heal armors you — including "wasted" heals at full HP, which become pure Block.
### commons

- **goldleafCharm** — playerTurnStart (once), NOT combatStart: block gained at combat start is wiped by the turn-1 block-expiry (SPEC §4.1). Fire after expiry so it lasts.
- **curedHide** — Character-sheet receipt only. This does not create a player poise meter or change stagger behavior; the projection says so explicitly.
### rares

- **wyrmHeart** — Denies the shrine's Rest (and any place whose set holds the partial rest) — a town's bed and a camp's rough rest stay open (plan phase 7).
### Content-pass additions (round 3: 48 -> 54)

- **gravetendersBell** — E12: the Keeper's thanks, and nothing else, hands this over — see RELIC_POOLS in model/schemas.js. Rarity still prices its buy-back.
### The class kit relics (plan phase 5a, proposal §4)

- (section) Each reinforces its class's loop; the trigger is a property rule (content/source/nodeEffects.json), as every relic's is since phase 2.

## Stances (content/source/stances.json)

- At most one stance is active; the `enterStance` opcode handles exclusivity. Stances are combat-scoped. `class` names the class that owns the stance: a card that enters "a Stance of your choice" (Warrior's Vow) offers every stance its player's class owns (model/cardChoices.js).
- **gorefire** — every attack HIT the player lands applies 2 Bleed (per hit, so multi-hit cards like Twinblade Flurry apply it per hit).
- **brace** — the class ability card's stance (plan phase 5a, proposal §4): Brace holds the line, and LEAVING it for another stance is the tempo — the next blows land harder.

## Flasks (content/source/flasks.json)

- 3 slots; found from combats (decaying drop chance, balance.rewards), shops, and events. Wondrous Draught is the repo's first — and only — scripts.js user (see scripts.js for the justification).

## Statuses (content/source/statuses.json)

The authored combat statuses are `content/source/statuses.json`, compiled to
`src/content/generated/statuses.js`. `src/content/statuses.js` is a shim that exports
`[...authored, ...expansionStatuses]`; the expansion rows are derived in
`src/content/combatStatusRules.js` and stay JavaScript. These are the design notes that lived as
comments in the old `src/content/statuses.js`; keep a note under its status id when you change one.

### File header

ALL combat statuses as data (SPEC §3.7, §4.4). The engine interprets these through the generic status
model; nothing in src/engine names any of these ids. The Elden Ring layer (Bleed, Crimson Blight,
Stagger, Madness) lives here as data, exactly like the StS layer.

### Sections in the old file, in order

StS layer (SPEC §4.4 table) · Elden Ring layer: threshold-proc rows (SPEC §4.4, #61 direction) · Proc
resistance rows (#61): strength here, duration in `decay` · Exposure rows (#61): tag-scoped
vulnerability the procs leave · Power-granted player statuses (cards apply these) · Starseer: the
Starstone combo engine (SPEC §5.1 identity) · Herald: blood economy powers (SPEC §5.1 identity).

### The #61 proc rows (bleed, frost, insanity)

- (section) Constantine's words, 2026-08-06: build-up to a threshold → percent-based damage as ITS OWN PROC → the build-up resets to zero → tag-gated resistance for a period. EVERY number in the proc, resist and exposure rows is PROVISIONAL — a first pick made against the sim (falsifier: `--policy=reaverkit n=1000`), marked so his hands can reach it. Readings stated where a word allowed more than one: `burstPercent` is percent of the PROC TARGET'S max HP (the reading the old meter already shipped); `poiseDamage` is a fixed amount PER PROC (the per-application alternative is a knob away if his intent differs).
- (section) DELTA vs the shipped meter, stated: the old bleed carried overflow and escalated its threshold ×1.5 per burst; the proc vocabulary resets the build-up to zero (overflow dropped) at a CONSTANT threshold — "then the threshold resets to zero", his words.
- **bleed** — `proc.threshold` 7 is PROVISIONAL: Rune's sim pick at Constantine's word ("let rune pick the threshold against the sim"): the smallest value whose reaverkit n=1000 CI fully clears the [1.4, 3.2] datum band; sweep table in tools/results/sweep-bleed-threshold.md. Was 12 (carried from the shipped meter) — his hands stay free. `burstPercent` 15 (% of target max HP), `burstMin` 8 and `burstMax` 35 are carried from the old meter (PROVISIONAL); `poiseDamage` 3 is a fixed poise damage per proc (new, his direction). `resistance.tags` (beast, humanoid): flesh clots; undead/construct/spirit don't (PROVISIONAL).
- **frost** — `tint` `#7fa8c9` is the frost swatch already in balance.palette. `threshold` 10, `burstMin` 4, `burstMax` 20 are PROVISIONAL; `burstPercent` 8 is smaller than bleed, his direction. `effects`: his direction is damage debuff + vulnerability/weakness to tagged (non-physical) attacks; Weak is the shipped damage debuff, the `frostExposed` row carries the tag-scoped vulnerability. `resistance.tags` (beast, humanoid): warm-blooded shake it off (PROVISIONAL).
- **insanity** — NOT `madness`: madness is a player economy drawback (relic cost — lose HP, gain Energy, clears); insanity is an enemy-affliction threshold proc. Two words, two mechanics, on purpose — binding them would break the madness relics. Flagged for the collapse check at review. `tint` `#a06bd0` is deliberately NOT `var(--gold)`: the poise bar is gold, and an insanity meter sitting beside it read as a second poise bar (Sunna's PX flag). `threshold` 14 is the hardest to fill of the three; `burstPercent` 18 is the highest percent and `poiseDamage` 8 the highest poise damage, his direction (all PROVISIONAL, as are `burstMin` 10 and `burstMax` 40). `stagger: true` is a direct stagger on proc — guaranteed, bypasses the bar. `resistance.tags` (humanoid, spirit): minds harden; beasts/constructs have none to break (PROVISIONAL).
- **bleedResist**, **frostResist**, **insanityResist** — `decay.duration` 2 (turns of resistance) and `resists.percent` 50 (blocks half of incoming points) are PROVISIONAL.
- **frostExposed** — `decay.duration` 2 and `taggedVulnerability.mult` 1.25 are PROVISIONAL; `tags` (starstone) is the frost-adjacent magic school (PROVISIONAL). `stacking: multiplicative` is declared and validated — it composes like every shipped `*Mult`.
- **insanityExposed** — `tint` matches its parent proc row (`insanity`), and stays off the poise gold. `decay.duration` 2 and `taggedVulnerability.mult` 1.3 are PROVISIONAL; `tags` (ritual, blight) are the mind-adjacent schools (PROVISIONAL).

### Other rows

- **necroticBlight** — Necrotic damage's own Blight (SPEC §4.7; owner, 2026-10-12 #4): the same per-turn HP loss as Crimson Blight, but it lasts the whole fight. Only Necrotic damage applies it; every other Blight keeps the 3-turn `crimsonBlight` row. Cleanses (combatMatchups `cleanseStatuses`) still remove it.
- **burn**, **regen** — exist for equipment to point at: a torch has to be able to set something alight, and a warm habit has to be able to give a little back. Both are ordinary content statuses — nothing in the engine knows they are the ones armaments reach for (content/source/equipMods.csv does).
- **goreblood** — #61: bleed thresholds are now CONSTANT by design, so this freeze (`meterMaxGrowthDisabled`) binds only Poise — prose updated to match; the modifier is untouched.
- **sanguinePact** — Sanguine Pact power: Bleed bursts feed Strength — the Reaver's answer to Thorn Halo / Constellation. Same `meterFilled` + `eventStatusIs` shape.
- **starstoneCharge** — set by every spell after its own effects resolve; spells check it FIRST, so the 2nd+ spell each turn gets its "Starstone:" bonus. Unique + turn-end decay = a clean per-turn combo flag, zero engine involvement.
- **azureCoil** — Azure Coil power: turns each Skill into a trickle of Block. Same `cardPlayed` + `cardTypeIs` shape the Twinned Armor relic uses, as a power.
- **waxingMoon** — Waxing Moon power: scaling Vulnerable spread — the Starseer's answer to Thorn Halo (Blight). Same `ownerTurnStart` + `allEnemies` shape.
- **moonlitShield** — Moonlit Shield power: every Starstone Charge gained also hardens into Block. Same `statusApplied` + `eventStatusIs`/`eventTargetIsOwner` shape as Constellation, but pays out Block on the owner instead of damage.
- **astromancer** — Astromancer power: opens every turn already combo-primed and card-fed — the Starseer's answer to Stargazer, with a draw riding along.
- **stigmata** — Stigmata power: holy wounds that mend — every point of HP you spend heals a little back (and, with Gold Figurine, becomes Block). Gated to the owner's own HP loss; heal emits `healed`, not `hpLost`, so no loop.
- **zealotry** — Zealotry power: pain answered with fury — each HP loss lashes a random enemy. damage emits `damageDealt` on the enemy (not the owner's `hpLost`), so it cannot re-trigger itself.
- **emberTide** — Ember Tide power: every heal (self-cast or Gold Figurine's Block-on-heal notwithstanding) hardens into Strength. Same `healed` + `eventTargetIsOwner` shape as Gold Figurine's relic trigger, but as a power that scales.
- **harbingerOfBlight** — Harbinger of Blight power: every Blight you spread mends you a little — gated to the owner's own applications via `eventSourceIsOwner` (the target is the enemy, not the owner, so `eventTargetIsOwner` would never fire here).
- **bloodUnction** — Blood Unction flask: this turn, attacks apply +2 Bleed per hit (same hook shape as Gorefire Stance; expires at turn end).
- **ironVow** — Iron Vow power: pain hardens into guard — same `hpLost` + `eventTargetIsOwner` shape as Stigmata/Zealotry, but pays out Block instead of a heal/lash.
- **glassCannon** — Custom Climb "Glass Cannon" modifier — applied to the player at combat start (both directions at once). Pure data over existing modifier keys.
- **magicVulnerable** — registered break payload for Arcane Exposure. The engine applies this only to explicit magic-school HP packets, never tags or buildup.
- **stanceShifted** — fight-long marker for the Oath rule (`oathKept`): set when its owner enters a stance, it never decays, so Oath stays broken for the fight.
- **silenced** — Psychic family (design elements-and-tag-mechanics §2.1). Expanded combat (owner, 2026-10-13): +1 SP per stack on spell-camp cards, and immunity to Force, each Force hit or effect spending a stack. The `spellDamageDealtMult` modifier is read by legacy combat only. `decay.duration` 2 is PROVISIONAL.
- **stoneskin** — Earth family (design elements-and-tag-mechanics 2.2). Applied by the Stoneskin card. Ticks down at the owner's turn end, so two ticks carry its Block through exactly one turn start. `decay.duration` 2 is PROVISIONAL.

## Events (content/source/events.json and its five tables)

The Unknown-node events are `content/source/events.json` (an array); the five tables beside them are
`eventChoiceIds.json`, `eventChoiceHistoryRequirements.json`, `eventHistoryRequirements.json`,
`questChains.json` and `eventSpeakers.json` (each an object keyed by event id, or chain id).
`tools/content-build.mjs` compiles each to `src/content/generated/<name>.js`; `src/content/events.js` is a
shim that re-exports them under the same names with the same freeze depths (`events` unfrozen; the three
`event*` tables frozen at the top level; `questChains` and `eventSpeakers` frozen deeply) and keeps
`eventChoicesWithHistory`, which is code. These are the design notes that lived as comments in the old
`src/content/events.js`; keep a note under its event id when you change one.

`eventChoicesWithHistory` needs `eventChoiceIds[event.id]` to be the same length as the event's `choices`,
or it returns no choices. In `eventChoiceHistoryRequirements.json`, `null` in a slot means "no requirement
for this choice" (the shim exports it as `undefined`, as the hand-written table held it).

### File header

Unknown-node events (SPEC §5.6; grown to 10 in M3, 24 with the Nameless and Last Lantern quest chains).
Every choice is a real trade-off, StS-style. `requires` is checked by the event screen (e.g. `{ cinders: 50 }`);
`effects` are run-level opcodes executed via executeRunEffects. A startCombat effect hands control to the combat
orchestrator after resultText is shown. SPEC §9 M3 target: 10 events.

### Per-event notes

- **turncoatMirror** — Plan phase 5c: the one shipped door to the class swap — an event, never a menu. The glass shows another calling; the run keeps its deck, relics, hands and weapon skills, and starts its class over.
- **handspiderNest** — first of the content-pass additions (round 3): every event from here to `twoFingersRiddle` came in that pass.
- **namelessKeeper** — THE FIRST QUEST CHAIN (E12, #257: "questing and previous choices to influence other events"). Three steps over the run: the Grave of the Nameless is step one; this event and `namelessRest` are gated by what was chosen there (`eventHistoryRequirements`) and branch on it (choice-level `requiresHistory`), so a later act answers an earlier act's choice. A gated event never enters an Unknown node's pool until its step is earned.
- **lastLantern** — A two-step investment in the road, answered at a later Unknown node (`lanternCaravan`).

### Tables

- **eventChoiceIds** — Stable history ids live beside event content without widening the validated event opcode schema. Labels may change; these ids are durable save facts.
- **eventChoiceHistoryRequirements** — The merchant (`merchantsGhost`) will not trade with a traveler who previously looted the abandoned cart. Stealing remains available, and Leave is deliberately requirement-free so this history branch can never trap the player. `namelessKeeper`: the keeper answers what was done at the grave — the digger may pay or fight, the mourner is thanked; Leave stays free so no branch can trap. `namelessRest`: the second cairn answers the keeper — the thanked keep the vigil, the penitent rest, the one who fought the followers loots again.
- **eventHistoryRequirements** — EVENT-LEVEL history gates (quest steps). An event listed here enters an Unknown node's pool only once the run's history satisfies its requirement (engine/encounters.js resolveUnknownNode via model/quests.js) — so a chain step cannot be met before the step it answers. Events not listed are ungated, exactly as before.
- **questChains** — QUEST CHAINS (plan phase 10a; proposal §7.5). A chain names its steps and the choices that complete it; committing a completing choice completes the quest through the one door (engine/quests.js), at most once per run. Every step is spoken in the dialogue screen. A Leave never completes a quest (validate.js refuses it by name). Grave of the Nameless is the first chain: any answer at the second cairn but Leave finishes the walk.
- **eventSpeakers** — Who speaks each chain step (content/source/speakers.csv rows). Every chain event names one; validation refuses a step without a speaker and a speaker no row defines. PROVISIONAL (owner decision, 2026-09-14): the grave and the second cairn are spoken by the Nameless themselves, the fork in the road by their Keeper (docs/LORE-CAST.md).

## Cards (content/source/cards/*.json)

Six plain-data card pools are JSON files under `content/source/cards/`, one array each, named for the
export they compile to: `heraldCards.json`, `reaverCards.json`, `starseerCards.json`,
`armamentCards.json`, `colorlessCards.json`, `corruptedCards.json`. `tools/content-build.mjs` compiles each
to `src/content/generated/cards/<name>.js`, and the old `src/content/cards/{herald,reaver,starseer,armaments,
colorless,corrupted}.js` are shims that re-export it (the pools were unfrozen before and still are).
`rogue.js` and `coop.js` stay JS: they hold builder functions, which JSON cannot carry. These are the design
notes that lived as comments in the old JS files (JSON has no comments); keep a note under the card id when
you change one. The shared constants the old files declared (`one = { f: 'add', args: [1] }`, and in the
Starseer file `CHARGED` and `GAIN_CHARGE`) are written out inline in every row that used them; the values are
unchanged.

### armamentCards

Item-lent shield Arts and Guardian's combat-only skill. Existing effect DSL.

### corruptedCards

Native corruption is an explicit play price, never an ailment or damage type.

### colorlessCards

File header: statuses/curses (injected) + neutral colorless cards any class can pick up (SPEC §5.2, §1). The
status/curse cards (rarity `special`) are injected by enemies and events; unplayability is keyword-driven
(SPEC §4.3 note). The playable colorless cards (common/uncommon/rare) are class-agnostic utility, sold at
Merchants. StS-faithful: colorless comes from shops, not standard combat rewards (`rollShopCards` in
engine/encounters.js appends them to every class's stock).
- **katanaDrawCut** (and the weapon arts that open the file) — Weapon arts are ordinary loose cards when purchased. Their source items lend mounted copies; the smith uses the existing extractable tag rules.
- **twinFang** — The pool's first colorless ATTACK: a neutral multi-hit that rides Strength/Vulnerable well in any class. It opens the "Neutral playable colorless (Merchant stock, SPEC §1)" run of rows.
- **bashingBlow** — opens the "Content-pass additions (round 5)" rows.
- **mindSpike** — opens the "Psychic and Earth" rows (owner decision #13: no class owns them). Reward-pool membership is by class `cardPool`, and nothing weights a card per class, so these ride the expanded-combat colorless door: any class meets them.
- **wound** — opens the "Statuses (the card kind) + curses (enemy/event injected)" rows.

### heraldCards

File header: the Herald pool (SPEC §5.1: M3). Class identity: HP AS A RESOURCE. Pay life for tempo (`loseHp`
riders), spread Crimson Blight, and claw the blood back through heals that the Gold Figurine converts into
armor. Mistakes compound: HP is one pool (GDD §4.3).

M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward SPEC's ~50). New cards deepen the
blood/Blight identity: Blight spread and payoff (Contagion, Scourge, Cull the Weak, Blight Nova, Reclamation),
HP-for-value (Bloodletting, Exsanguinate, Blood Harvest), and blood-fed powers (Stigmata heals on HP loss,
Zealotry retaliates on HP loss). The round-2 additions (two commons, two uncommons, two rares) rounded the
pool to 36: a cheap blood-payment attack and a Blight poke, an HP-gated finisher and a heal-fed power, a heavy
HP-for-damage attack and a Blight-fed power. Section order in the file: Starter, Commons, Uncommons, Rares,
round 2, round 4, the class ability card.
- **blightTouch** — A2 Herald starvation: no Mana line (Stamina 1 stays), so its Exposure row reads the no-Mana 1 (SPEC §13.4k). The Herald's one starting attack cost Mana that carries between fights, so a dry Herald could only stall: with every #1284 row live, `node tools/runsim.mjs 120 --seeded-seats` (seat order drawn per run), Herald 47 -> 66/120 wins and stalled fights 8 -> 5 without the Mana line.
- **litany** — THE HERALD IS WHERE INSANITY LIVES (Rune, 2026-08-08). The Insanity row shipped complete (threshold 14, the biggest burst, +8 Poise, a guaranteed Stagger, `insanityExposed`) and NOTHING in the game applied it. It belongs to this class and not to the Reaver or the Starseer for a reason already in the data: `insanityExposed` raises `ritual`- and `blight`-tagged damage, and those two tags are the Herald's (content/source/tagging.csv). A chant repeated until the mind gives is the cheapest, slowest door in; 14 is deliberately the hardest threshold to fill, so a common has to be able to start it. Numbers PROVISIONAL, like the row's.
- **warmLitany** — the class ability card (plan phase 5a, proposal §4). Litany: the Herald's loop is overheal turned to offence; one card that heals and braces in the same breath.

### reaverCards

File header: the Reaver pool (SPEC §5.2; grown to 30 rewardable cards to match the other classes). Pure data.
Every card's numbers come from the SPEC §5.2 table; text tokens bind to effects per SPEC §3.13. Powers with
invisible stack counts use formula-valued stacks (`{f:'add',args:[1]}`); formula values are exempt from the
literal-number token rule (documented in DEVELOPER.md). Content-pass additions deepen the stance / Bleed /
Poise identity: Riposte and Cleaving Blow (Poise), Rend and Bloodhunter's Strike (Bleed), Warding Lunge
(defense + Gorefire), Impale (Stagger to Bleed), and Sanguine Pact (a power that turns Bleed bursts into
Strength). The round-2 additions (two commons, two uncommons, two rares) rounded the pool to 36: Bleed/Poise
upkeep, a stance-flip attack and a power that turns HP loss into Block, a Bleed-scaling finisher and a
Poise-scaling finisher. Section order in the file: Starters, the unarmed package, Commons, Uncommons, Rares,
round 2, round 4, the class ability card, skill-draft depth.
- **strike** — Shared basic (all three classes start with Strikes/Defends; colorless).
- **evasiveGuard**, **dodgeRoll** — THE UNARMED PACKAGE (framework contract: Unarmed fallback). The entities `framework.evasiveGuard` and `framework.dodgeRoll`, authored here as the base cards the unarmed guard and technique profiles resolve to. Evasive Guard is a guard that also dodges (it rolls); Dodge Roll is the pure dodge, a flat Block, Poise and Ward since 2026-10-05, priced by the Weight Class the player stands in (mechanics.json), not by this cost.
- **dodgeRoll** — Owner, 2026-10-05: "change dodge card. Just make it add a flat block and ward and poise equal to 3 + dr bonuses". No roll: 3 Block, 3 Poise and 3 Ward, each plus the DR bonus a physical skill's Block reads (engine/combatRatings.js `cardRatingBonus`). Poise and Ward absorb impact before the matching meter fills, until the next turn, as Block does damage. The price is still the Weight Class's (`weightClassPriced`). No `upgrade`: the flat dodge is one fixed number (the owner's 3) plus DR, and its price is the class's. As an equipment-composed weapon art it rides no armament, so an upgrade would have nowhere to live; the upgrade opcode never lists a composed instance (see actions.js).
- **warriorsVow** — "A Stance of your choice" (SPEC §5.2): the play offers every stance the player's class owns, and the pick rides the play intent (model/cardChoices.js).
- **ruinousBlow** — 60% Blunt, 40% Force: the heavy blow leans physical (owner #23, confirmed 2026-10-13).
- **bloodTithe** — Half weapon, half Necrotic (owner #24; 50/50 is the orchestrator's assumption). The weapon half cuts or stabs with a blade, stabs with a piercing shield or bow, and cuts with anything else or bare hands. It bleeds on hit with any weapon (owner #24), after the payoff reads the Bleed (so the Bleed effect is the last row).
- **brace** — the class ability card (plan phase 5a, proposal §4). Brace: the Reaver's loop is stance switching as tempo. Enter Brace, a stance that holds the line; leaving it hits harder (stances.js `brace`).
- **hewingArc**, **sunderingChop**, **setTheShield**, **aegisOfEmbers**, **shieldCrash** — Skill-draft depth (blade and shield tracks). A levelled sword or shield drafts from its own school at every rarity it has opened; these join the retagged pool so each has at least four.
- **hewingArc** — Keep its pre-fix resolved price; area targeting must not add a tax (the upgrade carries `cost: 3`).

### starseerCards

File header: the Starseer pool (SPEC §5.1: M3). Class identity: STARSTONE COMBOS, the 2nd+ spell each turn is
empowered. Mechanically pure data: each spell checks `starstoneCharge` FIRST (its "Starstone:" bonus), then
applies the charge for the next spell. The charge is unique + turn-end decay (content/statuses.js). Weak early
block is the designed weakness (GDD §4.3).

M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward SPEC's ~50). New cards deepen the
Starstone identity: multi-hit (Star Slicer), AoE combos (Meteor Swarm, Radiant Spray, Starfall Beam), control
(Frost Nova, Gravity Well), and scaling powers (Azure Coil, Waxing Moon). The round-2 additions (two commons, two
uncommons, two rares) rounded the pool to 36: a cheap combo-piece and a defensive combo-piece, a card-draw combo
skill and a scaling shield power, a heavy Starstone-gated attack and a combo-fed draw power. All follow the same
"check charge first, then GAIN_CHARGE last" shape as the rest of the pool. In the old file `one`, `CHARGED` and
`GAIN_CHARGE` were shared constants; every row now spells the same value out.

A2 Starseer starvation: the starter and common attacks (Starstone Pebble, Comet Fragment, Starblade Phalanx,
Starlance, Frost Nova) cost actions only (no Mana, no Stamina), so a Starseer whose Mana carries between fights
can still fight; their cardExposure.csv rows drop to the action-only 1 (SPEC: "action-only spells keep 1").
Measured with every #1284 row live, `node tools/runsim.mjs 120 --seeded-seats` (seat order drawn per run):
Starseer 51/120 wins; 47/120 with these five back on 1 Stamina + 1 Mana.
- **frostVeil** — FROST, not Weak (#127-adjacent, Rune 2026-08-08). The Frost row's own proc LEAVES Weak, so a frost card that also applied Weak directly paid the same debuff twice and made the build-up pointless. The card seeds the build-up; the proc pays the Weak. Numbers PROVISIONAL, like the row's.
- **frostNova** — THE CARD NAMED FROST NOVA NOW APPLIES FROST (Rune, 2026-08-08). It applied `weak` + `vulnerable` and nothing in the game applied `frost` at all: a complete threshold-proc row (threshold, burst, Frost-Exposed, a resist row and its own SFX row) that no player could reach. Weak and Vulnerable are what the Frost PROC leaves behind; this is the card that fills the meter, and it is the Starseer's because `frostExposed` raises `starstone`-tagged damage. Numbers PROVISIONAL, like the row's.
- **attune** — the class ability card (plan phase 5a, proposal §4). Attune: the Starseer's loop is stamina tension around scarce casts; one card that buys the next cast.
- **cinderSigil**, **ashenMote** — Ash rites (skill-draft depth for the Ash Focus). The Ash Focus is a ritual staff: a levelled one drafts ritual cards, and until these the Starseer's pool held none, so its baseline staff drafted nothing. Starstone combos still apply.

## Enemies (content/source/act1Enemies.json, act2Enemies.json, act3Enemies.json)

Three JSON arrays of 11 enemies each (act 1, 2, 3), compiled by `tools/content-build.mjs` to
`src/content/generated/act<N>Enemies.js`; `src/content/enemies/act<N>.js` is a shim that re-exports each.
`tools/enemy-decks-convert.mjs` reads them to write the pack files. These are the comments that lived in the
old `act<N>.js` files (JSON has no comments); keep a note under its enemy id when you change one.

### File headers

All three: creature tags (beast / humanoid / undead / construct / spirit) are NOT a field on an enemy row. They
are rows in `content/source/tagging.csv`, family `enemy`, against the one tag registry, and
`model/registries.js` stamps them onto the def at boot, so `enemy.tags` still reads the same at runtime and the
proc resistance gate is unchanged. Retagging a creature is a spreadsheet row.

Act 1 (`act1Enemies.json`): the Act 1 roster (SPEC section 5.3, exact numbers).

Act 2 (`act2Enemies.json`), The Stitched Court (GDD section 2): the mid-spire palace, a court that stitched
itself together to survive. Act II escalates: bigger numbers, self-healing, and the first enemies that turn YOUR
mechanics against you (Bleed and Blight applied to the player; the status model is entity-agnostic, so
player-side meters just work).

Act 3 (`act3Enemies.json`), The Ashen Crown (GDD section 2): the burnt canopy. Act III judges: self-reforming
revenants, heavy hits, and the Blighted Valkyrie, the one enemy in the game that inverts a player mechanic (she
heals off landing hits on YOU, and her blades Bleed you). Both behaviors are plain data: a persistent
damageDealt phase trigger and move effects on the entity-agnostic status model (SPEC section 10 seams).

### Every enemy

- **attributes** (every row, all three acts) — "Stats for its SP pool" (SPEC section 4.6a, owner 2026-10-13).
- **Order in each act** — the regulars, then the elite, then the boss, then the expanded destinations. The elite
  is wyrmAspirant (act 1), courtDuelist (act 2), wyrmLord (act 3); the boss is fellWarden (SPEC section 5.3, the
  Fell Warden-inspired), stitchedKing (GDD section 2: phase 2 literally adds limbs), blightedValkyrie (the
  final boss, GDD section 2, SPEC sections 5.3 and 10). The rows from lanternMoth (act 1), mirrorScribe (act 2)
  and cinderMantis (act 3) on are the expanded destinations: authored weighted moves use the existing phase and
  delay engine.

### Act 1

- **wanderingSoldier** — the `arcaneExposure` numbers `threshold`, `buildupMultiplier` and the `onBreak` row are PROVISIONAL.
- **blightHound** — `artFaces: "left"`. Drawn in profile looking LEFT, which is where an enemy looks: the player's zone is to its left (assets.js SIDE_FACES), so this one is NOT mirrored and ships as painted. Read off the sprite, not assumed.
- **huskBrute** — the `bellow` move adds `slimed` (grey weald muck, colorless.js); SPEC section 5.2: "enemies and events inject these".
- **fellWarden** — signature delayed attack: telegraphs 16, holds (gaining 8 Block), lands the following turn regardless of newly rolled intents. Staggering him cancels it (engine-generic delayed-move rule). Phase 2 at 50% HP or below: roar (Frail + Weak on the player, +2 Strength), unlock Twin Daggers. One-way door (phases default to once).

### Act 2

- **gildedKnight** — `gildedGuard` is an enemy reaction (docs/combat-card-traits-contract.md, "Enemy reactions"): never rolled as an intent.
- **courtSurgeon** — the `scalpel` move adds `wound` (a cut that closes wrong, colorless.js); SPEC section 5.2: "enemies and events inject these".
- **stitchedHound** — `artFaces: "left"`, same note as blightHound (drawn in profile looking LEFT, so NOT mirrored). The `rend` move is the player's own favorite trick, reflected: Bleed on YOU.
- **livingArmor** — the `rimeCrush` move is the player-side door into Frost (Rune, 2026-08-08). This act's own header already states the design ("the first enemies that turn YOUR mechanics against you (Bleed and Blight applied to the player)") and Frost was the one build-up with no enemy behind it. Living Armor is already tinted var(--frost) and is `construct`, which is NOT in Frost's resistance tags, so it can seed the meter without shrugging it off itself. Numbers PROVISIONAL, like the row's.
- **courtDuelist** — `bindingRiposte` is an enemy reaction (see gildedKnight): never rolled as an intent.
- **stitchedKing** — the 50% HP phase: new limbs are stitched on. The pattern changes; the rules don't.

### Act 3

- **emberStarvedPilgrim** — the `wail` move is the player-side door into Insanity (Rune, 2026-08-08). An ember-starved pilgrim wailing at you is the one move in the tree that was already ABOUT the mind, and Insanity had no applier anywhere. The pilgrim is `humanoid`, which IS in Insanity's resistance tags, so it resists what it inflicts, which is the joke and also the reason this is the right row. Numbers PROVISIONAL, like the row's.
- **charredColossus** — `damageResistanceBySchool: { magic: 10 }` is a PROVISIONAL raw HP resistance.
- **blightedValkyrie** — signature inversion (SPEC section 10): she heals 2 whenever SHE lands a hit, a persistent (`once: false`) trigger on her own damageDealt events. The 50% HP phase is the scarlet bloom, a one-way door.

## Classes (content/source/classes.json)

Four class rows (reaver, starseer, rogue, herald), compiled to `src/content/generated/classes.js`; `src/content/classes.js` re-exports `classes` and keeps
`LOCKED_CLASSES = []` in JS ("All classes are playable as of M3 phase 1; kept for UI compatibility").

File header: class definitions (SPEC section 5.1). Only the Reaver registered in M1 (the schema is strict; locked
classes are UI display data, exported separately and NOT part of the bundle).

- **cardPool** — each class's list was grouped by rarity with comments. In order: Commons, Uncommons, Rares. Reaver: Commons start at `crimsonCleave`, Uncommons at `stomp`, Rares at `executioner`. Starseer: Commons start at `cometFragment`, Uncommons at `starstoneArc`, Rares at `supernova` (the group runs to `riteOfCinders`, the end of its list). Rogue's list carried no rarity comments. Herald: Commons start at `bloodPact`, Uncommons at `martyrBlood`, Rares at `secondBloom`. A card's rarity is authoritative in its card row (content/source/cards/*.json), not by position in this list.

## Balance (content/source/balance*.json)

The global tuning numbers (SPEC §3.1(4)) are JSON, one file per top-level key of
`balance`, named `content/source/balance<Key>.json` (`balanceShop.json`,
`balanceSmithing.json`, ...). `tools/content-build.mjs` compiles each to
`src/content/generated/balance<Key>.js`, and `src/content/balance.js` imports
those parts and reassembles `balance` in the original key order. The module
everyone imports is still `src/content/balance.js` (exports `NOTE`, `balance`,
`balanceWords`). Edit the number in its JSON file, run `node tools/content-build.mjs`,
and commit the regenerated module beside it.

`balanceCore.json` holds the small scalar keys that would otherwise be one-line
files (`energy`, `draw`, `flaskCapacity`, `flaskGrowth`, `flaskSlots`,
`startingCinders`, `startingDeckSize`, `level`, `graceRefill`,
`graceRefillAtRunStart`) and the `$note` for those scalars.

What stays in `balance.js`, and why (code, not data):

- `combatMatchups`, `combatIntent` and `enemyKnowledge` come from their own modules.
- `balanceWords` is the frozen vocabulary the note blanks are filled from.
- `damage`: the card-value rule is one template used for five card kinds, and its
  `statusMultipliers` roster is derived from `expansionStatuses` (no second
  hand-maintained roster). Its comments stay beside the code.
- `progression`: the numbers are JSON, but `gearRequirements` is the shared
  `progression/gear.js` table and the `[NOTE]` sentences for its rows are computed
  from it, so `balance.js` stitches those two pieces in.
- `ui.tooltipPlacement.hoverDelayMs` is derived from the tooltip settings table; the
  rest of `ui` is JSON.

JSON has no comments, so the comments that sat beside the numbers in the old
`balance.js` are kept below, one subsection per file, under the key they
described. Paths are relative to the file's object. Keep a note under its key
when you change one.

### How a `[NOTE]` is written (old balance.js header, owner, 2026-09-23)

What each number does, written beside it.

Every object below carries a `[NOTE]` block beside its own numbers: the
sentence Settings → Advanced shows under each row. They lived in
model/balanceNotes.js until the owner asked for them here, and the reason
is the one this file's header gives for the numbers — a description kept in
a second file drifts from the number it describes, because nobody editing
the number sees it. Two of the sentences reviewed in #1243 had been copied
from a comment in this file that the code had since outgrown.

THE KEY IS A SYMBOL, and that is what lets a sentence sit inside an object
the engine reads as numbers. `Object.keys`, `Object.entries`, JSON and
structuredClone all skip it, so `validate.js`'s unknown-field checks,
model/advancedConfig.js's `leafRows` and every engine reader walk past it:
`balance.shop.sellFraction` is still 0.5 and `balance.shop` still has the
keys it had. `Symbol.for`, so a second copy of this module shares the key.

HOW TO WRITE ONE. A key names a number by its path under the object that
holds the block:

  sellFraction: 'What the merchant pays …'           this one number
  '{kind}Cost.{rarity}.{end}': 'The {band} of …'     every number of a family
  '{statId}.perLevel': { text: '…', inert: true }    a number nothing reads

`{name}` in a key captures a path segment. In a sentence, `{name}` is a
blank model/balanceNotes.js fills with a NAME — a relic's from the relic, a
class's from the class — and `{a name}` fills it with its article too.
Nothing there writes prose; the phrases it picks between are `balanceWords`
below. Every note but an inert one ends with `balanceWords.newRun`; an
inert one says nothing reads it, and does not then promise to apply.

A number with no note falls back to "Authored balance value: <path>", and
tests/advanced-config.test.mjs fails on it. So does a note naming a number
that is not here, which is what keeps a sentence and its number together:
rename the number without moving its sentence and the test says so.

In JSON the symbol key is the string key `"$note"`, written last in its object
with the same value shape the symbol holds. `src/content/noteKeys.js`
(`withNotes`) turns every `"$note"` back into the `NOTE` symbol when the
generated module loads; `balance.js` still exports `NOTE` for the readers.

### balanceCore.json — energy, draw, flaskCapacity, flaskGrowth, flaskSlots, startingCinders, startingDeckSize, level, graceRefill, graceRefillAtRunStart

- **`flaskCapacity`** — (`handMax` retired in ruleset 7: every fight's hand size is the
  derivedStatRules `handSize` row; validate.js refuses it by name.)
  Crimson/Azure are charge pools sharing this fixed capacity. Utility
  consumables remain inventory items and use flaskSlots independently.
- **`flaskGrowth`** — The approved base is three (owner, 2026-09-24; four before); future unlocks may still grow the total. The
  first live growth rung is data: Golden Sprout
  is the Golden Seed homage, and carrying it grows the pool by one Crimson
  charge. One row, amount 1, deliberately modest — the M3 balance pass owns
  the number, and a retune is this row, nothing else: the tooltip clause
  derives (flaskGrowthClause), the capacity derives (syncFlaskGrowth), the
  corpus derives its expectations (tools/flaskgrowth.mjs). Schema and
  refusals: model/flaskgrowth.js.
- **`startingDeckSize`** — 11 since plan phase 5a: the class ability card joins the kit beside the
  signature (roleCopies.ability below; the composed plan grants it first).
- **`level`** — ---- levelling at a shrine (Constantine, D10 wave 1 + E13) ----------------
  
  His words, and the whole feature is in them:
  
    "also at graces, players should have the option to level up their
     character (per run) by trading cinders to level up. at level up they may
     increase a stat by 1 point."
    "rest sites become where you level, cinders spent past a threshold — 1
     stat point per level, 10–20 level-ups a run, scalable."   (E13)
  
  FOUR NUMBERS AND NOTHING ELSE, because the rest is derived (Law 0 clause 1):
  which attributes may be raised is `content/attributes.js` — adding a sixth
  attribute puts a sixth button on the shrine with no UI edit, and that is
  this feature's Law 0 falsifier. What a point is WORTH is
  `content/derivedStats.js`, already: a CON point is +1 HP per five, a WIS
  point is Mana. Nothing about the value of a level is authored here.
  
    pointsPerLevel  "they may increase a stat by 1 point". His number —
                what a level GRANTS to the ledger (balance.levelUp below).
    maxLevels   null = no ceiling. His range is an ECONOMY, not a cap.
  
  The cinder ladder that sat here (firstCost / costStep, "cinders spent
  past a threshold, scalable", measured at 20+4 and again at 50+10 against
  the tripled faucet) is GONE with plan phase 6: a level is earned, below.
  
  THE CHARACTER LEVEL IS EARNED (plan phase 6, proposal §10): a win pays
  defeated-enemy combat power × 25 × 0.2, kills pay 10 × 0.2 × enemy level,
  and the first step costs 100 XP, each later one ×1.75 (owner, 2026-10-02).
  Settings → Progression → Experience previews the same configured curve
  and awards the run uses. The existing per-award level cap remains separate.
  Cinders buy no level any more: the ladder that sat here (firstCost /
  costStep, measured twice) is gone with the purse.
- **`level.maxLevelsPerFight`** — THE LEVELLING CAP (SPEC §15.2). 0 is no cap, as shipped. Above 0, one
  award (a fight's XP, or a quest's) never raises the level by more than
  this, and the XP past the cap is DISCARDED: the ledger keeps at most one
  XP short of the next step, so the progress bar never reads past full.
- **` (end of block)`** — The maxima bump cadence is authored on the derived-stat rows that carry
  it (content/derivedStats.js `perLevel`), where the snapshot keeps it.
- **`graceRefill`** — ---- what a grace hands back ----------------------------------------------
  Grace refills the current Crimson/Azure counts to the allocation stored on
  the run. The allocation may be redistributed but always sums to capacity.
  This legacy table remains empty so old debug readers fail harmlessly.

### balanceProgressionRelics.json — progressionRelics

_No comments were written beside these numbers in the old balance.js._


### balanceArcaneExposure.json — arcaneExposure

- **`arcaneExposure`** — Arcane Exposure host resolution: visible name plus the explicit school
  mapping actions.js consumes. No buildup is inferred from card tags.
- **`arcaneExposure.schoolBuildupMultipliers`** — Explicit carrier schools. Physical/holy/fire are currently unmapped and
  therefore add zero even if a malformed card tries to author buildup.
- **`arcaneExposure.schoolBuildupMultipliers`** — PROVISIONAL

### balanceExposure.json — exposure

- **`exposure`** — Focus properties (docs/proposal-progression-and-property-system.md §7.2,
  §10): what an Arcane Break, or a hit, is worth to the caster whose focus
  holds the property. content/source/nodeEffects.json reads these, through variableBindings.csv,
  through `{ "balance": "exposure.…" }`; no number is typed in that file.
- **`exposure.siphonRefund`** — PROVISIONAL — Mana back on YOUR arcane break (scepter `siphon`)
- **`exposure.siphonRefundMastered`** — PROVISIONAL — the same, once the focus skill reaches siphonMasteryLevel
- **`exposure.siphonMasteryLevel`** — PROVISIONAL — focus skill level; the ledger arrives in plan phase 4
- **`exposure.overchargeBuildupMult`** — PROVISIONAL — buildup per hit × (wand `overcharge`)
- **`exposure.staggerBreakPoise`** — Plan phase 8 (proposal §7.2): what the other two foci make of YOUR break.
- **`exposure.staggerBreakPoise`** — PROVISIONAL — Poise damage to the broken foe (staff `staggerBreak`)
- **`exposure.resonanceSpreadPct`** — PROVISIONAL — % of the broken foe's threshold poured into every OTHER foe (orb `resonance`)
- **`exposure.buildupPerManaSpell`** — A Mana spell's buildup per hit (content/source/cardExposure.csv must carry at
  least this on a card that costs Mana): an empty caster still works toward
  a break with action-only spells, a Mana spell works faster.
- **`exposure.buildupPerManaSpell`** — PROVISIONAL

### balancePoise.json — poise

- **`poise`** — Engine-consulted poise config (see ENGINE-API §1). onFill is where content
  defines what "Staggered" means — the engine never names the status.
- **`poise.playerImpactPerHit`** — THE PLAYER'S VESSEL (plan phase 8, proposal §7.3): its max is Constitution ×
  this, plus the worn body armour's poiseThreshold, plus relic
  poiseThresholdAdd (model/statProjection.js playerPoiseThresholdReceipt).
  THE CONSTITUTION TERM LEFT THIS BLOCK IN PHASE 9. It is a derived-stat
  row now (derivedStats.js `poise`, ruleset 5) and the receipt reads it
  there; a copy here would be a second home for one number.
  OUTSIDE the foundation ruleset (the shipped fight has none), an enemy
  blow that draws blood rocks the player by this much; the ruleset's
  weapon impact replaces it wherever a ruleset is handed in.
- **`poise.playerImpactPerHit`** — PROVISIONAL

### balanceStagger.json — stagger

- **`stagger`** — WHAT A PLAYER STAGGER COSTS (plan phase 8, proposal §7.3): the poise meter
  filling takes this many actions off the NEXT turn and applies these
  statuses (ordinary decay). The engine reads the map; it names no status.

### balanceMana.json — mana

- **`mana`** — Mana is an additional cost beside the single turn-Stamina cost.
  minActionCost retains its serialized name; the old additive floor is zero.

### balanceDeck.json — deck

- **`deck`** — ---- The deck's floor (plan phase 3b, proposal §5) -----------------------
  A run may not LEAVE the Armoury holding fewer cards than this. `minimum`
  is the floor at character level 0; it rises by `minimumPerStep` every
  `minimumStepLevels` levels (the proposal's "+1 every 2 levels"). Character
  level lands in phase 6; until then every run reads as level 0 and the
  floor is `minimum`. model/loadout.js deckMinimum is the one reader.

### balanceClassMastery.json — classMastery

- **`classMastery`** — ---- Skill tracks (plan phase 4a, proposal §6.1 and §10) ----------------
  One curve shape for every track: the step from level n costs
  round(base × growth^n, roundTo). `xp` is the weapon, armour, focus and
  dual-wield curve; `class.xp` the class curve. The award rows are
  what the engine's hooks pay (engine/skillXp.js): perHit for a hit or a
  block a group's card resolves on a live target; perWinEquipped per
  equipped group on a win, × killMult when that group landed the killing
  hit; one XP per impactPerXp impact absorbed (heavy), evadeXp per hit
  evaded (light; medium reads half of each), one XP per buildupPerXp arcane
  buildup dealt (focus). model/skills.js is the one reader of the curve.

### balanceSkill.json — skill

- **`skill.class`** — The class track (plan phase 5b): paid by the run's
  owner for a won fight, more for a boss (the owner knows the door's
  pool; the combat does not), and per quest once phase 10a's event
  exists. `tierAt` is the class level each tree tier opens at.
- **`skill.rarityUnlock`** — The drafts a level buys (plan phase 4b, proposal §6.1): pick 1 of
  `draftSize` cards of the track's schools; at most `draftsPerCombat`
  drafts per track per reward door, the rest queue; a rarity is drafted
  from the level its row names (the game has no legendary relic or card, so the
  proposal's fourth row has no seat). A level no longer upgrades the
  deck: card ranks replaced that threshold (SPEC §13.4o).
- **`skill.rankMax`** — A card's highest rank (SPEC §13.4o). A draft offers ranks 1 to the
  track's level, never past this, the higher ones likelier.
- **`skill.flatEvery`** — Every this-many levels of a card-school track adds 1 to the primary
  number of every card of its schools (SPEC §13.4o): +1 at 5, +2 at 10.
- **`skill.attributeEvery`** — Every this-many levels a track with a linked attribute set offers +1 to
  one attribute of that set (SPEC §13.4o): Blade STR/DEX, Shield
  STR/DEX/CON/WIS, Magic DEX/CON/WIS/INT; other tracks are authored with
  the content (phase C).
- **`skill.featEvery`** — Every this-many levels a track that authors skill feats offers one
  (SPEC §13.4o, content/skillFeats.js).
- **`skill.favoredXpMult`** — The class card's leaning (plan phase 5a, proposal §4): skill XP in the
  weapon groups the card names (its item-type tags) is multiplied by
  this, through the `favored` property the card carries.

### balanceTagMechanics.json — tagMechanics

- **`tagMechanics`** — Technique tag mechanics (owner decision 11, 2026-10-12). Oath is a class
  property rule (oathKept, nodeEffects.json) bound to this number.

### balanceRewards.json — rewards

- **`rewards`** — ---- M2 run economy (SPEC §6) ---------------------------------------------
- **`rewards.bossRelicChoices`** — A solo boss victory offers this many boss relics to pick ONE from (1 or 0
  is a single relic, as before). Elite drops are unaffected.
- **`rewards.cinders`** — ×3 the first ladder (Constantine, 2026-09-04: "3x the amount for the
  base") — cinders are granted on arrival at the reward door now, so the
  faucet is the whole economy lever. The ladder and the shop were left
  reading against the OLD faucet for a week; both are re-tuned against
  this one now (2026-09-11) — the shop by this same ×3, the level ladder
  by measurement, each explained where it lives.
- **`rewards.rarityWeightsByClass`** — Caster rewards favor uncommon/rare cards when the skill gate allows them.
- **`rewards.elementAffinity`** — Owner decision #13: Psychic and Earth cards belong to no class, but the
  Herald and Starseer meet them more naturally. Within a rarity, a card
  tagged damage:<element> for one of the class's elements weighs
  offerWeightMult times a plain card in that class's card rewards.
  startingChoice: the affinity classes may pick up to maxPicks of these
  element spells as one of their selectable starting spells at character
  creation (owner decision 13, 2026-10-12). Only classless attack cards whose
  attack.source is `source` and rarity is listed qualify; the picker is
  src/model/startingAbilities.js. Skills (Stoneskin, Dissonance) are not spells.
- **`rewards.flaskDropBasePct`** — Decaying flask drop (StS potion rule): −step on drop, +step on miss.
- **`rewards.cardRewards`** — THE CARD REWARD SCHEDULE (SPEC §15.1): when a won fight offers a card
  row, and whether a level the fight bought adds one. Combat cards ship
  at 10% in every pool (owner, 2026-10-03).
  Read by engine/encounters.js `rollCombatCardOffer`.

### balanceShop.json — shop

- **`shop.armamentCost`** — ×3 WITH THE FAUCET (2026-09-11). Every price here was tuned against the
  pre-2026-09-04 faucet and was left reading against it when `rewards.
  cinders` tripled, so the merchant quietly became a third of his price:
  a common card cost two-and-a-half normal fights before, and one fight
  after. These are linear in cinders — you pay the number or you do not —
  so the factor that restores a price is the faucet's own, and ×3 here
  puts every shelf back at the fights-per-purchase it was tuned to. (The
  level ladder is quadratic and takes a different, measured factor; see
  levelUp below.) `sellFraction` is a fraction OF this table and needs no
  scaling — it moved with these numbers by construction.
- **`shop.sellFraction`** — E2 (#247): the merchant's buy-back, as a FRACTION of the low end of the
  same cost table his own stock rolls from (relicCost[rarity][0] /
  flaskCost[0]) — so a possession is always worth less than the cheapest
  he would sell one for, and the same item fetches the same cinders every
  visit, no rng. OUR number, labelled as ours: half, rounded down at the
  price, one word flips it. 0 turns the buy-back off at the table without
  touching the Settings toggle that owns the feature's visibility.

### balanceRest.json — rest

- **`rest`** — WHAT A REST RESTORES is the location's tag set (plan phase 7): a place
  carries restHpSmall / restHpPartial / restHpFull and restMana, and each
  tag's rule reads its number here (variableBindings.csv). `mana.mode` is
  the default `restMana` behaviour, resolved at the door (engine/locations.js)
  to the fixed-mode tag it names:
    flat         restore `flat` points
    floorOrFull  restore TO `floorPct` of max, or to full when already there
    full         restore to max
  A location that wants another amount carries restManaFlat / restManaFloor
  / restManaFull itself instead of restMana.

### balanceAtlas.json — atlas

- **`atlas`** — The seeded route's town budget (plan phase 7): at most this many towns —
  the atlas's start and city nodes — per difficulty act, so attrition
  between towns is the run's tension. generateJourney rejects a route over
  it and rolls again.

### balanceSmithing.json — smithing

- **`smithing`** — Smithing promotes the owned armament, not one card copy. The model owns
  the transaction; balance owns the tier ceiling, price, and reward faucet.
- **`smithing.rewardByPool`** — Item/tier costs, card changes, and requirement changes are authored in
  itemUpgradeChanges.csv. Balance owns only the reward faucet.
- **`smithing.rewardChancePct`** — THE STONE DOOR'S CHANCE (SPEC §15.3). A stone reward is paid when the
  pool pays anything and this percent passes, rolled once per door on the
  `smith` stream. 100 is always and rolls nothing, so the shipped table
  pays exactly what it always did; 0 is never, and rolls nothing either.
- **`smithing.refinedRewardByPool`** — Refined stones as a drop — the crafting-material reward. Paid through
  the same door and the same chance as the ordinary stones above, into
  `run.smithingStonesRefined`. Shipped off everywhere. They are paid and
  shown only: spending them is §14.4's blacksmith (`refine.value`).
- **`smithing.services`** — THE SMITH'S SERVICES, AND WHO OFFERS THEM (owner ruling, 2026-09-03).
  A smith does three things: upgrade an item (the tier promotion above),
  EXTRACT a card from one of an item's mounts so it becomes the run's own,
  and INSTALL a run-owned card into an emptied or open mount. Which node
  kinds offer which services is this table — a merchant rolls `chance`
  once per visit on its own RNG stream, so adding the roll cannot shift
  what any later reward draws in an existing seed. 100 means always, no
  roll consumed; 0 means never.
- **`smithing.services.extract`** — Priced in Smithing Stones, the same purse as an upgrade. Free by the
  owner's word, configurable because he said so in the same breath.

### balanceLevels.json — levels

- **`levels`** — ---- canonical hidden level semantics (#237) ---------------------------
  
  Player level begins at one authored value and advances once per shrine
  purchase (`run.levelUps`). `run.levelPoints` is deliberately absent from
  this rule: it records how many attribute points those purchases granted,
  and the configurable points-per-level dial means it is not a level count.
  
  Enemy bounds and act/floor target bands are authored by #238. The pure
  resolver in model/levels.js accepts those rows without activating them in
  encounter creation, saves, co-op, or the UI.
- **`levels.enemyScaling`** — Inert #238 content. The pure level planner consumes these coefficients
  only when a later activation story supplies a resolved enemy level.
  Every row states its rounding and hard result caps; hits, statuses,
  delays, phases, and move order are deliberately absent.

### balanceXp.json — xp

_No comments were written beside these numbers in the old balance.js._


### balanceLevelUp.json — levelUp

- **`levelUp.pointsPerLevel`** — What a level GRANTS: attribute points, waiting on the ledger until the
  player assigns them at a shrine. `maxLevels` is the character's ceiling
  (SPEC §13.4o: 20, about 100,000 XP); null is no ceiling.
- **`levelUp.pointsPerLevelMin`** — What a level GRANTS — the DOMAIN, not a ladder. Constantine rejected the
  ladder in his own words: "i don't want a dial for hte level up, I want to
  be able to enter the value myself and maybe a slider with it that is
  synced with the value." Four chips let him test four things; he said he
  wants to test.
  
  ONE DOMAIN, TWO CONTROLS. The typed field and the slider read these two
  numbers, so they cannot disagree about what is enterable — a field that
  accepted 50 while the slider stopped at 20 would be the second copy of a
  domain, and the player would find it by dragging.
  
  THE CEILING IS ONE NUMBER HERE AND NOTHING ELSE. 20 is an experimental
  bound, not a design claim: at 20 a single level is four tiers of a stat.
  If he wants 50, this line is the whole change — no code, no UI, and the
  field will say it clamped rather than swallowing the value (Law 0 clause
  5: the silent plausible answer is the dangerous one).

### balanceGauntlet.json — gauntlet

- **`gauntlet`** — Unknown (?) node resolution odds (SPEC §5.6 M2 tuning).
  `unknownNode` MOVED to mapConfigs[act].unknownWeights (EldenSpire#43-adjacent,
  Freja's finding, Marina binding): what a `?` node resolves to is map geometry
  and belongs beside `typeWeights`, per act. A flat global here could not vary
  per act while the map it describes does, and nothing said so.
  M1 gauntlet glue (kept for the headless bot test; the map flow is M2+).

### balanceCoop.json — coop

- **`coop`** — ---- Forsaken Together (co-op) ------------------------------------------
- **`coop.headcountHpFactor`** — enemy HP ×(1 + factor×(headcount−1)): 2p ×1.6, 3p ×2.2, 4p ×2.8
- **`coop.mendHealPct`** — Mend at a shrine heals an ally this % of their max HP
- **`coop.reviveHp`** — downed-but-not-dead members revive next floor at this HP (StS2)

### balanceEndless.json — endless

- **`endless`** — ---- Endless Spire + Custom Climb rule magnitudes ------------------------
- **`endless.hpPerLoop`** — +% enemy HP per completed cycle
- **`endless.strPerLoop`** — +Strength per completed cycle
- **`endless.actsPerCycle`** — acts before the spire loops (also the act count)

### balanceSeatTiers.json — seatTiers

- **`seatTiers`** — ---- Seats (SPEC §13.3) ------------------------------------------------------
  One multiplier per TIER. A seat's rosters were authored at its baseTier
  (content/seats.js), so a fight in seat S at tier T scales enemy HP by
  seatTiers[T] / seatTiers[S.baseTier] — exactly 1 at the baseline, which is
  what keeps every existing seed's fights byte-identical (§13.6). The values
  are the measured HP ratio of the shipped rosters (docs/BALANCE.md §2):
  act-2 rows average ≈1.5× act-1, act-3 rows ≈1.9× (normals, elites and
  bosses weighted together, as authored). Tier 1 is 1 by definition and the
  validator holds it there. A BOSS fight reads bossTiers below instead: the
  same ratio on HP and move damage, × the tier's boss row.

### balanceBossTiers.json — bossTiers

- **`bossTiers`** — BOSSES BY THE TIER THEY ARE MET AT (SPEC §13.3). Seats are drawn in a
  random order per run (§13.4), so a boss's difficulty cannot be authored
  into its roster row: the Marches boss is a run's first boss in a third of
  climbs and its second in another third. A boss fight at tier T takes the
  seatTiers ratio against ITS OWN seat's baseline on HP AND on every move's
  damage (engine: enemyDamageMult), then × bossTiers[T].hp / .damage — an
  absolute row per tier, not a ratio (model/seats.js bossTierScale). Only
  'boss'-pool fights read it; World Journey has no seat and is untouched.
  TUNED (#1284) with `node tools/runsim.mjs <n> --seeded-seats`, the order a
  real run draws; 240 runs a class: Reaver 105, Starseer 103, Rogue 135,
  Herald 135 wins (44/43/56/56%). The tool's fixed weald → marches → reach
  order (no flag, one climb in six) reads lower: 120 runs, 42/38/56/56.

### balanceCustomMods.json — customMods

- **`customMods.toughElitesHpMult`** — Tough Elites: elites & bosses ×HP
- **`customMods.bigBossesHpMult`** — Dread Bosses: act bosses ×HP
- **`customMods.hoarderCinders`** — Hoarder: bonus starting cinders
- **`customMods.expensiveShopsMult`** — Greedy Merchants: ×shop price
- **`customMods.hoarderShopMult`** — Hoarder: ×shop price
- **`customMods.lessHealingMult`** — Scarce Embers: ×healing (shrine rest + between-act)

### balanceCosts.json — costs

- **`costs`** — ---- Armaments & armour (equipment) ---------------------------------------
  What you carry rewrites the cards you start with, rather than adding new
  ones: a dagger turns Strike into 3×2, a greatsword into one heavy swing.
  The pieces themselves live in content/source/weapons.csv and outfits.csv;
  what a mod is ALLOWED to say lives in equipMods.csv. Everything here is
  the rules of the system, kept in one place so it can be tuned or switched
  off without touching the model.
  What the relic-carried powers are tuned to. Every number a power used to
  carry as a literal in its own rule lives here now, one row per variable,
  and the rule names the variable (content/source/nodeEffects.json) while
  content/source/variableBindings.csv says which row the variable reads.
  Retuning a relic is editing this block; the rule never changes.
  The framework's default cost amounts: what a card pays when it carries a
  cost node (content/source/nodes.csv cost.action/stamina/mana) with no
  amount of its own. Bound in variableBindings.csv; read into the generated
  framework data at build.
