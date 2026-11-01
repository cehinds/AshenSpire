# Stance combat rules

Normative owner decisions, 2026-10-14. **Planned, spec first:** this document does not claim runtime implementation. Together with SPEC.md it governs the WardToBlock continuation. Where earlier stance, Evade, hit-preview or combat-pressure prose conflicts, this document takes precedence. All other WardToBlock and reaction rules remain in force, including magic defense coverage, authored reaction eligibility, reaction-stack lifecycle, and saved-run compatibility. Balance values below are configurable defaults.

## Stance selection, costs and entry

Price a card against the actor's **currently active stance**, before changing stance. In Core 2, the equipped Reaver/Rogue Martial Adept subtracts 1 SP from a nonspell card; the equipped Starseer/Herald Magic Adept subtracts 1 MP from a spell/Magic card as classified by the authoritative Core `isSpellCard`/shared combat-profile rule, including mirrored Cantrips whose profile camp is Spell. Either discount applies only when the actor was already in the matching stance before playing the card. This applies on the player's turn and to enemy-turn reactions. The player's-turn discounted lane has a floor of 1; an enemy-turn reaction's discounted lane has a floor of 0. Do not discount the other resource lane, a card of the wrong classification, or a stance the card itself enters. An authored zero-cost card stays zero. The discount is limited to one same-stance cut: the former generic Core 2 `trait:reaction` SP discount is superseded and cannot stack with it. Mana Surge keeps its separate existing rule without a second generic reaction or Adept cut. When the same-stance Magic Adept and successive-Spell reductions both apply, they produce one MP reduction, not two; spell-chain eligibility and timing remain unchanged across mirrored stance changes. Range/Advance and upcast pricing remain independent. X-cost cards continue to spend all current SP as authored, unaffected by the Adept discount. Legacy, Current and archived Core 1 pricing is unchanged. Apply the resulting price through the shared live/preview calculation, including affordability and queue payment; rejected plays and inert previews change nothing.

Stance identity is the pair **(camp, maneuver)**: physical and magical Defense are different stances. Crossing that camp boundary changes stance, gives the new entry grant, replaces active ratings and does not earn the same-stance discount. School and effective range are refreshed from the card but are not identity fields; changing only either does not repeat an entry grant. The discount check uses the stance already active immediately before the card, never a stance entered by that card.

Ratings are active only while their stance is active. They never accumulate from repeated cards or prior entries. An entry grant occurs only when the stance actually changes; another card in the same stance does not grant it again.

| Stance | Active rating | Entry grant |
| --- | --- | --- |
| Physical offensive stance | +1 AR | 1 Precision |
| Spell (non-melee offensive magic) | +1 PR | 1 Precision |
| Physical Defense | +3 DR | 3 Block |
| Magical Defense | +3 Ward rating | 3 protection, split as below |
| Counter | Both its applicable offensive and defensive rating bonuses | Applicable offensive and defensive entry grants |
| Evade | Applicable defensive rating (+3 DR physically, +3 Ward rating magically) | Applicable defensive protection grant plus 3 Evade stacks in Core 2, 1 elsewhere (owner, 2026-10-25) |

A non-melee offensive magical card enters **Spell**, and adds 1 stack to **each status its existing authored effect successfully applies**. This strengthens the spell's existing effect and works on a target that did not already carry that status; it never invents an additional status effect or rewards a resisted/failed application. Melee magic follows its authored maneuver instead. Defensive magic remains **Defense**, never Spell.

Magical Defense's 3 entry protection is Block:Barrier, default 30:70, Frost 50:50, Force or Alteration 70:30. Compute Block by rounding the Block share to a whole number; Barrier gets the exact remainder, so the two always sum to the grant. These entry grants use Barrier, not Ward, while the active magical defensive rating is Ward rating.

**Defense exception:** every card played while using Defense restores 5 Poise and 5 Ward, including another Defense card without a stance change. Overflow beyond each respective maximum becomes Block from Poise and Barrier from Ward.

## Maneuver matchups and pressure

Smash and Counter add 3 Poise damage only if that action has no authored Poise damage; do not add 3 to an existing amount.

Smash multiplies both HP damage and pressure by 1.5 against Defense, Spell, or an Evade attempt that fails. Only against Spell, Smash splits its pressure 30% Ward and 70% Poise. This pressure split never changes the HP damage type.

Counter multiplies HP damage and pressure by 1.5 against Attack, Smash, or an Evade attempt that fails. A physical Counter return uses the effective equipped weapon range unless the card explicitly overrides it. An out-of-range return misses.

Sweep has -1 Precision and gains +1 Precision for each additional enemy targeted. It has a 2× damage bonus against Counter. A reactive Sweep against melee physical damage deals 3 additional Poise damage and 3 additional Ward damage, acts before the incoming action and can interrupt it through the existing interrupt rules. This does not make every Sweep eligible for every incoming attack.

## Evade and hit resolution

An Evade stack adds +3 Evade rating. In Core 2, Evade entry grants three such stacks (the Core rule `accuracy.evadeStackBase = 3`, owner 2026-10-25, matching the Evade card's grant; a resumed fight keeps its snapshotted value). Non-Core expanded combat keeps one (`stanceRules.evadeStacks = 1`): there is no additional active +3 Evade-rating bonus. Evade is defensive and also receives the applicable active +3 DR or +3 Ward rating and its entry protection (3 Block physically, or the 3-point Block:Barrier split magically). Leaving Evade removes its active defensive rating but does not erase its Evade stacks. Avoidance is capped at 95%, and **any rolled natural 20 hits**, including either die in advantage/disadvantage mode. Exact hit previews enumerate all 20 single-die outcomes or all 400 ordered two-die outcomes with that override, rather than approximating the percentage.

A missed eligible attack consumes 1 Evade stack. An out-of-range attack consumes none. A spell with an explicit **Target** bypass consumes none and bypasses Evade; having a target selector alone is not this bypass. Evade stacks decay by 1 per round through the existing round boundary, once per actor.

A miss prevents all damage to protection layers and HP. A failed Evade attempt permits normal landed-hit resolution, including the maneuver bonuses above. Out-of-range misses remain misses even if a die would otherwise hit.

## Shared previews and combat presentation

Every damage card and every card with a hostile targeted effect shows its exact hit-chance preview both on the fighter HUD and on the selected card. Gate those exact previews on the enemy's **first successful Perception**, respecting the existing observer-specific visibility boundary. A selector, hidden intent or an unearned knowledge state must not disclose the gated percentage. Live resolution and both previews use the same effective range, Precision, Evade, natural-20 and explicit-Target rules.

The fighter HUD order is **Evade, Poise, Ward, Block, HP**. Evade uses the white wing icon and displays its rating; Poise is gold. Numbers have a black 1 px outline. Percentages are green for advantage, red for disadvantage and white when neutral, consistently on the HUD and selected card.

A landed attack whose target's active Evade stance or Evade reaction failed shows **Hit — Evade Failed** before its damage floater. An ordinary landed hit shows **Hit** before damage. Every miss shows **Missed**. A Target-bypass spell shows no failed-Evade label because it did not attempt Evade.

## Acceptance evidence required from implementation

- Core 2 price previews and paid resource lanes agree before stance transition: Martial Adept cuts SP only for matching nonspells, Magic Adept cuts MP only for matching spell/Magic cards under authoritative card classification, own-turn floor is 1 and enemy-reaction floor is 0; no wrong-lane, wrong-class or entry-stance cut occurs. An authored zero-cost card stays zero; Adept plus successive-Spell reductions yield one MP cut, mirrored spells retain chain eligibility, X-cost spending is unchanged, and the same-stance and generic reaction cuts do not stack. Legacy, Current and archived Core 1 pricing is unchanged.
- Repeated same-stance plays do not repeat entry grants or stack active ratings; Counter grants both sides and switching away removes only active bonuses.
- Defense restores on every card; overflow routes to the matching Block/Barrier layer. Magic entry splits preserve totals at every configured grant.
- Status bonuses strengthen only successfully applied authored status effects, including first applications to a target; melee magic follows its maneuver and defensive magic remains Defense.
- Each matchup applies only against its named stance; Smash's Spell pressure split leaves HP type unchanged, and authored Poise is not inflated by the fallback.
- Weapon-range Counter returns and melee physical reactive Sweeps resolve identically live, in previews, and across a paused reaction save.
- Evade respects the cap, natural 20, explicit Target distinction, stack consumption exceptions and once-per-round decay. Every miss leaves protection and HP unchanged.
- Observer-specific first-successful-Perception gates both exact percentage surfaces. Floater ordering and labels distinguish ordinary hits, failed Evade, bypasses and all misses.
