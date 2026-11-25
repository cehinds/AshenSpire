# Stat descriptions and allocation

Owner-confirmed on 2026-11-18. This records the original Core allocation
contract, including the four-point cadence in saves made under those rules.
The owner confirmed per-point Stamina, Mana, and hand tuning for new profiles
on 2026-11-24. See the current Core stat rules in [SPEC.md](../../SPEC.md).

| Attribute | Benefits |
| --- | --- |
| Strength | Physical damage |
| Dexterity | Block and maximum Stamina |
| Constitution | Maximum Health only |
| Wisdom | Divine magic, maximum Mana and Poise |
| Intelligence | Arcane magic and hand size |

Each Strength point adds to physical damage; each Dexterity point adds to Block.
Each Constitution point grants 5 maximum HP. Wisdom grants 1 Poise per point.
Stamina, Mana and hand size each increase by 1 per four points of their governing
attribute. The starting hand is 5 + floor(INT / 4). Shared elemental spells use
the higher of INT and WIS, never their sum.

Spell traditions follow the approved Arcane/Divine contract: Force, Illusion and
Alteration are Arcane; Divine and Decay/Necrotic are Divine; Fire, Earth,
Lightning, Frost and unschooled magic are shared.

Compact attribute faces name per-point benefits without numeric badges. Expanded
details explain all benefits, including the four-point resource thresholds, and
retain the exact formulas used by the character. Damage channels are described
as physical damage, Block and magic rather than AR, DR or PR stats.

The allocation preview and committed allocation must agree. Saved pools, Poise
and hand growth retain their snapshotted ownership and cadence. Damage channels
retain Dev's ruleset-8 policy: retired AR, DR and PR rows are ignored in favor of
the unit attribute channels. The casting-tradition version flag belongs to the
saved profile or fight; its absence retains the earlier magic selection rule.

This change covers stat scaling, descriptions and allocation presentation. It
does not change card pools, reward weighting or spell artwork.
