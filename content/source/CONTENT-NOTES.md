# Content authoring notes (relics, stances, flasks, statuses)

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
