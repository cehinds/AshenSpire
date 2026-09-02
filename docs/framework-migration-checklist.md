# Framework migration — the checklist

What the "AshenSpire Data-Driven Property Framework — one-shot rebuild"
contract asked for, what shipped, what did not, why, and what is being done
about each gap. Companion to `docs/framework-cutover-report.md` (the gate
evidence) and `docs/versioning.md` (why the stamp reads `0.5.0-rc.<n>` — `rc.3` today).

Status words (as of the commit this file ships in — a row that names a branch
not yet merged into `dev` is dormant here until that branch lands):
**LIVE** — the running game decides this through the framework
today · **ADOPTED** — the shipped implementation is the framework's, behind a
framework door · **BUILT, DORMANT** — implemented and tested, reachable by
no shipped content or screen yet · **PARTIAL** · **NOT BUILT**.

## A. The contract's deliverables

| # | Contract feature | Status | Where | If not LIVE: why, and the fix |
|---|---|---|---|---|
| 1 | Canonical registries (Property/Term/Asset/Content/Confirmation/Theme) | LIVE | `src/framework/registries.js`, `schema.js`; every registries instance carries `framework` + `frameworkTerms` | — |
| 2 | Deterministic property compiler with source precedence | LIVE (decisions) | `compiler.js`; lifecycle/cost/keyword decisions compile from it (#509–#510) | — |
| 3 | Card lifecycle & zones (innate, unplayable, exhaust, retain, ethereal, power removal, seal, recall) | LIVE for every legacy rule; seal/recall BUILT, DORMANT | `lifecycle.js` via bridge | No shipped card authors `lifecycle.seal` / `recall.afterUse`. Fix: content authoring (a design act — first cards proposed in the D-branch below). |
| 4 | Cost compilation incl. Power reduction, X costs, atomic alternative costs | LIVE; alternative costs BUILT, DORMANT | `costs.js`; card faces, tooltips, both engines (#510, #516) | No shipped card authors `cost.alternative`. Fix: content authoring. |
| 5 | Deck composition (attack/guard/technique slots, dual-wield split, unarmed fallback) | ADOPTED (owner ruling) + contract-new outputs BUILT, DORMANT | `deckComposition.js` door; `deck.js` is the spec | grantedCards + weaponArtDefaults compose, reconcile on equip/swap/load (#513) but no armament authors either. Unarmed Evasive Guard / Dodge Roll package: see A-9. |
| 6 | Weapon-art SLOT management (install/replace at the blacksmith) | ADOPTED (ruling) | the technique role: every armament's `techniqueProfile` card IS its installed weapon art; Dodge Roll is the unarmed art (#523) | The contract authors no weapon-art cards beyond the unarmed one and no slot counts or install costs, so there is nothing described to install or replace. Ruling: the technique role is the weapon-art slot; install/replace opens the day art cards are authored. |
| 7 | Mana & Stamina rules (Wisdom/Intelligence weights, idle stamina recovery, refund rule) | **LIVE** (#523 merged): `bridge.staminaTurnEnd` runs at the end of every player turn, solo and co-op, and `staminaSpentThisTurn` decides idle | `bridge.staminaTurnEnd` over `resources.js` at the end of the player turn; `staminaSpentThisTurn` counter | Idle turns recover `idleRecoveryPerTurn`; spending turns do not; refunds never erase a spend (no refund source exists yet). |
| 8 | Weight Class & Dodge Roll (capacity from CON/STR, Light/Medium/Heavy, dodge d20) | **Readout LIVE** with #520 (`bridge.weightClass` decides the class; the Armoury shows load, capacity, percent and class, and the comparison shows the swap's before/after); **Fight LIVE** with #523 (merged): `playerWeightClass(combat)`, the `dodgeRoll` opcode and the class-priced dodge | `bridge.weightClass` / `playerLoadReceipt` (Armoury), `playerWeightClass(combat)` + the `dodgeRoll` opcode (fights) | Weights come from `weapons.csv`; armour weighs its `poiseThreshold` (A-side). The census (`tools/weightclass-census.mjs`) found the contract's capacity base 50 left every reachable kit Light; the shipped base is **0** (capacity = 2·CON + STR), the base at which every class can reach Heavy at its standard preset while no creatable start begins Heavy — the numbers and their derivation live at `mechanics.json`'s `capacityBaseNote`. The pure dodge is priced by the class (#523). |
| 9 | Unarmed fallback package (Unarmed Strike, Evasive Guard, Dodge Roll) | **LIVE** (#523 merged), widened by the owner's correction in #554: the dodge rides as long as ONE hand is empty | base cards `evasiveGuard` / `dodgeRoll` authored as the contract's entities; the unarmed guard and technique profiles resolve to them; `mechanics.unarmedPackage.emptySlotWeaponArtId` is the empty hand's art | A run with both hands empty composes Evasive Guard in every guard slot and Dodge Roll in every technique slot. With ONE hand armed and the other empty, the armed hand keeps its own technique and the empty hand contributes a Dodge Roll weapon-art instance of its own (`unarmed:<hand>`), minted and dropped as the hands change; a shield is a full hand and a two-handed armament fills both. Armed-with-both-hands play unchanged. |
| 10 | Whitelisted inheritance (PERMITS relations) | LIVE (compiler) | `inheritance.js` | — |
| 11 | Terminology through TermRegistry (keywords, statuses, stances, resources) | LIVE | bridge `keywordDisplay`/`resourceWord`; `termOverlay.js` everywhere status/stance words render (#511–#514) | — |
| 12 | Status-effect semantics | ADOPTED | `statusSemantics.js` door (#516) | — |
| 13 | Confirmation policy (static severities) + level rule (fail-closed derivation) | LIVE / ADOPTED (owner ruling) | `confirmationRule.js`, ConfirmationRegistry (#510–#511) | — |
| 14 | Option-decision interaction router (tap-to-review / hold-to-commit) | ADOPTED | `optionDecision.js` door, all consumers (#512, #514) | — |
| 15 | Shared presentation system (components, tooltip engine, modal grammar, fitText, theme data) | PARTIAL | `presentation/` components exist; card faces/tooltips read framework decisions; screens still render through legacy components | The port moved decisions and words; the DOM renderers are legacy. Fix: not a behavior change — a renderer-by-renderer adoption, lowest value, last. |
| 16 | Legacy importer of every legacy entity with stable ids — 395 at this commit (196 cards, 41 equipment, 50 statuses, 19 enemies, 4 classes, 55 relics, 7 flasks, 22 locations, 1 UI surface; `importLegacyContent(contentBundle).counts` is the authority, the number here is its reading on 2026-09-02 after the first quest chain's two events) | LIVE (data) | `importer.js` | — |
| 17 | Complete validation + known-bad corpus | LIVE | `validate.js`, 75 framework tests (`node tests/framework.test.mjs` at this commit) + legacy 114 | — |
| 18 | Cutover gate + "legacy authority unreachable" proof | NOT PASSED (honestly) | `candidate.js`, `tools/framework-gate.mjs` | Every consumer-facing DECISION routes through a framework home and A-6/7/8/9 are live (#520 and #523 merged), but the implementations are adopted legacy modules imported through doors, so legacy authority is reachable BY THE RULINGS' DESIGN — the proof as worded cannot pass without un-adopting them. What remains is the human acceptance pass on the new mechanics (gate row "approved new-mechanics acceptance"). The stamp says so: `0.5.0-rc.3`; `0.5.0` is the owner's release cut. |

## B. The contract's "report before cutover" contradictions — rulings

| # | Contradiction | Ruling (this PR unless noted) |
|---|---|---|
| 1 | Armour ids unique per class only | ADOPT the composite `armor.<classId>.<id>` as the canonical id; legacy pair preserved in overrides (already how the importer keys them). |
| 2 | `itemWeight` / `attackRatingBonus` / `defenseRating` unauthored | RESOLVED for armaments from `weapons.csv`; armour weight = `poiseThreshold` (A-side), armour `defenseRating` stays 0 (no column — the one remaining unauthored number). |
| 3 | Rarity ladder omits `uncommon`/`starter`/`special`/`boss` | ADOPT the union as the canonical ladder (`schema.js`): STARTER, BASIC, COMMON, UNCOMMON, RARE, SPECIAL, LEGENDARY, MYTHIC, BOSS. |
| 4 | `power`/`curse`/`status` types and `X` costs outside the contract model | ADOPT as classification properties and `{amount: 0, variable: true}` — already implemented; recorded as the ruling. |
| 5 | `staff` armaments have no category | ADOPT `STAFF` as a category; the importer maps the kind. |
| 6 | Starting-resource feasibility & Guard stacking need balance validation | MEASURED on #520: capacity base 50 made the Weight Class unreachable for every kit; retuned to 0 (capacity = 2·CON + STR) — the number and its census evidence live in `mechanics.json`'s `capacityBaseNote` and `tools/weightclass-census.mjs`, not here. Guard stacking: unchanged legacy block rules; the dodge's temporary guard lands as Block through the same door. |
| 7 | Baseline red (test 19) | RESOLVED upstream (#507). |

Also resolved here: #484 — `hpPerConTier` was authored on every class and read by nothing; removed (the smaller act the card named), gate and tool updated.

## C. The fix program (sub-branches of `claude/refactored-dev-branch-3v23r5`)

| Branch | Delivers | A/B? |
|---|---|---|
| `-cutover-fixes` (this PR) | this checklist; rulings 1–5; authored weights into the framework; #484 | — |
| `-weight-class-a` (#520, merged) | Weight Class live: capacity from CON/STR, load from equipped items, class readout in the Armoury; census instrument; capacity base retuned 50 → 0 (bases 5 and 2 measured and refused: at 5 no class reaches Heavy at its preset, at 2 the Herald does not) | A shipped (armour weight = poiseThreshold); B (armour weightless) is the one-line alternative `ARMOUR_WEIGHT_RULE`; `--capacity-base=N` reruns the census for any base |
| `-stamina-dodge-unarmed` (#523, merged) | idle stamina recovery, the `dodgeRoll` opcode, class-priced dodge, Evasive Guard + Dodge Roll live as the unarmed package | contract numbers as authored (difficulty 10, guard base 3); the softer roll (8 / 4) stays a two-number change in `mechanics.json` if play asks for it |
| `-weapon-art-slots` | not opened — ruled ADOPTED (A-6): the technique role is the slot; nothing authored to install | — |
| `-feedback-rest` (#522) · `-issue-313-b` (#521) · `-evidence-restore` (#518) · `-cutover-fixes` (#519) | the owner's asks and the fitting issues (sections D, E) | per item |
| `-e12-quests` (#531) · `-hintstrip-*` (#532, #538, #540, #550) · `-coop-*` (#536, #537) · `-modal-focus` (#533) · `-smith-stored` (#534) · `-rc2-*` (#543–#549) | the `rc.2` candidate: the first quest chain, the layout gate re-aimed at the shipped action row with its clipping, paint-coverage and text reads, the co-op review program (section F) | per item |
| the designated branch itself (#554, #555, #556) | the `rc.3` candidate: the Dodge Roll on one empty hand, the hintstrip text read, the receipts owed since `rc.2`, the README pass, the `rc.3` stamp | per item |

## D. The owner's feedback ("the thirteen", `docs/asks/asks-ledger.md`)

| Ask | Owner's words | Status in code today | Action |
|---|---|---|---|
| E3 | fullscreen toggle first in Display | **DONE** — `settings.js` Display row 1 is Fullscreen; sprites moved to Advanced | ledger state is stale; regenerate |
| E5 | two starting armour sets; assign stat points | **DONE** — `characterCreation.json` gives every class two armour sets and two hand kits; `pointbuy` mode: pool 10, floor 8, ceiling 15, fixed-total redistribution (points come back) — his numbers exactly | ledger state is stale; regenerate |
| E13 | too much battling; level at rest sites with cinders, 1 point/level, 10–20 level-ups a run; rest-stop placement guard rails; multi-use rest toggle | **DONE in #522** — the sim now measures level-ups per full run; the shipped 800 + 200 ladder gave 0.5, the calibrated 20 + 4 gives 14.8 (the greedy ceiling); multi-use Shrines toggle (default off) with LEAVE. Shrine-before-boss was already live | merge #522 |
| E12 | questing; previous choices influence other events | **LIVE (first chain)** — choice history is recorded and gates later event choices (`quests.js`, `event.js`); event-level quest steps gate which events an Unknown node may roll (`eventHistoryRequirements`, `resolveUnknownNode`, `buildActMap` carries `run.history`); the first 3-step chain is authored: Grave of the Nameless → The Keeper of the Nameless → The Nameless at Rest, with the Gravetender's Bell as the mourner's reward | more chains are content on the same doors; `tools/quest-choice-contract.mjs` is the instrument |
| C5/C6/C11/C18/C19/R2 | process/fleet asks | not code | — |

## E. Open issues that fit the current direction

| Issue | Fit | Action |
|---|---|---|
| #515 evidence restore | fits | PR #518 (restore, hash-verified) |
| #484 hpPerConTier | fits | this PR (remove) |
| #313 drag default for `ally`/`mixed` | fits, rule unwritten | **B shipped in #521**: the board's legal set at drag start, lit only when it is exactly the player (solo `self` and `mixed`); A (declared mode) is the behaviour it replaces |
| #233 poise/status buildup plates | fits UI direction | after the plate model lands; not this pass |
| #239/#240/#241 enemy action cards, encounter budgets, deterministic plans | fits the data-driven direction | design-sized; sequence after the framework gate |
| #61 Reaver bleed pilot | human playtest | owner |
| #194/#235/#236 previews | infra | separate lane |

## F. The `0.5.0` candidates — what was asked, what was done (as of `dev` @ `c9e7fa12`, 2026-09-02)

The standing directive after section C: **make everything live as intended and described; do not wait — drive every review to clean and merge; promote `dev → test` (agent-mergeable) and open `dev → release` (owner-exclusive, never merged by an agent); advance `rc.<n>` at each `dev → test` promotion (`docs/versioning.md`).** Status words: **DONE** — merged on `dev` · **OPEN** — a pull request stands · **OWNER** — the owner's act, not an agent's.

| # | Asked | Done | Where / evidence |
|---|---|---|---|
| F-1 | Promote `rc.1` to `test`, open the owner's `release` draft | DONE (OWNER merged both) | #528 `dev → test` at `7614659f`; #529 `dev → release` merged by the owner; stamp `0.5.0-rc.1.1933` |
| F-2 | Answer every review finding on the `rc.1` promotion | DONE | co-op event choices as quest steps and the shared map on the party's history (#536); each seat's upgraded Poise threshold in the shared fight (#536); stored armaments offered at the Shrine (#534); the co-op snapshot carries `itemUpgradeLevels` (#537); the confirmation modal's Tab trap (#533) |
| F-3 | E12: a first quest chain over the choice history | DONE | #531: Grave of the Nameless → the Keeper → the Nameless at Rest (section D) |
| F-4 | #527: the layout gate measured a retired strip; aim it at the shipped action row | DONE | #532 (five declared controls, both layouts, the phone cell under a coarse pointer); #538 (clipping by an ancestor, the key label cut off, paint coverage read from pixels); #540 (lost paint by magnitude, same-background reference, ancestor pseudo-elements, `!important` pointer-events, tolerance-dense grid); #550 (the control's own paint over its text); #554 (cover judged by the control's TEXT: text hidden and restored around the paint, the row frozen, LCD subpixel antialiasing off, in-flow labels probed by hiding alone) — 24 plants, every one caught; `tools/plantsites-baseline.json` at 396 sites |
| F-5 | The `rc.2` stamp and its receipts | DONE | #539: `contentBundle.version = 0.5.0-rc.2`; CHANGELOG receipts for #531, #533–#537; this checklist and `docs/versioning.md` name `rc.2` |
| F-6 | Every branch's build on Pages; publication its own authority | DONE | #525 (the README names each branch's playable build); #543 (the `deploy` job runs only from a manual dispatch spelling `PUBLISH`, by the repository owner, on the `github-pages` environment); #546 (`pages: read` on `assemble`, `pages: write` and OIDC on `deploy` alone) |
| F-7 | Answer every review finding on the `rc.2` promotion (#541) | DONE (all seven threads) | a forced encounter rewards from its own pool (#543); a forced fight survives its chooser's disconnect (#544); the event's result shows before a forced fight (#545); the party reconnects as a batch on a disk resume and an event re-settles on a return (#547); every event choice shows its result before the party moves on (#549); missed events replay through the catch-up queue (#548, below) |
| F-8 | Co-op catch-up: `MULTIPLAYER.md`'s "retroactive catch-up as a series" for events, not only rewards | DONE (#548, fourteen review rounds) | an event the party settles while a living seat is away is queued with the choices its history admitted, the node, the seat's rng position and purse; a choice that starts a fight is withheld unless the party fought it; the replay honours the frozen list, runs at the frozen rng, must be affordable then and now, is committed on selection and read from the host, forfeits the queue at a death, re-settles the room it held, withdraws a dead seat's live offer, pays a substitute relic where a later offer rolled the same one; a return into a live fight waits on the queue; the live rng moves past a reserved block; legacy saves settle. `tools/session-smoke.mjs` carries the proofs |
| F-9 | The hosted browser-guard red on `dev` (ci.yml run 299) | DONE | `hintstrip --selftest` printed a line `tools/verdict.mjs` refused; the line is `hintstrip-selftest: OK — N plants, N caught` (#540). ci.yml run 300 on `9aeffab0` is the first fully green hosted board since `ci.yml` went dispatch-only |
| F-10 | Promote `rc.2` to `test` | DONE | #541 `dev → test` merged at `2d34d446`, stamp `0.5.0-rc.2.1935` |
| F-11 | The owner's `release` cut for `rc.2` | DONE (OWNER) | #542 `dev → release` merged by the owner at `00330f4f` |
| F-12 | Review findings that arrived after the owner merged #549 and #550 | DONE | #552: a lost fight with no living fighter is the party's defeat though a seat stood outside it, and a lethal replay's result is read before the seat leaves the queue. #554: the text read classifies ancestors after both scans and reads an overlapping in-flow label from what hiding it changes |
| F-13 | CHANGELOG receipts for #543–#552 | DONE | #554: the co-op catch-up (#547, #548, #549, #552) at `0.5.0-rc.2.1941` and the review riders (#543–#546, #550, #551) at `0.5.0-rc.2.1936`, each at the ordinal `buildordinal.json` carried at its merge on `dev` |
| F-14 | The owner's feedback file, the open-issue sweep (task 34) | PARTIAL | sections D and E stand as written; the sweep resumes after the `rc.3` close-out |
| F-15 | The owner's correction to #523: the dodge rides on ONE empty hand | DONE | #554: the empty hand contributes the Dodge Roll as a weapon-art instance of its own beside the armed hand's technique; a shield is a full hand and a two-hander fills both; A-9 states the widened rule |
| F-16 | The README names what the game now does | DONE | #555: load and Weight Class, Stamina and the class-priced dodge, the first quest chain (eligibility at Unknown nodes, not a node that opens), Forsaken Together; the attribution block names that pass |
| F-17 | The `rc.3` stamp and its receipt | DONE | #556: `contentBundle.version = 0.5.0-rc.3`, the receipt at `0.5.0-rc.3.1946`, this checklist and `docs/versioning.md` naming `rc.3` |
| F-18 | Promote `rc.3` to `test` | OPEN | the packet names the exact `dev` head, ordinal, digest and span over `test` (#554, #555, #556); merged by an agent once Codex is clean and the board is green |
| F-19 | The owner's `release` cut for `rc.3` | OWNER | never merged by an agent |

What was **not** done, and why: no agent merged `dev → release` (#529, #542 — the owner's act by the standing rule, and the `rc.3` cut is his too); the `dev → test` merge of `rc.2` waited on the review program above so that one packet described one exact `dev` head; the framework gate's row 18 stays NOT PASSED by the rulings' design (A-18); the owner's feedback file and open-issue sweep (F-14) remain partial.
