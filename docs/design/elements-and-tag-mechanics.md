# Elements and tag mechanics: Poison, Psychic, Earth, enemy resists, oath / precision / gorefire

Branch `feature/RebalanceCardsAddCards` (base `5a2359f13`), design only. Nothing here is built. SPEC.md is not edited
by this document: another task is editing §4.4 and §4.7, so the exact paste text is in the **SPEC paste blocks** at the
end of each section.

Owner decisions this answers (2026-10-12): **#2** poison as a real damage type, **#3** TagRefactor names win,
**#5** Psychic and Earth, **#6** a few enemies resist elements, **#11** oath / precision / gorefire.

Every file, id and op cited below was grepped in this tree. "Rubric" is the balance rubric from this session
(1 point = 1 damage; Common 6 per energy plus up to 2 of rider, Uncommon about 8 to 9, Rare about 10 to 12;
Block is 0.85; Venom N costs N(N+1)/2; Exhaust +25%). Card numbers are rank-1 authored faces. SPEC §3.5 re-derives
a card's primary number from its cost, so after authoring, dump the loaded face and compare against the rubric
before trusting the number printed here.

## 0. Ground rules and names

**Names (decision #3).** TagRefactor's names win. This document writes new rows under the **final** ids and shows
the shipped id once:

| Final id / label | Shipped today | Source |
|---|---|---|
| `poisoned` | `venom` (status, `statuses.js:802`; v2 gauge `combatStatusRules.js:11`) | TagRefactor `status-effect.debuff.damage-over-time.poisoned` ("Venom") |
| `burned` | `burn` | TagRefactor `...damage-over-time.burned` |
| `blighted` | `crimsonBlight` | TagRefactor `...damage-over-time.blighted` |
| Frost (label), rider key `frost` | label "Cold", rider key `cold` plus alias `frost: 'cold'` (`combatMatchups.js` `damageRiders` and `damageAliases`) | TagRefactor `damage.magic.frost` |
| `confused`, `slowed`, `silenced`, `entombed` | new | TagRefactor `...mind.confused`, `...weakened.slowed`, `...weakened.silenced`, `...immobile.entombed` (all status "new") |

The rename itself (ids, save migration) is a separate unit (decision #3) and is **not** in this plan; every work unit
below says "use the shipped id if the rename has not landed; rename the row afterwards". The damage ids `frost`,
`fire`, `lightning`, `arcane`, `sacred`, `decay` do not change (they are already the stable ids; only labels and
the rider keys move).

**One engine fact that shapes everything.** Riders resolve in `matchupRiderEffects`
(`src/engine/combatMatchups.js:184-217`). It reads `cfg.damageRiders[damageType]` from `combatMatchups` (v1 table,
`src/content/combatMatchups.js:44`) or `combatExpansionMatchups` (v2 table, `:103`). A new damage type therefore needs
only a registry row plus a rider row, with no new engine code. Under combat expansion v2 a status rider turns into a
`buildup` op, and `applyStatusPressure` (`src/engine/combatStatusControl.js:108`) **throws** `Unknown status buildup`
unless `combatStatusRules.statuses` has a row for that status. So every status a rider applies needs a gauge row.

## 1. Poison as a real damage type (decision #2)

### 1.1 What is already there

The rider is orphaned, not missing. `poison: { status: 'venom', stacks: 1, requiresHpLoss: true }` is in the v1 table
(`combatMatchups.js:54`) and `poison: { status: 'venom', pressure: 4, recoveryProfile: 'bodily', requiresHpLoss: true }`
in the v2 table (`:112`). The `venom` status exists with a turn-start `loseHp` hook (`statuses.js:802`) and a v2 gauge
(`combatStatusRules.js:11`: camp physical, bodily recovery, thresholds 6/4, cap 3). What is missing is the three places
that make `poison` a damage type: `combatRules.damageTypes` (`src/content/combatRules.js:5-15`, the closed list that
`resolveDamageComponents` checks and throws `unknown damage type` on), a `damage:poison` row in
`content/source/nodes.csv` (rows `damage:slashing` to `damage:decay`, lines 114-122), and the SPEC §4.7 text. The
generated tag tables come from `tools/content-build.mjs`.

### 1.2 Rules

- **Tag and registry.** `damage:poison`, label Poison, stable id `poison`.
  `combatRules.damageTypes.poison = { tag: 'damage:poison', physical: false }`. `physical: false` means the armour
  class percentage reduction does not apply (poison is chemical), exactly as for Fire and Frost. Flat armour
  (`flat.poison`), enemy weakness and enemy resist (section 3) still apply.
- **Camp is not forced.** A poison dart is `camp:physical`, a spell cloud is `camp:spell`; the `venom` gauge row is
  physical/bodily, so a physical poison hit pays into Poise strain and a spell one into persistent Ward
  (`applyStatusPressure` picks by the application's camp).
- **Rider (reuse the orphan).** Once per action and target, after positive HP loss: v1 applies 1 Poisoned stack;
  v2 adds 4 build-up to the `poisoned` gauge (initial threshold 6, so a bare hit is two thirds of a stack). Block that
  absorbs the whole hit stops the rider, like every `requiresHpLoss` rider. A card that prints a Poisoned effect
  suppresses the automatic one (existing rule, SPEC §4.7).
- **It stacks with Envenom.** `envenom` (`statuses.js:828`) applies Venom on every attack hit; a poison-typed hit
  gets rider plus Envenom. That is the synergy, and it is why a bare rider is priced at about 1 point.
- **v2 caveat the cards respect.** One Poisoned stack ticks N=1 then decays, so a lone v2 gauge fill is worth about
  1 point. Poison identity therefore comes from cards that **print** `applyStatus` Poisoned stacks (as Venomcoat and
  Toxic Volley do), not from the rider.
- **Creature types** (data in `combatExpansionEquipment.enemies`, existing keys only):
  - `construct` (6 enemies): `traits.immuneStatuses: ['poisoned']`. `applyStatusPressure` already returns early for
    ids in `immuneStatuses` (`combatStatusControl.js:117`). Poison **damage** to a construct is not blocked, only
    its status (a poison dart still stabs).
  - `undead` (8 enemies): `traits.buildupResistance: { poisoned: 50 }` (existing numeric trait, `:118`).
  - `spirit`, `beast`, `humanoid`: normal.
  - A hybrid takes the strongest line (huskBrute is `undead`+`humanoid`, so it is resistant, not normal).
  - Explicit per-enemy rows, not a derived rule, so retagging stays a data edit. Ids: constructs `courtMarionette`,
    `livingArmor`, `bellKeeper`, `glassRegent`, `charredColossus`, `furnaceSaint`; undead `huskBrute`, `fellWarden`,
    `stitchedHound`, `stitchedKing`, `stitchCrab`, `marrowOrganist`, `ashRevenant`, `hollowAstronomer` (verified
    against `content/source/tagging.csv`, family `enemy`).
- **Holy cleanse.** Add `poisoned` (shipped `venom`) to `cleanseStatuses` in both tables
  (`combatMatchups.js:70`, `:114`) so a Holy hit can cleanse it from a poisoned attacker. No enemy move applies Venom
  to the player today (grep of `src/content/enemies`: none), so this is forward-looking and costs nothing.
- **Weakness.** Flesh and chitin: `blightHound` and `cinderMantis` get `weak.poison: 25` (they keep their existing
  two; three weaknesses per enemy is the proposed cap).
- **Armour.** `flat.poison: 1` on `rogue:shadow` and `gutterLeathers` (both already carry `buildupResistance.venom`).

### 1.3 Which existing cards become `damage:poison`

Grep of every card for `venom|poison|toxin|envenom` (`node` dump of `contentBundle.cards`, 292 cards) finds three
venom cards and one flavour-text match, and **no existing attack is clearly poison**:

| id | class / rarity / cost | type | recommendation |
|---|---|---|---|
| `venomcoat` | rogue U/1 | skill (Venom 4, Prepared) | add `damage:poison` (identity only; no damage op, so no rider fires) |
| `toxicVolley` | rogue R/2 | skill (Venom 5 + Weak to all enemies) | add `damage:poison` (identity only) |
| `envenomCard` | rogue R/2 | power | do not tag (a power installs a status) |
| `riteOfCinders` (starseer) | | text matched "poison" only in flavour | do not tag |

`serratedShiv`, `barbedArrow`, `garrote` are Bleed cards and stay Bleed. So retagging is two no-behaviour-change tag
rows; the real poison content is the four new cards below.

### 1.4 New poison cards (existing ops only)

All Rogue, physical. `TARGET_VENOM_3` is the existing predicate shape used at `rogue.js:12`
(`{ p: 'hasStatus', of: 'target', status: 'venom', atLeast: 3 }`, `atLeast` is read at `triggers.js:382`).

| id | name | class | rarity | cost | effects | rubric costing |
|---|---|---|---|---|---|---|
| `aspDart` | Asp Dart | rogue | common | 1 | `damage 6` (target enemy). Tags `damage:poison`, `maneuver:ranged`, `venom`. No printed status: the rider adds Poisoned. Upgrade `damage 9` | Common 1-energy = 6; rider about 1 (v1) or 0.7 (v2). Total about 7. In budget. Shows the bare rider |
| `viperStrike` | Viper Strike | rogue | common | 1 | `damage 5`, `applyStatus venom 2`. Tags `damage:poison`, `venom`. Upgrade `damage 8` | 5 + Venom 2 (3 pts) = 8 = 6 + 2 rider allowance. In budget |
| `septicBlade` | Septic Blade | rogue | uncommon | 2 | `damage 8`, `applyStatus venom 3`, `damage 4 if TARGET_VENOM_3` (evaluated before the Venom is applied, so it needs prior setup). Tags `damage:poison`, `venom`. Upgrade `damage 12` | 8 + Venom 3 (6) = 14 unconditional, 18 with the condition. Uncommon 2-energy = 12 + 2 to 4 = 14 to 16 base, conditional spike to 18. In budget |
| `lethalDose` | Lethal Dose | rogue | rare | 1 | Exhaust. `damage = mul(3, stacks venom of target)` (formula as `blightNova`, `herald.js`), then `removeStatus venom` (no `amount` removes all). Tags `damage:poison`, `venom`. Upgrade `mul(4, ...)` | 4 Venom = 12 damage (+25% Exhaust credit already in the R/1 median of 10); it cashes out 10 pts of future Venom, so net power is tempo, not bonus. One Venom stack re-appears from the rider (the rider is enqueued after the card's own effects); acceptable and thematic |

Resource: physical cards use the Stamina side per `docs/card-resource-balance.md` (Common 30%, Uncommon 50%, Rare 70%
bearing). Ids were grepped against the 292-card dump: none exist.

### 1.5 SPEC paste (poison)

**§4.7, "Identity and authoring", replace the stable-id sentence:**

> Stable damage IDs are `blunt`, `piercing`, `slashing`, `frost`, `fire`, `lightning`, `arcane`, `sacred`, `decay`,
> `poison`, `psychic` and `earth`. Player-facing labels for the renamed categories are Frost (`frost`; was Cold),
> Force (`arcane`), Holy (`sacred`) and Necrotic (`decay`). Accepted input aliases do not create duplicate tag
> identities or damage components.

**§4.7 "Damage riders" table, add rows:**

> | Poison | Apply 1 Poisoned after HP loss (v2: 4 Poisoned build-up). Poison damage is not reduced by armour class. Constructs are immune to Poisoned; undead halve its build-up |

**§4.4 status table, add a row:**

> | **Poisoned** *(`poisoned`; shipped `venom`)* | Damage over time: at its turn start the owner loses HP equal to its stacks (ignores Block); one stack expires each turn. Applied by poison-typed hits and by `applyStatus`. |

## 2. Psychic and Earth (decision #5)

Both are **spell-camp** damage types (`physical: false`). Psychic is the damage type of the existing `illusion` school
(TagRefactor nests `illusion` under `spellcraft.psychic`, `tags.csv`). Earth is a **new school** `earth` (TagRefactor
`spellcraft.earth`, `damage.magic.earth`, both "game-concept" with empty effect columns, which this section fills in).
That makes nine schools in SPEC §4.7 (was eight); `combatExpansionMatchups.counter.schoolMatchups` (`combatMatchups.js:83-93`)
gets an `earth` entry and a `psychic` alias to `illusion` (see 2.5).

### 2.1 Psychic

- **Tag:** `damage:psychic` (label Psychic). `combatRules.damageTypes.psychic = { tag: 'damage:psychic', physical: false }`.
- **Rider:** after HP loss, apply 1 Confused (TagRefactor: "On hit: apply [confused]").
  - v1 row: `psychic: { status: 'confused', stacks: 1, requiresHpLoss: true }`
  - v2 row: `psychic: { status: 'confused', pressure: 3, recoveryProfile: 'mental', requiresHpLoss: true }`
- **Retag existing illusion cards.** `combatExpansionCards.js:14` maps `illusion: 'arcane'`. Change it to `'psychic'`.
  Affected: `drowsingMote`, `illusionCounter`, `illusionDecoy`, `restfulDream` (the four `school:illusion,damage:arcane`
  cards in the dump). Effect: Force's Ward-strip rider leaves them and Confused arrives. `drowsingMote` is the only
  one that deals damage (2).
- **Statuses** (statuses.js shape; icon and tint are placeholders for art):

```js
{
  id: 'confused', name: 'Confused', icon: '❖', tint: '#a06bd0',
  stackMode: 'add', decay: 'perTurnEnd',
  modifiers: { damageDealtMult: 0.9 },
  hooks: [{
    on: 'ownerTurnStart',
    if: { p: 'random', pct: 50 },
    do: [{ op: 'poiseDamage', target: 'owner',
           amount: { f: 'mul', args: [3, { f: 'stacks', status: 'confused', of: 'owner' }] } }],
  }],
  tooltip: 'Deals 10% less damage. At the start of its turn, 50% chance to take 3 Poise damage per stack. 1 stack expires each turn.',
},
{
  id: 'silenced', name: 'Silenced', icon: '◌', tint: '#8b7cd6',
  stackMode: 'refresh', decay: { duration: 2 },
  modifiers: { spellDamageDealtMult: 0.5 },          // NEW MODIFIER KEY (see 2.4)
  tooltip: 'Spell-camp moves deal 50% less damage for 2 turns.',
},
```

  - Confused price: -10% of a typical 10-damage enemy turn (about 1) plus 1.5 expected Poise (about 0.8) = about 1.8
    per stack, which is why the rider is free and a printed Confused 2 is priced at 3.6.
  - Silenced price: spell-camp share of enemy damage is about 40% in the roster (casters: `graveWisp`, `briarHermit`,
    `lanternMoth`, ...); 50% off for 2 turns is about 4 pts against a caster and 0 against a bruiser, so about 2 expected.
  - v2 gauge row (needed or the rider throws):
    `confused: { camp: 'spell', profile: 'mental', activeStatus: 'confused', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true }`
    in `combatStatusRules.statuses`.
- **Enemy side.** Weak (+25%) to Psychic: `emberStarvedPilgrim`, `briarHermit`, `hollowAstronomer`, `eclipseCantor`
  (frayed or obsessed minds). **Mindless enemies** (the existing `traits.mindless` flag, nine rows: `huskBrute`,
  `bellKeeper`, `stitchedHound`, `courtMarionette`, `livingArmor`, `stitchCrab`, `glassRegent`, `charredColossus`,
  `furnaceSaint`) get `traits.immuneStatuses: ['confused', 'silenced']`. That matches the existing
  `schoolMatchups.illusion.weakTraits: ['reveal', 'mindless']` (`combatMatchups.js:89`). Psychic *damage* still lands on
  them, except `courtMarionette` (section 3).
- **Armour column** (`flat`, a point per hit, plus `buildupResistance` keys that exist in the gauge table):
  `starseer:eclipse` `flat.psychic: 1` and `buildupResistance.confused: 10`; `nightweave` (shared) `flat.psychic: 1`;
  `riteVestments` (shared) `flat.psychic: 1`.

**Starter cards** (names are new; TagRefactor names no Psychic card):

| id | name | class | rarity | cost | effects | rubric costing |
|---|---|---|---|---|---|---|
| `mindSpike` | Mind Spike | colorless | common | 1 | spell cantrip (`cantrip()` shape, `combatExpansionCards.js:137`): `damage 5`, tags `camp:spell school:illusion damage:psychic maneuver:casting`. Rider adds Confused 1. Upgrade `damage 8` | 5 + 1.8 = 6.8, Common cap 8 |
| `dissonance` | Dissonance | starseer | uncommon | 1 | `applyStatus confused 2`, `applyStatus silenced 1`, `draw 1`. Upgrade `confused 3` | 3.6 + 2 + draw 2 = 7.6; Uncommon 1-energy 8 to 9 |
| `mindFracture` | Mind Fracture | starseer | uncommon | 2 | `damage 8`, `poiseDamage 6`, `applyStatus confused 2`. Tags `damage:psychic school:illusion`. Upgrade `damage 12` | 8 + Poise 6 (3) + 3.6 = 14.6; Uncommon 2-energy 14 to 16 |
| `wakingNightmare` | Waking Nightmare | starseer | rare | 2 | `damage 13`, `applyStatus confused 3`, `buildup sleep 4` (op shape as `cantrip()`: `camp 'spell'`, `recoveryProfile 'mental'`, `chance 50`). Upgrade `damage 17` | 13 + 5.4 + about 3 (sleep at 50%) = 21.4; Rare 2-energy 22 to 24 |

### 2.2 Earth

- **Tag:** `damage:earth` (label Earth), new school `school:earth`. `combatRules.damageTypes.earth = { tag: 'damage:earth', physical: false }`.
  Spell camp on purpose: Earth ignores armour class (cuts through plate) but is stopped by Ward, which is the
  opposite of Blunt and gives it its own matchups.
- **Rider:** after HP loss, apply 1 Slowed.
  - v1: `earth: { status: 'slowed', stacks: 1, requiresHpLoss: true }`
  - v2: `earth: { status: 'slowed', pressure: 4, recoveryProfile: 'elemental', requiresHpLoss: true }`
  - v2 gauge: `slowed: { camp: 'spell', profile: 'elemental', activeStatus: 'slowed', initialThreshold: 6, activeThreshold: 4, cap: 3, chanceRecovery: true }`
- **Statuses:**

```js
{
  id: 'slowed', name: 'Slowed', icon: '⌛', tint: '#8a7b5c',
  stackMode: 'add', decay: 'perTurnEnd',
  modifiers: { damageDealtMult: 0.9, blockGainedMult: 0.75 },
  tooltip: 'Deals 10% less damage and gains 25% less Block. 1 stack expires each turn.',
},
{
  id: 'entombed', name: 'Entombed', icon: '▣', tint: '#9a8a6a',
  stackMode: 'refresh', decay: 'perTurnEnd',
  modifiers: { skipTurn: true, damageTakenMult: 0.75 },   // skipTurn: combat.js:637, :764
  tooltip: 'Skips its next turn. Takes 25% less damage while entombed.',
},
{
  id: 'stoneskin', name: 'Stoneskin', icon: '◆', tint: '#8a7b5c',
  stackMode: 'unique', decay: 'perTurnEnd',
  modifiers: { retainBlock: true },
  tooltip: 'Your Block is not removed at the start of your next turn.',
},
```

  - Slowed price: -10% damage (about 1) plus -25% enemy Block (about 0.5) = about 1.5 per application, so the bare
    rider is free.
  - Entombed price: a skipped enemy turn is about 10 pts (median 10-damage turn), minus the 25% shell for the rest of
    the player turn (about 2), so about 8. It reuses the exact skip mechanism of Staggered (`skipTurn` modifier,
    intent shown as "staggered"), so verify the decay timing (acceptance test below).
  - Not built, noted for later: a Slowed that adds one turn to a charging `delay` move would be the true Earth
    identity, but the enemy `delay.turns` field has no status hook. That would be a new engine hook (listed in 2.4).
- **Enemy side.** Weak (+25%) to Earth: `lanternMoth`, `valkyrieShade`, `graveWisp` (airborne things, "earth grounds
  them"; same idea as the shipped `grounded` trait). Each keeps its existing two weaknesses and gains `earth` as the third.
- **Armour column:** `flat.earth: 1` on `reaver:bastion`, `reaver:warden`, `wayfarerPlate`; `buildupResistance.slowed: 15`
  on `reaver:bastion` and `reaver:warden`.

**Starter cards:**

| id | name | class | rarity | cost | effects | rubric costing |
|---|---|---|---|---|---|---|
| `stoneSling` | Stone Sling | colorless | common | 1 | cantrip shape, `damage 6`, tags `camp:spell school:earth damage:earth`. Rider Slowed 1. Upgrade `damage 9` | 6 + 1.5 = 7.5, Common cap 8 |
| `rockfall` | Rockfall | colorless | common | 2 | `damage 8` to `allEnemies` (op `damage`, `target: 'allEnemies'`). Rider Slowed 1 on each. Upgrade `damage 11` | Crimson Cleave anchor (C/2 = 8 AoE + 2 Bleed). 8 + 1.5 each, in budget |
| `stoneskin` | Stoneskin | reaver | uncommon | 1 | `block 6`, `applyStatus stoneskin 1` (self). Tag `school:earth`. Upgrade `block 9` | Block 6 (5.1) + retain about 3 = 8; Uncommon 1-energy 8 to 9 |
| `entomb` | Entomb | herald | rare | 2 | `damage 14`, `applyStatus entombed 1` (enemy). Tags `damage:earth school:earth`. Upgrade `damage 18` | 14 + about 8 = 22; Rare 2-energy 22 to 24 |

### 2.3 Class ownership (defaults, see open question 1)

Psychic: Starseer owns the school (`dissonance`, `mindFracture`, `wakingNightmare`; its `school:illusion` cards are
already Starseer's) plus the colorless `mindSpike`. Earth: Reaver (`stoneskin`, guard identity) and Herald (`entomb`)
plus colorless `stoneSling` and `rockfall`. Poison stays Rogue. This keeps every class at most two elements and leaves
Poison, Psychic and Earth reachable by any class through the colorless commons.

### 2.4 Engine hooks that do NOT exist yet

| Needed by | What | Where |
|---|---|---|
| `silenced` | a camp-scoped modifier key `spellDamageDealtMult` | add to `MODIFIER_TYPES` (`src/model/schemas.js:383`, the schema and lookups derive from it) and read where the damage packet's camp is known (`applyExpandedDamage`, `actions.js:~262-300`, the `profile.camp` loop) |
| enemy resist (section 3) | an enemy `resist` map in `combatExpansionEquipment.enemies` | validator allowlist `['armorClass','flat','weak','traits']` at `src/model/combatExpansionRules.js:63`, `projection()` at `src/engine/combatExpansionEquipment.js:5`, and the damage line `actions.js:286` |
| Slowed lengthening a `delay` move (optional, not in this plan) | status hook on enemy `delay.turns` | none today |

Everything else in this section uses hook kinds that exist: `modifiers` (`damageDealtMult`, `damageTakenMult`,
`blockGainedMult`, `skipTurn`, `retainBlock`), `ownerTurnStart` hooks, the `random` predicate, the `poiseDamage` op,
the `buildup` op, `immuneStatuses` and `buildupResistance` traits.

### 2.5 SPEC paste (Psychic, Earth)

**§4.7 spell schools sentence:** replace "Spell schools are `frost`, `fire`, `lightning`, `force`, `alteration`,
`illusion`, `divine`, `decay`" with:

> Spell schools are `frost`, `fire`, `lightning`, `force`, `alteration`, `illusion`, `divine`, `decay` and `earth`.
> `illusion` is the school of Psychic damage.

**§4.7 "Damage riders" table, add rows:**

> | Psychic | Apply 1 Confused after HP loss. Psychic damage is not reduced by armour class. Mindless enemies are immune to Confused and Silenced |
> | Earth | Apply 1 Slowed after HP loss. Earth damage is not reduced by armour class and is absorbed by Ward |

**§4.4 status table, add rows:**

> | **Confused** | On enemy: deals 10% less damage; at its turn start, 50% chance to take 3 Poise damage per stack. 1 stack expires each turn |
> | **Slowed** | On enemy: deals 10% less damage and gains 25% less Block. 1 stack expires each turn |
> | **Silenced** | On enemy: spell-camp moves deal 50% less damage for 2 turns |
> | **Entombed** | On enemy: skips its next turn and takes 25% less damage until it ends |

## 3. Enemy elemental resistances (decision #6)

**Rule.** A new per-enemy `resist` map in `combatExpansionEquipment.enemies`, in percent, symmetric to `weak`:

`amount = max(0, ceil(total * (1 + weak/100) * (1 - resist/100)) - flat)`

(today the line is `ceil(total * (1 + weak/100)) - flat`, `actions.js:286`). Tiers are **25** (minor) and **50** (major).
`resist` is capped at 75 (`combatRules.resistanceCap`, `combatRules.js:17`), the same cap armour resistances use in the
foundation path (`groupedResistance`). Weak and resist on the same type in one row is a validation error. This is the
percent counterpart of armour's flat points: armour `flat` subtracts points per hit, an enemy `resist` scales.

**Table: 5 of 38 enemies (13%).** Three bosses, two ordinary enemies, so a mono-element deck is dented, never walled.

| enemy id | act / role | element | resist | why (thematic) | existing weaknesses (unchanged) |
|---|---|---|---|---|---|
| `charredColossus` | normal, 55-60 HP | `fire` | 50 | already burnt out; ash does not catch | blunt, frost |
| `ashheartDragon` | final boss, 245 HP | `fire` | 25 | the heart is a furnace; fire barely bites | piercing, frost |
| `courtMarionette` | normal, 16-18 HP | `psychic` | 50 | a puppet has no mind to break | blunt, fire |
| `thornMatriarch` | boss, 110 HP | `earth` | 50 | rooted in it | slashing, fire |
| `marrowOrganist` | boss, 190 HP | `decay` (Necrotic) | 50 | the dead are not harmed by rot | blunt, sacred |

Checks: `charredColossus` already has `damageResistanceBySchool: { magic: 10 }` (`enemies/act3.js:91`, the legacy v1 raw
HP path read at `actions.js:101`). Leave it; it is a different mechanism and v2 does not read it. Remove it only if
the owner wants one number. No enemy resists a type it is weak to. `charredColossus` and `courtMarionette` are also in the
creature lines of sections 1 and 2 (construct, mindless), which are **status** immunities, not damage resists, and
are not counted in the 13%.

**Acceptance.** Preview and live damage agree (`combatDamagePreview.js` reads the same projection); a 50-resist enemy
takes half (ceil) from that type and full from the others; validator refuses `weak` and `resist` on the same type.

## 4. oath / precision / gorefire (decision #11)

Today these three are **presentation-only** tags: `nodes.csv` says "Deliberate aim and finesse; presentation only"
(`precision`, line 60) and the fx rows say "no combat modifier". The mechanics are new. The affected set is **20 tag
memberships on 19 distinct cards** (`enterGorefire` carries both `oath` and `gorefire`), counted from
`content/source/tagging.csv` family `card`:

- **oath (12):** `enterGorefire`, `enterBulwark` (reaver C/1), `gildedOath` (herald U/2), `afterimageCard`, `venomcoat`
  (rogue U/1), `deadlyTempoCard`, `opportunistCard`, `envenomCard` (rogue powers), `progression-red-standard` (reaver R/1),
  `progression-crown-of-cinders` (reaver R/3), `progression-crown-of-scars` (herald R/3), `progression-dawn-after-ash` (herald R/3).
- **precision (6):** `coupDeGrace` (rogue U/2), `assassinate` (rogue R/2), `deathblow` (rogue R/3), `aimedShot` (rogue U/2,
  already `damage:piercing`), `nockAndWait` (rogue C/1 skill), `executionWindow` (rogue R/1 skill).
- **gorefire (2):** `gorefireSlash` (reaver starter attack, 5 damage + 3 Bleed), `enterGorefire`.

### 4.1 Oath

- **Rule (refined).** *Oath is kept while you have not entered a stance earlier this turn.* While kept, playing an
  Oath card grants **2 Block** (knob `balance.tagMechanics.oath.block`, default 2). Scope is the **turn**, not the
  fight: the draft said "turn/fight"; a per-fight reading would make the two Reaver stance cards (`enterGorefire`,
  `enterBulwark`) never pay once the stance is up, while the turn reading lets the first stance card of each turn pay
  and punishes stance-dancing inside one turn. For classes with no stance (Rogue, Herald) the oath is always kept, so
  the bonus is flat. That is intended: the tag then reads "vows that stay put".
- **Extension point (data only).** A property rule carried by every class, the way the `favored` class property is
  (`tagging.csv` rows `class,,reaver,favored` etc., mounted as carrier kind `class`,
  `src/engine/properties.js:59,194`), authored exactly as SPEC §15.4 says rules are: a `tagging.csv` property row,
  `nodeEffects.json` entry, `nodeVariables.csv` and `variableBindings.csv` rows. Two triggers in one node (new property
  node `rule.oath`, bound to a `balance.js` number):

```json
"rule.oath": { "triggers": [
  { "on": "stanceEntered",
    "if": { "p": "eventSourceIsOwner" },
    "do": [ { "op": "applyStatus", "target": "owner", "status": "stanceShifted", "stacks": 1 } ] },
  { "on": "cardPreparing",
    "if": { "p": "all", "preds": [
      { "p": "eventSourceIsOwner" },
      { "p": "cardTagIs", "tag": "oath" },
      { "p": "not", "pred": { "p": "hasStatus", "of": "owner", "status": "stanceShifted" } } ] },
    "do": [ { "op": "block", "target": "owner", "amount": { "variable": "block" } } ] }
] }
```

  plus one status row `{ id: 'stanceShifted', name: 'Stance Shifted', stackMode: 'unique', decay: 'perTurnEnd' }`
  in `statuses.js` (the same shape as `prepared`, `statuses.js:798`). `cardPreparing` carries `cardTags`
  (`combat.js:1375`) and fires before the card's effects, so the entering card itself still counts as kept.
  I chose a plain `block` op rather than `grantCardCharge`: a charge only attaches to a card's own `block`/`damage`/`heal`
  op (`abilityRiders.js:132-143`), which eight of the twelve Oath cards (powers, stance entries, Venomcoat) do not have.
- **Verified:** `stanceEntered` is emitted (`actions.js:1162`), `cardPreparing` exists (`schemas.js` EVENTS), predicates
  `not`, `all`, `hasStatus`, `cardTagIs`, `eventSourceIsOwner` exist. **To verify in the unit's tests:** that a class
  mount trigger on `cardPreparing` fires for the live card and not only the preview clone (`combat.js:1269` emits on a
  clone), and that `stanceShifted` expires at the player's turn end.
- **Power vs rubric (+2 Block, about 1.7 pts):** inside the 2-pt Common rider allowance; negligible on powers (a
  once-per-combat 2 Block); on `enterBulwark` it makes the first stance of a turn 5 Block total (3 on enter + 2),
  Defend+0. Largest risk is `progression-red-standard` (R/1, Block 13): 15 against a rare 1-energy block of 12 plus
  riders, borderline. `venomcoat` goes to about 12 against Uncommon 8 to 9 (Venom 4 is the cost). Both are existing
  outliers; the oath bonus is not what makes them so.

### 4.2 Precision

- **Rule (refined).** *A Precision-tagged **attack** ignores up to 4 of the target's Block, once per action and target.*
  Knob `combatMatchups.tagRiders.precision.guardBypass = 4` (Piercing's own bypass is 2, `damageRiders.piercing`). If the
  card is also Piercing, the larger of the two applies (not the sum), so `aimedShot` gains 2 net.
- **Extension point (small engine unit, new table).** `damageRiders` is keyed by damage type only. Add a sibling
  `tagRiders` table keyed by **technique/theme tag**, in both `combatMatchups` and `combatExpansionMatchups`, and make the
  two places that compute the bypass take the max of the damage-type rider and the tag riders of the carrier's
  authored tags: `src/engine/combatMatchups.js:100` (v1 bypass) and `:383` (v2 bypass), plus the preview mirror at
  `src/engine/combatDamagePreview.js:40`. The carrier's authored tag list is the same one `cardTagIs` reads
  (`card.authoredTags ?? card.tags`, `triggers.js:413`). Nothing in the closed predicate or opcode set changes.
- **Power vs rubric.** Block is present on an enemy at a hit maybe 30% of the time and absorbs up to 4 of it, so about
  +1.2 expected, +4 at most, per attack. Uncommon allowance 2 to 4, Rare 4 to 6: in budget, small by design. Per card:
  `coupDeGrace` U/2 (10 + 10 if Prepared) +1.2; `assassinate` R/2 (14 + 14, Exhaust) +1.2; `deathblow` R/3 (24 + 10 + 10) +1.2
  (the rider is once per action and target, not per hit); `aimedShot` U/2 +0.6 net of its Piercing 2.
- **Skills do nothing.** `nockAndWait` and `executionWindow` are skills with no damage, so Precision is inert on them.
  Recommendation: leave the tag (it still means "this is a Precision card" to the deck and to future payoffs). See open
  question 4.

### 4.3 Gorefire

- **Rule (refined).** *A Gorefire-tagged attack applies 1 Burned after HP loss, once per action and target; a card that
  prints Burned suppresses it.* Same row shape as the Fire rider.
  - v1: `tagRiders.gorefire = { status: 'burn' (burned after rename), stacks: 1, requiresHpLoss: true }`
  - v2: `{ status: 'burn', pressure: 4, recoveryProfile: 'elemental', requiresHpLoss: true }`
- **Extension point.** The same `tagRiders` table, read in `matchupRiderEffects` (`combatMatchups.js:184`): after looking up
  `damageRiders[type]`, also collect `tagRiders[tag]` for each authored tag of the carrier and merge the statuses
  (a card with two riders gets both, deduped on status id; `appliedStatuses` already suppresses a printed one).
  The one engine unit therefore delivers both Precision and Gorefire.
- **Alternative with no engine change.** Tag `gorefireSlash` `damage:fire`, which fires the existing Fire rider. Rejected:
  it changes the card's damage type (fire is not reduced by armour class, takes fire weakness and resist) when the
  intent is only a rider.
- **Power vs rubric.** `gorefireSlash` (starter): 5 + Bleed 3 (3.6) = 8.6 today; Burned 1 adds 1 (v1) or 0.7 (v2), so
  about 9.4. Starter rider allowance is 0 to 1 and the owner has just protected starter DPS (`624232e0d`, "Keep Ambush
  and Twin Fang at current values"). Gate the change on `node tools/runsim.mjs 240 --seeded-seats` (Reaver wins must stay
  inside the 35 to 65% band used at SPEC.md:2318); fallback knob: only fire the rider while in Gorefire stance (add an
  `inStance` gate to the tag rider). `enterGorefire` is a skill with no hit, so it gains nothing (open question 4 covers
  the same shape).

### 4.4 Balance knobs (`balance.js` style)

```js
// content/combatMatchups.js, exposed through balance.combatMatchups with NOTE entries like damageRiders
tagRiders: {
  precision: { guardBypass: 4 },
  gorefire:  { status: 'burn', stacks: 1, requiresHpLoss: true },   // v2: pressure 4, recoveryProfile 'elemental'
},
// balance.js (new key, bound by variableBindings.csv rows `default,,rule.oath,block,tagMechanics.oath.block`)
tagMechanics: { oath: { block: 2 } },
```

### 4.5 SPEC paste (technique riders)

**§4.7, after the damage riders table:**

> **Technique riders.** Three card tags carry a rider of their own, resolved with the damage riders (once per root action
> and target, no reaction chaining): **Precision** attacks bypass up to 4 Block (the larger of this and a Piercing bypass,
> never the sum); **Gorefire** attacks apply 1 Burned after HP loss unless the card prints Burned. **Oath** is not a hit
> rider: while the player has not entered a stance earlier this turn, playing an Oath card grants 2 Block.

## 5. Implementation plan

One branch per unit. Content-only units edit data files and regenerate derived files (`node tools/content-build.mjs`,
derived files only per CONTRIBUTING rule 6). **Wave 0 is outside this plan** (decision #3 rename, owner: the TagRefactor
or rename task). Units in the same wave touch disjoint files. `content/source/tagging.csv` and `nodes.csv` are hot files:
append-only blocks, and the main session resolves conflicts.

| Wave | Unit | Kind | Files (owner) | Depends |
|---|---|---|---|---|
| 1 | **U1 Damage-type registry**: `poison`, `psychic`, `earth` in `combatRules.damageTypes`, `damage:*` rows in `nodes.csv`, `school:earth` node, rider rows (v1 and v2), `poison` cleanse entry, the `TYPE.illusion` change, `tagRiders` table (empty rows for 4.2 and 4.3 filled here) | content | `src/content/combatRules.js`, `src/content/combatMatchups.js`, `content/source/nodes.csv`, `src/content/combatExpansionCards.js` (only line 14), regenerated `src/content/generated/*` | none |
| 1 | **U2 Statuses**: `confused`, `silenced`, `slowed`, `entombed`, `stoneskin`, `stanceShifted` rows; gauge rows `confused`, `slowed` | content (silenced needs U3) | `src/content/statuses.js`, `src/content/combatStatusRules.js` | none |
| 1 | **U3 Engine: `resist` and `spellDamageDealtMult`** | engine | `src/engine/actions.js` (:286, camp loop), `src/engine/combatExpansionEquipment.js`, `src/model/combatExpansionRules.js`, `src/model/schemas.js` (`MODIFIER_TYPES`), `src/engine/combatDamagePreview.js` | none |
| 2 | **U4 Engine: `tagRiders`** (Precision bypass, Gorefire status, preview parity) | engine | `src/engine/combatMatchups.js`, `src/engine/combatDamagePreview.js` (U3 also touches this file's preview line; serialise U3 then U4 on it) | U1 |
| 2 | **U5 Enemy and armour rows**: creature immunities, weaknesses, the 5 resists, armour `flat` and `buildupResistance` | content | `src/content/combatExpansionEquipment.js` | U1, U2, U3 |
| 2 | **U6 Oath rule**: property node, `nodeEffects.json`, `nodeVariables.csv`, `variableBindings.csv`, class tagging rows, `balance.js` `tagMechanics` | content | `content/source/nodeEffects.json`, `nodeVariables.csv`, `variableBindings.csv`, `tagging.csv` (class rows), `nodes.csv` (property node), `src/content/balance.js` | U2 (`stanceShifted`) |
| 3 | **C1 Poison cards** (4) and the two retags | content | `src/content/cards/rogue.js`, `tagging.csv` rows | U1 |
| 3 | **C2 Psychic cards** (4) | content | `src/content/cards/starseer.js`, `src/content/combatExpansionCards.js` (colorless), `tagging.csv` | U1, U2, U3 |
| 4 | **C3 Earth cards** (4) | content | `src/content/cards/reaver.js`, `herald.js`, `combatExpansionCards.js` (after C2), `tagging.csv` | U1, U2 |
| 4 | **V Verification and balance pass**: runsim, rarity test, numbers vs rubric | tests | none (reports) | all |

**Acceptance tests (extend the named existing test where one exists, otherwise create the named file):**

- **U1** (`tests/damage-types-elements.test.mjs`, new): every key of `combatRules.damageTypes` has a `damage:` node, a v1
  and a v2 `damageRiders` row, and (for statuses) a registry entry; a `damage:poison` hit that loses HP applies 1 Poisoned,
  a Block-absorbed one applies nothing, a card printing Poisoned suppresses the rider (mirror `tests/exposure-tag-damage.test.mjs`);
  `validateCombatProfile` accepts `poison`, `psychic`, `earth`; the four `illusion` cards report `damage:psychic`.
- **U2** (`tests/combat-status-control.test.mjs`, extend): `confused` with the `random` stream forced to 0 deals 3 Poise per
  stack and to 99 deals none; `slowed` modifiers multiply; `entombed` skips exactly one enemy turn and decays; `stoneskin`
  retains Block through the next turn start; a v2 rider for each of `confused` and `slowed` does not throw.
- **U3** (`tests/combat-expansion-equipment.test.mjs`, extend): `resist.fire = 50` halves fire (ceil) and leaves frost whole;
  weak and resist on one type is refused by the validator; preview equals live; a `silenced` enemy's spell-camp move deals
  half and its physical move is unchanged.
- **U4** (`tests/combat-expansion-tactics.test.mjs`, extend): a Precision attack into 6 Block bypasses 4; a Precision plus
  Piercing hit bypasses 4 (not 6); Gorefire applies Burned once per action even for a multi-hit; reaction actions chain
  no rider; preview parity.
- **U5** (`tests/content-expansion-equipment.test.mjs`, extend): construct rows hold `immuneStatuses: ['poisoned']` and a
  poison build-up into one is fully resisted (`receipt.fullyResisted`); undead halve it; mindless rows hold the Confused
  and Silenced immunities; the five resist rows exist and none contradicts a weakness; every `buildupResistance` key
  exists in `combatStatusRules.statuses`.
- **U6** (`tests/property-mount.test.mjs`, extend): with `stanceShifted` absent an Oath card grants 2 Block; after
  `enterBulwark` in the same turn a second Oath card grants none; the entering card itself grants (first stance of the
  turn); the status clears at turn end; Rogue and Herald (no stance) always get it; a `cardPreparing` preview clone does
  not double-grant.
- **C1, C2, C3** (`tests/card-rarity-costs.test.mjs`, extend, plus a loaded-face dump): each new card validates, its tags
  resolve, its rarity and cost match the section tables, and its rated primary number is within the rubric band.
- **V**: `node tools/runsim.mjs 240 --seeded-seats`, wins per class inside 35 to 65%; Reaver starter DPS unchanged to
  within 1 point after Gorefire.

## 6. Open questions for the owner

- Which classes own Psychic and Earth: Starseer owns Psychic, Reaver and Herald own Earth, colorless commons for both (A), or colorless only for now (B)?
  - Decides who can draft the 8 new element cards; blocks C2 and C3 only, not the engine units.
- Poison immunity: constructs immune to Poisoned and undead halve its build-up (yes), or constructs halve and undead normal (no)?
  - Decides how often Rogue's core status is shut off (6 immune, 8 halved of 38 enemies); blocks U5.
- Add a new modifier `spellDamageDealtMult` so Silenced can exist (yes), or drop Silenced and give `dissonance` Confused 3 (no)?
  - A yes adds one key to the closed `MODIFIER_TYPES` set (an engine unit, U3); a no removes a status and one card effect.
- Oath scope: kept per **turn** (A, my pick) or per **fight** (B)?
  - Under B the Reaver stance cards stop paying once a stance is up; the draft text said "turn/fight".
- Precision and Gorefire on cards with no hit (`nockAndWait`, `executionWindow`, `enterGorefire`): leave the tag inert (yes) or retag them (no)?
  - A no means a tagging pass on three cards; a yes leaves the tags as deck identity only.
- Gorefire Slash gains Burned 1 on top of Bleed 3 (starter about +1 point): accept after a runsim check (yes), or only while in Gorefire stance (no)?
  - You protected starter DPS in `624232e0d`; this changes the Reaver opening card.
