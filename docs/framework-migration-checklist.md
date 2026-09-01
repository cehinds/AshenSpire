# Framework migration — the checklist

What the "AshenSpire Data-Driven Property Framework — one-shot rebuild"
contract asked for, what shipped, what did not, why, and what is being done
about each gap. Companion to `docs/framework-cutover-report.md` (the gate
evidence) and `docs/versioning.md` (why the stamp reads `0.5.0-rc.1`).

Status words: **LIVE** — the running game decides this through the framework
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
| 6 | Weapon-art SLOT management (install/replace at the blacksmith) | NOT BUILT | — | Needs authored slot counts and install/replace costs the contract does not give. Fix: A/B branches with candidate rules (see C). |
| 7 | Mana & Stamina rules (Wisdom/Intelligence weights, idle stamina recovery, refund rule) | BUILT, DORMANT | `resources.js`; `mechanics.json` | Legacy pools exist and cards spend stamina, but idle recovery (+1/turn) and the refund rule are not wired into `startPlayerTurn`. Fix: wire in the stamina-dodge branch (see C). |
| 8 | Weight Class & Dodge Roll (capacity from CON/STR, Light/Medium/Heavy, dodge d20) | BUILT, DORMANT | `weight.js`; `mechanics.json` | Was "unauthored weights" — **no longer true**: `weapons.csv` authors weight/attackRating/defenseRating for all 25 armaments and the importer now carries them (this PR). Armour has no weight column: A-side maps `poiseThreshold` (the legacy weight identity rule), B-side leaves armour weightless. Fix: wire capacity/load/class into run state + Armoury readout, then the dodge card (see C). |
| 9 | Unarmed fallback package (Unarmed Strike, Evasive Guard, Dodge Roll) | PARTIAL | legacy unarmed strike/guard profiles are live; `framework.evasiveGuard` / `framework.dodgeRoll` exist only as framework data | Enabling changes the shipped unarmed fallback (owner-gated until now; now authorized). Depends on A-7/A-8 being live. Fix: stamina-dodge branch. |
| 10 | Whitelisted inheritance (PERMITS relations) | LIVE (compiler) | `inheritance.js` | — |
| 11 | Terminology through TermRegistry (keywords, statuses, stances, resources) | LIVE | bridge `keywordDisplay`/`resourceWord`; `termOverlay.js` everywhere status/stance words render (#511–#514) | — |
| 12 | Status-effect semantics | ADOPTED | `statusSemantics.js` door (#516) | — |
| 13 | Confirmation policy (static severities) + level rule (fail-closed derivation) | LIVE / ADOPTED (owner ruling) | `confirmationRule.js`, ConfirmationRegistry (#510–#511) | — |
| 14 | Option-decision interaction router (tap-to-review / hold-to-commit) | ADOPTED | `optionDecision.js` door, all consumers (#512, #514) | — |
| 15 | Shared presentation system (components, tooltip engine, modal grammar, fitText, theme data) | PARTIAL | `presentation/` components exist; card faces/tooltips read framework decisions; screens still render through legacy components | The port moved decisions and words; the DOM renderers are legacy. Fix: not a behavior change — a renderer-by-renderer adoption, lowest value, last. |
| 16 | Legacy importer of all 392 entities with stable ids | LIVE (data) | `importer.js` | — |
| 17 | Complete validation + known-bad corpus | LIVE | `validate.js`, 65 framework tests + legacy 114 | — |
| 18 | Cutover gate + "legacy authority unreachable" proof | NOT PASSED (honestly) | `candidate.js`, `tools/framework-gate.mjs` | Every consumer-facing DECISION routes through a framework home, but the implementations are adopted legacy modules imported through doors, so legacy authority is reachable by design. Passing needs A-6/7/8/9 live and the acceptance pass (B). The stamp says so: `0.5.0-rc.1`, final `0.5.0` on gate SUCCESS. |

## B. The contract's "report before cutover" contradictions — rulings

| # | Contradiction | Ruling (this PR unless noted) |
|---|---|---|
| 1 | Armour ids unique per class only | ADOPT the composite `armor.<classId>.<id>` as the canonical id; legacy pair preserved in overrides (already how the importer keys them). |
| 2 | `itemWeight` / `attackRatingBonus` / `defenseRating` unauthored | RESOLVED for armaments from `weapons.csv`; armour weight = `poiseThreshold` (A-side), armour `defenseRating` stays 0 (no column — the one remaining unauthored number). |
| 3 | Rarity ladder omits `uncommon`/`starter`/`special`/`boss` | ADOPT the union as the canonical ladder (`schema.js`): STARTER, BASIC, COMMON, UNCOMMON, RARE, SPECIAL, LEGENDARY, MYTHIC, BOSS. |
| 4 | `power`/`curse`/`status` types and `X` costs outside the contract model | ADOPT as classification properties and `{amount: 0, variable: true}` — already implemented; recorded as the ruling. |
| 5 | `staff` armaments have no category | ADOPT `STAFF` as a category; the importer maps the kind. |
| 6 | Starting-resource feasibility & Guard stacking need balance validation | OPEN — measured in the stamina-dodge branch's sim runs before enablement. |
| 7 | Baseline red (test 19) | RESOLVED upstream (#507). |

Also resolved here: #484 — `hpPerConTier` was authored on every class and read by nothing; removed (the smaller act the card named), gate and tool updated.

## C. The fix program (sub-branches of `claude/refactored-dev-branch-3v23r5`)

| Branch | Delivers | A/B? |
|---|---|---|
| `-cutover-fixes` (this PR) | this checklist; rulings 1–5; authored weights into the framework; #484 | — |
| `-weight-class` | Weight Class live: capacity from CON/STR (`mechanics.json`), load from equipped items, class readout in the Armoury; no combat effect until dodge lands | A: armour weight = poiseThreshold · B: armour weightless — both branches carry a sim readout of the class distribution across shipped kits |
| `-stamina-dodge-unarmed` | idle stamina recovery, dodge costs by class, the Dodge Roll card and Evasive Guard card, the unarmed package switch | A: contract numbers as authored · B: dodge difficulty 8 / guard 4 (a softer roll) |
| `-weapon-art-slots` | blacksmith install/replace of weapon arts into authored slots | A: 1 slot per armament, install cost = smith cost · B: 2 slots, second unlocks at smith level 2 |
| `-feedback-*` | the owner's asks ledger items (section D) | per item |

## D. The owner's feedback ("the thirteen", `docs/asks/asks-ledger.md`)

| Ask | Owner's words | Status in code today | Action |
|---|---|---|---|
| E3 | fullscreen toggle first in Display | **DONE** — `settings.js` Display row 1 is Fullscreen; sprites moved to Advanced | ledger state is stale; regenerate |
| E5 | two starting armour sets; assign stat points | **DONE** — `characterCreation.json` gives every class two armour sets and two hand kits; `pointbuy` mode: pool 10, floor 8, ceiling 15, fixed-total redistribution (points come back) — his numbers exactly | ledger state is stale; regenerate |
| E13 | too much battling; level at rest sites with cinders, 1 point/level, 10–20 level-ups a run; rest-stop placement guard rails; multi-use rest toggle | **PARTIAL** — cinder leveling at shrines is live (`levelup.js`, 800 + 200/level); the top floor is always a Shrine with the Boss above it; elites/shrine floor rules exist. Missing: a multi-use rest toggle, and no instrument measures level-ups per run against his 10–20 range | `-feedback-rest`: runsim level-up metric; A: current ladder · B: 300 + 100/level; multi-use rest toggle (default off) |
| E12 | questing; previous choices influence other events | **PARTIAL** — choice history is recorded and gates later event choices (`quests.js`, `event.js`); quest STEPS exist in the model but zero quests are authored | `-feedback-quests`: author the first quest chain over existing events (A: 3-step relic quest · B: 2-step merchant favour) |
| C5/C6/C11/C18/C19/R2 | process/fleet asks | not code | — |

## E. Open issues that fit the current direction

| Issue | Fit | Action |
|---|---|---|
| #515 evidence restore | fits | PR #518 (restore, hash-verified) |
| #484 hpPerConTier | fits | this PR (remove) |
| #313 drag default for `ally`/`mixed` | fits, rule unwritten | A: declared-mode default (self only) · B: board-set default when exactly one legal target |
| #233 poise/status buildup plates | fits UI direction | after the plate model lands; not this pass |
| #239/#240/#241 enemy action cards, encounter budgets, deterministic plans | fits the data-driven direction | design-sized; sequence after the framework gate |
| #61 Reaver bleed pilot | human playtest | owner |
| #194/#235/#236 previews | infra | separate lane |
