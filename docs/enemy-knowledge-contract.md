# Enemy knowledge, Perception and hidden intents

Status: implementation contract, 2026-10-07. Extends SPEC §4.8 and the Martial
and Spell version-2 expansion. This contract must land separately before its
runtime implementation. It supersedes §4.7's precise hidden stance disclosure
only for runs carrying `enemyKnowledgeRules.version: 1`; historical runs and
saved combats retain their carried visibility rules. This marker is independent
of tactical combat version 2. No release/main publication is authorized.

## Seeded intent reads

- Move selection stays on `enemyAI`. Knowledge never selects, rerolls, skips or
  consumes that stream. Each newly selected action has a saved serial number.
- For each living observer, resolve exact identification first:
  `clamp(baseExact + WIS*wisdomExact + INT*intelligenceExact +
  max(0, characterLevel-1)*levelExact + perceptionLevel*perceptionExact,
  minimumExact, maximumExact)`.
- Proposed configurable defaults are `baseExact=.30`, `wisdomExact=.01`,
  `intelligenceExact=.01`, `levelExact=.005`, `perceptionExact=.03`,
  `minimumExact=0`, `maximumExact=.90`. Coefficients are percentage-point gains,
  not multipliers. At WIS 3, INT 2, level 5, Perception 2 the chance is 43%.
- On a failed exact read, test a separate broad-clue probability with the same
  shape. Defaults: `baseClue=.50`, `wisdomClue=.005`,
  `intelligenceClue=.005`, `levelClue=.0025`, `perceptionClue=.02`,
  `minimumClue=0`, `maximumClue=.90`. This probability is conditional on failing
  exact identification. With zero modifiers, unconditional results are 30%
  exact, 35% clue, 35% completely unknown.
- Use independent streams `enemyIntentVisibility` and `enemyIntentClue`. Consume
  both once per observer per new action, even if exact identification succeeds,
  in stable seat order. Previews, inspection, rejected actions and restoring a
  snapshot consume neither. Delayed committed actions keep their read and serial.
- The only hidden labels are:
  - `?`: no actionable clue.
  - `Attack?`: physical Attack, Smash, Sweep and Ranged attacks.
  - `Magic?`: spell payloads which are ready to execute now.
  - `Preparing?`: Defend, Counter, Casting/charging and other preparation.
- Mapping precedence is Staggered (public exact), then Defend/Counter or a
  charging/pending-delay action (`Preparing?`), then a ready spell payload
  (`Magic?`), then physical Attack/Smash/Sweep/Ranged (`Attack?`), then all other
  support actions (`Preparing?`). Casting means preparing a spell rather than
  its ready payload. Exact labels distinguish Casting from its released spell.
- Exact reads display the actual action/maneuver and its live effects. Public
  Staggered remains exact. A hidden read is an allowlisted projection: no selected
  move ID, maneuver, precise stance, camp, school, damage, hit count, Block, tags,
  delay payload, active card, phase implication or unspent reaction payload.
  Animation before execution must not reveal a hidden action. Past performed
  actions and visibly applied statuses remain public facts.

## Run Perception and accepted predictions

- Perception is a run skill, starting at level 0 for each new run. It uses its
  own configurable curve: `base=3`, `growth=1.5`, `roundTo=1`, `maxLevel=10`;
  `correctPredictionXp=1`. It grants identification chance, without card drafts,
  auto-upgrades or persistent class mastery. Bestiary levels never add Perception.
- The authority accepts one `predictIntent(enemyInstanceId, actionSerial, maneuver)` per
  observer per action while it is wholly `?`, before that action resolves.
  Choices are Attack, Smash, Sweep, Ranged, Defend, Counter, Spell, Casting,
  Preparing. `Spell` means a ready spell payload; `Casting` means its committed
  preparation/charge. `Preparing` is the fallback prediction category for other
  support actions, not a new mechanical stance. Use the same precedence as the
  clue mapping to normalize every authored move to one prediction category.
  The request validates phase, living seat/enemy, current serial and choice.
  Rejected requests are transactional and consume no resources or randomness.
  A prediction cannot be replaced or repeatedly submitted to farm credit.
- A prediction earns XP only when the selected action actually executes and
  matches the accepted choice. Submission and matching previews award nothing.
  Cancelled/skipped/dead-enemy actions award nothing for a passive guess.
- A mechanically successful tactical counter/response against an initially
  wholly `?` action can also earn one XP, without a separate explicit guess.
  Require a real committed benefit: counter retaliation after absorption,
  successful avoidance, or realized authored matchup benefit. Merely preparing
  a stance, playing an eligible-looking card or testing a preview is insufficient.
- The same action can pay at most once per observer, even when both a prediction
  and a counter succeed, it has multiple hits, or its delay spans turns. Save the
  original visibility, prediction, serial and credited flag. In-combat earned XP
  improves later newly rolled reads; it does not reroll a current intent.
- Combat receipts reconcile to the run exactly once. Failed fights retain earned
  Perception in the run until it ends; a new run starts fresh. Existing skill and
  save validation recognizes this dedicated track and rejects malformed state.

## Persistent five-stage bestiary

- Knowledge lives in the local durable profile per stable enemy definition ID.
  It survives run termination and never discloses a future selected hidden action.
  A fresh/older profile begins with no learned enemy facts, not invented mastery.
- Count one entered real encounter per enemy definition present, independent of
  duplicate copies of that enemy and victory. Inspection, previews, sandbox tests,
  rejected entry, restarting the same saved encounter and reconnecting do not count.
- Each encounter supplies one base knowledge point. A committed successful
  tactical response supplies one bonus point, capped at one per enemy definition
  per owner per encounter (even with multiple instances, actions or hits).
  Each party member has an independent cap and must earn their own benefit.
  A correct passive guess alone does not supply a counter bonus.
- Default mastery costs 30 points. Per-enemy `encountersToMaster` is configurable
  from 20 through 50; author optional pacing overrides as data. At default pacing
  mastery takes 30 ordinary encounters or 15 encounters with a correct counter in
  each. Across the allowed pacing band it takes 20–50 ordinary or 10–25 fully
  countered encounters, within the owner's requested approximate ranges.
- Snapshot the mastery target on first learning that enemy. Existing knowledge
  cannot be reduced or re-priced when settings change. Clamp points to mastery.
  Persist encounter receipt IDs and a bonus bit per receipt; merge by receipt
  union and bonus-bit OR, then derive capped points from that union. The current
  durable profile's already-stamped mastery target is authoritative over a stale
  incoming target. Do not use `max(points)` to merge disjoint earned receipts.
  Monotonically merge profile writes against current durable progress. Delayed/stale settings
  writes must not lose knowledge or reopen paid encounters. Stop recording new
  progress receipts for a mastered enemy so the per-enemy ledger remains bounded
  by its at-most-50 contributing encounters. Preserve original encounter receipts
  at mastery to reject replayed saves, and preserve profile archive/quarantine rules.
- Encounter identity combines a unique saved run/room receipt, node/encounter
  identity and a saved visit ordinal where repeat entry is legitimate. Reuse the
  existing caller-owned unique run receipt where available. Seed alone is not
  identity: two genuinely new runs using the same seed may both earn knowledge.
- Stage 0 means unencountered. Five learned stages use thresholds
  `1, ceil(target*.20), ceil(target*.40), ceil(target*.70), target`:
  - **1 — Encountered:** identity, lore and general role; publicly observed history.
  - **2 — Studied:** base HP range, Poise/other resource ranges and defense facts.
  - **3 — Familiar:** authored move names and broad tactical categories.
  - **4 — Understood:** base move effects, damage types and general counterplay.
  - **5 — Mastered:** authored repeat limits, phase thresholds and delayed-action
    rules. Catalog facts never highlight a hidden current selection or predict
    the next roll. Live effects appear only for an exactly identified intent.
- Unknown sections use explicit locked wording and next-unlock requirements.
  Do not expose unreached facts in hidden DOM, tooltips, accessibility labels,
  move-card models or offline bestiary projections. Known-empty differs from locked.

## Co-op authority, privacy and saves

- The host selects actions, rolls per-seat reads and accepts predictions and
  success receipts. Guests request an action/prediction, never invent credit.
  Matchup benefit credits the responding owner only, not the whole party.
- Co-op read randomness uses an injected host-private seed with independent
  visibility/clue streams, not the publicly broadcast map/run seed. Persist the
  private seed and counters only in the host save; neither is sent to guests.
  The authority sorts observer IDs before rolling. Tests may inject a fixed
  private seed. This prevents clients reconstructing another observer's rolls
  from the ordinary published seed and known stream salts. The host itself is
  trusted, and couch seats share one device; this is peer projection privacy,
  not secrecy from a host administrator or someone reading the host save.
- Durable progress belongs to each member's own profile. The host emits/project
  authenticated owner-specific learning receipts; guests bank only their seat's
  accepted receipt. No peer profile is written or pooled. Local display reads
  only the viewer's visibility and learned facts. Other seats' rolls, predictions,
  credited flags, raw intent payloads and private learning ledgers are omitted
  from their public projections. Host restoration may retain authoritative state.
- New run/combat/profile state has versioned validation and migration. Legacy
  saves restore their carried intent behavior without another roll or retroactive
  learning. Persist unique identities, serials, reads, predictions, XP, bounded
  counter bonuses, receipts and stream counters. Load does not reconstruct credit
  from the log or overwrite committed decisions with authored defaults.
- Snapshot the full exact/clue/Perception tuning at new-run creation, not just
  its version marker. Continuing a run after a settings/content update keeps its
  carried coefficients and curve. Bestiary pacing is separately stamped on the
  enemy's first learned profile record.
- Profile writes use verify/read-back durability and surface a storage failure;
  keep pending run receipts so a later successful bank can retry idempotently.
  Same-profile writers must be serialized by the storage owner; browser entry
  points use a per-profile lock where available. Headless tests inject one
  synchronous owner. Cross-tab changes refresh and merge inside that lock;
  read-back verification alone is not claimed to prevent concurrent overwrites.

## Inspection and acceptance

- Provide a keyboard-accessible Bestiary inspection door from the normal game
  reference/profile flow and enemy inspector. Use readable responsive rows,
  explicit five-stage bullets, current stage, points/target, next stage and a clear
  distinction between run Perception and lifetime enemy knowledge. Preserve
  Escape/close behavior, focus trapping/restoration and regular/alternative art.
- Add a prediction control to the enemy inspector only for an eligible wholly
  unknown action. Show the accepted prediction and resolution feedback; never
  label an unconfirmed prediction as correct. Controls have names and touch targets.
- Validate probability bounds and conditional distributions, separate seeded
  streams, inert previews/rejections, progression during combat, one credit per
  multi-hit/delayed action, cancelled actions, bonus limits, duplicate enemy IDs,
  repeated-seed fresh runs, stale profile writes, failed-write retry, exact solo
  and co-op save continuation, per-seat authority/privacy, legacy compatibility,
  learned-stage disclosure and malformed content/save state.
- Require focused tests, the core suite, real desktop/phone inspection and
  prediction interactions with screenshots, component-catalog updates, review,
  generated receipts, regular dev/test and alternative dev/test exact-head checks.
  Owner/device acceptance remains a separate playtest outcome.
