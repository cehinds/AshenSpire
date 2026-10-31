# Current profile Mana payoffs

The shared minimum charges spells and weapon arts at least one Mana. These
entry cards now buy a useful direct effect or a distinct setup effect. Prices
remain their previous resolved SP/MP pair, with only zero-Mana spells/arts
raised to the shared minimum. Higher-grade prices do not silently increase
again when the stronger effect enters the general cost-budget formula.

| Role | Authored entry payoff |
| --- | --- |
| Comet Fragment, Ashen Mote, Force Nudge, Holy Spark, Cinder Orbit, Blood Censer, Cinder Sigil, Shield Bash, Blight Touch | At least 8 damage |
| Ember Vigil, Lunar Aegis, Ash Benediction, Quickstep, Penance | At least 8 protection |
| Read the Ash, Scholar's Insight, Star Path | Draw at least 2 |
| Attune | Pay 1 Mana, restore 2: net +1 Mana |
| Ember Communion | Pay 1 Mana, restore 2 and heal 5; retains Exhaust |
| Transfusion, Urgent Heal | Heal 8; upgrades remain stronger |
| Warm Litany | Heal 5 and gain 5 Block |
| Rime Needle, Static Needle, Rot Mote | 6 damage and existing setup pressure |
| Drowsing Mote | 5 damage and existing Sleep pressure |

Combat v2 keeps its existing projections: spell protection becomes Barrier,
and Shield Bash retains its counter/Poise identity. The table names the source
payoff before these existing projections. Setup pressure, chances, upcast
increments, conditional riders, grade milestones and descriptive text tokens
keep their existing meaning.

`src/content/progression/lessons.js` and `cardFamilies.js` author complete paid
grade entries. Each includes its actual prior price and resolved effects,
including any previous 2-SP multiplier. `traits.costRule: 'fixed'` uses the
existing opt-out from formula repricing. This avoids both taxing the buff back
out of existence and applying the old multiplier a second time. Higher-grade
primary values never fall below their previous grade or their previous resolved
payoff. Unchanged recipes continue using their original shared builder.

Attune and Ember Communion deliberately use fixed one-Mana pricing. Generic
formula-priced restoration still funds its own price; these two paid spells
must not become a two-Mana, self-funded, zero-net restoration after the buff.
The real combat interpreter tests require one Mana to cast and verify a net
increase of one Mana.

## Current Smash comparison

The paired Reaver attack is Ember Hew **at the same ability grade**. Its
resolved damage is `[4, 6, 13, 18, 23, 31]` for SP `[1, 1, 2, 2, 3, 3]`.
Kick Off now deals `[6, 9, 20, 27, 35, 47]`; Breaker's Toll deals
`[11, 11, 22, 27, 35, 47]`. Both cost SP `[2, 2, 3, 3, 4, 4]`, MP zero,
and retain their existing Poise and advanced-grade riders. Each pays one more
SP and deals at least 1.5 times its same-grade attack. Breaker's existing
11-damage grade zero is retained and grade one raised to match it.

For the starting Reaver's greatsword, the equipment receipt is blade base 5 +
uncommon bonus 1 + AR 6 = **12 damage**, with the weapon's additional SP and
Poise modifier making its basic Smash cost **2 SP**. Sundering Hew buys a larger
payoff for **2 SP + 1 MP**: **36 damage**, upgraded **48**, with its previous
resolved Poise 5/7 and Vulnerable 1 retained (four Vulnerable buildup in combat
v2). The three-times comparison is for this starting equipment receipt; it is
not a universal promise after AR or weapon growth.

Other distinct rare, variable-damage and status-rich Smashes were inventoried
and retain their existing identities and prices. No broad multiplier or
post-resolution payoff override was added.
