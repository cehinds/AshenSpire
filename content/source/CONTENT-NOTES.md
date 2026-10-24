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
