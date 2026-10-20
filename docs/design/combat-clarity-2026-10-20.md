# Combat clarity corrections — 20 October 2026

Status: owner-approved requirements; implementation in progress.

These corrections describe the current Core game. Keep historical profile behavior
explicit where saves snapshot different rules; do not accidentally apply a Core
change to unrelated modes. Shared presentation improvements should work wherever
the same UI is used.

## Combat rules

- Precision improves hit chance only. It must not increase damage or bypass
  protection as an indirect damage bonus. Ordinary Precision expires at the end
  of its owner's turn. Only the contribution from an effect with the Persistent
  tag survives; mixing persistent and temporary applications must not make the
  temporary contribution permanent.
- A displayed enemy attack of `5 × 3` means three hits of 5 before the documented
  mitigation/modifier rules. Do not feed the total of 15 back into every hit.
  Display and execution must use the same per-hit values.
- Offer a Counter opportunity after **each hit**, including each hit of a
  multi-hit attack. Resolve that hit and its reaction before starting the next
  hit. Do not ask for all the Counters up front. Skipping a reaction continues
  to the next hit; saving and resuming preserves the exact pending hit without
  repeating payment, damage or card consumption.
  Current Core fights snapshot `reactionRules.contactPolicy: 'perHit'`. A saved
  mid-fight snapshot without that policy completes under its historical rules;
  the next newly created Core fight uses the new policy. Each newly paid Counter
  can rearm for its hit. An automatic armed Counter remains a single charge,
  and a Counter return cannot trigger an endless reaction chain. The root
  multi-hit action pays its own cost once.
- SP reduction applies only during the enemy turn when a card is played as a
  reaction and the actor was already in the matching stance. Entering the stance
  with that card does not qualify it for its own discount. Ordinary player-turn
  plays receive no such reduction. The displayed cost and execution agree.

## Action feedback and hand cards

- Identify what is used in the game: acting character, card/action, weapon where
  applicable, and effect. Do not require the player to open technical details
  to identify an action.
- Present each action in order: action identity/type, action animation, hit or
  miss, target reaction animation, then final result (such as dodged, effective,
  or damage). Complete that action and Counter before the next one.
- The default pause between indications is **500 ms**, reduced from 1000 ms.
  Preserve explicit user speed preferences and the existing Instant and
  reduced-motion behavior.
- A miss caused by range displays **Out of range** directly in the primary
  action feedback, rather than hiding the reason in expanded details.
- Default combat-log identity colors are blue for players and red for enemies.
  Expose customization and retain meaningful text labels; color is not the
  sole way to distinguish actors.
- Reduce in-hand card clutter: attack cards do not need Entry or Precision
  explanation on their compact face. Preserve full inspection and the actual
  mechanics.

## Progression and rewards

- Show the class level-up modal and the modal for the equipped weapon actually
  used. Do not silently award or present an unused equipped weapon as used.
- Equipment should already level procedurally. Find and restore the existing
  intended progression path; this request does not authorize inventing a second
  equipment XP ledger or unrelated replacement growth system.
- Reward tiles and their corresponding buttons have consistent sizing while
  remaining readable and usable at phone widths.
- A folded item-upgrade row summarizes the actual stat changes, for example
  `AR 12 → 15`. Use calculated before/after values, including relevant non-AR
  changes, rather than static promises.

## Editing and organization

Support full **Visual Studio**, not only VS Code. Provide a clear way to open,
navigate, build and test this JavaScript codebase with the existing toolchain.
Organize folders by responsibility and distinguish authored sources from
generated files. Update consumers of relocated files and preserve public entry
points, save identifiers and build behavior.

## Mobile responsiveness

Investigate loading, input latency, combat frame time and menu responsiveness
on representative constrained mobile settings. The owner reports slowdown on
a Galaxy A32 and an iPhone SE (exact variants/browser unspecified). Record
repeatable before/after measurements, separate intentional pacing from actual
stalls, and do not label desktop emulation as physical-device or Safari proof.

## Evidence required

Regression checks must cover mixed Precision lifetimes, unchanged damage when
only Precision changes, per-hit damage and Counter order, reaction eligibility
and pricing, progression attribution, and folded upgrade calculations.
Browser evidence must show primary action/range feedback, log colors,
compact hand cards, reward sizing and level-up presentation. Existing CI
assertions and time budgets stay intact.
