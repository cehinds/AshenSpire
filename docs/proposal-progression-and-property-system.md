# Proposal: progression, equipment-as-cards, and the property system

Status: proposal for owner review. Nothing here is shipped. Parent authority:
[SPEC.md](../SPEC.md) and [COMBAT-EQUIPMENT-RULES.md](COMBAT-EQUIPMENT-RULES.md).
Where this conflicts with either, this document is the proposed amendment and
the existing text remains normative until the owner accepts a section.

Origin: owner design session, 2026-09-11. The owner's direction is stated first
in each section; the rest is the accepted shape after discussion.

## A. Property system (foundation for everything below)

1. **New tag domain `property`.** Carriers: equipment, rune, class card, relic.
   Cards may not carry it. Theme and presentation tags still confer nothing
   (the "a Blood tag alone grants no Bleed" rule stands).
2. **New table `propertyRules`,** one row per property tag: `passives`,
   `triggers`, `textTemplate`, optional `requires` (other tags on the same
   carrier, class level, skill level) and `excludes`. Same passives/triggers
   shape relics use today. No free-text script; a property that needs
   `scripts.js` is the wrong abstraction.
3. **One mount path.** Carrier instance + resolved tag set → source-bound
   grants. Unmount on removal. This is the combat contract's source-ownership
   rule, reused rather than duplicated.
4. **Validation.** Every `property` tag has exactly one rule row; `requires` and
   `excludes` ids resolve; no cycles; a card carrying `property` fails with a
   named row.
5. **Relics become carriers.** Passives and triggers move off relic rows into
   rule rows; a relic is an id, art, rarity, and tagging rows. Step two of the
   migration, not step one.
6. **Tags are plain ids.** `siphon2` is a second row, never `siphon(2)`.
   Instance tag sets are persisted; definitions never are.

## B. Everything on the character is a card in a zone

7. **Zones:** `core` (class card, one slot), `worn` (body, head, hands, feet),
   `hands` (main, offhand), `passive` (relics), and the draw pile. Core, worn,
   and passive never enter the draw pile.
8. **Equipment rows become cards** with a slot type. Weapon group and armor
   group are tags in the existing domains.
9. **Sprite compositing:** core sets the base body, worn sets layers, main hand
   sets the pose family.
10. **Each slot owns one defense layer** so the loadout screen reads as which
    number you are changing:

    | Slot | Primary | Secondary |
    |---|---|---|
    | Body | Armor value, poise resistance | Weight |
    | Head | Typed resistance (one type) | Small armor |
    | Hands | Impact dealt, grip eligibility | Buildup dealt |
    | Feet | Evade charges, weight offset | Stamina recovery |
    | Offhand shield | Block per turn, poise resistance | Armor |

11. **Class card is identity only:** id, name, art anchors, kit list, favored
    groups, attribute preset. All behavior is property tags on the card. The
    kit contains the starting weapon, the class ability card, and the relic
    carrier. The class card does not grant a weapon group; it grants a
    `favored<Group>` property (a `skillXpMult` modifier scoped to that group).
12. **Class ability card and relic per class.** Rule: the ability card teaches
    the class's resource loop in one card, costs 0–1, and is what the tree
    upgrades; the relic reinforces the same loop.

    | Class | Ability card | Relic | Loop |
    |---|---|---|---|
    | Reaver | **Brace** (1 action, 1 stamina, Stance): enter Brace. Impact taken −2 while in Brace. Leaving Brace for an attack stance adds impact to the next weapon hit. | **Ashen Grip**: first stance change each turn refunds 1 stamina. | Stance switching as tempo |
    | Starseer | **Attune** (1 action, 1 stamina, Skill, Exhaust): your next mana card this combat costs 1 less stamina. | **Lodestar Shard**: at combat start gain mana equal to unspent flask mana vessels, up to 2. | Stamina tension around scarce casts |
    | Herald | **Litany** (1 action, 1 stamina, Skill): heal 3, gain 3 Block. If healed to full, gain 1 sacred charge instead. | **Waxen Seal**: first heal each combat is doubled. | Overheal converts to offense |
    | Rogue | **Prepare** (0 action, 1 stamina, Skill, Exhaust): next card this turn costs 1 less and gains precision. Upgrade: not Exhaust. | **Whetstone Pouch**: first precision hit each combat applies 2 Bleed. | Setup then payoff |

13. **Class unlock is meta.** Profile unlock table keyed by class card id;
    conditions are data (win as X, class level N, boss Y with group Z). Same
    table that tracks keepsake and outfit unlocks.
14. **Class swap mid-run** is an event or boss drop only, never a menu. Swapping
    replaces the core card, keeps weapon skills, resets class level, and
    removes tags the new class does not permit.

## C. Collection and deck

15. **Run owns a collection; the deck is an edited subset.**
16. **Equipping injects base cards into the collection** and locks them in the
    deck while the source is equipped. Unequip removes them (source-removal
    rule).
17. **Deck minimum** is a balance value (start 15) rising with character level.
    Under minimum blocks leaving the loadout screen.
18. **Swap Armament** colorless card, one per run: switch to an inventoried
    weapon mid-combat. Old base cards exhaust, new base cards shuffle into the
    draw pile. Exercises the action-snapshot rule.
19. **Dynamic tags** are computed at action snapshot from equipment state and
    never written to the card. `dual` derives from the grip mode.

## D. Skill tracks

Tracks: one per weapon group, one per armor group, one per focus group,
`dualWield`, and one per class.

20. **Per-run XP ledger keyed by skill id**, level curve in balance data, and a
    pending-reward queue. This is the one new engine primitive.
21. **Weapon XP:** a card tagged with the group resolves at least one hit or
    block against a live target. Combat win grants a flat bonus per equipped
    group; kills multiply that bonus.
22. **Armor XP:** heavy from impact absorbed, light from hits evaded, medium
    split.
23. **Focus XP:** arcane buildup dealt.
24. **Dual-wield:** grip mode on the weapon instance; valid only when both
    hands hold the same group; own track; earns XP only while grip is dual.
25. **Class XP:** combat won, quest completed, boss defeated. Slower curve.
26. **Rewards:** one skill draft per skill per combat; extra level-ups queue to
    the next combat. A skill draft replaces the class-card draft slot on the
    reward screen (one skill draft, one class card, one skip). Pick 1 of N,
    default 3.
27. **Rarity:** skill level unlocks the tier (1–3 common, 4 uncommon, 7 rare,
    10 legendary); within the unlocked set, existing reward-odds weights apply.
28. **Skill thresholds auto-upgrade cards tagged with that group.** Shrine
    upgrade remains for untagged cards only.
29. **Skill milestones replace the smithing tier ladder.** Weapon impact and
    typed damage step up at skill levels; Smithing Stones become a shortcut,
    not a second ladder.
30. **Class tree = property tags unlocked by class level.** Picking a node adds
    a tagging row to the run's class card instance. `requires`/`excludes` on
    the rule row; tier 3 nodes mutually exclusive; subclass = tag swap plus
    art/name swap. About 12 nodes per class, three tiers.
31. **Tree reading order:** tier 1 modifies the ability card, tier 2 modifies
    the relic, tier 3 is the subclass.

## E. Character level and attributes

32. **Character level is run-scoped.** XP from combat, quests, kills. Meta
    progression is the unlock table only. Keeps seeds reproducible and the
    run simulator honest.
33. **Each level grants 1 attribute point** (owner decision, kept). Every 5
    levels: HP, mana, stamina, hand-size bumps. These raise max pools, never
    regeneration.
34. **Attributes start near 5.** One creation mode: class preset as opening
    position plus 10 free points. Drop the pre-assigned 15 mode. This rewrites
    every §3.5 derived formula and is the most expensive item here.
35. **Attribute thresholds gate equipment** (STR 8 heavy weapons, DEX 8 dual
    grip, INT 8 foci). Attributes do not raise armor; CON raises HP and poise
    max. Armor comes only from worn cards.
36. **Cinders keep one job: the merchant.** Remove cinder-purchased level-ups.

## F. Combat resources and defense

37. **Mana has no natural regeneration** (contract line stands). Every mana
    card costs at least 1 action and 1 stamina; mana is the third cost line,
    never the first. Payoff scale versus a same-action physical card:

    | Cost | Expected payoff |
    |---|---|
    | 1 action, 1 stamina, 1 mana | ~1.5×, or an effect physical cards cannot do |
    | 1 action, 2 stamina, 1 mana | ~2× |
    | 2 actions, 2 stamina, 2 mana | fight-changing: multi-target, stagger, phase skip |

38. **Re-cost any existing mana card** with 0 action or 0 stamina, or reclassify
    it as a stamina card. This is a grep on the generated card CSV.
39. **Signature arts cost 2 stamina, 2 mana** so the gap from a 1-mana spell is
    visible on the face.
40. **Arcane Exposure stays an enemy meter.** Mana refund is a property, not a
    meter rule: `siphon` on the scepter → on `arcaneBreak` where source is
    owner, gain 1 mana; focus level 7 raises it to 2 via a `skillLevelAtLeast`
    branch in the same row. Staff `staggerBreak` (6 poise damage on break),
    wand `overcharge` (buildup ×1.5, no break bonus), orb `resonance` (break
    spreads half the threshold to other enemies). Tune so a break costs more
    mana than it refunds (e.g. threshold 20, 5 buildup per 1-mana spell, 1
    back).
41. **Action-only spells also add buildup** so an empty caster still works
    toward a break.
42. **Player poise meter.** `poiseMax` from CON plus body armor. Player stagger:
    lose the first draw next turn and take +50% until end of the enemy turn.
    Milder than the enemy version.
43. **Defense stack unchanged** (Evade → armor → typed resistance → Block →
    impact/buildup). Block never scales with a stat; armor only from worn.
44. **Enemy casters** have authored mana that empties. A dry caster boss is a
    phase mechanic for free.
45. **Starseer tree example.** T1: Attune also draws 1. T2: first arcane break
    each combat draws 2; Lodestar cap 3. T3 (exclusive): **Conduit** — at 0
    mana, the first mana card each turn costs stamina only; or **Reservoir** —
    mana max +3, no generation.

## G. Engine touches (closed-set additions, each with schema + test)

46. `gainMana` opcode if not present.
47. Equipment-granted trigger mount path, shared with relics (one function).
48. Predicates `skillLevelAtLeast` and `classLevelAtLeast`.
49. Skill XP ledger, level curve, pending reward queue.
50. Zone model in run state (`core`, `worn`, `hands`, `passive`).
51. One save migration: class id → core card with starter tag set; relic list
    → carriers with tags; armament tiers → skill milestones.

## H. Cut

52. The 15-point pre-assigned creation mode.
53. Cinder-priced level purchases.
54. Smithing as an independent tier ladder.
55. Any player-side exposure bar that refunds mana on fill (that is regen with
    a delay).

## I. Order of work

1. Property system, then relic migration (A).
2. Equipment as cards, zones, collection and deck (B, C).
3. Skill tracks and rewards (D 20–29).
4. Class card, tree, unlocks (B 11–14, D 30–31).
5. Character level, XP, cinders (E 32–33, 36).
6. Attribute rebase and formula rewrite (E 34–35) — last, it touches every
   §3.5 formula.
7. Mana costing pass and Exposure properties (F) — can run beside step 3.

## J. Open decisions still with the owner

- Deck minimum starting value and growth rate.
- Skill XP amounts per hit, per win, per kill (balance data; the simulator
  should measure levels per run before numbers are chosen).
- Whether class swap items exist in v1 or are a forward hook only.
- Player stagger penalty wording (draw loss vs. action loss).
