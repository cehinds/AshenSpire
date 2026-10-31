# Card animation mapping

Live character stages and the Reading Desk assemble their sprite family through `src/model/cardAnimationFamily.js`. The shared family includes each character's base actions, reviewed Counter/Sweep sprites, selected Reaver greatsword sequences, and the Rogue/Starseer/Herald Smash sequences. Its timing helper is also shared, including the weighted timings used by the selected sequences.

The action resolver still reads the played card's combat identity. The Reading Desk now uses the same combat-projected definition (including upgrades, ranks and equipment profiles), owner class, presentation policy and expansion version. The presentation policy preserves the current class-default weapons; changing equipment prices or effects does not newly swap those sprites. Co-op continues to pass the acting party member's class to the same resolver.

| Card action | Live action | Reading Desk |
| --- | --- | --- |
| Attack, Smash, Sweep, Defend | Selected owner's reviewed family | Same family, phases and timing |
| Spell/cast, ranged, ranged magic | Selected owner's corresponding base action | Same class-specific action |
| Counter preparation | Held `counterPrepare` pose until a qualifying return | Demonstrates the conditional return, using the same reviewed Counter or selected Counter-Guard/Counter-Evade clip that live retaliation uses |
| Pure Dodge/Evade | Explicit `evade` action | Same action and per-character fallback |

Only the reviewed Reaver package currently contains a dedicated Evade roll. Rogue, Starseer and Herald reuse their own Defend sequence for this action; they do not borrow Reaver sprites. This is an authored-art limitation, not a claim of a distinct Evade animation for every character.

Inspection remains an explicit checkbox option. It plays at half combat speed, pauses for one second between loops, respects reduced-motion and pause controls, and disposes the previous stage and animation frame when selection changes. The preview never mutates combat or deck state.
