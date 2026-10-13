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
- **Tables changed:** `settings.csv` gains `deviceScope` (`device` or `global`),
  next to the existing `scope` column, which is unchanged (`player` or `tuning`,
  `scopeOf` in `tools/build.mjs`). The rule is `deviceScopeOf` in
  `tools/build.mjs`: device is the Accessibility, Display, Text and Wireframes
  groups, the presentation tuning rows (`gameConfig.presentation.*`), and listed
  keys for layout, UI scale, reduced motion, touch, haptics, performance or
  quality and other display rows. Everything else is global, including all
  tuning rows. Result: 107 device, 4,361 global. `tools/check.mjs` fails a row
  that is neither.
- **Couldn't place:** these rows are global, because the owner's rule does not
  settle them: `animSpeed` (Combat pacing), `holdConfirm` (hold-to-confirm
  timing), `tileActivation` and `moveActivation` (how tiles and moves are
  activated), `resetAllSettings` (resets both kinds), and the formation movement
  rules (`movementEnabled`, `movementNeedsSelection`, `movementCostsAction`). The
  owner can move any of them to device. Set global on review: `mapMode` (fog or
  path reveal is gameplay knowledge) and `sote_lan_tint` and `sote_lan_style`
  (the co-op identity should not split per device, like `sote_lan_name`).

## 2. Device bands gain `wide`

- **Date:** 2026-10-11 (owner).
- **Decision:** Four device bands. Phone is 600px and under, tablet above 600px
  up to 1023px, desktop above 1023px up to 1439px, and a new `wide` band above
  1439px. Phone
  matches the game CSS breakpoint `max-width:600px` (used 27 times).
- **Tables changed:**
  - `tools/bands.mjs`: the ranges, and `wide` in `BAND_NAMES`.
  - `tools/build.mjs` and `tools/check.mjs`: `wide` in the band vocabulary. The
    build regenerates `meta.presentation.layout.breakpoint.wide` in `tags.csv`.
  - `tables/presentation/layouts.csv`, `styles.csv` and `breakpoints.csv` derive
    `band` (or the breakpoint `tag`) from the new ranges. With phone at 600px
    and under, rows that a 599px edge had sent to `other` return to `mobile`:
    45 layouts, 128 styles and 5 breakpoints (before to after: layouts other 237
    to 192, styles other 905 to 777, breakpoints other 117 to 112). No row lands
    in `wide` or `tablet` because the inventory has no condition above 1439px
    and none that sits wholly inside above 600px to 1023px.
  - `layouts.csv` does not key by band (its key is component and breakpoint), so
    only its derived `band` column changes.
  - `breakpoints.csv` has no `band` column; its band lives in `tag`.
  - `README.md`: the band list.
- **Couldn't place:** none for the phone edge. The pointer:coarse portrait rule
  is unchanged. `tablet` starts at 601px, so 600px belongs only to `mobile`
  (review follow-up). No table row moved.

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
    Consumable card type (`card.type.consumable`, key `type.consumable`).
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
  until a number is set. Cloth, chain and scale are added later with the same
  nine-family shape (`cloth.resist.*`, `chain.resist.*`, `scale.resist.*`, all
  `TBD`); their material tags already exist in `tags.csv`.
- **Couldn't place:**
  - Cloth, chain and scale were not in the owner's first list. They now have
    rows; the owner can confirm the list.
  - The families are coarse. Per-type resistances (slashing, blunt, pierce,
    fire, frost and so on) are not split out. Owner to say if they should be.
  - Absorption and siphon are defensive properties, not materials. They are
    listed because the owner named them, and the rows keep that scope.

## 9. Dodge Block is 3 plus DR bonuses, scaled by modifiers

- **Date:** 2026-10-11 (owner).
- **Decision:** Dodge Block is `3 + DR bonuses`, scaled by modifiers. It sits
  in a formula row that relics and stances can modify. There is no rank term
  and no upgrade (SPEC §12.1).
- **Tables changed:**
  - `tables/formulas.csv`: `dodgeRoll.block` =
    `([dodgeRoll.base] + [dr]) * [dodgeBlock.mod]`, scope `dodgeRoll`. The rank
    term is dropped. `dodgeRoll.base` is 3. `dodgeRoll.poise` and
    `dodgeRoll.ward` stay derived from `dodgeRoll.block`. The separate
    `dodgeRoll.dodgeBlock` row is removed, since it is now the block row.
  - `tables/values.csv`: `dodgeBlock.mod` = `1` (the neutral modifier that relics
    and stances change). `dodgeBlock.drBonus` is removed; the DR share is
    `[dr]` itself.
- **Couldn't place:** none. The owner's rule is "3 + DR bonuses", read as the
  full DR value `[dr]` added to the base, so no share value is needed.

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

- **Date:** 2026-10-11 (owner). The hit model below was approved by the owner
  on 2026-10-11 and is recorded as formulas with `status=proposed`.
- **Decision:** The defenses are AR, DR, PR, Poise, Ward, Evasion and Accuracy.
  Evasion and Accuracy are the new defense stats. The hit roll is: an attack
  hits when d20 + Accuracy ≥ 8 + Evasion. A natural 1 always misses and a
  natural 20 always hits. The chance to be missed is capped at 75%.
  - **Accuracy:** `accuracy.rating = floor([strength] + [dexterity] + 0.5*[wisdom] + 0.5*[intelligence]) + floor([level] / 5) + [accuracy.tagBonus]`. Tag bonus: quick +1, telegraphed −2. At level 1: Reaver 5, Rogue 5, Starseer 4, Herald 4.
  - **Evasion:** `evasion.rating = [armor.evasionBase] + min(max([dexterity] - 1, 0), [armor.dexCap]) + [shield.evasion] + [evasion.cardBonus]`.
    Armour by material (evasion base / DEX cap): cloth 0/4, leather 0/6, studded 1/3, chain 1/2, scale 1/1, plated 1/0. Shields: buckler +1, other shields 0. Card bonuses: Backstep +5, Shadowstep +4, Quickstep +3, Acrobatics +3, Dodge +3, Evasive Guard +2.
  - **Miss chance:** `hit.missChance = min(0.75, max(0.05, (8 + [evasion.rating] - [accuracy.rating] - 1) / 20))`. Check against the natural rules: a roll misses when d + A < 8 + E (count 7 + E − A of 20), a natural 1 always misses (the 0.05 floor), and a natural 20 always hits (a roll can miss at most 19 of 20, and the 0.75 cap is below that). `evasion.test.mjs` checks this roll by roll for A 1–10 and E 0–20.
  - **Examples** (enemy accuracy 5, `enemy.accuracy`): Starseer 0 evasion, 10% missed; Herald 0, 10%; Reaver plated 1, 15%; Rogue leather DEX 3 with buckler 3, 25%; Rogue after Backstep 8, 50%. Enemy evasions as values: Wandering Soldier 1, Blight Hound 3, Husk Brute 0, Fell Warden 2.
- **Tables changed:**
  - `tables/tags.csv`: `meta.character.defensive-stats.accuracy` (status `new`), beside the existing `evasion`. The offensive `accuracy` tag is unchanged. Its key is now `offensive-stats.accuracy`, because the build qualifies both keys to tell them apart.
  - `tools/legacy-status.json`: `defensive-stats.accuracy` added as `new`.
  - `tables/values.csv`: the armour, shield, card and tag-bonus rows, the enemy rows, and the level-1 stat inputs (`wisdom`, `intelligence`, `level`; `strength` and `dexterity` already existed).
  - `tables/formulas.csv`: `evasion.rating`, `accuracy.rating` and `hit.missChance`, all `proposed`.
  - `tools/evasion.test.mjs` (new): the five examples, the class accuracies, the tag bonuses, and the roll-by-roll natural-roll check.
- **Assumptions and placeholders (for the owner to confirm):**
  - Leather evasion base is 0 (not 1). This was the owner's correction so the approved miss rates hold: with base 1, Rogue (leather, DEX 3, buckler) is 4, which is 30%, not 25%.
  - Starseer and Herald are given cloth (base 0, DEX cap 4). Their evasion is 0 in the decision, and no armour is named. Cloth is my assumption, and with DEX 1 it gives 0.
  - `wisdom`, `intelligence` and the class STR/DEX/WIS/INT are level-1 stats from content. The table preview values for `wisdom` and `intelligence` are 0 and are placeholders. `level` is 1.
  - Runtime-input keys, with preview value 0 (no armour, no shield, no card, no tag): `armor.evasionBase` and `armor.dexCap` (resolved from the equipped material's rows), `shield.evasion` (from the equipped shield, buckler or other), `evasion.cardBonus` (from the card in effect), and `accuracy.tagBonus` (from the tag in effect). These keys are my choice, since the formulas need one value each; the per-material and per-card rows are the source.
  - The Rogue after Backstep and Reaver values depend on the leather correction above.
- **Couldn't place:**
  - **Accuracy exists twice.** The offensive tag was already in the tables. The owner's "add Accuracy as a tag" was read as a second, defense-side tag. Owner to say whether there should be one tag or two. The formulas use the value keys `accuracy.rating` and `accuracy.tagBonus`, not either tag.
  - **AR and PR placement.** The owner lists AR, DR and PR as defenses. In the tables, AR and PR are under `offensive-stats`, and DR is under `defensive-stats`. Nothing was moved. Owner to say if AR and PR should move.
  - The `[evasion.cardBonus]` and `[shield.evasion]` inputs are not yet bound to card and shield objects in `objects.csv`. The binding is not in the decision.

## 12. Fight speed is being reworked on its own branch (note only)

- **Date:** 2026-10-11 (owner).
- **Decision:** Fight speed is being reworked on its own branch to `dev`. This
  folder does not change it.
- **Tables changed:** none.

## 13. Weapon damage kinds and damage types are two tags

- **Date:** 2026-10-12 (owner).
- **Decision:** two tags: weapon damage kinds vs damage types. Blade, blunt and
  piercing (`meta.combat.damage.physical.weapon-{blade,blunt,piercing}`) and the
  physical damage types (`meta.combat.damage.physical.{slashing,blunt,pierce}`)
  stay separate. The weapon ids are `weapon-*` because `physical.blunt` is the
  damage type. Each weapon kind sits under `meta.combat.damage.physical`, and each pair is
  linked both ways in `related`: blade with slashing, blunt with blunt, and
  piercing with pierce.
- **Tables changed:** `tables/tags.csv` moves the three weapon kinds under
  `meta.combat.damage.physical` (renamed to `weapon-*`) and adds the six `related` links. No liveId
  changes.
- **Couldn't place:** the damage-type placement question below still stands.
  It concerns which tree holds damage types as a whole, not these two sets.

## 14. Relics, charms, companions, sigils and class feats are objects

- **Date:** 2026-10-12 (owner).
- **Decision:** each relic, charm, companion, sigil and class feat is a row in
  `tables/objects.csv`. Its `kind` is the object's family. Its `tags` hold the
  classification tag key, and its property tag key where it has one. The
  property tags stay as the effect handles, because the game keys effects by
  them. Ids and names are the game's own (`relics.js`, `progression/relics.js`,
  `companions.js`, `sigils.js`, `progression/feats.js`, `classSkillFeats.js`).
  Classification tags are written with their current keys (for example
  `character.relic` and `feat`), after the repoint on this branch.
- **Owner rulings, 2026-10-12:**
  - Charms are relics. `kindlingCharm`, `goldleafCharm` and `emberwickCharm`
    are `kind` relic, with their own property tags.
  - Relics with no property node are objects with only the relic classification
    tag, and no effect tag. These are eleven: `cinderPouch`, `feralEye`,
    `crackedTear`, `sealstoneKey`, `emberFragment`, `ancestralHorn`,
    `saltedRelic`, `wayfarersKnot`, `prismaticThorn`, `restlessClasp` and
    `paupersDiadem`.
  - Class skill feats are objects with only the feat classification tag, and no
    effect tag. These are the twenty `classSkillFeats.js` entries (`reaver*`,
    `starseer*`, `rogue*`, `herald*`).
- **Descriptions:** the game's own text, not written here.
  - Relics: the `textTemplate`, with its `{token}` placeholders left in.
  - Progression feats: the feat's `feat:*` textTemplate, which is what the game
    shows (`src/content/progression/feats.js:313` → `getFeatDescription` in
    `src/model/classSkillFeatDescription.js`). It differs from the `nodes.csv`
    blurb only by its `{token}` placeholders, and by "half HP" becoming "50% HP"
    in 4 feats: last-rampart, carrion-measure, funeral-watch and
    pilgrim-of-scars. All fifty feat rows carry the template, with `{token}`
    placeholders left in.
  - Companions and sigils: their `blurb`.
  - Class skill feats: their `description`.
- **Tables changed:** `tables/objects.csv` gains 152 rows: 62 relic with a property tag (59
  relics and 3 charms), 11 relic with no effect tag, 2 companion, 7
  sigil, 50 feat, and 20 class skill feat with no effect tag. The feat
  descriptions were corrected in a separate commit. `tags.csv` is not touched.
- **Couldn't place:** none. The rows above cover every entry the game defines in
  these five families.

## 15. Evade becomes a live maneuver; the reaction tag already shipped in #1905

- **Date:** 2026-10-13 (owner).
- **Ruling 1 (verbatim):**
  > Evade becomes a live maneuver (`maneuver:evade`), its own stance. Evade adds dex + base +3 per stack of evade to evasion stat and adds 3 block.
- **Ruling 2 (verbatim):**
  > Evade and counter should have the reaction tag so can be played with some higher ranked sweeps strikes and blocks (like parry)
  - Already implemented on `origin/dev` by PR #1905 (`feature/ReactionCounterImpactFlux`). Source of truth: `docs/combat-card-traits-contract.md`. Eligibility: line 87 (a hand card needs `trait:reaction`). Card picks, "Reaction": line 250 onward (every `maneuver:counter` card, every card with an `evade` payload, Sweeps, and Defends at T ≥ 4). Projection: `src/content/traitProjection.js:48`. Rules: SPEC §4.10.
  - This branch is behind `dev` and does not have #1905. No candidate list is written here.
- **Ruling 3 (verbatim):**
  > Evade tag is unique in the sense that weight class affects efficacy
- **Where it lands:** a separate PR after TagRefactor reaches `dev`. It is not on
  this branch. `content/source/tagging.csv` is not changed by this decision.
- **Open, owner to confirm:** the Evasion reading. Either Evasion += stacks × (DEX + 3),
  or DEX + 3 × stacks.
- **Open, owner to confirm:** how weight class scales Evade. Either a multiplier per
  light, medium or heavy class, or reuse of the armour DEX cap. Not decided here.
- **Cross-references for the weight-class question:**
  - Evasion rating formula, `docs/tag-model/tables/formulas.csv` `evasion.rating`:
    `armor.evasionBase` plus DEX capped by `armor.dexCap`. Per the owner note, the caps
    are cloth 0/4, leather 0/6, studded 1/3, chain 1/2, scale 1/1, plated 1/0.
  - Armour weight classes light, medium and heavy: `src/engine/skillXp.js:199-200`.
    `attackEvaded` pays light in full and medium at half.
  - Expansion proposal: `origin/dev:docs/combat-cards-expansion-proposal.md:122`,
    "− armor penalty".

### Cards and their maneuver (two layers, both true on dev)

The thirteen Evade-family cards carry two different maneuver statements on
`origin/dev`, at two layers. Neither is a conflict:

- **Base layer.** `content/source/tagging.csv` tags each of the thirteen as
  `maneuver:defend`.
- **Combat expansion (v2) layer.** The expansion remaps the Evade cards at runtime.
  `src/content/combatExpansionMartial.js:10` puts `evasiveGuard`, `dodgeRoll`,
  `quickstep`, `backstep`, `acrobaticsRogue`, `shadowstep` and `progression-nightstep`
  in the `counter` group. `src/content/combatExpansionMartial.js:30` defines the
  `EVADES` set with the same seven ids. The other six (`vanish`, `smokeBomb`,
  `misdirect`, `smokePellet`, `smokeVeil`, `pocketSand`) are not in the `counter`
  group or `EVADES`.

The `maneuver:evade` PR has to change both layers: the `tagging.csv` base, and the
expansion `counter` group plus the `EVADES` set.

### Combat effects of the move (when the PR lands)

- `src/engine/combatMatchups.js:279`: stance Block and Barrier apply only when the
  stance maneuver is `defend`. Evade cards lose that stance Block. Their own 3 Block
  (ruling 1) replaces it.
- `src/engine/combatMatchups.js:346-347`: the smash multiplier (`defendedMultiplier`)
  and the sweep multiplier (`sweepMultiplier`) apply against a `defend` stance. Evade
  no longer triggers either.
- `src/engine/combatMatchups.js:399`: the smash status check reads a `defend` target
  stance. An Evade target no longer counts as defended there.
- The new stance also needs entries in the stance-to-maneuver sets
  (`src/model/alternativeStance.js`, `src/model/combatCardProfile.js`,
  `src/model/playingCard.js` `combatCardType`).

## Open: round-trip differences

Every live node in `content/source/nodes.csv` (448) now maps to exactly one tag
through `liveId`, with no collisions. The compile report still lists 92 field
differences (section 3 of `compile-report.md`), down from 181: 108 were chip
fields the model left empty, and they now carry the live glyph and colour. The
rest are real disagreements between the live tree and the model. The model
keeps its placement and wording until the owner decides. A tag with both a
label and a parent difference is counted in both clusters below.

**Labels, casing only (21).** The model shows display case; nodes.csv holds the
identifier. Owner to say whether the model label should match nodes.csv exactly
or keep display case.
- `card.cost.mana`, `card.cost.stamina`, `card.type.curse`, `card.type.power`,
  `card.type.skill`, `card.upgrade.upgraded`, `card.keyword.ethereal`,
  `card.keyword.exhaust`, `card.keyword.innate`, `card.keyword.retain`,
  `card.keyword.unplayable`, `meta.combat.damage`, `meta.combat.damage.magic`,
  `meta.combat.damage.physical`, `meta.character.{class,relic,feat}`,
  `meta.character.consumable.flask`, `meta.character.other.location.{event,encounter}`,
  `card.type.attack`.

**Labels, different word (11).** Owner to say which name is the game's.
- `meta.combat.damage.magic.divine` (model Divine, live Holy; `damage:sacred`).
- `meta.combat.damage.magic.frost` (model Frost, live Cold; `damage:frost`).
- `meta.combat.damage.physical.pierce` (model Pierce, live Piercing; `damage:piercing`).
- `meta.combat.skill.spellcraft.necrotic` (model Necrotic, live Decay; `school:decay`).
- `meta.combat.delivery.casting` (model Casting, live Spell; `maneuver:casting`).
- `theme.stance` (model Class stance, live Stance; `theme:stance`).
- `meta.combat.skill.spellcraft` (model Spellcraft, live Magic school; `school`).
- `meta.combat.stance` (model Stance, live Combat maneuver; `maneuver`).
- `meta.combat.stance.defensive` (model Defensive, live Defend; `maneuver:defend`).
- `card.type.status` (model Status, live statusCard).
- `meta.combat.damage.hybrid` / `damage.arcane` (Hybrid vs arcane; `liveId` `damage.arcane`).

**Placement: damage types (9).** The live tree puts `damage.physical`,
`damage.magic` and `damage.hybrid` under the `damageType` root. The model puts
them under Damage. Owner to say which tree holds damage types. Rows:
`meta.combat.damage.magic.{divine,fire,frost,lightning,necrotic}`,
`meta.combat.damage.physical.{blunt,pierce,slashing}`,
`meta.combat.damage.hybrid.force`.

**Duplicate root: damageType.** The model has a `damageType` root (live id
`damageType`, mapped in commit f30b60a96) with no children. Its damage kinds
sit under `meta.combat.damage`, which holds physical, magic and hybrid. Both
roots name the same thing. Owner to say whether to merge them into one root,
and which one keeps the id.

**Placement: card schools (13).** The live tree lists these under the `card`
root. The model puts each under a technique, spellcraft, weapon-skill or stance
tag. Owner to say whether a school is a card identity, a technique, or both.
- Under technique: `meta.combat.technique.{blood,guile,pierce,venom}`.
- Under spellcraft: `meta.combat.skill.spellcraft.{divine.oath,fire.ash,fire.gorefire,force.starstone,necrotic.blight,psychic.ritual}`.
- Under weapon-skill: `meta.combat.skill.weapon-skill.{blade,bow}`.
- Under stance: `meta.combat.stance.defensive.block.guard`.

**Placement: card keyword, type, upgrade and cost (12).** The live tree puts
these under `lifecycle`, `classification`, `internal` and `costRoot`. The model
puts them under `card.keyword`, `card.type`, `card.upgrade` and `card.cost`.
Owner to say which parent each belongs to. Rows: `card.keyword.{ethereal,exhaust,innate,retain,unplayable}`,
`card.type.{curse,power,skill,status}`, `card.upgrade.upgraded`,
`card.cost.{mana,stamina}`.

**Placement: delivery, stance and counter (5).** Owner decision 3 puts Ranged
and Casting under delivery. The live tree puts `maneuver:ranged` and
`maneuver:casting` under the maneuver root, which maps to the stance tag. Owner
to confirm decision 3 against the live tree. Rows: `meta.combat.delivery.ranged`,
`meta.combat.delivery.casting`. The live tree also puts
`meta.combat.stance.counter.ranged-counter`, `meta.combat.stance.counter.melee-counter`
and `meta.combat.stance.counter.spell-counter` under `counterMode`, not under the
counter stance.

**Placement: technique, school and roots under meta (6).**
- `meta.combat.technique` sits under Combat in the model, in its own group
  (moved from Skill, owner 2026-10-12). The live `technique` root has no parent.
- `meta.combat.skill.spellcraft` sits under Skill. The live `school` root has no
  parent.
- `meta.combat.damage`, `meta.combat.delivery` and `meta.combat.stance` sit under
  Combat, and `meta.character.creature` under Character. Their live roots have no
  parent. Owner to say whether the model's `meta` grouping stays.

**Placement: item types and armour properties (5).**
- `meta.character.armor` and `meta.character.weapon.off-hand.shield` sit under
  Armor or Off-hand in the model. Live `item:armor` and `item:shield` are under
  `itemType`.
- `meta.character.armor.defensive-property.insulated` and `.grounded` sit under
  Defensive property. Live `trait:insulated` and `trait:grounded` are under `trait`.
- `meta.character.armor.defensive-property.siphon` sits under Defensive property.
  Live `siphon` is under `property`.

**Placement: collection ids and former roots (owner, 2026-10-12, accepted) (10).** Parent: `meta.character.{class,relic,feat}`, `meta.character.consumable.flask`, `meta.character.other.location.{event,encounter}` (live `classification`); `card.type.attack` (live `classification`); `meta.combat.camp`, `meta.combat.attack-source`, `meta.presentation.fx` (live roots have no parent).

**Not counted here.** Three live roots have a bare name that is also the last
segment of another id, so no bare id has a unique key. They are new top-level
tags with the suffix `Root`: `costRoot` (cost), `equipmentRoot` (equipment) and
`utilityRoot` (utility). Their
children sit under them. This keeps every key unique without adding a parity
difference.
