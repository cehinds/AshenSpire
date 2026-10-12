# Card cost weights

Status: shipped tunables (owner decisions, 2026-10-12). The rule is SPEC §4.3a;
the numbers live in `src/content/actionCosts.js`, and
`tests/action-costs-weights-doc.test.mjs` fails when this file and that one
disagree. Change a number there and here in the same commit.

## The formula

Each resource is priced on its own side (the owner set this shape):

- **S_sp** = damageWeight × physical damage + rankWeight × rank + Σ SP-side tag
  weights + range weight + castingEffort (on a cast card) + SP-side statuses +
  restoreWeight × Mana restored + drawback weights (negative).
- **S_mp** = damageWeight × magical damage + Σ MP-side tag weights + MP-side
  statuses + restoreWeight × Stamina restored.
- **SP** = floor(S_sp / spDivisor), **MP** = floor(S_mp / mpDivisor). Each side
  is floored at 0 first.
- If both are 0, the larger side pays 1 (SP on a tie).

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
| `mpDivisor` | 6 | P. A school (3) and the spell camp (3) make 6, so every spell pays at least 1 MP; strong spells pay 2. |
| `damageWeight` | 1.5 | Points per damage step. Real card damage runs 2–40, far above the owner's example of 3; raw damage priced every big hit at 3–7 SP. |
| `damageSteps` | 1, 3, 5, 8, 12 | The damage thresholds: 3 damage is 2 steps (3 points), a 6-damage strike 3 steps (4.5), anything from 12 up 5 steps (7.5). |
| `rankWeight` | 1 | Points per rank above the base, SP side. Larger values push rank 1–2 cards to 3 SP. |
| `castingEffortWeight` | 6 | SP-side points on every cast card: a spell costs 1 SP unless it carries a drawback. |
| `restoreWeight` | 1 | Points per Mana restored (SP side) or Stamina restored (MP side). |
| `twoCostMultiplier` | 1.8 | The owner's provisional 2-cost buff, applied at 2 SP or more. |
| `statusWeight` | 2 | The owner's floor for a status. |
| `statusStackCap` | 1 | Stacks above this count as this many. At 2 or more, stacked bleed and charge cards jump a full SP. |

## Calibration

Every priced card, resolved at owner ranks 0–3 (ability grades at grades 0–3,
legacy cards at instance ranks 1–3), 880 faces in all. With D fixed at 6 the
script searched P, damageWeight, eight damage step tables, rankWeight,
castingEffortWeight, the stack cap and the weights of the smash and sweep,
heavy, cleave, counter, ranged, physical and magical damage type, school, camp
and weapon tags (coordinate descent from 250 random starts, then a hand scan of
P and the school weight), keeping the owner's shape. Targets are the owner's
words of 2026-10-12.

| Target | Measured as | Faces | Hit rate |
|---|---|---|---|
| Most basic cards cost 1 Stamina | rank 0, physical, not smash or sweep: 1 SP / 0 MP | 113 | 90.3% |
| Most cantrips cost 1 Stamina | rank 0, magical: 1 SP, at most 1 MP | 134 | 78.4% |
| (the same, Stamina only) | rank 0, magical: 1 SP / 0 MP | 134 | 0% |
| Smashes and sweeps cost 2 | rank 0, smash or sweep: 2 SP | 19 | 73.7% |
| Rank 1–2 cost 1 SP + 1 MP, or 2 SP, some only one | rank 1–2: 1/1, 2/0, 1/0 or 0/1 | 532 | 83.3% |
| (of those, a total of 2) | rank 1–2: SP + MP = 2 | 532 | 49.8% |
| Most rank 1–3 spells cost 1–2 Mana | rank 1–3, magical: 1–2 MP | 310 | 100% |
| Many magic cards cost at least 1 SP; 0-SP magic still possible | magical: SP ≥ 1 | 444 | 96.6% |
| Higher SP usually means lower MP | not both SP ≥ 2 and MP ≥ 2 | 880 | 98.9% |

Smashes and cantrips miss 80%. Five of the 19 rank-0 smashes and sweeps fall
outside 2 SP whatever the weights: a light smash (Shield Bash, Bashing Blow)
sums 10, short of 12, a heavy one (Ruinous Blow) passes 18, and Kick Off
(Exhaust) and Shield Crash (formula damage) sum 6. A tag weight cannot pass 3,
so the smash tag cannot close the gap alone.

**The cantrip conflict.** Within the owner's shape the rank counts on the SP
side only, so a spell's MP barely moves with rank: a legacy spell's S_mp is the
same at every rank, and a grade's grows only with its effects. A cantrip at
1 SP / 0 MP and the same spell at 1–2 MP from rank 1 cannot both hold. The
shipped tunables choose the Mana side: every spell pays Mana, and a cantrip
costs 1 SP + 1 MP (23 of them 2 MP). Counting the rank on the Mana side of a
magical card reached 82% strict cantrips and 87% rank 1–3 spells in an earlier
search (at D 4); that is a change to the shape, left to the owner.

Distribution (SP/MP: faces):

| Rank | Physical | Magical |
|---|---|---|
| 0 | 1/0: 106, 2/0: 24, 3/0: 2 | 1/1: 105, 1/2: 19, 0/1: 6, 0/2: 4 |
| 1 | 1/0: 99, 2/0: 28, 3/0: 5 | 1/1: 102, 1/2: 28, 0/1: 2, 0/2: 2 |
| 2 | 1/0: 78, 2/0: 44, 3/0: 10 | 1/1: 89, 1/2: 41, 2/2: 3, 0/1: 1 |
| 3 | 2/0: 17, 1/0: 17, 3/0: 6 | 1/1: 20, 1/2: 15, 2/2: 7 |

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
| `damage:slashing` | 0 | SP | A physical damage type; the damage steps price the hit, so 0. |
| `damage:piercing` | 0 | SP | As slashing. |
| `damage:blunt` | 0 | SP | As slashing. |
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
| `camp:spell` | 3 | MP | A spell carries a Mana price of its own: 3, so with its school (3) every spell reaches 1 MP. |
| `source:weapon` | 0 | SP | Where the action comes from, not how strong it is. |
| `source:spell` | 0 | MP | Marks the card magical; no weight of its own. |
| `source:unarmed` | 0 | SP | As source:weapon. |

### Maneuvers and counter modes

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `maneuver:attack` | 0 | SP | The plain action: the base price, nothing on top. |
| `maneuver:defend` | 0 | SP | The plain guard: the base price, nothing on top. |
| `maneuver:ranged` | 1 | SP | A ranged shot: the range weight prices the reach; 1 for the aimed shot itself. |
| `maneuver:counter` | 0 | SP | A counter is priced by its reply damage and its technique; at 0 the elemental counters stay at 1 SP. |
| `maneuver:smash` | 3 | SP | The owner wants smashes at 2 SP: the largest tag weight, 3. |
| `maneuver:sweep` | 3 | SP | The owner wants sweeps at 2 SP: as smash, 3. |
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
| `school:fire` | 3 | MP | A school is the magic itself: 3, half the Mana price of a spell. |
| `school:frost` | 3 | MP | As fire. |
| `school:lightning` | 3 | MP | As fire. |
| `school:force` | 3 | MP | As fire. |
| `school:alteration` | 3 | MP | As fire. |
| `school:illusion` | 3 | MP | As fire. |
| `school:divine` | 3 | MP | As fire. |
| `school:decay` | 3 | MP | As fire. |

### Weapon and archetype chips

| Tag | Weight | Side | Reason |
|---|---|---|---|
| `blade` | 1 | SP | An edged weapon: 1. |
| `heavy` | 2 | SP | A heavy weapon: 2, so a heavy blow leans toward 2 SP. |
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
| `technique:heavy` | 2 | SP | A committed heavy technique: 2, as heavy. |
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
| `lifecycle.ethereal` | 0 | SP | Not in the owner's drawback list; left at 0 (open question). |
| `lifecycle.recall` | 1 | SP | Returns to hand: 1. |
| `lifecycle.recall.afterUse` | 1 | SP | As recall. |
| `lifecycle.recall.afterTurnDraw` | 1 | SP | As recall. |
| `lifecycle.recall.afterCardPlay` | 1 | SP | As recall. |
| `lifecycle.seal` | 0 | SP | A lifecycle marker, not power. |

### Drawbacks

| Tag | Weight | Side | Reason |
|---|---|---|---|
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

Every status a card applies (applyStatus, or buildup as one stack) weighs 2 (owner: statuses weigh 2 or more), times its stacks up to the stack cap. It counts on the card's side: MP on a magical card, else SP.

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

Every face that misses its target at the shipped tunables, with its sums. The
rank is the owner rank (0 = base).

Why the main groups miss:

- **Basics at 2 SP**: ranged attacks (range 3) and Rogue finishers whose damage
  and status reach 12. Both are priced up by weights the owner set.
- **Cantrips**: big rank-0 spells at 1/2 (Meteorite, Starfall Beam, the fire
  rites), and blood spells whose HP cost leaves 0 SP (the owner's "0 SP magic
  cards still possible").
- **Smashes**: see the calibration note above.
- **Rank 1–2**: spells at 1 SP + 2 MP, and smashes, sweeps and long-range shots
  climbing to 3 SP.
- **Both sides 2 or more**: a few rank 2–3 fire and astral spells.

### Basic cards at rank 0 that are not 1 SP / 0 MP (11)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| impale | 0 | 2/0 | 12 | 0 |
| executioner | 0 | 2/0 | 13.5 | 0 |
| ambush | 0 | 2/0 | 13.5 | 0 |
| serratedShiv | 0 | 2/0 | 12.5 | 0 |
| coupDeGrace | 0 | 2/0 | 13.5 | 0 |
| assassinate | 0 | 2/0 | 12.5 | 0 |
| deathblow | 0 | 2/0 | 13.5 | 0 |
| pinningShot | 0 | 2/0 | 13.5 | 0 |
| aimedShot | 0 | 3/0 | 18.5 | 0 |
| barbedArrow | 0 | 2/0 | 13.5 | 0 |
| katanaDrawCut | 0 | 2/0 | 12 | 0 |

### Cantrips (rank-0 magic) that are not 1 SP with at most 1 MP (29)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| starstonePebble | 0 | 1/2 | 9 | 14 |
| starSlicer | 0 | 1/2 | 7 | 15.5 |
| starlance | 0 | 1/2 | 9 | 15.5 |
| moonrendCut | 0 | 1/2 | 7 | 14 |
| meteorite | 0 | 1/2 | 10 | 15.5 |
| meteorSwarm | 0 | 1/2 | 10 | 14 |
| astralCleave | 0 | 1/2 | 7 | 15.5 |
| starstoneKris | 0 | 1/2 | 7 | 14 |
| starfallBeam | 0 | 1/2 | 10 | 15.5 |
| celestialLance | 0 | 1/2 | 9 | 15.5 |
| starSpark | 0 | 1/2 | 9 | 14.5 |
| pyreOfCharts | 0 | 1/2 | 9 | 14.5 |
| kindledOmen | 0 | 1/2 | 7 | 12 |
| cinderLance | 0 | 1/2 | 9 | 17.5 |
| ashfallRite | 0 | 1/2 | 8 | 16 |
| pyreLight | 0 | 1/2 | 8 | 15.5 |
| flagellation | 0 | 0/2 | 5 | 12 |
| cullTheWeak | 0 | 1/2 | 6 | 12 |
| martyrBlood | 0 | 0/1 | 3 | 8 |
| plagueBearer | 0 | 1/2 | 6 | 12.5 |
| exsanguinate | 0 | 0/2 | 4 | 13.5 |
| butterflyPlague | 0 | 0/1 | 4 | 8 |
| bloodOfferingRite | 0 | 0/2 | 4 | 13.5 |
| blightwardLash | 0 | 0/2 | 5 | 12.5 |
| transmute | 0 | 0/1 | 5 | 8 |
| sharedFlame | 0 | 0/1 | 5 | 6 |
| ashOath | 0 | 0/1 | 5 | 10 |
| vesperWard | 0 | 0/1 | 5 | 8 |
| emberDart | 0 | 1/2 | 8 | 12.5 |

### Smashes and sweeps at rank 0 that are not 2 SP (5)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| shieldBash | 0 | 1/0 | 10 | 0 |
| kickOff | 0 | 1/0 | 6.5 | 0 |
| ruinousBlow | 0 | 3/0 | 18.5 | 0 |
| shieldCrash | 0 | 1/0 | 6 | 0 |
| bashingBlow | 0 | 1/0 | 10.5 | 0 |

### Rank 1-2 cards outside 1/1, 2/0, 1/0 or 0/1 (89)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| crimsonCleave | 2 | 3/0 | 19 | 0 |
| ruinousBlow | 1 | 3/0 | 19.5 | 0 |
| ruinousBlow | 2 | 3/0 | 20.5 | 0 |
| poiseBreaker | 1 | 3/0 | 18 | 0 |
| poiseBreaker | 2 | 3/0 | 19 | 0 |
| sunderplate | 2 | 3/0 | 18 | 0 |
| sunderingChop | 1 | 3/0 | 18 | 0 |
| sunderingChop | 2 | 3/0 | 19 | 0 |
| starstonePebble | 1 | 1/2 | 10 | 14 |
| starstonePebble | 2 | 1/2 | 11 | 14 |
| starbladePhalanx | 2 | 1/2 | 11 | 14 |
| starShower | 1 | 1/2 | 10 | 12 |
| starShower | 2 | 1/2 | 11 | 15.5 |
| starSlicer | 1 | 1/2 | 8 | 15.5 |
| starSlicer | 2 | 1/2 | 9 | 15.5 |
| starlance | 1 | 1/2 | 10 | 15.5 |
| starlance | 2 | 1/2 | 11 | 15.5 |
| frostNova | 2 | 1/2 | 8 | 15 |
| starstoneArc | 2 | 1/2 | 11 | 14.5 |
| moonrendCut | 1 | 1/2 | 8 | 14 |
| moonrendCut | 2 | 1/2 | 9 | 14 |
| meteorite | 1 | 1/2 | 11 | 15.5 |
| meteorite | 2 | 2/2 | 12 | 15.5 |
| meteorSwarm | 1 | 1/2 | 11 | 14 |
| meteorSwarm | 2 | 2/2 | 12 | 14 |
| gravityWell | 2 | 1/2 | 9 | 12 |
| astralCleave | 1 | 1/2 | 8 | 15.5 |
| astralCleave | 2 | 1/2 | 9 | 15.5 |
| radiantSpray | 2 | 1/2 | 11 | 16 |
| starstoneKris | 1 | 1/2 | 8 | 14 |
| starstoneKris | 2 | 1/2 | 9 | 14 |
| starfallBeam | 1 | 1/2 | 11 | 15.5 |
| starfallBeam | 2 | 2/2 | 12 | 15.5 |
| celestialLance | 1 | 1/2 | 10 | 15.5 |
| celestialLance | 2 | 1/2 | 11 | 15.5 |
| starSpark | 1 | 1/2 | 10 | 14.5 |
| starSpark | 2 | 1/2 | 11 | 14.5 |
| cinderSigil | 2 | 1/2 | 11 | 14.5 |
| ashenMote | 2 | 1/2 | 11 | 14 |
| pyreOfCharts | 1 | 1/2 | 10 | 14.5 |
| pyreOfCharts | 2 | 1/2 | 11 | 14.5 |
| kindledOmen | 1 | 1/2 | 8 | 12 |
| kindledOmen | 2 | 1/2 | 9 | 12 |
| cinderLance | 1 | 1/2 | 10 | 17.5 |
| cinderLance | 2 | 1/2 | 11 | 17.5 |
| ashfallRite | 1 | 1/2 | 9 | 16 |
| ashfallRite | 2 | 1/2 | 10 | 16 |
| pyreLight | 1 | 1/2 | 9 | 15.5 |
| pyreLight | 2 | 1/2 | 10 | 15.5 |
| blightTouch | 2 | 1/2 | 9 | 12.5 |
| flagellation | 1 | 1/2 | 6 | 12 |
| flagellation | 2 | 1/2 | 7 | 12 |
| cullTheWeak | 1 | 1/2 | 7 | 12 |
| cullTheWeak | 2 | 1/2 | 8 | 12 |
| plagueBearer | 1 | 1/2 | 7 | 12.5 |
| plagueBearer | 2 | 1/2 | 8 | 12.5 |
| exsanguinate | 1 | 0/2 | 5 | 13.5 |
| exsanguinate | 2 | 1/2 | 6 | 13.5 |
| scourge | 2 | 1/2 | 10 | 12.5 |
| desperateRite | 2 | 1/2 | 8 | 13.5 |
| bloodOfferingRite | 1 | 0/2 | 5 | 13.5 |
| bloodOfferingRite | 2 | 1/2 | 6 | 13.5 |
| blightwardLash | 1 | 1/2 | 6 | 12.5 |
| blightwardLash | 2 | 1/2 | 7 | 12.5 |
| aimedShot | 1 | 3/0 | 19.5 | 0 |
| aimedShot | 2 | 3/0 | 20.5 | 0 |
| greatswordSunderingHew | 2 | 3/0 | 18.5 | 0 |
| colossusSmash | 1 | 3/0 | 18.5 | 0 |
| colossusSmash | 2 | 3/0 | 19.5 | 0 |
| kilnCleave | 2 | 3/0 | 18 | 0 |
| emberDart | 1 | 1/2 | 9 | 12.5 |
| emberDart | 2 | 1/2 | 10 | 12.5 |
| progression-ashen-cleaver | 2 | 3/0 | 18 | 0 |
| progression-cinder-orbit | 2 | 1/2 | 8 | 12 |
| progression-comet-needle | 1 | 1/2 | 8 | 12 |
| progression-comet-needle | 2 | 1/2 | 9 | 14 |
| progression-falling-constellation | 2 | 1/2 | 8 | 12 |
| progression-gravitic-knot | 1 | 1/2 | 7 | 12 |
| progression-gravitic-knot | 2 | 1/2 | 8 | 14 |
| progression-eclipse-lance | 1 | 1/2 | 8 | 12 |
| progression-eclipse-lance | 2 | 1/2 | 9 | 13.5 |
| progression-blood-censer | 2 | 1/2 | 6 | 12 |
| progression-blight-litany | 2 | 1/2 | 8 | 12.5 |
| progression-ember-tithe | 1 | 1/2 | 7 | 12 |
| progression-ember-tithe | 2 | 1/2 | 6 | 14 |
| progression-requiem-brand | 1 | 1/2 | 7 | 12 |
| progression-requiem-brand | 2 | 1/2 | 8 | 15.5 |
| progression-crown-of-scars | 1 | 1/2 | 7 | 12 |
| progression-crown-of-scars | 2 | 1/2 | 6 | 13.5 |

### Rank 1-3 spells outside 1-2 MP (0)

None.

### Cards at 2 SP or more and 2 MP or more (10)

| Card | Rank | SP/MP | S_sp | S_mp |
|---|---|---|---|---|
| cometFragment | 3 | 2/2 | 12 | 12.5 |
| starbladePhalanx | 3 | 2/2 | 12 | 14 |
| starShower | 3 | 2/2 | 12 | 15.5 |
| starstoneArc | 3 | 2/2 | 12 | 16 |
| meteorite | 2 | 2/2 | 12 | 15.5 |
| meteorSwarm | 2 | 2/2 | 12 | 14 |
| radiantSpray | 3 | 2/2 | 12 | 16 |
| starfallBeam | 2 | 2/2 | 12 | 15.5 |
| cinderSigil | 3 | 2/2 | 12 | 16 |
| ashenMote | 3 | 2/2 | 12 | 14 |
