# Enemy knowledge playtest

The enemy-knowledge runtime implements the independently merged contract in
[enemy-knowledge-contract.md](enemy-knowledge-contract.md) and SPEC section 4.9.

## Gameplay evidence, 2026-10-08

Real normal-run interaction through the game served from this feature worktree,
in Microsoft Edge with reduced motion. Desktop: 1440 by 900. Phone: 390 by 844;
the phone context has native touch enabled (`navigator.maxTouchPoints = 1`).
Source-game tests exercised the complete normal run below. Generated-bundle
testing also verified build `0.7.1.1127`, digest `25d883ae82`, at
`/AshenSpire.html`; final combined-build captures will be refreshed before merge.

- Quick start, initial class choice and the first map encounter were entered
  through normal controls. The pack contained two Blight Hounds and a Grave Wisp.
  Duplicate hounds created one lifetime encounter receipt.
- Accepted predictions on wholly unknown actions resolved to Attack, Spell and
  Spell. The third correct execution automatically advanced Perception to level
  1, with XP 0 and pendingDrafts 0. No Perception reward row appeared.
- The phone's native Predict action button and End Turn confirmation accepted
  touch input. A committed Dodge Roll then mechanically succeeded against a
  wholly unknown action, producing earnedXp 4 and one Blight Hound bonus.
- Save and Quit, reload and Continue preserved the exact current encounter,
  intent reads/serials, prediction feedback, RNG counters and profile ledger.
- Actual card plays defeated the encounter. Reload at the victory handoff
  preserved the reward offer, level XP, RNG, fight totals and Perception exactly.
  The reward door resumed, rather than reopening or recounting the encounter.
- Native phone taps claimed Riposte and the ordinary Combat Maneuvers Backstep
  draft, then confirmed Continue and returned to the map. All three rewards
  were claimed; Perception remained level 1, XP 1, pendingDrafts 0, and its
  encounter credit remained 4. The selected cards were present in the saved deck.
- The learned Bestiary showed five stages, 2/30 Blight Hound progress after the
  tactical bonus and 1/30 Grave Wisp progress, next threshold 6, locked
  resources/moves, and no page overflow. Back and
  Escape returned to the title; keyboard inspector Escape restored its opener.
- Native touch opened the compiled inspector through its normal enemy selection
  controls. The select and Predict action button measured 44 physical pixels
  high; the panel had no horizontal overflow and its nine native options had
  no inserted glossary children. A ready Spell prediction executed correctly,
  advanced Perception automatically, and reloaded with the exact combat,
  Perception, feedback and RNG projection. The selected formation sprite's
  glow does not trap Inspect controls beneath adjacent enemy art.

![Real desktop combat](preview/enemy-knowledge/combat-desktop.png)

![Learned Bestiary with native phone touch](preview/enemy-knowledge/bestiary-phone.png)

## Storage and authority evidence

The actual browser-save facade was exercised in two browser realms with real
localStorage and navigator.locks. Concurrent disjoint learning receipts and
stale settings writes waited under the same profile lock and retained their
union. A physical partial-write/throw fault retained the complete old ledger,
old tactical bonus, stamped target and new pending receipt; retry repaired them
and acknowledged only the captured pending learning. This probe used an isolated
QA storage namespace and did not alter the gameplay profile.

Headless checks cover full solo/co-op save continuation, host-private seeded
reads, owned-seat prediction and wire projection, atomic host acknowledgment,
delayed/multi-hit/cancelled actions, inert previews/rejections, and learned-stage
DOM-model disclosure. Review also reproduced and fixed stale asynchronous
reward, start-run and terminal-completion ownership paths.

The source game's normal Load controls were also checked in two explicit
combat fixtures. After two accepted turns, the legacy combat fixture restored
its exact turn-1 encounter entry. The default knowledge-enabled combat restored
its exact committed turn-3 snapshot. Both comparisons included the serialized
combat, RNG seed and all stream counters, after the restored combat object was
adopted. The focused slot-load integration checks passed 23/23; the stock browser
driver and its known-bad corpus remain part of the hosted promotion checks.

The fresh local core run passed 370 discovered files and 3,232 tests, all 122
engine regression cases, and 150 checks with zero failures. Independent regular
and alternative source reviews found no actionable issues. Alternative focused
checks passed 69/69, with protected-path auditing retaining all variant art.

Optional audio samples returned 404 and used the existing procedural fallback.
Map/music requests cancelled during navigation were recorded separately. No
JavaScript runtime exception was observed in the gameplay interactions.

## Delivery state

Source implementation and focused validation are committed. Final generated
receipt/build, complete local tool suite, PR checks and regular/alternative
dev/test promotions remain pending. This evidence does not claim release/main
promotion or physical owner/device acceptance. Phone evidence is a browser
viewport with native touch enabled, rather than a physical handset test.
