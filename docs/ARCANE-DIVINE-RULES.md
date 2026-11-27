# Arcane and Divine rules

Owner-approved rule change, 2026-11-18. This contract supersedes conflicting
earlier stat, spell and card-pool prose in SPEC.md.

- Wisdom governs Poise and Divine magic. Constitution governs Health, with the
  existing +5 HP per point; it no longer contributes to the new Poise rule.
- Intelligence governs Arcane magic. Arcane-only damage scales with INT,
  Divine-only damage with WIS. Shared spells use max(INT, WIS), never their sum.
- Fire, Earth, Lightning and Frost carry both tradition tags. Force, Illusion
  and Alteration are Arcane. Divine and Decay/Necrotic are Divine. Schools remain
  distinct from traditions.

## Spell categories (owner, 2026-11-20)

`SpellCategory(card)` (src/model/spellTraditions.js) answers one question:
`arcane`, `divine`, `shared` or `null`. `isSpellCard` stays the Spell test.
Every change below applies only under `spellTraditionsVersion: 1`; older saved
profiles keep their footer, damage and gear rules.

- One tradition is that category; both traditions are `shared`.
- A card with no school (no combat-profile, card, `school:*` or known damage
  school) and no authored `tradition:*` tag is a plain Spell: `null`. It takes
  Spell bonuses only, never Arcane or Divine ones, and still scales with
  max(INT, WIS). A profile stamps `tradition:*` tags on schooled Spells only
  (`CardTraditionTags`), so stamping never turns a plain Spell Shared. Arcane
  Spark (`core.cantrip`) authors both tags in Core's pack, so it is Shared.
- Every Arcane or Divine card is a Spell. The category adds benefits; it never
  takes Spell status away.
- Footer (`cardSigilsHtml`): the Spell mark, then the Arcane or Divine mark for
  those categories only, then a mirrored basic's mark. The word is Arcane,
  Divine, or Spell (Shared and plain). Shared and plain Spells show no tradition
  marks. The band keeps `data-traditions` and `data-mirror` and adds
  `data-spell-category` (`spell` for a plain Spell). Inspection lists the same
  marks in that order, then the school.
- Prepared's damage bonus (+25%) applies to every Spell played into a stance,
  never Attack's +20%, including a mirrored Strike, Smash or Sweep
  (`AttackDamageMultiplier`, src/engine/stanceBenefits.js). Mirrored Smash and
  Sweep spells keep Smash's Poise bonus and Sweep's splash. A Spell hit that
  enters no stance (an enemy spell move, a raw carrier) still reads the stance
  its source holds.
- Gear selectors `arcaneSpell` and `divineSpell`
  (content/source/equipmentTypes.json, key `spellCategory`) name their category
  plus Shared Spells. A profile without spell traditions drops them. On a Shared
  Spell the Arcane and Divine groups do not stack: per field (card stat, hit
  bonus, hit rider status), only the group with the larger total counts (by
  size, ties keep Arcane); every other selector (`spell`, `healSpell`, ...) adds
  on top (`GearCategoryOverlap`, src/model/gearEffects.js).
- Elemental attribute-dependent riders follow their casting tradition:
  shared Fire bypass/Burn, Lightning Shock and Frost Chill read max(INT, WIS);
  Divine healing/cleansing and Necrotic buildup read WIS. Fixed card buffs,
  durations and costs retain authored values.
- Divine content targets three support cards for each damage card (75% support).
  Arcane targets two offensive cards for each support card (two-thirds offense).
  A card has one primary pool role; damage and damaging status pressure count
  as offense, while buffs, debuffs, healing, cleansing and utility count as support.
  Shared cards belong to both eligible traditions; each tradition's reward
  weighting normalizes its eligible role groups to the authored ratio.
- New spell rewards follow the character's higher effective casting attribute;
  ties use the class's tradition (Starseer Arcane, Herald Divine; Arcane for
  other tied classes). Shared spells remain eligible for either. A changed
  focus affects future rolls only; owned cards and previously rolled offers
  remain playable/claimable.
- New defaults are versioned in the profile's FixCore rules. Already-saved
  profiles keep their original combat scaling and stat snapshots; existing
  card IDs, decks and earned offers remain loadable. No saved run is discarded
  or silently repriced to implement these rules.
- Reward eligibility and role weighting have their own profile marker,
  `effects.spellRewardPolicyVersion: 1`. Profiles that already shipped casting
  traditions without this marker keep their original reward policy.
- Short attribute descriptions use benefit names without bonus amounts and
  omit multi-point traits: STR Physical damage; DEX Defense; CON Health;
  WIS Poise / Divine magic; INT Arcane magic. Hand growth remains threshold-based.

Acceptance: asymmetric INT/WIS damage probes for exclusive and shared schools;
Wisdom-only Poise growth at creation, allocation and live combat; saved-profile
compatibility; tags and category marks on actual card faces and inspection;
audited spell-role composition and seeded reward weighting; readable allocation
and spell cards at desktop and phone widths.
