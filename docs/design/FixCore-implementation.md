# FixCore implementation and authoring map

Branch: `feature/FixCore`. This follow-through records the implementation inspected on 2026-10-18, through integrated source `39e96eb7c`, with regression/release-gate follow-through through `8b5518e10`, plus the test commands accompanying this document. [FixCore-complete.md](FixCore-complete.md) remains the original requirements/audit; its historical line references and proposed examples have not been rewritten. [SPEC.md](../../SPEC.md) governs contractual behavior.

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

## Verification

Use `npm run test:fixcore` for the focused mechanics, equipment, deck, reward, map and flask regressions. Use `npm run test:fixcore:ui` for the four-viewport Chromium acceptance fixture and actual planned-round autoplay. The browser fixture accepts `PLAYWRIGHT_MODULE` (path to an installed Playwright module), `CHROME`, optional `BASE_URL`, and `FIXCORE_UI_OUT`. Without `BASE_URL`, it starts and closes its own source server. It does not install browser dependencies or modify gameplay content.

The coordinator verified the integrated implementation as follows:

- Source browser journey: **7 checks passed**, including character creation, an actually played first fight, route to boss, defeat, return to title and a new run; **0 console errors**. Later traversal fights were resolved using the tool's documented debug method, so this is not a full earned campaign. The route's `shrine,boss` ending is the mandatory rest immediately before the boss.
- Core2 presentation fixture at integrated source `f3929892c`: **390×844, 1024×768, 1440×900 and 1920×1080 passed**, plus hidden/resumed planned-round autoplay; **0 page errors**. Assertions cover allowed PIP facts and geometry, Perception-gated selection odds, multi-hit arithmetic and tooltip parity, touch inspection without playing, actual selected-text containment inside parchment, 24-MP capacity, highest-layer log, hold progress/cancellation and Deck/SP separation. These are explicitly posed fixtures over the real engine/renderers. Selection inspection uses the explicit `oneTapPlay:false` preference; the separate default-one-tap browser suite also passed, including numeric inspection without playing, actual sole-target execution receipts, hold selection, setting-off behavior and spent-hand End Turn.
- HUD clearance: the updated production probe passes **five Core 2 viewports** (including 320 px and 2560 px) plus a separate legacy desktop case. It checks independent exact Block/Poise/Ward/Evasion values, distinguishes remaining Poise from pressure, preserves legacy Barrier provenance, and checks accessible values, square aspect, HP separation and viewport containment. All six cases had no browser errors.
- Profile compilation and save migration: **35 tests passed**. Compiled content/config/profile freshness, the game artifact, standalone build and plantsites checks passed. The built standalone booted Core2 combat over local HTTP with cards, enemies and no page errors.
- Independent review approved integrated production source through `f3929892c`, including the OneTap controls integration. Review batches passed **58 tests** for the final Workbench/fixture corrections, **86 framework checks**, and **24 input tests** plus **16 card-hold assertions**. These counts overlap earlier coverage and must not be added as a unique total. The unchanged legacy event-log golden passed. Cantrip classification has explicit zero cost; its **41 cost tests passed**.
- The final fast discovered suite at `f3929892c` passed all four exhaustive shards: **7,534 tests, 0 failures**. The local loopback server tests also passed with proxy variables unset (**49 passed**, one Windows-only skip).
- Final CI regression follow-through: `b05b4ff65` measures ordered Core2 pacing through real card/round input and validates required stage waits while retaining the 400/750 ms overhead limits; `f498f431e` isolates runtime-hash mutation probes from parallel repository readers; `e40086ad2` verifies imported hit-stop cases against ordered contact, authored recovery and outcome waits; `8b5518e10` maps the ordered-action criterion to release gate G20. These are targeted test/probe and documentation corrections, not a change to the configured pacing contract.
- After layered battlefield integration at `39e96eb7c`, the same **four viewports passed** in the explicit authored `city-street-rain` daytime fixture, including decoded image layers and rain texture, bounded ground, weather input transparency and reduced-motion pause/resume; **0 page errors**. [Fresh capture record](https://github.com/cehinds/AshenSpire/blob/b92a38e9d268b9c455cbc9b695ba51890b800f24/docs/preview/features/FixCore/merged/README.md) separates source-HTTP images and their historical 1621 stamp from the corresponding rebuilt **1622 / 9341762dd1** standalone. That actual built HTML passed Core2 combat boot over HTTP with cards, enemies, layered art, particles and no page errors. The default OneTap suite passed serially, and its original setting-off double-tap case passed three isolated timing runs. One initial parallel run failed that case; the cause remains unproven, so that attempt is not counted as a pass.
- Public preview evidence is now available: [Pages run 39162811065 / deploy job 117786710670](https://github.com/cehinds/AshenSpire/actions/runs/39162811065/job/117786710670) passed its public checker across **24 feature routes**, including FixCore source `97d7b1117`, **1620 / 9bfa453b97**. The [newer tested 1622 artifact](https://github.com/cehinds/AshenSpire/actions/runs/39164694361/artifacts/12149454632) is distinct; at capture time that update had not yet been publicly verified. Final publication and promotion receipts are tracked in [PR #2129](https://github.com/cehinds/AshenSpire/pull/2129); the older deployment does not certify the latest integration.
- The all-in-one `node tests/run-node.mjs` attempt at checkpoint `d5578f985` hit its existing 15-minute discovered-lane limit during the historical balance simulation. That attempt is **not a pass**. The remaining core/selftest guards passed. All four independently bounded slow files subsequently passed at `b373aa290`: balance documentation **1/1**, simulation-report flags **7/7**, simulation decisions **5/5**, and simulation loop **6/6**. Each retained its original assertions; no production timeout was changed. Final CI and promotion receipts belong to PR #2129.

Local environment limits: Chromium policy blocks `file://` navigation, so the offline-file check could not run here; HTTP bundle boot is not represented as offline acceptance. Outbound access to GitHub Pages is blocked here, so publication must be verified through the trusted Pages workflow's public-route check and linked CI artifacts. The Release branch remains `0.7.1.1517` at `d310c277fffaaec6ec7a58a87de846577f12312d`, matching the existing gallery's recorded source/digest. The coordinator rechecked that GitHub Release branch identity at 2026-10-18 21:05 UTC; direct public Release-history access remains blocked. No release promotion is part of this change.

Runtime/default ambiguities remain the explicit configurable assumptions above. Core2 Evade now says `Gain {evade} Evasion.` and repeated plays add stacks; archived Core1 text/rules retain their original meaning. The component catalog documents the updated card, HUD, log and control surfaces.
