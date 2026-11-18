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
- **Retreat bug:** some cards' Retreat does nothing. Retreat must move the character to the back row.

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
