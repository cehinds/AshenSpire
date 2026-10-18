# FixCore implementation and authoring map

Branch: `feature/FixCore`. This follow-through records the implementation inspected on 2026-10-18, through `05a84ebe1`, plus the factual Core2 policy-note corrections accompanying this document. [FixCore-complete.md](FixCore-complete.md) remains the original requirements/audit; its historical line references and proposed examples have not been rewritten. [SPEC.md](../../SPEC.md) governs contractual behavior.

Checkmarks below mean the requested behavior has an identified implementation, not that every browser scenario or integration suite has passed. Verification and remaining acceptance work are recorded separately.

## Authoring and version boundary

New games select `ashen.core@2.0.0` with `ashen.core-content@2.0.0`: see `games/ashenspire/game.json`, `presets/core.json`, `bundles/core/bundle.json`, and `packs/core/pack.json`. Paths in this paragraph are relative to `games/ashenspire/` after the first path. The archived `bundles/core-v1/` and `packs/core-v1/` retain Core1 rules. Do not update their balance or text to match Core2.

FixCore combat requires expansion version 2 and the authored effects setting `fixCoreVersion: 1`. Optional new policies are absent from legacy module defaults where absence preserves old behavior. Saved profiles pin their compiled content and runtime identity; an unsupported runtime hash is rejected with the original save preserved. This is a compatibility boundary, not a promise that any historical save can execute under the newest runtime. Combat snapshots preserve resolved FixCore parameters, including protection multipliers.

Edit authored files, then rebuild/check through the repository tools. Do not edit `src/content/generated/`, `src/config/generated/`, `game.lock.json`, or `build.summary.json` by hand.

| Authoring location | Live contract |
| --- | --- |
| `content/source/fixCoreMechanics.json` | Stance, accuracy, Perception, status decay/riders, enemy combined-action cost, default protection tags and parameter overrides. |
| `engine/mechanics/defense.wardProtection/` and `defense.poiseProtection/` | Registered protection tags, multiplier schemas, declarative services and conformance cases; default multiplier `0.75`. |
| `engine/mechanics/combat.{stance,accuracy,perception,statuses,actionCosts}/` | Registered parameter-query families, validated attachment overrides and instance-scoped binding contracts. |
| `games/ashenspire/bundles/core/bundle.json` | Activation, `resources.chargeFlaskCapacityPerPickup: 1`, `gear.armorBudget: {baseline:3,perRank:1}`, authored progression entitlement policy and content-to-module policy bindings. |
| `games/ashenspire/packs/core/rewards.json` | `offerCount:3`, `takeCount:1`, weighted `rewardGroups`, categories and eligibility. |
| `games/ashenspire/packs/core/shops.json` | `itemsPerCategory:3`, fallback offer count and price. |
| `games/ashenspire/packs/core/routes.json` | `prebossNodes:7`, `restFloors:[3,7]`, `requirePrebossRest:true`, three columns and path mode. |
| `games/ashenspire/packs/core/{characters,cards,cardPools,gear}.json` | Class training tags, Evade/cantrip content and availability, equipment stat points and item definitions. |
| `engine/modules/deck-training/defaults.json` | Basic Training/Arcane Graduate eligibility; unlimited eligible basics/cantrips remain subject to deck-size rules. |
| `engine/modules/{resources,rewards,shops,routes,gear,progression}/settings.schema.json` | Configuration validation; unknown/invalid configuration is not silently accepted. |
| `content/config/ui/presentation/actionPacing.json` | Presentation waits, sprite playback rate, automation defaults and bounded settings. |
| `content/config/ui/components/combatTargetHud.json`, `content/config/ui/presentation/footerLayout.json` | Target HUD sizing/placement and resource-footer layout. |

The actual ordinary reward groups are:

```json
[
  {"id":"cards","weight":60,"categories":["combatCards","weaponArts"]},
  {"id":"equipment","weight":10,"categories":["weapons","armor","relics"]},
  {"id":"consumables","weight":30,"categories":["potions"]}
]
```

Weights choose each ordinary offer slot from remaining eligible groups; the equipment share is combined. Exhausted groups are removed and remaining weights renormalized. Distinct shop stock is bounded by the available catalog, rather than fabricated duplicates. Saved offer/stock records prevent reopening from rerolling, and legacy snapshots without the new shop policy retain their previous RNG stream.

To tune the matching-stance bonus globally, change the existing `stance.effectivenessMultiplier` in `content/source/fixCoreMechanics.json`. To override it on one eligible active source, use the registered binding shape:

```json
{
  "mechanicTags": ["combat:stance"],
  "mechanicBindings": [
    {"tag":"combat:stance","parameters":{"effectivenessMultiplier":1.25}}
  ]
}
```

This example deliberately changes that source to a 25% bonus; the shipped default is **1.0025**, not 1.25. Merge these entries with any existing tags/bindings rather than dropping unrelated behavior. Omitted binding parameters inherit module values. The adapter reads active equipped mounts, actors, statuses and the current card window, not carried inventory. Conflicting exclusive family overrides are rejected. Protection tuning uses `protectionParameters`, for example `{"defense.wardProtection":{"multiplier":0.6}}` for 40% magical reduction while active. These are authoring examples, not additional shipped balance changes.

## Runtime methods and request coverage

- [x] **Damage authority and equipment:** `src/model/gameProfileGear.js` (`gameProfileEquipmentReceipt`, `gameProfileEffectiveAttributes`) resolves worn item values once. `src/model/gameProfileRun.js` projects ratings; `src/engine/gameProfileCombat.js` (`profileDamageReceipt`) and `src/engine/actions.js` execute them. Attributes, enhancements and ranks feed the shared resolved-card/gear paths. Do not grant both raw budget points and their resolved values.
- [x] **Preview parity, protection and multi-hit:** `src/engine/combatDamagePreview.js` (`damagePreviewState`, `previewDamageHits`) advances detached defensive state across hits/effects. `src/model/fixCoreMechanics.js` supplies `protectionReceipt`, `damageReceipt`, validated bindings and named source receipts. Active Ward/Poise apply 25% typed reduction; the prevented amount spends the matching pool. Block restores each pool by the same final Block amount, independently capped, for either side.
- [x] **Stacking, decay and stagger riders:** `src/engine/statuses.js` applies additive overrides and `decayAtTurnStart` once per owner round. Weak reduces AR to 75%; Vulnerability increases incoming damage to 125%; stagger grants configured Weak/Vulnerability stacks. Active potency is flat; extra stacks extend duration rather than repeatedly multiplying potency.
- [x] **Stance and enemy action costs:** `src/model/stanceRules.js` shares matching-stance costs/effectiveness and entry bonuses; configured stance changes run through `setProfileStance`. The applicable used lane gets the configured discount/floor. Combined enemy heal-and-block actions use the authored 3-SP cost through shared move-cost planning/execution.
- [x] **Precision, Evasion and Perception:** `src/engine/stanceHit.js` (`effectiveEvasion`, `attackHitPreview`, `resolveAttackHit`) shares hit odds/resolution. `src/engine/enemyKnowledge.js` records Perception information. Offensive selection and autoplay in `src/ui/screens/combat.js` expose/use odds only after an exact successful read. Evade content grants working Evasion stacks; `core.cantrip` participates in graduate training.
- [x] **Card readability:** card presentation/inspection components show attack counts and per-hit/total results, target-aware calculation sources, appropriate category/effect symbols and concise text. Full inspection retains details removed from compact faces. Damage calculations are available through pointer and keyboard inspection.
- [x] **Combat indicators:** target HUD/health/status models show Block, Poise, Ward, Evasion and active status stacks; AC is absent from PIP display. HP retains its separate display. HUD geometry raises actor-associated overlays and preserves icon aspect; footer MP artwork is enlarged without changing resource counts.
- [x] **Serial presentation:** `src/ui/actionTimeline.js` owns intent → delay → action word → delay → sprite → delay → reaction → delay → numbers → HUD → resolution → next action. `src/ui/fx.js` renders receipt stages and owns cancellation/skip cleanup. Default waits are 500 ms and sprite playback is approximately half the previous rate. The scheduler serializes counters and multi-hit reactions; speed changes presentation only.
- [x] **Automation:** `src/model/autoCombatPolicy.js` ranks explicitly public legal/affordable candidates with offense/defense preference, known hit chance and stance advantage. Settings persist enablement, speed and delay. The combat host pauses for interaction/dialogs/reactions and skips cards already in a planned round queue; an idle planned queue can proceed to End Turn. Choice/upcast prompts remain deliberate user decisions, and a per-turn cap bounds automation.
- [x] **Log and End control:** `src/ui/components/combatLogModal.js` uses the shared modal surface; compact/full log projections include receipt sources and fuller arithmetic. The shared hold-confirmation control replaces HOLD with progress, resets on cancel and commits once.
- [x] **Rewards, shops and flask collection:** `src/model/gameProfileRewards.js` persists seeded offers/stock and once-only claims. `src/model/gracerefill.js` (`flaskAcquisitionPlan`, `acquireFlask`) handles charge-capacity growth; reward/shop/event acquisition paths share it. Capacity, allocation, current charges and acquisition ledger move together; utility consumables stay separate inventory items.
- [x] **Routes and travel:** `src/engine/actmap.js` builds mandatory singleton rest depths that merge all lanes, so every boss predecessor is a rest. Runtime `type:"shrine"` means rest (`actualType:"rest"`); a walk ending `shrine,boss` satisfies the requirement. `src/ui/components/mapboard.js` draws only consecutive recorded travel pairs, including their outlines, while preserving navigation edges and revisit semantics.
- [x] **Deck editing and creation:** `src/model/deckRules.js` validates ownership/identity and training-aware copy limits. `src/main.js` (`showCombatDeckEditor`) uses a draft, applies the saved composition next encounter and leaves active combat piles unchanged. Commit/snapshot/persistence failure restores the entire owner run. Character creation groups equivalent card instances with ×N, preserving differences in rank/enhancement.
- [x] **Progression and armor:** authored progression entitlements feed claim/attribute allocation through `src/model/levelup.js`; derived values update after spending. Armor receives 3 budget points at baseline rank plus 1 per additional rank, with supported resources, ratings, defenses, Evasion, Precision and attributes. Weapons retain their own budget policy. Item conversion/aggregation and equipment inspection share resolved values.

## Explicit assumptions retained

These resolve ambiguous requests and remain configurable; they are not represented as user-confirmed rulings.

| Topic | Implemented default |
| --- | --- |
| Perception base DC | 5 from the explicit equation, rather than the separately mentioned 8. |
| Perception scaling | Target level above 1 and target Intelligence above baseline 0, each weighted +1. Roll uses observer WIS. |
| Same-stance effectiveness | Literal +0.25% = multiplier 1.0025. The correction to 25% applied to Poise. |
| Precision and Evasion | +1 per stack, +1 additional Precision for Smash/Sweep; base Evasion 1 and stance clamp 1–1.5. |
| Status decay/riders | Remove 1 stack at owner turn start once per round; stagger adds 1 Weak and 1 Vulnerability. |
| Reward interpretation | Weighted group draw per ordinary offer slot; take one from three. |
| Combat deck editing | Safe idle boundary; composition takes effect next encounter. |
| Automation | Disabled initially, ×1 speed and offense preference; unknown information never contributes. |

The remaining balance notes in `packs/core/provisionalPolicies.json` describe Core2 explicitly. Archived Core1 notes preserve their historical formulas.

## Verification and remaining acceptance work

This documentation pass directly ran:

```sh
node --test tests/combat-deck-host.test.mjs tests/auto-combat-policy.test.mjs
```

**8 tests passed**, including persistence-failure rollback. Earlier independent review also ran the timeline, policy and deck-host suites together: 13 tests passed before the added rollback regression. That earlier deck-policy run could not initialize because generated runtime hashes were stale; it is not counted as a passing validation. Parent integration regenerates/checks shared artifacts after source changes.

Source review confirms the two reported defects were addressed by `597234` (deck rollback) and `04b17c82a` (planned-round autoplay). A real combat-screen autoplay regression remains part of UI acceptance; pure policy tests alone do not prove host behavior. The coordinated browser walk reported `monster,event,shrine,event,event,event,shrine,boss`, consistent with mandatory rests at floors 3 and 7; this observation does not claim the entire playthrough completed successfully.

Follow-up fixture validation in `9222a8836` ran the collection-row, enemy-module and Rest UI model suites: **39 tests passed**. The two changed CLI negative/reference-policy cases also passed. Mutations now target the pack selected by the author bundle, rather than editing archived Core1 data while resolving Core2. Training tests assert unlimited eligible basics, available-but-not-starter Evade, and finite owned progression cards; explicit editor fallback coverage disables the training module deliberately.

A subsequent full CLI/run/settings run produced 26 passes and 4 failures: three outdated route/version fixtures and the generated profile exact-match check. Generated-file drift is left to the integration rebuild, not hidden by weakening that check. After correcting only those three fixtures, `tests/game-profile-run.test.mjs` and `tests/new-game-profile-settings.test.mjs` passed **25/25**: Core2 uses its actual second rest at depth 7, the archived Core1 Smith fixture builds its map with the matching registry, and the Core2 Rest-first snapshot retains its mandatory preboss rest while testing the intended first-floor rejection. Explicit Core1 author cases remain pinned to version 1.

Relevant executable coverage also exists in `tests/fixcore-{protection,combat-rules,live-combat,gear-live,deck-policy,profile-pins,reward-policy,map-travel,flask-acquisition}.test.mjs`, `tests/combat-card-presentation.test.mjs`, `tests/combat-log-{sources,modal}.test.mjs`, and `tests/action-timeline.test.mjs`. Their existence is not a claim that this documentation pass ran them.

Before merging, record the coordinator's exact final commit and aggregate results for content/config/game builds, conformance, core regression, save/reload and standalone/browser acceptance. Check desktop/mobile/high-MP layouts, all requested PIP stacks, card text/hover/keyboard calculations, log layering during playback, hold cancellation, disable-autoplay mid-sequence and actual queued-round completion. Keep screenshots and feature-preview evidence in the required README block and update the component catalog for changed UI surfaces.

A completeness review found stale Core2 Evade wording claiming failed dodges double damage. The combat/content owner subsequently changed the authored card text to `Gain {evade} Evasion.`; verify the final compiled card face and inspection text during browser acceptance. Core2 provisional policy notes were corrected in `0ca1d2f0b`. No claim of complete visual acceptance or all-green integrated tests is made here.
