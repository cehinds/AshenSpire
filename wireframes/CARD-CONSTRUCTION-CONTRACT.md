# WC0 card construction: tag-driven, normalized and composable

All presenting cards share WC0 identity header, optional art, meaningful badges, content slots, state feedback and contextual action area. This is a separate reusable component family hosted inside W0-derived screens, not a competing modal shell. A playing card is a card; equipment, relic, armor, consumable, class and starting-kit options also project as cards. The underlying domain entities do not become one undifferentiated entity table.

## Hierarchy and semantics

```text
WC0 Master card
├─ WC1 Playing card
│  ├─ WC1a Attack
│  ├─ WC1b Skill
│  ├─ WC1c Power
│  ├─ WC1d Curse
│  └─ WC1e Status
├─ WC2 Possession
│  ├─ WC2a Equipment
│  │  ├─ WC2a1 Weapon
│  │  └─ WC2a2 Armor
│  ├─ WC2b Relic
│  │  ├─ WC2b1 Passive
│  │  └─ WC2b2 Triggered
│  └─ WC2c Consumable
│     ├─ WC2c1 Healing
│     ├─ WC2c2 Resource
│     └─ WC2c3 Utility
└─ WC3 Character choice
   ├─ WC3a Class
   └─ WC3b Starting kit
```

Families describe structural reuse, not a mandate for class inheritance or exclusive gameplay categories. A relic can have passive AND triggered effects; one selected structural family composes both matching components. A consumable can heal and restore another resource. Compatible tags add both effect rows; conflicting structural rules require an explicit resolution, never whichever ran last.

Every rendered component is selected by a validated rule over registered tags and context: identity, artwork, cost, damage, scaling, resistance, requirements, grants, quantity, charges, effect text, comparison, selection, and contextual action. WC0 declares required structural slots and allowed components. A default `presentable:card` rule can supply common identity/art providers; subtype rules add or specialize only allowed slots. Empty optional slots collapse; required slots missing is an authoring error.

Tag IDs in card-wireframes.md are PROPOSED. Reuse existing domain/family tags wherever equivalent. Separate presentation capability tags from gameplay tags via registered domains. Derive temporary state tags from immutable runtime facts without writing them into authoritative content tables or saves. Do not duplicate derived rarity/ownership/affordability facts into permanent tag membership.

## Construction sequence

1. Resolve the exact entity definition and owned-instance identity through existing registries. Preserve scoped identities.
2. Query existing tagService for canonical associations; derive only registered presentation-state predicates from domain facts/context.
3. Match card family/component rules through normalized required/any/excluded tag relationships.
4. Resolve one structural ancestry and compatible additional component rules. Detect ambiguous exclusive slots before render. Do not pick a family by checking an entity name or hard-coded ID.
5. Fetch display values through allowlisted providers: engine previews for costs/damage/effects, loadout projections for equipment, quest/persistence queries where relevant. Tags select a provider; they do not replace the provider's computation.
6. Construct one immutable CardViewModel with ordered component models and semantic action records.
7. WC0 renders the registered components, shared tokens and selected/disabled states. The host chooses hand/grid/detail density and size; the same model remains reusable.
8. Input emits a semantic intent to the host presenter. Existing commands revalidate before changing state. An item card in a shop offers Buy, the same item in inventory offers Equip/Inspect, a read-only compendium card offers Inspect. Context selects available operations; no copied item definitions or alternative renderer implementations.

## Rule determinism

Rule priority is explicit data, not file order. Rules targeting exclusive slots must either declare a validated override of an ancestor rule or be mutually exclusive. Compatible collections (effect rows, tag badges, requirements) merge by unique component identity and declared ordinal. Unknown tag/provider/component/rule, parent cycle, unresolved collision, missing required slot, wrong tag family, and non-deterministic order are named validation errors.

Do not introduce `eval`, dynamic imports from data, raw HTML/CSS payloads, tag substring matching, or arbitrary expression strings. New rules compose a bounded set of supported predicates/providers/components. New capabilities require a reusable implementation plus schema/test updates before content can reference them.

## Normalized relations

```text
CardWireframe(id PK, parentId FK nullable)
CardSlot(id PK, semanticRoleId)
CardWireframeSlot(wireframeId FK, slotId FK, required, ordinal;
                  PK wireframeId+slotId; UNIQUE wireframeId+ordinal)
CardComponent(id PK, rendererId, providerContractId)
CardConstructionRule(id PK, targetWireframeId FK, slotId FK,
                     componentId FK, providerId, priority, overridesRuleId FK nullable)
CardRuleRequiredTag(ruleId FK, tagId FK; PK ruleId+tagId)
CardRuleAnyTag(ruleId FK, groupId, tagId FK; PK ruleId+groupId+tagId)
CardRuleExcludedTag(ruleId FK, tagId FK; PK ruleId+tagId)
CardRuleContext(ruleId FK, contextId FK; PK ruleId+contextId)
CardRuleOrder(ruleId FK, childRoleId, ordinal; PK ruleId+childRoleId)
```

Exact FK shapes and dependency review belong in the dedicated schema task; slot assignments must be validated against inherited wireframe membership. Existing tag associations remain in the current normalized tagging tables. Renderer/provider code is registered once and referenced by ID. Do not repeat names, costs, type labels, descriptions, parent metadata, or inherited tokens in rule membership records. Compilation may materialize joined card definitions; generated projections are never an additional authoring source.

## Sizing and host placement

Card table envelopes are reference targets: wide16vw, compact24vw, portrait44vw; playing cards28vh, possessions35vh, creation cards42vh. These intentionally differ from full-screen W layouts. They are **not universal rigid dimensions**. A combat hand must fit its 35vh proposed region (with padding) and may use overlap/fanning or an accessible hand-navigation mechanism already supported by the game. An inventory grid chooses column count from readable minimum card width. A modal detail view may expand the same card model.

Do not put raw vw/vh on every card child. The host allocates the card rectangle; descendant slot tables are proportions of that envelope translated to viewport units for documentation. Available card footer omitted in hand/inspect contexts reclaims that space; do not add a second Play button when the established card interaction already performs selection/play. Never shrink a dense playing-card description until unreadable or truncate essential rules to meet the reference envelope.

Art, faction/resource colors, rarity, tag/status identities and other named exceptions follow COLOR-INTERACTION-CONTRACT.md. Ready primary action AFFORDANCES may highlight green; a playable card's entire artwork/background is not automatically green. Card selection/focus follows shared gold markers and a visible focus outline unless an explicit targeting rule applies.

## Concrete implementation handoff

Add a dedicated spec task before implementation: approve tag vocabulary/family relationships, component contracts, slot ordering, host contexts and exact source-field mapping. Then migrate serially using the existing architecture Tasks 03/06/11/13/14:

- Inspect `src/ui/components/card.js`, `creationCards.js`, `armouryComponents.js`, `smithUpgradeModal.js`, `mountServiceModal.js`, `flask.js`, and `src/ui/kit/index.js` for existing shared primitives and callers. Resolve current line anchors through source-map.json/current checkout.
- Add proposed `src/ui/models/CardViewModel.js`, `src/model/cardPresentationRules.js`, `src/ui/components/cardComponents.js`, and normalized card-rule source tables. Extend current tag service, content compiler and validator; do not create second registries.
- Preserve `renderCard` and other public component entry points as adapters until all callers migrate. Domain card engine APIs, deterministic effects and save IDs are unchanged.
- First prove the common identity/art/tag/action shell with class and inventory cards, then migrate equipment/relic/consumables, then playing cards with combat-specific preview/input tests. Use one issue/branch/draft PR per bounded migration.
- Add `tests/card-construction.test.mjs` for tag-rule resolution, multi-tag composition, conflicts, scoped IDs, optional slots, state/context changes, and data-only extension. Add real browser/input checks for hand selection/targeting, readable text, equipment actions and character choice.
- Finish by removing old duplicate markup only after all callers are accounted for. Snapshot comparison and rendering tests must distinguish gameplay identity from presentation identity.

Completion demonstration: add an armor variant, a healing consumable variant and a class choice through normalized data/tag rows using existing providers, and they render with the correct components/actions in every supported host. A novel effect requiring an unsupported primitive is explicitly new engine work, not arbitrary data execution.

## Owner revision: shared proportions and inspector

Apply CARD-SELECTION-CONTRACT.md to all descendants: card-relative 10/40/40/10 bands, inherited selection outline/lift, info after 1000ms, and W1w left-card/right-details inspector. This supersedes earlier conflicting geometry or selection guidance.
