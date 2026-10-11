# Tag model: owner decisions

Each section records one owner decision from 2026-10-11, what it decided, and
what changed in the tables. A decision that changes no table says so. Open
points are listed in *Couldn't place* at the end of each section and again in
the final section.

Tables are regenerated with `tools/build.mjs`; `tools/check.mjs` validates them.
Formula, relation and value keys follow the README conventions.

---

## 1. Settings are split (per-device and global)

- **Date:** 2026-10-11 (owner).
- **Decision:** Settings are split in two. *Per-device* settings are layout,
  text size and similar. *Global* settings are audio, difficulty, keybinds and
  similar.
- **Tables changed:** none in this step. `settings.csv` `scope` still derives
  `player` or `tuning` from the source file (`scopeOf` in `tools/build.mjs`).
  The device/global split has no column and no classifier rule yet.
- **Couldn't place:** the rule that maps each settings row to device or global.
  It needs a classifier rule before it can be a column.

## 2. Device bands gain `wide`

- **Date:** 2026-10-11 (owner).
- **Decision:** Four device bands. Phone is 599px and under, tablet 600px to
  1023px, desktop 1024px to 1439px, and a new `wide` band from 1440px.
- **Tables changed:**
  - `tools/bands.mjs`: the ranges, and `wide` in `BAND_NAMES`.
  - `tools/build.mjs` and `tools/check.mjs`: `wide` in the band vocabulary. The
    build regenerates `meta.presentation.layout.breakpoint.wide` in `tags.csv`.
  - `tables/presentation/layouts.csv`, `styles.csv` and `breakpoints.csv` derive
    `band` (or the breakpoint `tag`) from the new ranges. Rows that were
    `mobile` and whose width straddled the new 599/600 edge move to `other`:
    45 layouts, 128 styles and 5 breakpoints. No row lands in `wide` or `tablet`
    because the inventory has no condition at or above 1440px and none that sits
    wholly inside 600px to 1023px.
  - `layouts.csv` does not key by band (its key is component and breakpoint), so
    only its derived `band` column changes.
  - `breakpoints.csv` has no `band` column; its band lives in `tag`.
  - `README.md`: the band list.
- **Couldn't place:** a `(max-width: 600px)` condition is now `other`, not
  `mobile`. If the owner wants 600px to count as phone, the rule is a one-line
  change in `bands.mjs`. The pointer:coarse portrait rule is unchanged.

## 3. Delivery is a type of its own (melee, ranged, cast)

- **Date:** 2026-10-11 (owner).
- **Decision:** Ranged and Casting are a delivery type, separate from stance.
  Delivery is melee, ranged or cast. Each stance has a delivery reference that
  by default points to the stance's default delivery, so delivery and stance
  resolve the same today. A tag may later override the delivery.
- **Tables changed:**
  - `tables/tags.csv`: new `meta.combat.delivery.melee` (key `melee`, status
    `new`). The existing `ranged` and `casting` nodes stay. `casting` is the
    owner's "cast" and keeps its id. `multi-hit` and `area` stay as delivery
    modifiers.
  - `tools/legacy-status.json`: `melee` added as `new`, so the build accepts it.
  - `tables/relations.csv`: relation `DEFAULT_DELIVERY` (stance key to delivery
    key), seven rows:
    - `attack`, `smash` and `sweep` to `melee`. Their children inherit it.
    - `parry` to `melee`.
    - `school-counter` and `ward-counter` to `casting`.
    - `ranged-counter` to `ranged`.
  - The override is not a row yet. It would be a relation such as
    `OVERRIDES_DELIVERY` from a tag to a delivery, and is added with the first
    tag that needs it.
- **Couldn't place:**
  - `school-counter` and `ward-counter` as `casting` are my reading of the tree
    ("Umbral Ward", "Warding Star" are cast-like). Owner to confirm.
  - Defensive stances (`block`, `evade`) and the `counter` group have no
    default delivery row. Defensive stances are not attacks, and counter
    children differ. Owner to say whether they should have a delivery.
  - `elemental-strike` is under Attack and inherits `melee`. Owner to confirm.

## 4. Prepare is available to players

- **Date:** 2026-10-11 (owner).
- **Decision:** Prepare is available to players, not only to enemies.
- **Tables changed:**
  - `tables/tags.csv`: new `meta.combat.skill.prepare` (key `prepare`, status
    `new`), under Skill. The Prepared status it sets already existed as
    `meta.combat.status-effect.buff.setup.prepared`.
  - `tools/legacy-status.json`: `prepare` added as `new`.
  - `tables/relations.csv`: `prepare APPLIES prepared`.
  - No table recorded an enemy-only restriction on Prepare, so nothing needed
    removing.
- **Couldn't place:**
  - Where Prepare belongs in the tree. I put it under Skill because the
    tables have no Prepare card type or stance. Owner to say if it is a
    stance or a Setup power.
  - The Prepare card object. `assets/cards/extended/card-prepare-512.webp`
    exists in `assets.csv`, but no `objects.csv` row was added because its cost
    and type are not in the decision.

## 5. Evade cards sit under Defensive › Evade, with their own stance sprite

- **Date:** 2026-10-11 (owner).
- **Decision:** Evade cards are under Defensive › Evade. They need their own
  stance sprites, recorded as `placeholder`. Until those exist they use the
  Defend stance sprite, recorded as an asset fallback.
- **Tables changed:**
  - Placement: no change. The tree already has Evade under Defensive
    (`meta.combat.stance.defensive.evade`, key `evade`), and Dodge Roll's
    `stance` is `evade`, which resolves there. Its children are Dodge, Vanish
    and Obscure.
  - `tables/presentation/combat-symbols.csv`, row `evade`: status `placeholder`.
    The suggestion moves from the dodge outline icon to the Defend sprite,
    written as `inline SVG ACTION_SIGILS.defend`. The build resolves it to
    `svg:combatSigils.ACTION_SIGILS.defend`, the asset fallback. The dodge icon
    stays the card's default art in `objects.csv` (`artDefault`).
- **Couldn't place:**
  - The Evade's own sprite has no asset id yet. The row is the placeholder
    entry. Add an `assets.csv` id when the art exists.
  - The other Evade cards (about 15 in the tree) are not in `objects.csv`. Only
    Dodge Roll is modelled, so only its stance is set.

## 6. Card type and stance are two fields

- **Date:** 2026-10-11 (owner).
- **Decision:** A card has a type and a stance as two separate fields. The type
  is Skill, Power, Curse, Status, Consumable or Stance. The stance is filled
  only for stance cards.
- **Tables changed:** none. `objects.csv` already keeps `cardType` and `stance`
  as separate columns. The type vocabulary matches the `card.type` tags
  (`type.skill`, `type.power`, `curse`, `type.status`, `type.consumable`,
  `type.stance`). The two stance-card rows (Strike, stance `attack`; Dodge Roll,
  stance `evade`) have type `type.stance`. The two non-stance rows have no
  stance.
- **Couldn't place:**
  - `check.mjs` does not enforce "stance only when type is Stance". Adding that
    rule is a check change, so it is not made here.
  - The Curse tag's key is `curse`, not `type.curse`, unlike the other card
    types. This is harmless, and it is left as it is.

## 7. Consumables are both items and cards

- **Date:** 2026-10-11 (owner).
- **Decision:** Consumables are inventory items, and using one can create a
  one-shot card.
- **Tables changed:**
  - `tables/relations.csv`: `character.consumable CREATES_CARD type.consumable`.
    The source is the consumable item tree (`meta.character.consumable`, with
    Flask, Potion, Throwable, Buff item and Key item). The target is the
    Consumable card type (`meta.card.type.consumable`, key `type.consumable`).
- **Couldn't place:**
  - The one-shot card has no tag or object. Its identity, cost and effect are
    not in the decision, so the relation points at the Consumable card type.
  - Whether all five consumable item kinds create a card, or only some. The
    relation covers the whole group. Owner to narrow it if needed.

## 8. Armor materials carry damage-type resistances

- **Date:** 2026-10-11 (owner).
- **Decision:** Armor materials carry resistances by damage type. The named
  rows are studded, leather, plated, absorption and siphon. The numbers are
  TBD.
- **Tables changed:** `tables/values.csv` gains 15 rows, all `TBD`, scope
  `armor`. Each is `<material>.resist.<family>` for the families physical,
  magic and hybrid. The families are the three top-level damage nodes in the
  tree (`meta.combat.damage.physical`, `.magic`, `.hybrid`). A value is a
  preview number under the README convention, so each row is a placeholder
  until a number is set.
- **Couldn't place:**
  - Cloth, chain and scale are not in the owner's list, so they have no rows.
    Owner to say if they should.
  - The families are coarse. Per-type resistances (slashing, blunt, pierce,
    fire, frost and so on) are not split out. Owner to say if they should be.
  - Absorption and siphon are defensive properties, not materials. They are
    listed because the owner named them, and the rows keep that scope.

## 9. Dodge Block is 3 plus DR bonuses, scaled by modifiers

- **Date:** 2026-10-11 (owner).
- **Decision:** Dodge Block is `3 + DR bonuses`, scaled by modifiers. It sits
  in a formula row that relics and stances can modify.
- **Tables changed:**
  - `tables/formulas.csv`: `dodgeRoll.dodgeBlock` =
    `([dodgeRoll.base] + [dodgeBlock.drBonus]) * [dodgeBlock.mod]`, scope
    `dodgeRoll`. `dodgeRoll.base` is already 3, so the base is unchanged.
  - `tables/values.csv`: `dodgeBlock.drBonus` = `TBD` (the DR share, a
    placeholder), and `dodgeBlock.mod` = `1` (the neutral modifier that relics
    and stances change).
  - `dodgeRoll.block` is unchanged. See below.
- **Couldn't place:**
  - **Conflict to confirm.** The existing `dodgeRoll.block` is
    `[dodgeRoll.base] + ([rank] - 1) + [dr]`, which has a rank term. The decision
    does not mention rank. The new row is added beside it, not in place of it.
    Owner to say whether `dodgeRoll.block` should become Dodge Block, drop the
    rank term, or stay as the rank-based Block gain.
  - "DR bonuses" is read as a share of DR, held in `dodgeBlock.drBonus`. The
    exact share is TBD.

## 10. Block, Ward and Poise stay separate pools

- **Date:** 2026-10-11 (owner).
- **Decision:** Block, Ward and Poise are separate pools. Nothing moves
  between them.
- **Tables changed:** `tables/relations.csv` gains three `SEPARATE_POOL` rows,
  one per pair: `defensive-stats.block` with `poise`, `defensive-stats.block`
  with `defensive-stats.ward`, and `defensive-stats.ward` with `poise`. The
  relation is symmetric, so one row per pair is enough.
- **Couldn't place:** the rule that stops a pool from feeding another is not
  written in the tables. `SEPARATE_POOL` records the constraint. The
  mechanics belong to SPEC once the owner adopts them.

## 11. Defenses are AR, DR, PR, Poise, Ward, Evasion and Accuracy

- **Date:** 2026-10-11 (owner).
- **Decision:** The defenses are AR, DR, PR, Poise, Ward, Evasion and Accuracy.
  Evasion and Accuracy are the new defense stats. Evasion's formula is pending
  a proposal.
- **Tables changed:**
  - `tables/tags.csv`: `meta.character.defensive-stats.accuracy` (status
    `new`), beside the existing `evasion`. The offensive `accuracy` tag is
    unchanged. Its key is now `offensive-stats.accuracy`, because the build
    qualifies both keys to tell them apart.
  - `tools/legacy-status.json`: `defensive-stats.accuracy` added as `new`.
  - `tables/formulas.csv`: a `status` column is added. Blank means defined.
    New row `evasion.rating`, expr `TBD`, scope `character`, status `proposed`.
    The expression has no `[key]` references, so the check passes it as a
    placeholder.
- **Couldn't place:**
  - **Accuracy exists twice.** The offensive tag was already in the tables. The
    owner's "add Accuracy as a tag" was read as a second, defense-side tag.
    Owner to say whether there should be one tag or two.
  - **AR and PR placement.** The owner lists AR, DR and PR as defenses. In the
    tables, AR and PR are under `offensive-stats`, and DR is under
    `defensive-stats`. Nothing was moved. Owner to say if AR and PR should move.
