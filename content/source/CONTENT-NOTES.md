# Content authoring notes (relics, stances, flasks, statuses, events, cards, enemies, classes, attributes, derived stats, action costs)

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

Seven plain-data card pools are JSON files under `content/source/cards/`, one array each, named for the
export they compile to: `heraldCards.json`, `reaverCards.json`, `rogueCards.json`, `starseerCards.json`,
`armamentCards.json`, `colorlessCards.json`, `corruptedCards.json`. `tools/content-build.mjs` compiles each
to `src/content/generated/cards/<name>.js`, and the old `src/content/cards/{herald,reaver,starseer,armaments,
colorless,corrupted}.js` are shims that re-export it (the pools were unfrozen before and still are).
`coop.js` stays JS: it holds builder functions, which JSON cannot carry. `rogue.js` is now a shim too; its shared helpers (`one`, `PREPARED`, `TARGET_*`, `prepare()`, `spendPrepared()`) are written out inline in every row that used them. These are the design
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

### rogueCards

File header: the Rogue parity slice. Prepared is a content-owned one-hit opening: Rogue attacks read it before removing it. Venom is a normal status hook. No Rogue behavior needs a new opcode, predicate, formula, or script.
Section order in the file: Non-reward cards (signature + two generated tools), Commons (13), Uncommons (13), Rares (10), the class ability card, skill-draft depth.
- **helpers** — The old file declared `one = { f: 'add', args: [1] }`, `PREPARED` (hasStatus self prepared), `TARGET_WEAK`, `TARGET_VULNERABLE`, `TARGET_BLEED`, `TARGET_VENOM`, `TARGET_VENOM_3` (venom atLeast 3), `prepare()` (applyStatus self prepared, stacks `one`) and `spendPrepared()` (removeStatus self prepared). They are inlined in the JSON rows; values unchanged.
- **ambush** and the two generated tools (**rogueShiv**, **smokePellet**) — Non-reward cards: the signature card and the generated tools.
- **deathblow** — 60% Blunt, 40% Necrotic (owner, 2026-10-13).
- **prepare** — the class ability card (plan phase 5a, proposal §4). Prepare: the Rogue's loop is setup then payoff; the cheapest way in.
- Skill-draft depth (bow and parrying-hand tracks) — A levelled shortbow drafts pierce/ranged/precision cards, a buckler or parrying dagger guard/flourish ones; the closing rows give each at least four per rarity it has opened.

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

## Encounters (content/source/wealdEncounters.json, marchesEncounters.json, reachEncounters.json)

The encounter pools are one JSON file per seat, compiled by `tools/content-build.mjs` to
`src/content/generated/<seat>Encounters.js` and re-exported by `src/content/encounters/<seat>.js`. These are
the header and inline comments that lived in those three modules (JSON has no comments). Row order is
meaningful: pools are read in bundle order, so do not reorder rows.

### wealdEncounters.json (The Hollow Weald)

File header: src/content/encounters/weald.js — The Hollow Weald encounter pool (SPEC §13.2). The seat's numbers are authored at baseTier 1 (content/seats.js); a climb at another tier scales them by balance.seatTiers (§13.3). Rows are the act-1 rows they always were, re-homed: `act: 1` became `seat: 'weald'`.

Trailing note: `M1_GAUNTLET = ['patrol','packHunt','eliteWyrm','bossOmen']` — the M1 acceptance walk, SPEC §9 M1 — stood here and in the content barrel with no reader anywhere in the tree, found by tools/closedsets.mjs. Deleted: the map flow has been the real thing since M2, the headless bot test runs off `balance.gauntlet`, and four ids nothing resolves are four ids that rot when an encounter is renamed. SPEC §9 M1's prose is the record of that acceptance.

### marchesEncounters.json (The Pale Marches)

File header: src/content/encounters/marches.js — The Pale Marches encounter pool (SPEC §13.2). The seat's numbers are authored at baseTier 2 (content/seats.js); a climb at another tier scales them by balance.seatTiers (§13.3). Rows are the act-2 rows they always were, re-homed: `act: 2` became `seat: 'marches'`.

### reachEncounters.json (The Cinder Reach)

File header: src/content/encounters/reach.js — The Cinder Reach encounter pool (SPEC §13.2). The seat's numbers are authored at baseTier 3 (content/seats.js); a climb at another tier scales them by balance.seatTiers (§13.3). Rows are the act-3 rows they always were, re-homed: `act: 3` became `seat: 'reach'`.

- **a3_bossRotValkyrie** — THE ONE NULL SEAT (SPEC §13.5): the Blighted Valkyrie is the tier-3 act's extra terminal whatever seat holds it, so she is in no seat's pool (`seat` is `null`). She stays in this file, in this position (after `a3_eliteWyrmLord`, before `a3_cinderNest`), because the boss pool is read in bundle order and moving her would move which column each destination lands in.

## Shops (content/source/shops.json)

File header (was the comment block at the top of src/content/shops.js): the three shop kinds and what each one offers (SPEC §14.2). `shops.json` is the single export `shops`; `kindWeights`, `market`, `blacksmith`, `master` and `masters` keep their old shape.

- **`$note`** — every `[NOTE]` block of the old module is the string key `"$note"` in the JSON, same value shape; content-build wraps the export in `withNotes(...)` (src/content/noteKeys.js), which turns each back into the `Symbol.for('ashenspire.balance.note')` key. The notes are the sentences Settings → Advanced → Shops shows. validateContent refuses a numeric leaf without one, by name. Generic offering notes (`enabled`, `chance`, `weight`) and the shared conditional/stockKey sentences were copied into each offering's `$note` in full when the `offering()` helper was inlined.
- **Kinds and offerings** — a shop has a KIND (`market`, `blacksmith` or `master`) and each kind is a list of OFFERINGS. A visit rolls every enabled offering's `chance` once, in the order written, on the `shopOffers` stream; a chance of 100 always comes up and draws nothing, and 0 never comes up by the roll. When fewer than `guaranteedMinimum` came up, the missing enabled offerings with the highest `weight` are added (ties in written order) until the minimum is met, with no further roll. A disabled offering never appears, not even through the guarantee.
- **Every number is a default.** Settings → Advanced → Shops generates one row per number (model/shopKinds.js `shopConfigRows`), keyed `gameConfig.shops.<kind>.<offering>.<key>`, and a run freezes the values it began with in `run.advancedConfigSnapshot`.
- **The market's shelves are today's.** Their stock counts and prices stay in `balance.shop`, their one home, where Advanced → Rewards already lists them; an offering here says only whether that shelf is out on a visit. Every shelf ships at chance 100, so a seed's shelves roll exactly what they rolled before shop kinds existed, and the `shop` stream is drawn exactly as before.
- **The blacksmith's screen** shipped at §14.6 step 6 (model/shopKinds.js SHOP_KIND_SCREENS), so the non-conditional minimum binds it and its weight has a Settings row; it still ships at weight 0, and the owner raises it to let a classic merchant be a blacksmith. The atlas smith is always one. **The master's screen** shipped at §14.6 step 7 (SPEC §14.5): it also ships at weight 0, and the owner raises it to let a classic merchant be a master. An atlas `master` point is always one, though no shipped point carries it yet.
- **Conditional or not (SPEC §14.2).** An offering is `conditional` when its pool can be empty on a visit (every relic already held, every armament carried, every sigil owned), so the visit does not lay it out and the guarantee fills from the others. A conditional offering never counts toward the enablement minimum: validateContent and Settings keep at least `guaranteedMinimum` enabled offerings that are NOT conditional, so the guarantee can always be met. Authored per offering, never a Settings row. When in doubt, an offering is conditional.
- **A non-conditional shelf still needs a stock (SPEC §14.2).** Its per-visit count lives elsewhere (`balance.shop`, where Advanced → Rewards lists it) and can be set to 0; `stockKey` names it, so validation and Settings count the offering toward the minimum only while that count is at least 1. An offering that names none always counts (a service with nothing to run out).
- **A blacksmith service stays once rolled (SPEC §14.4, coordinator ruling on #1378):** whether it can act is judged when it is shown and quoted, so it is shown unavailable until the run holds something for it.
- **kindWeights** — which kind a classic merchant node turns out to be, rolled on `shopOffers` only when more than one kind has a weight above 0.
- **The market additions (SPEC §14.3, §14.6 step 5)** — `armour`, `smithStones`, `sigils`, `innRest`: each ships at a chance below 100 and a weight below the shelves above, so the shelves stay the visit's certainties and the guarantee still fills from them first. Their stock rolls on `shopOffers` after the offering roll, never on `shop`.
- **Step 5b (SPEC §14.3)** — `skillBooks`, `reviveTokens`, `questEvent`, `companions`: consumables, the quest event and companions. Each item's price and numbers are its own rows (content/consumables.js, content/companions.js); the offering adds only how many it lays out.
- **master.respecRefundPct** — a respec pays back this whole percentage of the XP spent above level 1 into the training pool (SPEC §14.5). Every reader clamps it to 50–75.
- **master shelves and services (SPEC §14.5)** — the stocked shelves (`skillBooks`, `weaponArts`, `armaments`) are each filtered to the visiting master's tracks and rolled on `shopOffers` after the offering roll. The services (`training`, `respec`, `lesson`, `appraisal`, `redistribute`) each stay laid out once rolled and are judged live. Training and appraisal can always act: every master teaches three or four tracks.
- **masters (SPEC §14.5)** — not a kind and no Settings row: who a master visit can be. A visit picks one on the `shop` stream, in written order. Each teaches 3 or 4 distinct weapon, focus or dual-wield tracks (never an armour track, which has no item type, nor a `class:` track, whose respec would strand the class tree's picks), and speaks as a speakers.csv row.

## Sigils (content/source/sigils.json)

File header (was the comment block at the top of src/content/sigils.js): sigils, the brief's "runes" (SPEC §14.3). `sigils.json` is the single array export `sigils`; each row is `{ id, name, rarity, cost, blurb }`.

- **Why "sigil".** Renamed from "rune" because that word is this spec's pre-scrub name for the currency (cinders).
- **What it does is not written here** (Codex on #1376; coordinator ruling). A sigil's effect is a property rule, as a relic's and a companion's are: its `family = sigil` row in content/source/tagging.csv names a leaf under the `sigil` branch of `property` in nodes.csv, whose rule lives in nodeEffects.json with its numbers bound to balance.sigils.*. stampTags derives `propertyTags`. Its numbers are Settings rows, so a blurb names none (the rule's own words are nodeTerms.csv's). A sigil set into a slot of an EQUIPPED armament mounts as a `sigil` carrier (engine/properties.js, SPEC §14.4). One carried in `run.sigils`, or slotted in a piece that is not worn, mounts nowhere. validateContent refuses a row that writes `triggers` or `modifiers`, and one with no property tag.
- **Prices.** `cost` is the sigil's own price; the market charges `gameConfig.shops.market.sigils.pricePct` percent of it (content/source/shops.json), so the owner tunes what the shelf asks in Settings without editing a row. The blacksmith sells no sigils; it cuts slots and sets them (§14.4).
- **Legendary sigils** are SPEC §15.4's: `{ id, name, rarity: 'legendary', blurb }`, with no cost, never shop stock, and never slotted. One works while it is ATTUNED in the Armoury's Sigils panel (model/sigils.js attuneSigil), up to `balance.sigils.attuneMax` at a time, and a fight or a treasure room can drop one (balance.sigils.dropChancePct, shipped off). Each derives exactly one property tag, and each rule is an on/if combination no relic uses.

## Feats (content/source/feats.json)

File header (was the comment above src/content/feats.js): permanent, repeatable character-level choices. Values are intentionally small because a long run may select the same feat more than once. `feats.json` is the array export `feats`; src/content/feats.js freezes the array (the rows stay unfrozen, as before).

## Class skill feats (content/source/classSkillFeats.json)

File header (was the comment above src/content/classSkillFeats.js): SPEC §13.4q class feats. The profile/run integration selects these only for mastery-scoped runs; older runs retain the existing skill-feat catalogue. `classSkillFeats.json` is the array export `classSkillFeats`; src/content/classSkillFeats.js freezes the array (the rows stay unfrozen). The `crit` and `passive` shapes are the ones described under "Skill feats".

## Skill feats (content/source/skillFeats.json)

File header (was the comment block above src/content/skillFeats.js): the feats a skill track's every-2nd level offers (SPEC §13.4o, "every 2nd level: a feat tied to the skill"). Each is taken once. Only the owner's own examples are authored here; the rest of the table is content phase C. `skillFeats.json` is the array export `skillFeats`; src/content/skillFeats.js freezes the array (the rows stay unfrozen).

- **`crit`** — Blade-tagged attacks may crit (owner, 2026-10-04): chance base + Σ weight·attribute / divisor, capped; a crit multiplies the hit. Chances from several sources add before the cap.
- **`passive`** — a tag on the character that changes every card meeting its tags (SPEC §13.4o "Passive tag effects"): `block` adds to the card's first unconditional Block, shown on the card's face.

## Survey quest lore (content/source/surveyQuestLore.json)

File header (was the comment above src/content/surveyQuestLore.js): player-facing survey writing. Keep prose outside the atlas topology tables: their historical revision includes text, and changing it would reroute seeds and refuse existing journeys. IDs, objectives and rewards stay in the atlas. `surveyQuestLore.json` is the object export `surveyQuestLore`, keyed by survey id, each entry `{ title, description, report }`; src/content/surveyQuestLore.js freezes the table and each entry, as before.

## Combat matchups (combatIntent.json, combatMatchups.json, combatExpansionMatchups.json)

File header (was the comment above src/content/combatMatchups.js): shared tactical numbers and tag riders; balance exposes these same objects. The three JSON files are the three exports of src/content/combatMatchups.js, unchanged in shape; every `[NOTE]` block is the string key `"$note"` in the JSON (see the Shops notes).

- **combatMatchups.json (version 1)** — the table the original tagged-card contract priced. Immutable history: saves priced under it keep it.
- **combatExpansionMatchups.json** — new runs carry this table separately; the version-1 table is the immutable history for saves which were priced under the original tagged-card contract. It carries no `$note` blocks.
- **`tagRiders`** (both tables) — technique riders (owner decision 11, 2026-10-12): keyed by a carrier's authored card tag, resolved with the damage rider once per action and target. A guard bypass takes the larger of this and the damage type's. In the expansion table they are the version-1 rows with status pressure for gauges.

## Map config (mapActShape.json, mapShapeLimits.json, legacyActBosses.json)

The map-generation knobs of src/content/mapconfig.js (SPEC §6). `mapActShape.json` is the shared act shape (it was the module-private `ACT_SHAPE`); src/content/mapconfig.js spreads it into `mapConfigs` for acts 1 to 3 (distinct objects, so acts can diverge later). `mapShapeLimits.json` is `MAP_SHAPE_LIMITS` (frozen in the module) and `legacyActBosses.json` is `LEGACY_ACT_BOSSES` (frozen in the module). The comments below were the module's; they are quoted as they were, so a few lines say "above" for what is now `mapActShape.json`.

### File header

    src/content/mapconfig.js — per-act map-generation knobs (SPEC §6)
    Consumed by engine/mapgen.js through model/floorplan.js; authored as data
    (SPEC §3.8, Law 1).

    EVERY FLOOR IS AN ANCHOR, NOT AN INDEX. Constantine: "make this configurable
    by data driven tooling." An absolute floor number is not configurable — it is
    a constant whose MEANING moves when `floors` changes while the constant does
    not, which is SOP 2's drift clause applied to data. The four anchor kinds are
    a closed set and live in `model/floorplan.js`:

        { at: 'first' }                 floor 1
        { at: 'last' }                  the last ROLLABLE floor (floors - 1)
        { at: 'floor',    index: 9 }    absolute; an error if outside 1..floors-1
        { at: 'fraction', of: 0.64 }    64% of the way up the rollable band

    `node tools/mapplan.mjs` prints what each one resolves to at any act length.
    Turn a knob, read the number: that is the whole feature.

    WHAT CHANGED AND WHY, so the next reader does not restore the old numbers:

      `9: 'treasure'`  ->  { at: 'fraction', of: 0.64 }
          Absolute 9 is a cliff. Below 10 floors the rank simply does not exist
          and the act ships with NO treasure — 4.0 nodes per act to 0.0, 24 of 24
          seeds, in silence. 0.64 x 14 rounds to 9, so the 15-floor act is
          unchanged, and a 10-floor act gets its treasure at floor 6.

      `15: 'shrine'`   ->  DELETED, because it never fired.
          The generator types the top floor as the lone Shrine and puts the Boss
          above it BEFORE any rule runs, so floor 15 was never rollable. Deleting
          it changes 0 of 24 seeds at 10, 12 and 15 floors (Freja, measured). It
          is not a rule we are dropping; it is a rule that was never a rule, and
          the schema now rejects it — an anchor outside 1..floors-1 is an error,
          which is exactly the check that would have caught it.

      `noEliteOrShrineBefore: 6`  ->  { at: 'fraction', of: 0.43 }
          6 gates 36% of a 15-floor act and 56% of a 10-floor one. Same number,
          different game. The fraction keeps the SHAPE: 36% at 15 floors, 36% at
          12, 33% at 10.

      `noShrineOn: 14`  ->  { at: 'last' }
          14 always meant "the last floor a rule can reach". Now it says so.

      `minReachableElites` -> `minElites` (and the same for merchants).
          The old name promised reachability; mapgen counts the whole graph. It
          never measured what it claimed. The count is unchanged and honestly
          named; the reachability number is MEASURED AND PRINTED by
          tools/mapplan.mjs on every run — deliberately not restated here,
          because a sample restated in prose drifts (Bjorn caught three homes
          carrying three different samples within a day).

### mapActShape.json: entries

    ONE MAP ENTRANCE — Constantine, 2026-08-08, verbatim and unqualified.

    `entries` and `pathCount` are two knobs and this line is why they had to be.
    The act is entered from ONE column; six walkers still climb it, so the
    routes behind that door are unchanged in number. Measured literally, "one
    path" would have been a corridor — 13 nodes and zero choices in a whole act
    (Viki, 300 seeds) — which is not what he described.

    WHAT IT COSTS AND WHAT IT BUYS, both measured at 300 seeds before it shipped:
      entrance row      5.92 columns wide  ->  1
      nodes per act     46.26              ->  35.88   (22% smaller)
      next step hidden  9 of 12 seeds      ->  0 of 12 at 390x844 (tools/mapfit.mjs)
    The act is smaller. That is the trade he chose and it is the whole reason
    the shrinkage is stated here rather than discovered later.

    EVERY SEED IN THE GAME IS A DIFFERENT MAP NOW. That is not a side effect of
    this line, it IS this line: the walkers' first roll moved, so every graph
    downstream of it moved. No save is invalidated (graphs are stored per run),
    but a seed screenshotted before today no longer reproduces.

### mapActShape.json: unknownWeights

    What a `?` node resolves to. HERE, beside the geometry it belongs to, and
    no longer in `balance.unknownNode` — a flat global could not differ per act
    while the map it describes is per act, and nothing said so (Freja).

### mapActShape.json: floorRules

    TWO GATES WHERE THERE WAS ONE, and the split is what E13 needed. The old
    `noEliteOrShrineBefore` opened rests and Elites on the SAME floor, so the
    earliest rest could never be below the earliest Elite. Constantine asked
    for a rest "so eletes, maybe shop, and definitely before a boss".

    THE ELITE GATE DOES NOT MOVE. 0.43 is the number that shipped, so Elites
    land exactly where they landed before this change; only the rest opens
    earlier. That is the smaller of the two edits available and it is
    deliberate — retuning where Elites appear is a separate decision from
    promising a rest below them.

      0.27 x 11 -> floor 3      rests open here
      0.43 x 11 -> floor 5      Elites open here, unchanged
      => floors 3 and 4 are where the promised rest can land

    E13's other half, and the generator keeps it the way it keeps `minElites`
    — by barring the roll and then force-placing, never by hoping. Measured
    on the canonical seed stream before it shipped: 124 of 180 maps carried
    an Elite with no Shrine on any earlier floor. `node tools/mapplan.mjs`
    prints the number now, including the per-path reachability this rule
    does NOT promise.

    WHAT IT COSTS, and it is not free: the shortest act these rules can
    describe moved from 4 floors to 7 (`minViableFloors`, and the run-shape
    test pins the number). A 6-floor act resolves `noShrineBefore` onto floor
    1, which the fixed Monster already claims, so no floor is left to hold
    the promised rest and the resolver refuses rather than force-placing over
    another rule. That narrows Constantine's short-run slider, which is a
    real trade against "I only have the patience for 30 min runs".
    The other end of it, if he wants the range back: `noEliteBefore` at
    { fraction: 0.5 } takes the shortest act to 6 and moves Elites one floor
    later on the shipped act (5 -> 6). 0.43 is kept here because it is the
    number that shipped, so Elites land exactly where they always did.

### mapShapeLimits.json

    THE DEBUG RUN SHAPE — Constantine, 2026-08-08, verbatim:

      "need to do a full run, but I only have the patience for 30 min runs.
       perhaps add an advanced debug feature to limit the amount of max columns,
       rows, and or columns with percent chance of certain nodes being more
       likely"

    Three knobs, and the entry below is the ONLY thing this feature adds to
    content. Everything else about it is DERIVED (Law 0 clause 1):

      floors cap    max = whatever THIS act authors above; min = the shortest act
                    this act's own floorRules can describe, found by ASKING
                    resolveFloorPlan (model/floorplan.js `minViableFloors`). Edit
                    the anchors above and the slider's low end moves on its own.
      columns cap   max = authored; min = the one number below, because "a
                    corridor is not a map" is a design call and not arithmetic.
      type weights  ONE SLIDER PER KEY OF `typeWeights` ABOVE. The Custom Climb
                    screen reads that object and builds its controls from it, so
                    adding a node type to the act adds a knob with zero UI edits.
                    That is this feature's Law 0 falsifier and it is testable.

    A CAP, not a setting: the effective value is min(authored, cap), so a cap
    above the authored number does nothing — and the readout SAYS SO rather than
    letting it look like it did something (Law 0 clause 5).

- **minColumns**:
    Two columns is the floor because ONE column is a corridor: every walker
    lands on the same node, the act has zero choices, and the shape is
    identical every seed (Viki measured exactly this at pathCount 1 — 13 nodes,
    no decisions, 300 seeds). A short run is the ask; a run with no map is not.
- **maxWeight**:
    The largest weight a knob may set. Weights are RELATIVE — the odds a type
    is rolled are its weight over the total — so this number is a slider end,
    not a percentage. The screen prints the derived share beside each one.

## Custom Climb modifiers (content/source/customMods.json)

File header (was the comment block at the top of src/content/customMods.js): a tailored take on Slay the Spire 2's custom mode. `customMods.json` holds four keys, which src/content/customMods.js re-exports as `DIFFICULTY_MODS`, `CHAOS_MODS`, `DECK_MODES` and `ASCENSION_ORDER`; each mod row is `{ id, label, desc }`. Tuning magnitudes live in `balanceCustomMods.json` and `balanceEndless.json`, not here.

- **`difficultyMods`** — harder rules. The Ascension ladder just enables the first N of `ascensionOrder`, so "Ascension 4" is the four hardest-first rules, and every rule is also individually toggleable.
- **`chaosMods`** — flavourful run-warping toggles, independent of difficulty.
- **`deckModes`** — how your starting deck is built.
- **`ascensionOrder`** — Ascension enables the first N difficulty rules (hardest impact first). `MAX_ASCENSION` is its length, computed in JS.
- The orchestrator (main.js) reads `run.custom.mods[id]` at the relevant hook; nothing here is engine-specific.
- **Deleted union.** `ALL_MODS = [...DIFFICULTY_MODS, ...CHAOS_MODS]` stood in the module with no reader in src/, tools/ or tests/ — a union kept in case somebody wanted one. Deleted rather than documented: nothing re-typed it, so there is nothing to collapse into, and the day a screen needs both groups it can spell the spread itself.

## Seats (content/source/seats.json)

File header (was the comment block at the top of src/content/seats.js): THE SEATS (SPEC §13.1). A seat is a region with its content: enemies, encounters, boss pool and combat scenery. An act is a seat at a tier: `run.actNumber` is the tier, `run.seatOrder[tier - 1]` the seat. `seats.json` has two keys: `seats` (src/content/seats.js freezes the array as `SEATS`, rows stay unfrozen) and `causewayRegionId` (`CAUSEWAY_REGION_ID`).

- **`seats[].baseTier`** — the tier the seat's numbers were authored at (the act it used to be), so climbing it at another tier scales by a RATIO against this baseline (`balanceSeatTiers.json`, SPEC §13.3), and a seat at its own baseline scales by exactly 1. That ratio is the whole of the byte-identity claim in §13.6: an existing seed climbing the default order fights the fights it always did.
- **`seats[].regionId`** — a foreign key into content/environments.js. The check stays in src/content/seats.js, at module load, so a mistyped region fails the boot rather than painting the wrong sky (Law 1 clause 5).
- **`causewayRegionId`** — the scenery of the final tier's boss node, the causeway to the Ashen Spire (SPEC §13.2, LORE §1): a region that is no seat's, painted where the last climb ends whichever seat holds it. Data, so the model never spells it. Checked against the environment regions the same way.

## Keywords

Header comment of the old `src/content/keywords.js` (SPEC §3.7 note): semantics for
these ids are engine primitives (card-zone/turn rules that cannot be data); this
registry supplies only what tooltips show.

## Consumables

Skill books and revive tokens (SPEC §14.3). Hand-authored rows are `content/source/consumableBooks.json`
(books) and `consumableTokens.json` (revive tokens); the per-class books are derived in
`src/content/consumables.js` from `classes`, so a new class still gets its book.

A consumable is carried as a count in `run.consumables` ({ [id]: count }), bought at the market and
sold back through its Sell pane.

- skillBook `{ skill, xp }`: read out of combat from the Armoury's Inventory: choose a lesson,
  awardSkillXp on its track and learn one card, then the count drops by one.
- revive `{ hpPct }`: spent by itself when the player would drop to 0 HP in a fight; HP becomes
  max(1, floor(maxHp x hpPct / 100)).

EVERY NUMBER HERE IS A DEFAULT. Each carries a note (the `$note` key, the sentence its row shows), and
Settings > Advanced > Shops generates a row per number, `gameConfig.consumables.<id>.<key>`, frozen into
the run's snapshot like the Shops rows (model/consumables.js consumableConfigRows). validateContent
refuses a number with no note, a fraction, a price below 1 and a `sellValue` above `cost` (a sale never
beats the price), each by name.

`blurb` may name `{xp}`, `{hpPct}` and `{skill}` (the track's label); the shelf fills them from the row's
live values, so a tuned number never leaves a stale sentence.

## Companions

Temporary companions (SPEC §14.3). A companion travels with the run for `combats` fights, held in
`run.companions` as { id, combatsLeft }; `combatsLeft` drops by one at each combat end
(engine/runCombat.js runCombatEnd) and it leaves at 0. One of each at a time: the market never offers
one already travelling.

WHAT IT DOES IS NOT WRITTEN HERE (Codex on #1376; coordinator ruling). A companion's effect is a
property rule, as a relic's and a location's are: its `family = companion` rows in
content/source/tagging.csv name leaves under the `companion` branch of `property` in nodes.csv, whose
rules live in nodeEffects.json with their numbers bound to balance.powers.*. stampTags derives
`propertyTags`, and the fight mounts it as a `companion` carrier (engine/properties.js
syncCompanionProperties). validateContent refuses a row that writes `triggers` or `modifiers`, and one
with no property tag.

`cost` and `combats` are defaults, each with a note (`$note`): Settings > Advanced > Shops generates
`gameConfig.companions.<id>.<key>` for them.

## Combat expansion tables (combatExpansionLore.json, combatExpansionEquipment.json, combatExpansionMartialOverlay.json, combatExpansionCardOverlay.json, combatExpansionSpellProfiles.json, cards/combatExpansionNewCards.json)

Each compiles to `src/content/generated/` (the card pool to `generated/cards/`); the matching `src/content/combatExpansion*.js` module re-exports it.

- **combatExpansionLore** — three-part lore for the expanded techniques and borrowed Blight cards.
- **combatExpansionEquipment** — scoped ids are deliberate in `armour`: two classes can wear different sets named `default`, so a key is `<class>:<set>`.
- **combatExpansionMartialOverlay** — existing ids, rather than display names, own every changed Martial role. The projection runs after equipment composition and only for version 2. Each id maps to its maneuver (`attack`, `defend`, `sweep`, `smash`, `counter`, `ranged`, `support`). Exceptions: `lethalDose` is a thrown vial, a projectile at Reach, never a Ranged maneuver (owner #22); `nockAndWait` is a Counter with `counterMode: "ranged"` at Reach; `whirlingGuard` and `sweepingBlow` carry `defensiveReaction` (defensive use still pays and resolves the card's printed effects); `sweepingBlow.buildup` is authored bodily pressure on all enemies, so a wide sweep disrupts footing without every Sweep granting an automatic active status (two base sweeps fill 6).
- **combatExpansionMartialTables** (not exported; read by `applyCombatExpansionMartial` in `combatExpansionMartial.js`, which stays JS because it is logic) — `area`, `ranged`, `evades` are id lists; `poiseReplies` is the Poise a Counter returns; `replySourceBase` holds the authored, ungraded v2 source amounts: permanent primary damage improvements become Poise improvements on zero-HP Counters and never restore HP retaliation, while conditional grade effects keep their gates; `upcast` is per-rank growth; `status` maps a status to its recovery profile.
- **combatExpansionCardOverlay** — explicit authored ids are the mapping authority: each card id maps to its `school` and `damageType`. This overlay is applied only by the v2 resolver; old runs continue to use their original definitions. School to damage type: force blunt, frost frost, lightning piercing, fire fire, alteration blunt, illusion psychic, divine sacred, decay decay.
- **combatExpansionSpellProfiles** — spell profiles for the staff and sceptre weapon cards, keyed by `equipmentProfileId`.
- **cards/combatExpansionNewCards.json** — the eight school Counters (`<school>Counter`, plus `barrageCounter` "Barrage Interception"), the seven cantrips and the five status cards added for the expansion. The counters and cantrips were once built by two JS helpers (`counter`, `cantrip`); the rows are now written out in full. Every row has `minCombatExpansionVersion: 2`. A counter's text is "Gain {gainBarrier} Barrier. Prepare a <school> Counter: <ward> Ward and <poise> Poise return."; a cantrip's pressure status maps to its recovery profile (`sleep` and `weak` mental, `crimsonBlight` curse, anything else elemental).
- **combatExpansionCardTables** (not exported; read by `applyCombatExpansionCard` in `combatExpansionCards.js`, which stays JS because it is logic) — `area` and `ranged` are id lists; `counters` is the spell Counter coverage and Ward/Poise return per card; `upcast` is per-rank growth; `chancePressure` lists the cards whose buildup becomes a chance (50 base, 75 upgraded, plus 25 per upcast rank); `status` maps an old status to its buildup status and `profile` maps a buildup status to its recovery profile.

## Attributes and character creation (attributes.json, creationModes.json, attributeRules.json)

Compiled to `src/content/generated/`; `src/content/attributes.js` re-exports them. These are the comments that lived in the old `attributes.js`, in file order (JSON has no comments); each comment block is indented as text.


    src/content/attributes.js — authoritative Phase 1 creation-stat data.

    These values are inert run identity. Combat, checks, resource pools and
    derived formulas do not read them in Phase 1. `strength` and `dexterity`
    deliberately share display words with existing transient combat statuses;
    they remain separate namespaces until a later feature defines a bridge.

    Constitution is the authored HP and Stamina source. Vigour is the retired
    three-day save spelling; the load door migrates it through retiredNames.js.

    `sense` and `disclosure` are the D26 short form (model/disclosure.js).

      sense       ONE player sentence, and it carries NO NUMBER. Every number in
                  a reveal is derived from the table that owns it — a figure
                  typed into prose is a copy nothing syncs (Law 1 clause 2,
                  which calls that a defect "even in tooltip prose"). So this
                  says what the attribute IS; what it FEEDS and what it UNLOCKS
                  are read off derivedStatRules and equipmentRequirements at
                  render time and can never go stale.
      disclosure  'face' (in the short form) or 'reveal' (behind the tap). All
                  five are face-tier because he named them: "just the starting
                  stats". This is data, not a decision the screen makes.

    ---- THE LEAN SCALE (owner, 2026-09-20) ---------------------------------

    His words: "I'd like the default stats to be low, with everyone having a
    total pool of points starting off. the default stat for each stat is 1 and
    assign allows a user to assign 3 points."

    So the mode IS those two sentences and nothing more:
      baseline 1      "the default stat for each stat is 1"
      bonusPool 3     "assign allows a user to assign 3 points"
      minimum 1       a stat cannot be worth less than existing
      maximum 4       1 + 3 — pouring the whole pool into one attribute is the
                      ceiling, so no cell can be typed that the pool cannot pay
      total 8         5 x 1 + 3, which is what every class carries at creation

    A NEW MODE, NOT AN EDIT TO tuned2 — the same reason tuned2 was a new mode
    and not an edit to tuned. Every in-flight save is validated at the load
    door against the total of the mode it was created under, and save.js
    ARCHIVES what fails there. tuned2 stays in this table, and leaves creation
    through characterCreation.visibleModeIds.
    THE LABEL IS 'Standard' (owner, 2026-09-24, second pass: creation "should
    have the option of standard (pre assigned class presets) and assign points
    (x points to assign but configurable in advanced settings)"). It briefly
    read 'Assigned' earlier that day. The id stays `lean`: every save and
    exported configuration keys on it, and every character made under it was
    made at exactly these presets, so Standard IS this mode — same total, same
    bounds, same presets — and no save validated against it can change verdict.
    `opensOn: 'preset'`: choosing it seats the class preset with nothing left
    to spend, so the player can continue at once; Edit points still reshapes
    the same fixed total.

    'allow' is the reclaim clause: a point placed can be taken back off a
    stat down to `minimum`. At baseline 1 there is nothing below to reclaim
    to — it matters the moment the baseline is raised in Settings, which is
    now a dial (gameConfig.startingStats.lean.baseline).

    NO CONVERSION SCALE, AND THE POOLS ARE SMALLER FOR IT (owner,
    2026-09-21: "all calculations should be sum(floor(statmult*stat)) +
    equipment bonus"). This mode shipped `statConversionScale: 1/5` so the
    ruleset-5 coefficients — Mana IS Wisdom, HP is 30 + 4 × CON, every one
    read off the tuned2 span 3-12 — would land on tuned2's own pools when
    the span became 1-4. The cost was that no formula read the attribute on
    the character sheet: every one of them divided by the fifth first, and
    the settings rows the player tunes described arithmetic the game did not
    do. The divisor is gone from the codebase; what a coefficient says is
    what it does. THE POOLS THIS MODE OPENS ON ARE THEREFORE WELL UNDER WHAT
    #1238 SHIPPED — a stock Reaver climbs on 48 HP where it climbed on 70,
    both figures counting the Forsaken Medallion's flat ten — and moving
    them is a retune of `derivedStatRules` and the rating weights, in the
    open, not a scale hidden behind them. The bases carry part of that
    restatement already (hp 20 → 30, Actions and draw → 3, Mana, Stamina,
    Poise and Ward → 1), which is why it is not the bare fifth the divisor
    would have made it.
    THAT RETUNE LANDED (A3, 2026-09-27, FINISH D28): hp.base 30 → 51, sized
    from the simulator's incoming damage over a run's first three fights
    (`node tools/runsim.mjs 100 --seeded-seats --incoming`), not from the
    old 70 — a stock Reaver now opens on 70, Starseer 69, Rogue and Herald
    59. The row and its measurement live in content/derivedStats.js.

    ASSIGN POINTS ON THE LEAN SCALE (owner, 2026-09-24): every attribute at
    1 and the whole pool unspent (`opensOn: 'baseline'`), the pool a dial of
    its own (`gameConfig.startingStats.assign.*`). A NEW ID, because `lean` is
    Standard's and saves key on it; NOT `pointbuy` or `standard`, whose
    10-scale totals every save made under them is still validated against.
    Its numbers start equal to lean's, so both open on eight points.

    THE REBASED SCALE (plan phase 9). Ten was never a floor a player chose —
    it was the middle of a d20 habit this game does not otherwise keep. Five
    is the baseline, ten points are yours to place, and the span 3–12 is wide
    enough that a point is worth spending: under ruleset 5 a point of Wisdom
    IS a point of Mana and a point of Constitution IS a point of Stamina, so
    the scale and the pools finally speak the same units.

    THE OLDER MODES BELOW ARE KEPT AND HIDDEN. Every in-flight save was
    validated against its own mode's fixed total at the load door, and
    save.js ARCHIVES what fails there, so deleting a mode would refuse every
    run created under it. They stay in the table and out of creation, which
    characterCreation.visibleModeIds decides.

    E5 (#250) — Constantine's own numbers, verbatim from the card: "10 points,
    configurable; points come back out when a stat is dropped; floor 8, ceiling
    15 at creation, both customizable; the floor is the reclaim limit; 15 caps
    CREATION, not the character."
      bonusPool 10        the ten points ("configurable" = it is content, here)
      minimum 8 + allow   the floor IS the reclaim limit: a stat may be dropped
                          below its baseline down to 8, and fixedTotal hands
                          the difference back to the pool by construction
      maximum 15          caps creation only — allocationProblems already
                          raises the ceiling by levelled points, which is his
                          "not the character" clause, shipped before this mode
    A SECOND MODE, NOT AN EDIT TO `standard`: standard's fixedTotal of 55 is
    what every existing save is validated against at the load door, and
    save.js ARCHIVES what fails there. Changing standard's pool would refuse
    every in-flight run the first boot after update.

    Complete mode × class × attribute product. No Origins are enabled in Phase 1.
    The pointbuy presets are the EDITOR'S OPENING POSITION and the load-door
    refill value — a legal allocation (sum 60, cells 8..15), thematically the
    standard preset with the five extra points laid along each class's grain.
    The player reshapes them; nothing here is a recommendation.

    ---- LEAN ------------------------------------------------------------
    Baseline 1 in every cell, plus the three assignable points laid along
    each class's grain. Every row therefore sums to 8 and sits inside 1–4,
    and every row can hold the kit its class starts in after the equipment
    table was restated for this span (content/source/equipmentRequirements.csv):
    the Reaver's Iron Vanguard sword asks 2 Strength, the Starseer's Ash
    Focus staff 3 Intelligence, the Rogue's knife 2 Dexterity.
    attributeContentProblems and validate.js refuse any row that fails either.

    ---- ASSIGN ----------------------------------------------------------
    The player never opens on these — Assign points opens on all 1s — but a
    mode needs a legal preset per class: it is what the creation preview
    shows before the pool is spent, and the load door's refill value. So
    they are lean's rows, the class's grain on the same eight points.

    Each row sums to the mode's total (5 × 5 + 10 = 35) and sits inside
    3–12; attributeContentProblems refuses any that does not, by name.

## Derived stats (derivedStatRules.json)

Compiled to `src/content/generated/derivedStatRules.js`; `src/content/derivedStats.js` re-exports it. These are the comments that lived in the old `derivedStats.js`, in file order (JSON has no comments); each comment block is indented as text, and a trailing comment on a row appears as a bullet.


    src/content/derivedStats.js — shipping authority for derived-stat rules.

    The content registry validates this table, and run creation snapshots its
    resolved rules so saves, sessions, and co-op keep the same derived values.

    RULESET 6 — ONE FORMAT FOR EVERY STAT AND RESOURCE (owner, 2026-09-21).

    "make mp hp and every resource now a similar calculation to AR, PR, DR,
    etc. I'll just use decimal values to set the growth per level, in fact I'd
    like all the resources and stats to be in the same format so that there was
    no confusion to include the base values and everything because they are way
    too separated."

    So a row here is now the SAME ROW a combat rating is (model/ratingFormula.js
    — AR, DR, PR, Poise, Ward), with the level term on it:

      base         before a single point is spent
      <attribute>  that attribute's decimal contribution per point, floored on
                   its own: 0.2 gives nothing until the attribute reaches 5
      perLevel     DECIMAL growth per character level: 0.2 is a point every
                   five levels, 1 is one every level

    WHAT MOVED FROM RULESET 5: nothing in the attribute terms — every weight
    below is ruleset 5's `gainPerTier / pointsPerTier` restated, and lands on
    the same number at every attribute value. The LEVEL terms are decimals now
    and so are SMOOTH: HP climbs 1 per level instead of 5 every fifth level
    (the same rate, arriving each level rather than in lumps); Mana, Stamina
    and draw land on exactly the levels they always did. Ruleset 5 and earlier
    are restored exactly as they were saved; only new runs read this.
    RULESET 7 — EVERY STAT IN THIS TABLE (owner, 2026-09-24).

    "mana should be derived but mostly comes from about 4 points in wisdom
    with some from constitution strength and intelligence … I'd like all
    features, handsize, draw amount, actions, ar, dr, pr, ward, poise, stamina,
    mana, hp settings to have a similiar interface and be driven by only that
    interface. default should equal about 2 when adding all partials values as
    the budget per with mana and stamina budget is about 1."

    So the combat ratings (AR, DR, PR, Ward, Poise — formerly model/
    ratingFormula.js) and the hand (opening hand, per-turn draw, hand size —
    formerly content/handRules.js and the balance fallback hand size) are rows here, in the
    row every pool already used:

      base         before a single point is spent (whole points)
      <attribute>  that attribute's decimal contribution per point, floored
                   on its own: 0.125 gives nothing until the attribute is 8
      perLevel     decimal growth per character level after the first
      min / max    optional bounds the value never leaves

    THE BUDGET: a row's weights sum to about 2, Mana's and Stamina's to 1.
    HP, Actions and the three hand rows are PRESERVED rather than re-budgeted
    — a literal sum of 2 would hand out some ten extra Actions at creation —
    and read what ruleset 6 read at every attribute 5 and at 12 in the lead
    stat. Rulesets 1–6 are restored exactly as they were saved; only new runs
    read this.

    Owner defaults, 2026-09-24 (ashen-spire-game-config_4.json): every
    pool reads a spread of attributes, not one.

    A3 LEAN RETUNE (2026-09-27, FINISH D28). Two numbers moved, each sized
    from `node tools/runsim.mjs 100 --seeded-seats --incoming`:
      energy.dexterity 0.2 → 0.25   the first extra Action at DEX 4, not 5:
          reachable at creation (Assign points can put all three points
          there), one level-up away for the Standard Rogue (DEX 3) and three
          for every DEX-1 preset. The level term (0.1) is unchanged.
      hp.base 30 → 51               the lowest stock pool (Rogue and Herald,
          38 before) now covers the fleet's 90th-percentile HP lost over a
          run's first three fights (59, every class pooled). Every stock
          pool rises by the same 21: Reaver 70, Starseer 69, Rogue and
          Herald 59. Only the base moved; CON still pays 4 a point.

- **energy:** — Retired save row; combat reads Stamina.

    Owner, 2026-10-03: open and draw four, with the existing Draw scaling
    (+1 per five INT above 4). Retain adds to the next draw. Owner,
    2026-10-11: the hand size is now 7 + INT scaling (+1 per five INT above
    4, like Draw), capped at 20. Each row remains configurable, and
    existing runs continue to read their snapshotted rows.

    Owner, 2026-10-06: each primary attribute has a clear +1 main bonus.
    Bases, level growth and secondary resource rules stay independently
    configurable. Existing runs retain their snapshotted coefficients.

    Budget 1 each, the owner's own sums.

    Equipment, relics and statuses add on top of each attribute's bonus.

    ONE Poise: the rating and the pool were two rows for one number. Armour
    and relics remain its external addends, exactly as HP's equipment bonus.

    ---- D26: how each row READS, authored beside the row it describes -------

    WHY IT IS A SIBLING OF `rules` AND NOT A FIELD ON EACH RULE. A rule row is
    SNAPSHOTTED into every save and every co-op handshake (createDerivedStat-
    RuleSnapshot): putting a label and a sentence in there would write prose
    into save bytes and make a copy-edit a save-compatibility question. So
    presentation sits outside the snapshot and inside the same FILE — one
    author edit adds a derived stat and how it reads, and a row here with no
    rule (or a rule with no row) is refused BY NAME at the content door
    (derivedStatPresentationProblems, model/derivedStats.js).

      label       the row title. These five strings were the hard-coded LABELS
                  map in model/statProjection.js until now — a second home for
                  a fact the table should own. Moved, not copied.
      faceLabel   OPTIONAL. What the chip says when the label is a phrase. Left
                  out, the face uses `label` (Law 0 clause 3: derivation is
                  overridable and the override is data).
      order       the order every stat surface reads them in.
      disclosure  'face' = in the short form · 'reveal' = behind the tap.
      sense       ONE player sentence, no numbers in it (Law 1 clause 2).

    STAMINA IS 'reveal' ON PURPOSE and it is the honest half of this table:
    a Stamina-cost card spends it — the sense line below names which — and an
    idle turn recovers some (framework Mana & Stamina rule). The old panel once said
    "No current consumer" in engine words on the first screen of the game; the
    sense line below is the player's words, one tap down.

    Retained for old saves and exports; omitted from character stat surfaces.

## Action costs (actionCosts.json)

`content/source/actionCosts.json` is one object whose keys are the export names of `src/content/actionCosts.js`; content-build compiles it to `src/content/generated/actionCosts.js`. The module re-exports each key frozen at the depth the old hand-written constants had (a freeze is code, not data) and derives `TWO_COST_EFFECT_MULTIPLIER` from `COST_BUDGET.twoCostMultiplier`. These are the comments that lived in the old `actionCosts.js`, in file order (JSON has no comments); each comment block is indented as text, and a trailing comment on a row appears as a bullet. docs/alternative-combat-rounds/COST-WEIGHTS.md gives the reason for every weight.


    src/content/actionCosts.js — the action-cost tunables (owner decisions, 2026-10-12).

    Every number a card's Stamina (SP) and Mana (MP) cost reads, and every number an enemy move's SP and an enemy's SP
    pool read, lives here. src/model/actionCosts.js validates these tables and derives the costs; this file is data only.
    docs/alternative-combat-rounds/COST-WEIGHTS.md gives the reason for every weight, and
    tests/action-costs-weights-doc.test.mjs fails when the doc and this file disagree.

    PLAYER CARDS (owner, 2026-10-12, SPEC §4.3a). Each resource is priced on its own side:
      S_sp = damageWeight × physical damage + rankWeight × rank + Σ SP-side tag weights × stacks + range weight
             + castingEffort (cast cards) + restoreWeight × Mana restored + drawback weights (negative)
      S_mp = damageWeight × magical damage + rankWeightMp × rank (magical cards) + Σ MP-side tag weights × stacks
             + restoreWeight × Stamina restored
      SP = floor(S_sp / spDivisor) − Stamina restored, MP = floor(S_mp / mpDivisor) − Mana restored, each at least 0.
      If both are 0, the larger side pays 1 (SP on a tie); a Mana-restoring card pays SP.
    Opt-outs keep the authored cost and numbers: costRule 'fixed', curses and statuses (by type), and X costs.

    ENEMIES (owner, 2026-10-13, SPEC §4.6a). An enemy's SP pool is its stats: ENEMY_SP_ROW read on its `attributes`
    (shifted by ENEMY_BLIGHT_SHIFT when it is `blighted`), plus its `equipmentSp`. A move's SP is its own `sp`, else the
    stance price below.

    ---- Player cards: the budget tunables -------------------------------------------------------------------------

- **spDivisor:** — D: S_sp points per Stamina (the owner's ruling, 2026-10-12: "use D as 6")

- **mpDivisor:** — P: S_mp points per Mana (raised from 6: at 6, rank 1-3 spells and rank 1-2 cards miss 80%)

- **damageWeight:** — points per damage step reached (damageSteps); raw damage would swamp the tags

- **damageSteps:** — damage thresholds (hits counted); empty = linear damage × damageWeight

- **rankWeight:** — points per rank above the base (a base card, rank 0, adds nothing); SP side

- **rankWeightMp:** — points per rank on the MP side of a magical card (owner, 2026-10-12: rank counts on the Mana side too)

- **castingEffortWeight:** — points on any cast card (camp:spell or maneuver:casting); SP side

- **restoreWeight:** — points per Mana restored (SP side) or Stamina restored (MP side)

- **smashPoiseBase:** — Poise damage every smash adds to its own (owner, 2026-10-13: "All smashes deal poise damage")

- **twoCostMultiplier:** — a card whose derived SP is 2 or more multiplies its effect amounts by this

    Combat tag weights (-3..3) and the side each counts on. A tag counts once per card at its weight. A tag the card
    does not carry, or that this table does not list, adds nothing. Range tags are priced by RANGE_WEIGHTS instead.

    Damage types

    Camps and sources

    Maneuvers

    Targeting

    Magic schools

    Spell identity chips: their authored effects and range own the price.

    Weapon and theme chips (card domain)

- **rank.cantrip:** — training classification; numerical rank owns the cost

    Techniques

    Traits

    Precision lifetime is a marker; its status grant already prices magnitude.

    Reaction rules version 2 traits (docs/combat-card-traits-contract.md). Combat adds them after the cost is derived
    (engine/combatExpansion.js applyCardTraits), so today these weights price no shipped card.

    Keywords

    Drawbacks (owner, 2026-10-12: negative weights). Read from the card's keywords and effects (DRAWBACK_SOURCES).

    Where a card's drawback and keyword tags come from: a keyword it carries, or an effect it makes the player pay.

    Keyword tags that are drawbacks (owner, 2026-10-12): they may weigh below 0.

- **loseHp:** — an HP (or other resource) cost

- **discard:** — a discard the player pays

- **grantCardCharge:** — takes several turns to cast (a charge the player builds first)

- **addCard:** — a curse or status added to the player's own piles

    Range weights (owner, 2026-10-12: melee 1, reach 2, ranged 3). A card takes the largest range it carries. SP side.

    Tags that mark a cast (the casting-effort weight).

    Statuses the card applies (applyStatus or buildup): weight × stacks (a buildup counts as 1 stack). Every status weighs
    2 or more (owner). A status counts on the card's side: MP on a card with any MP-side tag, else SP.

    Stacks above this count as this many; null counts every stack (owner, 2026-10-12: status stacks count).

    The effect ops that restore Stamina (priced on the MP side) and Mana (priced on the SP side).

    The maneuver floor (owner, 2026-10-13: "basic ones are 2sp"): at rank 0 a card with this tag costs at least this SP.
    A higher rank has no floor ("some higher rank ones could cost 1 sp"); an authored upgrade that lowers the cost lowers
    the floor by as much.

    A sweep pays for its area, so these ops stay unscaled on a 2-SP sweep (owner, 2026-10-13: "AoE for sweeps but normal
    damage"); its other riders (Block, buildup, Poise) scale.

    The effect ops whose `amount` scales on a 2-SP card. Costs, card counts (draw, discard, addCard), turns and
    durations (applyStatus.duration), stack counts and hit counts are never scaled.

    ---- Enemies ---------------------------------------------------------------------------------------------------
    The enemy SP row (owner, 2026-10-13: "enemies are essentially characters with cards, at about 2 SP"; minions usually
    1-2 SP, elites 2-3, bosses 3-4, all from stats and equipment). SP = base + Σ floor(attribute × weight) + equipmentSp,
    each attribute term floored on its own. Enemy attributes are inflated next to a player's 1-4.

    The SP band an enemy's pool (normal, elite, boss) must land in; a test holds every enemy to it.

    Blight (owner, 2026-10-13): "blight lowers INT, WIS and DEX and raises STR and CON". A `blighted` enemy's attributes
    shift by these amounts (floored at 0) wherever its stats are read.

    SP per stance for an enemy move that does not name its own `sp`.

## Progression (content/source/progression*.json)

The class-progression content under `src/content/progression/`. Flat top-level file names (the compiler reads only `cards/` as a subfolder). Each module imports its generated rows from `src/content/generated/` and keeps its real logic in JS; each module's header says which part is which.

### Card families (progressionCardFamilies.json)

`src/content/progression/cardFamilies.js` re-exports it as `cardFamilies`. Header comment: "Approved progression catalogue; exact family identities, unlocks and rank costs. Recipes live in cards.js; tags live only in content/source/tagging.csv." The recipes that turn a row into a card (riders, grade budget) are code in `cards.js`.

### Card lore (progressionCardLore.json)

`src/content/progression/cardLore.js` re-exports `progressionCardLore`. Header comment: "Three-part card lore: identity, remembered history, and a closing line." Keys are the family id without its `progression-` prefix; `cards.js` joins the three strings with blank lines into the card's `flavor`.

### Gear requirements (progressionGearRequirements.json)

`src/content/progression/gear.js` re-exports `progressionGearRequirements`. Header comment: "All 63 gear requirements, including the level-zero public baseline." Level 0 rows are the baseline every class starts with. `unlocks.js` turns each row above level 0 into a `weapon` or `armament` unlock row.

### Relics (progressionRelics.json, progressionRelicUnlocks.json)

`src/content/progression/relics.js` re-exports `progressionRelics` and `progressionRelicUnlocks`. Header comment: "Relic definitions and gates are one independently installable module." The relic rows are the definitions; the unlock rows (`kind: "relic"`) are the class-level gates for them.

### Feats (progressionFeatRows.json, progressionFeatUnlocks.json)

`src/content/progression/feats.js` keeps `progressionFeats` and `progressionFeatUnlocks` (both frozen) and builds them from the generated rows. Header comment: "Fifty class feats. Their descriptions and effects share normalized balance bindings." The rows hold id, skill, minimum level and name only; each feat's `description` is derived in JS by `getFeatDescription` from balance, property rules, tagging and the variable bindings, so it stays code. The unlock rows (`kind: "feat"`) are the class-level gates.

### Unlocks (progressionUnlockRows.json)

`src/content/progression/unlocks.js` exports `progressionUnlocks`: the JSON rows (existing families rescheduled by the approved expansion catalog) followed by the item gates, which are derived in JS from the single gear requirements table (`progressionGearRequirements`, level above 0) and the ARMAMENTS table (`kind: "weapon"` for a weapon, `"armament"` otherwise). Edit a gear gate in progressionGearRequirements.json, not here.

### Lessons (progressionLessonRecipes.json)

`src/content/progression/lessons.js` exports `abilityCardUpdates`: one update per recipe row, derived in JS from the class card pools (`reaver`, `starseer`, `rogue`, `herald`), `cardExposure` and the grade maths (`lessonGrade`). Header comment: "Explicit shared lesson and cost-retune recipes. Existing school/status identity is preserved from the authored family; no class pool is broadened."

Each row was a positional tuple `[id, source, default rank, exact Actions at rank 2, primary index, six authored primary values (or explicit grades)]` plus an options object; the comment on the table said "Conditional/secondary effects activate at 2." The tuple is now named fields:

- **id** — the card id in a class pool. **abilityKind** — `spell` or `maneuver` (the old "source"). **abilityRank** — the default rank. **actionCost** — the exact Actions at rank 2. **primaryIndex** — which of the original card's effects is the primary one. **values** — the six authored per-rank primary values.
- **grades** (optional) — six explicit grade profiles, used instead of `values`. They preserve the previous resolved resource prices and riders, and author the payoff of the paid entry spells and arts directly instead of letting a stronger effect buy another resource tax.
- **alwaysRiders** (optional) — keep the non-primary effects at every rank (otherwise they start at rank 2).
- **fixedGradeCosts** (optional) — `{ "<rank>": { actionCost, manaCost } }`. The `crimsonCleave` entry preserves the existing resolved grade-4 price after correcting Sweep area targeting.

### Cards and grade rules (progressionGradeRules.json)

`src/content/progression/cards.js` ("Forty class families. Rank is a recipe selection, never an imperative card hook.") stays JS: it holds `riders`, one function per family that builds that family's rank-2-and-up effects, plus `familyGrade` and the card assembly, all logic over the card families and lore rows. Its comment "Only the family rider is specialized. Shared grade milestones and budgets are composed below, with no engine branch naming one of these families." still applies.

The two constants it shares with `lessons.js` are data:

- **gradeBudget** — the approved total direct damage and Block ceiling at each of the six ranks. Catalogue values are per hit; the explicit immediate rider budget and the milestone Block are reserved before a primary is clamped to this ceiling.
- **areaFamilies** — families whose primary hits every living enemy from rank 3.

`cardRecipeText.js` (the display text builder; "Display is derived from the same numeric recipe rather than copying numbers into prose. Condition descriptions carry no hidden combat implementation.") and `rules.js` (re-exports `balance.progression`; numeric defaults and their Advanced help live in the one balance source) are wholly logic or derived from another module, and stay JS.

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

### balanceClassTree.json — classTree

- **`classTree`** — The class tree's numbers (plan phase 5b): one row per node, read by its
  variable bindings; the tree itself is content/source/classTree.csv.

### balancePowers.json — powers

- **`powers.ashenGrip`** — The four class kit relics (plan phase 5a, proposal §4).
- **`powers.hollowSquire`** — The two companions (SPEC §14.3): their property rules read these, so a
  companion's numbers are tuned beside every relic's.

### balanceSigils.json — sigils

- **`sigils`** — THE SIGILS' NUMBERS (SPEC §14.3, §15.4). A sigil's property rule lives in
  nodeEffects.json and reads its numbers here, through variableBindings.csv,
  so each gets its generated Settings row like every balance number.
- **`sigils.vigilSigil`** — The legendary sigils (SPEC §15.4): attuned, never slotted.
- **`sigils.attuneMax`** — How many legendary sigils a run may hold attuned at once (0: none).
- **`sigils.dropChancePct`** — The chance, 0-100, that a won fight or a treasure room drops one
  legendary sigil the run does not own. Shipped off: 0 draws nothing.

### balanceEquipment.json — equipment

- **`equipment.startingKitDiscovery.undiscoveredPresentation`** — Undiscovered alternates render no row at all: no name, numbers, cards,
  or item silhouette leaks through character creation.
- **`equipment.startingDeck`** — ---- Composed starting deck (togglable) ---------------------------------
  `roleCopies` above is a FIXED distribution that must sum to
  startingDeckSize by hand: grant a class one more card and the sum breaks.
  This block derives the same deck instead. Named cards ("grants") are
  dealt first — the weapon's technique, the class signature, anything
  global — and whatever budget remains is FILLER, split between the attack
  and guard roles. Filler still resolves through equipped profiles, so a
  sword-wielder's filler attacks are Slashing Strikes, not generic ones.
  
  With the defaults below the composed path reproduces 4/4/1/1 exactly
  (grants = technique 1 + signature 1; filler 8 at bias 0.5 → 4/4), which
  is what makes it safe to ship enabled. Set `enabled: false` to fall back
  to roleCopies verbatim.
- **`equipment.startingDeck.global`** — `growToFit` and `minFiller` lived here. Both decided who yields when
  grants got greedy — the deck size, or the content author. Under the cap
  rule (SPEC, "The starting deck") nobody yields: the cap governs how many
  BASE strikes and defends are minted, bound cards are never capped or
  dropped, and a floor of basic cards is simply what the cap leaves over.
  Card ids every class starts with, whatever it wears. Cards named here
  must exist in the card registry; each is granted exactly one copy.
- **`equipment.startingDeck.sourceOrder`** — The order bound cards are DEALT in at creation. Was `dropOrder`, which
  named a behaviour that no longer exists — nothing is ever dropped. Each
  entry is a tag id in the `grantSource` domain, so adding a source is a
  node in nodes.csv rather than an edit to loadout.js.
- **`equipment.startingDeck.sources`** — WHICH TAG EACH MINTING SEAM STAMPS. `sourceOrder` is the vocabulary's
  order; this is the binding between that vocabulary and the four places
  in loadout.js that actually mint a bound card. It exists because the
  ids used to be typed at those seams: renaming `from:weapon` here and in
  `sourceOrder` validated clean and then silently dealt the weapon's
  cards last, because the minting site still stamped the old id. Now the
  seam READS its id from this map, so a rename is a data edit and an
  unbound or misspelt role is refused by name.
  
  The KEYS are the engine's seams, not content vocabulary — there is a
  weapon seam whatever an author calls its source. `from:relic` has no
  key because nothing mints it yet; it is declared vocabulary waiting for
  a minter, and ranking it early costs nothing until one exists.
- **`equipment.startingDeck.oddFillerGoesTo`** — Which role wins the remainder when the cap leaves an odd number of base
  cards. Authored rather than assumed — it used to be a rounding rule
  buried in the arithmetic.
- **`equipment.startingDeck.defaultStrikeBias`** — Per-class filler split. `strikeBias` is the share of base cards that go
  to attacks; the rest are guards. Classes absent here use
  `defaultStrikeBias`.
- **`equipment.cardMounts`** — CARD MOUNTS (owner ruling, 2026-09-03). Every card an item lends sits in
  a MOUNT on that item; a smith can extract it (it becomes the run's own,
  the mount empties) or refill the mount with another card. What is
  extractable is a TAG on the card — strikes and defends do not carry it
  today, and the day the game changes its mind that is a spreadsheet
  edit. What an emptied mount shows is a FALLBACK per mount kind: a
  weapon-art mount falls back to the unarmed technique (the Dodge Roll),
  read from `unarmedProfiles` above rather than typed here, and any item
  may override that under `fallbackByItem`. `extraMounts` is the seam a
  later rune feature opens: mounts beyond the authored ones, per item,
  behind a flag that is off.
- **`equipment.persistence`** — WHAT THE SHELF IS SCOPED TO, and it is this word — there is no second one.
  'perRun'   what you find is yours for this run only
  'unlocked' pieces are permanent once unlocked, chosen before a run
  'both'     unlocked pieces are choosable AND drops apply for the run
  
  Constantine, 2026-08-08: *"maybe the armament menu on the main menu might
  update, but everything else is profile specific but maybe a few basic
  weapons become available for all. so all together for armory shelf with
  settings to configure this."* The DEFAULT half of that is decided —
  profile-wide, which is `both` and is what already shipped (directions.md
  D15). The SETTING half is this line, and it did not need inventing: a
  `shelfScope` word beside `persistence` would be two settings answering one
  question, which is the defect this house is named for (Law 1 clause 2).
  What `persistence` genuinely cannot say is the other half of his sentence
  — the few pieces that are nobody's to FIND because they are everybody's —
  and that is `basicTag` below.
  HIS WORD, 2026-08-21: *"it should only show armory you actually picked
  up mid run"*. That is this line and nothing else — the three values were
  already the closed set and 'perRun' is already documented above as "what
  you find is yours for this run only". Law 0's falsifier, answered by the
  machinery that was already here: an entry describes, the machinery
  derives, and the whole of item 1 is one word in a content table.
  
  WHAT THIS DOES NOT TOUCH, said out loud because it is the half of his
  sentence this word cannot reach: `basicTag` below still exempts the few
  pieces that are everybody's from the found gate, so three `basic`
  armaments remain on the shelf in a run that has picked up nothing. That
  is HIS OWN earlier ask (A7, 2026-08-08) and the two instructions meet
  here. It is flagged on the PR rather than averaged: if he wants a truly
  empty shelf, `basicTag: ''` is the second word and it is his to say.
- **`equipment.basicTag`** — ---- A FEW BASIC WEAPONS, AVAILABLE FOR ALL --------------------------
  The tag that means "this is everybody's". It answers the FOUND gate only
  (drops.requireFound): a basic piece never has to turn up in treasure. It
  has no opinion about the EARNED gate, so the two compose instead of
  racing, and a row that carries both is refused by name at validation
  rather than quietly preferring one.
  
  NOTHING NEW IS AUTHORED (Law 0 clause 1). `tags` is a column weapons.csv
  has always had; three plain rows now carry `basic` and the shelf follows.
  Moving the line between "for all" and "profile specific" is editing that
  column — no code, which is the whole promise. Set it to '' to switch the
  universal shelf off entirely; a value naming a tag no armament carries is
  a hard validation failure, because a setting that silently does nothing
  is the one failure mode worse than a missing one.
  
  KILLED BY HIM, 2026-08-21: *"kill 3 basic weapons on self unless it's a
  starting kit armory weapon shown on character creation. the armory should
  not show weapons not collected in run. it should not show items not
  available at character creation."*
  
  THE UNLESS-CLAUSE NEEDED NO CODE, AND THAT IS A MEASUREMENT, NOT A HOPE.
  The worry was that clearing this tag would also hide the pieces the player
  STARTED with — his exemption is the starting kit, not a category. It does
  not, because the kit is WORN: `carriedIds(loadout)` is storage plus every
  set, and `createRunState` puts the kit in the sets. Measured across all
  three shipped classes at this ref:
  
    reaver    carries straightSword, roundShield, default
    starseer  carries ashStaff, default
    herald    carries boneSceptre, default
  
  So with `persistence: 'perRun'` the shelf is already exactly KIT ∪ WHAT
  THIS RUN PICKED UP, per class, following the player rather than a tag —
  which is his sentence. What the tag was adding on top is the part he
  killed: it handed the starseer a straightSword and a roundShield it was
  never shown, and the herald all three.
  
  '' is the documented off value, not an invention (see the paragraph
  above); a value naming a tag no armament carries is still a hard
  validation failure, so this cannot rot into a silent no-op.
- **`equipment.swapCostKind`** — Swapping a hand mid-fight. 'energy' spends from the turn's pool;
  'allowance' gives a separate per-turn budget that energy never touches.
- **`equipment.swapAllowancePerTurn`** — only consulted when swapCostKind === 'allowance'
- **`equipment.allowChangesInCombat`** — The Armoury remains actionable during the player's combat turn. Replacing,
  moving, or unequipping a carried item uses the same priced combat action
  as switching a prepared weapon set; the engine, never the panel, commits it.
- **`equipment.swapCostRule`** — ---- WHAT A SWAP COSTS: three prices he can try, one chain ------------
  Constantine, 2026-08-08: *"switching sets should cost actions. perhaps
  this action costs more or less depending on Talisman or starting relic,
  or some other reason. let's default to costing 2 actions. alternatively,
  or by a setting, different weapon categories have weapon swap costs.
  THAT WAY I CAN TRY EACH."*
  
  He named three prices and asked to FEEL them, so the three are ROWS and
  the live one is a WORD — never three branches in the engine. One chain,
  always the same, and the row says which of its rungs are live:
  
    base 'category' → the drawn piece's category cost, falling through to
                      `swapCost` when its tags match no row below
    base 'default'  → `swapCost` for everything
    gear true       → talisman and relic deltas adjust that base
  
  THE PRODUCT IS TOTAL, AND THAT IS THE PART I GOT WRONG LAST TIME (#78).
  Two closed fields make FOUR cells; I once shipped three ids for a product
  whose fourth cell nobody had built, and one row of legal data drew an
  empty screen. Here every one of the four computes a real price. The
  fourth — category AND gear — is deliberately not shipped, because he named
  three; it is one row away and needs no code, which is what test 28q
  measures (Law 0's falsifier, applied to a rule instead of a card).
  
  WHY 28q, AND NOT 28p OR 28r — re-derivable in one read, because this line
  cited `28c` from b5c81d0 through 284997a and NO TEST OF THAT NAME HAS EVER
  EXISTED IN THIS REPO (`git log --all -S '28c.' -- tests/` returns nothing).
  A wrong citation that four hands corrected in copies while the original
  stood is not fixed by a better name alone; it is fixed by a name a reader
  can check without trusting me:
    · 28q is the ONLY test in tests/engine.test.js that DECLARES the fourth
      cell — `{ id: 'both', base: 'category', gear: true }` — and then prices
      all four cells of the base × gear product, asserting '2,3,3,4'.
    · 28p asserts the shipped rows are exactly `flat,gear,category`. It
      measures the three and never builds a fourth.
    · 28r holds the two fields APART: its one gear clause refuses a
      non-boolean `gear` by name, and its base sweep runs `gear: false`
      throughout, so the fourth cell never occurs in it either.
  Scored over all 66 tests in that file at 284997a, on the four claims this
  sentence makes, 28q is the only one that carries all four.
  
  The default is 'flat', which is the game exactly as it shipped: nobody who
  does not opt in pays a different price. Settings → Advanced switches it.
- **`equipment.swapCostByCategory`** — A WEAPON'S CATEGORY IS ITS TAGS. `heavy` and `flourish` are already on the
  rows because a greatsword IS heavy — a `swapCost` column on weapons.csv
  would compel an author to restate what the tags already imply, which is a
  breach of Law 0 clause 1 even though every value would sit in a table.
  
  ORDERED, FIRST MATCH WINS. A twinblade is `blade|flourish` and a halberd
  is `blade|heavy`; which tag rules is the order of these rows, not a max()
  nobody can see. A tag no armament carries fails validation by name.
- **`equipment.restampHand`** — true  → swapping rewrites the Strikes/Defends already in your hand
  false → only cards drawn after the swap carry the new numbers
- **`equipment.storageSlots`** — pieces carried but not slotted; hand slots lock in combat
- **`equipment.defaultView`** — 'grid' | 'rack' | 'hybrid'
- **`equipment.narrowDefaultView`** — What a NARROW layout opens on. Data, not a branch in the screen: the view
  list is content, and picking one in JS would put a second copy of the
  closed set below the content layer (Law 1 clause 3). EldenSpire#38 —
  'hybrid' asks for a figure and three cells side by side and a phone has
  room for one of those, which is how two of six weapon slots went missing.
  A player's own saved equipView still wins over this; it is what a phone
  OPENS on, never what it is allowed to show.
- **`equipment.views`** — A VIEW DESCRIBES ITSELF; the screen derives the layout (#78, Law 0 cl.1).
  These were three bare ids and `equipment.js` was `if (view === 'grid') …
  else …`, so a fourth id rendered AS HYBRID and said nothing — the author
  did the data-driven thing correctly and got a silently wrong screen.
  
  Two characteristics are the whole difference, and every rule in ui.css
  that used to key off `.view-<id>` keys off one of them now:
    figure — is the dressed class figure on screen at all
    slots  — 'flank': slot blocks split either side of the figure
             'list':  slot blocks in one column beside it
  
  WHAT IS CLOSED IS THE COMBINATION, NOT EACH FIELD. Read that before
  inventing a row. The first pass said "both are closed sets", which is two
  closed sets and a product of FOUR cells — and only three are drawn. A row
  saying `figure: false, slots: 'flank'` used every legal word and rendered
  an EMPTY armoury in silence (Vira, #78). The three combinations below are
  the whole vocabulary; each one is a layout in LAYOUTS in equipment.js and
  that table is the only place the list lives. Anything else fails loud and
  names this row (Law 1 clause 5) — including a combination of two words
  that are each fine on their own.
- **`equipment.subject`** — WHICH PANE IS THE SUBJECT. One field, and it is the whole of "collapsible"
  (#90). Constantine: *"I still want the armoury card list to be collapsable
  SO THAT I CAN SEE THE ARMORY SLOTS BETTER."* The clause after "so that" is
  the datum — on this screen the slots are what you came for and everything
  else is what helps you decide. `collapsible: true` written on a pane is
  that fact spelled as a mechanism, and it is a special case in a
  characteristic's clothes.
  
  NOT A FLAG PER PANE, and this is the #78 lesson one screen over. A
  two-valued `role` on each pane is a closed set per pane whose PRODUCT has
  cells nobody built: NO subject (every pane collapsible — you can fold the
  whole screen away) and TWO subjects (nothing to order by, nothing that
  must stay open). A POINTER has no product. One field, one value, and
  context is the COMPLEMENT — derived, never authored.
  
  The regions themselves are the vocabulary and live where they are drawn
  (REGIONS in src/ui/screens/equipment.js), exactly as LAYOUTS holds the
  view cells. A name here that is not a region fails BY NAME at boot with
  the list printed; naming none fails the same way.
- **`equipment.spriteReacts`** — 'none' | 'hands' | 'full'
- **`equipment.limits`** — Floors of the mod system, so a piece can't be authored past the point
  where the card stops making sense.
- **`equipment.drops`** — ---- Where armaments come from ------------------------------------------
  You start bare-handed and the run arms you. A found piece is yours for
  the run immediately AND remembered forever, so a climb that ends badly
  still widens the wardrobe — the roguelike bargain: this run's loss is
  next run's option.
- **`equipment.drops.requireFound`** — false makes every authored armament available from the start (a sandbox
  for testing the mod system without playing for it).
- **`equipment.drops.reveal`** — HOW MUCH OF THE UNKNOWN THE PLAYER SEES — the Compendium's whole dial,
  and one word. Constantine: *"the potential weapons to unlock should be
  in its own menu on the main menu that keeps most things hidden."* The
  vocabulary is not new: it is `REVEAL_MODES` from unlocks.csv, applied to
  the OTHER gate. An armament is withheld by not being found rather than
  by an unearned condition, so it has no unlock row to read a reveal from,
  and this is where that answer lives — one home, tunable, no code.
    'teased'  silhouette, rarity, hand. No name, no tags, no numbers.
    'listed'  the above plus its name and why it is not yours.
    'hidden'  the Compendium is empty until you find something.
  'teased' is the shipped line: shape is a promise, a name is the item
  delivered without the climb. A piece that wants a different answer names
  an unlock row, whose own `reveal` wins (Law 0 clause 3 — the override is
  data). The Armoury picker is unaffected by this word: an offer you
  cannot take shows its reason either way.
- **`equipment.drops.chance`** — Chance a node of each kind yields an armament, and the rarity odds when
  it does. Bosses always drop; their table is weighted to the good stuff.
  `normal` (SPEC §15.3) ships at 0, which returns before any draw, so an
  ordinary fight drops nothing until the owner raises it. The roll draws
  from the authored weapons only; armour has no run inventory to drop into.
- **`equipment.drops.preferUnfound`** — A duplicate is a non-event, so drops prefer something you have never
  held. With nothing new left the node gives cinders instead.

### balanceProgressionFeats.json — progressionFeats

- **`progressionFeats`** — Class feat magnitudes and thresholds (SPEC §13.4r). Nodes name these bindings.

### balanceUi.json — ui

- **`ui`** — ---- presentation config (read by the UI layer, never by the engine) ----
  Same rule as the tuning above: code never embeds these numbers. Keeping the
  audio defaults here in particular means the engine fallback and the settings
  slider can't drift apart — they previously lived in two files and silently
  disagreed.
- **`ui.imageHints`** — How every rendered <img> is handed to the browser. Both of these are
  decode-path settings, not network settings, and that distinction is the
  whole reason this block exists rather than sixteen literal attributes
  scattered through the render sites.
  
  The shipped build inlines its art as data: URIs (see ui/assetmap.js), so
  there is no request to defer — the cost that remains is DECODE, and on a
  phone decoding a 350x490 WebP synchronously on the main thread is a
  dropped frame every time a card mounts. `decoding: 'async'` is the fix
  and it is safe everywhere, because the only thing it gives up is the
  guarantee that the image is painted in the same frame as its parent.
  
  `lazy` is NOT safe everywhere, and it is off by default for that reason.
  A `loading="lazy"` image inside a container that is display:none, or
  translated off-screen, or opacity:0 may never load at all — which is
  exactly the shape of every combat effect overlay in this codebase. It is
  opted into per call site, and only for images that sit in a scrollable
  list where being below the fold is the normal case.
- **`ui.hudBars`** — HUD resource bars, per surface (content/resources.js holds the rows).
  
  `scaleByMax` is HIS RULE — "the size of that bar should scale depending on
  the max total ... with the max size filling up the full top row". It is on
  for the main HUD, which is the surface he said it about.
  
  It is OFF under the character models, and that is a call worth stating
  rather than burying: he assigned that surface its CONTENTS ("really just
  health and poise"), not a scaling rule. Turning it on there is defensible
  and informative — the act-3 boss is authored at 250 HP (550 met at tier 3,
  balance.bossTiers) against a 12 HP wisp —
  but the under-model track is 84.6 px at 390x844, so most of the roster
  lands on the 16 px floor and stops encoding anything.
  
  MEASURED, all 19 enemies, `node tools/hudbars.mjs --model-scale`:
  15 of 38 bars (39 %) sit ON the floor, and 13 of the 19 HP bars (68 %) do
  — every enemy at or under 60 HP renders the same length as every other.
  A scale two thirds of whose values are pinned to its minimum is not a
  scale. That is the reason for the false, and it is a number rather than
  a preference.
  
  Flipping either boolean is a one-number data edit and needs no code.
- **`ui.hudBars.main`** — The shared map/combat resource reference track may occupy at most this
  share of the visual viewport. main.js projects it to one CSS variable;
  the stylesheet carries no second numeric copy.
  The shared solo HUD uses this share of the room left after its action
  cells. The old 40vw cap typed a viewport answer before those controls
  had taken their space; 82% keeps a deliberate gutter without making a
  second breakpoint. Co-op still consumes maxViewportPct below.
- **`ui.hudPresentation`** — Shared HUD presentation tokens. These are screen-pixel intentions;
  main.js projects them through --ui-zoom so Map and Combat consume the
  same answer. Component backgrounds are transparent by current design,
  while borders and the contents inside each panel remain visible.
- **`ui.hudPresentation.portraitScale`** — Shared HUD spacing/scale tokens. Portraits shrink to 70% of the
  legacy badge; the primary row, control grid, and vital rows each own
  their own gap so responsive layouts do not hide a second copy.
- **`ui.hudPresentation.cindersMaxWidthPct`** — Header columns negotiate inside one grid: the center Cinders track and
  right metadata trail each cap at 30% of the viewport. Act/Floor show
  their current values by default; totals remain an opt-in.
- **`ui.hudQuickSettings`** — The two always-nearby comfort controls are one shared component on the
  title, map, and combat surfaces. Places and spacing are authored here so
  a future surface or denser theme does not require another renderer.
- **`ui.hudQuickSettings.cardSizePx`** — One visual card on every device. The 40px face sits inside the shared
  tap floor, while its 28px icon occupies 70% of the authored face.
- **`ui.combatantStage`** — BattlefieldStageModel owns the protected vertical corridor between the
  shared run HUD and the hand. Percentages are viewport-height shares on
  the glass; intentGapPx is the visible device-pixel attachment distance.
- **`ui.equipmentCard`** — Contextual explanations point back toward the readable centre instead of
  blindly choosing the first side with room. Combatants add a persistent,
  foldable edge inspector while the shared floating tooltip remains the
  short-lived hover/tap explanation.
  THE EQUIPMENT CARD FACE, SIZED BY WHAT THE INFORMATION IS WORTH.
  
  The face used to be seven hard-coded pixel rows. Whatever did not fit was
  cut wherever the row happened to end, and because flavour and the footer
  sat in rows of their own, the thing that got cut was the MECHANICS: a
  player could read "Grey wood, warm at the grip." in full while
  "Class power: +1 Potency" was sliced through the middle.
  
  Rows are now declared with a PRIORITY and a floor. Every region states
  what it must never shrink below and how willingly it gives space up:
  higher `priority` keeps its room longer, and `grow` says who absorbs the
  slack when there is any. Nothing here is a magic constant in a
  stylesheet — the numbers are data, and the face is composed from them.
  
  The ordering is the claim, and it is deliberate: what the item DOES
  (bonuses) outranks what it IS (type, tags), which outranks what it is
  LIKE (flavour). Flavour is lore and says so in its own tooltip; it is the
  first thing to give up room and the first thing to ellipsis.
- **`ui.equipmentCard.frameWidthPx`** — Face geometry. The frame lays out at this size and is then scaled to
  whatever box it is dropped into, so these are design pixels, not
  device pixels.
- **`ui.equipmentCard.regions`** — Regions, in visual order. `minPx` is the floor; `priority` breaks ties
  when there is not enough room; `grow` shares out anything left over.
- **`ui.equipmentCard.text`** — Text sizing. Every face value is a clamp: it may shrink to `minPx` so a
  long line stays on the card, and never grows past `maxPx` so a short
  one does not shout. `idealCh` is the width the size is derived from, so
  the type scales with the card rather than with the viewport.
  `floorPx` is a PHYSICAL floor, and it is the one that matters on a
  phone. The frame lays out at frameWidthPx and is then transform-scaled
  into whatever box holds it, so a 13px line inside a face scaled to 0.6
  reaches the glass at 7.8px. The floor is divided by that scale — the
  same compensation the rest of the kit applies against `--ui-zoom` — so
  authored type shrinks with the card only until it would stop being
  readable, and then stops shrinking. The priority solver above is what
  affords this: the regions that hold text now have room to take it.
- **`ui.equipmentCard.bonusMaxLines`** — How many lines a single bonus may wrap to before it ellipsises. One
  line was the old behaviour and it truncated real numbers mid-word.
- **`ui.equipmentCard.info`** — The information button. It appears on the FIRST press of a card, not
  the second: a control nobody can find is a control nobody uses. The
  fade keeps it from snapping into place under the thumb. Its reveal
  delay (wireframeUi.selection) and size (wireframeUi.inspect) are the
  shared WCF3/WCB1 ones every card and combatant uses.
- **`ui.shrinePresentation`** — Shrine options default to one vertical list. `grid` preserves the
  horizontal wide-screen composition as an authored alternative; narrow
  screens still collapse it to a list for touch and readable labels.
- **`ui.shrinePresentation.optionLayout`** — list | grid
- **`ui.shrinePresentation.foldedCardWidthViewportPct`** — The six option faces share one folded footprint. Percentages own the
  responsive size; the bounds preserve the interaction floor, keep a
  wide monitor from turning a choice into a banner, and let the complete
  collapsed menu fit before its body becomes a scrollport.
- **`ui.accents`** — Accent themes → --gold plus its rgb form (focus glow / halos).
- **`ui.uiScale`** — UI size → whole-app zoom (--ui-zoom). 'Auto' flexes against the design
  baseline below and is clamped so it never gets unusably tiny/huge.
- **`ui.uiScale.narrowW`** — PROTOTYPE (EldenSpire#23, track B). A SECOND design baseline, for the
  narrow layout in styles/combat.css. #23 reads as a clamp bug — the
  floor of 0.62 winning on every phone — and it is not: lowering the
  floor to 0.325 fits a 1200px layout onto a 390px screen and gives you
  glyphs you can read on a board you still cannot use. The wrong number
  is the BASELINE, which says every screen is 1200x730. Auto picks
  whichever of the two baselines wants the LARGER zoom, so nothing here
  decides "is this a phone" — the fit does, and the floor stops binding
  on its own without being touched.
  
  430x780 is a portrait-phone board: at 390x844 it wants 0.907 (local
  430x930), at 412x915 0.958, at 360x640 0.821 (local 438x780).
  
  narrowMax is the viewport width, in visual px, at or below which the
  narrow layout is used. Height may change the zoom, never this mode.
  
  It used to live in styles/combat.css as a container query. main.js now
  owns the width decision and writes `data-layout` on <html>; the
  stylesheets follow it and measure nothing. Height can change the zoom,
  but cannot make a browser-chrome or keyboard resize flip the mode.
- **`ui.uiScale.shortWideMinH`** — The compact wide composition's rendered lower edge. Text XL is the
  tallest cell: at 844x340 its complete HUD, combatants, cards, hint row
  and action controls are on glass; at 844x339 at least one required
  region crosses its owning row. Derived at one-pixel resolution by
  tools/short-landscape-support.mjs before this value is consulted, so
  moving the number without moving the rendered premise goes red.
- **`ui.uiScale.gateBelowH`** — THE SHORT-WIDE BAND'S UPPER EDGE (src/main.js, #27). At or above this
  viewport height, the established wide composition remains. Below it,
  main.js selects the compact composition down through shortWideMinH;
  only heights below that rendered floor are refused. Thus the complete
  current answer is:
  
    h >= 465                 standard wide composition
    340 <= h < 465           compact wide composition (when width fits)
    h < 340                  truthful upright/resize refusal
  
  IT IS A MEASUREMENT, NOT A TASTE, and it is in data because it is a
  layout fact that will move when the board does.
  
  HISTORICAL PRE-#27 RECORD BELOW. It explains why 465 was originally
  derived as the refusal threshold. #27 keeps that exact measured upper
  edge but inserts a supported composition below it; statements below
  about 368..464 being refused describe the former runtime, not today.
  
  THE MEASUREMENT IS A DERIVATION OVER AN ENUMERATED SET, AND SAYING THAT
  OUT LOUD IS WHY THIS NUMBER SURVIVED HAVING ITS QUESTION CHANGED. It was
  432 on 2026-08-15 under a different predicate; the predicate was ruled
  wrong on 2026-08-16 and the number was RE-RUN rather than re-investigated
  — a threshold with a domain can be re-derived when the question changes,
  a remembered one cannot.
  
  ===================================================================
  WHAT IT ANSWERS TO: THE WALL (Marina, MR-142, 2026-08-16)
  ===================================================================
  
  Two predicates were on the table and they name different sets of screens:
    `whole`   — all five required controls whole. A QUALITY question:
                is this screen good?
    the WALL  — `.end-turn` UNREACHABLE: not one pixel on glass and no
                gesture to it. A SAFETY question: can this player continue?
  They part by 64-109 px at every text size (Vira, 2026-08-15). MARINA
  RULED THE WALL, for three reasons and the third decides it alone:
    1. the gate's cost is TOTAL — it removes the shape and says rotate —
       and a total hammer should fire on a total condition;
    2. a refusal removes the player's choice, a degraded screen leaves it.
       At 67.3% of the hand a player can rotate, page or accept. Behind the
       gate they cannot opt out;
    3. `whole` CAN BE SATISFIED BY THE VERY INTERACTION THAT STRANDS THE
       PLAYER — one flask gesture at 844x390 scrolls `.combat` 162.9 px and
       takes the screen from 2/5 + UNREACHABLE to 5/5 + onscreen, carrying
       the topbar off the top with no gesture back. A refusal predicate the
       trap itself satisfies is the wrong question.
  
  ===================================================================
  THE DERIVATION: max(wall h) + 1, NEVER min(good h) (MR-143)
  ===================================================================
  
  Sunna, 2026-08-16, `?shot=combat`, wide layout, auto UI size, headless
  Chromium at width 800, EXHAUSTIVE 1 px sweep of h 360..600 per text size
  (964 cells), tree at HEAD `sunna/the-ladder-and-the-number`:
    `CHROME=/usr/bin/chromium node tools/uprightgate.mjs --ladder --ladder-from 360`
  
    text size                 S     M     L     XL
    last WALLED h           367   394   423   464      <- the derivation
    max(wall)+1             368   395   424   465
    all five whole from     432   495   533   571      <- the COST column
  
    THE XL WALL IS NOT AN INTERVAL: h 360..450 AND 464 (92 cells), with
    451..463 not walled at all. The auto-zoom steps 0.63 -> 0.64 at 464 and
    the board grows faster than the window, so END TURN goes 13.37% on
    screen at 460, 0% AT 464, 19.76% at 470. Found by Vira, 2026-08-15;
    re-derived here.
  
    THE LOWER BOUND READ `390` UNTIL 2026-08-16 AND 390 WAS NEVER MEASURED
    — it is `--ladder-from`'s DEFAULT (uprightgate.mjs, `argOf(...) ?? 390`).
    A run that takes the default cannot see below its own floor, so the
    floor comes back in the output looking exactly like an edge. It printed
    as one, was copied here as one, and understated this wall by 30 cells.
    Re-measured from 360 (Bjorn, 2026-08-16): XL is walled at every swept
    cell from the floor to 450.
  
    AND 360 IS THE NEW FLOOR, NOT A NEW EDGE. The wall's LOWER edge is
    still unestablished — at 360 all four text sizes are walled, so each
    run's bottom is the sweep's, not the board's. Writing `360` as though
    it were measured is the same mistake one floor down. IT DOES NOT
    MATTER TO THE NUMBER: the derivation is max(wall)+1 and needs only the
    wall's TOP edge, which is inside the sweep at every text size. That is
    why a wrong lower bound sat here harmlessly and why it still had to go
    — a bound that costs nothing today is read as measured tomorrow.
  
  465 IS ONE PAST THE LAST WALL — max(368, 395, 424, 465). NOT the first
  height that stops being a wall, WHICH WOULD BE 451 AND WOULD BE WRONG BY
  FOURTEEN. `min(good)` is a monotonic idea and this ground is not
  monotonic; I measured the non-monotonicity myself (97.13% at h 485, 94.4%
  at 486), used it to justify sweeping exhaustively, and still derived with
  `min(good)`. One past the last bad cell is the only form that survives a
  hole, and the hole is real.
  
  AND I CHECKED THE SAME QUESTION AGAINST THE COST COLUMN, because a
  corrected derivation that leaves its neighbour uncorrected is the same
  defect at a new address: at all four text sizes `min(whole)` and
  `max(not-whole)+1` COINCIDE (432/495/533/571 either way). The whole set
  is contiguous above its first cell; the wall set is not. That is a
  measurement, not an assumption, and it is why only one column moved.
  
  ===================================================================
  THE COST OF ONE NUMBER, AND IT IS MINE (MR-142's division)
  ===================================================================
  
  MAXIMUM, NOT MINIMUM, AND THE DIRECTION FLIPPED WITH THE PREDICATE.
  Under `whole` the binding constraint was "refuse no working screen", so
  the constant was the SMALLEST of the four. Under the wall it is COVERAGE
  — a wall the gate does not stand on is a player who cannot end their turn
  and is not told why — so it is the LARGEST. One number cannot serve both
  ends of the dial, and it now serves the one where the player has no way
  out.
  
  WHAT 465 BUYS: every wall at every text size is covered, including the
  Text XL band 432..450 and the one-pixel wall at 464 that no shipped
  instrument could see. THE XL CARD DOES NOT GET RE-CARDED, IT CLOSES.
  
  WHAT 465 COSTS, COUNTED — `--ladder` prints this table on every run:
    Text S : h 368..464 refused, NOT ONE OF THEM A WALL, and h 432..464
             (33 heights) are FULLY WHOLE — a perfect screen, refused.
             (This read `390..464` and carried THE SAME sweep-floor default
             as the XL wall above — one defect, two addresses, one comment
             block. 368 is max(wall)+1 at Text S and is floor-independent,
             which is why the M and L rows below were right all along.)
    Text M : h 395..464 refused and not walled.
    Text L : h 424..464 refused and not walled.
    h 451..463 refuses NOBODY at any text size — the gap the Text XL wall
    jumps, which a downward-closed threshold cannot jump with it.
  A Text S player on a 800x440 window is refused a board that works. That
  is the price of one number and it is stated here rather than discovered.
  
  THE OPTION I MEASURED AND DID NOT INSTALL, because the shape of the
  threshold is a design ruling and not mine: a per-text-size TABLE on the
  premise — {S 368, M 395, L 424, XL 465} — is better on BOTH edges at
  once. It covers every wall AND refuses no reachable screen at any text
  size except the 451..463 gap at XL. My Law 4 objection to a table
  ("an accessibility setting that takes screens away as you turn it up")
  was true of a table on `whole` and is FALSE of a table on the premise:
  it refuses a large-text player only the heights where that player is
  actually walled. Vira found the step I generalised over; the objection
  was a property of the predicate, not of the shape. What it costs is the
  thing the single number hides: at Text S a landscape phone is handed a
  board with 67.3% of the hand and 86.4% of the orb, both CLIPPED WITH NO
  SCROLL PATH, and nothing refuses it. Whether that board is playable is a
  player-experience finding and it is filed with this act.
  
  Re-derive with `node tools/uprightgate.mjs --ladder --ladder-from 360` —
  it sweeps every cell at 1 px and goes red BOTH ways: a constant at or
  below the last wall (LEAVES A WALL UNGATED — what 432 was) and one above
  it (REFUSES ABOVE ITS OWN PREMISE). `node tools/uprightgate.mjs
  --predicates` is the standing check that every wall has a gate on it, and
  `--text S` is the standing check on what this number costs.
- **`ui.uiScale.formFactor`** — THE HUD FORM FACTOR (docs/hud-layout-tokens.md). applyUiScale writes
  <html data-form-factor> from these, in the window's CSS px, so the
  combat HUD picks content/hud-layout/<form-factor>.json. First match
  wins: widescreen (w / h >= widescreenMinAspect, or w >=
  widescreenMinWidth), mobile (w <= mobileMaxWidth), tablet (w <=
  tabletMaxWidth), else desktop. It chooses styling only — never the
  layout mode, the zoom or the gate above.
- **`ui.textSize`** — Text size → root font-size %. Auto owns the browser stylesheet baseline;
  M remains a legacy data alias for old saves and geometry tools. It scales
  readable type and line metrics; component and sprite geometry is separate.
- **`ui.tapSize`** — MINIMUM TAP SIZE (Settings → Accessibility). THE ONE HOME OF THE 44.
  
  It used to be the literal `44px` inside `--tap-floor` in styles/base.css.
  Constantine: "just make the tabs about 20% smaller or the size
  configurable or scalable with UI or both" — and then, on the 44 floor,
  "actually, I think it should be able to go smaller than 44px." Sunna
  measured why the second half of the first sentence could never answer
  him: `calc(44px / var(--ui-zoom))` under `body { zoom }` renders
  44 x zoom / zoom, so the floored controls are the one part of the
  interface UI size cannot reach — 44.00 device px in all 20 UI-size x
  shape cells, zero variance. So it is configurable, and this is the data.
  
  `sizes` IS THE CLOSED SET, largest first — that order is the order the
  chips draw in and the order the row reads. The settings row derives its
  `choices` and its `def` from here; nothing restates them.
  
  `missRate` is what the RESEARCH says, and ONLY where it says anything.
  Two points exist: WCAG 2.1 AAA (SC 2.5.5) is 44x44 CSS px, WCAG 2.2 AA
  (SC 2.5.8) is 24x24. 36 and 30 sit between them and carry no entry ON
  PURPOSE — an interpolated statistic is a fabricated one, and the cost
  line below 44 says less about them rather than inventing a number
  (Sunna's ruling; Law 0 clause 5 is the same sentence about derivation).
  
  ADDING A FIFTH SIZE IS A ROW HERE AND NOTHING ELSE: it appears as a chip,
  it applies, and it gets a cost line with no percentage unless someone
  adds one. Removing `missRate` for a size removes the percentage and keeps
  the sentence. That is the falsifier for Law 0 on this control.
- **`ui.victoryBeat`** — HOLD TO CONFIRM (Settings → Advanced). THE ONE HOME OF THE DURATIONS.
  
  WHAT IT IS FOR, and the number that made it necessary. The event screen's
  three choice bars are 44/44/44 across sixteen cells — the size is fixed
  and it did not help, because THE GAPS ARE 9-9.7 px at every dial setting
  and nothing in this game reads a gap. Targets grow, the space between
  them does not, so a thumb that lands 9 px low lands on the NEIGHBOUR —
  and on this screen the neighbour is "permanent curse", with no confirm
  and no undo. Constantine, asked: "yes press and hold".
  
  WHY BOTH FORMS SHIP. A short activation opens the shared review modal so
  the player sees the exact result and optional cost. A deliberate hold
  fills on the original control and commits without the modal for players
  who already know the result. Releasing the hold early remains an abort.
  
  `steps` IS THE CLOSED SET, in dial order, and `off` is first because it
  is the A/B — the same "let me try each and decide" he asked for on the
  map. The Advanced row derives its `choices` and its `def` from these keys
  and nothing restates them; ADDING A FIFTH SPEED IS A ROW HERE AND NOTHING
  ELSE. That is the falsifier for Law 0 on this control, and it is the same
  sentence tapSize above already ships.
  
  `normal` is the default: state-changing option controls now use a short
  press to review and a deliberate hold to approve without the modal.
  600 ms sits just past the familiar ~400-500 ms long-press threshold
  ms (Android's own threshold) and a CONFIRM wants to sit just past reflex
  without becoming a chore. `short` is for players who find the wait
  irritating, `long` for hands that need the room. `off` is 0 and disables
  only the shortcut; the short activation still opens the review modal.
  THE VICTORY BEAT (Constantine's review, 2026-09-11): when the last enemy
  falls, the fight's title stands over the battlefield for this long
  before the spoils door opens — a breath between the blow and the loot.
  Reduced motion skips it entirely (ui/components/victoryBeat.js).
- **`ui.holdConfirm.dragSettleMs`** — THE SETTLE WINDOW — A PRESS IS NOT A HOLD UNTIL IT HAS STAYED PUT.
  
  The fill used to arm on `pointerdown` and only cancel once the finger
  passed the slop. On any surface that also drags — the map camera, the
  Armoury tray, an inventory card you can drag — that meant every drag
  began with a hold animation flashing and dying under the thumb. The
  gesture was correct and the feedback was a lie.
  
  Nothing is dressed, painted or announced until the pointer has held
  still inside the slop for `settleMs`. Move first and this press is a
  drag: the hold never existed, so it has nothing to take back.
  
  `settleMs` is time BEFORE the hold, and the hold's own duration starts
  when the settle ends — a `long` hold on a dragging surface is
  1000 + 1000. That ordering is deliberate: the fill should represent the
  whole of the commitment, not resume a bar that already crept while the
  player was deciding whether to scroll. Setting `settleMs: 0` restores
  the old immediate arm exactly, and a surface may override it per call.
  
  WHY IT IS NOT ON EVERY CONTROL. A control with no drag beneath it has
  nothing to disambiguate, and a safety beat that waits a second before
  it even begins to look like it is working reads as a broken button.
  `settleMs` is opt-in per call site; `dragSettleMs` is the value those
  sites use so the delay is authored once rather than eleven times.
- **`ui.holdConfirm.settleSlopPx`** — How far the finger may drift during the settle and still be judged
  still. Kept apart from the hold's own slop so "did they mean to drag"
  and "did they wander off mid-hold" can be tuned independently.
- **`ui.titleLoadHold`** — TITLE SAVE SLOT QUICK LOAD. This is a pointer/touch convenience gesture,
  not the irreversible-action safety dial above: a short activation still
  selects/reviews the save, while a stationary hold loads it directly.
  Keeping the duration here lets the interaction be tuned without changing
  the title screen's event wiring.
- **`ui.holdBeat`** — THE HOLD'S BEAT — WHERE IN THE FILL A SOUND LANDS. One home for the
  fractions; the sounds themselves are recipes in content/sfx.js and the
  durations are holdConfirm above. Three facts, three homes, none restated.
  
  WHY THE HOLD NEEDS ONE AT ALL, and it is a measurement rather than a
  taste. The fill is the only feedback the hold has, and on the event
  screen it works: the bar is 378x44 at 390x844 and a thumb covers a
  fraction of it. END TURN IS 190.2x50.4 AT y=784.6 OF AN 844 px VIEWPORT
  — a control roughly the size of the contact patch, in the bottom 60 px,
  approached from below. The hand that presses it is on top of the only
  thing telling the player the press was received. A hold with no beat is
  then indistinguishable from a tap that did not register, and the player
  presses again — so the guard fires the thing twice.
  
  `at` IS THE CLOSED SET, as fractions of the fill, ascending, and 1.0 is
  NOT in it: the arrival is `holdCommit`, a different sound with a
  different job, and putting it here would give the landing two homes.
  
  THE SPACING IS THE MESSAGE, not decoration. The gaps shorten (0.42,
  0.36, 0.22) so the train ACCELERATES toward the commit: a player hears
  "approaching" without counting anything, and an abort at 0.5 has heard a
  train that was speeding up and then stopped, which is the true sentence
  about what happened. An evenly spaced train is a metronome, and a
  metronome says only "time is passing".
  
  ACCELERATION AND NOT PITCH, which is a composition decision with a
  maintenance reason. A rising train would need one recipe per tick
  (`holdTick_1..3`), and the day someone adds a fourth fraction here the
  fourth tick has no row and the rise breaks — the row edit this comment
  promises would stop being enough. Identical ticks getting closer
  together is the same signal, and a fourth fraction just works.
  
  WHY THREE. One tick cannot rise. Two can, barely. Four plus a commit is
  five sounds on every confirmation and this fires many times a run — the
  cost of a charming sound is paid at hold #200, not hold #1. Three is the
  fewest that reads as a gesture. TUNING IS THIS ROW: an empty array is
  legal and means the ticks are off with the commit intact.
  
  The first tick is at 0.00 on purpose — it is the "pressed" report, and a
  report that arrives at 180 ms has already let the player wonder.
- **`ui.inspectHold`** — HOLD TO INSPECT (the hand). THE ONE HOME OF THE DURATION.
  
  Constantine, 2026-08-08: press-and-hold a card and it "expands" and comes
  "in front". This is the gesture half of that ask; the layout half (how
  the hand itself is arranged) is HELD on C2 and no number for it lives
  here or anywhere.
  
  WHY THIS IS NOT holdConfirm's DIAL, though both are a stationary press
  with a timer. Two different jobs (Law 4's shape, applied to time): the
  confirm hold is a SHORTCUT around the review modal — its length is a
  protection preference, and `off` means "review only". The inspect
  hold is how a player READS a card — turning the safety dial off must not
  take reading away, and a hand that needs a longer confirm does not
  thereby need slower reading. One dial answering both would break the
  weaker job the day anyone tunes the stronger one.
  
  400 ms: the bottom of the long-press convention players already know
  (Android's own threshold is ~400-500), BELOW the confirm's 600 default
  because reading is cheaper than committing and fires far more often —
  and above any tap: the slow edge of a deliberate tap is ~250 ms, and a
  stationary press that outlives 400 was not going to become one. The
  known cost, stated rather than hidden: a tap slower than this becomes an
  inspect, whose release then does nothing — the card visibly expanding IS
  the feedback that says why. `ms: 0` is the off position: no inspect,
  pre-gesture behaviour byte for byte.
- **`ui.rewardCollect`** — REWARD COLLECTION (E11, #256). THE ONE HOME OF THE WORD.
  
  Constantine, 2026-08-15 (the E11 card): Continue on the reward menu is
  ALWAYS pressable and a setting decides what it means — "auto-collect ON
  takes everything, picking at random where there is a choice; OFF gives
  only what was chosen, no nagging".
  
  Manual collection is the default; stored preferences can still select auto.
- **`ui.handLayout`** — HAND LAYOUT (C2). THE ONE HOME OF THE WORD.
  
  Constantine, 2026-08-13: "overlap and paging (maybe a toggleable
  feature)" — BOTH modes, one knob. His "maybe" hedges the TOGGLE, not the
  modes (directions.md D19), so both modes exist now behind this word and
  the player-facing control waits for his eye on a picture. No Settings row
  derives from this yet, on purpose — adding one later is a data edit in
  settings.js, not a redesign.
  
  'paging' names the SHIPPED narrow hand: the horizontal card strip
  (styles/combat.css, the narrow reflow) — F1 of the approved hybrid.
  Selecting it changes nothing, byte for byte; it is the default because
  the shipped behaviour keeps its seat until his picture says otherwise.
  
  'overlap' lays the whole hand inside the strip's width: each card
  overlapped by the next, the overlap DERIVED per render from hand size
  and measured width (renderHand, combat.js) — no number for it lives
  here or anywhere, which is why this row is a word and not a px value.
  
  The renderer derives from this word alone (via data-hand-layout on
  <html>, written by applyDisplaySettings beside cardMotif's attribute).
  A stored settings.handLayout outside `handLayoutModes` lands on this
  default and says so in the debug log; a garbage value HERE fails loud
  in model/validate.js — the two halves of "validated loud, garbage lands
  on default".
- **`ui.spriteTiers`** — Sprite display tiers an enemy def's `size` selects. px-magnitude; the
  renderer emits them as rem (÷10).
- **`ui.backdropActs`** — How many act backdrop plates exist (assets/bg/bg_act*.webp). Endless acts
  past this cycle back through them.
- **`ui.parchmentActs`** — How many map-parchment plates exist (assets/map/parchment_act*.webp) — the
  undiscovered ground the fog map draws on. Same rule as backdropActs, its
  own row because the two sets are authored separately and one may grow
  first. A row, so a fourth plate is a file plus this number and no code.
- **`ui.cardTypes`** — Card colour motif (Settings → Display). Cards carry two independent
  colour axes: the owning class (each class def's cardTint) and the
  player's accent. `cardMotif` picks how the class one is expressed;
  `cardMotifStrength` is the wash depth for each choice.
  Card TYPE presentation. Geometry carries the type (attack squarest,
  power roundest, skill between) and each type owns its banner colour.
  label is display-only — the engine keys on the id (CARD_TYPES is frozen
  and the Bulwark stance matches 'skill'), so renaming here is safe.
- **`ui.audio`** — Default audio levels for a profile that has never touched the sliders.
  Music ships at 50, deliberately under SFX's 75: the score is ambience,
  the SFX are information, and the hit-confirm must read over any swell.
  The beds carry their own gain staging on top of this bus (music.js,
  gains 0.34–0.6), so 50 is clearly audible from first boot without
  crowding the feedback layer.
- **`tooltipPlacement.hoverDelayMs`** — not in the JSON: `balance.js` derives it from the default of the `tooltipDelay` row of `tooltipHelp.settings`, so the setting and this number cannot disagree.

### balanceProgression.json — progression

_No comments were written beside these numbers in the old balance.js._

- **`gearRequirements`** — not in the JSON: `balance.js` puts the shared `progression/gear.js` table second, after `version`, and writes the `gearRequirements.<i>.level` sentences (computed from each row) right after the `version` note.
