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
