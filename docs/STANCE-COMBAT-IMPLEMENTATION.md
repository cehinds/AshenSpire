# Stance combat implementation guide

The normative rules live in [STANCE-COMBAT-RULES.md](STANCE-COMBAT-RULES.md).
Defaults are data in `src/content/stanceRules.js`. This pseudocode follows the engine's payment, stance, action-group and presentation boundaries; it is not a second resolver.

## Playing a card

```text
nextStance = classify(card, effectiveRange)
cost = ordinaryResolvedCost(card)
if currentStance.sameTypeAndCamp(nextStance):
    cost.SP = max(cost.SP - stanceDiscount, magic ? 0 : 1)
pay(cost)                         // before changing stance

changed = !currentStance.sameTypeAndCamp(nextStance)
currentStance = nextStance        // refresh range/school even on repeats
activeRatings = ratingsFor(currentStance) // derived, never accumulated
if changed:
    grant entryPrecision, entryEvasion
    grant entryBlock, entryBarrier

if nextStance is Defense:         // deliberate per-play exception
    restore Poise by 5; overflow becomes Block
    restore Ward by 5; overflow becomes Barrier

resolve authored effects
```

Physical offense and melee offensive magic gain active AR. Spell stance and magical Counter gain active PR. Counter also receives the applicable defensive bonus. Magic defensive protection splits by school; the active Ward rating is separate from the restored Ward pool.

## Resolving contact

```text
for each target in an action group:
    if effectiveRange cannot reach contact:
        result = Missed          // no Evasion consumption
    else if spell carrier explicitly has Target tag:
        result = Hit             // bypass Evasion, no Evasion consumption
    else:
        accuracy = effectiveAccuracy + Precision + SweepTargetAdjustment
        evasion = baseEvasion + 3 * EvasionStacks
        dice = roll d20 (two dice for advantage/disadvantage)
        hit = any die is natural 20 OR selected die meets hit threshold
        if not hit:
            consume at most one Evasion stack
        result = hit ? Hit : Missed

    share result across HP, Poise, Ward and hostile status effects
    if result is Missed:
        emit "Missed"
        apply no damage or hostile status
        continue

    emit (Evade stance or reaction failed) AND !TargetBypass
        ? "Hit — Evade Failed" : "Hit"
    apply stance matchup multiplier once to HP and pressure
    if Smash against Spell:
        split explicit and fallback pressure into 30% Ward, 70% Poise
        preserve HP damage type
    resolve defenses, pressure and HP damage through ordinary pipeline
    emit damage after hit floater
```

Before resolving effects, Smash and Counter receive +3 Poise damage only if they have none. Sweep applies −1 Precision plus 1 per additional enemy. A reactive Sweep intercepting a melee physical attack adds +3 Poise/+3 Ward damage, resolves first, and can interrupt the incoming attack.

| Attacker | Target stance | HP/Poise/Ward multiplier |
| --- | --- | --- |
| Smash | Defense, Spell, landed hit against Evade | 1.5× |
| Counter | Attack, Smash, landed hit against Evade | 1.5× |
| Sweep | Counter | 2× |
| Otherwise | Any | 1× |

The hit threshold is capped so Evasion cannot exceed 95% avoidance. The any-natural-20 rule also applies when two dice are rolled. Preview enumerates the same 20 or 400 outcomes as resolution. Out-of-range and explicit Target bypass are resolved before rolling. Evasion decays by one at round start.

## Preview and rendering

```text
if this observer's first Perception read succeeded:
    show exact read-only hit probability from engine
    in both selected-card and persistent HUD previews
    color advantage green, disadvantage red, neutral white
else:
    hide percentage

render Evade, Poise, Ward, Block, HP (retain Barrier)
use white Evasion icon/rating, gold Poise, black 1px number outline
```

The shared card face and inspector show stance entry grants separately from Defense's per-play restoration. Browser evidence uses actual production components with disclosed deterministic QA states, rather than replacement HTML.
