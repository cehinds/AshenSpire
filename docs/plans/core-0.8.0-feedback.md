# Core 0.8.0.0 — recent feedback and implementation handoff

## Scope and status

This document records the owner's requests since the latest conversation compaction, including subsequent corrections. The final rules below supersede earlier conflicting examples. Earlier unfinished release work is listed separately so it is not lost.

**Status: requirements recorded; these new gameplay and HUD changes are not implemented or validated.** The execution workspace repeatedly failed to start. GitHub access works, so this handoff can be preserved independently of the workspace. Do not present this document, earlier screenshots, or the read-only audit as evidence that these changes shipped.

## 1. Combat HUD and icons

- Lift the mini health bar slightly higher above the sprite's head than the current placement.
- Keep HUD placement relative to the sprite's semantic head/body, excluding raised weapons and transparent image padding.
- Make intent icons approximately twice their current size.
- Show damage values for attack intents.
- Enlarge the mana icon.
- Never stretch poise, ward, defense, or evasion symbols: preserve their native aspect ratios, including when their containers resize.
- Apply the changes consistently to player and enemy HUDs on mobile, tablet, and desktop, preserving device-specific layouts.
- Keep the existing approved grouping and layer order while adjusting spacing and sizes.

The owner did not specify a new exact head-to-HUD gap or mana icon scale. Measure and visually review these choices rather than treating an arbitrary number as an approved requirement. Preserve existing perception rules for hidden enemy damage unless explicitly revised; confirmed perception behavior for card previews is described below.

## 2. Poise and defensive cards

- Enemies must begin combat with poise rather than displaying zero by default.
- Playing a defensive card also refills poise by the card's defensive amount.
- While a combatant still has poise, poise provides a **flat 25% damage reduction**.
- When poise breaks, the combatant is staggered and takes full damage with respect to the poise reduction.
- Keep poise values, damage previews, tooltips, and actual resolution consistent.

Do not interpret "full damage" as silently removing unrelated ward, defense, or other damage modifiers. The treatment of the exact hit that breaks poise, stagger duration/recovery, starting poise amount, and interaction with other mitigation require an explicit implementation contract.

Working assumptions to verify against current mechanics: enemies start at their authored poise maximum; refills cap at poise maximum; the refill follows the defensive value actually granted, including applicable stance bonuses. These are implementation assumptions, not separately confirmed owner rulings.

## 3. Stance resource discounts

Evaluate the actor's stance before the card changes it.

| Situation | Requested effective cost |
| --- | --- |
| Card matches the active combat stance, ordinary play | SP: `max(cost - 1, 1)` |
| Spell matches the active spell stance | Mana: `max(manaCost - 1, 0)` |
| Reaction-tagged card matches the active stance and is used as a reaction | SP: `max(cost - 1, 0)` |

The reaction formula replaces the ordinary stance discount; it does not subtract a second point. Merely having the Reaction tag does not give ordinary play the reaction minimum of zero. A matching 1-SP Reaction card can cost 0 SP when actually reacting.

Keep card text, cost badges, affordability, reaction selection, actual payment, cancellation/refunds, and queued reactions in agreement. Preserve already-free cards rather than accidentally increasing their price; this is a working edge-case interpretation to verify. Define ordering with other cost modifiers and existing X-cost rules before implementation.

## 4. Default Reaction tags

- **Defense, Counter, and Evade** have the Reaction tag by default.
- Other card types do not receive it automatically.
- Rare cards of other types may explicitly have the Reaction tag.
- Reaction eligibility and the matching-stance reaction discount must support those authored exceptions, not hard-code only the three default types.

This supersedes the earlier wording that limited the zero-SP reaction rule to Defense and Counter.

## 5. Output bonuses — all stances

This applies to **all stances**, not just Defense. Apply the rule to damage and defensive values.

Two independent bonuses add together:

1. **Matching stance:** +25% if the actor is already in the card's appropriate stance before playing it.
2. **Stance advantage:** +25% if the card's stance has advantage against the enemy's stance.

```text
bonus = (matching stance before play ? 0.25 : 0)
      + (advantage against enemy stance ? 0.25 : 0)

output = base output × (1 + bonus)
```

| Matching before play | Advantage | Total bonus | Base 4 | Base 8 | Base 12 |
| --- | --- | --- | --- | --- | --- |
| No | No | 0% | 4 | 8 | 12 |
| Yes | No | 25% | 5 | 10 | 15 |
| No | Yes | 25% | 5 | 10 | 15 |
| Yes | Yes | 50% | 6 | 12 | 18 |

### Timing and corrected examples

- The first card that establishes a stance does not earn the matching-stance bonus from its own stance transition.
- It can still earn the independent advantage bonus.
- Example: a base-4 Defend against a disadvantaged enemy gives **5 defense** when the actor is not yet in Defense, or **6 defense** when already in Defense.
- A base-8 Defend while already in Defense gives **10 defense**, or **12** with advantage.
- A base-12 Defend while already in Defense and with advantage gives **18 defense**.
- Changing stance immediately removes the matching-stance bonus for the previous stance.
- Defend → Attack → Defend does not retain the earlier Defense matching bonus. A following Defend can earn it again.
- Repeated matching cards do not accumulate an additional 25% per copy. This rule tops out at 50% total.
- The owner gave Sweep or Prepare as examples of disadvantaged enemy stances against Defense. Check the authored matchup table against those examples rather than inventing a new complete table.

### Perception and previews

- Cards must show adjusted values when the relevant perception check passes.
- Do not leak a hidden enemy stance or hidden advantage through a preview.
- Perception controls revealed information; it must not cause preview and actual mechanics to use different bonus formulas.
- Preview evaluation must not change stance, spend resources, or consume randomness just to display a value.

Use one shared calculation for preview and resolution, with a pre-play stance snapshot. Fractional rounding, multi-target defense advantage, and the exact list of scalable effects must be settled against the existing rules. Do not automatically apply this output bonus to resource costs, card draw, or durations.

## 6. Potions

- Refill potions after each battle.
- Apply the behavior consistently across normal and elite battles and the applicable boss transition.
- Define the refill through the existing potion/charge model rather than granting unrelated new potion inventory.
- Verify that saves, rewards, and encounter transitions do not skip or duplicate refills.

The exact meaning of "after each battle" for defeat, escape, or aborted combat was not specified; do not silently invent those outcomes.

## 7. Map generation

### Confirmed requests

- Three diverging paths.
- Increase the route to **10 steps to the boss**.
- The first node is always a normal fight.
- Elites may appear only from the **third node/step onward**.
- At least **two opportunities for an elite**.
- At least **one rest spot before the boss**.

Default node-type chances:

| Node type | Chance |
| --- | ---: |
| Normal/minion fight | 50% |
| Elite fight | 10% |
| Store | 15% |
| Rest | 15% |
| Treasure | 10% |
| **Total** | **100%** |

### Working generation interpretation

- Treat the boss as step 10, pending confirmation against existing depth conventions; do not silently turn this into ten ordinary steps plus an eleventh boss.
- Treat elite eligibility as depth/tier 3+, not the third node in a storage array.
- Guarantee a rest on every traversable route before the boss. This is the coordinator's stronger interpretation of "at least one rest spot," not a separately confirmed requirement.
- Treat two elite opportunities as reachable optional encounters; do not force the player to fight both.
- Use the percentages as default sampling weights. Forced opening, rest, elite, and boss constraints can change the final proportions of an individual map.
- Preserve three meaningful divergent routes, valid connections, and reachability; avoid dead ends and unreachable guaranteed nodes.

## 8. Delivery, agents, and QA

The owner asks the main agent to act as planner, coordinator, reviewer, QA, and manager:

1. Delegate scoped implementation to Sol and Luna agents.
2. Review each completed part, resolve findings, and run its relevant checks.
3. Push work to origin and merge approved, passing parts into `dev` through the repository workflow.
4. Retask the finished agent to the next part rather than leaving it idle.
5. Validate the integrated result and provide fresh mobile, tablet, and desktop screenshots and a usable preview.

Use Sol 6.1 where available. Luna 6.1 was requested, but the available Luna model is `gpt-6-luna`; do not mislabel it as 6.1. Assign one owner per file in each implementation wave, especially shared combat and preview code. Follow repository review, spec-first, merge, and promotion requirements; do not bypass checks because the runtime is unavailable.

### Acceptance checklist

- [ ] HUD gap, intent scale, mana scale, and unstretched status symbols reviewed at all three device sizes.
- [ ] Attack damage display respects the applicable perception rules.
- [ ] Enemies start with the intended poise; defensive cards refill it correctly.
- [ ] Poise reduction, breaking hit behavior, stagger, and recovery covered by meaningful tests.
- [ ] Normal combat, spell, and reaction prices agree across preview, affordability, and payment.
- [ ] Default reaction types and a rare explicitly tagged other type both tested.
- [ ] Every stance family exercises the 0% / 25% / 50% output matrix.
- [ ] Pre-play stance timing, switching, repeated cards, and non-accumulation tested.
- [ ] Defensive-value previews and actual output agree when perception succeeds.
- [ ] Potion refill happens at the appropriate completed-battle boundary.
- [ ] Seeded map checks cover depth, branching, first fight, elite eligibility/opportunities, and pre-boss rest reachability.
- [ ] Node weights checked separately from forced-generation constraints.
- [ ] Independent review completed; required checks pass; approved changes pushed/merged and promoted according to repository rules.
- [ ] Fresh responsive screenshots and exact-build preview links supplied.

## 9. Earlier unfinished work retained from before compaction

These are existing obligations, not new requests in this feedback batch:

- Clean Core of unused features, components, and art while preserving optional/full features in a new `modules` branch.
- **Completed preservation step:** `modules` was created from then-current `dev` at `c51e9951a19c75d69d12dc75dc08bec06e756367`.
- Use higher-quality maps, backgrounds, and battlefield assets while keeping Core under the **100 MB** budget.
- "Sharpen assets" was clarified to mean better-quality environment assets, not indiscriminate image sharpening.
- Publish GitHub Pages choices for **Core**, **Full**, and **Light Full**.
- Update the version to **0.8.0.0** after the requested cleanup and validation.
- Preserve the approved responsive layout, uniform semantic sprite heights, grouped mini HUDs, and layer order.
- Core removal, upgraded art, edition publication, and the version update remain pending. Earlier visual approval does not prove the new changes or all automated checks pass.

[Preserved modules branch](https://github.com/cehinds/AshenSpire/tree/modules)

## 10. Read-only implementation audit pointers

An agent inspected `dev` at `0e10fa85fa772bd9e27d437ae4d566cce7f7b04b` through GitHub while shell execution was unavailable. Reverify these findings against the current implementation before editing:

- Configured Core pricing uses `gameProfileCombat.js` / `profileCardCosts`, bypassing the legacy stance discount.
- Legacy `stanceRules` and Core use different stance naming in places, including `casting` versus `prepared`.
- Core damage already has advantage scaling; block gain lacks the requested matching/advantage bonuses.
- The preview path enters the new stance before evaluating effects, requiring care with the pre-play snapshot.
- Reaction tag projection includes some Sweeps, and one reaction path restricts card kinds rather than relying solely on the tag.
- Shared `combat.js` changes need coordinated ownership to avoid conflicting implementations.

These are audit leads, not tested fixes. No new gameplay implementation, successful build, or merge is claimed by this handoff.
