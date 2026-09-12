# Card wireframes — WC0, child cards, and child-of-child cards

**WC0 shared geometry:** header 10%, art 40%, body 40%, footer 10% of card height (not viewport height). Art includes meaningful tag badges; body includes rules and blocker. All drawings show selected state: outline follows the lifted card; (i) is centered above it and fades in after 1000ms of continuous selection. Info opens W1w. Card footer contains supplementary metadata; commands belong to the owning host. All cards share aspect ratio 5:8 (proposed token), with clamped width and derived height; viewport equivalents use labeled reference viewports. See CARD-SELECTION-CONTRACT.md.

Every card inherits WC0 bones/effects and adds components through validated tag rules. This is a design/specification artifact, not implemented game code. Proposed tag IDs below are illustrative vocabulary to map against the existing tag registry in the specification task; they are not claimed to exist. Read CARD-CONSTRUCTION-CONTRACT.md before implementation.

Names use `WCid.region.component`; named detail rows include their semantic sub-name in the size table. Width/height values are nominal **vh/vw of the visible game viewport**, not percentages of the card. Reference viewports: wide 1600×1000, compact 1000×800, portrait 400×800; actual runtime height is width / aspectRatio, never independently clamped. Children subdivide their card envelope; do not add their heights to the envelope. Actual cards are hosted in hands/grids/pickers: use container allocation, readable minimums, and explicit overflow/paging rather than shrinking content. See COMPONENT-SIZING.md.

## Wireframe WC0: Master card

**Parent: none — master card.** All structural and optional components are resolved by validated tag rules. No label-based construction.

**Construction tags (proposed):** `presentable:card`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ {Registered content slots}     │
│ {Availability / reason}        │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC0.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC0.header` | 16vw | 4.096vh | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC0.header.title` | 9.36vw | 4.096vh | WC0.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC0.header.state` | 4.32vw | 4.096vh | WC0.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC0.art` | 16vw | 16.384vh | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC0.art.tags` | 14.4vw | 3.2768vh | WC0.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC0.body` | 16vw | 16.384vh | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC0.footer` | 16vw | 4.096vh | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC0.footer.metadata` | 14.4vw | 3.28vh | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC0.body.detail1` | 14.4vw | 6.96vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Registered content slots} |
| `WC0.body.detail2` | 14.4vw | 6.96vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Availability / reason} |
| `WC0.body.blocker` | 14.4vw | 2.46vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC0.selection.outline` | 16vw | 40.96vh | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC0.selection.info` | 4vw | 4vh | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ {Registered content slots} │
│ {Availability / reason}    │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC0.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC0.header` | 24vw | 4.800000000000001vh | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC0.header.title` | 14.56vw | 4.800000000000001vh | WC0.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC0.header.state` | 6.72vw | 4.800000000000001vh | WC0.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC0.art` | 24vw | 19.200000000000003vh | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC0.art.tags` | 22.4vw | 3.84vh | WC0.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC0.body` | 24vw | 19.200000000000003vh | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC0.footer` | 24vw | 4.800000000000001vh | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC0.footer.metadata` | 22.4vw | 3.84vh | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC0.body.detail1` | 22.4vw | 8.16vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Registered content slots} |
| `WC0.body.detail2` | 22.4vw | 8.16vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Availability / reason} |
| `WC0.body.blocker` | 22.4vw | 2.88vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC0.selection.outline` | 24vw | 48vh | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC0.selection.info` | 4vw | 4vh | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ {Registered content      │
│ slots}                   │
│ {Availability / reason}  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC0.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC0.header` | 48vw | 3.84vh | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC0.header.title` | 30.16vw | 3.84vh | WC0.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC0.header.state` | 13.92vw | 3.84vh | WC0.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC0.art` | 48vw | 15.36vh | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC0.art.tags` | 46.4vw | 3.072vh | WC0.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC0.body` | 48vw | 15.36vh | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC0.footer` | 48vw | 3.84vh | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC0.footer.metadata` | 46.4vw | 3.07vh | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC0.body.detail1` | 46.4vw | 6.53vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Registered content slots} |
| `WC0.body.detail2` | 46.4vw | 6.53vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Availability / reason} |
| `WC0.body.blocker` | 46.4vw | 2.3vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC0.selection.outline` | 48vw | 38.4vh | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC0.selection.info` | 4vw | 4vh | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ {Registered content      │
│ slots}                   │
│ {Availability / reason}  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC0.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC0.header` | 48vw | 3.84vh | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC0.header.title` | 30.16vw | 3.84vh | WC0.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC0.header.state` | 13.92vw | 3.84vh | WC0.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC0.art` | 48vw | 15.36vh | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC0.art.tags` | 46.4vw | 3.072vh | WC0.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC0.body` | 48vw | 15.36vh | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC0.footer` | 48vw | 3.84vh | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC0.footer.metadata` | 46.4vw | 3.07vh | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC0.body.detail1` | 46.4vw | 6.53vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Registered content slots} |
| `WC0.body.detail2` | 46.4vw | 6.53vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | {Availability / reason} |
| `WC0.body.blocker` | 46.4vw | 2.3vh | WC0.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC0.selection.outline` | 48vw | 38.4vh | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC0.selection.info` | 4vw | 4vh | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context, validatedTagRegistry
OUTPUT: immutable CardViewModel + semantic action intents

FUNCTION ConstructCard(input):
    definition = registries.requireEntity(entityRef)
    authoredTags = tagService.tagsForValidatedIdentity(entityRef)
    stateFacts = domainQueries.projectCurrentFacts(instanceSnapshot, context)
    effectiveTags = registeredTagRules.derive(authoredTags, stateFacts)
    matchedRules = MatchAllAnyExcludedTagRelations(effectiveTags, context)
    ancestry = ResolveDeclaredCardFamilyFromMatchedRules()
    REQUIRE ancestry terminates at WC0; reject cycles/unknown families
    components = ResolveSlotRulesByPriorityAndExplicitCompatibility(matchedRules)
    REQUIRE required identity slots exist
    REQUIRE no unresolved exclusive-slot collision
    providers = ResolveAllowlistedProviders(components)
    model = ProjectImmutableValues(providers, definition, stateFacts)
    model.actions = DomainAvailableCommands(context, entityRef) // owning host only
    RETURN model with named slots and semantic actions

FUNCTION RenderCard(model):
    ResolveInheritedCardTokensAndHostSize(model, mode)
    FOR each ordered slot IN model.components:
        RenderRegisteredComponent(slot.componentId, slot.displayData)
    BindSelectionSeparateFromExplicitPlayUseEquipCommands()
    ApplyCardRelativeBands(config.card.bandFractions)
    // Visible badges are inside art; outline and info are outside band budget.
    ApplySharedPaletteFocusSelectionAndDisabledStates()
    RenderFooterMetadataOnly(); owningHost.RendersAvailableActionOutsideCard()
    // No Use/Play/Equip command belongs inside the card footer.

ON action:
    EmitIntentToOwningPresenter(); domain command revalidates current state
ON selectionChanged(selected):
    CancelPendingInfoTimerAndFade(); generation = NextSelectionGeneration()
    IF selected:
        ApplySharedSelectionOutline(); LiftVisuallyWithoutReflow()
        owningHost.ShowContextAction(); HighlightDomainEligibleTargets()
        DisableCommitUntilRequiredTargetIsSelected()
        After(config.infoDelayMs = config.referenceTokens.value_1000.value):
            IF stillSelected AND mounted AND generationIsCurrent:
                FadeInInfoButton(config.infoFadeMs); EnableInfoInput()
    ELSE: RemoveLiftOutlineAndInfo(); RestoreNormalStackOrder()
        owningHost.ClearContextActionAndTargetHighlights()
ON infoActivated:
    StopPropagation(); CancelPendingInfoTimerAndFade()
    OpenW1wCardInspector(entityRef, context, returnFocusTarget)
    // Never play/use/equip the card from this event.
ON inspectShortcut: OpenW1wCardInspectorImmediately()
ON inspectorClosed: RestoreSelectionAndFocusIfEntityStillExists()
ON inspect:
    OpenW1wCardInspectorWithoutMutatingEntity()
ON update/dispose:
    PreserveStableIdentityAndFocus(); release listeners/tooltips
Never branch on entity names or inject executable markup from tags.
```

### Wireframe WC1: Playing card

**Parent: WC0.** Inherits card identity/art/tags; adds cost, targeting, and effect components.

**Construction tags (proposed):** `card-kind:playing`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Cost / targeting               │
│ Effects / rules                │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1.header` | 16vw | 4.096vh | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1.header.title` | 9.36vw | 4.096vh | WC1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1.header.state` | 4.32vw | 4.096vh | WC1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1.art` | 16vw | 16.384vh | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1.art.tags` | 14.4vw | 3.2768vh | WC1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1.body` | 16vw | 16.384vh | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1.footer` | 16vw | 4.096vh | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1.footer.metadata` | 14.4vw | 3.28vh | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1.body.detail1` | 14.4vw | 6.96vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Cost / targeting |
| `WC1.body.detail2` | 14.4vw | 6.96vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effects / rules |
| `WC1.body.blocker` | 14.4vw | 2.46vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1.selection.outline` | 16vw | 40.96vh | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1.selection.info` | 4vw | 4vh | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Cost / targeting           │
│ Effects / rules            │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1.header` | 24vw | 4.800000000000001vh | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1.header.title` | 14.56vw | 4.800000000000001vh | WC1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1.header.state` | 6.72vw | 4.800000000000001vh | WC1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1.art` | 24vw | 19.200000000000003vh | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1.art.tags` | 22.4vw | 3.84vh | WC1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1.body` | 24vw | 19.200000000000003vh | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1.footer` | 24vw | 4.800000000000001vh | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1.footer.metadata` | 22.4vw | 3.84vh | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1.body.detail1` | 22.4vw | 8.16vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Cost / targeting |
| `WC1.body.detail2` | 22.4vw | 8.16vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effects / rules |
| `WC1.body.blocker` | 22.4vw | 2.88vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1.selection.outline` | 24vw | 48vh | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1.selection.info` | 4vw | 4vh | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Cost / targeting         │
│ Effects / rules          │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1.header` | 48vw | 3.84vh | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1.header.title` | 30.16vw | 3.84vh | WC1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1.header.state` | 13.92vw | 3.84vh | WC1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1.art` | 48vw | 15.36vh | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1.art.tags` | 46.4vw | 3.072vh | WC1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1.body` | 48vw | 15.36vh | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1.footer` | 48vw | 3.84vh | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1.footer.metadata` | 46.4vw | 3.07vh | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1.body.detail1` | 46.4vw | 6.53vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Cost / targeting |
| `WC1.body.detail2` | 46.4vw | 6.53vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effects / rules |
| `WC1.body.blocker` | 46.4vw | 2.3vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1.selection.outline` | 48vw | 38.4vh | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1.selection.info` | 4vw | 4vh | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Cost / targeting         │
│ Effects / rules          │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1.header` | 48vw | 3.84vh | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1.header.title` | 30.16vw | 3.84vh | WC1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1.header.state` | 13.92vw | 3.84vh | WC1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1.art` | 48vw | 15.36vh | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1.art.tags` | 46.4vw | 3.072vh | WC1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1.body` | 48vw | 15.36vh | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1.footer` | 48vw | 3.84vh | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1.footer.metadata` | 46.4vw | 3.07vh | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1.body.detail1` | 46.4vw | 6.53vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Cost / targeting |
| `WC1.body.detail2` | 46.4vw | 6.53vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effects / rules |
| `WC1.body.blocker` | 46.4vw | 2.3vh | WC1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1.selection.outline` | 48vw | 38.4vh | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1.selection.info` | 4vw | 4vh | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC0
REQUIRED PROPOSED TAGS: card-kind:playing
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1.body.detail1 ← registered provider for Cost / targeting
    WC1.body.detail2 ← registered provider for Effects / rules
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Select / Play") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Inherits card identity/art/tags; adds cost, targeting, and effect components.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1a: Attack card

**Parent: WC1.** Use engine damage preview, including current modifiers; never calculate damage in renderer.

**Construction tags (proposed):** `ability:attack`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Damage / affected stat         │
│ Target and effect preview      │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1a.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1a.header` | 16vw | 4.096vh | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1a.header.title` | 9.36vw | 4.096vh | WC1a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1a.header.state` | 4.32vw | 4.096vh | WC1a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1a.art` | 16vw | 16.384vh | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1a.art.tags` | 14.4vw | 3.2768vh | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1a.body` | 16vw | 16.384vh | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1a.footer` | 16vw | 4.096vh | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1a.footer.metadata` | 14.4vw | 3.28vh | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1a.body.detail1` | 14.4vw | 6.96vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / affected stat |
| `WC1a.body.detail2` | 14.4vw | 6.96vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target and effect preview |
| `WC1a.body.blocker` | 14.4vw | 2.46vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1a.selection.outline` | 16vw | 40.96vh | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1a.selection.info` | 4vw | 4vh | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Damage / affected stat     │
│ Target and effect preview  │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1a.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1a.header` | 24vw | 4.800000000000001vh | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1a.header.title` | 14.56vw | 4.800000000000001vh | WC1a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1a.header.state` | 6.72vw | 4.800000000000001vh | WC1a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1a.art` | 24vw | 19.200000000000003vh | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1a.art.tags` | 22.4vw | 3.84vh | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1a.body` | 24vw | 19.200000000000003vh | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1a.footer` | 24vw | 4.800000000000001vh | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1a.footer.metadata` | 22.4vw | 3.84vh | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1a.body.detail1` | 22.4vw | 8.16vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / affected stat |
| `WC1a.body.detail2` | 22.4vw | 8.16vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target and effect preview |
| `WC1a.body.blocker` | 22.4vw | 2.88vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1a.selection.outline` | 24vw | 48vh | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1a.selection.info` | 4vw | 4vh | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Damage / affected stat   │
│ Target and effect        │
│ preview                  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1a.header` | 48vw | 3.84vh | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1a.header.title` | 30.16vw | 3.84vh | WC1a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1a.header.state` | 13.92vw | 3.84vh | WC1a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1a.art` | 48vw | 15.36vh | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1a.art.tags` | 46.4vw | 3.072vh | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1a.body` | 48vw | 15.36vh | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1a.footer` | 48vw | 3.84vh | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1a.footer.metadata` | 46.4vw | 3.07vh | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1a.body.detail1` | 46.4vw | 6.53vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / affected stat |
| `WC1a.body.detail2` | 46.4vw | 6.53vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target and effect preview |
| `WC1a.body.blocker` | 46.4vw | 2.3vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1a.selection.outline` | 48vw | 38.4vh | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1a.selection.info` | 4vw | 4vh | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Damage / affected stat   │
│ Target and effect        │
│ preview                  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1a.header` | 48vw | 3.84vh | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1a.header.title` | 30.16vw | 3.84vh | WC1a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1a.header.state` | 13.92vw | 3.84vh | WC1a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1a.art` | 48vw | 15.36vh | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1a.art.tags` | 46.4vw | 3.072vh | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1a.body` | 48vw | 15.36vh | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1a.footer` | 48vw | 3.84vh | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1a.footer.metadata` | 46.4vw | 3.07vh | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1a.body.detail1` | 46.4vw | 6.53vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / affected stat |
| `WC1a.body.detail2` | 46.4vw | 6.53vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target and effect preview |
| `WC1a.body.blocker` | 46.4vw | 2.3vh | WC1a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1a.selection.outline` | 48vw | 38.4vh | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1a.selection.info` | 4vw | 4vh | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC1
REQUIRED PROPOSED TAGS: ability:attack
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1a
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1a.body.detail1 ← registered provider for Damage / affected stat
    WC1a.body.detail2 ← registered provider for Target and effect preview
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Select / Play") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Use engine damage preview, including current modifiers; never calculate damage in renderer.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1b: Skill card

**Parent: WC1.** The effect list is projected from the existing opcode/formula engine.

**Construction tags (proposed):** `ability:skill`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Defense / utility effects      │
│ Target / requirements          │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1b.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1b.header` | 16vw | 4.096vh | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1b.header.title` | 9.36vw | 4.096vh | WC1b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1b.header.state` | 4.32vw | 4.096vh | WC1b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1b.art` | 16vw | 16.384vh | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1b.art.tags` | 14.4vw | 3.2768vh | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1b.body` | 16vw | 16.384vh | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1b.footer` | 16vw | 4.096vh | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1b.footer.metadata` | 14.4vw | 3.28vh | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1b.body.detail1` | 14.4vw | 6.96vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / utility effects |
| `WC1b.body.detail2` | 14.4vw | 6.96vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target / requirements |
| `WC1b.body.blocker` | 14.4vw | 2.46vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1b.selection.outline` | 16vw | 40.96vh | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1b.selection.info` | 4vw | 4vh | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Defense / utility effects  │
│ Target / requirements      │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1b.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1b.header` | 24vw | 4.800000000000001vh | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1b.header.title` | 14.56vw | 4.800000000000001vh | WC1b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1b.header.state` | 6.72vw | 4.800000000000001vh | WC1b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1b.art` | 24vw | 19.200000000000003vh | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1b.art.tags` | 22.4vw | 3.84vh | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1b.body` | 24vw | 19.200000000000003vh | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1b.footer` | 24vw | 4.800000000000001vh | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1b.footer.metadata` | 22.4vw | 3.84vh | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1b.body.detail1` | 22.4vw | 8.16vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / utility effects |
| `WC1b.body.detail2` | 22.4vw | 8.16vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target / requirements |
| `WC1b.body.blocker` | 22.4vw | 2.88vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1b.selection.outline` | 24vw | 48vh | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1b.selection.info` | 4vw | 4vh | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Defense / utility        │
│ effects                  │
│ Target / requirements    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1b.header` | 48vw | 3.84vh | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1b.header.title` | 30.16vw | 3.84vh | WC1b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1b.header.state` | 13.92vw | 3.84vh | WC1b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1b.art` | 48vw | 15.36vh | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1b.art.tags` | 46.4vw | 3.072vh | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1b.body` | 48vw | 15.36vh | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1b.footer` | 48vw | 3.84vh | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1b.footer.metadata` | 46.4vw | 3.07vh | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1b.body.detail1` | 46.4vw | 6.53vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / utility effects |
| `WC1b.body.detail2` | 46.4vw | 6.53vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target / requirements |
| `WC1b.body.blocker` | 46.4vw | 2.3vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1b.selection.outline` | 48vw | 38.4vh | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1b.selection.info` | 4vw | 4vh | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Defense / utility        │
│ effects                  │
│ Target / requirements    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1b.header` | 48vw | 3.84vh | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1b.header.title` | 30.16vw | 3.84vh | WC1b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1b.header.state` | 13.92vw | 3.84vh | WC1b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1b.art` | 48vw | 15.36vh | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1b.art.tags` | 46.4vw | 3.072vh | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1b.body` | 48vw | 15.36vh | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1b.footer` | 48vw | 3.84vh | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1b.footer.metadata` | 46.4vw | 3.07vh | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1b.body.detail1` | 46.4vw | 6.53vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / utility effects |
| `WC1b.body.detail2` | 46.4vw | 6.53vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Target / requirements |
| `WC1b.body.blocker` | 46.4vw | 2.3vh | WC1b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1b.selection.outline` | 48vw | 38.4vh | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1b.selection.info` | 4vw | 4vh | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC1
REQUIRED PROPOSED TAGS: ability:skill
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1b
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1b.body.detail1 ← registered provider for Defense / utility effects
    WC1b.body.detail2 ← registered provider for Target / requirements
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Select / Play") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
The effect list is projected from the existing opcode/formula engine.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1c: Power card

**Parent: WC1.** Persistent rules shown through registered trigger/duration components.

**Construction tags (proposed):** `ability:power`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Persistent effect              │
│ Trigger / duration             │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1c.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1c.header` | 16vw | 4.096vh | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1c.header.title` | 9.36vw | 4.096vh | WC1c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1c.header.state` | 4.32vw | 4.096vh | WC1c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1c.art` | 16vw | 16.384vh | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1c.art.tags` | 14.4vw | 3.2768vh | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1c.body` | 16vw | 16.384vh | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1c.footer` | 16vw | 4.096vh | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1c.footer.metadata` | 14.4vw | 3.28vh | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1c.body.detail1` | 14.4vw | 6.96vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Persistent effect |
| `WC1c.body.detail2` | 14.4vw | 6.96vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger / duration |
| `WC1c.body.blocker` | 14.4vw | 2.46vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1c.selection.outline` | 16vw | 40.96vh | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1c.selection.info` | 4vw | 4vh | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Persistent effect          │
│ Trigger / duration         │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1c.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1c.header` | 24vw | 4.800000000000001vh | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1c.header.title` | 14.56vw | 4.800000000000001vh | WC1c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1c.header.state` | 6.72vw | 4.800000000000001vh | WC1c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1c.art` | 24vw | 19.200000000000003vh | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1c.art.tags` | 22.4vw | 3.84vh | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1c.body` | 24vw | 19.200000000000003vh | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1c.footer` | 24vw | 4.800000000000001vh | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1c.footer.metadata` | 22.4vw | 3.84vh | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1c.body.detail1` | 22.4vw | 8.16vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Persistent effect |
| `WC1c.body.detail2` | 22.4vw | 8.16vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger / duration |
| `WC1c.body.blocker` | 22.4vw | 2.88vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1c.selection.outline` | 24vw | 48vh | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1c.selection.info` | 4vw | 4vh | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Persistent effect        │
│ Trigger / duration       │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1c.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1c.header` | 48vw | 3.84vh | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1c.header.title` | 30.16vw | 3.84vh | WC1c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1c.header.state` | 13.92vw | 3.84vh | WC1c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1c.art` | 48vw | 15.36vh | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1c.art.tags` | 46.4vw | 3.072vh | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1c.body` | 48vw | 15.36vh | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1c.footer` | 48vw | 3.84vh | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1c.footer.metadata` | 46.4vw | 3.07vh | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1c.body.detail1` | 46.4vw | 6.53vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Persistent effect |
| `WC1c.body.detail2` | 46.4vw | 6.53vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger / duration |
| `WC1c.body.blocker` | 46.4vw | 2.3vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1c.selection.outline` | 48vw | 38.4vh | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1c.selection.info` | 4vw | 4vh | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Persistent effect        │
│ Trigger / duration       │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1c.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1c.header` | 48vw | 3.84vh | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1c.header.title` | 30.16vw | 3.84vh | WC1c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1c.header.state` | 13.92vw | 3.84vh | WC1c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1c.art` | 48vw | 15.36vh | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1c.art.tags` | 46.4vw | 3.072vh | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1c.body` | 48vw | 15.36vh | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1c.footer` | 48vw | 3.84vh | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1c.footer.metadata` | 46.4vw | 3.07vh | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1c.body.detail1` | 46.4vw | 6.53vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Persistent effect |
| `WC1c.body.detail2` | 46.4vw | 6.53vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger / duration |
| `WC1c.body.blocker` | 46.4vw | 2.3vh | WC1c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1c.selection.outline` | 48vw | 38.4vh | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1c.selection.info` | 4vw | 4vh | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC1
REQUIRED PROPOSED TAGS: ability:power
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1c
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1c.body.detail1 ← registered provider for Persistent effect
    WC1c.body.detail2 ← registered provider for Trigger / duration
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Select / Play") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Persistent rules shown through registered trigger/duration components.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1d: Curse card

**Parent: WC1.** Do not assume all curses are unplayable; preserve the domain rule and context-specific action.

**Construction tags (proposed):** `ability:curse`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Penalty / consequence          │
│ Playability / removal rule     │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1d.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1d.header` | 16vw | 4.096vh | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1d.header.title` | 9.36vw | 4.096vh | WC1d.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1d.header.state` | 4.32vw | 4.096vh | WC1d.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1d.art` | 16vw | 16.384vh | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1d.art.tags` | 14.4vw | 3.2768vh | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1d.body` | 16vw | 16.384vh | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1d.footer` | 16vw | 4.096vh | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1d.footer.metadata` | 14.4vw | 3.28vh | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1d.body.detail1` | 14.4vw | 6.96vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Penalty / consequence |
| `WC1d.body.detail2` | 14.4vw | 6.96vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1d.body.blocker` | 14.4vw | 2.46vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1d.selection.outline` | 16vw | 40.96vh | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1d.selection.info` | 4vw | 4vh | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Penalty / consequence      │
│ Playability / removal rule │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1d.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1d.header` | 24vw | 4.800000000000001vh | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1d.header.title` | 14.56vw | 4.800000000000001vh | WC1d.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1d.header.state` | 6.72vw | 4.800000000000001vh | WC1d.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1d.art` | 24vw | 19.200000000000003vh | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1d.art.tags` | 22.4vw | 3.84vh | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1d.body` | 24vw | 19.200000000000003vh | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1d.footer` | 24vw | 4.800000000000001vh | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1d.footer.metadata` | 22.4vw | 3.84vh | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1d.body.detail1` | 22.4vw | 8.16vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Penalty / consequence |
| `WC1d.body.detail2` | 22.4vw | 8.16vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1d.body.blocker` | 22.4vw | 2.88vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1d.selection.outline` | 24vw | 48vh | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1d.selection.info` | 4vw | 4vh | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Penalty / consequence    │
│ Playability / removal    │
│ rule                     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1d.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1d.header` | 48vw | 3.84vh | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1d.header.title` | 30.16vw | 3.84vh | WC1d.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1d.header.state` | 13.92vw | 3.84vh | WC1d.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1d.art` | 48vw | 15.36vh | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1d.art.tags` | 46.4vw | 3.072vh | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1d.body` | 48vw | 15.36vh | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1d.footer` | 48vw | 3.84vh | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1d.footer.metadata` | 46.4vw | 3.07vh | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1d.body.detail1` | 46.4vw | 6.53vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Penalty / consequence |
| `WC1d.body.detail2` | 46.4vw | 6.53vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1d.body.blocker` | 46.4vw | 2.3vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1d.selection.outline` | 48vw | 38.4vh | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1d.selection.info` | 4vw | 4vh | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Penalty / consequence    │
│ Playability / removal    │
│ rule                     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1d.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1d.header` | 48vw | 3.84vh | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1d.header.title` | 30.16vw | 3.84vh | WC1d.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1d.header.state` | 13.92vw | 3.84vh | WC1d.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1d.art` | 48vw | 15.36vh | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1d.art.tags` | 46.4vw | 3.072vh | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1d.body` | 48vw | 15.36vh | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1d.footer` | 48vw | 3.84vh | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1d.footer.metadata` | 46.4vw | 3.07vh | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1d.body.detail1` | 46.4vw | 6.53vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Penalty / consequence |
| `WC1d.body.detail2` | 46.4vw | 6.53vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1d.body.blocker` | 46.4vw | 2.3vh | WC1d.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1d.selection.outline` | 48vw | 38.4vh | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1d.selection.info` | 4vw | 4vh | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC1
REQUIRED PROPOSED TAGS: ability:curse
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1d
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1d.body.detail1 ← registered provider for Penalty / consequence
    WC1d.body.detail2 ← registered provider for Playability / removal rule
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Do not assume all curses are unplayable; preserve the domain rule and context-specific action.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1e: Status card

**Parent: WC1.** This is a playing-card subtype, distinct from a combat status indicator.

**Construction tags (proposed):** `ability:status`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Status effect / duration       │
│ Playability / removal rule     │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1e.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1e.header` | 16vw | 4.096vh | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1e.header.title` | 9.36vw | 4.096vh | WC1e.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1e.header.state` | 4.32vw | 4.096vh | WC1e.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1e.art` | 16vw | 16.384vh | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1e.art.tags` | 14.4vw | 3.2768vh | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1e.body` | 16vw | 16.384vh | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1e.footer` | 16vw | 4.096vh | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1e.footer.metadata` | 14.4vw | 3.28vh | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1e.body.detail1` | 14.4vw | 6.96vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Status effect / duration |
| `WC1e.body.detail2` | 14.4vw | 6.96vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1e.body.blocker` | 14.4vw | 2.46vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1e.selection.outline` | 16vw | 40.96vh | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1e.selection.info` | 4vw | 4vh | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Status effect / duration   │
│ Playability / removal rule │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1e.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1e.header` | 24vw | 4.800000000000001vh | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1e.header.title` | 14.56vw | 4.800000000000001vh | WC1e.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1e.header.state` | 6.72vw | 4.800000000000001vh | WC1e.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1e.art` | 24vw | 19.200000000000003vh | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1e.art.tags` | 22.4vw | 3.84vh | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1e.body` | 24vw | 19.200000000000003vh | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1e.footer` | 24vw | 4.800000000000001vh | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1e.footer.metadata` | 22.4vw | 3.84vh | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1e.body.detail1` | 22.4vw | 8.16vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Status effect / duration |
| `WC1e.body.detail2` | 22.4vw | 8.16vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1e.body.blocker` | 22.4vw | 2.88vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1e.selection.outline` | 24vw | 48vh | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1e.selection.info` | 4vw | 4vh | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Status effect / duration │
│ Playability / removal    │
│ rule                     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1e.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1e.header` | 48vw | 3.84vh | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1e.header.title` | 30.16vw | 3.84vh | WC1e.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1e.header.state` | 13.92vw | 3.84vh | WC1e.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1e.art` | 48vw | 15.36vh | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1e.art.tags` | 46.4vw | 3.072vh | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1e.body` | 48vw | 15.36vh | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1e.footer` | 48vw | 3.84vh | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1e.footer.metadata` | 46.4vw | 3.07vh | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1e.body.detail1` | 46.4vw | 6.53vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Status effect / duration |
| `WC1e.body.detail2` | 46.4vw | 6.53vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1e.body.blocker` | 46.4vw | 2.3vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1e.selection.outline` | 48vw | 38.4vh | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1e.selection.info` | 4vw | 4vh | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Status effect / duration │
│ Playability / removal    │
│ rule                     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC1e.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC1e.header` | 48vw | 3.84vh | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC1e.header.title` | 30.16vw | 3.84vh | WC1e.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC1e.header.state` | 13.92vw | 3.84vh | WC1e.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC1e.art` | 48vw | 15.36vh | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC1e.art.tags` | 46.4vw | 3.072vh | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC1e.body` | 48vw | 15.36vh | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC1e.footer` | 48vw | 3.84vh | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC1e.footer.metadata` | 46.4vw | 3.07vh | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC1e.body.detail1` | 46.4vw | 6.53vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Status effect / duration |
| `WC1e.body.detail2` | 46.4vw | 6.53vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Playability / removal rule |
| `WC1e.body.blocker` | 46.4vw | 2.3vh | WC1e.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC1e.selection.outline` | 48vw | 38.4vh | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC1e.selection.info` | 4vw | 4vh | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC1
REQUIRED PROPOSED TAGS: ability:status
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC1e
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC1e.body.detail1 ← registered provider for Status effect / duration
    WC1e.body.detail2 ← registered provider for Playability / removal rule
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
This is a playing-card subtype, distinct from a combat status indicator.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2: Possession card

**Parent: WC0.** Common item identity, ownership and instance state; tags add supported operations.

**Construction tags (proposed):** `card-kind:possession`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Ownership / quantity           │
│ Capabilities / requirements    │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2.header` | 16vw | 4.096vh | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2.header.title` | 9.36vw | 4.096vh | WC2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2.header.state` | 4.32vw | 4.096vh | WC2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2.art` | 16vw | 16.384vh | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2.art.tags` | 14.4vw | 3.2768vh | WC2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2.body` | 16vw | 16.384vh | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2.footer` | 16vw | 4.096vh | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2.footer.metadata` | 14.4vw | 3.28vh | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2.body.detail1` | 14.4vw | 6.96vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Ownership / quantity |
| `WC2.body.detail2` | 14.4vw | 6.96vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Capabilities / requirements |
| `WC2.body.blocker` | 14.4vw | 2.46vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2.selection.outline` | 16vw | 40.96vh | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2.selection.info` | 4vw | 4vh | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Ownership / quantity       │
│ Capabilities /             │
│ requirements               │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2.header` | 24vw | 4.800000000000001vh | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2.header.title` | 14.56vw | 4.800000000000001vh | WC2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2.header.state` | 6.72vw | 4.800000000000001vh | WC2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2.art` | 24vw | 19.200000000000003vh | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2.art.tags` | 22.4vw | 3.84vh | WC2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2.body` | 24vw | 19.200000000000003vh | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2.footer` | 24vw | 4.800000000000001vh | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2.footer.metadata` | 22.4vw | 3.84vh | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2.body.detail1` | 22.4vw | 8.16vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Ownership / quantity |
| `WC2.body.detail2` | 22.4vw | 8.16vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Capabilities / requirements |
| `WC2.body.blocker` | 22.4vw | 2.88vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2.selection.outline` | 24vw | 48vh | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2.selection.info` | 4vw | 4vh | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Ownership / quantity     │
│ Capabilities /           │
│ requirements             │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2.header` | 48vw | 3.84vh | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2.header.title` | 30.16vw | 3.84vh | WC2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2.header.state` | 13.92vw | 3.84vh | WC2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2.art` | 48vw | 15.36vh | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2.art.tags` | 46.4vw | 3.072vh | WC2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2.body` | 48vw | 15.36vh | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2.footer` | 48vw | 3.84vh | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2.footer.metadata` | 46.4vw | 3.07vh | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2.body.detail1` | 46.4vw | 6.53vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Ownership / quantity |
| `WC2.body.detail2` | 46.4vw | 6.53vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Capabilities / requirements |
| `WC2.body.blocker` | 46.4vw | 2.3vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2.selection.outline` | 48vw | 38.4vh | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2.selection.info` | 4vw | 4vh | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Ownership / quantity     │
│ Capabilities /           │
│ requirements             │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2.header` | 48vw | 3.84vh | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2.header.title` | 30.16vw | 3.84vh | WC2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2.header.state` | 13.92vw | 3.84vh | WC2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2.art` | 48vw | 15.36vh | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2.art.tags` | 46.4vw | 3.072vh | WC2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2.body` | 48vw | 15.36vh | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2.footer` | 48vw | 3.84vh | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2.footer.metadata` | 46.4vw | 3.07vh | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2.body.detail1` | 46.4vw | 6.53vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Ownership / quantity |
| `WC2.body.detail2` | 46.4vw | 6.53vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Capabilities / requirements |
| `WC2.body.blocker` | 46.4vw | 2.3vh | WC2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2.selection.outline` | 48vw | 38.4vh | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2.selection.info` | 4vw | 4vh | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC0
REQUIRED PROPOSED TAGS: card-kind:possession
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2.body.detail1 ← registered provider for Ownership / quantity
    WC2.body.detail2 ← registered provider for Capabilities / requirements
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Common item identity, ownership and instance state; tags add supported operations.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2a: Equipment card

**Parent: WC2.** The equipment base does not decide whether the item is weapon or armor by hard-coded ID.

**Construction tags (proposed):** `item-kind:equipment`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Slot / requirements            │
│ Equipped comparison            │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a.header` | 16vw | 4.096vh | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a.header.title` | 9.36vw | 4.096vh | WC2a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a.header.state` | 4.32vw | 4.096vh | WC2a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a.art` | 16vw | 16.384vh | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a.art.tags` | 14.4vw | 3.2768vh | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a.body` | 16vw | 16.384vh | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a.footer` | 16vw | 4.096vh | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a.footer.metadata` | 14.4vw | 3.28vh | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a.body.detail1` | 14.4vw | 6.96vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Slot / requirements |
| `WC2a.body.detail2` | 14.4vw | 6.96vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Equipped comparison |
| `WC2a.body.blocker` | 14.4vw | 2.46vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a.selection.outline` | 16vw | 40.96vh | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a.selection.info` | 4vw | 4vh | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Slot / requirements        │
│ Equipped comparison        │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a.header` | 24vw | 4.800000000000001vh | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a.header.title` | 14.56vw | 4.800000000000001vh | WC2a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a.header.state` | 6.72vw | 4.800000000000001vh | WC2a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a.art` | 24vw | 19.200000000000003vh | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a.art.tags` | 22.4vw | 3.84vh | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a.body` | 24vw | 19.200000000000003vh | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a.footer` | 24vw | 4.800000000000001vh | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a.footer.metadata` | 22.4vw | 3.84vh | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a.body.detail1` | 22.4vw | 8.16vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Slot / requirements |
| `WC2a.body.detail2` | 22.4vw | 8.16vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Equipped comparison |
| `WC2a.body.blocker` | 22.4vw | 2.88vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a.selection.outline` | 24vw | 48vh | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a.selection.info` | 4vw | 4vh | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Slot / requirements      │
│ Equipped comparison      │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a.header` | 48vw | 3.84vh | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a.header.title` | 30.16vw | 3.84vh | WC2a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a.header.state` | 13.92vw | 3.84vh | WC2a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a.art` | 48vw | 15.36vh | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a.art.tags` | 46.4vw | 3.072vh | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a.body` | 48vw | 15.36vh | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a.footer` | 48vw | 3.84vh | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a.footer.metadata` | 46.4vw | 3.07vh | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a.body.detail1` | 46.4vw | 6.53vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Slot / requirements |
| `WC2a.body.detail2` | 46.4vw | 6.53vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Equipped comparison |
| `WC2a.body.blocker` | 46.4vw | 2.3vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a.selection.outline` | 48vw | 38.4vh | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a.selection.info` | 4vw | 4vh | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Slot / requirements      │
│ Equipped comparison      │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a.header` | 48vw | 3.84vh | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a.header.title` | 30.16vw | 3.84vh | WC2a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a.header.state` | 13.92vw | 3.84vh | WC2a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a.art` | 48vw | 15.36vh | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a.art.tags` | 46.4vw | 3.072vh | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a.body` | 48vw | 15.36vh | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a.footer` | 48vw | 3.84vh | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a.footer.metadata` | 46.4vw | 3.07vh | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a.body.detail1` | 46.4vw | 6.53vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Slot / requirements |
| `WC2a.body.detail2` | 46.4vw | 6.53vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Equipped comparison |
| `WC2a.body.blocker` | 46.4vw | 2.3vh | WC2a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a.selection.outline` | 48vw | 38.4vh | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a.selection.info` | 4vw | 4vh | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2
REQUIRED PROPOSED TAGS: item-kind:equipment
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2a
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2a.body.detail1 ← registered provider for Slot / requirements
    WC2a.body.detail2 ← registered provider for Equipped comparison
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Equip") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
The equipment base does not decide whether the item is weapon or armor by hard-coded ID.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2a1: Weapon card

**Parent: WC2a.** Weapon-specific rows attach by tags; values come from loadout/equipment projections.

**Construction tags (proposed):** `equipment-kind:weapon`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Damage / scaling               │
│ Hand / requirements            │
│ Granted card package           │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a1.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a1.header` | 16vw | 4.096vh | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a1.header.title` | 9.36vw | 4.096vh | WC2a1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a1.header.state` | 4.32vw | 4.096vh | WC2a1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a1.art` | 16vw | 16.384vh | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a1.art.tags` | 14.4vw | 3.2768vh | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a1.body` | 16vw | 16.384vh | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a1.footer` | 16vw | 4.096vh | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a1.footer.metadata` | 14.4vw | 3.28vh | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a1.body.detail1` | 14.4vw | 4.64vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / scaling |
| `WC2a1.body.detail2` | 14.4vw | 4.64vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Hand / requirements |
| `WC2a1.body.detail3` | 14.4vw | 4.64vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted card package |
| `WC2a1.body.blocker` | 14.4vw | 2.46vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a1.selection.outline` | 16vw | 40.96vh | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a1.selection.info` | 4vw | 4vh | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Damage / scaling           │
│ Hand / requirements        │
│ Granted card package       │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a1.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a1.header` | 24vw | 4.800000000000001vh | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a1.header.title` | 14.56vw | 4.800000000000001vh | WC2a1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a1.header.state` | 6.72vw | 4.800000000000001vh | WC2a1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a1.art` | 24vw | 19.200000000000003vh | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a1.art.tags` | 22.4vw | 3.84vh | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a1.body` | 24vw | 19.200000000000003vh | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a1.footer` | 24vw | 4.800000000000001vh | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a1.footer.metadata` | 22.4vw | 3.84vh | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a1.body.detail1` | 22.4vw | 5.44vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / scaling |
| `WC2a1.body.detail2` | 22.4vw | 5.44vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Hand / requirements |
| `WC2a1.body.detail3` | 22.4vw | 5.44vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted card package |
| `WC2a1.body.blocker` | 22.4vw | 2.88vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a1.selection.outline` | 24vw | 48vh | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a1.selection.info` | 4vw | 4vh | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Damage / scaling         │
│ Hand / requirements      │
│ Granted card package     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a1.header` | 48vw | 3.84vh | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a1.header.title` | 30.16vw | 3.84vh | WC2a1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a1.header.state` | 13.92vw | 3.84vh | WC2a1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a1.art` | 48vw | 15.36vh | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a1.art.tags` | 46.4vw | 3.072vh | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a1.body` | 48vw | 15.36vh | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a1.footer` | 48vw | 3.84vh | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a1.footer.metadata` | 46.4vw | 3.07vh | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a1.body.detail1` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / scaling |
| `WC2a1.body.detail2` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Hand / requirements |
| `WC2a1.body.detail3` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted card package |
| `WC2a1.body.blocker` | 46.4vw | 2.3vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a1.selection.outline` | 48vw | 38.4vh | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a1.selection.info` | 4vw | 4vh | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Damage / scaling         │
│ Hand / requirements      │
│ Granted card package     │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a1.header` | 48vw | 3.84vh | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a1.header.title` | 30.16vw | 3.84vh | WC2a1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a1.header.state` | 13.92vw | 3.84vh | WC2a1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a1.art` | 48vw | 15.36vh | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a1.art.tags` | 46.4vw | 3.072vh | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a1.body` | 48vw | 15.36vh | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a1.footer` | 48vw | 3.84vh | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a1.footer.metadata` | 46.4vw | 3.07vh | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a1.body.detail1` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Damage / scaling |
| `WC2a1.body.detail2` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Hand / requirements |
| `WC2a1.body.detail3` | 46.4vw | 4.35vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted card package |
| `WC2a1.body.blocker` | 46.4vw | 2.3vh | WC2a1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a1.selection.outline` | 48vw | 38.4vh | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a1.selection.info` | 4vw | 4vh | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2a
REQUIRED PROPOSED TAGS: equipment-kind:weapon
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2a1
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2a1.body.detail1 ← registered provider for Damage / scaling
    WC2a1.body.detail2 ← registered provider for Hand / requirements
    WC2a1.body.detail3 ← registered provider for Granted card package
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Equip") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Weapon-specific rows attach by tags; values come from loadout/equipment projections.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2a2: Armor card

**Parent: WC2a.** Armor shares equipment slots and actions; only supported defense/modifier components differ.

**Construction tags (proposed):** `equipment-kind:armor`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Defense / resistance           │
│ Weight / requirements          │
│ Granted modifiers              │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a2.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a2.header` | 16vw | 4.096vh | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a2.header.title` | 9.36vw | 4.096vh | WC2a2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a2.header.state` | 4.32vw | 4.096vh | WC2a2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a2.art` | 16vw | 16.384vh | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a2.art.tags` | 14.4vw | 3.2768vh | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a2.body` | 16vw | 16.384vh | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a2.footer` | 16vw | 4.096vh | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a2.footer.metadata` | 14.4vw | 3.28vh | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a2.body.detail1` | 14.4vw | 4.64vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / resistance |
| `WC2a2.body.detail2` | 14.4vw | 4.64vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Weight / requirements |
| `WC2a2.body.detail3` | 14.4vw | 4.64vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted modifiers |
| `WC2a2.body.blocker` | 14.4vw | 2.46vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a2.selection.outline` | 16vw | 40.96vh | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a2.selection.info` | 4vw | 4vh | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Defense / resistance       │
│ Weight / requirements      │
│ Granted modifiers          │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a2.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a2.header` | 24vw | 4.800000000000001vh | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a2.header.title` | 14.56vw | 4.800000000000001vh | WC2a2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a2.header.state` | 6.72vw | 4.800000000000001vh | WC2a2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a2.art` | 24vw | 19.200000000000003vh | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a2.art.tags` | 22.4vw | 3.84vh | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a2.body` | 24vw | 19.200000000000003vh | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a2.footer` | 24vw | 4.800000000000001vh | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a2.footer.metadata` | 22.4vw | 3.84vh | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a2.body.detail1` | 22.4vw | 5.44vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / resistance |
| `WC2a2.body.detail2` | 22.4vw | 5.44vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Weight / requirements |
| `WC2a2.body.detail3` | 22.4vw | 5.44vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted modifiers |
| `WC2a2.body.blocker` | 22.4vw | 2.88vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a2.selection.outline` | 24vw | 48vh | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a2.selection.info` | 4vw | 4vh | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Defense / resistance     │
│ Weight / requirements    │
│ Granted modifiers        │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a2.header` | 48vw | 3.84vh | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a2.header.title` | 30.16vw | 3.84vh | WC2a2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a2.header.state` | 13.92vw | 3.84vh | WC2a2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a2.art` | 48vw | 15.36vh | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a2.art.tags` | 46.4vw | 3.072vh | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a2.body` | 48vw | 15.36vh | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a2.footer` | 48vw | 3.84vh | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a2.footer.metadata` | 46.4vw | 3.07vh | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a2.body.detail1` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / resistance |
| `WC2a2.body.detail2` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Weight / requirements |
| `WC2a2.body.detail3` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted modifiers |
| `WC2a2.body.blocker` | 46.4vw | 2.3vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a2.selection.outline` | 48vw | 38.4vh | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a2.selection.info` | 4vw | 4vh | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Defense / resistance     │
│ Weight / requirements    │
│ Granted modifiers        │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2a2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2a2.header` | 48vw | 3.84vh | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2a2.header.title` | 30.16vw | 3.84vh | WC2a2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2a2.header.state` | 13.92vw | 3.84vh | WC2a2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2a2.art` | 48vw | 15.36vh | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2a2.art.tags` | 46.4vw | 3.072vh | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2a2.body` | 48vw | 15.36vh | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2a2.footer` | 48vw | 3.84vh | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2a2.footer.metadata` | 46.4vw | 3.07vh | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2a2.body.detail1` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Defense / resistance |
| `WC2a2.body.detail2` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Weight / requirements |
| `WC2a2.body.detail3` | 46.4vw | 4.35vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted modifiers |
| `WC2a2.body.blocker` | 46.4vw | 2.3vh | WC2a2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2a2.selection.outline` | 48vw | 38.4vh | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2a2.selection.info` | 4vw | 4vh | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2a
REQUIRED PROPOSED TAGS: equipment-kind:armor
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2a2
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2a2.body.detail1 ← registered provider for Defense / resistance
    WC2a2.body.detail2 ← registered provider for Weight / requirements
    WC2a2.body.detail3 ← registered provider for Granted modifiers
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Equip") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Armor shares equipment slots and actions; only supported defense/modifier components differ.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2b: Relic card

**Parent: WC2.** Relic actions vary by context; do not add Equip where the domain treats possession as activation.

**Construction tags (proposed):** `item-kind:relic`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Relic effect                   │
│ Acquisition / equip state      │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b.header` | 16vw | 4.096vh | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b.header.title` | 9.36vw | 4.096vh | WC2b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b.header.state` | 4.32vw | 4.096vh | WC2b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b.art` | 16vw | 16.384vh | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b.art.tags` | 14.4vw | 3.2768vh | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b.body` | 16vw | 16.384vh | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b.footer` | 16vw | 4.096vh | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b.footer.metadata` | 14.4vw | 3.28vh | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b.body.detail1` | 14.4vw | 6.96vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Relic effect |
| `WC2b.body.detail2` | 14.4vw | 6.96vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Acquisition / equip state |
| `WC2b.body.blocker` | 14.4vw | 2.46vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b.selection.outline` | 16vw | 40.96vh | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b.selection.info` | 4vw | 4vh | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Relic effect               │
│ Acquisition / equip state  │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b.header` | 24vw | 4.800000000000001vh | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b.header.title` | 14.56vw | 4.800000000000001vh | WC2b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b.header.state` | 6.72vw | 4.800000000000001vh | WC2b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b.art` | 24vw | 19.200000000000003vh | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b.art.tags` | 22.4vw | 3.84vh | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b.body` | 24vw | 19.200000000000003vh | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b.footer` | 24vw | 4.800000000000001vh | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b.footer.metadata` | 22.4vw | 3.84vh | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b.body.detail1` | 22.4vw | 8.16vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Relic effect |
| `WC2b.body.detail2` | 22.4vw | 8.16vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Acquisition / equip state |
| `WC2b.body.blocker` | 22.4vw | 2.88vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b.selection.outline` | 24vw | 48vh | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b.selection.info` | 4vw | 4vh | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Relic effect             │
│ Acquisition / equip      │
│ state                    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b.header` | 48vw | 3.84vh | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b.header.title` | 30.16vw | 3.84vh | WC2b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b.header.state` | 13.92vw | 3.84vh | WC2b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b.art` | 48vw | 15.36vh | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b.art.tags` | 46.4vw | 3.072vh | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b.body` | 48vw | 15.36vh | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b.footer` | 48vw | 3.84vh | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b.footer.metadata` | 46.4vw | 3.07vh | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b.body.detail1` | 46.4vw | 6.53vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Relic effect |
| `WC2b.body.detail2` | 46.4vw | 6.53vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Acquisition / equip state |
| `WC2b.body.blocker` | 46.4vw | 2.3vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b.selection.outline` | 48vw | 38.4vh | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b.selection.info` | 4vw | 4vh | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Relic effect             │
│ Acquisition / equip      │
│ state                    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b.header` | 48vw | 3.84vh | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b.header.title` | 30.16vw | 3.84vh | WC2b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b.header.state` | 13.92vw | 3.84vh | WC2b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b.art` | 48vw | 15.36vh | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b.art.tags` | 46.4vw | 3.072vh | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b.body` | 48vw | 15.36vh | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b.footer` | 48vw | 3.84vh | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b.footer.metadata` | 46.4vw | 3.07vh | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b.body.detail1` | 46.4vw | 6.53vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Relic effect |
| `WC2b.body.detail2` | 46.4vw | 6.53vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Acquisition / equip state |
| `WC2b.body.blocker` | 46.4vw | 2.3vh | WC2b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b.selection.outline` | 48vw | 38.4vh | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b.selection.info` | 4vw | 4vh | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2
REQUIRED PROPOSED TAGS: item-kind:relic
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2b
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2b.body.detail1 ← registered provider for Relic effect
    WC2b.body.detail2 ← registered provider for Acquisition / equip state
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Relic actions vary by context; do not add Equip where the domain treats possession as activation.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2b1: Passive relic

**Parent: WC2b.** Show existing passive definitions and current applied state.

**Construction tags (proposed):** `effect-mode:passive`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Passive modifiers              │
│ Affected resources / stats     │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b1.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b1.header` | 16vw | 4.096vh | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b1.header.title` | 9.36vw | 4.096vh | WC2b1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b1.header.state` | 4.32vw | 4.096vh | WC2b1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b1.art` | 16vw | 16.384vh | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b1.art.tags` | 14.4vw | 3.2768vh | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b1.body` | 16vw | 16.384vh | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b1.footer` | 16vw | 4.096vh | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b1.footer.metadata` | 14.4vw | 3.28vh | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b1.body.detail1` | 14.4vw | 6.96vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Passive modifiers |
| `WC2b1.body.detail2` | 14.4vw | 6.96vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Affected resources / stats |
| `WC2b1.body.blocker` | 14.4vw | 2.46vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b1.selection.outline` | 16vw | 40.96vh | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b1.selection.info` | 4vw | 4vh | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Passive modifiers          │
│ Affected resources / stats │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b1.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b1.header` | 24vw | 4.800000000000001vh | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b1.header.title` | 14.56vw | 4.800000000000001vh | WC2b1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b1.header.state` | 6.72vw | 4.800000000000001vh | WC2b1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b1.art` | 24vw | 19.200000000000003vh | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b1.art.tags` | 22.4vw | 3.84vh | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b1.body` | 24vw | 19.200000000000003vh | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b1.footer` | 24vw | 4.800000000000001vh | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b1.footer.metadata` | 22.4vw | 3.84vh | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b1.body.detail1` | 22.4vw | 8.16vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Passive modifiers |
| `WC2b1.body.detail2` | 22.4vw | 8.16vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Affected resources / stats |
| `WC2b1.body.blocker` | 22.4vw | 2.88vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b1.selection.outline` | 24vw | 48vh | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b1.selection.info` | 4vw | 4vh | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Passive modifiers        │
│ Affected resources /     │
│ stats                    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b1.header` | 48vw | 3.84vh | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b1.header.title` | 30.16vw | 3.84vh | WC2b1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b1.header.state` | 13.92vw | 3.84vh | WC2b1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b1.art` | 48vw | 15.36vh | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b1.art.tags` | 46.4vw | 3.072vh | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b1.body` | 48vw | 15.36vh | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b1.footer` | 48vw | 3.84vh | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b1.footer.metadata` | 46.4vw | 3.07vh | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b1.body.detail1` | 46.4vw | 6.53vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Passive modifiers |
| `WC2b1.body.detail2` | 46.4vw | 6.53vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Affected resources / stats |
| `WC2b1.body.blocker` | 46.4vw | 2.3vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b1.selection.outline` | 48vw | 38.4vh | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b1.selection.info` | 4vw | 4vh | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Passive modifiers        │
│ Affected resources /     │
│ stats                    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b1.header` | 48vw | 3.84vh | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b1.header.title` | 30.16vw | 3.84vh | WC2b1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b1.header.state` | 13.92vw | 3.84vh | WC2b1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b1.art` | 48vw | 15.36vh | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b1.art.tags` | 46.4vw | 3.072vh | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b1.body` | 48vw | 15.36vh | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b1.footer` | 48vw | 3.84vh | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b1.footer.metadata` | 46.4vw | 3.07vh | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b1.body.detail1` | 46.4vw | 6.53vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Passive modifiers |
| `WC2b1.body.detail2` | 46.4vw | 6.53vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Affected resources / stats |
| `WC2b1.body.blocker` | 46.4vw | 2.3vh | WC2b1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b1.selection.outline` | 48vw | 38.4vh | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b1.selection.info` | 4vw | 4vh | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2b
REQUIRED PROPOSED TAGS: effect-mode:passive
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2b1
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2b1.body.detail1 ← registered provider for Passive modifiers
    WC2b1.body.detail2 ← registered provider for Affected resources / stats
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Show existing passive definitions and current applied state.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2b2: Triggered relic

**Parent: WC2b.** Multiple effect modes may coexist through components; do not force a false exclusive category.

**Construction tags (proposed):** `effect-mode:triggered`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Trigger condition              │
│ Effect / limit / cooldown      │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b2.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b2.header` | 16vw | 4.096vh | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b2.header.title` | 9.36vw | 4.096vh | WC2b2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b2.header.state` | 4.32vw | 4.096vh | WC2b2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b2.art` | 16vw | 16.384vh | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b2.art.tags` | 14.4vw | 3.2768vh | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b2.body` | 16vw | 16.384vh | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b2.footer` | 16vw | 4.096vh | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b2.footer.metadata` | 14.4vw | 3.28vh | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b2.body.detail1` | 14.4vw | 6.96vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger condition |
| `WC2b2.body.detail2` | 14.4vw | 6.96vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effect / limit / cooldown |
| `WC2b2.body.blocker` | 14.4vw | 2.46vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b2.selection.outline` | 16vw | 40.96vh | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b2.selection.info` | 4vw | 4vh | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Trigger condition          │
│ Effect / limit / cooldown  │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b2.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b2.header` | 24vw | 4.800000000000001vh | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b2.header.title` | 14.56vw | 4.800000000000001vh | WC2b2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b2.header.state` | 6.72vw | 4.800000000000001vh | WC2b2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b2.art` | 24vw | 19.200000000000003vh | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b2.art.tags` | 22.4vw | 3.84vh | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b2.body` | 24vw | 19.200000000000003vh | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b2.footer` | 24vw | 4.800000000000001vh | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b2.footer.metadata` | 22.4vw | 3.84vh | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b2.body.detail1` | 22.4vw | 8.16vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger condition |
| `WC2b2.body.detail2` | 22.4vw | 8.16vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effect / limit / cooldown |
| `WC2b2.body.blocker` | 22.4vw | 2.88vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b2.selection.outline` | 24vw | 48vh | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b2.selection.info` | 4vw | 4vh | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Trigger condition        │
│ Effect / limit /         │
│ cooldown                 │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b2.header` | 48vw | 3.84vh | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b2.header.title` | 30.16vw | 3.84vh | WC2b2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b2.header.state` | 13.92vw | 3.84vh | WC2b2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b2.art` | 48vw | 15.36vh | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b2.art.tags` | 46.4vw | 3.072vh | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b2.body` | 48vw | 15.36vh | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b2.footer` | 48vw | 3.84vh | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b2.footer.metadata` | 46.4vw | 3.07vh | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b2.body.detail1` | 46.4vw | 6.53vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger condition |
| `WC2b2.body.detail2` | 46.4vw | 6.53vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effect / limit / cooldown |
| `WC2b2.body.blocker` | 46.4vw | 2.3vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b2.selection.outline` | 48vw | 38.4vh | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b2.selection.info` | 4vw | 4vh | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Trigger condition        │
│ Effect / limit /         │
│ cooldown                 │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2b2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2b2.header` | 48vw | 3.84vh | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2b2.header.title` | 30.16vw | 3.84vh | WC2b2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2b2.header.state` | 13.92vw | 3.84vh | WC2b2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2b2.art` | 48vw | 15.36vh | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2b2.art.tags` | 46.4vw | 3.072vh | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2b2.body` | 48vw | 15.36vh | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2b2.footer` | 48vw | 3.84vh | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2b2.footer.metadata` | 46.4vw | 3.07vh | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2b2.body.detail1` | 46.4vw | 6.53vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Trigger condition |
| `WC2b2.body.detail2` | 46.4vw | 6.53vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Effect / limit / cooldown |
| `WC2b2.body.blocker` | 46.4vw | 2.3vh | WC2b2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2b2.selection.outline` | 48vw | 38.4vh | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2b2.selection.info` | 4vw | 4vh | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2b
REQUIRED PROPOSED TAGS: effect-mode:triggered
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2b2
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2b2.body.detail1 ← registered provider for Trigger condition
    WC2b2.body.detail2 ← registered provider for Effect / limit / cooldown
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Inspect") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Multiple effect modes may coexist through components; do not force a false exclusive category.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2c: Consumable card

**Parent: WC2.** Model depleted vs unavailable separately; inventory state remains authoritative.

**Construction tags (proposed):** `item-kind:consumable`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Charges / quantity             │
│ Use effect / eligibility       │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c.header` | 16vw | 4.096vh | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c.header.title` | 9.36vw | 4.096vh | WC2c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c.header.state` | 4.32vw | 4.096vh | WC2c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c.art` | 16vw | 16.384vh | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c.art.tags` | 14.4vw | 3.2768vh | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c.body` | 16vw | 16.384vh | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c.footer` | 16vw | 4.096vh | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c.footer.metadata` | 14.4vw | 3.28vh | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c.body.detail1` | 14.4vw | 6.96vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / quantity |
| `WC2c.body.detail2` | 14.4vw | 6.96vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Use effect / eligibility |
| `WC2c.body.blocker` | 14.4vw | 2.46vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c.selection.outline` | 16vw | 40.96vh | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c.selection.info` | 4vw | 4vh | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Charges / quantity         │
│ Use effect / eligibility   │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c.header` | 24vw | 4.800000000000001vh | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c.header.title` | 14.56vw | 4.800000000000001vh | WC2c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c.header.state` | 6.72vw | 4.800000000000001vh | WC2c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c.art` | 24vw | 19.200000000000003vh | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c.art.tags` | 22.4vw | 3.84vh | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c.body` | 24vw | 19.200000000000003vh | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c.footer` | 24vw | 4.800000000000001vh | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c.footer.metadata` | 22.4vw | 3.84vh | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c.body.detail1` | 22.4vw | 8.16vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / quantity |
| `WC2c.body.detail2` | 22.4vw | 8.16vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Use effect / eligibility |
| `WC2c.body.blocker` | 22.4vw | 2.88vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c.selection.outline` | 24vw | 48vh | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c.selection.info` | 4vw | 4vh | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Charges / quantity       │
│ Use effect / eligibility │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c.header` | 48vw | 3.84vh | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c.header.title` | 30.16vw | 3.84vh | WC2c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c.header.state` | 13.92vw | 3.84vh | WC2c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c.art` | 48vw | 15.36vh | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c.art.tags` | 46.4vw | 3.072vh | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c.body` | 48vw | 15.36vh | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c.footer` | 48vw | 3.84vh | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c.footer.metadata` | 46.4vw | 3.07vh | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c.body.detail1` | 46.4vw | 6.53vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / quantity |
| `WC2c.body.detail2` | 46.4vw | 6.53vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Use effect / eligibility |
| `WC2c.body.blocker` | 46.4vw | 2.3vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c.selection.outline` | 48vw | 38.4vh | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c.selection.info` | 4vw | 4vh | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Charges / quantity       │
│ Use effect / eligibility │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c.header` | 48vw | 3.84vh | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c.header.title` | 30.16vw | 3.84vh | WC2c.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c.header.state` | 13.92vw | 3.84vh | WC2c.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c.art` | 48vw | 15.36vh | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c.art.tags` | 46.4vw | 3.072vh | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c.body` | 48vw | 15.36vh | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c.footer` | 48vw | 3.84vh | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c.footer.metadata` | 46.4vw | 3.07vh | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c.body.detail1` | 46.4vw | 6.53vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / quantity |
| `WC2c.body.detail2` | 46.4vw | 6.53vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Use effect / eligibility |
| `WC2c.body.blocker` | 46.4vw | 2.3vh | WC2c.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c.selection.outline` | 48vw | 38.4vh | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c.selection.info` | 4vw | 4vh | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2
REQUIRED PROPOSED TAGS: item-kind:consumable
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2c
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2c.body.detail1 ← registered provider for Charges / quantity
    WC2c.body.detail2 ← registered provider for Use effect / eligibility
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Use") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Model depleted vs unavailable separately; inventory state remains authoritative.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2c1: Healing consumable

**Parent: WC2c.** Bind existing heal preview/cap rules.

**Construction tags (proposed):** `effect-purpose:healing`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Healing preview                │
│ Charges / availability         │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c1.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c1.header` | 16vw | 4.096vh | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c1.header.title` | 9.36vw | 4.096vh | WC2c1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c1.header.state` | 4.32vw | 4.096vh | WC2c1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c1.art` | 16vw | 16.384vh | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c1.art.tags` | 14.4vw | 3.2768vh | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c1.body` | 16vw | 16.384vh | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c1.footer` | 16vw | 4.096vh | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c1.footer.metadata` | 14.4vw | 3.28vh | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c1.body.detail1` | 14.4vw | 6.96vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Healing preview |
| `WC2c1.body.detail2` | 14.4vw | 6.96vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c1.body.blocker` | 14.4vw | 2.46vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c1.selection.outline` | 16vw | 40.96vh | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c1.selection.info` | 4vw | 4vh | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Healing preview            │
│ Charges / availability     │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c1.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c1.header` | 24vw | 4.800000000000001vh | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c1.header.title` | 14.56vw | 4.800000000000001vh | WC2c1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c1.header.state` | 6.72vw | 4.800000000000001vh | WC2c1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c1.art` | 24vw | 19.200000000000003vh | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c1.art.tags` | 22.4vw | 3.84vh | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c1.body` | 24vw | 19.200000000000003vh | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c1.footer` | 24vw | 4.800000000000001vh | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c1.footer.metadata` | 22.4vw | 3.84vh | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c1.body.detail1` | 22.4vw | 8.16vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Healing preview |
| `WC2c1.body.detail2` | 22.4vw | 8.16vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c1.body.blocker` | 22.4vw | 2.88vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c1.selection.outline` | 24vw | 48vh | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c1.selection.info` | 4vw | 4vh | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Healing preview          │
│ Charges / availability   │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c1.header` | 48vw | 3.84vh | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c1.header.title` | 30.16vw | 3.84vh | WC2c1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c1.header.state` | 13.92vw | 3.84vh | WC2c1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c1.art` | 48vw | 15.36vh | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c1.art.tags` | 46.4vw | 3.072vh | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c1.body` | 48vw | 15.36vh | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c1.footer` | 48vw | 3.84vh | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c1.footer.metadata` | 46.4vw | 3.07vh | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c1.body.detail1` | 46.4vw | 6.53vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Healing preview |
| `WC2c1.body.detail2` | 46.4vw | 6.53vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c1.body.blocker` | 46.4vw | 2.3vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c1.selection.outline` | 48vw | 38.4vh | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c1.selection.info` | 4vw | 4vh | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Healing preview          │
│ Charges / availability   │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c1.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c1.header` | 48vw | 3.84vh | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c1.header.title` | 30.16vw | 3.84vh | WC2c1.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c1.header.state` | 13.92vw | 3.84vh | WC2c1.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c1.art` | 48vw | 15.36vh | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c1.art.tags` | 46.4vw | 3.072vh | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c1.body` | 48vw | 15.36vh | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c1.footer` | 48vw | 3.84vh | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c1.footer.metadata` | 46.4vw | 3.07vh | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c1.body.detail1` | 46.4vw | 6.53vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Healing preview |
| `WC2c1.body.detail2` | 46.4vw | 6.53vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c1.body.blocker` | 46.4vw | 2.3vh | WC2c1.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c1.selection.outline` | 48vw | 38.4vh | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c1.selection.info` | 4vw | 4vh | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2c
REQUIRED PROPOSED TAGS: effect-purpose:healing
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2c1
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2c1.body.detail1 ← registered provider for Healing preview
    WC2c1.body.detail2 ← registered provider for Charges / availability
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Use") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Bind existing heal preview/cap rules.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2c2: Resource consumable

**Parent: WC2c.** Resource identity selects its registered semantic color, not primary green.

**Construction tags (proposed):** `effect-purpose:resource`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Resource restoration           │
│ Charges / availability         │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c2.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c2.header` | 16vw | 4.096vh | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c2.header.title` | 9.36vw | 4.096vh | WC2c2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c2.header.state` | 4.32vw | 4.096vh | WC2c2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c2.art` | 16vw | 16.384vh | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c2.art.tags` | 14.4vw | 3.2768vh | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c2.body` | 16vw | 16.384vh | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c2.footer` | 16vw | 4.096vh | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c2.footer.metadata` | 14.4vw | 3.28vh | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c2.body.detail1` | 14.4vw | 6.96vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Resource restoration |
| `WC2c2.body.detail2` | 14.4vw | 6.96vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c2.body.blocker` | 14.4vw | 2.46vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c2.selection.outline` | 16vw | 40.96vh | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c2.selection.info` | 4vw | 4vh | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Resource restoration       │
│ Charges / availability     │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c2.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c2.header` | 24vw | 4.800000000000001vh | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c2.header.title` | 14.56vw | 4.800000000000001vh | WC2c2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c2.header.state` | 6.72vw | 4.800000000000001vh | WC2c2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c2.art` | 24vw | 19.200000000000003vh | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c2.art.tags` | 22.4vw | 3.84vh | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c2.body` | 24vw | 19.200000000000003vh | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c2.footer` | 24vw | 4.800000000000001vh | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c2.footer.metadata` | 22.4vw | 3.84vh | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c2.body.detail1` | 22.4vw | 8.16vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Resource restoration |
| `WC2c2.body.detail2` | 22.4vw | 8.16vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c2.body.blocker` | 22.4vw | 2.88vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c2.selection.outline` | 24vw | 48vh | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c2.selection.info` | 4vw | 4vh | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Resource restoration     │
│ Charges / availability   │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c2.header` | 48vw | 3.84vh | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c2.header.title` | 30.16vw | 3.84vh | WC2c2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c2.header.state` | 13.92vw | 3.84vh | WC2c2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c2.art` | 48vw | 15.36vh | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c2.art.tags` | 46.4vw | 3.072vh | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c2.body` | 48vw | 15.36vh | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c2.footer` | 48vw | 3.84vh | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c2.footer.metadata` | 46.4vw | 3.07vh | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c2.body.detail1` | 46.4vw | 6.53vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Resource restoration |
| `WC2c2.body.detail2` | 46.4vw | 6.53vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c2.body.blocker` | 46.4vw | 2.3vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c2.selection.outline` | 48vw | 38.4vh | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c2.selection.info` | 4vw | 4vh | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Resource restoration     │
│ Charges / availability   │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c2.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c2.header` | 48vw | 3.84vh | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c2.header.title` | 30.16vw | 3.84vh | WC2c2.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c2.header.state` | 13.92vw | 3.84vh | WC2c2.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c2.art` | 48vw | 15.36vh | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c2.art.tags` | 46.4vw | 3.072vh | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c2.body` | 48vw | 15.36vh | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c2.footer` | 48vw | 3.84vh | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c2.footer.metadata` | 46.4vw | 3.07vh | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c2.body.detail1` | 46.4vw | 6.53vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Resource restoration |
| `WC2c2.body.detail2` | 46.4vw | 6.53vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Charges / availability |
| `WC2c2.body.blocker` | 46.4vw | 2.3vh | WC2c2.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c2.selection.outline` | 48vw | 38.4vh | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c2.selection.info` | 4vw | 4vh | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2c
REQUIRED PROPOSED TAGS: effect-purpose:resource
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2c2
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2c2.body.detail1 ← registered provider for Resource restoration
    WC2c2.body.detail2 ← registered provider for Charges / availability
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Use") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Resource identity selects its registered semantic color, not primary green.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC2c3: Utility consumable

**Parent: WC2c.** Targeted use follows existing targeting/confirmation command flow.

**Construction tags (proposed):** `effect-purpose:utility`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Utility effect / target        │
│ Quantity / availability        │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c3.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c3.header` | 16vw | 4.096vh | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c3.header.title` | 9.36vw | 4.096vh | WC2c3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c3.header.state` | 4.32vw | 4.096vh | WC2c3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c3.art` | 16vw | 16.384vh | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c3.art.tags` | 14.4vw | 3.2768vh | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c3.body` | 16vw | 16.384vh | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c3.footer` | 16vw | 4.096vh | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c3.footer.metadata` | 14.4vw | 3.28vh | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c3.body.detail1` | 14.4vw | 6.96vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Utility effect / target |
| `WC2c3.body.detail2` | 14.4vw | 6.96vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Quantity / availability |
| `WC2c3.body.blocker` | 14.4vw | 2.46vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c3.selection.outline` | 16vw | 40.96vh | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c3.selection.info` | 4vw | 4vh | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Utility effect / target    │
│ Quantity / availability    │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c3.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c3.header` | 24vw | 4.800000000000001vh | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c3.header.title` | 14.56vw | 4.800000000000001vh | WC2c3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c3.header.state` | 6.72vw | 4.800000000000001vh | WC2c3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c3.art` | 24vw | 19.200000000000003vh | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c3.art.tags` | 22.4vw | 3.84vh | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c3.body` | 24vw | 19.200000000000003vh | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c3.footer` | 24vw | 4.800000000000001vh | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c3.footer.metadata` | 22.4vw | 3.84vh | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c3.body.detail1` | 22.4vw | 8.16vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Utility effect / target |
| `WC2c3.body.detail2` | 22.4vw | 8.16vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Quantity / availability |
| `WC2c3.body.blocker` | 22.4vw | 2.88vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c3.selection.outline` | 24vw | 48vh | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c3.selection.info` | 4vw | 4vh | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Utility effect / target  │
│ Quantity / availability  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c3.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c3.header` | 48vw | 3.84vh | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c3.header.title` | 30.16vw | 3.84vh | WC2c3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c3.header.state` | 13.92vw | 3.84vh | WC2c3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c3.art` | 48vw | 15.36vh | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c3.art.tags` | 46.4vw | 3.072vh | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c3.body` | 48vw | 15.36vh | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c3.footer` | 48vw | 3.84vh | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c3.footer.metadata` | 46.4vw | 3.07vh | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c3.body.detail1` | 46.4vw | 6.53vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Utility effect / target |
| `WC2c3.body.detail2` | 46.4vw | 6.53vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Quantity / availability |
| `WC2c3.body.blocker` | 46.4vw | 2.3vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c3.selection.outline` | 48vw | 38.4vh | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c3.selection.info` | 4vw | 4vh | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Utility effect / target  │
│ Quantity / availability  │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC2c3.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC2c3.header` | 48vw | 3.84vh | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC2c3.header.title` | 30.16vw | 3.84vh | WC2c3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC2c3.header.state` | 13.92vw | 3.84vh | WC2c3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC2c3.art` | 48vw | 15.36vh | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC2c3.art.tags` | 46.4vw | 3.072vh | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC2c3.body` | 48vw | 15.36vh | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC2c3.footer` | 48vw | 3.84vh | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC2c3.footer.metadata` | 46.4vw | 3.07vh | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC2c3.body.detail1` | 46.4vw | 6.53vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Utility effect / target |
| `WC2c3.body.detail2` | 46.4vw | 6.53vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Quantity / availability |
| `WC2c3.body.blocker` | 46.4vw | 2.3vh | WC2c3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC2c3.selection.outline` | 48vw | 38.4vh | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC2c3.selection.info` | 4vw | 4vh | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC2c
REQUIRED PROPOSED TAGS: effect-purpose:utility
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC2c3
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC2c3.body.detail1 ← registered provider for Utility effect / target
    WC2c3.body.detail2 ← registered provider for Quantity / availability
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Use") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Targeted use follows existing targeting/confirmation command flow.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC3: Character-choice card

**Parent: WC0.** Draft choice only; never commits a new run directly.

**Construction tags (proposed):** `card-kind:creationChoice`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Choice summary                 │
│ Current selection /            │
│ eligibility                    │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3.header` | 16vw | 4.096vh | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3.header.title` | 9.36vw | 4.096vh | WC3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3.header.state` | 4.32vw | 4.096vh | WC3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3.art` | 16vw | 16.384vh | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3.art.tags` | 14.4vw | 3.2768vh | WC3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3.body` | 16vw | 16.384vh | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3.footer` | 16vw | 4.096vh | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3.footer.metadata` | 14.4vw | 3.28vh | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3.body.detail1` | 14.4vw | 6.96vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Choice summary |
| `WC3.body.detail2` | 14.4vw | 6.96vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Current selection / eligibility |
| `WC3.body.blocker` | 14.4vw | 2.46vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3.selection.outline` | 16vw | 40.96vh | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3.selection.info` | 4vw | 4vh | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Choice summary             │
│ Current selection /        │
│ eligibility                │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3.header` | 24vw | 4.800000000000001vh | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3.header.title` | 14.56vw | 4.800000000000001vh | WC3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3.header.state` | 6.72vw | 4.800000000000001vh | WC3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3.art` | 24vw | 19.200000000000003vh | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3.art.tags` | 22.4vw | 3.84vh | WC3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3.body` | 24vw | 19.200000000000003vh | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3.footer` | 24vw | 4.800000000000001vh | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3.footer.metadata` | 22.4vw | 3.84vh | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3.body.detail1` | 22.4vw | 8.16vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Choice summary |
| `WC3.body.detail2` | 22.4vw | 8.16vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Current selection / eligibility |
| `WC3.body.blocker` | 22.4vw | 2.88vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3.selection.outline` | 24vw | 48vh | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3.selection.info` | 4vw | 4vh | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Choice summary           │
│ Current selection /      │
│ eligibility              │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3.header` | 48vw | 3.84vh | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3.header.title` | 30.16vw | 3.84vh | WC3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3.header.state` | 13.92vw | 3.84vh | WC3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3.art` | 48vw | 15.36vh | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3.art.tags` | 46.4vw | 3.072vh | WC3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3.body` | 48vw | 15.36vh | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3.footer` | 48vw | 3.84vh | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3.footer.metadata` | 46.4vw | 3.07vh | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3.body.detail1` | 46.4vw | 6.53vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Choice summary |
| `WC3.body.detail2` | 46.4vw | 6.53vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Current selection / eligibility |
| `WC3.body.blocker` | 46.4vw | 2.3vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3.selection.outline` | 48vw | 38.4vh | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3.selection.info` | 4vw | 4vh | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Choice summary           │
│ Current selection /      │
│ eligibility              │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3.header` | 48vw | 3.84vh | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3.header.title` | 30.16vw | 3.84vh | WC3.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3.header.state` | 13.92vw | 3.84vh | WC3.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3.art` | 48vw | 15.36vh | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3.art.tags` | 46.4vw | 3.072vh | WC3.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3.body` | 48vw | 15.36vh | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3.footer` | 48vw | 3.84vh | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3.footer.metadata` | 46.4vw | 3.07vh | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3.body.detail1` | 46.4vw | 6.53vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Choice summary |
| `WC3.body.detail2` | 46.4vw | 6.53vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Current selection / eligibility |
| `WC3.body.blocker` | 46.4vw | 2.3vh | WC3.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3.selection.outline` | 48vw | 38.4vh | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3.selection.info` | 4vw | 4vh | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC0
REQUIRED PROPOSED TAGS: card-kind:creationChoice
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC3
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC3.body.detail1 ← registered provider for Choice summary
    WC3.body.detail2 ← registered provider for Current selection / eligibility
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Choose") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Draft choice only; never commits a new run directly.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC3a: Class card

**Parent: WC3.** Selecting updates the draft preview through existing character-creation rules.

**Construction tags (proposed):** `choice-kind:class`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Class identity / role          │
│ Starting stats / abilities     │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3a.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3a.header` | 16vw | 4.096vh | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3a.header.title` | 9.36vw | 4.096vh | WC3a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3a.header.state` | 4.32vw | 4.096vh | WC3a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3a.art` | 16vw | 16.384vh | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3a.art.tags` | 14.4vw | 3.2768vh | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3a.body` | 16vw | 16.384vh | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3a.footer` | 16vw | 4.096vh | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3a.footer.metadata` | 14.4vw | 3.28vh | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3a.body.detail1` | 14.4vw | 6.96vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Class identity / role |
| `WC3a.body.detail2` | 14.4vw | 6.96vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting stats / abilities |
| `WC3a.body.blocker` | 14.4vw | 2.46vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3a.selection.outline` | 16vw | 40.96vh | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3a.selection.info` | 4vw | 4vh | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Class identity / role      │
│ Starting stats / abilities │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3a.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3a.header` | 24vw | 4.800000000000001vh | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3a.header.title` | 14.56vw | 4.800000000000001vh | WC3a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3a.header.state` | 6.72vw | 4.800000000000001vh | WC3a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3a.art` | 24vw | 19.200000000000003vh | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3a.art.tags` | 22.4vw | 3.84vh | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3a.body` | 24vw | 19.200000000000003vh | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3a.footer` | 24vw | 4.800000000000001vh | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3a.footer.metadata` | 22.4vw | 3.84vh | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3a.body.detail1` | 22.4vw | 8.16vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Class identity / role |
| `WC3a.body.detail2` | 22.4vw | 8.16vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting stats / abilities |
| `WC3a.body.blocker` | 22.4vw | 2.88vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3a.selection.outline` | 24vw | 48vh | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3a.selection.info` | 4vw | 4vh | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Class identity / role    │
│ Starting stats /         │
│ abilities                │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3a.header` | 48vw | 3.84vh | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3a.header.title` | 30.16vw | 3.84vh | WC3a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3a.header.state` | 13.92vw | 3.84vh | WC3a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3a.art` | 48vw | 15.36vh | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3a.art.tags` | 46.4vw | 3.072vh | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3a.body` | 48vw | 15.36vh | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3a.footer` | 48vw | 3.84vh | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3a.footer.metadata` | 46.4vw | 3.07vh | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3a.body.detail1` | 46.4vw | 6.53vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Class identity / role |
| `WC3a.body.detail2` | 46.4vw | 6.53vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting stats / abilities |
| `WC3a.body.blocker` | 46.4vw | 2.3vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3a.selection.outline` | 48vw | 38.4vh | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3a.selection.info` | 4vw | 4vh | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Class identity / role    │
│ Starting stats /         │
│ abilities                │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3a.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3a.header` | 48vw | 3.84vh | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3a.header.title` | 30.16vw | 3.84vh | WC3a.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3a.header.state` | 13.92vw | 3.84vh | WC3a.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3a.art` | 48vw | 15.36vh | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3a.art.tags` | 46.4vw | 3.072vh | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3a.body` | 48vw | 15.36vh | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3a.footer` | 48vw | 3.84vh | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3a.footer.metadata` | 46.4vw | 3.07vh | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3a.body.detail1` | 46.4vw | 6.53vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Class identity / role |
| `WC3a.body.detail2` | 46.4vw | 6.53vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting stats / abilities |
| `WC3a.body.blocker` | 46.4vw | 2.3vh | WC3a.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3a.selection.outline` | 48vw | 38.4vh | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3a.selection.info` | 4vw | 4vh | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC3
REQUIRED PROPOSED TAGS: choice-kind:class
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC3a
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC3a.body.detail1 ← registered provider for Class identity / role
    WC3a.body.detail2 ← registered provider for Starting stats / abilities
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Choose class") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Selecting updates the draft preview through existing character-creation rules.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC3b: Starting-kit card

**Parent: WC3.** Preserve class eligibility and existing kit definitions; do not duplicate grants into the card model source.

**Construction tags (proposed):** `choice-kind:startingKit`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)                
┌────────────────────────────────┐
│ {Name}            {Cost/state} │
├────────────────────────────────┤
│                                │
│ [Art / portrait]               │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Starting equipment             │
│ Granted playing cards          │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3b.frame` | 16vw | 40.96vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3b.header` | 16vw | 4.096vh | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3b.header.title` | 9.36vw | 4.096vh | WC3b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3b.header.state` | 4.32vw | 4.096vh | WC3b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3b.art` | 16vw | 16.384vh | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3b.art.tags` | 14.4vw | 3.2768vh | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3b.body` | 16vw | 16.384vh | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3b.footer` | 16vw | 4.096vh | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3b.footer.metadata` | 14.4vw | 3.28vh | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3b.body.detail1` | 14.4vw | 6.96vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting equipment |
| `WC3b.body.detail2` | 14.4vw | 6.96vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted playing cards |
| `WC3b.body.blocker` | 14.4vw | 2.46vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3b.selection.outline` | 16vw | 40.96vh | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3b.selection.info` | 4vw | 4vh | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Compact**

```text
             (i)              
┌────────────────────────────┐
│ {Name}        {Cost/state} │
├────────────────────────────┤
│                            │
│ [Art / portrait]           │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Starting equipment         │
│ Granted playing cards      │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3b.frame` | 24vw | 48vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3b.header` | 24vw | 4.800000000000001vh | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3b.header.title` | 14.56vw | 4.800000000000001vh | WC3b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3b.header.state` | 6.72vw | 4.800000000000001vh | WC3b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3b.art` | 24vw | 19.200000000000003vh | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3b.art.tags` | 22.4vw | 3.84vh | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3b.body` | 24vw | 19.200000000000003vh | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3b.footer` | 24vw | 4.800000000000001vh | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3b.footer.metadata` | 22.4vw | 3.84vh | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3b.body.detail1` | 22.4vw | 8.16vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting equipment |
| `WC3b.body.detail2` | 22.4vw | 8.16vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted playing cards |
| `WC3b.body.blocker` | 22.4vw | 2.88vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3b.selection.outline` | 24vw | 48vh | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3b.selection.info` | 4vw | 4vh | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Starting equipment       │
│ Granted playing cards    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3b.header` | 48vw | 3.84vh | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3b.header.title` | 30.16vw | 3.84vh | WC3b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3b.header.state` | 13.92vw | 3.84vh | WC3b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3b.art` | 48vw | 15.36vh | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3b.art.tags` | 46.4vw | 3.072vh | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3b.body` | 48vw | 15.36vh | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3b.footer` | 48vw | 3.84vh | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3b.footer.metadata` | 46.4vw | 3.07vh | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3b.body.detail1` | 46.4vw | 6.53vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting equipment |
| `WC3b.body.detail2` | 46.4vw | 6.53vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted playing cards |
| `WC3b.body.blocker` | 46.4vw | 2.3vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3b.selection.outline` | 48vw | 38.4vh | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3b.selection.info` | 4vw | 4vh | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)             
┌──────────────────────────┐
│ {Name}      {Cost/state} │
├──────────────────────────┤
│                          │
│ [Art / portrait]         │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Starting equipment       │
│ Granted playing cards    │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---:|---:|---|---|---|---|---|---|
| `WC3b.frame` | 48vw | 38.4vh | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Nominal card host allocation |
| `WC3b.header` | 48vw | 3.84vh | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Title and optional cost/state; no duplicate title |
| `WC3b.header.title` | 30.16vw | 3.84vh | WC3b.header | top-left | start / center | normal grid flow | 0.8vw from left; vertically centered in header | Top-left |
| `WC3b.header.state` | 13.92vw | 3.84vh | WC3b.header | top-right | end / center | normal grid flow | 0.8vw from right; vertically centered in header | Top-right if applicable |
| `WC3b.art` | 48vw | 15.36vh | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Aspect-preserving art well |
| `WC3b.art.tags` | 46.4vw | 3.072vh | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | 0.8vw horizontal inset; no extra band height | Bottom of art band; nested inside art 40%, meaningful tags only |
| `WC3b.body` | 48vw | 15.36vh | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes inner spacing and blocker |
| `WC3b.footer` | 48vw | 3.84vh | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Supplementary metadata only; no embedded action |
| `WC3b.footer.metadata` | 46.4vw | 3.07vh | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | 0.8vw side inset; vertically centered in footer | Rarity left; owned count right when relevant; no embedded command |
| `WC3b.body.detail1` | 46.4vw | 6.53vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Starting equipment |
| `WC3b.body.detail2` | 46.4vw | 6.53vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Granted playing cards |
| `WC3b.body.blocker` | 46.4vw | 2.3vh | WC3b.body | next row, top to bottom | start / start | normal grid flow | 0.8vw horizontal inset; rows share body budget | Shares body budget; omit and reclaim space when absent |
| `WC3b.selection.outline` | 48vw | 38.4vh | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Overlay follows lifted card perimeter; does not consume band height |
| `WC3b.selection.info` | 4vw | 4vh | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | External centered info button; minimum target size overrides nominal size |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, instanceSnapshot, context
PARENT: WC3
REQUIRED PROPOSED TAGS: choice-kind:startingKit
model = WC0.ConstructCard(entityRef, instanceSnapshot, context)
REQUIRE compiled family ancestry includes WC3b
// Selection is determined by validated tag rules, not a renderer switch.
AttachFromMatchedRules:
    WC3b.body.detail1 ← registered provider for Starting equipment
    WC3b.body.detail2 ← registered provider for Granted playing cards
InheritParentIdentityArtBadgesPaletteFocusAndActionBehavior()
ResolveFamilyBandOverride(); InheritSelectionAndDelayedInfoInspector()
IF combatant: FilterActiveComponentsThenOrder(HP, resources, buildup, stance, icons)
IF combatant: LimitToFiveRows(); MoveOverflowBuildupIntoIcons(); ReserveFinalPlusNIfNeeded()
IF combatant: ApplyRoleIntentVisibilityAndFacingAnchors(); GlowWholeSelectedAssembly()
owningHost.primaryAction = AvailableContextIntent("Choose kit") OR absent
RenderThroughSharedWC0(model)
ON activation: DelegateToOwningPresenterAndExistingDomainCommand()
ON unavailable: ShowReasonWithoutOfferingAnInvalidCommit()
ON tag/state/context change: ReprojectMatchedSlotsWithoutChangingEntity()
Preserve class eligibility and existing kit definitions; do not duplicate grants into the card model source.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC4: Combatant card

**Parent: WC0.** Borderless combatant presentation: sprite remaining (85% with HP only), resource bars 5% each, statuses 10% of component height; overrides WC0 item-card bands. Three sizes are host presentation variants, never different combatant models. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. See CURRENT-SPECIFICATION.md.

**Construction tags (proposed):** `card-kind:combatant`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Compact**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: combatant snapshot, player knowledge, role, presentation config, host size
PARENT: WC4 (WC4 inherits WC0 identity and interactions, NOT item-card geometry)
ResolveSizeVariant(WC4); derive height from clamped width, preserve art ratio
intentVisible = domain.intentActive AND config.intentVisibleForRole(role)
// Defaults: player=config.combatant.playerIntentVisible, enemy=config.combatant.enemyIntentVisible; explicit presentation override permitted.
blockVisible = domain.blockActive
resourceRows = ProjectActiveResourceProviders(snapshot)
buildupRows = ProjectActiveBuildupProviders(snapshot)
stance = ProjectActiveStanceOrAbsent(snapshot)
statusIcons = ProjectActiveStatusIcons(snapshot)
ReserveHP(); remainingRows = config.combatant.maxStackRows - HP - present(stance) - present(statusIcons OR buildupRows)
ChooseOptionalBarsByConfiguredPriority(resourceRows, buildupRows, remainingRows)
ConvertExcessBuildupToProgressIcons(); retain stable IDs
ComposeActiveRowsInOrder(HP, resources, buildup, stance, icons)
CollapseAbsentRowsAndGaps(); sprite receives remaining height
SetOtherResourceAndBuildupHeight(config.combatant.extraBarHeightRatio * hpHeight); SetStanceHeight(hpHeight)
UseFullBarWidthForStance(); UseSharedGap(config.combatant.stackGapRem)
FitSquareIcons(config.combatant.iconSizeRem); reserve last tile for +N hidden icons if overflow
AnchorNameAboveHP(); IntentAboveSprite(); InfoAboveIntentOrSprite()
AnchorDefenseAtSpriteRatio(config.combatant.defenseOffsetRatio, gap=config.combatant.defenseGapRem, player=right, enemy=left)
MirrorArtworkForFacingOnly(); auraBehindAndBuffAboveSpanFullSpriteHeight()
On selected: glow whole visible assembly; reveal info after config.interaction.inspectDelayMs
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4a: Compact combatant

**Parent: WC4.** Compact: clamp(10rem, 14vw, 12rem) width; height = width × 8/5. Supplementary full details through inspection. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. See CURRENT-SPECIFICATION.md.

**Construction tags (proposed):** `card-kind:combatant`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4a.frame | 12rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4a.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4a.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4a.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4a.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Compact**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4a.frame | 12rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4a.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4a.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4a.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4a.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4a.frame | 12rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4a.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4a.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4a.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4a.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4a.frame | 12rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4a.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4a.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4a.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4a.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: combatant snapshot, player knowledge, role, presentation config, host size
PARENT: WC4 (WC4 inherits WC0 identity and interactions, NOT item-card geometry)
ResolveSizeVariant(WC4a); derive height from clamped width, preserve art ratio
intentVisible = domain.intentActive AND config.intentVisibleForRole(role)
// Defaults: player=config.combatant.playerIntentVisible, enemy=config.combatant.enemyIntentVisible; explicit presentation override permitted.
blockVisible = domain.blockActive
resourceRows = ProjectActiveResourceProviders(snapshot)
buildupRows = ProjectActiveBuildupProviders(snapshot)
stance = ProjectActiveStanceOrAbsent(snapshot)
statusIcons = ProjectActiveStatusIcons(snapshot)
ReserveHP(); remainingRows = config.combatant.maxStackRows - HP - present(stance) - present(statusIcons OR buildupRows)
ChooseOptionalBarsByConfiguredPriority(resourceRows, buildupRows, remainingRows)
ConvertExcessBuildupToProgressIcons(); retain stable IDs
ComposeActiveRowsInOrder(HP, resources, buildup, stance, icons)
CollapseAbsentRowsAndGaps(); sprite receives remaining height
SetOtherResourceAndBuildupHeight(config.combatant.extraBarHeightRatio * hpHeight); SetStanceHeight(hpHeight)
UseFullBarWidthForStance(); UseSharedGap(config.combatant.stackGapRem)
FitSquareIcons(config.combatant.iconSizeRem); reserve last tile for +N hidden icons if overflow
AnchorNameAboveHP(); IntentAboveSprite(); InfoAboveIntentOrSprite()
AnchorDefenseAtSpriteRatio(config.combatant.defenseOffsetRatio, gap=config.combatant.defenseGapRem, player=right, enemy=left)
MirrorArtworkForFacingOnly(); auraBehindAndBuffAboveSpanFullSpriteHeight()
On selected: glow whole visible assembly; reveal info after config.interaction.inspectDelayMs
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4b: Standard combatant

**Parent: WC4.** Standard: clamp(12rem, 18vw, 16rem) width; height = width × 8/5. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. See CURRENT-SPECIFICATION.md.

**Construction tags (proposed):** `card-kind:combatant`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4b.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4b.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4b.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4b.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4b.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Compact**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4b.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4b.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4b.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4b.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4b.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4b.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4b.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4b.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4b.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4b.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4b.frame | 16rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4b.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4b.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4b.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4b.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: combatant snapshot, player knowledge, role, presentation config, host size
PARENT: WC4 (WC4 inherits WC0 identity and interactions, NOT item-card geometry)
ResolveSizeVariant(WC4b); derive height from clamped width, preserve art ratio
intentVisible = domain.intentActive AND config.intentVisibleForRole(role)
// Defaults: player=config.combatant.playerIntentVisible, enemy=config.combatant.enemyIntentVisible; explicit presentation override permitted.
blockVisible = domain.blockActive
resourceRows = ProjectActiveResourceProviders(snapshot)
buildupRows = ProjectActiveBuildupProviders(snapshot)
stance = ProjectActiveStanceOrAbsent(snapshot)
statusIcons = ProjectActiveStatusIcons(snapshot)
ReserveHP(); remainingRows = config.combatant.maxStackRows - HP - present(stance) - present(statusIcons OR buildupRows)
ChooseOptionalBarsByConfiguredPriority(resourceRows, buildupRows, remainingRows)
ConvertExcessBuildupToProgressIcons(); retain stable IDs
ComposeActiveRowsInOrder(HP, resources, buildup, stance, icons)
CollapseAbsentRowsAndGaps(); sprite receives remaining height
SetOtherResourceAndBuildupHeight(config.combatant.extraBarHeightRatio * hpHeight); SetStanceHeight(hpHeight)
UseFullBarWidthForStance(); UseSharedGap(config.combatant.stackGapRem)
FitSquareIcons(config.combatant.iconSizeRem); reserve last tile for +N hidden icons if overflow
AnchorNameAboveHP(); IntentAboveSprite(); InfoAboveIntentOrSprite()
AnchorDefenseAtSpriteRatio(config.combatant.defenseOffsetRatio, gap=config.combatant.defenseGapRem, player=right, enemy=left)
MirrorArtworkForFacingOnly(); auraBehindAndBuffAboveSpanFullSpriteHeight()
On selected: glow whole visible assembly; reveal info after config.interaction.inspectDelayMs
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4c: Expanded combatant

**Parent: WC4.** Expanded: clamp(16rem, 24vw, 20rem) width; height = width × 8/5. No new gameplay facts implied. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. See CURRENT-SPECIFICATION.md.

**Construction tags (proposed):** `card-kind:combatant`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4c.frame | 20rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4c.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4c.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4c.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4c.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Compact**

```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4c.frame | 20rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4c.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4c.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4c.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4c.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4c.frame | 20rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4c.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4c.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4c.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4c.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        [INTENT: ATTACK]
     {Aura behind sprite}
       [Combatant sprite]
      {Buff overlay}
    [DEFENSE at sprite 50%]
       {Combatant name}

       Sprite: remaining H

     [HP =================] 5% H
     [Resource ===========] 5% H each
     [Buildup ============]
     [ Stance             ]
       [◆] [☠] [✚]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WC4c.frame | 20rem max; host-clamped | derived from shared combatant envelope | battlefield slot | bottom-center | center / end | normal flow | shared stage baseline | transparent; no border or item-card furniture |
| WC4c.name | 100% component | auto; readable line | frame | sprite bottom-center, above HP | center / center | inside sprite bottom; reserve text room | 0.2rem gap | entity display name; reserve host headroom |
| WC4c.intent | content-fit | readable line | frame | above sprite, below info | center / center | leading slot | shared gap | existing announced intent; tooltip; player hidden/enemy visible by configurable default |
| WC4c.aura | sprite bounds | sprite bounds | sprite | center | center / center | behind sprite layer | 0 | decorative, no pointer capture |
| WC4c.buffLayer | sprite width minus shared horizontal inset | 100% sprite height | sprite | center | center / center | foreground effect layer | 0 | decorative; semantic buff remains in status model |
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | right-center at 50% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | 0.35rem gap | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | 0.21rem gap | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | 0.35rem gap | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. Nominal 40vh envelope: one bar gives sprite34vh / bars2vh / statuses4vh; two bars gives sprite32vh / bars4vh / statuses4vh. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: combatant snapshot, player knowledge, role, presentation config, host size
PARENT: WC4 (WC4 inherits WC0 identity and interactions, NOT item-card geometry)
ResolveSizeVariant(WC4c); derive height from clamped width, preserve art ratio
intentVisible = domain.intentActive AND config.intentVisibleForRole(role)
// Defaults: player=config.combatant.playerIntentVisible, enemy=config.combatant.enemyIntentVisible; explicit presentation override permitted.
blockVisible = domain.blockActive
resourceRows = ProjectActiveResourceProviders(snapshot)
buildupRows = ProjectActiveBuildupProviders(snapshot)
stance = ProjectActiveStanceOrAbsent(snapshot)
statusIcons = ProjectActiveStatusIcons(snapshot)
ReserveHP(); remainingRows = config.combatant.maxStackRows - HP - present(stance) - present(statusIcons OR buildupRows)
ChooseOptionalBarsByConfiguredPriority(resourceRows, buildupRows, remainingRows)
ConvertExcessBuildupToProgressIcons(); retain stable IDs
ComposeActiveRowsInOrder(HP, resources, buildup, stance, icons)
CollapseAbsentRowsAndGaps(); sprite receives remaining height
SetOtherResourceAndBuildupHeight(config.combatant.extraBarHeightRatio * hpHeight); SetStanceHeight(hpHeight)
UseFullBarWidthForStance(); UseSharedGap(config.combatant.stackGapRem)
FitSquareIcons(config.combatant.iconSizeRem); reserve last tile for +N hidden icons if overflow
AnchorNameAboveHP(); IntentAboveSprite(); InfoAboveIntentOrSprite()
AnchorDefenseAtSpriteRatio(config.combatant.defenseOffsetRatio, gap=config.combatant.defenseGapRem, player=right, enemy=left)
MirrorArtworkForFacingOnly(); auraBehindAndBuffAboveSpanFullSpriteHeight()
On selected: glow whole visible assembly; reveal info after config.interaction.inspectDelayMs
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

## Verification

Validate all three modes, inherited construction, multi-tag combinations, missing/unknown tags, optional components, state transitions, scoped entity IDs, readable artwork/text, inline actions and minimum targets. Adding a supported item/class/relic variation should require only normalized data/tag rows, with no new renderer branch. New behavior requires a registered tested primitive first.
