# Element matrix, 2026-11-18 (proposal for owner approval)

Owner request: every element has advantages and disadvantages against other elements, and sometimes against stances, plus built-in properties (tags).

How it works, using existing tags only (the owner's principle: reference a tag, never re-bundle it):
- **Strong against X:** a hit on a target carrying X (its element affinity or an X status on it) applies or uses **X-Vulnerable**, so +25% damage. Stance advantages apply the same +25% against a target holding that stance.
- **Weak against Y:** the hit is treated as **Resisted**, so −25% damage.
- **Built-in tags:** these already exist in Core (`combatExpansionMatchups.json` tag riders, the `elements` block in `fixCoreMechanics.json`). The proposal keeps them and names them.

## Elemental cycle (Fire > Frost > Lightning > Earth > Fire)

| Element | Built-in tags | Strong against (+25%) | Weak against (−25%) | Stance interplay |
|---|---|---|---|---|
| **Fire** | Burn on hit; Spread (60% to an adjacent enemy); ignores some Poise | Frost (melts: also removes Chill); Poison/Venom (burns it off) | Earth (smothered) | Strong vs **Prepared** (casters in robes); Spread blocked by **Defend** |
| **Frost** | Chill (references Weak); 3 Chill = Frozen (references Staggered); Brittle (next hit ×1.5 → references Vulnerable) | Lightning (grounds the charge); Earth? *(no, Earth is Lightning's target; see note)* | Fire | Strong vs **Attack** and **Smash** stance (slows the aggressor) |
| **Lightning** | Shock (references Staggered chance and Lightning-Vulnerable); Chain (50% to a second enemy) | Earth? *(see note)* → **Metal**: targets with heavy or medium armour, or a shield | Frost | Strong vs **Defend** (arcs through Block: ignores 2 Block) |
| **Earth** | Slowed (references Staggered on its 2nd stack); +1 Poise damage | Fire (smothers); Lightning (grounds) | Frost? *(see note)* → **Force** | Strong vs **Evade** (Evade stacks don't dodge Earth); weak vs **Retreat** (no Reach) |

Note on the cycle: a clean four-way wheel is **Fire > Frost > Lightning > Earth > Fire**. That means:
- Fire beats Frost.
- Frost beats Lightning.
- Lightning beats Earth.
- Earth beats Fire.

Each element is weak to the one before it. The table above pulls in a few non-wheel advantages (Metal, Force) for flavour. If the owner prefers the strict wheel, use these rows instead:

| Element | Strong against | Weak against |
|---|---|---|
| Fire | Frost | Earth |
| Frost | Lightning | Fire |
| Lightning | Earth | Frost |
| Earth | Fire | Lightning |

## Spirit cycle (Holy > Necrotic > Psychic > Holy)

| Element | Built-in tags | Strong against (+25%) | Weak against (−25%) | Stance interplay |
|---|---|---|---|---|
| **Holy (Divine)** | Cleanse 1 on hit; heals (WIS); Smite (50% of the hit again on undead); undead ×1.5 (references Holy-Vulnerable on the undead tag) | Necrotic and undead | Psychic | Strong vs **Counter** (no return from a Holy hit) |
| **Necrotic** | Necrotic Blight (HP over time); ×0.7 base, buildup (INT); undead heal from it | Psychic; living targets (blocks healing for 1 turn) | Holy | Strong vs **Defend** (rot ignores 25% of Block) |
| **Psychic** | Confused (re-rolls hand costs); not reduced by armour | Holy (doubt); targets in **Prepared** stance | Necrotic | Strong vs **Counter** (Counter stacks −1 on hit) |

## Other elements

| Element | Built-in tags | Strong against | Weak against | Stance interplay |
|---|---|---|---|---|
| **Poison** | Venom (HP over time, bodily) | Living, unarmoured targets (robes) | Undead and constructs (immune); Fire burns it off | — |
| **Force** | Poise damage ×1.5; Push (Retreat stack on a crit or Smash) | Shields and heavy armour (ignores 2 Block) | Evade (whiffs) | Strong vs **Defend** |
| **Arcane (Magic)** | 50% magic share; Ward-first rules | Ward and Barrier (strips 1 Ward per hit) | Magic Vulnerable targets take more; the Resist Magic tag | Strong vs **Prepared** |

## Physical damage types

| Type | Built-in tags | Strong against | Weak against | Stance interplay |
|---|---|---|---|---|
| **Slashing** | Bleed on HP loss | Unarmoured and light armour | Heavy armour (−25%) | Sweeps get +1 target |
| **Piercing** | Pierce (bypasses up to 2 Block) | Medium armour (mail gaps); Retreat-stacked targets in Reach | Shields (Kite, Tower) | Strong vs **Defend** |
| **Blunt** | +Poise damage; Smash Vulnerable (hammers) | Heavy armour and shields | Unarmoured (−25%, nothing to crush) | Strong vs **Counter** (breaks the stance) |

## Open choices for the owner
1. Strict four-way wheel, or the flavoured table with extras (Metal, Force)?
2. Should advantages be +25% damage (Vulnerable size) for every element, or vary by element?
3. Should armour groups count as element targets (Lightning vs metal armour, Slashing vs robes)? This makes armour choice part of the element game.
