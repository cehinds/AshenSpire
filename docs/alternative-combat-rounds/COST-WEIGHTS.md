# Card cost weights

Status: shipped tunables (owner decisions, 2026-10-12). The rule is SPEC §4.3a;
the numbers live in `src/content/actionCosts.js`, and
`tests/action-costs-weights-doc.test.mjs` fails when this file and that one
disagree. Change a number there and here in the same commit.

## The formula

Each resource is priced on its own side (the owner set this shape, and on
2026-10-12 added the Mana-side rank, Ethereal as a drawback and status stacks
that count; on 2026-10-13 restores break even):

- **S_sp** = damageWeight × physical damage steps + rankWeight × rank + Σ
  SP-side tag weights + range weight + castingEffort (on a cast card) +
  SP-side statuses × stacks + drawback weights (negative).
- **S_mp** = damageWeight × magical damage steps + rankWeightMp × rank (on a
  magical card) + Σ MP-side tag weights + MP-side statuses × stacks.
- **SP** = floor(S_sp / spDivisor) and **MP** = floor(S_mp / mpDivisor).
- If both are 0, the larger side pays 1 (SP on a tie). A Mana-restoring card
  pays that 1 in SP.
- **Restores break even (owner, 2026-10-13).** A card that restores Mana then
  costs restoreWeight × that Mana on top of its MP, and a card that restores
  Stamina costs restoreWeight × that Stamina on top of its SP. The card face
  shows that full price. Its own restore pays that part (the effect's `funded`
  amount, `ownRestoreFunds`): the play charges the price less that part, and
  the restore gives back the rest. So the card is castable at 0 of that pool
  and changes it by exactly 0. Attune and Ember Communion show 1 SP and
  1 Mana, are castable at 0 Mana, and leave Mana where it was.

A card is **magical** when it carries any MP-side tag below; its damage and
the statuses it applies then count on the MP side. Damage is counted with its
hits, and turned into points by the damage step table: each threshold the
damage reaches adds damageWeight points. A tag counts once per card. The
**rank** is the card's rank above the base: an ability grade's own rank
(0–5), or a legacy instance rank minus 1. A base card is rank 0.

Opt-outs keep their authored cost and numbers: `costRule: 'fixed'`, curses and
statuses (by type), and X costs. A card whose derived SP is 2 or more
multiplies its effect amounts by twoCostMultiplier (SPEC §4.3a).

## Tunables

| Tunable | Value | Reason |
|---|---|---|
| `spDivisor` | 6 | D, the owner's ruling (2026-10-12: "use D as 6"). Not tuned. |
| `mpDivisor` | 8 | P. Raised from 6: at 6, rank 1–3 spells at 1–2 MP (78%) and rank 1–2 cards (78%) miss 80%; at 8 they reach 82% and 82%. |
| `damageWeight` | 1.5 | Points per damage step. Real card damage runs 2–40, far above the owner's example of 3; raw damage priced every big hit at 3–7 SP. |
| `damageSteps` | 1, 3, 5, 8, 12 | The damage thresholds: 3 damage is 2 steps (3 points), a 6-damage strike 3 steps (4.5), anything from 12 up 5 steps (7.5). |
| `rankWeight` | 1 | Points per rank above the base, SP side. Larger values push rank 1–2 cards to 3 SP. |
| `rankWeightMp` | 4 | Points per rank on the MP side of a magical card: a cantrip stays at 0 MP and its rank 1–3 faces pay 1–2 MP. |
| `castingEffortWeight` | 6 | SP-side points on every cast card: a spell costs 1 SP unless it carries a drawback. |
| `restoreWeight` | 1 | Price per point a card restores, in the restored pool. At 1 the restore pays it all, so the restore breaks even (owner, 2026-10-13). |
| `smashPoiseBase` | 3 | Poise damage every smash adds to its own (owner, 2026-10-13: "All smashes deal poise damage"). |
| `twoCostMultiplier` | 1.8 | The owner's 2-cost buff, applied at 2 SP or more (owner, 2026-10-12). On a sweep it skips damage (below). |
| `statusWeight` | 2 | The owner's floor for a status. |
| `statusStackCap` | none | Every stack counts (owner, 2026-10-12). A whole number caps the stacks a status is priced at. |

## Smashes and sweeps (owner, 2026-10-13)

- **The floor.** "Some higher rank ones could cost 1 sp? But basic ones are 2sp": at rank 0 a card with one of these
  tags costs at least its floor. A higher rank has no floor, and an authored upgrade that lowers the cost lowers the
  floor by as much.
- **What 2 SP buys.** "Be sure to add poise and base damage to account for the higher cost for smashes and AoE for
  sweeps but normal damage": a smash at 2 SP or more scales its damage and Poise damage by twoCostMultiplier; a sweep
  at 2 SP or more keeps its damage unscaled (the area pays for it) while its other riders (Block, buildup, Poise) scale.
- **All smashes deal Poise damage** (owner, 2026-10-13): smashPoiseBase is added to a smash's own Poise damage, or
  added as a Poise damage effect on its first damage target, at every rank and cost, and the card face names it.

| Maneuver | Floor at rank 0 | Unscaled at 2 SP |
|---|---|---|
| `maneuver:smash` | 2 | none |
| `maneuver:sweep` | 2 | damage |

Rank-0 smashes and sweeps all cost 2 SP (13 and 6). At ranks 1–3 (legacy instance ranks 2–4, grades 1–3):

| Rank | Smash | Sweep |
|---|---|---|
| 1 | 1 SP: 8, 2 SP: 4, 3 SP: 1 | 1 SP: 5, 2 SP: 1 |
| 2 | 1 SP: 3, 2 SP: 8, 3 SP: 2 | 1 SP: 2, 2 SP: 3, 3 SP: 1 |
| 3 | 1 SP: 1, 2 SP: 4, 3 SP: 1 | 2 SP: 1, 3 SP: 1 |

At 1 SP from rank 1: Crimson Cleave, Shield Bash, Cleaving Blow, Poise Breaker, Sunderplate, Sundering Chop, Whirling
Guard, Sweeping Blow, Breaker's Toll and Ashen Cleaver at rank 1; Kick Off at ranks 1–3; Shield Crash, Bashing Blow,
Whirling Guard and Sweeping Blow at rank 2.

## Calibration

Every priced card, resolved at owner ranks 0–3 (ability grades at grades 0–3,
legacy cards at instance ranks 1–3), 880 faces in all. With D fixed at 6 the
script searched P, damageWeight, eight damage step tables, rankWeight,
rankWeightMp, castingEffortWeight, the status weight and the weights of the
smash and sweep, heavy, cleave, counter, ranged, physical and magical damage
type, school, camp and weapon tags (coordinate descent from 250 random starts),
keeping the owner's shape. Targets are the owner's words of 2026-10-12.

| Target | Measured as | Faces | Hit rate |
|---|---|---|---|
| Most basic cards cost 1 Stamina | rank 0, physical, not smash or sweep: 1 SP / 0 MP | 113 | 80.5% |
| Most cantrips cost 1 Stamina | rank 0, magical: 1 SP / 0 MP | 134 | 77.6% |
| (the same, allowing 1 MP) | rank 0, magical: 1 SP, at most 1 MP | 134 | 94.0% |
| Smashes and sweeps cost 2 | rank 0, smash or sweep: 2 SP | 19 | 100% |
| Rank 1–2 cost 1 SP + 1 MP, or 2 SP, some only one | rank 1–2: 1/1, 2/0, 1/0 or 0/1 | 532 | 84.2% |
| (of those, a total of 2) | rank 1–2: SP + MP = 2 | 532 | 41.5% |
| Most rank 1–3 spells cost 1–2 Mana | rank 1–3, magical: 1–2 MP | 310 | 82.3% |
| Many magic cards cost at least 1 SP; 0-SP magic still possible | magical: SP ≥ 1 | 444 | 95.0% |
| Higher SP usually means lower MP | not both SP ≥ 2 and MP ≥ 2 | 880 | 98.9% |

With the rank on the Mana side the cantrip conflict is gone: cantrips cost 1 SP
/ 0 MP and their rank 1–3 faces pay Mana. The maneuver floor prices every base
smash and sweep at 2, and with the smash, sweep and heavy tags at 0 the heaviest
smashes no longer reach 3. Basics sit at the line (80.5%): ranged attacks and
Rogue cards that stack a status reach 2 SP.

Distribution (SP/MP: faces):

| Rank | Physical | Magical |
|---|---|---|
| 0 | 1/0: 91, 2/0: 36, 3/0: 4, 4/0: 1 | 1/0: 104, 1/1: 22, 0/1: 7, 1/2: 1 |
| 1 | 1/0: 97, 2/0: 28, 3/0: 6, 4/0: 1 | 1/1: 79, 1/0: 41, 0/1: 7, 1/2: 5, 0/2: 1, 2/0: 1 |
| 2 | 1/0: 74, 2/0: 46, 3/0: 10, 4/0: 2 | 1/1: 66, 1/2: 47, 2/1: 7, 0/1: 6, 2/2: 3, 1/0: 3, 1/3: 2 |
| 3 | 2/0: 18, 1/0: 18, 3/0: 4 | 1/2: 18, 1/1: 11, 2/2: 4, 2/3: 3, 1/3: 3, 1/4: 1, 1/0: 1, 0/1: 1 |

## Tag weights

Weights run -3..3; only drawbacks are negative. SP and MP name the side a tag
counts on; an MP-side tag also marks the card magical, even at weight 0. Every
combat tag of the tag model (`src/content/tags.js`) is listed: damage types,
delivery and reach (range), maneuvers, camps, sources, counter modes,
targeting, schools, techniques, traits, lifecycle keywords and the card chips.
The `ability:*` identity tags weigh nothing and are not listed. The four
`drawback:*` tags are not in the tag model: the formula reads them from a
card's effects (`loseHp`, `discard`, `grantCardCharge`, `addCard` into the
player's piles).

### Damage types

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `damage:slashing` | 2 | SP | A physical damage type: 2, which lifts a light smash (Shield Bash, Bashing Blow) toward 2 SP. |
| `damage:piercing` | 2 | SP | As slashing. |
| `damage:blunt` | 2 | SP | As slashing. |
| `damage:fire` | 0 | MP | Magical damage marks the card magical (its damage and statuses go to MP); the school already prices the element, so 0. |
| `damage:frost` | 0 | MP | As fire. |
| `damage:lightning` | 0 | MP | As fire. |
| `damage:arcane` | 0 | MP | As fire. |
| `damage:sacred` | 0 | MP | As fire. |
| `damage:decay` | 0 | MP | As fire. |

### Camps and sources

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `camp:physical` | 2 | SP | A physical action costs effort: 2 lifts a plain strike or guard to the edge of 1 SP. |
| `camp:spell` | 1 | MP | A spell carries a Mana price of its own: 1. With the school, magic damage steps and rank it reaches 1 MP at rank 1. |
| `source:weapon` | 0 | SP | Where the action comes from, not how strong it is. |
| `source:spell` | 0 | MP | Marks the card magical; no weight of its own. |
| `source:unarmed` | 0 | SP | As source:weapon. |

### Maneuvers and counter modes

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `maneuver:attack` | 0 | SP | The plain action: the base price, nothing on top. |
| `maneuver:defend` | 0 | SP | The plain guard: the base price, nothing on top. |
| `maneuver:ranged` | 0 | SP | A ranged shot: the range weight (3) already prices the reach, so 0. |
| `maneuver:counter` | 0 | SP | A counter is priced by its reply damage and its technique; at 0 the elemental counters stay at 1 SP. |
| `maneuver:smash` | 0 | SP | A base smash costs 2 by its floor (owner, 2026-10-13); 0 here, so a higher-rank smash can come out at 1 SP and the heaviest stay at 2. |
| `maneuver:sweep` | 0 | SP | As smash: the floor prices a base sweep at 2. |
| `maneuver:casting` | 0 | MP | Marks a cast (the casting effort prices it); no weight of its own. |
| `counter:melee` | 0 | SP | The counter maneuver already prices the counter. |
| `counter:ranged` | 1 | SP | Answering a shot reaches further: 1. |
| `counter:spell` | 1 | MP | Answering a spell takes magic: 1 on the MP side. |

### Targeting

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `targeting:single` | 0 | SP | One target is the base. |
| `targeting:area` | 2 | SP | Every enemy at once: 2. |
| `targeting.self` | 0 | SP | Not carried by a card today; the base. |
| `targeting.enemy` | 0 | SP | Not carried by a card today; the base. |
| `targeting.ally` | 0 | SP | Not carried by a card today; the base. |
| `targeting.randomEnemy` | 1 | SP | Not carried by a card today; between single and area. |
| `targeting.allEnemies` | 2 | SP | Not carried by a card today; as targeting:area. |

### Magic schools

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `school:fire` | 1 | MP | A school is the magic itself: 1. Rank carries most of a spell's Mana now, so a cantrip stays at 0 MP. |
| `school:frost` | 1 | MP | As fire. |
| `school:lightning` | 1 | MP | As fire. |
| `school:force` | 1 | MP | As fire. |
| `school:alteration` | 1 | MP | As fire. |
| `school:illusion` | 1 | MP | As fire. |
| `school:divine` | 1 | MP | As fire. |
| `school:decay` | 1 | MP | As fire. |

### Weapon and archetype chips

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `blade` | 1 | SP | An edged weapon: 1. |
| `heavy` | 0 | SP | A heavy weapon; the damage steps already price the heavy hit, so 0. |
| `pierce` | 1 | SP | A piercing weapon: 1. |
| `precision` | 1 | SP | A precise technique: 1. |
| `guard` | 0 | SP | An archetype chip, not a power. |
| `bow` | 0 | SP | The range weight prices a bow. |
| `ranged` | 0 | SP | The range weight prices it. |
| `flourish` | 0 | SP | An archetype chip. |
| `guile` | 0 | SP | An archetype chip. |
| `venom` | 0 | SP | The status it applies is priced instead. |
| `blood` | 0 | SP | An archetype chip; its HP costs are drawbacks. |
| `gorefire` | 0 | SP | An archetype chip. |
| `oath` | 0 | SP | An archetype chip. |
| `ash` | 0 | SP | An archetype chip. |
| `basic` | 0 | SP | An archetype chip. |
| `extractable` | 0 | SP | A loot marker. |
| `starstone` | 0 | SP | An archetype chip; its charge status is priced instead. |
| `ritual` | 0 | SP | An archetype chip. |
| `blight` | 0 | SP | An archetype chip; its status is priced instead. |

### Techniques

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `technique:heavy` | 0 | SP | As heavy, 0. |
| `technique:cleave` | 1 | SP | A cleave reaches more than one foe: 1. |
| `technique:precision` | 1 | SP | A precise technique: 1. |
| `technique:counter` | 1 | SP | A countering technique: 1. |
| `technique:flourish` | 0 | SP | A flourish is style; the effects price it. |

### Traits

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `trait:adequateReach` | 0 | SP | A reach rule, priced by range. |
| `trait:closing` | 1 | SP | Closes the distance: 1. |
| `trait:conductive` | 0 | SP | A matchup trait, not power. |
| `trait:grounded` | 1 | SP | Holds its ground: 1. |
| `trait:insulated` | 0 | SP | A matchup trait, not power. |
| `trait:mental` | 0 | SP | A matchup trait, not power. |
| `trait:projectile` | 0 | SP | Priced by range. |
| `trait:reveal` | 0 | SP | Information, not power. |
| `trait:shattering` | 1 | SP | Breaks guards: 1. |
| `trait:unavoidable` | 1 | SP | Cannot be dodged: 1. |
| `trait:unreflectable` | 1 | SP | Cannot be reflected: 1. |

### Keywords

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `lifecycle.retain` | 1 | SP | Kept between turns: 1. |
| `lifecycle.innate` | 1 | SP | Always in the opening hand: 1. |
| `lifecycle.recall` | 1 | SP | Returns to hand: 1. |
| `lifecycle.recall.afterUse` | 1 | SP | As recall. |
| `lifecycle.recall.afterTurnDraw` | 1 | SP | As recall. |
| `lifecycle.recall.afterCardPlay` | 1 | SP | As recall. |
| `lifecycle.seal` | 0 | SP | A lifecycle marker, not power. |

### Drawbacks

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `lifecycle.ethereal` | -1 | SP | Drawback (owner, 2026-10-12): an Ethereal card is lost if it is not played this turn. Proposed -1, as Exhaust. |
| `lifecycle.exhaust` | -1 | SP | Drawback (owner): played once per fight. -1. |
| `drawback:selfDeck` | -2 | SP | Drawback (owner): adds a curse or status to your own piles. -2. |
| `drawback:hpCost` | -2 | SP | Drawback (owner): costs HP or another resource. -2. |
| `drawback:discard` | -1 | SP | Drawback (owner): makes you discard. -1. |
| `drawback:delayed` | -1 | SP | Drawback (owner): takes several turns to cast (a charge built first). -1. |

### Range

A card takes the largest range among its tags (owner: melee 1, reach 2, ranged 3). Range counts on the SP side.

| Tag | Range | Weight | Side | Reason |
|---|---|---|---|---|
| `delivery:melee` | melee | 1 | SP | Contact range (owner). |
| `reach:contact` | melee | 1 | SP | Contact range (owner). |
| `reach:near` | reach | 2 | SP | Reaches a step further, or a whole area (owner). |
| `delivery:area` | reach | 2 | SP | Reaches a step further, or a whole area (owner). |
| `reach:far` | ranged | 3 | SP | Hits from afar (owner). |
| `delivery:projectile` | ranged | 3 | SP | Hits from afar (owner). |
| `maneuver:ranged` | ranged | 3 | SP | Hits from afar (owner). |

### Statuses

Every status a card applies (applyStatus, or buildup as one stack) weighs 2 (owner: statuses weigh 2 or more), times its stacks (owner, 2026-10-12: stacks count; there is no cap). It counts on the card's side: MP on a magical card, else SP.

| Status | Weight | Side | Reason |
|---|---|---|---|
| `strength` | 2 | card | The owner's floor for a status. |
| `dexterity` | 2 | card | The owner's floor for a status. |
| `weak` | 2 | card | The owner's floor for a status. |
| `vulnerable` | 2 | card | The owner's floor for a status. |
| `frail` | 2 | card | The owner's floor for a status. |
| `bleed` | 2 | card | The owner's floor for a status. |
| `frost` | 2 | card | The owner's floor for a status. |
| `insanity` | 2 | card | The owner's floor for a status. |
| `bleedResist` | 2 | card | The owner's floor for a status. |
| `frostResist` | 2 | card | The owner's floor for a status. |
| `insanityResist` | 2 | card | The owner's floor for a status. |
| `frostExposed` | 2 | card | The owner's floor for a status. |
| `insanityExposed` | 2 | card | The owner's floor for a status. |
| `crimsonBlight` | 2 | card | The owner's floor for a status. |
| `burn` | 2 | card | The owner's floor for a status. |
| `regen` | 2 | card | The owner's floor for a status. |
| `madness` | 2 | card | The owner's floor for a status. |
| `staggered` | 2 | card | The owner's floor for a status. |
| `rallyingStandard` | 2 | card | The owner's floor for a status. |
| `rallyingStandardUp` | 2 | card | The owner's floor for a status. |
| `unbreakable` | 2 | card | The owner's floor for a status. |
| `unbreakableUp` | 2 | card | The owner's floor for a status. |
| `goreblood` | 2 | card | The owner's floor for a status. |
| `sanguinePact` | 2 | card | The owner's floor for a status. |
| `starstoneCharge` | 2 | card | The owner's floor for a status. |
| `stargazer` | 2 | card | The owner's floor for a status. |
| `astralArmor` | 2 | card | The owner's floor for a status. |
| `constellation` | 2 | card | The owner's floor for a status. |
| `azureCoil` | 2 | card | The owner's floor for a status. |
| `waxingMoon` | 2 | card | The owner's floor for a status. |
| `moonlitShield` | 2 | card | The owner's floor for a status. |
| `astromancer` | 2 | card | The owner's floor for a status. |
| `thornHalo` | 2 | card | The owner's floor for a status. |
| `communion` | 2 | card | The owner's floor for a status. |
| `lifeTithe` | 2 | card | The owner's floor for a status. |
| `stigmata` | 2 | card | The owner's floor for a status. |
| `zealotry` | 2 | card | The owner's floor for a status. |
| `emberTide` | 2 | card | The owner's floor for a status. |
| `harbingerOfBlight` | 2 | card | The owner's floor for a status. |
| `bloodUnction` | 2 | card | The owner's floor for a status. |
| `ironVow` | 2 | card | The owner's floor for a status. |
| `bulwarkEcho` | 2 | card | The owner's floor for a status. |
| `prepared` | 2 | card | The owner's floor for a status. |
| `venom` | 2 | card | The owner's floor for a status. |
| `afterimage` | 2 | card | The owner's floor for a status. |
| `deadlyTempo` | 2 | card | The owner's floor for a status. |
| `opportunist` | 2 | card | The owner's floor for a status. |
| `envenom` | 2 | card | The owner's floor for a status. |
| `glassCannon` | 2 | card | The owner's floor for a status. |
| `magicVulnerable` | 2 | card | The owner's floor for a status. |
| `bleeding` | 2 | card | The owner's floor for a status. |
| `frozen` | 2 | card | The owner's floor for a status. |
| `chilled` | 2 | card | The owner's floor for a status. |
| `sleep` | 2 | card | The owner's floor for a status. |
| `paralysis` | 2 | card | The owner's floor for a status. |
| `dazed` | 2 | card | The owner's floor for a status. |
| `offBalance` | 2 | card | The owner's floor for a status. |
| `prone` | 2 | card | The owner's floor for a status. |
| `grounded` | 2 | card | The owner's floor for a status. |
| `invulnerability` | 2 | card | The owner's floor for a status. |
| `decoy` | 2 | card | The owner's floor for a status. |
| `concealed` | 2 | card | The owner's floor for a status. |

## Outliers

Every face that misses its target at the shipped tunables, with its sums (S before the maneuver floor). The rank is the owner rank (0 = base). The cantrip table lists rank-0 magic faces
that are not 1 SP with at most 1 MP; the strict 1 SP / 0 MP rate is in the calibration table.

Why the main groups miss:

- **Basics at 2 SP or more**: ranged attacks (range 3) and Rogue cards that stack a status, priced up by
  weights the owner set.
- **Rank 1–2**: long-range shots and status-stacking cards climbing to 3 SP, and big spells at 1 SP + 2 MP.
- **Spells**: rank-1 spells whose Mana side is still under 8 (0 MP), and rank-3 fire and astral spells at
  3–4 MP.
- **Both sides 2 or more**: a few rank 2–3 fire and astral spells.

### Basic cards at rank 0 that are not 1 SP / 0 MP (22)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| gorefireSlash | 0 | 2/0 | 14.5 | 0 |
| serratedBlade | 0 | 2/0 | 14.5 | 0 |
| impale | 0 | 4/0 | 24 | 0 |
| goreslash | 0 | 2/0 | 12.5 | 0 |
| ambush | 0 | 2/0 | 13.5 | 0 |
| twinPrick | 0 | 2/0 | 12 | 0 |
| serratedShiv | 0 | 3/0 | 22.5 | 0 |
| garrote | 0 | 3/0 | 19 | 0 |
| fanOfKnives | 0 | 2/0 | 12.5 | 0 |
| coupDeGrace | 0 | 2/0 | 13.5 | 0 |
| venomcoat | 0 | 2/0 | 12 | 0 |
| assassinate | 0 | 2/0 | 12.5 | 0 |
| toxicVolley | 0 | 2/0 | 17 | 0 |
| executionWindow | 0 | 2/0 | 12 | 0 |
| deathblow | 0 | 2/0 | 13.5 | 0 |
| pinningShot | 0 | 2/0 | 14.5 | 0 |
| arrowVolley | 0 | 2/0 | 12.5 | 0 |
| aimedShot | 0 | 3/0 | 21.5 | 0 |
| barbedArrow | 0 | 3/0 | 20.5 | 0 |
| katanaDrawCut | 0 | 2/0 | 16 | 0 |
| spikedReprisal | 0 | 2/0 | 12 | 0 |
| rimeThrust | 0 | 2/0 | 16.5 | 0 |

### Cantrips (rank-0 magic) that are not 1 SP with at most 1 MP (8)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| ashfallRite | 0 | 1/2 | 8 | 16 |
| flagellation | 0 | 0/1 | 5 | 8 |
| martyrBlood | 0 | 0/1 | 3 | 4 |
| exsanguinate | 0 | 0/1 | 4 | 9.5 |
| butterflyPlague | 0 | 0/1 | 4 | 14 |
| bloodOfferingRite | 0 | 0/1 | 4 | 9.5 |
| blightwardLash | 0 | 0/1 | 5 | 10.5 |
| ashOath | 0 | 0/1 | 5 | 8 |

### Smashes and sweeps at rank 0 that are not 2 SP (0)

None.

### Rank 1-2 cards outside 1/1, 2/0, 1/0 or 0/1 (84)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| crimsonCleave | 2 | 3/0 | 18 | 0 |
| rend | 2 | 3/0 | 18.5 | 0 |
| impale | 1 | 4/0 | 25 | 0 |
| impale | 2 | 4/0 | 26 | 0 |
| starstonePebble | 2 | 1/2 | 11 | 18 |
| starbladePhalanx | 2 | 1/2 | 11 | 18 |
| starShower | 2 | 1/2 | 11 | 19.5 |
| frostVeil | 2 | 1/2 | 9 | 18 |
| starSlicer | 2 | 1/2 | 9 | 19.5 |
| starlance | 2 | 1/2 | 11 | 19.5 |
| frostNova | 2 | 1/3 | 8 | 29 |
| starstoneArc | 2 | 1/2 | 11 | 18.5 |
| moonrendCut | 2 | 1/2 | 9 | 18 |
| meteorite | 2 | 2/2 | 12 | 19.5 |
| meteorSwarm | 2 | 2/2 | 12 | 18 |
| gravityWell | 2 | 1/2 | 9 | 18 |
| astralCleave | 2 | 1/2 | 9 | 19.5 |
| radiantSpray | 2 | 1/2 | 11 | 20 |
| starstoneKris | 2 | 1/2 | 9 | 18 |
| starfallBeam | 2 | 2/2 | 12 | 19.5 |
| celestialLance | 2 | 1/2 | 11 | 19.5 |
| starSpark | 2 | 1/2 | 11 | 18.5 |
| cinderSigil | 2 | 1/2 | 11 | 20.5 |
| ashenMote | 2 | 1/2 | 11 | 18 |
| pyreOfCharts | 1 | 1/2 | 10 | 16.5 |
| pyreOfCharts | 2 | 1/2 | 11 | 20.5 |
| ashCircle | 2 | 1/2 | 9 | 16 |
| kindledOmen | 1 | 1/2 | 8 | 18 |
| kindledOmen | 2 | 1/2 | 9 | 22 |
| cinderLance | 1 | 1/2 | 10 | 19.5 |
| cinderLance | 2 | 1/2 | 11 | 23.5 |
| ashfallRite | 1 | 1/2 | 9 | 20 |
| ashfallRite | 2 | 1/3 | 10 | 24 |
| pyreLight | 2 | 1/2 | 10 | 19.5 |
| blightTouch | 2 | 1/2 | 9 | 18.5 |
| flagellation | 2 | 1/2 | 7 | 16 |
| litany | 1 | 1/2 | 7 | 16 |
| litany | 2 | 1/2 | 8 | 20 |
| cullTheWeak | 2 | 1/2 | 8 | 16 |
| gildedOath | 2 | 1/2 | 9 | 18 |
| plagueBearer | 2 | 1/2 | 8 | 18.5 |
| exsanguinate | 2 | 1/2 | 6 | 17.5 |
| scourge | 2 | 1/2 | 10 | 18.5 |
| butterflyPlague | 1 | 0/2 | 5 | 18 |
| butterflyPlague | 2 | 1/2 | 6 | 22 |
| witheringTouch | 2 | 1/2 | 9 | 19 |
| desperateRite | 2 | 1/2 | 8 | 17.5 |
| bloodOfferingRite | 2 | 1/2 | 6 | 17.5 |
| blightwardLash | 2 | 1/2 | 7 | 18.5 |
| serratedShiv | 1 | 3/0 | 23.5 | 0 |
| serratedShiv | 2 | 4/0 | 24.5 | 0 |
| garrote | 1 | 3/0 | 20 | 0 |
| garrote | 2 | 3/0 | 21 | 0 |
| toxicVolley | 1 | 3/0 | 18 | 0 |
| toxicVolley | 2 | 3/0 | 19 | 0 |
| aimedShot | 1 | 3/0 | 22.5 | 0 |
| aimedShot | 2 | 3/0 | 23.5 | 0 |
| barbedArrow | 1 | 3/0 | 21.5 | 0 |
| barbedArrow | 2 | 3/0 | 22.5 | 0 |
| katanaDrawCut | 2 | 3/0 | 18 | 0 |
| colossusSmash | 2 | 3/0 | 18.5 | 0 |
| ashOath | 2 | 1/2 | 7 | 16 |
| rimeThrust | 2 | 3/0 | 18.5 | 0 |
| kilnCleave | 1 | 3/0 | 18 | 0 |
| kilnCleave | 2 | 3/0 | 19 | 0 |
| lightningCounter | 2 | 2/1 | 12 | 11 |
| forceCounter | 2 | 2/1 | 12 | 11 |
| alterationCounter | 2 | 2/1 | 12 | 11 |
| barrageCounter | 2 | 2/1 | 13 | 10 |
| emberDart | 2 | 1/2 | 10 | 16.5 |
| staticNeedle | 2 | 2/1 | 12 | 15 |
| forceNudge | 2 | 2/1 | 12 | 13 |
| earthGrounding | 2 | 2/1 | 12 | 12 |
| progression-cinder-orbit | 2 | 1/2 | 8 | 16 |
| progression-comet-needle | 2 | 1/2 | 9 | 18 |
| progression-rime-mirror | 2 | 1/2 | 8 | 17 |
| progression-falling-constellation | 2 | 1/2 | 8 | 16 |
| progression-gravitic-knot | 2 | 1/2 | 8 | 18 |
| progression-eclipse-lance | 2 | 1/2 | 9 | 17.5 |
| progression-blood-censer | 2 | 1/2 | 6 | 16 |
| progression-blight-litany | 2 | 1/2 | 8 | 20.5 |
| progression-ember-tithe | 2 | 1/2 | 6 | 18 |
| progression-requiem-brand | 2 | 1/2 | 8 | 19.5 |
| progression-crown-of-scars | 2 | 1/2 | 6 | 17.5 |

### Rank 1-3 spells outside 1-2 MP (55)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| crystalBarrier | 1 | 1/0 | 8 | 6 |
| scholarsInsight | 1 | 1/0 | 7 | 6 |
| frostNova | 2 | 1/3 | 8 | 29 |
| frostNova | 3 | 1/4 | 9 | 34.5 |
| starstoneArc | 3 | 2/3 | 12 | 24 |
| radiantSpray | 3 | 2/3 | 12 | 24 |
| starPath | 1 | 1/0 | 7 | 6 |
| attune | 1 | 1/0 | 8 | 6 |
| attune | 2 | 1/0 | 9 | 10 |
| cinderSigil | 3 | 2/3 | 12 | 26 |
| emberVigil | 1 | 1/0 | 7 | 6 |
| readTheAsh | 1 | 1/0 | 7 | 6 |
| ashfallRite | 2 | 1/3 | 10 | 24 |
| urgentHeal | 1 | 1/0 | 8 | 6 |
| emberCommunion | 1 | 1/0 | 7 | 6 |
| emberCommunion | 2 | 1/0 | 8 | 10 |
| blightTouch | 3 | 1/3 | 10 | 24 |
| penance | 1 | 1/0 | 8 | 6 |
| transfusion | 1 | 1/0 | 8 | 6 |
| blightward | 1 | 1/0 | 8 | 6 |
| scourge | 3 | 1/3 | 11 | 24 |
| reclamation | 1 | 1/0 | 7 | 6 |
| secondBloom | 1 | 1/0 | 7 | 6 |
| blightNova | 1 | 1/0 | 8 | 6 |
| lastRites | 1 | 1/0 | 7 | 6 |
| lastMercy | 1 | 1/0 | 8 | 6 |
| warmLitany | 1 | 1/0 | 8 | 6 |
| sharedFlame | 1 | 1/0 | 6 | 6 |
| frostCounter | 1 | 1/0 | 9 | 7 |
| fireCounter | 1 | 1/0 | 9 | 7 |
| lightningCounter | 1 | 1/0 | 11 | 7 |
| forceCounter | 1 | 1/0 | 11 | 7 |
| alterationCounter | 1 | 1/0 | 11 | 7 |
| illusionCounter | 1 | 1/0 | 9 | 7 |
| divineCounter | 1 | 1/0 | 9 | 7 |
| decayCounter | 1 | 1/0 | 9 | 7 |
| barrageCounter | 1 | 2/0 | 12 | 6 |
| sanctuaryCleanse | 1 | 1/0 | 8 | 6 |
| dreamHarvest | 1 | 1/0 | 8 | 6 |
| lucidRecovery | 1 | 1/0 | 8 | 6 |
| emberCovenant | 1 | 1/0 | 7 | 6 |
| shatterOpportunity | 1 | 1/0 | 7 | 6 |
| progression-lunar-aegis | 1 | 1/0 | 7 | 6 |
| progression-rime-mirror | 1 | 1/0 | 7 | 7 |
| progression-wellspring-sigil | 1 | 1/0 | 7 | 6 |
| progression-wellspring-sigil | 2 | 1/0 | 9 | 10 |
| progression-wellspring-sigil | 3 | 1/0 | 10 | 14 |
| progression-nightglass-reading | 1 | 1/0 | 7 | 6 |
| progression-firmament-ward | 1 | 1/0 | 7 | 6 |
| progression-ash-benediction | 1 | 1/0 | 7 | 6 |
| progression-blight-litany | 3 | 1/3 | 9 | 26 |
| progression-pallbearer-s-ward | 1 | 1/0 | 7 | 6 |
| progression-ossuary-cant | 1 | 1/0 | 7 | 6 |
| progression-pilgrim-s-shelter | 1 | 1/0 | 7 | 6 |
| progression-dawn-after-ash | 1 | 1/0 | 7 | 6 |

### Cards at 2 SP or more and 2 MP or more (10)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| cometFragment | 3 | 2/2 | 12 | 20.5 |
| starbladePhalanx | 3 | 2/2 | 12 | 22 |
| starShower | 3 | 2/2 | 12 | 23.5 |
| starstoneArc | 3 | 2/3 | 12 | 24 |
| meteorite | 2 | 2/2 | 12 | 19.5 |
| meteorSwarm | 2 | 2/2 | 12 | 18 |
| radiantSpray | 3 | 2/3 | 12 | 24 |
| starfallBeam | 2 | 2/2 | 12 | 19.5 |
| cinderSigil | 3 | 2/3 | 12 | 26 |
| ashenMote | 3 | 2/2 | 12 | 22 |
