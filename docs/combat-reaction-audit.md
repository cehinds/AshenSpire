# Enemy knowledge, reactions and combat controls audit

Current source checkpoint: `1974b9b386440949a383522fd4cdea592df5104a`, including current dev combined appearances and artwork. Official packaged build: `0.7.1.1168`, source digest `e8982e69ab`. This checklist distinguishes implemented behavior from validation and delivery. Historical saves retain their previous rules. [Viewed packaged captures and reproducible measurements](qa/combat-reactions-2026-10-08/README.md).

Already implemented in the inherited enemy-knowledge runtime:

- [x] Hidden intent clues, seeded exact reads and private per-player co-op knowledge.
- [x] Predictions and learning credit based on actions actually performed.
- [x] Perception progression and staged Bestiary learning with durable save/resume.

Implemented in this reaction runtime:

- [x] Enemies act one at a time. Automatic Counter returns pause incoming presentation, animate the defender, deal return damage and then resume.
- [x] Each actor reveals its actual current intent at its turn start. New intent clues are refreshed at the next player-turn start.
- [x] Affordable owned in-hand Counter and explicitly defensive Sweep cards are offered before an incoming attack or automatic Counter return.
- [x] Multiple choices and legal Upcast tiers appear without spending resources until Play. The combat waits for the answer.
- [x] Back, header close and Escape skip the current reaction and resume the incoming action.
- [x] Defensive Sweeps respond to a real incoming action; Counter preparation alone does not trigger them.
- [x] Exact pending-reaction snapshots preserve ownership, resources, random state, frozen contacts and nested card choices. Invalid continuation state is refused atomically.
- [x] Terminal Counter victory and Back defeat clear continuation before a durable save in solo and co-op; refused writes preserve the live fight. Terminal Blight also saves under the new rules.
- [x] The whole player mini HUD sits above visible sprite art with a fixed 10 physical pixel gap; selection and status expansion grow upward.
- [x] The right Combat log button has the Reaction switch directly underneath, with the requested gold motif, green/red fill and outlined white text.
- [x] The reaction preference affects optional prompts while preserving already armed automatic Counters.
- [x] The translucent log unfolds upward, scrolls by round, and offers Small, Medium and Large heights derived from current card, viewport and menu geometry.
- [x] The public log reveals only executed actions, preserves stable event indices, and remains read-only during playback.

Validation and delivery:

- [x] Independent source review is clear after fixes for continuation, disconnected contacts, controls focus and per-seat hand cleanup.
- [x] Independent review also cleared co-op authored animation timing and phone hand clearance, then the combined-appearance merge and canvas body tracking. Counter returns bypass cached preparation plans in both appearances.
- [x] Focused regression suite: 90 pass, 0 fail, 0 skip.
- [x] CI corrections: terminal regression cases, explicit historical fixtures, current-rule bot and knowledge commands, canonical copy with permanent protection, shared zoom conversion and registered listener cleanup. Current-dev focused suite: 35 pass, 0 fail, 0 skip. Separate copy/simulation suite: 13 pass, 0 fail, 0 skip.
- [x] Source-browser desktop and native-touch reaction sequencing, Back behavior, control sizing and selected HUD gap were exercised.
- [x] Combined-appearance focused suite: 42 pass, 0 fail, 0 skip; component contracts: 22/22; copy baseline matches. The prior UI correction suite also passed 28 tests.
- [x] Final packaged desktop, touch emulation, reduced-motion, 320 px and real LAN checks. Counter timelines on desktop, touch, Classic and both LAN clients finished with zero watchdog completions; defensive Sweep was actually played under reduced motion. Page errors were zero; optional audio/reload network failures are recorded with the evidence.
- [x] Prior source checkpoint `5f10b47222` full discovery completed: 381 files, 3,313 tests, 0 failed. This does not certify the later appearance merge or the still-running remainder of that full command.
- [ ] Full Node suite actual successful completion.
- [x] Official final build completed with all four matching aliases. Build identity, explicit PR #1767 receipt, shipping and changelog-order gates passed.
- [ ] Exact ready PR/head review, fast CI and dev merge.
- [ ] Variant reconciliation, architecture sync and primary/alternative test promotion with successful exact-head checks.
- [ ] Physical-device and owner visual acceptance.

The unchecked entries are required follow-through or acceptance, not a claim that the source behavior is missing. Release/main promotion remains owner-controlled.
