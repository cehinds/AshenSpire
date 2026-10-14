# Stance combat rules

Normative owner decisions, 2026-10-14. **Planned, spec first:** this document does not claim runtime implementation. Together with SPEC.md it governs the WardToBlock continuation. Where earlier stance, Evade, hit-preview or combat-pressure prose conflicts, this document takes precedence. All other WardToBlock and reaction rules remain in force, including magic defense coverage, authored reaction eligibility, reaction-stack lifecycle, saved-run compatibility and solo/co-op parity. Balance values below are configurable defaults.

## Stance selection, costs and entry

Price a card against the actor's **currently active stance**, before changing stance. A card that uses that same stance subtracts the configurable same-stance discount (default 1) from its SP price. The resulting SP floor is 1 for physical cards and 0 for magical cards. Apply this through the shared live/preview price calculation, including affordability and rounds queue payment; rejected plays and inert previews change nothing.

Stance identity is the pair **(camp, maneuver)**: physical and magical Defense are different stances. Crossing that camp boundary changes stance, gives the new entry grant, replaces active ratings and does not earn the same-stance discount. School and effective range are refreshed from the card but are not identity fields; changing only either does not repeat an entry grant.

Ratings are active only while their stance is active. They never accumulate from repeated cards or prior entries. An entry grant occurs only when the stance actually changes; another card in the same stance does not grant it again.

| Stance | Active rating | Entry grant |
| --- | --- | --- |
| Physical offensive stance | +1 AR | 1 Precision |
| Spell (non-melee offensive magic) | +1 PR | 1 Precision |
| Physical Defense | +3 DR | 3 Block |
| Magical Defense | +3 Ward rating | 3 protection, split as below |
| Counter | Both its applicable offensive and defensive rating bonuses | Applicable offensive and defensive entry grants |
| Evade | Applicable defensive rating (+3 DR physically, +3 Ward rating magically) | Applicable defensive protection grant plus 1 Evade stack |

A non-melee offensive magical card enters **Spell**, and adds 1 stack to **each existing status it successfully applies**; this does not create a new status or reward a resisted/failed application. Melee magic follows its authored maneuver instead. Defensive magic remains **Defense**, never Spell.

Magical Defense's 3 entry protection is Block:Barrier, default 30:70, Frost 50:50, Force or Alteration 70:30. Compute Block by rounding the Block share to a whole number; Barrier gets the exact remainder, so the two always sum to the grant. These entry grants use Barrier, not Ward, while the active magical defensive rating is Ward rating.

**Defense exception:** every card played while using Defense restores 5 Poise and 5 Ward, including another Defense card without a stance change. Overflow beyond each respective maximum becomes Block from Poise and Barrier from Ward.

## Maneuver matchups and pressure

Smash and Counter add 3 Poise damage only if that action has no authored Poise damage; do not add 3 to an existing amount.

Smash multiplies both HP damage and pressure by 1.5 against Defense, Spell, or an Evade attempt that fails. Only against Spell, Smash splits its pressure 30% Ward and 70% Poise. This pressure split never changes the HP damage type.

Counter multiplies HP damage and pressure by 1.5 against Attack, Smash, or an Evade attempt that fails. A physical Counter return uses the effective equipped weapon range unless the card explicitly overrides it. An out-of-range return misses.

Sweep has -1 Precision and gains +1 Precision for each additional enemy targeted. It has a 2× damage bonus against Counter. A reactive Sweep against melee physical damage restores 3 Poise and 3 Ward, acts before the incoming action and can interrupt it through the existing interrupt rules. This does not make every Sweep eligible for every incoming attack.

## Evade and hit resolution

An Evade stack adds +3 Evade rating. Evade entry grants one such stack: there is no additional active +3 Evade-rating bonus. Evade is defensive and also receives the applicable active +3 DR or +3 Ward rating and its entry protection (3 Block physically, or the 3-point Block:Barrier split magically). Leaving Evade removes its active defensive rating but does not erase its Evade stacks. Avoidance is capped at 95%, and **any rolled natural 20 hits**, including either die in advantage/disadvantage mode. Exact hit previews enumerate all 20 single-die outcomes or all 400 ordered two-die outcomes with that override, rather than approximating the percentage.

A missed eligible attack consumes 1 Evade stack. An out-of-range attack consumes none. A spell with an explicit **Target** bypass consumes none and bypasses Evade; having a target selector alone is not this bypass. Evade stacks decay by 1 per round through the existing round boundary, once per actor.

A miss prevents all damage to protection layers and HP. A failed Evade attempt permits normal landed-hit resolution, including the maneuver bonuses above. Out-of-range misses remain misses even if a die would otherwise hit.

## Shared previews and combat presentation

Every damage card and every card with a hostile targeted effect shows its exact hit-chance preview both on the fighter HUD and on the selected card. Gate those exact previews on the enemy's **first successful Perception**, respecting the existing observer-specific visibility boundary. A selector, hidden intent or an unearned knowledge state must not disclose the gated percentage. Live resolution and both previews use the same effective range, Precision, Evade, natural-20 and explicit-Target rules.

The fighter HUD order is **Evade, Poise, Ward, Block, HP**. Evade uses the white wing icon and displays its rating; Poise is gold. Numbers are black with a 1 px outline. Percentages are green for advantage, red for disadvantage and white when neutral, consistently on the HUD and selected card.

A landed attack whose target's active Evade stance or Evade reaction failed shows **Hit — Evade Failed** before its damage floater. An ordinary landed hit shows **Hit** before damage. Every miss shows **Missed**. A Target-bypass spell shows no failed-Evade label because it did not attempt Evade.

## Acceptance evidence required from implementation

- Price previews and paid SP agree before stance transition; physical/magical floors hold, including a same-stance zero-Mana spell and rounds queue/refund.
- Repeated same-stance plays do not repeat entry grants or stack active ratings; Counter grants both sides and switching away removes only active bonuses.
- Defense restores on every card; overflow routes to the matching Block/Barrier layer. Magic entry splits preserve totals at every configured grant.
- Status bonuses occur only on successful existing-status applications; melee magic follows its maneuver and defensive magic remains Defense.
- Each matchup applies only against its named stance; Smash's Spell pressure split leaves HP type unchanged, and authored Poise is not inflated by the fallback.
- Weapon-range Counter returns and melee physical reactive Sweeps resolve identically live, in previews, in solo/co-op and across a paused reaction save.
- Evade respects the cap, natural 20, explicit Target distinction, stack consumption exceptions and once-per-round decay. Every miss leaves protection and HP unchanged.
- Observer-specific first-successful-Perception gates both exact percentage surfaces. Floater ordering and labels distinguish ordinary hits, failed Evade, bypasses and all misses.
