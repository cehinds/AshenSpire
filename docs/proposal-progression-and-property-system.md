# Proposal: progression, equipment-as-cards, and the property system

Status: owner-accepted design, 2026-09-11, awaiting implementation. Nothing in
it is shipped. Parent authority: [SPEC.md](../SPEC.md) and
[COMBAT-EQUIPMENT-RULES.md](COMBAT-EQUIPMENT-RULES.md). Where this document
conflicts with either, it is the amendment the owner has accepted; the older
text stays normative for shipped runs until the migration in §7 lands.

## 1. Summary

Everything on the character is a card in a zone. Every passive in the game is
a **property tag** on a carrier with exactly one rule row. Progression is
experience, not cinders: weapon, armor, focus, dual-wield and class **skill
tracks** level from use and draft cards; a slower **character level** grants
one attribute point each level. Mana stays a fixed pool with no per-turn
regeneration. Recovery is what a location's tags say it is.

## 2. Principles

1. **Every number is a data row.** Deck minimum, XP curves, awards, stagger
   penalties, rest amounts, attribute gates: one row each in
   `content/balance.js`. No screen or engine literal.
2. **Tags describe; property tags confer.** Theme and presentation tags still
   grant nothing ("a Blood tag alone grants no Bleed"). Only the new
   `property` domain resolves to behavior, through one rules table.
3. **Source ownership is the only mount path.** A property is granted by the
   carrier instance that holds it and leaves when the carrier does. This is
   the combat contract's existing rule, reused.
4. **Cards never carry properties.** A card's behavior is its own effect list.
   A carrier is equipment, a rune, a relic, the class card, or a location.
5. **Definitions are never persisted.** An instance persists its tag set;
   rule rows can be patched and apply to loaded runs under `contentVersion`.
6. **No script for a property.** If a tag needs `scripts.js`, the tag is the
   wrong abstraction and the budgeted-hatch rule applies.

## 3. The property system

| Piece | Shape |
|---|---|
| Tag domain `property` | Carriers: equipment, rune, relic, class, location. Never card. |
| Table `propertyRules` | One row per property tag: `passives`, `triggers`, `textTemplate`, optional `requires` (tags on the same carrier, `classLevelAtLeast`, `skillLevelAtLeast`) and `excludes`. Same passives/triggers shape relics use today. |
| Mount | `mountProperties(carrierInstance)` resolves the tag set and installs each rule as a source-bound grant; `unmountProperties` removes them. One function shared by every carrier kind. |
| Validation | Every `property` tag has exactly one rule row; `requires`/`excludes` ids resolve; no cycles; a card carrying `property` fails with a named row; a combat property on a location fails with a named row. |
| Ids | Plain. `siphon2` is a second row, never `siphon(2)`. |
| Relics | Become carriers: id, art, rarity, tagging rows. Passives and triggers move into rule rows. Migration step two. |

## 4. The character: cards in zones

**Zones.** `core` (class card, one slot), `worn` (body, head, hands, feet),
`hands` (main, offhand), `passive` (relics), and the draw pile. Only the draw
pile shuffles.

**Equipment rows become cards** with a slot type. Weapon group and armor
group are tags in the existing domains. Each slot owns one defense layer:

| Slot | Primary | Secondary |
|---|---|---|
| Body | Armor value, poise resistance | Weight |
| Head | Typed resistance, one type | Small armor |
| Hands | Impact dealt, grip eligibility | Buildup dealt |
| Feet | Evade charges, weight offset | Stamina recovery |
| Offhand shield | Block per turn, poise resistance | Armor |

**Sprite.** Core sets the base body, worn sets layers, main hand sets the pose
family.

**Class card** is identity plus tags: id, name, art anchors, attribute preset,
kit list, favored groups. The kit is the starting weapon, the class ability
card, and the relic carrier. The class does not grant a weapon group; it
carries `favored<Group>` properties (a `skillXpMult` modifier scoped to that
group), so any class can pick up any weapon and still feel different.

**Class ability card and relic.** The ability card teaches the class's
resource loop in one card, costs 0–1, and is what the tree upgrades. The relic
reinforces the same loop.

| Class | Ability card | Relic | Loop |
|---|---|---|---|
| Reaver | **Brace** (1 action, 1 stamina, Stance): enter Brace. Impact taken −2 in Brace. Leaving Brace for an attack stance adds impact to the next weapon hit. | **Ashen Grip**: first stance change each turn refunds 1 stamina. | Stance switching as tempo |
| Starseer | **Attune** (1 action, 1 stamina, Skill, Exhaust): your next mana card this combat costs 1 less stamina. | **Lodestar Shard**: at combat start gain mana equal to unspent Azure vessels, up to 2. | Stamina tension around scarce casts |
| Herald | **Litany** (1 action, 1 stamina, Skill): heal 3, gain 3 Block. If healed to full, gain 1 sacred charge instead. | **Waxen Seal**: first heal each combat is doubled. | Overheal converts to offense |
| Rogue | **Prepare** (0 action, 1 stamina, Skill, Exhaust): next card this turn costs 1 less and gains precision. Upgrade: not Exhaust. | **Whetstone Pouch**: first precision hit each combat applies 2 Bleed. | Setup then payoff |

**Class unlock** is a profile unlock table keyed by class card id. Conditions
are data (win as X, class level N, boss Y with group Z), in the table that
already tracks keepsakes and outfits.

**Class swap** ships in v1 as an event or boss drop, never a menu. Swapping
replaces the core card, keeps weapon skills, resets class level to zero, and
removes tags the new class does not permit.

## 5. Collection and deck

- The run owns a **collection**; the deck is an edited subset.
- Equipping **injects base cards** into the collection and locks them in the
  deck while the source is equipped. Unequip removes them.
- **Deck minimum** starts at 8 and rises with character level (+1 every 2
  levels). Under minimum blocks leaving the loadout screen.
- **Dynamic tags** are computed at action snapshot from equipment state and
  never written to a card. `dual` derives from the weapon instance's grip mode.
- **Swap Armament** (a colorless card for mid-combat weapon swap) is **v2**.
  v1 keeps the existing `allowChangesInCombat` Armoury path only.

## 6. Progression

### 6.1 Skill tracks

One track per weapon group, per armor group, per focus group, one for
`dualWield`, one per class. All share one ledger, one curve shape, one draft
screen.

| Track | XP source |
|---|---|
| Weapon group | A card tagged with the group resolves a hit or block on a live target; flat bonus per equipped group on combat win; multiplied when the group landed the killing hit |
| Heavy armor | Impact absorbed |
| Light armor | Hits evaded |
| Medium armor | Half of each |
| Focus group | Arcane buildup dealt |
| Dual-wield | As weapon groups, only while grip is `dual` (both hands, same group) |
| Class | Combat won, quest completed, boss defeated. Slower curve |

Rewards:

- **One skill draft per skill per combat**; extra level-ups queue to the next
  combat. A skill draft replaces the class-card slot on the reward screen, so
  the screen stays one skill draft, one class card, one skip. Pick 1 of 3.
- **Rarity is unlocked by level** (common 1, uncommon 4, rare 7, legendary 10)
  and weighted within the unlocked set by the existing reward odds.
- **Skill thresholds auto-upgrade cards tagged with that group.** Shrine
  upgrade remains for untagged cards.
- **Skill milestones replace the smithing tier ladder.** Impact and typed
  damage step up at skill levels; Smithing Stones become a shortcut.

### 6.2 Class tree

A node is a property tag unlocked by class level. Picking one adds a tagging
row to the run's class card instance. `requires` and `excludes` live on the
rule row. Three tiers, about twelve nodes per class; tier 3 nodes are
mutually exclusive and a tier 3 node may swap the class card's art and name,
which is the subclass. Reading order: tier 1 modifies the ability card, tier 2
modifies the relic, tier 3 is the subclass.

Starseer example. T1: Attune also draws 1. T2: first arcane break each combat
draws 2; Lodestar cap 3. T3, exclusive: **Conduit** (at 0 mana, the first mana
card each turn costs stamina only) or **Reservoir** (mana max +3).

### 6.3 Character level

- **Run-scoped.** XP from combat wins, kills, quests. Meta progression is the
  unlock table only, so seeds stay reproducible and the run simulator honest.
- **Each level grants 1 attribute point.** Every 5 levels bumps HP, mana,
  stamina and hand-size maxima. Maxima only, never regeneration.
- **Attributes start near 5.** One creation mode: class preset as opening
  position plus 10 free points. This rewrites every §3.5 derived formula and
  is the most expensive item in the plan.
- **Attribute thresholds gate equipment** (STR 8 heavy weapons, DEX 8 dual
  grip, INT 8 foci). Attributes never raise armor; CON raises HP and poise
  max.
- **Cinders keep one job: the merchant.** Cinder-priced level purchases go.

## 7. Combat resources, defense, and recovery

### 7.1 Mana

- **No per-turn regeneration.** Mana recovers from Azure flask charges, from
  every rest (§7.4, amount by config), and from authored property sources.
  Mana gain uses the existing `restoreMana` opcode.
- **Every mana card costs at least 1 action and 1 stamina.** Mana is the third
  cost line, never the first. Existing mana cards with a zero action or
  stamina line are re-costed or reclassified. Signature arts cost 2 stamina
  and 2 mana so the gap is visible on the face.

| Cost | Expected payoff vs. a same-action physical card |
|---|---|
| 1 action, 1 stamina, 1 mana | ~1.5×, or an effect physical cards cannot do |
| 1 action, 2 stamina, 1 mana | ~2× |
| 2 actions, 2 stamina, 2 mana | fight-changing: multi-target, stagger, phase skip |

- **Enemy casters** have authored mana that empties; a dry caster boss is a
  phase for free.

### 7.2 Arcane Exposure

The enemy-side meter stays. Focus weapons own what a break does, as
properties:

| Focus | Property | On your `arcaneBreak` |
|---|---|---|
| Scepter | `siphon` | `restoreMana` 1; 2 at focus level 7 (a `skillLevelAtLeast` branch in the same row) |
| Staff | `staggerBreak` | 6 poise damage to the broken target |
| Wand | `overcharge` | No break bonus; buildup per hit ×1.5 instead |
| Orb | `resonance` | Spreads half the threshold as buildup to other enemies |

Action-only spells also add buildup so an empty caster still works toward a
break. Tuning keeps a break costing more mana than it refunds (threshold 20,
5 buildup per 1-mana spell, 1 back).

### 7.3 Poise and defense

- **Player poise meter.** `poiseMax` from CON plus body armor. Enemies deal
  impact as weapons do.
- **Player stagger:** lose 1 action next turn, gain 2 Vulnerable and 2 Weak
  (ordinary decay). Same `staggered` status model as enemies with the player
  payload authored as those three numbers.
- **Defense stack unchanged:** Evade → armor → typed resistance → Block →
  impact and buildup. Block never scales with a stat; armor comes only from
  worn cards.

### 7.4 Recovery as location properties

A location is a `property` carrier. Its rules mount on arrival and unmount on
departure; a rest fires `rested` with the location as source. What a place
restores is the sum of its tags.

| Tag | Effect |
|---|---|
| `restHpSmall` | heal 25% of max on `rested` |
| `restHpPartial` | heal 30% of max on `rested` (the current shrine Rest) |
| `restHpFull` | heal to max on `rested` |
| `restMana` | `restoreMana` on `rested` by the configured mode (`rest.mana.mode`): `flat` restores `rest.mana.flat` points; `floorOrFull` restores to `rest.mana.floorPct` of max, or to full when already at or above that floor; `full` restores to max |
| `restManaFlat`, `restManaFloor`, `restManaFull` | Same rule with the mode fixed, for a location that overrides the default |
| `restFlasks` | refill all flask charges on `arrived` (the current grace refill) |
| `restAzureOne` | +1 Azure charge on `rested` |
| `restCleanse` | remove lingering ailments on `rested` |
| `ambushRisk` | seeded encounter roll before the rest resolves |
| `merchant`, `smith`, `questBoard`, `levelUp` | services the location screen offers |

| Location | Tags |
|---|---|
| Field camp (Unknown-node rest outcome) | `restHpSmall`, `restMana`, `restAzureOne`, `ambushRisk` |
| Shrine of Emberlight | `restHpPartial`, `restMana`, `restFlasks`, `smith` |
| Town (atlas settlement) | `restHpFull`, `restManaFull`, `restFlasks`, `restCleanse`, `merchant`, `smith`, `questBoard`, `levelUp` |

Every rest recovers mana. The default mode is a config entry; a location
that wants a different amount carries the fixed-mode tag instead. Debug
settings expose `rest.mana.mode`, `rest.mana.flat` and `rest.mana.floorPct`
the same way they expose flask capacity today, editing the same rows.

Town rest is free; towns are capped at one per act on the seeded route, so
attrition between towns is the run's tension. `inn.price` (default 0) is a
modifier on the `rested` payment if a cost is wanted later. Relic passives
`shrineHealMult` and `shrineNoRest` become `restHealMult` and `restDenied`
with an optional tag filter. Co-op mounts for every living member on arrival.

## 8. Engine touches (closed-set additions, each with schema and test)

1. `property` tag domain and `propertyRules` table with validation.
2. `mountProperties` / `unmountProperties`, shared by equipment, runes,
   relics, class cards, and locations.
3. Predicates `skillLevelAtLeast`, `classLevelAtLeast`.
4. Skill XP ledger, curve evaluator, pending reward queue.
5. Zone model in run state (`core`, `worn`, `hands`, `passive`).
6. Events `arrived`, `rested`.
7. One save migration: class id → core card with starter tag set; relic list →
   carriers; armament tiers → skill milestones; shrine heal/refill constants →
   location tags.

## 9. Cut

- The 15-point pre-assigned creation mode.
- Cinder-priced level purchases.
- Smithing as an independent tier ladder.
- Any player-side exposure bar that refunds mana on fill.
- A rest-tier table; recovery is tags.

## 10. Balance defaults (`content/balance.js`, all provisional)

Every curve uses one shape so one simulator probe measures every track:
`xpToNext(n) = round(base × growth^(n−1), roundTo)` for zero-based step `n`.

| Key | Default | Note |
|---|---|---|
| `deck.minimum` | 8 | |
| `deck.minimumPerLevel` | 0.5 | +1 every 2 character levels, floored |
| `level.xp.base` / `growth` / `roundTo` | 100 / 1.15 / 10 | ~11 levels per run at the awards below; retune from the simulator, target 10–20 |
| `level.pointsPerLevel` | 1 | |
| `level.thresholdEvery` | 5 | maxima bump cadence |
| `xp.combatWin` | 20 | |
| `xp.kill.normal` / `elite` / `boss` | 10 / 30 / 80 | |
| `xp.quest` | 50 | |
| `skill.xp.base` / `growth` / `roundTo` | 30 / 1.2 / 5 | |
| `skill.xp.perHit` | 2 | |
| `skill.xp.perWinEquipped` | 5 | |
| `skill.xp.killMult` | 1.5 | |
| `skill.xp.armorAbsorbPer` | 1 per 5 impact | heavy |
| `skill.xp.armorEvadePer` | 3 per evade | light |
| `skill.xp.focusBuildupPer` | 1 per 5 buildup | |
| `skill.class.xp.base` / `growth` | 60 / 1.25 | |
| `skill.rarityUnlock` | 1 / 4 / 7 / 10 | common / uncommon / rare / legendary |
| `skill.draftSize` | 3 | |
| `skill.draftsPerCombat` | 1 | per skill |
| `stagger.player.actionLoss` / `vulnerable` / `weak` | 1 / 2 / 2 | |
| `exposure.siphonRefund` | 1 | 2 at focus level 7 |
| `exposure.buildupPerManaSpell` | 5 | against threshold 20 |
| `mana.minActionCost` / `minStaminaCost` | 1 / 1 | validation rule |
| `attributes.base` / `freePoints` | 5 / 10 | |
| `attributes.gate.heavyWeapon` / `dualGrip` / `focus` | STR 8 / DEX 8 / INT 8 | |
| `rest.hpSmallPct` / `hpPartialPct` | 25 / 30 | |
| `rest.mana.mode` | `floorOrFull` | `flat` / `floorOrFull` / `full`; default for `restMana` |
| `rest.mana.flat` | 1 | points restored in `flat` mode |
| `rest.mana.floorPct` | 50 | `floorOrFull`: below the floor restores to it; at or above restores to full |
| `atlas.townsPerActMax` | 1 | |
| `inn.price` | 0 | |

Curve receipt at the defaults: character step costs 100, 120, 130, 150, 170,
200, 230, 270, 310, 350; cumulative to level 11 ≈ 2,030. A full run at the
award table (about 36 normal combats, 6 elites, 3 bosses, 5 quests) lands near
2,300 XP, so roughly level 11–12. A receipt, not a second hard-coded total.

## 11. Delivery plan

The engineering breakdown, file by file, is [plan-progression-and-property-system.md](plan-progression-and-property-system.md).

Each phase is one or more pull requests into `dev`, each with its own receipt.
A phase is done when its acceptance line passes in `tests/run-node.mjs` and
the named tool.

| Phase | Scope | Acceptance |
|---|---|---|
| 1. Property system | §3 without relic migration | A weapon carrying `siphon` refunds mana on its owner's break and stops on unequip; a card carrying `property` fails validation by name |
| 2. Relic migration | Relics become carriers | Every shipped relic reproduces its current text and behavior from rule rows; old saves load |
| 3. Cards in zones | §4 zones, equipment as cards, sprite compositing, §5 collection and deck | Loadout screen edits a deck against the minimum; base cards lock and unlock with their source |
| 4. Skill tracks | §6.1 | Simulator reports levels per track per run; one draft per skill per combat |
| 5. Class card and tree | §4 class card, kits, unlocks, swap; §6.2 | Four classes ship as core cards with kits; a tier 3 node swaps art and name |
| 6. Character level | §6.3 XP, points, thresholds, cinders | Simulator measures 10–20 levels per run; no cinder level purchase remains |
| 7. Recovery tags | §7.4 | Shrine and town restore exactly their tag sets; every rest restores mana by `rest.mana.mode`; `restDenied` filters by tag |
| 8. Mana and Exposure | §7.1–7.3 | No mana card with a zero action or stamina line; four focus properties; player stagger payload from balance rows |
| 9. Attribute rebase | Base 5, 10 points, formula rewrite | All §3.5 derived values re-derived; creation ships one mode |

Phases 7 and 8 can run beside 4. Phase 9 is last because it touches every
derived formula.
