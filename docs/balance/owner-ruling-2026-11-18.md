# Owner ruling, 2026-11-18: card budget, drawbacks, rewards

This is the working spec for the 2026-11-18 pass. The owner gave the requests in a session, and each choice the orchestrator made is marked *(decided)*. Task status lives in the PR body.

## 0. Principle: compose existing tags, never re-bundle them (owner)
- Each effect lives in exactly one tag or status. A status or card that needs an effect another tag already provides applies that tag; it does not copy the effect into itself.
- Example: a Poise break used to be "Staggered: skip a turn and take 50% more damage". It is now **Staggered** (skip a turn / lose SP) **+ Vulnerable** (the existing 25% more damage taken).
- Audit in this pass: list every status and keyword whose effect duplicates another tag's effect, and split each into references. Likely candidates include the FixCore "broken" rule, Shock, Chill/Freeze, Frail, and any `damageTakenMult`, `blockGainedMult` or SP-loss modifiers that repeat Vulnerable, Weak, Frail or Staggered. Card faces and tooltips then name the referenced tags.

## 0a. Audit decisions (owner, 2026-11-18)
- **Elemental vulnerability:** one tag per element: Fire, Frost, Lightning, Magic, Psychic, and so on. Each takes +X% damage of that element per stack.
  - Burn's +5% damage taken becomes Fire Vulnerable.
  - Shock's +5% lightning taken becomes Lightning Vulnerable.
  - Frost Exposed becomes Frost Vulnerable.
  - Magic Vulnerable keeps its name.
  - Insanity Exposed becomes Psychic Vulnerable.
  - The generic **Vulnerable** (+25% attack damage) stays separate.
- **Ward and Barrier** merge into one tag, **Ward**.
- **Retreat (owner, corrected):** the player has no row. Only enemies have front and back rows. A player's Retreat (core.retreat, and the Retreat part of backstep) moves the enemies back one row: every front-row enemy goes to the back row, its band +1. It also still ends the player's Advance. *(decided: all enemies, plus ending Advance)*
- **Enemy push (owner):** Gale Push and Hit and Run ("Retreat one band") move the target to the back row, as enemy retreat moves already do.

## 1. Multipliers (player and enemy)
- Physical damage and Block gained drop another ×0.7 for **both** player and enemy, on top of the earlier 0.7 cut (PR #2833), so they end at ×0.49 of the pre-2833 value. The owner will play it first to get a feel for it. The card re-tune to the section 2 curve follows that playtest.
- Every number reported for this cut comes from `tools/card-budget-report.mjs` run on the branch, never from arithmetic (owner: "your previous tunings don't seem to result the way you say").

## 2. Cost curve for player cards
The curve gives the final in-combat value at level 1 with the starting kit. *(decided: the baseline)* Total cost is SP + MP; an MP point counts the same as an SP point.

| Total cost | Block | Damage (plain attack) |
|---|---|---|
| 1 | 5–8 | 5–8 |
| 2 | 15–20 | 15–20 |
| 3 | 25–30 | 25–30 |

- Block range overall: 1–30.
- **Smash:** about +50% Poise damage, and usually +1 SP over a plain attack of the same damage.
- **Sweep:** about −30% damage at the same SP as a plain attack.
- **Spells** follow the same curve. *(decided)*
- **Over-curve cards** (for example 30 Block for 0–1 SP) must pay with one or more drawbacks from section 3.

## 3. Drawbacks (budget levers)
New tags:
- **Drained:** each use lowers an attribute until the end of the fight. *(decided: the duration)*
- **Escalating:** the card costs 1 more SP each time it is played this fight.
- **Reckless:** you lose Poise. Fully breaking your own Poise is self-Broken (below).
- **Self-damage (no tag, owner):** a card says "Take X damage" using the existing self-damage effect. It counts as a drawback.
- **Wound:** adds a Wound card (the existing `wound`) to your discard pile.
- **Staggered (self):** replaces the proposed "Overexert", "Winded" and self-Broken (owner). The player loses 1 SP next turn; an enemy loses its next action.

Existing effects that count as drawbacks:
- **Vulnerable (self):** replaces the proposed "Exposed".
- **Exhaust** and **Ethereal**.
- **Confused (self):** see section 4.

## 3a. Staggered and the Poise break (owner)
- Staggered no longer carries its own ×1.5 damage taken (`statuses.json` `staggered.modifiers.damageTakenMult`).
- A Poise break (FixCore `poise.brokenDamageMultiplier` 1.5, `fixCoreMechanics.json`) also drops its ×1.5. Instead the break applies **1 stack of Vulnerable** (×1.25, 25% more attack damage, decays as Vulnerable does).
- What Staggered keeps: the lost action, or the lost SP for the player.
- **A Poise break applies 1 stack each of Staggered, Vulnerable, Weak and Frail**, lasting until the start of the broken side's next turn (owner).
- **Fortified (new status, owner):** the opposite of Frail. Gains more Block. The Defend stance (+50%) and Counter stance (+25%) Block bonuses are expressed as Fortified, so they show on the status bar.
- The tag list in sections 0a, 3, 3a, 4 and 5 is approved (owner, 2026-11-18).

## 4. Confused (existing status, new effect)
- At the start of its owner's turn, each stack re-rolls the SP cost of one random card in hand to 0–3 SP. The rolled cost lasts that turn only, and the card face shows it.
- Loses 1 stack at the end of each of the owner's turns. *(decided)*
- Enemies have no hand, so Confused keeps its current behaviour on them.

## 5. Reflect and stack cards
- Each Reflect stack adds +10% bonus damage.
- Reflect, Counter and Evade cards grant their own stacks, plus the card's matching flavour stacks (for example Counter + Reflect). Stack counts vary by card.
- Each extra stack is paid for with +1 SP or MP, or with a drawback from section 3.

## 6. Rewards
- **XP:** elite fights give ×1.5 and boss fights ×2, applied to the whole fight's XP.
- **Armament reward:** a separate window after the relic window, offering weapons or armour.
  - Elites: 35% chance *(decided: the chance)*, with 1–3 choices.
  - Bosses: always, with 2–4 choices.
  - Choices are random, spread across groups, and never an armament the player already owns.
- **Card reward door:**
  - "Rank up a card" is its own window after the cards, not a tile among them.
  - **Multi-pick:**
    - Selected cards glow green, with no redraw.
    - The prompt counts down live: "Select N card rewards".
  - **Continue:**
    - It is always enabled, and turns green only when every pick is made.
    - It always opens a confirmation *(decided: always, not only when picks are unused)*. Back keeps the picks editable; Confirm moves on to the rank-up window, then relic, then armament.
  - **Destination:** the confirmation asks once where the picked cards go, deck or library. *(decided)*

## 7. Inspection and redraw
- The (i) on a chosen reward card goes back above the card (commit 130f088723 is reverted).
- A tap only selects. Inspection opens from the (i), the Inspect button, right-click or long-press.
- A long-press, or right-click on desktop, on an enemy opens its inspector with its active effects.
- Small changes (upgrading a card, deck edits, equips, shop picks) patch only the affected nodes. No full redraw: scroll position and focus are kept.

## 8. AR/DR/PR are removed (owner, 2026-11-18)
- AR, DR and PR are removed as stats everywhere: character sheet, card faces, tooltips, receipts and settings. The owner: "str dex and int is more intuitive".
- What replaces them:
  - Physical damage adds **STR**.
  - Block adds **DEX**.
  - Magic damage adds **max(INT, WIS)**.
  - Each uses the same per-point weight the rating used (1 per point, scaled by the existing effects attack/defense weights).
- **Armaments** (all 47 weapons and armour pieces) simply lose their ratings: `attackRating` and `defenseRating` in weapons.csv and outfits.csv, and `points.dr` in gear.json. They get no perks in place of them; the owner withdrew the perk menu. Existing `mods` and attribute `points` stay as they are.
- Item upgrades and properties that granted ratings change to name the attribute instead:
  - "+1 AR" becomes "+1 STR".
  - "+1 DR" becomes "+1 DEX".
  - "+1 magic damage (PR)" becomes "+1 INT".
  - The stance properties "+2 AR / DR / PR while in X stance" become "+2 STR / DEX / INT while in X stance".
- It lands in the same playtest build as the ×0.7 cut.
- All before and after numbers are measured with `tools/card-budget-report.mjs`.

## 9. Hand, SP and MP (owner, 2026-11-18)
- **Opening hand and draw per turn:** 4 + floor(INT / 4).
- **Max MP:** base + floor(WIS / 4).
- **Max SP:** base + floor(DEX / 4).
- Each +1 needs 4 points in its stat. INT, WIS and DEX replace today's fractional mixes (stamina currently reads DEX, CON, WIS and INT).
- A typical starting character holds 5–6 cards.
- Staffs and sceptres inherently lower every spell's MP cost by 1 (minimum 0).
- A few magic relics give +1 max MP.

## 10. Perception (owner, 2026-11-18)
- Perception stays, behind a JSON toggle.
- **Roll:** 1d20 + INT + WIS + 10 against **DC** 5 + the enemy's INT + WIS. A natural 1 always fails and a natural 20 always succeeds.
- The owner asked for pros and cons before it is built; they are in the session reply.

## 11. Saves across builds (owner, 2026-11-18)
- A JSON toggle (default **on** for development) lets a new build delete old saves rather than migrate them. The owner starts a new save each build.
- Set the toggle **off** before any public release, so saves are kept.

## 12. Follow-ups (owner, 2026-11-18)
- **Retreat hold:** an enemy sent back by Retreat or a push stays in the back row through its next turn. After that the normal "empty front row pulls the back row forward" rule applies.
- **Perception:** disabled for now through its JSON toggle (no track, XP or intent bonus). If it is re-enabled later, it rolls once per enemy per fight, and the roll sets the **percent chance of seeing each intent** that fight.
- **Hand base: 5** + floor(INT/4) (owner, confirmed).
  - Targets: Starseer starts with 6 cards and has about 7 by the end of act 3, before relics and equipment.
  - Large hands should come only from card effects, relics, Retain and the like, never from stats alone.
  - Verify the act-3 figure with a run sim (INT reached by the end of act 3, at 1 attribute point per level).
- **Armaments to re-tune** (ratings used to tell these pairs apart): greatsword vs warhammer, halberd vs warhammer, buckler vs kite shield, buckler vs round shield, round shield vs kite shield, Dusk Chime vs Blight Rod.

## 13. Poise (owner, 2026-11-18)
- **max Poise = 1 + CON + other Poise bonuses.** Each CON point gives +1 Poise, alongside its HP, however it was gained.
- Armour, shields and some two-handed weapons (for example the greatsword) **add** Poise by default. Their old poiseThreshold becomes an additive bonus.
- Each of those pieces also carries **one signature effect** from the approved tags:
  - start-of-fight stacks of automatic Block, Counter, Evade or Reflect;
  - Ward or Fortified;
  - Retain on Defend cards;
  - an element resistance, and so on.
- The proposal table is in `docs/balance/equipment-signature-proposal-2026-11-18.md`, pending owner approval.

## 14. Levelling pace (owner, 2026-11-18)
- Raise XP so that, by the end of act 3:
  - a player who takes many elites reaches about **level 8**;
  - every player reaches at least **level 4**.
- Paths differ: some offer several elites, others only 1–2.
- Measured today (every fight won, the new elite ×1.5 / boss ×2): about level 2 / 3 / 4 at the end of acts 1 / 2 / 3.
- **Revised (owner):** XP per fight follows a **polynomial curve** that grows from floor 1 to the boss within an act, and between acts. The first enemy of act 1 gives little XP.
  - Targets at the end of each act: act 1 → **level 2–3**, act 2 → **4–6**, act 3 → **6–8**.
  - Elites and bosses pay more, but most growth comes from the floor/act curve, not a large elite multiplier.

## 15. Card faces outside combat (owner, 2026-11-18)
- Card faces in the deck, rewards, shop and upgrade picker include the character's current attribute bonus: STR on physical damage, DEX on Block, and max(INT, WIS) on magic damage.
- They go through the same multipliers as combat, so the face matches a neutral-stance hit.
- Stance bonuses, enemy defences and statuses show only in combat.
- **Starting armours** (owner): map the four `default` outfit rows to their gear items (Wayfarer Plate, Nightweave, Rite Vestments, Gutter Leathers), so starting armour adds its Poise and attribute points.
- **One-handed Poise** (owner): the Straight Sword and Frost Spear add 0 Poise. The Battleaxe adds **+1** Poise.
- **Signature Block timing** (owner): Block granted at the end of a turn lasts until the start of its holder's next turn.
- The signature table goes to the owner as a readable page before anything is built.
- **Number colours** (owner, final): card face numbers are **black** by default, including attributes, gear, level and the global multipliers, so out-of-combat faces are always black.
  - A number turns **green** only when an in-combat effect raises it: a buff, the current stance's bonus, or a relic or card trigger active this fight.
  - A number turns **red** only when an in-combat effect lowers it: a debuff such as Weak or Frail.
  - The comparison is against the same card's out-of-combat face.
  - Always-on attribute and equipment bonuses stay black. An equipment, relic or card effect that **triggers** during combat (for example "first attack each fight +3" or a per-turn Block signature) turns the numbers it changes green or red for as long as it applies.
- **XP tiers (owner):** elites ×3 so elite-heavy runs reach about level 8 by the end of act 3; bosses stay ×1.5, so no fight gives more than 2 levels.
- **Weapon Poise cut (owner):** every weapon that adds Poise adds max(its current Poise / 3, 1).
  - Greatsword 6 → 2, Halberd 6 → 2, Warhammer 9 → 3, Cinder Axe 6 → 2, Parry Dagger 6 → 2, Wyrmhorn Staff 9 → 3, Battleaxe stays 1.
  - Weapons at 0 (Straight Sword, Frost Spear, daggers and so on) stay at 0.
  - Shields and armour are not weapons and keep their Poise. *(decided)*
- **Equipment for every class (owner):** every weapon and armour piece can be found, equipped and used by any class, with no class restriction left.
  - When a reward, shop or armament offer picks an item, each pick comes from the player's class-themed items 75% of the time and from the whole pool 25% of the time.
  - Each pick rolls separately; a class with no themed item left falls back to the whole pool. *(decided)*

## 16. Item rulings (owner, 2026-11-18)
These override the generic Poise rule for the named items:
- **Greatsword:** 1 Poise, +2 STR.
- **Warhammer:** 2 Poise, +1 STR.
- **Frost Spear:** +1 Frost damage, −1 Fire damage.
- **Spiked Shield:** +1 Counter damage, and **Thorns 1**.
- **Lantern:** when it blocks an attack, the attacker takes 1 Fire damage. Each physical attack deals +1 Fire damage.

**Thorns (new tag):** an attacker that lands a hit takes N damage, where N is the number of Thorns stacks. The value is constant and does not decay. Only a timed effect, which lasts a stated number of turns and is printed on the card, changes it.

## 17. Weapon rulings (owner, 2026-11-18)
- **Halberd:** all physical attacks have Reach. +1 Poise. Sweep attacks deal +1 damage.
- **Battleaxe:** 1 Poise. Smash +1 damage, and Smash inflicts 1 Bleed.
- **Dagger:** "Throwable. Gain 1 Counter at the end of your turn while in Defend stance. 0-cost cards gain Multi-hit."
  - **Throwable:** Attack and Smash cards can be thrown, which gives them Reach. A thrown attack also carries a temporary Weak drawback. *(decided: Weak 1 for that attack only)*
- **Twinblade:** Multi-hit on all attacks.
- **Bows:** gain 1 Reach stack at the end of your turn.
- **Katana:** adds DEX to Attack, Sweep and Smash cards. Smash also inflicts 1 Bleed.

**New tags:**
- **Multi-hit:** each stack repeats the attack once more, so 1 stack makes 1 attack into 2.
- **Reach:** becomes a stack effect with normal decay (1 per turn at the end of its owner's turn).
- **Retreat stack (owner):** this replaces the one-turn hold.
  - Retreat, or a push, gives each enemy sent back 1 **Retreat** stack. While it has any stacks, it stays in the back row.
  - The player's Advance removes a stack, and so does the enemy's own advance (instead of moving forward).
  - Advancing costs 1 SP unless another effect changes it.
  - Every enemy loses 1 stack when the player advances. *(decided)*
- **Retreat is expensive (owner):** every card that gives Retreat stacks pays for it.
  - core.retreat: 1 SP + Exhaust.
  - Cards that bundle Retreat with other effects (Backstep) gain Escalating unless they already Exhaust. *(decided)*
- **Reach ignores Retreat (owner):** Reach attacks hit a retreated back-row enemy normally and don't remove its stacks.
- **Bows (owner):** the wielder is **vulnerable to melee physical attacks, Smashes and Sweeps**: takes Vulnerable-sized extra damage from them, through the existing Vulnerable rule. *(decided: +25%, the Vulnerable amount)*
  - A Reach physical card played while the target has a Retreat stack adds DEX on top of STR: base damage + STR + DEX.
- **Escalating:** is built with the drawback-tag pass. Until then, Backstep's upgrade must keep Exhaust, because the upgrade currently drops it. dodgeRoll and crawlingShot take Escalating in that pass. *(decided)*

## 18. Equipment types: base effects (owner, 2026-11-18; approved with the changes below)
Every item of a type carries its type's base effect. An item's own signature (sections 16–17) adds to it. Art comes later; new items may ship with placeholder art.

**Weapons**

| Type | Base effect |
|---|---|
| Dagger | 0-cost attacks gain Multi-hit. Attack-stance attack cards cost 1 less SP (not Smash or Sweep). |
| Sword | +1 to physical attacks and Sweeps. |
| Spear / Scythe / Halberd | Reach. +1 to Sweeps. |
| Greatsword | Two-handed. Smashes add STR a second time (base + STR + STR + other). +1 Poise. |
| Bow | Reach on physical attacks, Smashes and Sweeps. Adds DEX against a Retreat-stacked target. +1 Retreat stack at the end of the turn. |
| Twinblade | Multi-hit on attacks, Smashes and Sweeps. |
| Shield | +1 Poise. +2 Block at the end of the turn. |
| Hammer | +1 Poise damage on attacks, Sweeps and Smashes. Smash inflicts 1 Vulnerable. |
| Spear / Rapier / Bow | +1 Pierce. |
| Rapier | +1 Counter stack at the end of the turn while in Defend or Counter stance. |
| Staff | Reach. Magic focus: −1 MP on spells while in Prepared stance. 1 Ward stack at the start of each turn. |
| Sceptre | +1 to magic damage and magic stacks. Magic focus. 1 Ward stack at the start of each turn. |

**Armour groups (new tag)**

| Group | Base effect |
|---|---|
| Unarmoured (robes) | Spells −1 MP. +3 DEX. Vulnerable to melee damage. |
| Light (leathers) | +1 Poise. +1 DEX. Block cards +1. |
| Medium | +3 Poise. Block cards +2. |
| Heavy | +5 Poise. −1 DEX. Block cards +5. |

**More content:** new weapons, armour pieces and relics, including new weapon groups and armour groups.

**Approved changes (owner):**
- **Dagger:** 0-cost attacks gain Multi-hit. The SP discount is removed.
- **Unarmoured (robes):** spells −1 MP, +1 max MP, Vulnerable to melee. No DEX.
- **Block-card bonus by group:** light +1, medium +2, heavy +3. Heavy also has −1 DEX.
- **Spear:** one row: Reach, +1 Sweep, +1 Pierce.
- **Type plus signature:** they add together. Item signature sizes shrink so totals stay inside the cost curve.
- **Magic focus:** staves and sceptres both give −1 MP on spells, **only in Prepared stance**.

**Approved new content:**
- **New weapon types:**
  - Mace / Flail: attacks ignore 1 Block per hit; Smash +1 Poise damage.
  - Whip: Reach; attacks remove 1 Retreat stack from the target.
  - Claws / Fists: Sweeps gain Multi-hit; attacks −1 SP and −1 damage.
  - Crossbow: Reach, +2 Pierce, Escalating.
  - Tome (off-hand): the first spell each turn draws 1; 2 Ward stacks at the start of each turn (owner, 2026-11-18).
  - Talisman (off-hand): +1 Ward at the start of each turn.
- **Armour set bonuses** for a full set of one group: unarmoured +1 MP; light +1 Evade at turn start; medium +1 Counter at turn end; heavy Thorns 1.
- **Type relics:** Whetstone Charm (Sword attacks +1), Quiver Strap (Bow Retreat stack +1), Anvil Sigil (Hammer Smash Vulnerable +1), Prayer Beads (robes: +1 Ward on a spell cast), Duelist's Ribbon (Rapier counter returns +2).
- Each new type ships with 2–3 items across rarities. Placeholder art is used until real art exists.

## 19. Equipment approvals (owner, 2026-11-18)
- **Equipment list** (`docs/balance/equipment-list-2026-11-18.md`): approved to build. The owner will tweak items after a playtest.
- **Axe type base:** an axe attack grants +1 STR until the end of the turn; Sweeps get +1. *(decided: the STR stacks with each axe attack that turn)*
- **Twinblades** (and Moon Glaives) keep −1 damage per hit as their drawback.
- **Resist (element):** take 25% less damage of that element.

## 20. Force and Ward (owner, 2026-11-18)
- **Force tag:** Force is a damage type and a tag, not a spell school. Any school can cast it; Alteration casts it most.
  - A hit with the Force tag is **physical** damage, so it hits Block first, even when a spell deals it. Today Force is a 50% magic hybrid (`combatRules.damageTypes.force.magicShare` 0.5); that goes to 0.
  - After Block, a Force hit sends **half** of the remaining damage to Poise, not the usual 25%. The other half goes to HP.
  - No built-in Retreat on Force (owner withdrew it). Retreat stays its own tag.
  - The Force tag and its art use **green**, the Alteration family colour, not the lilac it has today.
- **Gale Push** (the owner calls it "Gale Palm") carries the **Retreat** tag and the **Force** tag.
- **Ward (fix):** each Ward stack adds **+5 max Poise** (`ward.poisePerStack` 5). While a character has Ward, damage goes **Block, then Poise (100% absorbed until Poise is 0), then HP**. Without Ward, the routing after Block stays 25% Poise and 75% HP. *(owner: +5 per stack)*
  - **Ward decay (owner):** Ward loses **1 stack** at the start of its invoker's next turn, not all of it. The max Poise from the lost stack leaves with it, and current Poise is clamped to the new max.
  - **Ward cards (owner):** every card that grants Ward carries the **Reaction** tag (`trait:reaction`), so it can be played as a reaction. Each Ward card pays for it with one of: a higher cost, Exhaust, or sharing its budget with Block. *(per-card choice in the rules pass)*
  - **Ward breaks (owner):** when Poise reaches 0, all Ward stacks are removed. No stack cap is needed; a tome's growing Ward is answered by Poise damage. Magic hits deal extra Poise damage, and Force sends half its damage to Poise, so magic and Force are the natural counters to Ward.
  - **Magic absorption (owner, open):** some Ward cards may absorb magic. The mechanic is not decided yet.
- **Staves and sceptres (owner):** both carry 1 Ward stack at the start of each turn as a built-in property of the type (with §20's Ward: +5 max Poise, and Poise absorbs fully).
- **Tomes (owner):** 2 Ward stacks at the start of each turn by default (staves and sceptres give 1).
- **Magic Smash (owner):** a magic Smash deals far more Poise damage than a physical one (+100% versus +50%), because magic damage hits Ward first. Proposal: docs/balance/magic-smash-sweep-proposal-2026-11-18.md.

## 21. Pierce and Stone Skin (owner, 2026-11-18; replaces the 5-Poise-per-stack draft)
- **Pierce:** each Pierce stack ignores **1 point of Block**. Whatever passes Block still routes **Block, then Poise, then HP**. Pierce deals no extra Poise damage, so Ward stays effective against it.
- **Stone Skin:** 1 Stone Skin stack cancels 1 Pierce stack, and both are spent. Example: Pierce 3 against Stone Skin 2 leaves Pierce 1, which ignores 1 Block. Pierce 3 against Stone Skin 4 strips all 3 Pierce and leaves 1 Stone Skin stack.
- This replaces "Stone Skin reduces Pierce damage by 1 per stack" and the old "Pierce bypasses up to 2 Block".
- **Gale Push (owner):** it carries an explicit **inflict Retreat** tag (it gives the target a Retreat stack), shown on the face beside Force.
- **Hammers (owner):** a hammer Smash also inflicts **1 Retreat stack** on its target. This is part of the hammer type base, alongside +1 Poise damage and Smash Vulnerable.

## 22. Retreat, Reach and targeting (owner, 2026-11-18)
- **Gale Pull (new card):** the opposite of Gale Push. It carries the Force tag and removes 1 Retreat stack from its target, bringing it forward when it has none left.
- **Retreat on either side:** a hit between two combatants needs **Reach** if either one holds a Retreat stack (the player can hold them too, e.g. a bow's end-of-turn stack). Without Reach, each side holding Retreat must be closed with an Advance (1 SP each, which spends one stack). When both sides hold Retreat, both Advances are needed (2 SP).
- **Status-only plays are Reach by default:** a card's status effects that don't come from a melee attack, Sweep, Smash or Counter reach any target with no Advance cost. Example: a Defend card that inflicts Weak applies it to a retreated enemy for free.
- **Self-and-all cards:** a card that affects the player and every enemy plays when you select the player **or** any enemy as its target.
- **Poise target (owner):** a level-1 Reaver in plate starts near 15 Poise (was 21 = attributes 3 + Greatsword item 6 + plate item 6 + type bonuses 6). The fix is to lower the **type bonuses** and keep the items' own Poise:
  - The heavy group goes from +5 to **+2** Poise.
  - The Greatsword type goes from +1 to **0** Poise.
  - To keep heavy above medium, medium goes from +3 to **+1** and light from +1 to **0**. *(decided)*
  - Shields keep their +1 Poise.
  - Result: about 17 for that Reaver, close to 15; the rest is left for playtest.
- **Light and medium full-set bonuses (owner):** these replace the free stacks.
  - Medium (mail): whenever you gain Counter stacks, gain 1 more. If you end your turn in Counter stance while holding Counter stacks, gain 1 more Counter (3 left becomes 4).
  - Light (leathers): whenever you gain Evade stacks, gain 1 more. If you end your turn in Defend stance while holding Evade stacks, gain 1 more Evade.
  - Holding no stacks gives nothing; the bonus only adds to stacks you have or are gaining.
- **Armour type bonuses, clarified (owner):** "set bonus" meant the one armour piece you wear; there is one armour slot, so no multi-piece sets. The bonus comes from wearing that type: mail (medium) gives the Counter stack bonus, leathers (light) the Evade stack bonus, plate (heavy) Thorns 1, robes (unarmoured) +1 max MP.
- **Poise break (owner):** a broken Poise applies **2 stacks** each of Staggered, Vulnerable, Weak and Frail (was 1), until the start of that character's next turn.
- **Robes (owner):** the unarmoured type gives **+1 max MP**. A specific robe can add more as its own bonus (Nightweave +1), with no cap; a rare robe may later add +2.
- **Map (owner):** the longer acts are accepted for playtest (Act 1 sim win rate 95% → 85%). The V widens gradually with depth. By the pre-boss rest the player must not see another branch's pre-boss rest or boss; hiding the other branches' boss nodes is an acceptable way to get there.

**Amended 2026-11-19 (owner):** reaching through Retreat costs 1 Advance (1 SP) per Retreat stack, not per side. Each Advance spends one stack. Retreat sources must carry a real cost (Exhaust, rising cost, high MP cost, or a drawback debuff). There are free Advance sources: a few 0-SP Advance cards, an Advance tag on some existing cards (the card includes one free Advance), and Advance as an upgrade option. 

**Retreat-source drawbacks (owner, approved 2026-11-19):**
- `core.retreat` (the weapon's free card): a weapon with the retreat tag adds the Retreat card to your hand each turn, as now. It costs 0 SP the first time, Exhausts, and its cost rises by 1 SP each use in that fight (counted per fight, not per card copy, since each copy is a fresh Exhausting instance). Ethereal stays as it is.
- `core.backstep` (colourless): also applies Frail 1 to yourself.
- Rogue Backstep: gains Exhaust.
- `core.hitAndRun`: gains Exhaust.
- Dodge Roll: the Retreat mode costs +1 SP each play (escalating); the Advance mode is unchanged.
- `core.galePush`: also costs 1 MP.
- Hammer Smash inflicts Retreat only when it Poise-breaks the target (built on chore/GearPassMechanics later).
- The bow end-of-turn Retreat sets your stacks to max(current, 1) while in Defend stance: no extra stack when you already hold one (built on chore/GearPassMechanics later).
- Approved free-Advance content: 4 free Advance cards (Press On, Lunge In, Slip Close, Overreach), the Advance tag on Driving Thrust, Storm Lash, Closing Dodge, Shadowstep, Dodge Roll's Advance mode and the Advance card (0 SP), and an `fx:advance` upgrade option (low weight). Built on a follow-up branch.

## 23. No hidden caps (owner, 2026-11-18)
- Stats, stacks and bonuses are uncapped by design: almost anything may in theory reach 999. The owner balances with cost and consequence, not ceilings.
- New work adds no caps or clamps unless a ruling names one. Floors that stop a value going negative (a cost of at least 0, HP of at least 0) are fine. Caps that already exist stay until the owner reviews them.

## 24. Buff-card drawbacks (owner, 2026-11-19)
- Most buff cards carry a drawback before upgrade: Exhaust, a high cost, an escalating cost, Ethereal, a buff to an enemy, a discard, Wound/Dazed status cards added to the deck, or a negative status on the user. Upgrades can remove or soften the drawback as an option.
- Upgrade options favour easing the drawback or improving effectiveness/cost: at early upgrade levels they are offered about 3:1 against new-effect options; additional effects come mostly at later levels.
