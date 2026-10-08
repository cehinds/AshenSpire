

# Combat expansion implementation contract

Owner authorization: implement the revised combat notes in one delivery and land them in regular and alternative dev/test (2026-10-07).

- **Accepted rules**
  - The complete rules in [the revised combat notes](combat-cards-expansion-proposal.md) are the behavioral contract for expansion version 2.
  - Values labelled Suggested become configurable initial defaults for this implementation, not omitted features.
  - This implementation contract overrides conflicting earlier proposal wording: prepared Counter mitigation and reply are one charge consumed by the first eligible committed incoming action, even when that action does not qualify for a return. Mitigation therefore applies to that action only, not the rest of the prepared window. Large authored buildup can complete multiple protected or active fills in one action, including Frozen, Sleep, and Paralysis; version 2 retires their earlier one-new-stack-per-action exception.
  - The concrete Reaver example takes precedence over the retired version-1 automatic Counter return multiplier and flat bonus: return exactly the authored reply after the attack action is fully absorbed.
  - Counter preparation grants only authored protection. A card with no protection effect grants none; its preview must make that clear.
  - Shield Bash is Counter, including its mounted variants; its authored Block and Poise reply follow the same preparation and full-action qualification rules.
  - Every shipped class and enemy move receives explicit camp, stance, reach, targeting, and applicable school/damage/trait tags. Existing Attack/Skill/Power lifecycle remains a separate property.

- **Activation and compatibility**
  - New runs snapshot expansion version 2 and its tuning. Old runs and old combat snapshots retain their carried rules and version-1 behavior.
  - Direct headless fixtures may explicitly select either rules version. Current-shape saves validate carried expansion fields; migration never draws random numbers.
  - Solo, co-op seats, previews, and enemy attacks use the same rules. The host's combat snapshot owns shared tuning; player-specific state remains on the acting seat.

- **State and ownership**
  - Each actor carries one persistent tactical `combatStance`, prepared Counter coverage/payload, persistent Ward and starting-Ward cap, status gauges/stacks, recovery/Resolve state, and once-per-cycle budgets. Existing class stances entered through `enterStance` (including Gorefire, Bulwark, and Brace) remain in the separate actor `stanceId` channel and coexist with `combatStance`; class-stance replacement continues only within that existing channel.
  - Each accepted action has one saved resolution receipt per affected target: modifiers, avoidance roll, all direct-damage contacts, absorbed damage, independent status pressure, and eventual reaction.
  - A multi-hit action rolls avoidance once and returns at most one Counter after the complete action's direct contacts, independent status pressure, and impact. Stagger, incapacitation, replacement stance, defeat, or interruption cancels a pending reaction.
  - Every action has exactly one camp, and every direct-damage contact in that action inherits it; mixed-camp actions are invalid. Sum direct-damage contacts after authored modifiers, apply the stance matchup to the action total, and round a positive result up. Then apply active Sleep and Prone received-damage percentages together to that rounded subtotal and round a positive result up again before distributing it over contacts. This two-stage order retains the revised notes' rounding; damage type remains per contact and does not change camp. A reply still requires the complete incoming direct-damage action to cause no HP loss.
  - The first eligible committed incoming action spends the prepared Counter's mitigation/reply charge whether or not fully absorbed. The stance remains visible but cannot rearm or halve another action without new preparation.
  - Distance avoidance is checked once before explicit Evade. A successful distance check preserves the explicit Evade charge; a failed distance check permits one d20 Evade roll. Evade requires strictly greater than its DC, with no automatic natural-20 success.
  - Tactical stance, preparation, avoidance, and action receipts belong to the actor/seat. Existing class stances and Class Power buffs remain independently authored state/modifiers, not additional tactical stances.
  - Preview, cancelled target selection, failed affordability, and rejected plays consume no resources, RNG, stance, rank, milestone, or Blight.
  - Random outcomes commit through the existing seeded streams and survive save/restore; reopening or copying a resolved action cannot reroll it.

- **Protection and control**
  - Version 2 uses persistent Ward for magical damage reduction and complete magical gauge fills; temporary Barrier remains separate from Martial Block.
  - Completed status gauges spend Ward or physical Poise protection as specified in the revised notes; a fill that reaches zero protection may apply its stack.
  - Authored buildup units are distinct from explicit active-stack grants. A large buildup can complete multiple fills with retained overflow and the authored faster follow-up threshold, up to its active-stack cap; version-1 once-per-action pressure caps, including the Frozen/Sleep/Paralysis exception, do not apply. Reaction/wake finalization still occurs once per complete action.
  - Sleep/Paralysis/Dazed expose recovery actions outside deck piles and lock ordinary cards. End Turn and built-in recovery remain legal through simultaneous locks.
  - Recovery costs, automatic escape, Resolve fallback, Sleep restoration caps/fractional carry, Prone modifiers, status counters, elemental interactions, and equipment resistances follow the revised notes.

- **Rank and card sequence**
  - Upcasting is opt-in per card and charges both +1 Mana and +1 Stamina per rank above base. Cards author incremental effects or fixed rank breakpoints.
  - The optional post-target rank modal defaults off. Eligible selected cards expose an Upcast control; cancellation is inert.
  - Generated recovery cards cannot be copied or upcast unless explicitly authored. Replica plays pay their own costs and Blight; effect echoes do not recursively count as new plays.
  - Tag/status-triggered feats, relics, and cards use explicit once-per-owner-cycle budgets and expose the qualifying trigger in their text.

- **Ashen Blight**
  - Per-character run state includes value 0–100, transformation/death outcome, claimed milestones, selected two-benefit/one-drawback feats, queued choices, and corruption combat-entry receipts.
  - Native corrupted cards pay irreversible printed Blight on every accepted play and Exhaust for that combat. Ordinary Decay causes no Blight.
  - Crossing 25/50/75 queues the matching locked-tier choice once. At 100, resolve the one-time 90% loss check before card effects or choices; survivors convert the entire present/future deck.
  - Blighted survivors make one saved 5% death check at each subsequent combat entry. Reloads, retries, clones, and reward reopening cannot repeat any check or feat claim.
  - Converted cards retain their ordinary lifecycle and receive the revised notes' cheaper Action cost and authored damage/healing/temporary-protection bonuses. Recovery and upcast surcharges are excluded.
  - X-cost cards retain X; only fixed ordinary Action costs receive the conversion discount. Cinder Sight uses an explicitly selected eligible buildup, with authored-order selection as the deterministic default. Ashen Heart spends its cycle budget on its first positive authored restoration attempt even if the pool is full.
  - Milestone attribute benefits use an effective-attribute projection without changing allocated points. Accepted corruption payments and committed encounter outcomes persist before presentation/broadcast; a failed durable save rejects the candidate. Revival cannot intercept terminal Blight loss.
  - The run bar, milestone choices, feat drawbacks, printed card price, and fading volcanic treatment must be playable and inspectable in both game variants.

- **Verification and delivery**
  - Cover rejection/preview/save/restore, multi-hit and Area Counter boundaries, mixed defenses, lock recovery with zero Stamina, upcast cancellation/affordability, co-op seat ownership, and corruption exploit boundaries with semantic tests.
  - Verify the actual desktop and phone combat UI, card labels, status/recovery controls, optional rank modal, and milestone selection through real interactions.
  - Implement and review the whole expansion before runtime dev merges. Preserve variant-owned presentation when reconciling alternative dev.
  - Promote both dev branches to their corresponding tests; all required primary and alternative workflows must pass on the promoted revisions.
