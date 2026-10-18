# Content authoring notes (relics, stances, flasks)

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
