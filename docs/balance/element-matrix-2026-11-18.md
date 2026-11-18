# Element matrix, 2026-11-18 (proposal for owner approval)

Owner request: every element has advantages and disadvantages against other elements, and sometimes against stances, plus built-in properties (tags).

How it works, using existing tags only (the owner's principle: reference a tag, never re-bundle it):
- **Strong against X:** a hit on a target carrying X (its element affinity or an X status on it) applies or uses **X-Vulnerable**, so +25% damage. Stance advantages apply the same +25% against a target holding that stance.
- **Weak against Y:** the hit is treated as **Resisted**, so −25% damage.
- **Built-in tags:** these already exist in Core (`combatExpansionMatchups.json` tag riders, the `elements` block in `fixCoreMechanics.json`). The proposal keeps them and names them.

## Elemental cycle (Fire > Frost > Lightning > Earth > Fire)

| Element | Built-in tags | Strong against (+25%) | Weak against (−25%) | Stance interplay |
|---|---|---|---|---|
| **Fire** | Burn on hit; Spread (60% to an adjacent enemy); ignores some Poise | **Frost** (melts: also removes Chill); Poison (burns off Venom) | **Earth** (smothered) | Strong vs **Prepared** (casters in robes); Spread is blocked by **Defend** |
| **Frost** | Chill (references Weak); 3 Chill = Frozen (references Staggered); Brittle (references Vulnerable) | **Lightning** (grounds the charge) | **Fire** | Strong vs **Attack** and **Smash** stance (slows the aggressor) |
| **Lightning** | Shock (references Staggered chance and Lightning-Vulnerable); Chain (50% to a second enemy); **Pierce** built in (owner), except against Block from Earth sources, which Stone Skin reduces | **Earth**; metal targets (medium or heavy armour, shields) | **Frost** | Strong vs **Defend** (arcs through Block: ignores 2 Block) |
| **Earth** | Slowed (2nd stack references Staggered); +1 Poise damage; Earth Defend cards grant **Stone Skin** (owner: each stack reduces Pierce damage by 1; most Earth Defend cards give 3+ stacks) | **Fire** (smothers) | **Lightning** | Strong vs **Evade** (Evade stacks don't dodge Earth) |

The wheel runs **Fire > Frost > Lightning > Earth > Fire**: each element beats the next and loses to the one before. Two flavour extras sit on top: Fire also beats Poison, and Lightning also beats metal armour.

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
| **Force** (tag, not a school; green; Alteration casts it most) | Physical damage, so it hits Block first, even from a spell; after Block, half of the damage goes to Poise instead of 25%; no built-in Retreat (owner) | Shields and heavy armour (ignores 2 Block) | Evade (whiffs) | Strong vs **Defend** |
| **Arcane (Magic)** | 50% magic share; Ward-first rules | Ward and Barrier (strips 1 Ward per hit) | Magic Vulnerable targets take more; the Resist Magic tag | Strong vs **Prepared** |

## Physical damage types

| Type | Built-in tags | Strong against | Weak against | Stance interplay |
|---|---|---|---|---|
| **Slashing** | Bleed on HP loss | Unarmoured and light armour | Heavy armour (−25%) | Sweeps get +1 target |
| **Piercing** | Pierce (bypasses up to 2 Block) | Medium armour (mail gaps); Retreat-stacked targets in Reach | Shields (Kite, Tower) | Strong vs **Defend** |
| **Blunt** | +Poise damage; Smash Vulnerable (hammers) | Heavy armour and shields | Unarmoured (−25%, nothing to crush) | Strong vs **Counter** (breaks the stance) |

## Stone Skin (new tag, owner 2026-11-18)
- Each stack reduces Pierce damage by 1, from Lightning's built-in Pierce or any Pierce source.
- Most Earth Defend cards grant 3 or more stacks.
- Lightning's built-in Pierce does not bypass Block that came from an Earth source.
- Stone Skin decays like Block, at the start of its owner's turn. *(decided)*

## Open choices for the owner
1. Keep the flavour extras (Fire vs Poison, Lightning vs metal), or use the strict wheel only?
2. Should advantages be +25% damage (Vulnerable size) for every element, or vary by element?
3. Should armour groups count as element targets (Lightning vs metal armour, Slashing vs robes)? This makes armour choice part of the element game.
