# Ward to Block reference

Version 2 combat only. Spell protection splits its **base** budget into Block/Ward: default 30/70, Frost 50/50, Force and Alteration 70/30. Block rounds to the nearest integer and Ward retains the remainder. DR adds only to Block; PR adds only to Ward. Shared rating caps and status modifiers still apply.

For an uncapped base budget 5:

| School | Base total — Block:Ward | With DR 3 | With DR 3 and PR 3 |
| --- | --- | --- | --- |
| Default | 5 — 2:3 | 5 + 3 = 8 — 5:3 | 5 + 3 + 3 = 11 — 5:6 |
| Frost | 5 — 3:2 | 5 + 3 = 8 — 6:2 | 5 + 3 + 3 = 11 — 6:5 |
| Force / Alteration | 5 — 4:1 | 5 + 3 = 8 — 7:1 | 5 + 3 + 3 = 11 — 7:4 |

Defense range defaults to **ranged**, covering melee, reach and ranged incoming contacts. Counter camp and single/area restrictions remain intact. Existing Block pools are not range restricted. The counter's offensive range remains separate.

## Spell counters

All listed cards are **Stance — Counter** with offensive range **reach** and defensive range **ranged**. Their default return HP is zero: PR does not invent HP damage or increase pressure. Authored pressure below precedes Counterstrike, Impact, Flux and matchup modifiers.

| Card | Incoming camp | Targeting | Authored HP / Poise / Ward |
| --- | --- | --- | --- |
| Fire Counter | Spell | Single | 0 / 0 / 2 |
| Lightning Counter | Spell | Single | 0 / 0 / 2 |
| Divine Counter | Spell | Single | 0 / 0 / 2 |
| Decay Counter | Spell | Single | 0 / 0 / 2 |
| Frost Counter | Physical, spell | Single | 0 / 1 / 2 |
| Force Counter | Physical | Single | 0 / 3 / 0 |
| Alteration Counter | Physical, spell | Single | 0 / 1 / 1 |
| Illusion Counter | Physical, spell | Single | 0 / 1 / 1 |
| Barrage Interception | Physical, spell | Area | 0 / 1 / 1 |
| Umbral Ward | Physical, spell | Single | 0 / 1 / 3 |
| Warding Star | Spell | Single | 0 / 0 / 2 |
| Rime Mirror | Physical, spell | Single | 0 / 1 / 2 |

Counterstrike adds at least one to each positive authored return lane (50%, or 75% against Attack/Smash). Impact and Flux can then double their respective pressure lanes. Barrage Interception has no Counterstrike. School edges and projectile exclusions can further alter the return.

Spell-counter HP payloads, when present, use PR for physical and magical damage types. Physical-camp counter rules remain unchanged.

Each returned group checks offensive range, then one Accuracy roll against base Evasion, then existing avoidance. A failure suppresses HP, Poise, Ward and accepted status payloads together. Range and Accuracy misses do not spend prepared Evade charges. Pressure-only returns can be evaded, using combined Poise/Ward pressure as the incoming threat when HP is zero.

Base Evasion uses an explicit entity rating when available, otherwise armor/DEX and equipped buckler rules for the target's seat. Prepared Evade/card bonuses are separate. Approved starter armor mappings and enemy defaults are in `counterReturnRules.js`; unknown armor falls back to Cloth.

## Reaction and Evade

All Counter and Evade cards retain Reaction. Every Defense stance with actual rank at least 1 has Reaction. Every Sweep stance with actual rank at least 2 has Reaction; lower ranks do not gain it. Sweeps resolve before the incoming root and may interrupt by killing, staggering or controlling its attacker. Ordinary Sweep damage resumes the root. Graded cards use ability rank rather than display tier.

| Evade card | Type | Charges / bonus per play | Condition |
| --- | --- | --- | --- |
| Evasive Guard | Stance — Evade | 1 / +0 | None |
| Dodge Roll | Stance — Evade | 1 / +0 | None |
| Quickstep | Stance — Evade | 1 / +0 | None |
| Backstep | Stance — Evade | 1 / +0 | None |
| Acrobatics | Stance — Evade | 1 / +0 | None |
| Shadowstep | Stance — Evade | 1 / +0 | None |
| Nightstep | Stance — Evade | 1 / +0 | None |
| Crawling Shot | Stance — Evade | 1 / +0, Advantage | Prone at play |

Playing during the player turn and playing as a Reaction use the same ratings, prepared charges, bonuses and expiration. This change does not add rank-based Evade charges or overhaul stacking. Prepared Evade uses the existing d20 attribute/armor check; Distance stance avoidance remains separate.

## Card taxonomy

Public categories are **Stance, Skill, Power and Consumable**. System Status/Curse cards remain separate compatibility categories. Legacy authored attack/skill kinds remain unchanged internally and in saved state; the shared model exposes `cardCategory`, `stanceType` and `stanceGroups`.

Stance subtypes are Smash, Attack, Sweep, Counter, Defense and Evade. Attack/Smash are Offense; Defense/Evade are Defensive; Counter is both. Sweep is Offense and becomes Defensive at actual rank 2 (or when explicitly authored defensive-capable). Power/Consumable identity takes precedence over incidental maneuver tags. Spell is a camp/ability identity, not a primary card category; ability rank and Weapon Art labels remain available separately.
