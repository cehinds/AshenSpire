# Spell categories: Arcane and Divine

Owner brief, 2026-11-20. Rule for SPEC.md, *Stance discounts and spell cards*. All questions answered by the owner on 2026-11-20.

## 1. Every Arcane or Divine card is a Spell

- Each one carries the spell tag (`camp:spell`).
- It counts as a Spell for every rule: Prepared stance bonus (+25% damage), Magic Adept cut, successive-Spell Mana cut, Focus discount, Mana cost.
- The category adds benefits. It never takes away Spell status.

## 2. The school decides the category

| Category | Schools | Footer |
|---|---|---|
| Arcane only | Force, Alteration, Illusion | Spell mark + Arcane mark + "ARCANE" |
| Divine only | Divine, Decay (no Blight school, owner 2026-11-20) | Spell mark + Divine mark + "DIVINE" |
| Shared | Fire, Frost, Lightning, Earth | Spell mark + "SPELL" |

- A card with no school is a plain Spell, footer "SPELL" (owner, 2026-11-20). It gets "Spell" bonuses only, never Arcane or Divine ones, and scales with the higher of INT and WIS.
- Mirrored spells (sceptre/staff Strike, Ward, Channel; Arcane Spark) keep their basic card's mark and word, and take their category from their school, like any other Spell.

## 3. Scaling

- Arcane scales with INT.
- Divine scales with WIS.
- Shared scales with the higher of INT and WIS.

## 4. Role

- Arcane is best at damage.
- Divine is best at healing, buffs and debuffs.
- Each category also has a few cards in the other's role. These are weaker, rarer and cost more.
  - Example: Divine *Regen* heals 5, common, 1 MP. Arcane *Mend* heals 3, rare, 2 MP.
  - Rule: about 60% of the effect, +1 MP, one rarity tier higher (owner, 2026-11-20).

## 5. Targeted bonuses

| An effect that buffs… | Applies to |
|---|---|
| Spells | every Spell |
| Arcane spells | Arcane only + Shared |
| Divine spells | Divine only + Shared |

- A Shared card can draw on Arcane and Divine bonuses, but they do not stack: when both apply, only the larger one counts (owner, 2026-11-20). "Spell" bonuses still apply on top.

## 6. Implementation notes

- One predicate per question: `spellCategory(card)` returns `arcane`, `divine`, `shared` or `null`, and `isSpellCard` stays the Spell test. Bonuses read `category === X || category === 'shared'`.
- The school groups are data (content/source), not code.
- Prepared bonus: every Spell's damage takes Prepared's +25%, never Attack's +20%, even a mirrored spell that plays in Attack, Smash or Sweep stance (owner, 2026-11-20). In `AttackDamageMultiplier` (src/engine/stanceBenefits.js), a Spell carrier reads the `prepared` row; a non-Spell keeps reading its held stance.
  - Mirrored Smash and Sweep spells keep Smash's Poise bonus and Sweep's splash; only the damage multiplier changes.
- Footer: `cardSigilsHtml` (src/ui/components/combatSigilView.js) already draws two marks for mirrored spells. Arcane and Divine get the same two-mark shape.
- Arcane and Divine marks need new sigils in `ACTION_SIGILS` (src/content/combatSigils.js).