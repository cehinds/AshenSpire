# Framework migration — the checklist

What the "AshenSpire Data-Driven Property Framework — one-shot rebuild"
contract asked for, what shipped, what did not, why, and what is being done
about each gap. Companion to `docs/framework-cutover-report.md` (the gate
evidence) and `docs/versioning.md` (why the stamp reads `0.5.0-rc.1`).

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
| 7 | Mana & Stamina rules (Wisdom/Intelligence weights, idle stamina recovery, refund rule) | **BUILT, DORMANT** on this branch — LIVE only once #523 merges (at this commit `bridge.js` has no `staminaTurnEnd`) | `bridge.staminaTurnEnd` over `resources.js` at the end of the player turn; `staminaSpentThisTurn` counter | Idle turns recover `idleRecoveryPerTurn`; spending turns do not; refunds never erase a spend (no refund source exists yet). |
| 8 | Weight Class & Dodge Roll (capacity from CON/STR, Light/Medium/Heavy, dodge d20) | **Readout LIVE** with #520 (`bridge.weightClass` decides the class; the Armoury shows load, capacity, percent and class, and the comparison shows the swap's before/after); the fight — `playerWeightClass(combat)`, the `dodgeRoll` opcode, the class-priced dodge — lands with #523 (stacked) | `bridge.weightClass` / `playerLoadReceipt` (Armoury), `playerWeightClass(combat)` + the `dodgeRoll` opcode (fights) | Weights come from `weapons.csv`; armour weighs its `poiseThreshold` (A-side). The census (`tools/weightclass-census.mjs`) found the contract's capacity base 50 left every reachable kit Light; the shipped base is **0** (capacity = 2·CON + STR), the base at which every class can reach Heavy at its standard preset while no creatable start begins Heavy — the numbers and their derivation live at `mechanics.json`'s `capacityBaseNote`. The pure dodge is priced by the class (#523). |
| 9 | Unarmed fallback package (Unarmed Strike, Evasive Guard, Dodge Roll) | **BUILT, DORMANT** on this branch — LIVE only once #523 merges (`deck.js` still calls the Evasive Guard / Dodge Roll outputs open build work here) | base cards `evasiveGuard` / `dodgeRoll` authored as the contract's entities; the unarmed guard and technique profiles resolve to them | A run with empty hands composes Evasive Guard in every guard slot and Dodge Roll in every technique slot. Armed play unchanged. |
| 10 | Whitelisted inheritance (PERMITS relations) | LIVE (compiler) | `inheritance.js` | — |
| 11 | Terminology through TermRegistry (keywords, statuses, stances, resources) | LIVE | bridge `keywordDisplay`/`resourceWord`; `termOverlay.js` everywhere status/stance words render (#511–#514) | — |
| 12 | Status-effect semantics | ADOPTED | `statusSemantics.js` door (#516) | — |
| 13 | Confirmation policy (static severities) + level rule (fail-closed derivation) | LIVE / ADOPTED (owner ruling) | `confirmationRule.js`, ConfirmationRegistry (#510–#511) | — |
| 14 | Option-decision interaction router (tap-to-review / hold-to-commit) | ADOPTED | `optionDecision.js` door, all consumers (#512, #514) | — |
| 15 | Shared presentation system (components, tooltip engine, modal grammar, fitText, theme data) | PARTIAL | `presentation/` components exist; card faces/tooltips read framework decisions; screens still render through legacy components | The port moved decisions and words; the DOM renderers are legacy. Fix: not a behavior change — a renderer-by-renderer adoption, lowest value, last. |
| 16 | Legacy importer of every legacy entity with stable ids — 395 at this commit (196 cards, 41 equipment, 50 statuses, 19 enemies, 4 classes, 55 relics, 7 flasks, 22 locations, 1 UI surface; `importLegacyContent(contentBundle).counts` is the authority, the number here is its reading on 2026-09-02 after the first quest chain's two events) | LIVE (data) | `importer.js` | — |
| 17 | Complete validation + known-bad corpus | LIVE | `validate.js`, 66 framework tests (`node tests/framework.test.mjs` at this commit) + legacy 114 | — |
| 18 | Cutover gate + "legacy authority unreachable" proof | NOT PASSED (honestly) | `candidate.js`, `tools/framework-gate.mjs` | Every consumer-facing DECISION routes through a framework home and A-6/7/8/9 go live with #520 and #523 (dormant at this commit), but the implementations are adopted legacy modules imported through doors, so legacy authority is reachable BY THE RULINGS' DESIGN — the proof as worded cannot pass without un-adopting them. What remains is the human acceptance pass on the new mechanics (gate row "approved new-mechanics acceptance"). The stamp says so: `0.5.0-rc.1`; `0.5.0` is the owner's release cut. |

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
| `-weight-class-a` (#520) | Weight Class live: capacity from CON/STR, load from equipped items, class readout in the Armoury; census instrument; capacity base retuned 50 → 0 (bases 5 and 2 measured and refused: at 5 no class reaches Heavy at its preset, at 2 the Herald does not) | A shipped (armour weight = poiseThreshold); B (armour weightless) is the one-line alternative `ARMOUR_WEIGHT_RULE`; `--capacity-base=N` reruns the census for any base |
| `-stamina-dodge-unarmed` (#523, stacked on #520) | idle stamina recovery, the `dodgeRoll` opcode, class-priced dodge, Evasive Guard + Dodge Roll live as the unarmed package | contract numbers as authored (difficulty 10, guard base 3); the softer roll (8 / 4) stays a two-number change in `mechanics.json` if play asks for it |
| `-weapon-art-slots` | not opened — ruled ADOPTED (A-6): the technique role is the slot; nothing authored to install | — |
| `-feedback-rest` (#522) · `-issue-313-b` (#521) · `-evidence-restore` (#518) · `-cutover-fixes` (#519) | the owner's asks and the fitting issues (sections D, E) | per item |

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
