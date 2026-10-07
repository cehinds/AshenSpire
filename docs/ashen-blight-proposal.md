# Ashen Blight proposal

**Status: PROPOSED — NOT IMPLEMENTED.** Rules, sample cards, card appearance, persistence, cleansing, and full-meter consequences below are design recommendations. Existing combat Blight does not currently implement this run mechanic.

Ashen Blight offers cheap emergency power in exchange for risk that persists through the run. Native corruption cards Exhaust for the current combat and return at the next encounter. Corruption remains after those cards return.

## Separate run corruption from combat Blight

| System | Scope | Behavior |
| --- | --- | --- |
| Crimson Blight | Combat status | Existing stacking HP loss at turn start; expires after three turns and ignores Block |
| Blight tag | Card identity | Existing decay identity used by cards, weapons, and feats |
| Ashen Blight | Proposed run resource | A 0–100 corruption meter that persists between encounters |
| Corrupted | Proposed card tag | Identifies native corruption cards or cards transformed by becoming Blighted |

Existing Blight tags, Crimson Blight applications, and enemy buildup must not automatically increase Ashen Blight. A card needs an explicit corruption cost. Ordinary status cleansing removes temporary statuses; it does not remove run corruption.

## Native corruption cards

- Usually cost 0–1 Energy, with Mana or Stamina requirements matching the card's camp and source.
- Pay an explicit +8, +12, +16, or +20 Ashen Blight cost.
- Have Exhaust: removed for the rest of this combat after being played.
- Cannot be recovered from Exhaust during that combat, including by relics or generated copies.
- Charge corruption once after targeting, affordability, and other play validation succeed and resources are committed, before effects resolve. Misses, counters, complete mitigation, and combat-ending hits do not refund corruption.
- Rejected plays and previews spend no corruption and advance no persistent random-number generator (RNG) counters.

| Sample card | Energy | Suggested effect | Ashen Blight |
| --- | ---: | --- | ---: |
| Obsidian Reversal | 0 | Gain Guard and Ward; strengthen the next qualifying counter | +12 |
| Burial Haze | 0 | Blind enemies; discard up to two cards and draw the same count | +20 |
| Rift Grasp | 1 | Force damage and poise damage; pull a ranged enemy into melee reach | +16 |
| Cinder Shelter | 0 | Protect a friendly target; suppress one removable harmful status until next turn | +8 |

All sample cards Exhaust. Effects require normal targeting and immunity rules. Corruption offers defense, control, positioning, and hand repair as well as damage. Numbers require balance testing before implementation.

## Meter thresholds

| Ashen Blight | Label | Proposed presentation |
| --- | --- | --- |
| 0–24 | Clear | Quiet meter; corrupted cards retain their own distinctive frame |
| 25–49 | Smoldering | Ember accents on meter and character portrait |
| 50–74 | Tainted | Denser veins; eligible feats can check this threshold |
| 75–99 | Near Rupture | Prominent threshold warning and restrained perimeter pulse |
| 100 | Blighted | Resolve the run's selected full-meter rule |

Use intermediate thresholds primarily for presentation and explicit build conditions during initial balancing. Do not add hidden passive penalties. Before committing a card, show its corruption cost, resulting meter, and any full-meter consequence.

## Two full-meter rules

Pin the chosen rule to the run at creation. Present the exact odds before starting the run and when a play would reach 100.

### Rupture: requested high-risk rule

On each transition from below 100 to 100, resolve one threshold roll before the played card's benefits. This includes crossing again after Sanctuary cleansing; remaining at 100 does not trigger another threshold roll:

- **90%:** immediate death; run ends.
- **10%:** survive as Blighted; transform the deck.

Do not also perform a death check for the encounter in which this threshold roll occurs. Starting with the next encounter, perform a **10% death check after each won combat**, before rewards or final run victory. A defeat already ends the run and needs no extra check.

### Metamorphosis: recommended balance variant

At 100, transform the deck with no immediate death roll. Starting with the next encounter, perform the same **10% death check after each won combat**, before rewards or final run victory.

This preserves accumulating danger while allowing the player to experience the transformed build. Rupture preserves the requested nearly fatal threshold. Neither variant is currently implemented.

### Survival probabilities

Assuming independent 10% death checks and no cleansing or other changes:

| Situation | Chance to survive |
| --- | ---: |
| Five checks after transformation | 0.9^5 = 59.0% |
| Ten checks after transformation | 0.9^10 = 34.9% |
| Survive Rupture, then five checks | 0.1 × 0.9^5 = 5.9% |
| Survive Rupture, then ten checks | 0.1 × 0.9^10 = 3.5% |

### Overflow after becoming Blighted

Native cards must not become free of their corruption price merely because the meter is full. Keep a separate encounter overflow counter:

- Every full 10 overflow adds two percentage points to the next applicable post-victory death check.
- Death chance starts at 10% and is capped at 30%.
- After a successful death check, reset overflow to zero.
- If transformation occurs during an encounter, retain that encounter's subsequent overflow until the first eligible check in the next encounter.
- Show the current chance explicitly. Never label a raised chance as 10%.

Overflow is an optional balance extension and requires its own tests. The survival table above uses the 10% baseline without overflow.

## Full-deck transformation

- Ordinary cards gain Corrupted tag and volcanic presentation while Blighted. Preserve their original costs, targets, rank, identity, and lifecycle.
- **Do not give every transformed card Exhaust.** Doing so can make the entire deck unusable after one pass.
- Suggested numeric benefit: +20% listed damage, Guard, or Ward, rounded down. Apply only once; do not multiply draw counts, generated copies, energy, status duration, or target counts.
- Native corruption cards keep their original effects, corruption costs, and Exhaust; the transformation bonus applies only to ordinary cards.
- Apply the transformation as a run-owned runtime overlay, not a mutation of shared content definitions.
- Include cards in hand, draw, discard, Exhaust, sideboard, equipment packages, and later acquisitions. Transformation must not duplicate or reshuffle cards.
- Generated copies of native corruption cards retain their costs and Exhaust restrictions. Limit copies of each native corruption card family to one committed play per combat, preventing copying from bypassing Exhaust.

## Cleansing and build hooks

Cleansing is an explicit event; the meter otherwise lasts the run.

- Before becoming Blighted, a camp choice removes 15 Ashen Blight instead of healing.
- A rare sanctuary removes 30 Ashen Blight in exchange for one owned relic. Without a relic, the trade is unavailable.
- Sanctuary can cure Blighted: set 100 to 70, clear overflow, and remove the transformation overlay from ordinary cards. Native corruption cards remain unchanged.
- A later return to 100 triggers the selected threshold rule again; previous threshold receipts are retained for replay and audit.
- Keep cleansing outside combat so draw/discard engines cannot become unlimited cleansing loops.

| Suggested build hook | Limit |
| --- | --- |
| Ash Reader feat: first native corruption card draws one and reveals the next two deck cards | Once per combat |
| Cinder Discipline feat: at 50+ Ashen Blight, first Counter grants +3 Guard and +3 Ward | Once per combat |
| Obsidian Vessel relic: native corruption play grants +4 Ward | First such play per combat |
| Brittle Halo relic: successful corrupted counter removes one removable temporary debuff | Once per combat |
| Ash Communion card: spend accumulated Guard to weaken enemy casting; extra effect at 75+ | Normal card cost and explicit targeting |

Avoid unlimited energy refunds, recursive card generation, combat cleansing, and unrestricted Exhaust recovery. Each trigger must name its timing and limit. Status removal must respect statuses that are explicitly non-removable.

## Cooperative run consequences

Recommended co-op rule: a failed corruption roll permanently eliminates only that player's seat for the current run. Other surviving players continue the shared combat and run. If the failed roll eliminates the last living seat, the shared session ends in defeat, including after a final boss victory.

- Track terminal seat participation separately from HP, `alive`, temporary downed state, and network connection: for example, `participation: 'eliminatedCorruption'` plus an elimination receipt ID. A downed player is not automatically corruption-eliminated.
- An eliminated seat cannot act, rejoin as a replacement character, receive later rewards, or revive during this run. Healing, normal co-op revival, reconnecting, and cleansing cannot clear this terminal outcome. Starting a new run clears it.
- A failed mid-combat Rupture roll records that seat's elimination before the played card's effects. Committed costs remain spent; cancel that seat's unresolved card benefits. Continue surviving seats' normal shared combat flow unless no living seat remains.
- After a victory, freeze the authoritative eligible roster and resolve checks for all living Blighted seats in the session's stable seat order before awarding anything. Use the ordinary resolved recovery/HP state to determine who is living; connection status alone never exempts a seat. Normal downed/revival rules remain separate from permanent corruption elimination.
- Record each checked seat's outcome. Reward only surviving eligible seats after the complete check batch commits. Do not grant a shared final run victory if the batch leaves no living seat.
- The session authority rolls once. Persist the session outcome, per-seat meter/outcome changes, RNG counters, and receipt IDs atomically before publishing effects, rewards, or victory. A partial save must not leave one seat rewarded while another seat's death check can still be rerolled.
- Receipt identity includes session ID, combat ID, seat ID, and threshold crossing or post-victory check kind. Reloads, retries, duplicate completion callbacks, and reconnects reuse the committed outcomes; they never revive an eliminated seat or reroll its check.

These co-op consequences are also **proposed, not implemented**. They require a terminal seat outcome in addition to existing combat HP/downed handling; merely setting HP to zero would incorrectly allow normal revival.

## Persistence and receipts

Minimal proposed run state:

```js
ashenBlight: {
  version: 1,
  value: 0,
  cap: 100,
  mode: 'rupture',
  state: 'clear',
  overflow: 0,
  transformedInCombatId: null,
  thresholdCrossings: 0,
  lastDeathCheckCombatId: null
}
```

- Copy the run's state into combat-owned state at encounter creation. Preview clones and transactional candidates must never mutate the live run.
- Persist the current meter, overlay state, native-family play locks, overflow, threshold outcome, and committed-action receipts in combat snapshots.
- Write state back at the combat-to-run boundary and through the existing committed-action save flow.
- Add a dedicated `ashenBlight` RNG stream without moving existing stream indices. Save and restore its counters.
- Give every threshold roll a crossing ID and every post-victory check a unique combat ID. Store its rolled outcome before granting rewards or presenting final victory.
- Reloads and duplicate completion callbacks reuse the recorded outcome; they cannot reroll or charge a card twice.
- Old saves default to zero Ashen Blight, no overlay, no native-family play locks, and no pending checks. Validate numeric bounds and mode/state combinations.
- Cooperative play requires separate corruption state and receipts per player, plus the terminal participation and atomic session outcome rules above. One player's preview or card play cannot corrupt another player's meter; a corruption death ends the shared session only when no living seat remains.

Current integration references: `src/content/statuses.js` defines Crimson Blight; `src/engine/runCombat.js` owns run-to-combat projection and combat-to-run pool updates; `src/engine/combat.js` places played Exhaust cards; `src/engine/save.js` saves runs and RNG counters; `src/engine/rng.js` defines named streams. Implementation must also update run initialization/serialization and combat snapshot validation.

## Requested card appearance

- Black volcanic trim is strongest at edges and corners and fades toward the center.
- Thin volcanic ember veins branch inward from several edges and corners. Veins fade with the surrounding trim; they do not cross the center at full intensity.
- Preserve central art and keep title, cost, targets, and rules text readable above overlays.
- Print a Corrupted badge and explicit Ashen Blight cost. Color and animation alone must not communicate mechanics.
- Near Rupture may add a subtle perimeter pulse; Blighted cards may add denser edge veins and a cracked cost medallion.
- Respect reduced-motion preferences. Do not animate across the text area.

## Example play loop

1. Player enters combat at 64 Ashen Blight and sees an enemy preparing Smash.
2. Obsidian Reversal costs 0 Energy and +12 Ashen Blight. Preview shows 76 and Near Rupture.
3. Player commits it, gains Guard/Ward and a counter opportunity. Card Exhausts for this combat.
4. A successful qualifying counter creates breathing room for a normal control or attack card.
5. Next encounter restores Obsidian Reversal; run meter remains 76.
6. Camp offers healing or removing 15 corruption. Player chooses healing and accepts continued risk.
7. Later +12 and +12 plays bring the meter to 100. Preview names the selected rule and exact odds before commitment.
8. Under Rupture, 90% roll ends the run; 10% survival transforms the deck. Under Metamorphosis, transformation is guaranteed.
9. Starting with the next encounter, victories require the displayed death check before rewards. Sanctuary offers a costly escape from Blighted.

Related combat-card design: [Combat cards and example game loop](./combat-cards-design.md).
