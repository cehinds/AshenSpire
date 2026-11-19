# Arcane and Divine rules

Owner-approved rule change, 2026-11-18. This contract supersedes conflicting
earlier stat, spell and card-pool prose in SPEC.md.

- Wisdom governs Poise and Divine magic. Constitution governs Health, with the
  existing +5 HP per point; it no longer contributes to the new Poise rule.
- Intelligence governs Arcane magic. Arcane-only damage scales with INT,
  Divine-only damage with WIS. Shared spells use max(INT, WIS), never their sum.
- Fire, Earth, Lightning, Frost and unschooled raw magic carry both tradition
  tags. Force, Illusion and Alteration are Arcane. Divine and Decay/Necrotic are
  Divine. Schools remain distinct from traditions.
- A spell carrying only Arcane displays Arcane with its sigil; Divine-only
  displays Divine with its sun sigil; a shared spell displays Spell with both
  sigils. All remain spell-camp cards for costs, triggers and compatibility.
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
- Short attribute descriptions use benefit names without bonus amounts and
  omit multi-point traits: STR Physical damage; DEX Defense; CON Health;
  WIS Poise / Divine magic; INT Arcane magic. Hand growth remains threshold-based.

Acceptance: asymmetric INT/WIS damage probes for exclusive and shared schools;
Wisdom-only Poise growth at creation, allocation and live combat; saved-profile
compatibility; tags and both shared icons on actual card faces and inspection;
audited spell-role composition and seeded reward weighting; readable allocation
and spell cards at desktop and phone widths.
