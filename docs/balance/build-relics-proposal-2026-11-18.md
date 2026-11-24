# Build-variety relics, 2026-11-18 (approved by the owner)

Owner: add relics that use the game's many tags and effects, so more builds are viable. There are 79 relics today (69 in relics.json, 10 progression). Each relic below references existing tags only (owner principle: reference a tag, never re-bundle it). Each pushes one archetype, and most connect two tags so builds cross over. Before building, a worker checks these against the 79 existing relics' effects and drops duplicates.

## Stance and maneuver builds

| Relic | Rarity | Effect | Build |
|---|---|---|---|
| Duelist's Knot | common | The first Counter each turn returns +2 damage | Counter |
| Mirror Shard | uncommon | When a Counter triggers, gain 1 Reflect | Counter into Reflect |
| Dancer's Anklet | common | Gain 1 Evade the first time you change stance each turn | Stance dancing |
| Shadowstep Sash | uncommon | When you Evade a hit, your next attack this turn costs 1 less SP | Evade |
| Breaker's Gauntlet | uncommon | Smashes deal +2 Poise damage; a Smash that breaks Poise refunds 1 SP | Smash |
| Reaper's Ring | uncommon | Sweeps apply 1 Weak to each target hit | Sweep |
| Patient Blade | rare | Each turn you end in Defend stance, your next attack gains +1 Pierce | Defend into Pierce |
| Prepared Mind | uncommon | Starting a turn in Prepared stance draws 1 card | Caster stance |

## Defence builds (Ward, Block, Stone Skin, Fortified, Thorns)

| Relic | Rarity | Effect | Build |
|---|---|---|---|
| Runed Bracer | uncommon | Your Ward cards also grant 2 Block | Ward |
| Shattered Aegis | rare | When your Ward breaks, deal 5 damage to every enemy | Ward break |
| Granite Heart | uncommon | Earth Defend cards grant +1 Stone Skin | Earth defence |
| Bulwark Seal | uncommon | Whenever Block absorbs a whole hit, gain 1 Fortified | Block |
| Briar Crown | common | Thorns 1; +1 more Thorns while Fortified | Thorns |
| Unyielding Plate | rare | Poise damage you take is reduced by 1 per hit (minimum 1) | Poise tank |

## Status and element builds

| Relic | Rarity | Effect | Build |
|---|---|---|---|
| Hemorrhage Hook | common | Bleed on an enemy deals +1 damage per tick | Bleed |
| Tinderbox | common | The first Burn you apply each turn applies +1 stack | Burn |
| Frostbitten Charm | uncommon | Frozen enemies take +25% damage (references Frost-Vulnerable) | Frost |
| Storm Rod | uncommon | When a Shock triggers, Chain 2 damage to another enemy | Lightning |
| Rotting Censer | uncommon | Blight stacks don't decay on enemies below half HP | Necrotic |
| Gale Totem | uncommon | Force hits that empty an enemy's Poise apply 1 Retreat stack | Force into Retreat |
| Prism of Elements | rare | Hitting an enemy with a second different element in one turn applies that element's Vulnerable | Mixed elements |
| Confounding Mask | uncommon | Confused enemies have a 25% chance to target another enemy | Confuse |
| Venom Gland | common | Poison applied to an enemy with Bleed applies +1 stack | Poison and Bleed |

## Card-flow builds (Exhaust, Retain, Reaction, Escalating, drawbacks)

| Relic | Rarity | Effect | Build |
|---|---|---|---|
| Ashen Urn | uncommon | When a card Exhausts, gain 1 Block per its cost | Exhaust |
| Patience Stone | common | Retained cards cost 1 less the next turn (minimum 0) | Retain |
| Quickdraw Holster | uncommon | Your first Reaction each enemy turn costs 0 | Reaction |
| Momentum Engine | rare | Escalating cards also gain +1 damage each time they're played | Escalating |
| Penitent's Chain | uncommon | When you play a card with a drawback (Drained, Reckless, Wound or self-Staggered), draw 1 card | Drawback decks |
| Bloodletter's Bowl | rare | When you take damage from your own card, gain 1 STR this fight | Self-damage |

## Range and multi-hit builds (Reach, Retreat, Multi-hit, Pierce)

| Relic | Rarity | Effect | Build |
|---|---|---|---|
| Fletcher's Kit | common | Reach attacks against a Retreat-stacked enemy deal +2 | Bow and Reach |
| Tide Anchor | uncommon | When an enemy loses its last Retreat stack, it is Weak 1 | Retreat control |
| Whirling Bangle | uncommon | Multi-hit attacks apply their status riders only on the first hit but deal +1 per hit | Multi-hit |
| Awl of Piercing | uncommon | +1 Pierce on attacks that cost 0 | Dagger and Pierce |

## Owner decisions (2026-11-18)
1. All 33 relics are approved. A worker checks them against the 79 existing relics and drops duplicates before building; tuning comes later.
2. Class-weighted: relics tagged to a class's builds appear 75% of the time for that class.
3. Rare build relics use normal rare relic odds. Only the map removal and conversion relics are super rare.
4. Build order: after PR #2835, chore/ForceWardRules and the gear passes merge, since many of these relics read Ward, Stone Skin, Force, Pierce and Retreat stacks.
