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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC0.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC0.header | 100% card width | config.cards.geometry.bands.header% of card height | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC0.header.title | remaining header width | 100% header height | WC0.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC0.header.state | content-fit | 100% header height | WC0.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC0.art | 100% card width | config.cards.geometry.bands.art% of card height | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC0.art.tags | available art width minus shared inset | content-fit within art band | WC0.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC0.body | 100% card width | config.cards.geometry.bands.body% of card height | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC0.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC0.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC0.body.detail1 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Registered content slots} |
| WC0.body.detail2 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Availability / reason} |
| WC0.body.blocker | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC0.selection.outline | 100% card width | 100% card height | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC0.selection.info | config.components.target.minRem | config.components.target.minRem | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC0.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC0.header | 100% card width | config.cards.geometry.bands.header% of card height | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC0.header.title | remaining header width | 100% header height | WC0.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC0.header.state | content-fit | 100% header height | WC0.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC0.art | 100% card width | config.cards.geometry.bands.art% of card height | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC0.art.tags | available art width minus shared inset | content-fit within art band | WC0.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC0.body | 100% card width | config.cards.geometry.bands.body% of card height | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC0.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC0.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC0.body.detail1 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Registered content slots} |
| WC0.body.detail2 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Availability / reason} |
| WC0.body.blocker | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC0.selection.outline | 100% card width | 100% card height | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC0.selection.info | config.components.target.minRem | config.components.target.minRem | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC0.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC0.header | 100% card width | config.cards.geometry.bands.header% of card height | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC0.header.title | remaining header width | 100% header height | WC0.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC0.header.state | content-fit | 100% header height | WC0.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC0.art | 100% card width | config.cards.geometry.bands.art% of card height | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC0.art.tags | available art width minus shared inset | content-fit within art band | WC0.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC0.body | 100% card width | config.cards.geometry.bands.body% of card height | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC0.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC0.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC0.body.detail1 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Registered content slots} |
| WC0.body.detail2 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Availability / reason} |
| WC0.body.blocker | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC0.selection.outline | 100% card width | 100% card height | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC0.selection.info | config.components.target.minRem | config.components.target.minRem | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC0.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC0.header | 100% card width | config.cards.geometry.bands.header% of card height | WC0.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC0.header.title | remaining header width | 100% header height | WC0.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC0.header.state | content-fit | 100% header height | WC0.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC0.art | 100% card width | config.cards.geometry.bands.art% of card height | WC0.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC0.art.tags | available art width minus shared inset | content-fit within art band | WC0.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC0.body | 100% card width | config.cards.geometry.bands.body% of card height | WC0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC0.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC0.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC0.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC0.body.detail1 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Registered content slots} |
| WC0.body.detail2 | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | {Availability / reason} |
| WC0.body.blocker | 100% usable body width | content-fit within body band | WC0.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC0.selection.outline | 100% card width | 100% card height | WC0.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC0.selection.info | config.components.target.minRem | config.components.target.minRem | WC0.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
    // Read the authoritative cost projection; variable action cost uses the configured X label.
    model.costs = ProjectRegisteredCostProfile(stateFacts, definition)
    costRows = FilterAndOrderProjectedCosts(model.costs, config.cards.costs.order, config.cards.costs.providers)
    RenderCompactLeftCostRail(costRows, config.cards.costs, top=ResolveHeaderBandHeight(config.cards.geometry) + ResolveInset(config.cards.costs.insetRem)) // Anchor below header inside art; render outlined icon and number only, no box/background.
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
        IF cardKind is not combatant: owningHost.ShowApplicableContextAction(); HighlightDomainEligibleTargets()
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

**Parent: WC0.** Inherits card identity/art/tags; adds a compact left-edge cost stack below the header inside the art containing every projected action/stamina/MP cost, followed by targeting and effect components. Costs come from playingCardModel.costs in src/model/playingCard.js; renderer does not calculate or invent costs.

**Construction tags (proposed):** `card-kind:playing`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)
┌────────────────────────────────┐
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
│ {Meaningful tag badges}        │
├────────────────────────────────┤
│ Targeting                      │
│ Effects / rules                │
│ {Blocker if needed}            │
├────────────────────────────────┤
│ [   Rarity       Owned: n    ] │
└────────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---|---|---|---|---|---|---|---|
| WC1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1.header.title | remaining header width | 100% header height | WC1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1.header.state | content-fit | 100% header height | WC1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1.art.tags | available art width minus shared inset | content-fit within art band | WC1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1.body.detail1 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Targeting |
| WC1.body.detail2 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effects / rules |
| WC1.body.blocker | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1.selection.outline | 100% card width | 100% card height | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1.selection.info | config.components.target.minRem | config.components.target.minRem | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
│ {Meaningful tag badges}    │
├────────────────────────────┤
│ Targeting                  │
│ Effects / rules            │
│ {Blocker if needed}        │
├────────────────────────────┤
│ [ Rarity       Owned: n  ] │
└────────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---|---|---|---|---|---|---|---|
| WC1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1.header.title | remaining header width | 100% header height | WC1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1.header.state | content-fit | 100% header height | WC1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1.art.tags | available art width minus shared inset | content-fit within art band | WC1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1.body.detail1 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Targeting |
| WC1.body.detail2 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effects / rules |
| WC1.body.blocker | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1.selection.outline | 100% card width | 100% card height | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1.selection.info | config.components.target.minRem | config.components.target.minRem | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Targeting                │
│ Effects / rules          │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---|---|---|---|---|---|---|---|
| WC1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1.header.title | remaining header width | 100% header height | WC1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1.header.state | content-fit | 100% header height | WC1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1.art.tags | available art width minus shared inset | content-fit within art band | WC1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1.body.detail1 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Targeting |
| WC1.body.detail2 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effects / rules |
| WC1.body.blocker | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1.selection.outline | 100% card width | 100% card height | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1.selection.info | config.components.target.minRem | config.components.target.minRem | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
│ {Meaningful tag badges}  │
├──────────────────────────┤
│ Targeting                │
│ Effects / rules          │
│ {Blocker if needed}      │
├──────────────────────────┤
│ [Rarity       Owned: n ] │
└──────────────────────────┘
```

| Component ID | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Content / ownership |
|---|---|---|---|---|---|---|---|---|
| WC1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1.header.title | remaining header width | 100% header height | WC1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1.header.state | content-fit | 100% header height | WC1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1.art.tags | available art width minus shared inset | content-fit within art band | WC1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1.body.detail1 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Targeting |
| WC1.body.detail2 | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effects / rules |
| WC1.body.blocker | 100% usable body width | content-fit within body band | WC1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1.selection.outline | 100% card width | 100% card height | WC1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1.selection.info | config.components.target.minRem | config.components.target.minRem | WC1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
    WC1.body.detail1 ← registered provider for Targeting
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
Inherits card identity/art/tags; adds a compact left-edge cost stack below the header inside the art containing every projected action/stamina/MP cost, followed by targeting and effect components. Costs come from playingCardModel.costs in src/model/playingCard.js; renderer does not calculate or invent costs.
Reuse the same model in wide/compact/portrait; host layout supplies dimensions.
```

### Wireframe WC1a: Attack card

**Parent: WC1.** Use engine damage preview, including current modifiers; never calculate damage in renderer.

**Construction tags (proposed):** `ability:attack`. Inherit ancestor tag requirements; compatible feature tags attach additional components.

**Wide**

```text
               (i)
┌────────────────────────────────┐
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
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
|---|---|---|---|---|---|---|---|---|
| WC1a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1a.header.title | remaining header width | 100% header height | WC1a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1a.header.state | content-fit | 100% header height | WC1a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1a.art.tags | available art width minus shared inset | content-fit within art band | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1a.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1a.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1a.body.detail1 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / affected stat |
| WC1a.body.detail2 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target and effect preview |
| WC1a.body.blocker | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1a.selection.outline | 100% card width | 100% card height | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1a.selection.info | config.components.target.minRem | config.components.target.minRem | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
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
|---|---|---|---|---|---|---|---|---|
| WC1a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1a.header.title | remaining header width | 100% header height | WC1a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1a.header.state | content-fit | 100% header height | WC1a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1a.art.tags | available art width minus shared inset | content-fit within art band | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1a.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1a.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1a.body.detail1 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / affected stat |
| WC1a.body.detail2 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target and effect preview |
| WC1a.body.blocker | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1a.selection.outline | 100% card width | 100% card height | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1a.selection.info | config.components.target.minRem | config.components.target.minRem | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1a.header.title | remaining header width | 100% header height | WC1a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1a.header.state | content-fit | 100% header height | WC1a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1a.art.tags | available art width minus shared inset | content-fit within art band | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1a.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1a.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1a.body.detail1 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / affected stat |
| WC1a.body.detail2 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target and effect preview |
| WC1a.body.blocker | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1a.selection.outline | 100% card width | 100% card height | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1a.selection.info | config.components.target.minRem | config.components.target.minRem | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1a.header.title | remaining header width | 100% header height | WC1a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1a.header.state | content-fit | 100% header height | WC1a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1a.art.tags | available art width minus shared inset | content-fit within art band | WC1a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1a.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1a.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1a.body.detail1 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / affected stat |
| WC1a.body.detail2 | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target and effect preview |
| WC1a.body.blocker | 100% usable body width | content-fit within body band | WC1a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1a.selection.outline | 100% card width | 100% card height | WC1a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1a.selection.info | config.components.target.minRem | config.components.target.minRem | WC1a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
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
|---|---|---|---|---|---|---|---|---|
| WC1b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1b.header.title | remaining header width | 100% header height | WC1b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1b.header.state | content-fit | 100% header height | WC1b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1b.art.tags | available art width minus shared inset | content-fit within art band | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1b.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1b.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1b.body.detail1 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / utility effects |
| WC1b.body.detail2 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target / requirements |
| WC1b.body.blocker | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1b.selection.outline | 100% card width | 100% card height | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1b.selection.info | config.components.target.minRem | config.components.target.minRem | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
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
|---|---|---|---|---|---|---|---|---|
| WC1b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1b.header.title | remaining header width | 100% header height | WC1b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1b.header.state | content-fit | 100% header height | WC1b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1b.art.tags | available art width minus shared inset | content-fit within art band | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1b.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1b.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1b.body.detail1 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / utility effects |
| WC1b.body.detail2 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target / requirements |
| WC1b.body.blocker | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1b.selection.outline | 100% card width | 100% card height | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1b.selection.info | config.components.target.minRem | config.components.target.minRem | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1b.header.title | remaining header width | 100% header height | WC1b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1b.header.state | content-fit | 100% header height | WC1b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1b.art.tags | available art width minus shared inset | content-fit within art band | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1b.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1b.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1b.body.detail1 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / utility effects |
| WC1b.body.detail2 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target / requirements |
| WC1b.body.blocker | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1b.selection.outline | 100% card width | 100% card height | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1b.selection.info | config.components.target.minRem | config.components.target.minRem | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1b.header.title | remaining header width | 100% header height | WC1b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1b.header.state | content-fit | 100% header height | WC1b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1b.art.tags | available art width minus shared inset | content-fit within art band | WC1b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1b.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1b.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1b.body.detail1 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / utility effects |
| WC1b.body.detail2 | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Target / requirements |
| WC1b.body.blocker | 100% usable body width | content-fit within body band | WC1b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1b.selection.outline | 100% card width | 100% card height | WC1b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1b.selection.info | config.components.target.minRem | config.components.target.minRem | WC1b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
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
|---|---|---|---|---|---|---|---|---|
| WC1c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1c.header.title | remaining header width | 100% header height | WC1c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1c.header.state | content-fit | 100% header height | WC1c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1c.art.tags | available art width minus shared inset | content-fit within art band | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1c.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1c.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1c.body.detail1 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Persistent effect |
| WC1c.body.detail2 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger / duration |
| WC1c.body.blocker | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1c.selection.outline | 100% card width | 100% card height | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1c.selection.info | config.components.target.minRem | config.components.target.minRem | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
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
|---|---|---|---|---|---|---|---|---|
| WC1c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1c.header.title | remaining header width | 100% header height | WC1c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1c.header.state | content-fit | 100% header height | WC1c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1c.art.tags | available art width minus shared inset | content-fit within art band | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1c.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1c.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1c.body.detail1 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Persistent effect |
| WC1c.body.detail2 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger / duration |
| WC1c.body.blocker | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1c.selection.outline | 100% card width | 100% card height | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1c.selection.info | config.components.target.minRem | config.components.target.minRem | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1c.header.title | remaining header width | 100% header height | WC1c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1c.header.state | content-fit | 100% header height | WC1c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1c.art.tags | available art width minus shared inset | content-fit within art band | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1c.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1c.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1c.body.detail1 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Persistent effect |
| WC1c.body.detail2 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger / duration |
| WC1c.body.blocker | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1c.selection.outline | 100% card width | 100% card height | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1c.selection.info | config.components.target.minRem | config.components.target.minRem | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1c.header.title | remaining header width | 100% header height | WC1c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1c.header.state | content-fit | 100% header height | WC1c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1c.art.tags | available art width minus shared inset | content-fit within art band | WC1c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1c.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1c.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1c.body.detail1 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Persistent effect |
| WC1c.body.detail2 | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger / duration |
| WC1c.body.blocker | 100% usable body width | content-fit within body band | WC1c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1c.selection.outline | 100% card width | 100% card height | WC1c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1c.selection.info | config.components.target.minRem | config.components.target.minRem | WC1c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
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
|---|---|---|---|---|---|---|---|---|
| WC1d.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1d.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1d.header.title | remaining header width | 100% header height | WC1d.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1d.header.state | content-fit | 100% header height | WC1d.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1d.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1d.art.tags | available art width minus shared inset | content-fit within art band | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1d.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1d.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1d.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1d.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1d.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1d.body.detail1 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Penalty / consequence |
| WC1d.body.detail2 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1d.body.blocker | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1d.selection.outline | 100% card width | 100% card height | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1d.selection.info | config.components.target.minRem | config.components.target.minRem | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
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
|---|---|---|---|---|---|---|---|---|
| WC1d.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1d.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1d.header.title | remaining header width | 100% header height | WC1d.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1d.header.state | content-fit | 100% header height | WC1d.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1d.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1d.art.tags | available art width minus shared inset | content-fit within art band | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1d.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1d.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1d.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1d.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1d.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1d.body.detail1 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Penalty / consequence |
| WC1d.body.detail2 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1d.body.blocker | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1d.selection.outline | 100% card width | 100% card height | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1d.selection.info | config.components.target.minRem | config.components.target.minRem | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1d.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1d.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1d.header.title | remaining header width | 100% header height | WC1d.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1d.header.state | content-fit | 100% header height | WC1d.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1d.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1d.art.tags | available art width minus shared inset | content-fit within art band | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1d.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1d.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1d.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1d.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1d.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1d.body.detail1 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Penalty / consequence |
| WC1d.body.detail2 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1d.body.blocker | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1d.selection.outline | 100% card width | 100% card height | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1d.selection.info | config.components.target.minRem | config.components.target.minRem | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1d.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1d.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1d.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1d.header.title | remaining header width | 100% header height | WC1d.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1d.header.state | content-fit | 100% header height | WC1d.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1d.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1d.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1d.art.tags | available art width minus shared inset | content-fit within art band | WC1d.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1d.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1d.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1d.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1d.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1d.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1d.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1d.body.detail1 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Penalty / consequence |
| WC1d.body.detail2 | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1d.body.blocker | 100% usable body width | content-fit within body band | WC1d.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1d.selection.outline | 100% card width | 100% card height | WC1d.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1d.selection.info | config.components.target.minRem | config.components.target.minRem | WC1d.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ ◆ x   [Art / portrait]         │
│ ϟ x   optional stamina         │
│ ♢ x   optional MP              │
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
|---|---|---|---|---|---|---|---|---|
| WC1e.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1e.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1e.header.title | remaining header width | 100% header height | WC1e.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1e.header.state | content-fit | 100% header height | WC1e.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1e.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1e.art.tags | available art width minus shared inset | content-fit within art band | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1e.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1e.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1e.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1e.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1e.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1e.body.detail1 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Status effect / duration |
| WC1e.body.detail2 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1e.body.blocker | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1e.selection.outline | 100% card width | 100% card height | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1e.selection.info | config.components.target.minRem | config.components.target.minRem | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ ◆ x   [Art / portrait]     │
│ ϟ x   optional stamina     │
│ ♢ x   optional MP          │
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
|---|---|---|---|---|---|---|---|---|
| WC1e.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1e.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1e.header.title | remaining header width | 100% header height | WC1e.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1e.header.state | content-fit | 100% header height | WC1e.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1e.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1e.art.tags | available art width minus shared inset | content-fit within art band | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1e.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1e.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1e.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1e.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1e.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1e.body.detail1 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Status effect / duration |
| WC1e.body.detail2 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1e.body.blocker | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1e.selection.outline | 100% card width | 100% card height | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1e.selection.info | config.components.target.minRem | config.components.target.minRem | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1e.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1e.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1e.header.title | remaining header width | 100% header height | WC1e.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1e.header.state | content-fit | 100% header height | WC1e.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1e.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1e.art.tags | available art width minus shared inset | content-fit within art band | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1e.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1e.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1e.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1e.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1e.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1e.body.detail1 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Status effect / duration |
| WC1e.body.detail2 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1e.body.blocker | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1e.selection.outline | 100% card width | 100% card height | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1e.selection.info | config.components.target.minRem | config.components.target.minRem | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ ◆ x   [Art / portrait]   │
│ ϟ x   optional stamina   │
│ ♢ x   optional MP        │
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
|---|---|---|---|---|---|---|---|---|
| WC1e.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC1e.header | 100% card width | config.cards.geometry.bands.header% of card height | WC1e.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC1e.header.title | remaining header width | 100% header height | WC1e.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC1e.header.state | content-fit | 100% header height | WC1e.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC1e.art | 100% card width | config.cards.geometry.bands.art% of card height | WC1e.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC1e.art.tags | available art width minus shared inset | content-fit within art band | WC1e.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC1e.body | 100% card width | config.cards.geometry.bands.body% of card height | WC1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC1e.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC1e.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC1e.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC1e.costs | config.cards.costs.railWidthRem | content-fit from active projected costs | WC1e.frame | top-left | start / start | normal grid flow | 0; shared gap between siblings | Art top-left at configured header band plus inset; outlined icon and number only, no boxes; action/stamina/MP stack remains exposed in a fanned hand |
| WC1e.body.detail1 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Status effect / duration |
| WC1e.body.detail2 | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Playability / removal rule |
| WC1e.body.blocker | 100% usable body width | content-fit within body band | WC1e.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC1e.selection.outline | 100% card width | 100% card height | WC1e.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC1e.selection.info | config.components.target.minRem | config.components.target.minRem | WC1e.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2.header.title | remaining header width | 100% header height | WC2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2.header.state | content-fit | 100% header height | WC2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2.art.tags | available art width minus shared inset | content-fit within art band | WC2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2.body.detail1 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Ownership / quantity |
| WC2.body.detail2 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Capabilities / requirements |
| WC2.body.blocker | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2.selection.outline | 100% card width | 100% card height | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2.header.title | remaining header width | 100% header height | WC2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2.header.state | content-fit | 100% header height | WC2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2.art.tags | available art width minus shared inset | content-fit within art band | WC2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2.body.detail1 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Ownership / quantity |
| WC2.body.detail2 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Capabilities / requirements |
| WC2.body.blocker | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2.selection.outline | 100% card width | 100% card height | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2.header.title | remaining header width | 100% header height | WC2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2.header.state | content-fit | 100% header height | WC2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2.art.tags | available art width minus shared inset | content-fit within art band | WC2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2.body.detail1 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Ownership / quantity |
| WC2.body.detail2 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Capabilities / requirements |
| WC2.body.blocker | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2.selection.outline | 100% card width | 100% card height | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2.header.title | remaining header width | 100% header height | WC2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2.header.state | content-fit | 100% header height | WC2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2.art.tags | available art width minus shared inset | content-fit within art band | WC2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2.body.detail1 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Ownership / quantity |
| WC2.body.detail2 | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Capabilities / requirements |
| WC2.body.blocker | 100% usable body width | content-fit within body band | WC2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2.selection.outline | 100% card width | 100% card height | WC2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a.header.title | remaining header width | 100% header height | WC2a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a.header.state | content-fit | 100% header height | WC2a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a.art.tags | available art width minus shared inset | content-fit within art band | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a.body.detail1 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Slot / requirements |
| WC2a.body.detail2 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Equipped comparison |
| WC2a.body.blocker | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a.selection.outline | 100% card width | 100% card height | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a.header.title | remaining header width | 100% header height | WC2a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a.header.state | content-fit | 100% header height | WC2a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a.art.tags | available art width minus shared inset | content-fit within art band | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a.body.detail1 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Slot / requirements |
| WC2a.body.detail2 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Equipped comparison |
| WC2a.body.blocker | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a.selection.outline | 100% card width | 100% card height | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a.header.title | remaining header width | 100% header height | WC2a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a.header.state | content-fit | 100% header height | WC2a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a.art.tags | available art width minus shared inset | content-fit within art band | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a.body.detail1 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Slot / requirements |
| WC2a.body.detail2 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Equipped comparison |
| WC2a.body.blocker | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a.selection.outline | 100% card width | 100% card height | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a.header.title | remaining header width | 100% header height | WC2a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a.header.state | content-fit | 100% header height | WC2a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a.art.tags | available art width minus shared inset | content-fit within art band | WC2a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a.body.detail1 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Slot / requirements |
| WC2a.body.detail2 | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Equipped comparison |
| WC2a.body.blocker | 100% usable body width | content-fit within body band | WC2a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a.selection.outline | 100% card width | 100% card height | WC2a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2a1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a1.header.title | remaining header width | 100% header height | WC2a1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a1.header.state | content-fit | 100% header height | WC2a1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a1.art.tags | available art width minus shared inset | content-fit within art band | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a1.body.detail1 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / scaling |
| WC2a1.body.detail2 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Hand / requirements |
| WC2a1.body.detail3 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted card package |
| WC2a1.body.blocker | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a1.selection.outline | 100% card width | 100% card height | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2a1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a1.header.title | remaining header width | 100% header height | WC2a1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a1.header.state | content-fit | 100% header height | WC2a1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a1.art.tags | available art width minus shared inset | content-fit within art band | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a1.body.detail1 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / scaling |
| WC2a1.body.detail2 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Hand / requirements |
| WC2a1.body.detail3 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted card package |
| WC2a1.body.blocker | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a1.selection.outline | 100% card width | 100% card height | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a1.header.title | remaining header width | 100% header height | WC2a1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a1.header.state | content-fit | 100% header height | WC2a1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a1.art.tags | available art width minus shared inset | content-fit within art band | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a1.body.detail1 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / scaling |
| WC2a1.body.detail2 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Hand / requirements |
| WC2a1.body.detail3 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted card package |
| WC2a1.body.blocker | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a1.selection.outline | 100% card width | 100% card height | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a1.header.title | remaining header width | 100% header height | WC2a1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a1.header.state | content-fit | 100% header height | WC2a1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a1.art.tags | available art width minus shared inset | content-fit within art band | WC2a1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a1.body.detail1 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Damage / scaling |
| WC2a1.body.detail2 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Hand / requirements |
| WC2a1.body.detail3 | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted card package |
| WC2a1.body.blocker | 100% usable body width | content-fit within body band | WC2a1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a1.selection.outline | 100% card width | 100% card height | WC2a1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2a2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a2.header.title | remaining header width | 100% header height | WC2a2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a2.header.state | content-fit | 100% header height | WC2a2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a2.art.tags | available art width minus shared inset | content-fit within art band | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a2.body.detail1 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / resistance |
| WC2a2.body.detail2 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Weight / requirements |
| WC2a2.body.detail3 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted modifiers |
| WC2a2.body.blocker | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a2.selection.outline | 100% card width | 100% card height | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2a2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a2.header.title | remaining header width | 100% header height | WC2a2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a2.header.state | content-fit | 100% header height | WC2a2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a2.art.tags | available art width minus shared inset | content-fit within art band | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a2.body.detail1 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / resistance |
| WC2a2.body.detail2 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Weight / requirements |
| WC2a2.body.detail3 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted modifiers |
| WC2a2.body.blocker | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a2.selection.outline | 100% card width | 100% card height | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a2.header.title | remaining header width | 100% header height | WC2a2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a2.header.state | content-fit | 100% header height | WC2a2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a2.art.tags | available art width minus shared inset | content-fit within art band | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a2.body.detail1 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / resistance |
| WC2a2.body.detail2 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Weight / requirements |
| WC2a2.body.detail3 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted modifiers |
| WC2a2.body.blocker | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a2.selection.outline | 100% card width | 100% card height | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2a2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2a2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2a2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2a2.header.title | remaining header width | 100% header height | WC2a2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2a2.header.state | content-fit | 100% header height | WC2a2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2a2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2a2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2a2.art.tags | available art width minus shared inset | content-fit within art band | WC2a2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2a2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2a2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2a2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2a2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2a2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2a2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2a2.body.detail1 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Defense / resistance |
| WC2a2.body.detail2 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Weight / requirements |
| WC2a2.body.detail3 | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted modifiers |
| WC2a2.body.blocker | 100% usable body width | content-fit within body band | WC2a2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2a2.selection.outline | 100% card width | 100% card height | WC2a2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2a2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2a2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b.header.title | remaining header width | 100% header height | WC2b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b.header.state | content-fit | 100% header height | WC2b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b.art.tags | available art width minus shared inset | content-fit within art band | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b.body.detail1 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Relic effect |
| WC2b.body.detail2 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Acquisition / equip state |
| WC2b.body.blocker | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b.selection.outline | 100% card width | 100% card height | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b.header.title | remaining header width | 100% header height | WC2b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b.header.state | content-fit | 100% header height | WC2b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b.art.tags | available art width minus shared inset | content-fit within art band | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b.body.detail1 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Relic effect |
| WC2b.body.detail2 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Acquisition / equip state |
| WC2b.body.blocker | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b.selection.outline | 100% card width | 100% card height | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b.header.title | remaining header width | 100% header height | WC2b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b.header.state | content-fit | 100% header height | WC2b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b.art.tags | available art width minus shared inset | content-fit within art band | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b.body.detail1 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Relic effect |
| WC2b.body.detail2 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Acquisition / equip state |
| WC2b.body.blocker | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b.selection.outline | 100% card width | 100% card height | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b.header.title | remaining header width | 100% header height | WC2b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b.header.state | content-fit | 100% header height | WC2b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b.art.tags | available art width minus shared inset | content-fit within art band | WC2b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b.body.detail1 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Relic effect |
| WC2b.body.detail2 | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Acquisition / equip state |
| WC2b.body.blocker | 100% usable body width | content-fit within body band | WC2b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b.selection.outline | 100% card width | 100% card height | WC2b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2b1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b1.header.title | remaining header width | 100% header height | WC2b1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b1.header.state | content-fit | 100% header height | WC2b1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b1.art.tags | available art width minus shared inset | content-fit within art band | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b1.body.detail1 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Passive modifiers |
| WC2b1.body.detail2 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Affected resources / stats |
| WC2b1.body.blocker | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b1.selection.outline | 100% card width | 100% card height | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2b1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b1.header.title | remaining header width | 100% header height | WC2b1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b1.header.state | content-fit | 100% header height | WC2b1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b1.art.tags | available art width minus shared inset | content-fit within art band | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b1.body.detail1 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Passive modifiers |
| WC2b1.body.detail2 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Affected resources / stats |
| WC2b1.body.blocker | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b1.selection.outline | 100% card width | 100% card height | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b1.header.title | remaining header width | 100% header height | WC2b1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b1.header.state | content-fit | 100% header height | WC2b1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b1.art.tags | available art width minus shared inset | content-fit within art band | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b1.body.detail1 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Passive modifiers |
| WC2b1.body.detail2 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Affected resources / stats |
| WC2b1.body.blocker | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b1.selection.outline | 100% card width | 100% card height | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b1.header.title | remaining header width | 100% header height | WC2b1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b1.header.state | content-fit | 100% header height | WC2b1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b1.art.tags | available art width minus shared inset | content-fit within art band | WC2b1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b1.body.detail1 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Passive modifiers |
| WC2b1.body.detail2 | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Affected resources / stats |
| WC2b1.body.blocker | 100% usable body width | content-fit within body band | WC2b1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b1.selection.outline | 100% card width | 100% card height | WC2b1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2b2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b2.header.title | remaining header width | 100% header height | WC2b2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b2.header.state | content-fit | 100% header height | WC2b2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b2.art.tags | available art width minus shared inset | content-fit within art band | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b2.body.detail1 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger condition |
| WC2b2.body.detail2 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effect / limit / cooldown |
| WC2b2.body.blocker | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b2.selection.outline | 100% card width | 100% card height | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2b2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b2.header.title | remaining header width | 100% header height | WC2b2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b2.header.state | content-fit | 100% header height | WC2b2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b2.art.tags | available art width minus shared inset | content-fit within art band | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b2.body.detail1 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger condition |
| WC2b2.body.detail2 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effect / limit / cooldown |
| WC2b2.body.blocker | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b2.selection.outline | 100% card width | 100% card height | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b2.header.title | remaining header width | 100% header height | WC2b2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b2.header.state | content-fit | 100% header height | WC2b2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b2.art.tags | available art width minus shared inset | content-fit within art band | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b2.body.detail1 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger condition |
| WC2b2.body.detail2 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effect / limit / cooldown |
| WC2b2.body.blocker | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b2.selection.outline | 100% card width | 100% card height | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2b2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2b2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2b2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2b2.header.title | remaining header width | 100% header height | WC2b2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2b2.header.state | content-fit | 100% header height | WC2b2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2b2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2b2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2b2.art.tags | available art width minus shared inset | content-fit within art band | WC2b2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2b2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2b2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2b2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2b2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2b2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2b2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2b2.body.detail1 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Trigger condition |
| WC2b2.body.detail2 | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Effect / limit / cooldown |
| WC2b2.body.blocker | 100% usable body width | content-fit within body band | WC2b2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2b2.selection.outline | 100% card width | 100% card height | WC2b2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2b2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2b2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c.header.title | remaining header width | 100% header height | WC2c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c.header.state | content-fit | 100% header height | WC2c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c.art.tags | available art width minus shared inset | content-fit within art band | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c.body.detail1 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / quantity |
| WC2c.body.detail2 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Use effect / eligibility |
| WC2c.body.blocker | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c.selection.outline | 100% card width | 100% card height | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c.header.title | remaining header width | 100% header height | WC2c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c.header.state | content-fit | 100% header height | WC2c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c.art.tags | available art width minus shared inset | content-fit within art band | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c.body.detail1 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / quantity |
| WC2c.body.detail2 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Use effect / eligibility |
| WC2c.body.blocker | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c.selection.outline | 100% card width | 100% card height | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c.header.title | remaining header width | 100% header height | WC2c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c.header.state | content-fit | 100% header height | WC2c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c.art.tags | available art width minus shared inset | content-fit within art band | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c.body.detail1 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / quantity |
| WC2c.body.detail2 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Use effect / eligibility |
| WC2c.body.blocker | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c.selection.outline | 100% card width | 100% card height | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c.header.title | remaining header width | 100% header height | WC2c.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c.header.state | content-fit | 100% header height | WC2c.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c.art.tags | available art width minus shared inset | content-fit within art band | WC2c.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c.body.detail1 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / quantity |
| WC2c.body.detail2 | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Use effect / eligibility |
| WC2c.body.blocker | 100% usable body width | content-fit within body band | WC2c.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c.selection.outline | 100% card width | 100% card height | WC2c.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2c1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c1.header.title | remaining header width | 100% header height | WC2c1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c1.header.state | content-fit | 100% header height | WC2c1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c1.art.tags | available art width minus shared inset | content-fit within art band | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c1.body.detail1 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Healing preview |
| WC2c1.body.detail2 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c1.body.blocker | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c1.selection.outline | 100% card width | 100% card height | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2c1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c1.header.title | remaining header width | 100% header height | WC2c1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c1.header.state | content-fit | 100% header height | WC2c1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c1.art.tags | available art width minus shared inset | content-fit within art band | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c1.body.detail1 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Healing preview |
| WC2c1.body.detail2 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c1.body.blocker | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c1.selection.outline | 100% card width | 100% card height | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c1.header.title | remaining header width | 100% header height | WC2c1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c1.header.state | content-fit | 100% header height | WC2c1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c1.art.tags | available art width minus shared inset | content-fit within art band | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c1.body.detail1 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Healing preview |
| WC2c1.body.detail2 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c1.body.blocker | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c1.selection.outline | 100% card width | 100% card height | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c1.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c1.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c1.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c1.header.title | remaining header width | 100% header height | WC2c1.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c1.header.state | content-fit | 100% header height | WC2c1.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c1.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c1.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c1.art.tags | available art width minus shared inset | content-fit within art band | WC2c1.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c1.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c1.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c1.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c1.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c1.body.detail1 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Healing preview |
| WC2c1.body.detail2 | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c1.body.blocker | 100% usable body width | content-fit within body band | WC2c1.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c1.selection.outline | 100% card width | 100% card height | WC2c1.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c1.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c1.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2c2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c2.header.title | remaining header width | 100% header height | WC2c2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c2.header.state | content-fit | 100% header height | WC2c2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c2.art.tags | available art width minus shared inset | content-fit within art band | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c2.body.detail1 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Resource restoration |
| WC2c2.body.detail2 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c2.body.blocker | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c2.selection.outline | 100% card width | 100% card height | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2c2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c2.header.title | remaining header width | 100% header height | WC2c2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c2.header.state | content-fit | 100% header height | WC2c2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c2.art.tags | available art width minus shared inset | content-fit within art band | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c2.body.detail1 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Resource restoration |
| WC2c2.body.detail2 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c2.body.blocker | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c2.selection.outline | 100% card width | 100% card height | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c2.header.title | remaining header width | 100% header height | WC2c2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c2.header.state | content-fit | 100% header height | WC2c2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c2.art.tags | available art width minus shared inset | content-fit within art band | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c2.body.detail1 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Resource restoration |
| WC2c2.body.detail2 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c2.body.blocker | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c2.selection.outline | 100% card width | 100% card height | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c2.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c2.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c2.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c2.header.title | remaining header width | 100% header height | WC2c2.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c2.header.state | content-fit | 100% header height | WC2c2.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c2.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c2.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c2.art.tags | available art width minus shared inset | content-fit within art band | WC2c2.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c2.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c2.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c2.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c2.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c2.body.detail1 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Resource restoration |
| WC2c2.body.detail2 | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Charges / availability |
| WC2c2.body.blocker | 100% usable body width | content-fit within body band | WC2c2.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c2.selection.outline | 100% card width | 100% card height | WC2c2.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c2.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c2.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC2c3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c3.header.title | remaining header width | 100% header height | WC2c3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c3.header.state | content-fit | 100% header height | WC2c3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c3.art.tags | available art width minus shared inset | content-fit within art band | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c3.body.detail1 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Utility effect / target |
| WC2c3.body.detail2 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Quantity / availability |
| WC2c3.body.blocker | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c3.selection.outline | 100% card width | 100% card height | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c3.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC2c3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c3.header.title | remaining header width | 100% header height | WC2c3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c3.header.state | content-fit | 100% header height | WC2c3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c3.art.tags | available art width minus shared inset | content-fit within art band | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c3.body.detail1 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Utility effect / target |
| WC2c3.body.detail2 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Quantity / availability |
| WC2c3.body.blocker | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c3.selection.outline | 100% card width | 100% card height | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c3.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c3.header.title | remaining header width | 100% header height | WC2c3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c3.header.state | content-fit | 100% header height | WC2c3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c3.art.tags | available art width minus shared inset | content-fit within art band | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c3.body.detail1 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Utility effect / target |
| WC2c3.body.detail2 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Quantity / availability |
| WC2c3.body.blocker | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c3.selection.outline | 100% card width | 100% card height | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c3.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC2c3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC2c3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC2c3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC2c3.header.title | remaining header width | 100% header height | WC2c3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC2c3.header.state | content-fit | 100% header height | WC2c3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC2c3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC2c3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC2c3.art.tags | available art width minus shared inset | content-fit within art band | WC2c3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC2c3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC2c3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC2c3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC2c3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC2c3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC2c3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC2c3.body.detail1 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Utility effect / target |
| WC2c3.body.detail2 | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Quantity / availability |
| WC2c3.body.blocker | 100% usable body width | content-fit within body band | WC2c3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC2c3.selection.outline | 100% card width | 100% card height | WC2c3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC2c3.selection.info | config.components.target.minRem | config.components.target.minRem | WC2c3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3.header.title | remaining header width | 100% header height | WC3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3.header.state | content-fit | 100% header height | WC3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3.art.tags | available art width minus shared inset | content-fit within art band | WC3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3.body.detail1 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Choice summary |
| WC3.body.detail2 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Current selection / eligibility |
| WC3.body.blocker | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3.selection.outline | 100% card width | 100% card height | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3.selection.info | config.components.target.minRem | config.components.target.minRem | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3.header.title | remaining header width | 100% header height | WC3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3.header.state | content-fit | 100% header height | WC3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3.art.tags | available art width minus shared inset | content-fit within art band | WC3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3.body.detail1 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Choice summary |
| WC3.body.detail2 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Current selection / eligibility |
| WC3.body.blocker | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3.selection.outline | 100% card width | 100% card height | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3.selection.info | config.components.target.minRem | config.components.target.minRem | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3.header.title | remaining header width | 100% header height | WC3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3.header.state | content-fit | 100% header height | WC3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3.art.tags | available art width minus shared inset | content-fit within art band | WC3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3.body.detail1 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Choice summary |
| WC3.body.detail2 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Current selection / eligibility |
| WC3.body.blocker | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3.selection.outline | 100% card width | 100% card height | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3.selection.info | config.components.target.minRem | config.components.target.minRem | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3.header.title | remaining header width | 100% header height | WC3.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3.header.state | content-fit | 100% header height | WC3.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3.art.tags | available art width minus shared inset | content-fit within art band | WC3.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3.body.detail1 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Choice summary |
| WC3.body.detail2 | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Current selection / eligibility |
| WC3.body.blocker | 100% usable body width | content-fit within body band | WC3.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3.selection.outline | 100% card width | 100% card height | WC3.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3.selection.info | config.components.target.minRem | config.components.target.minRem | WC3.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC3a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3a.header.title | remaining header width | 100% header height | WC3a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3a.header.state | content-fit | 100% header height | WC3a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3a.art.tags | available art width minus shared inset | content-fit within art band | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3a.body.detail1 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Class identity / role |
| WC3a.body.detail2 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting stats / abilities |
| WC3a.body.blocker | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3a.selection.outline | 100% card width | 100% card height | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3a.selection.info | config.components.target.minRem | config.components.target.minRem | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC3a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3a.header.title | remaining header width | 100% header height | WC3a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3a.header.state | content-fit | 100% header height | WC3a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3a.art.tags | available art width minus shared inset | content-fit within art band | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3a.body.detail1 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Class identity / role |
| WC3a.body.detail2 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting stats / abilities |
| WC3a.body.blocker | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3a.selection.outline | 100% card width | 100% card height | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3a.selection.info | config.components.target.minRem | config.components.target.minRem | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3a.header.title | remaining header width | 100% header height | WC3a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3a.header.state | content-fit | 100% header height | WC3a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3a.art.tags | available art width minus shared inset | content-fit within art band | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3a.body.detail1 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Class identity / role |
| WC3a.body.detail2 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting stats / abilities |
| WC3a.body.blocker | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3a.selection.outline | 100% card width | 100% card height | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3a.selection.info | config.components.target.minRem | config.components.target.minRem | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3a.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3a.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3a.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3a.header.title | remaining header width | 100% header height | WC3a.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3a.header.state | content-fit | 100% header height | WC3a.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3a.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3a.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3a.art.tags | available art width minus shared inset | content-fit within art band | WC3a.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3a.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3a.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3a.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3a.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3a.body.detail1 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Class identity / role |
| WC3a.body.detail2 | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting stats / abilities |
| WC3a.body.blocker | 100% usable body width | content-fit within body band | WC3a.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3a.selection.outline | 100% card width | 100% card height | WC3a.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3a.selection.info | config.components.target.minRem | config.components.target.minRem | WC3a.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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
│ {Name}                         │
├────────────────────────────────┤
│ [Art / portrait]               │
│                                │
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
|---|---|---|---|---|---|---|---|---|
| WC3b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3b.header.title | remaining header width | 100% header height | WC3b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3b.header.state | content-fit | 100% header height | WC3b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3b.art.tags | available art width minus shared inset | content-fit within art band | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3b.body.detail1 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting equipment |
| WC3b.body.detail2 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted playing cards |
| WC3b.body.blocker | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3b.selection.outline | 100% card width | 100% card height | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3b.selection.info | config.components.target.minRem | config.components.target.minRem | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Compact**

```text
             (i)
┌────────────────────────────┐
│ {Name}                     │
├────────────────────────────┤
│ [Art / portrait]           │
│                            │
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
|---|---|---|---|---|---|---|---|---|
| WC3b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3b.header.title | remaining header width | 100% header height | WC3b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3b.header.state | content-fit | 100% header height | WC3b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3b.art.tags | available art width minus shared inset | content-fit within art band | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3b.body.detail1 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting equipment |
| WC3b.body.detail2 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted playing cards |
| WC3b.body.blocker | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3b.selection.outline | 100% card width | 100% card height | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3b.selection.info | config.components.target.minRem | config.components.target.minRem | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3b.header.title | remaining header width | 100% header height | WC3b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3b.header.state | content-fit | 100% header height | WC3b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3b.art.tags | available art width minus shared inset | content-fit within art band | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3b.body.detail1 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting equipment |
| WC3b.body.detail2 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted playing cards |
| WC3b.body.blocker | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3b.selection.outline | 100% card width | 100% card height | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3b.selection.info | config.components.target.minRem | config.components.target.minRem | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
            (i)
┌──────────────────────────┐
│ {Name}                   │
├──────────────────────────┤
│ [Art / portrait]         │
│                          │
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
|---|---|---|---|---|---|---|---|---|
| WC3b.frame | clamp(config.cards.geometry.widthMinimum, config.cards.geometry.widthPreferred, config.cards.geometry.widthMaximum) | resolved width × config.cards.geometry.ratioHeight / config.cards.geometry.ratioWidth | owning hand/grid/picker | host-assigned cell | center / center | host grid item | host gap token | Uniform card envelope |
| WC3b.header | 100% card width | config.cards.geometry.bands.header% of card height | WC3b.frame | top / full width | stretch / center | normal grid flow | 0 | Name left; state right |
| WC3b.header.title | remaining header width | 100% header height | WC3b.header | top-left | start / center | normal grid flow | shared inset token from left; vertically centered in header | Top-left |
| WC3b.header.state | content-fit | 100% header height | WC3b.header | top-right | end / center | normal grid flow | shared inset token from right; vertically centered in header | Top-right if applicable |
| WC3b.art | 100% card width | config.cards.geometry.bands.art% of card height | WC3b.frame | below header | center / center | normal grid flow | 0; preserve intrinsic artwork ratio | Contain artwork; never stretch |
| WC3b.art.tags | available art width minus shared inset | content-fit within art band | WC3b.art | bottom-left | start / center | reserved bottom row inside art band | shared inset token horizontal inset; no extra band height | Meaningful tags bottom-left |
| WC3b.body | 100% card width | config.cards.geometry.bands.body% of card height | WC3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Shared fact rows; scroll only when required |
| WC3b.footer | 100% card width | config.cards.geometry.bands.footer% of card height | WC3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Metadata only |
| WC3b.footer.metadata | available footer width minus shared inset | 100% usable footer height | WC3b.footer | bottom / full usable width | center / center | single-row footer grid item | shared inset token side inset; vertically centered in footer | Rarity left; owned count right |
| WC3b.body.detail1 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Starting equipment |
| WC3b.body.detail2 | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Granted playing cards |
| WC3b.body.blocker | 100% usable body width | content-fit within body band | WC3b.body | next row, top to bottom | start / start | normal grid flow | shared inset token horizontal inset; rows share body budget | Omit when absent |
| WC3b.selection.outline | 100% card width | 100% card height | WC3b.frame | perimeter | center / center | anchored overlay following visual card transform | 0; outline outside edge, no layout reflow | Shared owner selection glow |
| WC3b.selection.info | config.components.target.minRem | config.components.target.minRem | WC3b.frame | above top-center | center / center | anchored overlay following visual card transform | 0.75vh gap above lifted card; reserve host headroom | Centered above owner; outside ratio envelope |

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

**Parent: WC0.** Borderless combatant presentation: sprite remaining (85% with HP only), resource bars 5% each, statuses 10% of component height; overrides WC0 item-card bands. Three sizes are host presentation variants, never different combatant models. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. Formation fit is shared across factions and measured from unselected geometry. Configured row factors preserve back/middle/front depth; selected growth raises the assembly without changing its floor anchor. See CURRENT-SPECIFICATION.md.

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
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


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
| WC4.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
ProjectSelectionVisibility(config.visibility.unselectedHiddenSelectors, owner.selected) // Retain HP, block, intent, icons, aura and buffs while unselected.
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
ApplyRowPresentation(config.combatantFocus.rowBase, config.combatantFocus.selectedGrowth) // Share unselected category fit across factions; selection details never shrink it.
AnchorScaledSpriteAtGroundShadow(); RaiseSelectedTo(config.combatantFocus.focusZ) // Keep foot contact stable and bring selected assembly forward.
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4a: Compact combatant

**Parent: WC4.** Compact: clamp(10rem, 14vw, 12rem) width; height = width × 8/5. Supplementary full details through inspection. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. Formation fit is shared across factions and measured from unselected geometry. Configured row factors preserve back/middle/front depth; selected growth raises the assembly without changing its floor anchor. See CURRENT-SPECIFICATION.md.

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
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


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
| WC4a.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4a.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4a.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4a.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4a.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4a.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4a.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4a.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4a.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
ProjectSelectionVisibility(config.visibility.unselectedHiddenSelectors, owner.selected) // Retain HP, block, intent, icons, aura and buffs while unselected.
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
ApplyRowPresentation(config.combatantFocus.rowBase, config.combatantFocus.selectedGrowth) // Share unselected category fit across factions; selection details never shrink it.
AnchorScaledSpriteAtGroundShadow(); RaiseSelectedTo(config.combatantFocus.focusZ) // Keep foot contact stable and bring selected assembly forward.
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4b: Standard combatant

**Parent: WC4.** Standard: clamp(12rem, 18vw, 16rem) width; height = width × 8/5. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. Formation fit is shared across factions and measured from unselected geometry. Configured row factors preserve back/middle/front depth; selected growth raises the assembly without changing its floor anchor. See CURRENT-SPECIFICATION.md.

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
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


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
| WC4b.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4b.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4b.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4b.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4b.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4b.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4b.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4b.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4b.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
ProjectSelectionVisibility(config.visibility.unselectedHiddenSelectors, owner.selected) // Retain HP, block, intent, icons, aura and buffs while unselected.
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
ApplyRowPresentation(config.combatantFocus.rowBase, config.combatantFocus.selectedGrowth) // Share unselected category fit across factions; selection details never shrink it.
AnchorScaledSpriteAtGroundShadow(); RaiseSelectedTo(config.combatantFocus.focusZ) // Keep foot contact stable and bring selected assembly forward.
On hover/focus/tap tag: schedule shared tooltip after config.interaction.tooltipDelayMs; cancel stale timer
On +N or info: open W1w; preview ONLY sprite/name/HP
Inspector title = entity name
Inspector detail providers: HP/intent/defense, active current state,
 previous actions, known abilities, known traits, lore; apply knowledge filter
Reuse one model across orientations and sizes; no duplicate domain facts
Dispose timers/observers and restore focus on close.
```

### Wireframe WC4c: Expanded combatant

**Parent: WC4.** Expanded: clamp(16rem, 24vw, 20rem) width; height = width × 8/5. No new gameplay facts implied. Borderless combatant renderer. Inherits WC0 identity, tag providers, inspection and shared selection effects; overrides item-card bands. Name sits above HP. Intent is above sprite, hidden for player by configurable default; info appears above it after1s. Defense is large at50% sprite height outside the facing side with0.5rem gap (player right, enemy left). Aura/buff fill sprite height. Filter active components before stacking HP/resources/buildup/stance/icons; max5 rows, no empty gaps. Extra resource and buildup bars are half HP height; stance matches HP width/height. Icons are1.575rem squares, icon-only; final +N opens the complete inspector. Shared0.2rem stack gap and whole-assembly selected glow. Tooltip delay1s. Inspector uses entity-name title; left sprite/name/HP only; right summary, current state, previous actions, known abilities/traits, lore. Facts are knowledge-filtered and data-driven. Formation fit is shared across factions and measured from unselected geometry. Configured row factors preserve back/middle/front depth; selected growth raises the assembly without changing its floor anchor. See CURRENT-SPECIFICATION.md.

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
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.


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
| WC4c.defense | 3.5rem minimum | 3.5rem minimum | sprite | player upper-right at 12%; enemy lower-left at 88% sprite height | center / center | badge overlay | 0.5rem outside sprite; side follows facing | current block/defense model |
| WC4c.sprite | 100% component | H minus bars and statuses | frame | top-center | center / end | row 1 | 0 | contain sprite; preserve intrinsic art ratio |
| WC4c.resources | 100% component | HP height + 0.5 × HP height per extra resource | frame | below sprite | center / center | row 2; stacked meters | shared bar gap included | HP always; applicable extra resources from model |
| WC4c.resources.bar | 100% component | HP: base height; other resources: half HP height | resources | next row | center / center | normal flow | shared gap | label + current/max; semantic color; never color-only |
| WC4c.status | 100% component | content-fit; sprite yields space | frame | below resources | center / start | row 3 | 0.2rem shared gap | contains buildup, stance, icons in this order |
| WC4c.buildup | 100% component | 0.5 × HP bar height | status | top | stretch / center | rows first | config.combatant.stackGapRem | threshold progress; semantic color and text |
| WC4c.statusIcons | 100% component | 1.575rem; exactly one icon row | status | below stance | center / center | last row; final +N opens inspector | config.combatant.stackGapRem | uniform 1.575rem square tiles; icon only; details in tooltip/inspector |
| WC4c.stance | 100% component | 1 × HP bar height | status | below buildup | center / center | before status icons | config.combatant.stackGapRem | uniform badge dimensions across all stances |
| WC4c.info | minimum input target | minimum input target | frame | above top-center | center / center | overlay | above intent with shared gap | outside H; selection delay inherited |

H is component height, not screen height. The sprite receives remaining height after measuring the active lower stack; no viewport-fraction conversion may distort its envelope. Minimum readable bars override nominal allocation; host scales uniformly or uses inspection if space runs out. Presentation variants: player faces right, enemy faces left; mirror only sprite artwork, never labels/meters. Defense stays outside the sprite with0.5rem gap on the facing side: player right, enemy left, vertically centered at50%. Selected variant adds shared targeting emphasis and delayed info. Aura is visibly present at sprite top edge. Filter inactive optional components before layout; collapse omitted rows and gaps. Preserve HP → resources → buildup → stance → icons order among active components. Block/intent overlays are also active-only, subject to role visibility. Maximum five lower rows: reserve HP, stance and icons; at most two extra resource/buildup bars. Excess buildup moves into progress icons. If icons exceed width, reserve last slot for +N hidden items; inspector shows full list. Preserve existing leading intentions, block badge and stage baseline as overlays/registered slots; no gameplay change.

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
ProjectSelectionVisibility(config.visibility.unselectedHiddenSelectors, owner.selected) // Retain HP, block, intent, icons, aura and buffs while unselected.
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
ApplyRowPresentation(config.combatantFocus.rowBase, config.combatantFocus.selectedGrowth) // Share unselected category fit across factions; selection details never shrink it.
AnchorScaledSpriteAtGroundShadow(); RaiseSelectedTo(config.combatantFocus.focusZ) // Keep foot contact stable and bring selected assembly forward.
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
