# FixCore: complete requirements, architecture, implementation, and review document

Target feature branch: **`feature/FixCore`**. Project: **AshenSpire**.

This document consolidates the full conversation's corrected requirements, modular JSON/tag design, inspected code and data locations, inline JSON proposals, JavaScript method map, complete implementation prompt, and acceptance/review checklist. It replaces the need to open the three earlier planning documents separately.

**Status:** specification and source audit, not a completed implementation or final team review. Existing source references were inspected at commit `f034d59d0e6cccb922d14cee137e2ff30aed91b1` on local branch `work`; source links below are pinned to that commit. Proposed JSON fields and method names are labeled; they must not be mistaken for functionality already shipped. The checkbox list below records requested scope, not verified completion. No gameplay code was changed while preparing this document.

**Review targeting:** the initial remote check found no `feature/FixCore` branch; remote `dev` pointed to `280f97c9c54c4dd5173a04f12c7f872d17dbffae`, newer than the inspected checkout. These are observed snapshots, not a review of that newer commit. Pin the actual implementation branch/commit before the team assesses completion.

Contents:

1. [Complete corrected requirement checklist](#requirements)
2. [Decisions and remaining ambiguities](#decisions)
3. [Modular architecture and JSON authoring example](#architecture)
4. [Inspected code lines and authored-data change map](#code-map)
5. [Additional inline JSON changes and JavaScript methods](#inline-methods)
6. [Complete implementation prompt](#implementation-prompt)
7. [Team code-review procedure and completion evidence](#review)

<a id="requirements"></a>
## Complete corrected requirement checklist

- [ ] Coordinate Sol 6.1 and Luna workers using actually available model identifiers; report unavailable requested models honestly.
- [ ] Make all FixCore gameplay mechanics modular, configurable through validated JSON, and attachable through registered behavior tags.
- [ ] Reuse the existing mechanics, property mounts, tag registry, and effect/runtime contracts; use one live authority for each migrated rule.
- [ ] Ensure card damage previews match actual resolution, including selected-target mitigation and sequential multi-hit effects.
- [ ] Apply equipped equipment bonuses, including AR, DR, Ward, Poise, and weapon damage, to every eligible played card without double counting.
- [ ] Make attributes, allocated progression points, enhancements, ranks, and equipment changes update actual card values and previews.
- [ ] Make active Ward reduce magical damage by **25%** (damage-taken multiplier **0.75**).
- [ ] Make active Poise reduce physical damage by **25%** (damage-taken multiplier **0.75**).
- [ ] Make Block-granting cards restore both Poise and Ward by the same final Block amount, independently capped, for players and enemies.
- [ ] Show updated damage on cards when relevant Ward/Poise protection is active.
- [ ] Show the exact calculation and named sources when hovering, focusing, or inspecting a card's damage number.
- [ ] Fix stretched PIP items and raise PIP placement while preserving actor association and viewport bounds.
- [ ] Show only Block, Poise, Ward, Evasion stacks, and status-effect stacks in combat PIP indicators, including selected targets; no AC number. Preserve HP in its dedicated health display.
- [ ] Show Weakened, Staggered, Vulnerability, and other active effect stack counts.
- [ ] Make repeated applications add stacks for additive status effects.
- [ ] Apply natural status decay at the affected character's turn start, once per round.
- [ ] Apply Weak/Weakened and Vulnerability to staggered enemies: **25% less AR** and **25% more incoming damage**, without duplicate multipliers.
- [ ] Guarantee a rest area immediately before each boss on every valid route.
- [ ] Allow on-the-fly deck editing with explicit safe handling of active combat piles.
- [ ] Group equivalent cards during character creation/review into one card with **×N**.
- [ ] Show attack count on multi-attack cards and truthful per-hit/total damage.
- [ ] Use ordinary combat reward proportions **60% cards, 10% relic/equipment combined, 30% consumables**, with seeded persistent selection and explicit fallback for exhausted pools.
- [ ] Render travel lines only for edges actually traveled; retain graph connectivity for navigation.
- [ ] Ensure combined enemy heal-and-block actions cost and pay **3 SP** once.
- [ ] Apply the matching-stance effectiveness bonus; its earlier literal **0.25%** remains a separate ambiguity from the corrected Poise percentage.
- [ ] Apply matching-stance discounts to the appropriate used resource lane: **max(SP cost − 1, 1)** or **max(MP cost − 1, 1)**.
- [ ] Make evasion cards available through appropriate training/deck/reward pools and ensure their Evasion effects function.
- [ ] Fit readable card text into the available area without hiding essential costs, effects, or attack counts.
- [ ] Remove wording that merely repeats already-displayed symbols while retaining full inspection details.
- [ ] Use correct category/effect symbols for skills, powers, and nonphysical attribute cards.
- [ ] Play sprite animations at approximately **0.5×** their previous speed by default.
- [ ] Sequence each action: update intent → configurable delay (default 0.5 s) → action/spell word → 0.5 s → sprite animation → 0.5 s → reaction word → delay → damage → PIP/health update → resolution → next action.
- [ ] Use truthful action/reaction words, including Attack, Smash, Sweep, spell names, Blocked, Break, Interrupted, Staggered, Evaded, and Hit.
- [ ] Add persisted Settings controls for auto-combat enablement, **× speed**, and offense/defense preference.
- [ ] Make auto-combat use legal affordable actions, known Perception information, and stance advantage without reading hidden intents.
- [ ] Resolve hits using **d20 + Precision stacks + supported bonuses**, with each Precision stack worth 1 and extra Precision for Smash/Sweep.
- [ ] Make natural **1 miss** and natural **20 hit** for otherwise legal applicable attacks; preserve explicit exceptions deliberately.
- [ ] Calculate Evasion/AC as **(1 + DEX + Evasion stacks + other bonuses) × clamp(stance advantage rating + matching-stance card multiplier, 1, 1.5)**; each Evasion stack contributes 1.
- [ ] On selecting an offensive card, show percentage chance to hit only when the relevant Perception check succeeds.
- [ ] Resolve Perception as **d20 + WIS versus DC**, with base DC and level/Intelligence scaling explicitly configured.
- [ ] Resolve the base-DC ambiguity (**5 versus 8**) without presenting an assumption as user confirmation.
- [ ] Increase Perception DC with level and Intelligence in **+1 increments**, explicitly defining whose stats and the baseline.
- [ ] Show **three available items per shop category**, with persistent stock.
- [ ] Keep expanded/full combat logs above combat art, cards, effects, and PIPs through the shared modal architecture.
- [ ] Include reduction, advantages, hit calculations, and named sources in logs; full log shows detailed arithmetic.
- [ ] Replace HOLD with visible in-place progress while holding End; cancellation resets and completion commits once.
- [ ] Make additional charge-flask collection increase the persisted reallocatable capacity and corresponding ledger values.
- [ ] Let **Basic Training** on Reaver/Rogue allocate arbitrary eligible basic-card copies, subject to overall deck-size rules.
- [ ] Let **Arcane Graduate** on Starseer/Herald allocate arbitrary eligible cantrip copies, subject to overall deck-size rules.
- [ ] Ensure progression entitlements are awarded, claimable, visible, persisted, and reflected in actual stats/cards.
- [ ] Give armor a baseline budget of about **3 stat points plus 1 per additional rank**, supporting HP, MP, SP, base Evasion, base Precision, DR, AR, Poise, Ward, and permitted attributes.
- [ ] Double visible MP artwork in the SP/MP footer, preserving centers/aspect and avoiding clipping at high capacity.
- [ ] Prove JSON-only tuning/attachment changes affect live execution, previews, tooltips, and logs consistently, including equip/unmount and two independent instances.
- [ ] Complete meaningful engine, schema, conformance, save/replay, and browser validation; report remaining gaps honestly.

<a id="decisions"></a>
## Decisions and remaining ambiguities

Latest explicit corrections take precedence: Poise is **25%**, Ward is **25%**, and PIPs must not show an AC number. These are settled.

| Topic | Confirmed request | Proposed implementation default, not confirmation |
|---|---|---|
| Perception base DC | Both 8 and 5 were mentioned | Use **5** from the explicit equation, keep configurable |
| DC scaling | +1 with level and Intelligence | Target level above 1 and target INT above canonical baseline |
| Matching-stance effectiveness | Written as 0.25%; only Poise was later corrected | Literal bonus **0.0025**, multiplier **1.0025**; 25% would instead be bonus 0.25 |
| Status decay | Natural decay at affected owner's turn start, once per round | Remove 1 stack; extra actions do not decay again |
| Weak/Vulnerability potency | −25% AR / +25% damage | Flat potency while active; stacks extend duration unless explicitly configured otherwise |
| Stagger rider count | Apply Weak/Vulnerability stacks | Initial example grants 1 each; keep configurable |
| Smash/Sweep Precision | Higher than ordinary attack | Initial +1 maneuver bonus each |
| Rewards | 60/10/30 | Each ordinary offer-slot category draw; weapon arts count as cards; renormalize nonempty groups |
| Mid-combat deck edits | On-the-fly access | Safe action boundary; composition changes take effect next encounter, visibly explained |
| Armor ranks | About 3 points, +1 per rank | 3 at canonical baseline rank plus 1 per rank above it; rarity is not rank |
| Progression | Missing bonuses must work | Repair existing entitlements, including configured +1 attribute point/level; invent no extra awards |
| Auto-combat | Toggle, speed, offense/defense default | Off initially, 1× speed, offense preference |
| Ward/Poise spending | Each gives 25% typed mitigation | Preserve independent Block/impact mechanics; avoid also applying an unintended duplicate full flat shield |

Do not claim these assumptions were approved. Subsequent user corrections override them. Runtime/source names such as `weak`, `vulnerable`, `starseer`, and `herald` should preserve stable IDs while player-facing wording follows the request.

<a id="architecture"></a>
## Modular architecture and JSON authoring example

This is the second-pass architecture for [the complete FixCore implementation prompt](#implementation-prompt). It preserves every gameplay/UI request from the first pass and changes how mechanics must be implemented. This document specifies implementation work; it does not claim the proposed JSON extensions already run in AshenSpire.

### Intended authoring workflow

1. Choose an existing behavior tag, such as a registered Ward-protection rule.
2. Attach it to an eligible character, card, equipped item, relic, status, or run through JSON.
3. Optionally override validated parameters: amount, percentage, resource, damage type, stack limit, or timing policy.
4. Validate/build. The live game, previews, tooltips, and logs use the same resolved mechanic.

A new combination of supported primitives should require JSON changes only. A genuinely new operation needs one reusable engine primitive, its schema, and tests; subsequent content uses it without per-card JavaScript.

```text
JSON definitions + registered tags + module/profile settings
                         |
                  validate and compile
                         |
              active owner/source bindings
                         |
             shared action plan + receipts
                   /             \
          preview/inspection    authoritative commit
                   \             /
             cards, PIPs, logs, animation events
```

### Build on what exists

The existing [mechanics contract](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md#L1) already defines mechanic folders with manifests, models, interfaces, services, cases, and guides. [build-game.mjs](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/tools/build-game.mjs#L85) emits a tag-to-mechanic index. Live [property mounts](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/properties.js#L84) already track carrier ownership and equip/unmount lifetimes, and [triggers](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/triggers.js#L179) use those sources.

The gap is integration. The [reference interpreter](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L5) imports Node modules; the audit found its imports in tools/tests rather than `src`. It [broadcasts events to loaded mechanics](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L265) and [stores model overrides by mechanic slug](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L142), without a per-item binding scope. A generated manifest or passing reference case is not proof that the live game uses the mechanic.

Reuse those existing systems through a browser-safe evaluator and one live adapter. Do not add another independent dispatcher or alternate damage engine. Port only FixCore rules and required primitives, keeping unrelated mechanics working.

### Required contracts

| Concern | Rule |
|---|---|
| Definitions | One versioned JSON authority per migrated mechanic. Generate compatibility views; do not manually maintain equivalent JS defaults. |
| Tags | Behavior, classification, and presentation tags are distinct. Today's `fx:ward` is visual identity, not a mitigation rule. |
| Parameters | Schema defaults → game/module overrides → attachment overrides → upgrade/rank overrides. Validate every layer. |
| Activation | Enabled module + eligible attachment + active lifecycle. Inventory ownership alone does not activate equipment bonuses. |
| State | Instance scope is `(ownerId, sourceInstanceId, mechanicId)`. Run/combat-global scope is explicitly declared. |
| Stacking | Explicit additive/multiplicative/strongest/exclusive rules and group IDs. Do not infer stacking from tag order. |
| Order | Named calculation stages, dependencies/priority, and stable tie-breaks. JSON file order must not decide combat balance accidentally. |
| Numbers | Fractions remain fractions until quantity rounding. Current integer formula evaluation must not turn `0.75` into `0`. |
| Events | Owner/source/causal action identity, bounded dispatch, and explicit once-per-turn/round gates. |
| Results | Source-attributed receipts with requested/effective values, per-hit changes, rounding, and uncertainty. |
| Persistence | Save versions, mechanic state, active ruleset identity, deterministic RNG streams, and explicit migrations. |
| Presentation | Read-only result/query consumption. Icons/localization are metadata; UI does not calculate damage independently. |

Preserve the live model's rich statuses, card instances, Poise/pressure distinction, Ward pools, and multiplayer seats. Do not round-trip through the reference runner's simplified state and lose information.

### Concrete JSON authoring example

The following is a **proposed extension using the existing mechanic-folder structure**. `defense:wardProtection` is an example new behavior tag that must be registered; it is not an existing tag to paste into current content. Typed modifier fields, immutable `$config` parameters, and `mechanicBindings` require schema, compiler, and runtime support. The implementer must ship executable examples against the final schema.

`engine/mechanics/defense.wardProtection/mechanic.json`:

```json
{
  "id": "defense.wardProtection",
  "tag": "defense:wardProtection",
  "version": "1.0.0",
  "family": "defense",
  "label": "Ward protection",
  "description": "Reduces magical damage while the owner's Ward is active.",
  "attaches": ["character", "entity", "gear", "status"],
  "authored": true,
  "portability": "portable",
  "files": {
    "model": "model.schema.json",
    "interface": "interface.json",
    "service": "service.json",
    "cases": "cases.json",
    "guide": "guide.md"
  }
}
```

Parameter defaults/schema are compiled into an immutable binding configuration, separate from mutable state. Example parameter schema, to be placed in the supported parameter location introduced by the implementation:

```json
{
  "type": "object",
  "properties": {
    "damageTakenMultiplier": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0.75
    }
  },
  "additionalProperties": false
}
```

Proposed `service.json`, extending the existing passive `modifiers` contract with validated semantics:

```json
{
  "mechanic": "defense.wardProtection",
  "handlers": [],
  "modifiers": [
    {
      "id": "active-ward-mitigation",
      "phase": "damage.mitigation",
      "subject": "target",
      "when": { "cmp": [">", "$owner.ward", 0] },
      "select": { "damageKind": "magical" },
      "operation": "multiply",
      "value": "$config.damageTakenMultiplier",
      "stacking": {
        "group": "ward-percentage-mitigation",
        "mode": "strongest"
      }
    }
  ]
}
```

Here `subject:target` means the binding owner must be the incoming hit's target; it must not apply the source's Ward to the defender. `strongest` selects the lowest valid damage-taken multiplier in this reduction group, rather than applying several copies of baseline Ward reduction. This is a proposed grouping policy, explicitly encoded in the data. Other mechanics may use different stacking groups/policies.

A character can use defaults by carrying the tag. A parameterized binding customizes that same activation:

```json
{
  "id": "example-character",
  "tags": ["defense:wardProtection"],
  "mechanicBindings": [
    {
      "tag": "defense:wardProtection",
      "parameters": { "damageTakenMultiplier": 0.75 }
    }
  ]
}
```

This is a partial content record, not a full valid character definition. The tag plus parameter row represent **one binding**, not two effects. If attached to gear, the equip lifecycle and unique item instance identify its owner/source. Removing the item removes only its own contribution. No class-name check belongs in the mitigation primitive.

Existing normalized tagging can remain the compiled representation. If JSON is the authoring input, compile these assignments into that representation; do not require duplicate hand edits to `tagging.csv`. Validate references and reconcile legacy joins explicitly.

Changing the parameter from `0.75` to `0.60` in a test fixture should make 20 isolated magical damage become 12 instead of 15 in resolution, preview, tooltip, and log. Restore `0.75` in shipped defaults. No UI or card-specific JS should need editing for this tuning change.

### How the FixCore requirements become reusable mechanics

| Mechanic family | JSON owns | Generic runtime responsibility |
|---|---|---|
| Equipment contributions | Stat, amount/formula, card-tag eligibility, source restriction, rank scaling | Mount/unmount, aggregate eligible equipped sources, receipt provenance |
| Ward/Poise | Damage type, active-pool condition, multiplier, stacking group | Typed component mitigation and shared rounding |
| Block restoration | Block-granted event, owner scope, resource targets, amount reference, caps | Restore both pools from actual final Block grant, once |
| Weak/Vulnerability/Stagger | AR/incoming-damage modifiers, additive stacks, stagger riders | Apply effects through shared status service |
| Natural decay | Affected-owner turn-start, decrement, round gate, expiry | Owner-scoped lifecycle dispatch and persistence |
| Stance | Match selectors, effectiveness factor, SP/MP lane discount, minimum | Cost/effect queries and payment parity |
| Precision/Evasion | Stack weights, maneuver bonuses, AC expression and bounds | Seeded d20 execution and exact pure odds |
| Perception | DC formula/scaling, reveal policy, observation lifetime | Cached seeded checks and visibility-filtered queries |
| Card behavior | Existing mechanic tags, amount overrides, attack count, target selector | Compose legal actions without per-card branches |
| Training/deck | Required trait tags, eligible card tags, owned/unlimited policy | Shared editor/mutation/validation query |
| Progression/armor | Level awards, baseline budget, per-rank increment, allowed stats | Transactional award/allocation and derived stat recomputation |
| Flasks | Acquisition category, capacity increment, allocation target | Atomic once-only ledger update |
| Rewards/shops | Group weights, category eligibility, stock count | Seeded persistent selection/claiming |
| Map/rest policies | Required preboss rest, route constraints | Graph generation/validation; traveled edges use actual journey state |
| Autoplay | Scoring weights, stance preference, offense/defense policy | Legal-action queries, permitted information, pacing and stop controls |

Do not invent one behavior tag for every UI element. PIP geometry, card text fitting, animation stages, log layering, and hold progress remain reusable presentation components configured by presentation JSON. They read gameplay receipts; they do not run gameplay rules.

### Implementation sequence and acceptance

1. Validate and extend contracts, including parameters, binding lifecycle, modifier stages, scalar arithmetic, and receipts.
2. Reuse the source-mount system and integrate a browser-safe evaluator at the existing action boundaries.
3. Prove one vertical slice: equipped DR affects a tagged defensive card, its final Block restores both pools, and preview/tooltip/log match execution for player and enemy.
4. Migrate the remaining FixCore mechanics; disable corresponding legacy dispatch for each migrated behavior to avoid double application.
5. Integrate presentation against the shared results; run complete feature acceptance from the mega prompt.

Completion requires:

- Two instances of the same mechanic with different JSON parameters act independently.
- Unequipping removes its contribution; save/resume and re-equipping do not duplicate it.
- Disabled modules and absent tags do not activate the behavior.
- Invalid references, parameters, dependency cycles, and unsupported ops fail with file/JSON-path diagnostics.
- Integer counts and fractional multipliers behave correctly; ordered receipts reconcile to actual totals.
- Preview does not mutate gameplay state or RNG; execution rejects/recomputes stale plans.
- At least one new content composition and one tuning change work through JSON alone in the **live game**, not only reference tests.
- Shipped examples include runnable cases, an authoring guide, and a development inspector for active bindings and contribution sources.

Use existing mechanics-generation checks, runtime conformance suites, live engine regressions, build/schema gates, and actual browser validation. Do not label a mechanic portable merely because its stack-application command works while its essential combat behavior still lives in an unrelated hardcoded branch.

<a id="code-map"></a>
## Inspected code lines and authored-data change map

Read-only audit of `/workspace/AshenSpire`, commit `f034d59d0`, branch `work`. References describe this checkout, not a reproduced browser session. No gameplay files were changed and no tests were run. Some requested capabilities already exist; the implementation should repair their active adapters and presentation rather than create parallel systems.

The implementation prompt is [the complete implementation prompt](#implementation-prompt).

Second pass: the prompt now requires modular JSON mechanics activated through validated tag attachments. See [the architecture and JSON examples](#architecture). Existing JavaScript balance locations below are audit/migration sites; migrated mechanics must obtain their values from the canonical JSON contract rather than add competing hardcoded defaults. All earlier functional requirements remain in scope.

### Additional modularity edit sites

| Area | Verified code | Required integration |
|---|---|---|
| Existing JSON architecture | [mechanics contract](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md#L1), [runtime specification](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/SPEC.md#L1) | Extend existing mechanic manifests/models/interfaces/services/cases and module enablement. |
| Tag-to-mechanic index | [build-game.mjs](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/tools/build-game.mjs#L85) | Compiles tag-to-slug mapping; require the live game to resolve active attachments through this mapping. |
| Current live property mounts | [properties.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/properties.js#L84), [owner-scoped triggers](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/triggers.js#L179) | Reuse source ownership, equip/unmount lifecycle, stable gates, and ordering instead of implementing a competing system. |
| Current JSON effects and binding | [nodeEffects.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/source/nodeEffects.json#L2), [propertyRuleBindings.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/propertyRuleBindings.js#L5), [tagService.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/tagService.js#L90) | Bridge/compile into one authoritative mechanics definition and canonical tag index; avoid duplicate CSV/JSON authoring. |
| Node-only reference runtime | [interpreter imports](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L5) | Separate host-neutral evaluator from Node filesystem/assertion utilities before using it in the browser. Current search found no interpreter import under `src`. |
| Unscoped event dispatch | [dispatchEvent](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L265) | Currently scans all loaded mechanics. Filter by enabled module and active owner/source attachment. |
| Shared mechanic model state | [model lookup](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L142) | Currently merges defaults with `state.mechanics[slug]`. Add declared instance scope and immutable parameter precedence without leaking item values across owners. |
| Passive-modifier contract | [mechanic-service.schema.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/contracts/mechanic-service.schema.json#L40) | `modifiers` currently permits generic objects. Define supported operations, phases, selection, stacking and source fields, and implement evaluation. Merely adding JSON is not enough. |
| Fractional calculations | [runtime formula evaluation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L199), [formula flooring](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/formulas.js#L60) | Preserve fractional multipliers until the quantity-rounding stage; maintain backward compatibility. |
| Result receipts | [command/query returns](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L357), [primitive damage](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L403) | Existing results are state/events, with simple damage to Block/HP. Add typed source receipts shared by preview, execution, tooltip and logs. |
| Incomplete mechanic coverage | [Vulnerable service](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/mechanics/status.vulnerable/service.json#L1), [Ward identity manifest](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/mechanics/fx_ward/mechanic.json#L1) | Vulnerable's service applies/removes stacks, but does not encode its damage multiplier; `fx:ward` is explicitly visual identity. Keep icon tags separate from new protection behavior. |

### Combat calculations, cards, and equipment

| Request | Verified code location | Existing behavior and required change |
|---|---|---|
| Card damage matches actual damage | [combat.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L2518), [face-value override](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L2558), [combatDamagePreview.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatDamagePreview.js#L23) | Preview already has per-target/per-hit values, but an un-aimed face explicitly uses offensive damage before target defense. Wire the selected target into the face; share execution calculations, including sequential defense depletion, instead of displaying the unmitigated amount as final damage. |
| Equipment AR/DR and other bonuses apply to played cards | [sourceRatingValue](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/combatRatings.js#L569), [cardRatingBonus](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatRatings.js#L176), [equipment aggregation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/combatRatings.js#L530) | Scoped ratings currently exclude equipment other than `sourceArmamentId`. Preserve applicable equipped armor/global bonuses while keeping source-weapon restrictions and avoiding double counting. Inventory-only items must not contribute. |
| Attributes, enhancements, and progression update values | [rating aggregation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/combatRatings.js#L530), [preview face](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L2560), [level allocation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/levelup.js#L410) | Trace allocation/equipment/enhancement changes through derived stats and preview invalidation. A higher displayed character stat alone is insufficient. |
| Ward and Poise each reduce their damage type by 25% | [actions.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L118), [expanded protection](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L530), [configured combat](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/gameProfileCombat.js#L48) | Expanded v2 explicitly skips percentage mitigation and instead uses flat Ward/Poise absorption. Add the requested `0.75` damage-taken multiplier to the correct physical/magical component and reconcile pool spending so old and new mechanics do not accidentally double-reduce damage. Configured combat has a separate path to reconcile. |
| Block restores both Poise and Ward | [gainBlock](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L875), [gainBlockAmount](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L903), [Ward restoration](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatStatusControl.js#L142), [Poise restoration](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatStatusControl.js#L199) | Block currently adds Block; spell Barrier has another restoration path. Centralize the grant for both factions: final Block grant also restores that amount to each pool, independently capped. |
| Combined enemy healing/block costs 3 SP | [goldenGuard card](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/enemyCards.json#L384) | This example already has `cost:3`, `staminaCost:3`, `manaCost:2`, Block 12 and heal 4. Audit actual affordability/payment and all similar cards before repricing. |
| Multi-attack counts | [playingCard.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/playingCard.js#L165), [card template sequences](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/card.js#L128) | Existing text supports `×N` and unequal hit sequences. Ensure compact/illustrated cards retain the count and use per-hit/total preview values. |
| Calculation tooltip on damage number | [fillTemplate](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/card.js#L110), [whole-card tooltip](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/card.js#L379), [cardTooltip](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/card.js#L654) | Whole-card tooltips exist. Add number-specific accessible hover/focus/touch details from the same calculation receipt, including named sources, target reductions, rounding, and hits. |
| Text fits and avoids redundant wording | [cardFaceText.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/cardFaceText.js#L239), [illustratedCardFitter.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/illustratedCardFitter.js#L6), [card JSON](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/config/ui/components/card.json#L2) | Fitting already exists with line budgets/readable floors. Correct actual clipping and redundant text; do not solve it solely by shrinking text below readable sizes. |
| Correct category symbols | [cardSideTags](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/cardTagSymbols.js#L68), [cardClassification.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/cardClassification.js#L19) | `cardSideTags` unconditionally adds a physical/spell camp tag when found. Separate public category/effect identity from internal camp so powers, skills, and nonphysical attribute cards get appropriate symbols. |

Relevant exact source excerpts:

```js
// src/engine/actions.js:118–119
// Pools only in expanded combat ... no Poise or Ward rating cut.
if (target && !beforeDefense && ctx.combatExpansionVersion !== 2)
  dmg *= ratingDamageMultiplier(ctx, target, isMagicalAttack(ctx, carrier));

// src/model/combatRatings.js:572–575
for (const source of entity.ratingSources) {
  if (source.kind !== 'equipment') value += Number(source[id]) || 0;
  else if (sourceArmamentId && source.sourceId === sourceArmamentId)
    value += Number(source.effectiveRatings?.[id] ?? source[id]) || 0;
}

// src/engine/combat.js:2558–2560
if (combat.combatExpansionVersion === 2 && !targetId && !isCounterReply) {
  // ...
  entry.faceValue = A.computeAttackDamage(combat, p, null, printedBase,
    attackTags, carrier, { matchups: false, beforeDefense: true });
}
```

These are edit sites, not ready-to-apply patches: changing the one conditional alone would not reconcile the other damage pipelines.

### Statuses, stance, hit rolls, and Perception

| Request | Verified location | Required change |
|---|---|---|
| Additive status stacks, owner-start decay | [statuses.js stack handling](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/statuses.js#L113), [end-turn decay](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/statuses.js#L258), [player start](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L602), [enemy start](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L710), [round Evade decay](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatMatchups.js#L731) | Add supported owner-turn-start decay, update schema/content, and remove duplicate end/round decay for migrated statuses. Extra actions must not produce extra decay. |
| Stagger grants Vulnerability and Weak | [enqueueStaggerOnFill](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatRatings.js#L115), [status data](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/source/statuses.json#L398) | Explicitly apply stackable effects. Weak must reduce AR by 25%, not all outgoing damage. Avoid retaining Staggered's separate 50% multiplier on top of Vulnerability. |
| Matching stance cost/effectiveness | [stance defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/content/stanceRules.js#L3), [stance cost](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/stanceRules.js#L48), [action costs](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/actionCosts.js#L321) | Discount currently targets SP. Implement correct SP/MP lane with minimum 1, and one explicit effectiveness factor shared with previews. The user's `0.25%` stance percentage is still separate from the corrected 25% Poise percentage. |
| d20 Precision/Evasion | [stanceHit.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/stanceHit.js#L36), [roll execution](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/stanceHit.js#L69), [evasion calculation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/counterReturn.js#L41) | Current threshold is `clamp(8 + evasion - accuracy, 2, 20)`. Replace hidden base 8 with the requested AC equation, Precision stack weight 1, and positive Smash/Sweep bonuses. Preserve natural 1/20 semantics consistently in odds and rolls. |
| Perception d20 and selected-card odds | [enemyKnowledge.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/content/enemyKnowledge.js#L5), [knowledge formula](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/enemyIntentKnowledge.js#L5), [selected-card odds](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1577) | Current exact/clue reads use probability coefficients and random floats. Introduce seeded `d20 + WIS >= DC`; selected-card percent labels already exist and should reuse the new cached successful read. Base DC 5 versus 8 remains unresolved. |
| Evasion cards | [deck-training evade pool](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/deck-training/defaults.json#L14), [existing prepared-Evade PIP](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1484) | Existing references to Dodge Roll/Quickstep and an evade pool show partial support. Verify definitions, class availability, starter/deck/reward eligibility, and functioning stack grants before adding duplicate cards. |

Authored status changes in [content/source/statuses.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/source/statuses.json#L42):

| JSON selector | Current | Requested/proposed |
|---|---|---|
| `id=weak.stackMode`, line 46 | `"add"` | Keep |
| `id=weak.decay`, line 47 | `"perTurnEnd"` | `"perTurnStart"` — **new enum support required** |
| `id=weak.modifiers.damageDealtMult`, line 49 | `0.75` | Replace with a supported AR-specific 0.75 multiplier; do not merely rename an unrecognized key |
| `id=vulnerable.stackMode`, line 58 | `"add"` | Keep |
| `id=vulnerable.decay`, line 59 | `"perTurnEnd"` | Owner-turn-start |
| `id=vulnerable.modifiers.damageTakenMult`, line 61 | `1.5` | `1.25` |
| `id=staggered.stackMode`, line 402 | `"refresh"` | `"add"` |
| `id=staggered.decay`, line 403 | `"perTurnEnd"` | Owner-turn-start |
| `id=staggered.modifiers.damageTakenMult`, line 405 | `1.5` | Remove duplicate multiplier; Vulnerability supplies the requested 25% |

These current balance values are **JavaScript, not JSON**:

```js
// src/content/stanceRules.js:3–8
evasionPerStack: 3,       // requested: 1
sweepPrecisionBase: -1,  // requested: positive; exact bonus unspecified
sweepPerAdditionalTarget: 1,
roundStartDecay: { evade: 1 }, // migrate applicable decay to owner's turn start
sameStanceDiscount: 1,
physicalMinimumSp: 1,
magicalMinimumSp: 0      // replace with correct resource-lane cost policy
```

### PIPs, animation, settings, and log

| Request | Verified location | Required change |
|---|---|---|
| PIP shows stacks, not AC | [combat meter caller](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1650), [CombatHealthModel](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/CombatHealthModel.js#L9), [badge tooltip](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/combatHealth.js#L61), [status row](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1471) | Caller currently passes `effectiveEvasion(...)`, so the Evade badge is the total rating. Pass/display actual Evasion stack count instead. PIPs contain Block, Poise, Ward, Evasion stacks, and status stacks; no AC number. Keep HP in its health display. |
| PIP stretch and low placement | [TargetHudModel](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/TargetHudModel.js#L19), [target HUD](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/combatTargetHud.js#L44), [target CSS](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/styles/combat.css#L1937), [badge sizing](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/styles/kit.css#L6474) | The target panel retains only HP/Poise meter rows, plus statuses; fix model composition and measure actual placement. Avoid blanket `width:100%` on icon boxes; maintain aspect ratio and raise anchored panels within bounds. |
| Slower sequential action presentation | [animationPace.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/animationPace.js#L6), [fx watchdog](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/fx.js#L1033), [action animation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/fx.js#L1134), [reaction/numbers order](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/fx.js#L1325) | Existing sequential mode is much faster. Implement explicit intent/action/animation/reaction/damage/PIP/resolution stages, configurable 500 ms waits, sprite rate 0.5, and consistent speed scaling. Recalculate watchdog from full sequence. |
| Auto-combat settings/policy | [existing speed settings](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/settings.js#L364), [animation pace](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/animationPace.js#L30) | Existing `auto/slow/normal/fast/instant` animation setting is not an autoplay toggle. Add persisted enable/speed/offense-or-defense controls; use legal actions and only Perception-known information. |
| Detailed log and topmost expansion | [log receipts](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/combatLog.js#L145), [log modal](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/combatLogModal.js#L36), [modal stack](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/modalManager.js#L129), [tool stacking](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/styles/combat-layers.css#L262) | Existing log has aggregate modifiers and absorption. Add source-by-source arithmetic and a distinct full-detail view. Fix portal/ancestor stacking; raising a nested element's z-index alone may not help. |
| End hold progress | [hold painting](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/holdconfirm.js#L213), [HOLD hint](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/holdconfirm.js#L267) | Progress already exists as `--hold` and `data-hold-progress`. Render it in place of HOLD during the hold; use existing lifecycle/cancel/reset logic. |
| MP artwork 2× larger | [mana sockets JSON](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/config/ui/presentation/footerLayout.json#L348), [socket scaling](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/FooterLayoutModel.js#L53), [fallback renderer](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/staminaOrb.js#L23), [fallback sizes](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/content/staminaOrb.js#L5) | Active MP art is `mana-*` diamonds, currently `w:22,h:32`; the separate `sp-sigil` is hidden. Enlarge the visible MP element 2× and preserve its center/aspect. Verify live resampling does not cancel the intended scale. |

Current presentation JSON values:

```json
{
  "sizing": {
    "panelWidthPx": 224,
    "compactPanelWidthPx": 198,
    "panelHeightPx": 108,
    "statusHeightPx": 34,
    "statusIconPx": 29,
    "narrowCrowdedStatusIconPx": 22
  },
  "positioning": {
    "gapPx": 8,
    "edgeInsetPx": 12,
    "staggerStepPx": 36,
    "enemyLaneSides": ["left", "below", "right"]
  },
  "motion": { "dwellMs": 500, "fadeMs": 150 }
}
```

This is an excerpt of [combatTargetHud.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/config/ui/components/combatTargetHud.json#L2), not replacement contents. The exact vertical adjustment requires browser measurement; do not invent a universal pixel fix.

For the visible first mana socket, a center-preserving 2× candidate in [footerLayout.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/config/ui/presentation/footerLayout.json#L348) is:

```json
{ "id": "mana-0", "x": 98, "y": 77, "w": 44, "h": 64 }
```

Current values are `x:109,y:93,w:22,h:32`. Apply equivalent center-preserving scaling to the actual MP artwork across all sockets/layouts, then validate overlap at high MP capacities. Do not replace a full socket record with this partial excerpt.

Current normal timing in [animationPace.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/animationPace.js#L8) is `beatMs:240, stepMs:68, lungeMs:195, impactCapMs:186, reactionMs:180, stanceLeadMs:100`. Presentation-sequence JSON has `defaultDurationMs:600, minimumDurationMs:96, maximumDurationMs:5000` at [presentationSequence.json](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/content/config/ui/presentation/presentationSequence.json#L61); changing that duration alone does not change the combat queue.

### Rewards, map, shops, deck, progression, and flasks

| Request | Verified location | Existing behavior and required change |
|---|---|---|
| 60/10/30 rewards | [uniform category pick](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L57), [reward JSON](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/rewards.json#L2), [legacy 10% card chance](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/content/balance.js#L626) | Configured rewards choose uniformly among six categories. Add weighted groups totaling 100: cards 60, equipment/relics 10 combined, consumables 30. Legacy rewards separately gate cards at 10%; reconcile supported paths. |
| Shop 3/category | [shop stock](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L121), [shop JSON](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/shops.json#L2), [module defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/shops/defaults.json#L3) | Current `offerCount:3`/`options:3` means three total mixed items. Add per-category stock policy and persist stock. |
| Rest immediately before boss | [route JSON](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/routes.json#L17), [configured generator](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actmap.js#L133) | `prebossNodes:7`, `restFloors:[1,6]`, boss at floor 8. Change to `[1,7]` and validate every boss predecessor. Legacy mapgen already guarantees a shrine at [mapgen.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/mapgen.js#L160). |
| Traveled edges only | [mapboard.js](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/mapboard.js#L336) | `isTraveled` is computed at line 346, but both outline and edge are rendered anyway at 352–353. Filter both based on actual consecutive traveled pairs; keep underlying graph connectivity. |
| Deck editor on the fly | [deck defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/content/deckRules.js#L11), [editor doors](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/DeckEditorModel.js#L470), [equipment editor policy](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/equipment/defaults.json#L3) | Legacy defaults are enabled/free, but combat is explicitly excluded and configured policy says noncombat. Repair in-run access and define how active-combat edits affect piles. |
| Unlimited basic/cantrip copies for class traits | [training defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/deck-training/defaults.json#L6), [trait copy limit](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/kernel/gameConfig.js#L416), [disconnected editor rule](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/deckRules.js#L88), [rest editor rule](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRest.js#L38) | Trait-aware policy already exists but editor reads another unlimited list. Use one policy in editor, validation, mutation, and rest. Keep owned-only cards constrained. |
| Correct class training | [Starseer tags](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/characters.json#L81), [Herald tags](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/characters.json#L231) | All four classes currently have `training.basic`. Retain it for Reaver/Rogue; give Starseer/Herald `training.graduate` and public name Arcane Graduate. |
| Creation duplicate grouping | [review deck rendering](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/customize.js#L1547), [existing grouped equipment preview](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/customize.js#L1166) | Review maps one card per instance. Reuse meaningful identity grouping and show `×N`, without merging different ranks/enhancements. |
| Progression bonuses | [progression defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/progression/defaults.json#L3), [level claim](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/levelup.js#L172), [allocation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/levelup.js#L410) | Existing defaults already enable levels/unlocks and award 1 attribute point per level. Repair award/allocation/stat propagation and visibility rather than inventing unspecified new rewards. |
| Armor budget and stat choices | [gear defaults](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/modules/gear/defaults.json#L47), [allowed stat keys](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/kernel/gameConfig.js#L176), [resolveGearItem](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/kernel/gameConfig.js#L198), [armor data](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/games/ashenspire/packs/core/gear.json#L470) | Active merged budgets are rarity-based 4/5/6/7; a separate inactive ratings budget is 3/4/5/6. Add armor-specific base 3 plus 1/rank; expand supported stats to HP/MP/SP/Evasion/Precision/DR/AR/Poise/Ward. Do not change weapon budgets accidentally. |
| Flask capacity increases when collected | [reward claim](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L108), [addFlask](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L1969), [capacity opcode](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L1984), [ledger/reallocation](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gracerefill.js#L34) | Some acquisition paths only push inventory. Use the capacity-grant operation for charge flasks, updating `capacity`, allocation, current charges, and `granted` once. Utility consumables remain inventory. |

### JSON values to change or introduce

Existing supported edits:

```text
games/ashenspire/packs/core/routes.json
  restFloors: [1, 6] -> [1, 7]

games/ashenspire/packs/core/characters.json
  Starseer/Herald tags: training.basic -> training.graduate

content/source/statuses.json
  vulnerable.modifiers.damageTakenMult: 1.5 -> 1.25
  staggered.stackMode: refresh -> add
```

Proposed **new** contract fields, requiring matching schemas, defaults, readers, save handling, and tests:

```json
{
  "rewardGroups": [
    { "id": "cards", "weight": 60, "categories": ["combatCards", "weaponArts"] },
    { "id": "equipment", "weight": 10, "categories": ["weapons", "armor", "relics"] },
    { "id": "consumables", "weight": 30, "categories": ["potions"] }
  ]
}
```

Place the above in the reward contract, and `{"itemsPerCategory":3}` in the shop contract. These fields are not implemented today. Weapon arts counting as cards is a proposed interpretation.

Proposed presentation motion/settings shape (names are illustrative, not existing keys):

```json
{
  "motion": {
    "actionSequence": {
      "intentDelayMs": 500,
      "actionLabelDelayMs": 500,
      "postAnimationDelayMs": 500,
      "reactionDelayMs": 500,
      "spritePlaybackRate": 0.5
    }
  }
}
```

Gameplay rules belong in existing balance/module contracts, not presentation JSON. Use damage-taken factor `0.75`, Precision/Evasion stack weight `1`, natural miss `1`, natural hit `20`, stance cost discount `1`, minimum payable resource cost `1`, and evasion multiplier bounds `[1,1.5]`.

### Decisions still not fully specified

- Perception: both base DC 8 and DC 5 were requested. The prompt proposes DC 5 because it is in the explicit final equation, and labels it an assumption.
- DC scaling: whose level/Intelligence was not specified. The prompt proposes target level above 1 and target Intelligence above its baseline, each +1.
- Matching-stance effectiveness was written as 0.25%. The later correction explicitly addressed Poise only. The prompt retains literal 0.25% as a configurable default; 25% would be a separate correction.
- Status stacks add and decay, but per-stack potency and decay amount were unspecified. The prompt proposes one stack per owner turn and flat 25% Weak/Vulnerability potency while active, avoiding unrequested exponential scaling.
- On-the-fly editing does not specify live-pile mutation. The prompt allows editing at safe boundaries during combat but applies composition changes to the next encounter, with clear UI text.
- Armor rank origin, additional Smash/Sweep Precision, reward depletion fallback, and detailed auto-combat scoring require explicit implementation assumptions; these are provided in the prompt.

### Build/verification entry points

Read [CONTRIBUTING.md](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/CONTRIBUTING.md), [DEVELOPER.md](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/DEVELOPER.md), and [SPEC.md](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/SPEC.md). Presentation JSON compiles with `node tools/config-build.mjs`; authored content compiles with `node tools/content-build.mjs`. Never hand-edit generated modules. Module schemas and runtime adapters must accept new fields.

Relevant gates from package scripts: `npm test`, `npm run test:all`, `npm run validate:config`, `npm run validate:maps`, `npm run validate:ui`, `npm run build:game`, `npm run lint:style`, and `npm run build:standalone`. Use focused regression suites first, then required repository gates. Browser validation must inspect actual running cards, PIPs, timing, log layering, creation, map, shop, deck, flasks, and footer across mobile/tablet/desktop/wide.

<a id="inline-methods"></a>
## Additional inline JSON changes and JavaScript methods

The following preserves the additional examples and method-level guidance shown inline in the conversation. These are proposed extensions unless described as existing. Partial JSON records do not replace entire content files.

### Parameterized equipment contribution example

```json
{
  "id": "example-armor",
  "tags": ["equipment:statContribution"],
  "mechanicBindings": [
    {
      "tag": "equipment:statContribution",
      "parameters": {
        "activation": "equipped",
        "contributions": [
          { "stat": "dr", "operation": "add", "value": 2, "scope": "owner" },
          { "stat": "wardMax", "operation": "add", "value": 1, "scope": "owner" }
        ]
      }
    }
  ]
}
```

These amounts are examples, not an approved balance change. Validate the new tag, parameter schema, contribution types, equipped lifecycle, and source identity. Preserve the distinction between allocation points and resolved final stat values.

### Block, status, stance, hit, and Perception parameter examples

These are excerpts for separate mechanic configurations, not one new global settings file:

```json
{
  "blockRestoration": {
    "amountSource": "actualBlockGranted",
    "resources": ["poise", "ward"],
    "amountMultiplier": 1,
    "capAtMaximum": true,
    "oncePerGrant": true
  },
  "naturalStatusDecay": {
    "event": "ownerTurnStart",
    "stacksRemoved": 1,
    "maximumApplicationsPerRound": 1
  },
  "stagger": {
    "applyStatuses": [
      { "id": "weak", "stacks": 1 },
      { "id": "vulnerable", "stacks": 1 }
    ]
  },
  "weak": { "affectedStat": "ar", "multiplier": 0.75 },
  "vulnerable": { "affectedStat": "incomingDamage", "multiplier": 1.25 }
}
```

```json
{
  "matchingStance": {
    "resourceDiscount": 1,
    "minimumPayableCost": 1,
    "effectivenessBonus": 0.0025
  },
  "hitRules": {
    "dieSides": 20,
    "naturalMiss": 1,
    "naturalHit": 20,
    "precisionPerStack": 1,
    "evasionBase": 1,
    "evasionPerDexterity": 1,
    "evasionPerStack": 1,
    "maneuverPrecision": { "smash": 1, "sweep": 1 },
    "stanceMultiplierMinimum": 1,
    "stanceMultiplierMaximum": 1.5
  },
  "perception": {
    "baseDC": 5,
    "rollAttribute": "wisdom",
    "dcPerTargetLevelAboveBaseline": 1,
    "dcPerTargetIntelligenceAboveBaseline": 1
  }
}
```

The ambiguity table controls these defaults. Derive both the code path and displayed explanations from resolved configuration; never implement these excerpts as unused JSON.

### Armor and presentation configuration examples

```json
{
  "armorBudget": {
    "basePoints": 3,
    "pointsPerRankAboveBaseline": 1,
    "allowedStats": ["hp", "mp", "sp", "baseEvasion", "basePrecision", "dr", "ar", "poise", "ward"]
  }
}
```

```json
{
  "motion": {
    "actionSequence": {
      "intentDelayMs": 500,
      "actionLabelDelayMs": 500,
      "postAnimationDelayMs": 500,
      "reactionDelayMs": 500,
      "spritePlaybackRate": 0.5
    }
  },
  "autoCombat": {
    "enabled": false,
    "speedMultiplier": 1,
    "preference": "offense"
  }
}
```

Motion belongs in presentation JSON; auto-combat preferences belong in persisted settings. The gameplay scheduler consumes the same legal-action and knowledge queries as manual play.

### Proposed generic interfaces

The following method names are new design proposals, not existing exports:

```js
resolveMechanicBindings(definitions, owner, source, profile)
// Active bindings with validated parameters and stable source identities.

collectModifierContributions(bindings, phase, context)
// Ordered applicable contributions with provenance and stacking policy.

planAction(snapshot, action, bindings)
// Pure costs, conditional outcomes, per-hit calculations and receipts.
// Does not consume gameplay RNG.

commitAction(state, action, authority)
// Validate current state, resolve authoritative rolls, and commit once.
// Never blindly execute a stale hover preview.
```

An equipment eligibility replacement must preserve scope rather than blindly add every item:

```js
// Proposed pseudocode; these helper names are not existing exports.
for (const contribution of resolvedEquipmentContributions(entity)) {
  if (!contributionAppliesToCard(contribution, carrier, id)) continue;
  value += contribution.value;
  receipt.addSource(contribution);
}
```

### Existing JavaScript methods to update

| File / method | Required integration |
|---|---|
| [interpreter.mjs:117 — createRuntime()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L117) | Browser-safe evaluator, compiled mechanics, injected state/RNG authority |
| [interpreter.mjs:134 — lookup()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L134) | Immutable parameters and independent per-binding state |
| [interpreter.mjs:265 — dispatchEvent()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L265) | Active owner/source binding filter |
| [interpreter.mjs:275 — runHandler()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L275) | Owner, source, causal action, lifecycle, once-per-round gates |
| [interpreter.mjs:328 — runOp()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/runtime/interpreter.mjs#L328) | Validated supported parameters and effective result receipts |
| [properties.js:84 — mountProperties()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/properties.js#L84) | Resolve behavior tags/parameters through existing source ownership |
| [properties.js:108 — unmountProperties()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/properties.js#L108) | Remove only the source's contributions |
| [properties.js:332 — syncLoadoutProperties()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/properties.js#L332) | Refresh bindings/derived values without duplicates |
| [build-game.mjs:71 — buildGame()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/tools/build-game.mjs#L71) | Compile/validate schemas, bindings, dependencies, and modifiers |
| [combatRatings.js:569 — sourceRatingValue()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/combatRatings.js#L569) | Equipped armor/global contributions plus correctly scoped weapon bonuses |
| [engine/combatRatings.js:176 — cardRatingBonus()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatRatings.js#L176) | Shared card eligibility for ratings and typed modifiers |
| [actions.js:95 — computeAttackDamage()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L95) | Shared damage stages/receipts |
| [actions.js:234 — applyAttackDamage()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L234) | Commit authoritative result once |
| [actions.js:610 — applyExpandedDamage()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L610) | Reconcile old absorption and new typed percentage mitigation |
| [actions.js:799 — computeBlockGain()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L799) | Equipment, DR, and stance affect final grant |
| [actions.js:875 — gainBlock()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/actions.js#L875) | One Block-grant restoration event for both pools |
| [combatDamagePreview.js:23 — previewDamageHits()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatDamagePreview.js#L23) | Shared sequential-hit state projection |
| [combat.js:2367 — previewCard()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L2367) | Selected target, actual values, hit counts and receipts |
| [combat.js:1445 — resolvedCardPlayCosts()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combat.js#L1445) | Matching-stance SP/MP discount/payment parity |
| [stanceRules.js:48 — stanceStaminaCost()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/stanceRules.js#L48) | Shared resource-lane cost policy |
| [statuses.js:52 — applyStatus()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/statuses.js#L52) | Declared stacking and status bindings |
| [statuses.js:258 — decayAtTurnEnd()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/statuses.js#L258) | Move migrated effects to owner-start decay |
| [combatRatings.js:119 — enqueueStaggerOnFill()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/combatRatings.js#L119) | Invoke JSON-defined stagger riders |
| [stanceHit.js:36 — attackHitPreview()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/stanceHit.js#L36) | Exact odds using requested AC/Precision formula |
| [stanceHit.js:69 — resolveAttackHit()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/engine/stanceHit.js#L69) | Same formula with authoritative seeded rolls |
| [enemyIntentKnowledge.js:28 — rollKnowledgeRead()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/enemyIntentKnowledge.js#L28) | Cached d20 + WIS against configured DC |
| [UI combat.js:1601 — syncHitChances()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1601) | Selected offensive-card odds gated by successful Perception |
| [UI combat.js:1629 — meterBars()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1629) | Evasion stacks rather than effective Evasion rating |
| [UI combat.js:1471 — statusRow()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/combat.js#L1471) | Correct status counts after stacking/decay |
| [CombatHealthModel.js:9 — combatHealthModel()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/CombatHealthModel.js#L9) | Approved PIP fields, no AC |
| [TargetHudModel.js:19 — placeTargetHudPanels()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/TargetHudModel.js#L19) | Higher bounded placement associated with actor |
| [card.js:654 — cardTooltip()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/card.js#L654) | Damage-number calculation/source details |
| [illustratedCardFitter.js:6 — fitIllustratedCards()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/illustratedCardFitter.js#L6) | Readable unclipped text/attack counts |
| [cardTagSymbols.js:68 — cardSideTags()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/cardTagSymbols.js#L68) | Public category/effect identity instead of misleading physical camp |
| [fx.js:758 — animateEvents()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/fx.js#L758) | Configured serial presentation stages |
| [animationPace.js:31 — setAnimSpeed()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/animationPace.js#L31) | Coherent delay/playback scaling without gameplay changes |
| [holdconfirm.js:180 — armHold()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/holdconfirm.js#L180) | In-place progress via existing paint/begin/stop lifecycle |
| [gameProfileRewards.js:57 — makeOffer()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L57) | Weighted groups and persisted offers |
| [gameProfileRewards.js:121 — gameProfileShopStock()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L121) | Three eligible persisted items per category |
| [mapboard.js:254 — mountMapBoard()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/mapboard.js#L254) | Filter untraveled main/outline strokes near line 346 |
| [deckRules.js:88 — unlimitedCardIds()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/deckRules.js#L88) | Shared trait-aware copy eligibility |
| [gameConfig.js:416 — deckCopyLimit()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/kernel/gameConfig.js#L416) | Canonical training policy for UI and mutation |
| [DeckEditorModel.js:470 — deckEditorDoors()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/models/DeckEditorModel.js#L470) | On-the-fly access and safe combat handling |
| [customize.js:1547 — review rendering](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/screens/customize.js#L1547) | Group equivalent instances and display ×N |
| [gameConfig.js:198 — resolveGearItem()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/engine/kernel/gameConfig.js#L198) | Armor rank budgets and additional supported stats |
| [gameProfileRewards.js:90 — claimGameProfileReward()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gameProfileRewards.js#L90) | Shared atomic charge-flask capacity grants |
| [gracerefill.js:56 — reallocateFlaskCharges()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/model/gracerefill.js#L56) | Updated capacity with allocation invariant |
| [combatLogModal.js:36 — openCombatLogModal()](https://github.com/cehinds/AshenSpire/blob/f034d59d0e6cccb922d14cee137e2ff30aed91b1/src/ui/components/combatLogModal.js#L36) | Full receipts through topmost applicable shared modal layer |

The code-and-data map above also covers route generation, stat allocation, flask opcodes, card creation, footer rendering, log formatting, and schema edit sites that are sections rather than exported methods.

<a id="implementation-prompt"></a>
## Complete implementation prompt

You are the coordinating engineering agent for AshenSpire. Implement the complete scope below on the exact integration branch `feature/FixCore`. Make the requested mechanics modular and authorable through validated JSON and tag attachments. Carry the work through implementation, meaningful regression tests, browser validation, and the repository's delivery workflow. Do not stop after producing a plan or changing configuration without wiring its consumers.

Repository: `/workspace/AshenSpire`. A read-only source audit is available at the code-and-data map in this document, based on commit `f034d59d0`. Read that map, then verify the named functions against the current checkout because line numbers may move. If this prompt is used in another workspace, locate the repository and search the named functions rather than assuming the absolute paths still exist.

Second-pass architecture and concrete JSON examples: the modular architecture and JSON examples in this document. The modularity requirements below supersede any earlier suggestion to add new independent hardcoded gameplay balance values. Existing JavaScript balance references in the code map are migration entry points, not the intended authoring authority for migrated FixCore mechanics. All functional requirements and explicit numerical assumptions below remain in scope.

### Coordination and branch workflow

1. Read applicable `AGENTS.md` if present, `CLAUDE.md`, `CONTRIBUTING.md`, `DEVELOPER.md`, and relevant `SPEC.md` sections. The user's requested behavior takes precedence over earlier contrary design decisions. Update contractual specifications through the repository's required workflow before implementing changed mechanics; reconcile comments and tests that encode superseded rules.
2. Inspect git status and preserve unrelated changes. Fetch the integration base when available. Create `feature/FixCore` from the current `dev` base, or safely continue that exact existing feature branch. Do not reset or discard existing work to obtain a clean branch.
3. Coordinate Sol 6.1 and Luna workers when available. Use Sol for combat formulas, shared contracts, integration, and review; use Luna for narrowly scoped content/UI changes and test execution. Check actual model availability: do not invent a `Luna 6.1` model identifier or claim a model was used when it was unavailable. Report any fallback. Delegate with explicit file ownership; workers use isolated `worker/FixCore/<scope>` branches/worktrees. Shared files such as combat.js, actions.js, statuses, schemas, and generated outputs have one owner per wave. Integrate changes sequentially and perform independent review.
4. Implement in small reviewable commits. Follow the repository's standing push/review/PR/promotion rules and required preview evidence. Feature PRs target `dev`; preserve the owner's release/main boundary. Attach any created PR to the Codex task. Do not publish invented preview URLs or claim unrun checks passed.
5. Maintain a requirement-to-code-and-test checklist. A feature already implemented still needs its reported failure traced through the active runtime. Prefer repairing existing shared policies and renderers over creating parallel systems.

### Explicit assumptions for this run

These are implementation defaults where the conversation was ambiguous, not claims that the user confirmed them. Keep them centralized and report them in the final handoff. Use any subsequent explicit user correction instead.

- Perception base DC: **5**, following the explicit `1d20 + WIS vs DC 5` equation; the same request also mentioned 8.
- Perception scaling: `DC = baseDC + max(targetLevel - 1, 0) + max(targetINT - baselineINT, 0)`, coefficients 1 each. Reuse the game's canonical attribute baseline; make it explicit in configuration/receipts. Observer WIS affects the roll. Do not use observer INT to make their own check harder.
- Matching-stance effectiveness: the user wrote **0.25%**, so the literal bonus is **0.0025**, multiplier **1.0025**. The later 25% correction explicitly named Poise only. Keep this bonus configurable and explicitly flag the possible intended alternative **25% = 0.25**, multiplier **1.25**, in the handoff. Do not silently conflate these percentages.
- Natural status decay: **1 stack at the affected character's turn start, at most once per round**. Additional stacks extend duration unless an existing explicit per-stack mechanic says otherwise. Weak/Vulnerability use flat 25% potency while active, not exponential or uncapped per-stack multipliers.
- Smash and Sweep receive an initial **+1 Precision** maneuver bonus, configurable, in addition to Precision stacks. Retain other bonuses only where supported by the requested formula and document their source.
- Reward percentages apply to each ordinary post-combat offer-slot category draw: cards 60%, relic/equipment 10% combined, consumables 30%. Weapon arts count as cards. Preserve existing choice count/take count. When a group has no eligible items, renormalize remaining nonempty group weights and log the fallback; do not substitute unrelated items silently.
- On-the-fly deck editing is accessible throughout a run. During combat, open only at a safe action boundary and stage composition changes for the next encounter; clearly say so in the editor. Do not remint cards into live draw/hand/discard/exhaust piles or permit replay exploits. Out of combat, edits apply immediately.
- Armor budget is **3 points at baseline rank, plus 1 for each rank above baseline**; use the canonical rank convention. Rarity is not automatically the same thing as rank. Keep weapon budgets unchanged.
- Existing progression entitlements remain the baseline, including the configured +1 attribute point per level. Repair missing application/visibility; do not invent unspecified progression rewards.
- Auto-combat defaults off, speed multiplier 1×, policy offense. User can switch policy to defense.
- Preserve existing Block absorption and explicit impact damage to defense meters. Treat Poise/Ward's requested 25% protection as percentage mitigation instead of accidentally retaining an additional full flat damage shield for those same pools. Document the final reduction/spending order and test it.

### Required architecture: JSON mechanics activated by tags

**Authoring outcome:** after reusable primitives are implemented, a designer can attach an existing mechanic to a card, character, equipped item, relic, status, or run by assigning its registered behavior tag and optional validated JSON parameters. Changing that JSON must change the actual game's resolution, preview, tooltip, and log consistently. A new composition of supported mechanics requires no per-card/per-class JavaScript branch. A genuinely new primitive may require one generic engine implementation, schema/catalog updates, and conformance tests.

1. **Extend existing contracts.** Use `engine/mechanics/<slug>/{mechanic.json,model.schema.json,interface.json,service.json,cases.json,guide.md}`, `engine/runtime/{ops.json,formulas.json,SPEC.md}`, module/profile contracts, and the existing content/tag compiler. Reuse `src/engine/properties.js` carrier ownership/lifecycle and `src/engine/triggers.js` where appropriate. Do not add an unrelated second rules language, tag registry, dispatcher, or combat loop. Mark authored folders so generation cannot overwrite them. Scope migration to FixCore mechanics and their required primitives; do not require rewriting every unrelated mechanic.
2. **One authoring authority.** Every migrated rule and tuning value has one canonical JSON definition; compatibility tables are derived. Optional JSON tag declarations/attachments compile into the existing normalized tag model. Do not require authors to manually synchronize the same assignment in both JSON and CSV. Preserve canonical tag spelling and stable IDs; aliases require explicit mapping. Distinguish behavior, classification, and presentation tags: attaching an icon-only tag such as today's `fx:ward` must not accidentally grant mitigation. Modules enable capabilities; tags select bindings; explicit lifecycles determine when a binding is active.
3. **Binding contract.** Validate attachment kind, owner ID, source instance ID, tag/mechanic ID, enabled-module dependencies, activation window, parameter overrides, and uniqueness. A plain behavior tag uses validated defaults; an optional parameterized binding customizes that same attachment without creating a second activation. Equipped items activate only while equipped; cards activate in the declared play/persistent-power window; statuses activate only while present; run rules attach once per run. Use the same path for enemies and players.
4. **Instance isolation.** Separate immutable effective parameters from mutable state. Resolve parameters in documented order: mechanic schema defaults -> game/module overrides -> attachment overrides -> validated upgrade/rank overrides. Runtime state belongs to `(owner, source instance, mechanic)` where instance scope is declared; global combat/run state is explicit. One armor item's overrides or cooldown must never leak to another. Unmounting removes that source's contribution; re-equipping cannot register it twice.
5. **Browser-safe execution.** The current reference interpreter imports Node modules and is used by tools/tests. Extract/reuse a host-neutral evaluator with Node-only loading/assertions in adapters. Supply compiled mechanics from the game build to the live action pipeline. Preserve the existing authoritative action queue and transactional resource/RNG ownership. The reference runner and browser execute the same semantics.
6. **Typed operations and stages.** Reuse existing effects, predicates, calls, and formulas. Implement only missing reusable primitives needed for typed stat contributions, damage modifiers, capped pool restoration, status application/decay, resource cost modifiers, d20 checks, weighted selection, copy-limit queries, and ranked stat budgets. Declare deterministic calculation phases, explicit priority/dependencies, and stable tie-breaks; filesystem/tag ordering must not silently define balance. Each contribution declares scope, operation, target metric, stack/group policy, and provenance. Unknown operations or parameters fail clearly; never silently ignore fields that affect gameplay. No `eval` or executable JavaScript strings in JSON.
7. **Numeric semantics.** Preserve fractional factors such as `0.75`, `1.25`, and `1.0025` until their documented quantity-rounding stage. The current formula evaluator floors formula results; do not route a standalone multiplier through it and turn `0.75` into zero. Version scalar-versus-quantity evaluation or use an explicit fixed-point contract while preserving existing formulas' behavior.
8. **One result contract.** Produce a resolved action plan/calculation receipt with ruleset version, state revision, actor/target/card/source IDs, requested and effective amounts, modifier order and source values, per-hit typed reductions, pools spent/restored, rounding, uncertainty, and emitted outcomes. Preview evaluates a snapshot without consuming RNG. Execution validates/recomputes against current state and commits once; never blindly commit a stale hover preview. Tooltips, PIPs, AI scoring, and logs consume these results rather than reconstructing formulas.
9. **Lossless state/RNG adapter.** Preserve live card-instance identity, rich status instances, durations/buildup, Poise versus pressure, Ward, maxima, multiplayer seats, and named RNG streams. Do not overwrite live state with the reference runtime's simplified numeric-status/card-ID model. Persist mechanic state and ruleset versions explicitly; rebuild derived bindings idempotently. Invalid/incompatible saves receive explicit migration or rejection, not silent reinterpretation.
10. **Bounded owner-scoped events.** Dispatch only applicable active bindings, with causal event/action IDs, owner/source scope, and once-per-turn/round/action gates. Reuse existing event limits; prevent recursive Block/restore/status grants and duplicate handling through legacy opcodes plus new tags. Schedule percentage mitigation in calculation phases; do not implement it as a damage event that recursively deals another hit.
11. **Presentation stays separate.** JSON mechanic metadata references localization and icon IDs and exposes public queries/receipts. Card symbols and PIP fields derive from that metadata and the approved presentation configuration. Layout, text fitting, animation timing, log layers, and hold progress stay in UI modules/configuration, not gameplay handlers. UI JSON must not become a second authority for combat amounts.
12. **Authoring tools and validation.** Provide a minimal template/scaffolding command or documented copyable recipe for adding a mechanic and attaching it. Validate parameters, tag registration, attachment types, dependencies, references, bounds, command/event/query payloads, conflicting exclusive rules, and missing primitive support. Errors identify the source file, JSON path, entity/attachment, and rule ID. Add a development inspector showing active tags/bindings, effective parameters, contributions, and why a rule did or did not apply.

Map the full feature scope into reusable rule families: equipment stat contributions; typed Ward/Poise mitigation; Block restoration; status stacking/decay/stagger; stance costs/effectiveness; Precision/Evasion; Perception; weighted rewards/shop stock; deck-training eligibility; progression/armor rank budgets; flask capacity. Route/map policies remain module/map JSON, and autoplay reads shared queries/receipts with a JSON-configured policy. Do not force arbitrary CSS/layout work into behavior tags.

Implement in dependency order: contracts/primitives -> binding and live adapter -> one vertical slice (equipped DR + Block restoring both pools + preview/receipt) -> remaining FixCore mechanics -> UI/presentation -> integration/authorability validation. Review the vertical slice before parallel workers build on its contracts.

### A. One authoritative combat calculation

Implement a shared pure calculation/receipt path used by execution, card faces, target previews, number tooltips, enemy intents where knowable, and logs. Keep engine code headless and deterministic. Previewing, hovering, selecting targets, and rendering must not consume RNG, spend resources, consume statuses, or mutate live state.

Start with `src/engine/actions.js`, `src/engine/combatDamagePreview.js`, the preview functions in `src/engine/combat.js`, `src/model/combatRatings.js`, `src/engine/combatRatings.js`, and `src/engine/gameProfileCombat.js`.

- Apply relevant **equipped** bonuses to played cards: AR, DR, Ward, Poise, weapon damage, attributes, and any other supported equipment modifiers. Armor/global modifiers must survive weapon-source filtering. Source-specific weapon bonuses must not be counted twice or borrowed from unequipped items.
- Ensure attributes, allocated progression points, enhancements, rank, and equipment swaps update both resolution and all previews immediately after the change becomes effective.
- When Ward is active, multiply incoming magical damage by **0.75**. When Poise is active, multiply incoming physical damage by **0.75**. Split mixed attacks into typed components; do not reduce a magical component with Poise or a physical component with Ward.
- Define mitigation order and rounding once. Keep integer displays and resource changes consistent. For an isolated incoming component of 20, the relevant active protection produces 15 before other independent modifiers. Zero protection produces no percentage reduction.
- Cards that grant Block also restore Poise and Ward by that same final Block amount, for both factions. Cap each pool independently; granting 6 Block restores up to 6 Poise and up to 6 Ward. Do not split the 6 between the two or run the grant twice through different adapters. Audit spell defense/Barrier paths as well as ordinary Block.
- Enemy combined heal-and-block actions cost **3 SP** and must pass affordability checks and actually pay it once. The `wyrmAspirant.goldenGuard` JSON already declares 3 SP; trace the execution path. Preserve unrelated MP costs unless an explicit rule changes them.
- Matching stance reduces the payable resource cost by 1, minimum 1: `max(SP cost - 1, 1)` for applicable SP cards and `max(MP cost - 1, 1)` for magic cards. Do not invent an SP or MP charge in a resource lane the card does not use. Share the same eligibility/ordering with preview, AI affordability, and payment. Apply the configured matching-stance effectiveness bonus once to applicable effects.
- Display final selected-target damage on the card, with active defenses and stance taken into account. Before a target is selected, identify any unmitigated or conditional preview accurately. Do not represent guaranteed damage when hit resolution is uncertain.
- Multi-hit cards show **damage × attack count**, and total when useful. Project depletion and statuses sequentially across hits; unequal hits must not be represented as identical damage ×N.
- A damage-number tooltip must expose the actual formula and named sources: base, attributes, equipment, enhancement/rank, AR/DR or other ratings, stance, statuses, typed mitigation, Block, rounding, per-hit amounts, and final damage. Support mouse hover, keyboard focus, and touch inspection.

### B. Stacks, stagger, Precision, Evasion, and Perception

Use existing status/stance systems in `src/engine/statuses.js`, `content/source/statuses.json`, `src/engine/combatRatings.js`, `src/engine/combatMatchups.js`, `src/engine/stanceHit.js`, `src/engine/counterReturn.js`, `src/content/stanceRules.js`, and knowledge modules.

- Reapplying **Weakened/Weak, Staggered, Vulnerability/Vulnerable**, and other additive effects adds stacks. Preserve canonical IDs/save compatibility while using clear player-facing names.
- Staggering an enemy applies the corresponding Weak and Vulnerability stacks. Vulnerability means **25% more incoming damage**; Weak means **25% less AR**, not a blanket 25% outgoing-damage reduction. Remove duplicate legacy vulnerability multipliers on Staggered.
- Apply natural stack decay at the affected character's turn start, once per round. Remove old end-turn or global-round decay for migrated effects. Cover skipped turns, extra actions, save/resume, reapplication, and removal at zero. Do not accidentally remove a one-stack stagger before its intended turn consequence can occur. Explicit charge consumption remains distinct from natural decay.
- Attack roll: `1d20 + PrecisionStacks + supportedPrecisionBonuses`, each stack worth 1. Smash/Sweep bonuses follow the assumptions above. Natural **1 misses**, natural **20 hits**, for an otherwise legal in-range attack; preserve explicitly authored unavoidable exceptions deliberately. Exact odds and execution must use identical advantage/disadvantage semantics.
- Evasion/AC: `(1 + DEX + EvasionStacks + otherBonuses) * clamp(stanceAdvantageRating + matchingStanceCardMultiplier, 1, 1.5)`. Each Evasion stack contributes 1. Remove the hidden base 8/10 from hit-threshold construction. Define the stance terms and rounding in the shared receipt, rather than independently guessing them in UI and engine.
- Restore or add accessible evasion cards through the existing content system. Verify they appear in appropriate starter/training/deck/reward pools and actually grant usable Evasion stacks. Existing Dodge Roll/Quickstep references are a starting point.
- Perception becomes a seeded **`d20 + WIS >= DC`** check using the configured base/scaling above. Cache the result for its intended enemy-action/observation lifetime; hover, selection, or re-render must not reroll it.
- When selecting an offensive card, show its **percentage chance to hit** for the relevant target only if the Perception check passed. Reuse the existing selected-card odds renderer. Update on target/card/stance changes without leaking hidden checks or using unrelated generic attack odds.

### C. Combat PIPs and card readability

Start with `src/ui/screens/combat.js`, `src/ui/models/CombatHealthModel.js`, `src/ui/components/combatHealth.js`, `src/ui/components/combatTargetHud.js`, `src/ui/models/TargetHudModel.js`, and their authored JSON/CSS.

- PIP indicators show only **Block, Poise, Ward, Evasion stack count, and status-effect stacks**, including the selected target. Do not display AC or total effective Evasion as the Evasion stack number. Preserve the dedicated HP display.
- Display Weakened, Staggered, Vulnerability and other active effect counts accurately after grants, stacking, decay, and consumption. Use current available Poise/Ward values.
- Correct stretched icons/badges and raise the low PIP placement. Preserve aspect ratio, readable counts, actor association, safe viewport bounds, and target interactions. Measure mobile, tablet, desktop, and wide layouts instead of guessing one universal offset.
- Fit card text inside its text area at supported card sizes. Reuse the existing illustrated-card fitter. Essential attack count, cost, and effects must remain readable. Reduce words that duplicate symbols, while keeping complete explanations in inspection/tooltips.
- Give skills, powers, and nonphysical attribute cards correct category/effect symbols; internal physical camp metadata alone must not paint an incorrect physical symbol.
- Double the visible MP glyph/artwork size in the SP/MP footer, preserving its center and aspect ratio. The current visible mana sockets are 22×32; the hidden SP sigil is not the MP target. Cover live socket resampling, fallback renderer, depleted state, and high MP capacity without overlap or clipping.

### D. Action sequence, auto-combat, logs, and hold progress

Reuse `src/ui/animationPace.js`, `src/ui/fx.js`, settings persistence, and the existing log/modal/hold components. Keep waits and timers out of the headless engine.

The visible sequence for each action must be:

1. Update intent.
2. Wait configurable X, default **0.5 seconds**.
3. Show action wording: Attack, Smash, Sweep, or actual spell/action name.
4. Wait **0.5 seconds**.
5. Play the sprite animation at approximately **0.5× the previous playback rate**.
6. Wait **0.5 seconds**.
7. Show the truthful reaction word: Blocked, Break, Interrupted, Staggered, Evaded, or Hit.
8. Wait a configurable delay, default **0.5 seconds**.
9. Show damage.
10. Update the displayed PIP/health/resource values.
11. Finish resolution presentation.
12. Begin the next queued action.

- Apply this sequencing consistently to player/enemy actions, counters, multi-hits, interrupts, kills, and end-of-combat transitions. Presentation snapshots may lag authoritative calculation, but must not apply the action a second time. Never let the next action leapfrog unfinished presentation. Recompute timeout/watchdog budgets from real durations; handle cancel/skip/reduced-motion intentionally.
- Add Settings controls for **Auto combat**, **speed multiplier ×X**, and **offense/defense preference**. Speed scales waits and animation coherently without changing gameplay results, RNG, costs, or rewards.
- Auto-combat chooses only legal affordable cards/targets, evaluates known Perception information and stance advantage, and prioritizes the selected offense/defense policy. It must not inspect hidden intents. Respect queued actions, stop/disable promptly, pause for user interaction, end turns when appropriate, and avoid infinite loops.
- Show damage reduction, stance advantages, hit-roll details, and modifier sources in the combat log. Compact mode summarizes; full log expands exact arithmetic and source entries from the calculation receipt. Keep logs truthful about known/hidden information.
- Ensure expanded/full combat log is above combat artwork, cards, effects, and PIPs using the shared modal/top-layer architecture. Keep focus, Escape/back, scrolling, and safe close behavior; opening the log must not trigger click-to-skip.
- While holding End, replace HOLD with an in-place visible progress indicator driven by existing `--hold`/`data-hold-progress`. Cancel resets it; successful hold commits exactly once. Cover keyboard and pointer behavior.

### E. Rewards, shops, routes, deck editing, progression, and flasks

Start with `src/model/gameProfileRewards.js`, `games/ashenspire/packs/core/{rewards,shops,routes,characters,gear}.json`, the relevant `engine/modules` schemas/defaults, `engine/kernel/gameConfig.js`, deck/level/flask models, and creation/map UI.

- Ordinary combat reward grouping is **60% cards / 10% relic or equipment combined / 30% consumables**. Add an authored weighted-group contract and actually consume it. Do not assign 10% separately to each equipment category. Preserve seeded replay, stable saved offers, eligibility, and once-only claiming. Audit the legacy 10% card-reward gate if that path is supported. Keep explicitly special rewards distinct.
- Generate **3 distinct available shop items per category**, not three total mixed items. Add per-category configuration and schema support. Persist stock through reopening/reload, respect ownership/eligibility, and handle catalogs with fewer than three eligible items without fabricating duplicates or reroll exploits.
- Guarantee a rest area **immediately before every boss on every traversable route**. The configured route has seven preboss nodes and rest floors `[1,6]`; use `[1,7]` and validate the graph invariant. Preserve the already-working legacy preboss shrine behavior.
- Draw travel edges only for actually traversed consecutive node pairs. Suppress both the main stroke and outline for untraveled routes. Do not remove underlying navigation edges. Support revisits and the graph's directed/undirected semantics.
- Make deck editing accessible on the fly under the stated safe-boundary policy. Maintain deck/sideboard identity, ownership, save consistency, and existing deck-size rules.
- **Basic Training** on **Reaver/Rogue** allows any number of copies of eligible basic cards; **Arcane Graduate** on **Starseer/Herald** allows any number of eligible cantrips. Unlimited copies do not waive overall deck-size rules. Correct class tags (`training.basic` versus `training.graduate`) and use the existing trait-aware `deckCopyLimit` policy in all editors, rest services, validation, and mutation paths. Reward/progression cards remain limited to owned instances where appropriate.
- In character creation/review, group identical cards into one tile with **×N**, such as Strike ×5. Group by real identity, rank, and enhancement; do not collapse materially different versions.
- Ensure progression bonuses are awarded, claimable, persisted, and visible, and that spending attribute points changes real derived stats/card values. Prevent duplicate rewards on respec or reload.
- Armor sets grant about **3 stat-budget points at baseline rank plus 1 point per additional rank**. Support HP, MP, SP, base Evasion, base Precision, DR, AR, Poise, Ward, and existing permitted attributes through schema, validation, item resolution, equip aggregation, and tooltips. Use existing per-point conversions where meaningful and document added conversions. Keep armor budgets separate from weapons and avoid granting both resolved values and points twice.
- Additional charge-flask collection increases the reallocatable total, not only inventory. Update capacity, corresponding allocation/current charges, and granted ledger atomically once. Route rewards, shops, events, and other acquisition paths through the same helper. Preserve `HP allocation + MP allocation = capacity`; utility consumables remain separate inventory items. Save/reload must not lose or duplicate capacity.

### F. Validation and delivery

Add focused regression coverage for meaningful mechanics and adapter failures. Reuse existing suites; do not replace them with tests that merely assert your implementation's constants.

Required evidence includes:

- JSON-only authoring proof: attach the same behavior to a player and enemy, tune it differently on two source instances, and verify isolation, equip/unmount behavior, live results, selected-card preview, tooltip, and log. Adding an ordinary new composition must not require new per-ID engine conditionals.
- Change Ward protection from 25% to another value solely in the canonical JSON fixture and prove every consumer agrees; reset the shipped value to 25%. Disable/remove the attachment and prove the contribution disappears. A manifest existing or an interpreter-only test passing is insufficient evidence of live integration.
- Validate the new schema contracts, invalid tags/parameters/dependencies, duplicate activation, deterministic modifier ordering, fractional multipliers, event bounds, owner-turn decay, save migration, and stale-preview handling. Verify two differently configured instances never share state accidentally.
- Run mechanic conformance/build checks (`node tools/mechanics-generate.mjs --check` and the repository's mechanics/runtime interpreter suites) plus live engine and actual browser integration. Publish an authoring guide with working JSON examples drawn from the shipped mechanics.

- Preview/execution/tooltip/log parity for physical, magical, mixed, multi-hit, stagger, defense depletion, attributes, enhancements, and equipped/unequipped item changes.
- 20 incoming damage becoming 15 with the relevant active protection in isolation; matching Block restoration for player and enemy; no duplicate grants.
- Weak affects AR; Vulnerability produces 25%; stack reapplication adds; owner-start decay happens once, including skipped/extra turns and save/resume.
- d20 boundary rolls and exact enumerated hit percentages, Precision/Evasion weights, stance clamp endpoints, and no preview RNG mutation.
- Perception pass/fail boundary and stable cached result; selected-card hit percentage remains hidden on failure.
- Correct SP/MP discount, minimum payable cost, affordability/payment parity, and enemy 3 SP combined action behavior.
- Deterministic weighted reward selection, grouped probabilities, depleted-pool behavior, stable claims, and 3/category persisted shop inventory.
- Every generated route's immediate preboss rest; no untraveled SVG edge strokes.
- Trait-to-editor unlimited-copy behavior, ownership constraints, grouped creation cards, progression-to-damage updates, armor rank budgets, and flask ledger invariants.
- Timeline event order, speed invariance of gameplay, cancellation/reduced motion, multi-hit/counter sequencing, and auto-combat legality/no hidden-information use.
- Real browser checks for PIP contents/no AC, icon geometry/placement, damage-number tooltips, text fit, correct symbols, multi-hit labels, full-log layering, End-hold progress, deck access, and doubled MP artwork across mobile/tablet/desktop/wide.

Regenerate presentation/content/module outputs using documented tools, never by hand. Start with targeted Node tests, then run relevant required gates from `package.json` and repository instructions: core/full test lanes as appropriate, config/maps/UI validation, style checks, game build validation, and standalone build. Fix actual failures; report unavailable environments/checks explicitly rather than inventing a pass.

Deliver the reviewed `feature/FixCore` implementation through the repository workflow with a complete requirement checklist, changed code/data locations, test results, inspected screenshots, verified feature preview, migration notes, and the explicit assumptions above. Report actual branch/PR/promotion state. If any requirement remains incomplete, name it and its concrete blocker; do not call the entire feature finished.

<a id="review"></a>
## Team code-review procedure and completion evidence

This section preserves the user's request for a team review. **The final implementation review is pending.** Planning examples, proposed code, and prior source observations are not implementation evidence.

### Pin the review target

- Identify the actual feature branch/PR/commit. Record base and head SHAs, clean/dirty state, and the exact diff under review.
- If `feature/FixCore` is unavailable, search relevant recent integration history before claiming the work is absent. Distinguish an unchanged local checkout from remote implementation status.
- Do not label hypothetical implementation proposals as real regression findings. Review both acceptance coverage and concrete behavior in the target commit.

### Divide the read-only review

| Reviewer scope | Responsibility |
|---|---|
| Combat/mechanics | Typed damage, equipment contributions, costs, stacks, hit/Perception math, shared receipts, RNG and state correctness |
| JSON/runtime architecture | Schemas, canonical authority, enabled/tagged bindings, instance isolation, browser integration, conformance, migration and duplicate dispatch |
| Progression/world | Rewards, shops, rest routes, traveled edges, training/deck policies, armor budgets, progression and flask ledger |
| UI/presentation | PIPs/no AC, symbols/text, odds/tooltips, serial timing, autoplay controls, log layer/details, hold progress and MP artwork |
| Coordinator | Verify evidence, reconcile overlaps, run appropriate checks, build coverage matrix, prioritize findings and issue verdict |

Use available Sol/Luna models honestly and preserve read-only boundaries. A review request does not itself request fixing the code or posting a remote review/comment.

### Evidence required for each requirement

Classify every checklist item as **implemented and verified**, **partially implemented**, **missing**, or **not verified**. Cite actual file/method/line, relevant test or reproduction, observed behavior, expected behavior, and any remaining limitation. A feature exposed in JSON but not consumed by the live game is missing integration, not completed implementation.

Run focused tests for the changed mechanics and inspect actual UI when appropriate. Record exact commands and results. Do not infer success from test filenames, manifest flags, screenshots of unrelated builds, or the absence of failing tests. Separate pre-existing failures from regressions introduced by the reviewed changes.

### High-value adversarial scenarios

- Equip and unequip two differently configured instances of the same mechanic; ensure independent parameters/state and no duplicate contribution on restore.
- Change only a canonical JSON multiplier; verify resolution, selected-target preview, tooltip and log agree.
- Resolve a mixed/multi-hit attack that depletes protection mid-card; confirm correct component routing and each subsequent hit.
- Preview/select/hover repeatedly; ensure gameplay RNG, resource pools and statuses are unchanged.
- Reapply status stacks, skip a turn, take an extra action, and save/resume; ensure decay/turn consequences occur exactly once as specified.
- Change target/state after preview; execution must revalidate rather than commit stale damage/costs.
- Exhaust a reward category, reopen a shop, reclaim a reward, and reload after a flask pickup; verify eligibility, deterministic offers and once-only grants.
- Check every boss predecessor, revisited travel edges, unlimited trained copies versus owned-only cards, and deck edits during queued combat.
- Open the full log during animation, cancel End hold, disable autoplay mid-sequence, and inspect high-MP/mobile layouts.

### Findings and verdict

Each actionable finding needs severity, concise title, exact source location, concrete trigger, consequence, and the requirement violated. Verify agent findings against the target code before reporting. Avoid speculative issues and duplicate reports. Report significant unknowns as unverified rather than inventing defects.

Final review output: **APPROVE** or **REQUEST CHANGES**, with acceptance coverage, prioritized findings, test/browser evidence, unresolved ambiguities and actual review scope. Publish findings in the conversation first; do not submit remote comments/verdicts without explicit authorization.
