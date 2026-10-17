# Shared base-card status hooks

`games/ashenspire/packs/base-cards/statuses.json` is the numeric authority.
Registry definitions use namespaced `base.*` identities and `decay: none`.
The pure planners in `src/model/proposalStatusRules.js` own explicit decay;
engine adapters execute their ordinary effects and status changes exactly once.
They do not execute a second action interpreter or mutate combat objects.

The author compiler exports `baseCardStatuses` and `baseCardStatusRules`.
Registries expose the latter as `proposalStatusRules`. Pass that map as `rules`
to every hook. With no matching status or no rules, all hooks preserve ordinary
behavior.

## Capabilities and projections

Pass enabled module IDs as `capabilities.modules`, supported elemental damage
IDs as `capabilities.elements`, and supported protection pools as
`capabilities.protections`. Omitted lists admit all for the full current game;
explicit empty lists admit none. Core passes `elements: []` and its supported
protection pools, excluding elemental statuses and Barrier when unavailable.
Rules test their explicit requirements; card/group admission also excludes
incompatible cards before they can enter rewards or a deck.

## Calling contract

All plans contain ordinary engine effect jobs with `op`, `amount` or
`status`/`stacks`, and `sourceId`/`targetId` where a target is already known.
An extra weapon copy retains its original effect target for the normal target
resolver. `statusChanges` are `{actorId, status, delta}` and apply only on a
committed lifecycle event, never during pricing or preview.

| Hook | Caller timing and result |
| --- | --- |
| `proposalTurnRules` | After normal owner-turn protection reset, phase `start`; before owner turn finishes, phase `end`. Returns `effects`, `statusChanges`, and optional `checks`. An injected `roll(check)` returns an integer 0..99 for Grease's prone chance. No roll means a preview plan only. |
| `proposalThresholdRules` | After status application or any HP change. Returns immediate `loseHp` jobs for lethal Blight, with dead actors excluded. |
| `proposalCardRules` | Pricing/eligibility reads `allowed`, `refusal`, `staminaTax`, `manaTax`, `additionalStanceCapacity`, and `revealIntent`. Its `effects` and `statusChanges` are extra equipment actions committed **after** successful play. |
| `proposalTargetRules` | Before paying for or resolving a single-target action. Returns pending perception/Evade checks, accuracy delta and unavoidable flag. Pass `perceptionRoll` and `evadeRoll` to commit checks; failed Evade also consumes its charge. Area actions bypass Veil. Cache one decision per action, including all its hits. |
| `proposalHitRules` | Connected pre-protection hit, once. Pass original `amount`, `damageType`, `camp`, `range`, `card`, and target-side `allies`. Returns adjusted `amount`, converted `healing`, ordinary secondary `effects`, status consumes and guard `redirect`. |
| `proposalAfterHitRules` | After a connected hit. Pass `incomingDamage` before protection and actual `hpDamage`; a fully blocked matching hit still consumes persistent protection. `opponents` are actors opposing the defender, used by automatic Sweep. Returns reaction effects and status consumes. |
| `proposalHealingRules` | Before applying typed healing. Returns remaining `healing` or inverted `damage`/`damageType`. Only Divine/Sacred/Holy healing is inverted. |
| `proposalRetainProtection` | At normal Block expiration, before beneficial start-decay. Returns the portion of existing protection to keep; it never generates Block. |

All secondary hits/reactions carry `proposalReactive: true`. Feed that flag as
`reactive` when resolving them: they cannot duplicate enchantments/equipment,
redirect recursively, reflect again or trigger automatic reactions. Fire can
still benefit from Grease, but reactive fire does not create recursive splash.
Damage-over-time packets are `direct: false`; Intangible, Evade, guard and
ordinary reactive returns do not treat them as direct actions.

## Concrete defaults

Persistent Block/Barrier replenish each pool up to remaining stacks, not by
adding that many protection every turn. Connected positive matching physical /
spell hits consume one stack even when all HP damage is prevented. They never
passively decay. Barrier is a protection pool, not the Ward break meter.

Harmful statuses decay one stack at owner turn end; beneficial duration statuses
decay at the next owner turn start. This gives one applied stack a meaningful
opportunity to affect its next action or incoming enemy action. Grease checks
Prone at owner turn start. Poison ticks one necrotic/Decay damage per stack at
that start, independently of legacy Venom. Blight kills when its stacks reach
**current** HP.

Grease uses a 25% Prone chance, −20 Melee/Reach accuracy, unavoidable 3× Fire,
Burn 3, and splash of 1.5× the **original** incoming Fire hit to other living
same-side actors. Intangible caps direct damage at one after damage
multipliers. Necrotic conversion precedes protection caps and restores equal
HP instead. Mirrors multiplies direct outgoing damage by two; stacks extend
duration rather than exponentiating its coefficient.

Charm reduces attack accuracy by 25. Bind blocks Attack cards, not all actions.
Actual Restrained taxes Melee/Reach by one SP. The generated burden markers
`base.stagger`, `base.paralysis`, and `base.restrained-burden` are tracking-only:
burden-card metadata owns their action loss/taxes, preventing double payment.

Foresight grants two Perception per stack. Veil detection is
`clamp(50 + 5 × Perception advantage − 10 × Veil stacks, 5, 95)` percent.
Perception is an explicit actor value, falling back to Wisdom + Intelligence.
Evade consumes a charge for a 25% attempt against a direct physical action,
including failed attempts. Unavoidable Fire bypasses Evade.

Elemental Weapon adds a separate three-Fire packet, preserving weapon damage
and protection accounting. Extra Weapon and Extra Shield repeat their eligible
primary damage/protection once, without another payment. Automatic Counter
returns six physical damage at Melee/Reach; Sweep returns four to each opponent.
Reflect returns half actual HP damage, rounded down. Interpose redirects up to
four damage per stack and consumes a charge; competing guards use stable actor
ID ordering. Hold Block keeps up to four existing Block per stack. Many Forms
adds one stance capacity per stack; its default card applies one stack for two
total concurrent stances.
