# wireframe.md — W0 hierarchy, ASCII, component sizes and pseudocode

Each parent defines the shared bones and effects. Children supply view-model data and small declared variations, not duplicate layout/lifecycle code. The exact order is: parent description → Wide ASCII → Compact ASCII → Vertical/Mobile ASCII → child a with all three views → child b, and so on. Drawings are schematic, not fixed pixel sizes.

**W0: Master shell** — title top-left, exit top-right, Back bottom-left, Primary bottom-right; shared body host and effects.

**W1: Workspace/modal** — Settings, Town, Creation, service selection, inspection, save flows, and choice bodies.

**W2: Confirmation** — short decisions with shared focus, cancellation, and confirmation behavior.

**W3: Main menu** — one screen-centered title and contextual menu/preview state.

**W4: Gameplay/encounter** — shared HUD, scene, context region, and bottom controls; combat, map, and dialogue use registered body variants.

**Inherited placement:** title top-left, exit top-right, Close/Back bottom-left, interaction/confirmation bottom-right, all with shared consistent inset/padding. A single footer button spans the full usable footer width; its label is centered. Two footer buttons keep their left/right roles. No footer buttons means no empty footer. W1–W4 and all children inherit this; omitted components do not shift remaining anchors. Explicit owner variants remain W3’s screen-centered title/Profile header slot and W4a’s tightly centered combat group. Capabilities omit inapplicable actions without inventing navigation or duplicating a primary command.

**Footer is always inline:** one horizontal row in Wide, Compact, and Vertical/Mobile. Never stack footer buttons or wrap their labels. Use concise meaningful labels and shared responsive sizing while preserving minimum input targets. One button fills the row; multiple controls keep their declared positions.

**Inherited palette/state effects:** see COLOR-INTERACTION-CONTRACT.md. Five configurable groups drive surfaces, text, gold accents, positive green, and exit/danger red. Close/Back/Exit highlights red; ordinary ready/selected primary actions highlight green; neutral/unready controls use dark brown/gold. Disabled/busy wins. Destructive confirmations and the earlier End Turn guidance rule are named exceptions, as are semantic resource/tag/rarity/target colors and media. These are inherited state mappings, not child-specific hex colors. Keep related content single-row where readable; state effects never move anchors.

Parent effects include spacing, elevation, focus/hover, opening/closing transitions, reduced motion, and input ownership where applicable. Domain effects remain explicit registered commands. Orientation is a presentation variant, never another child. W1 is the default modal; W2 shares its primitives for compact decisions. These document IDs do not rename existing saved/semantic layout IDs. A = actions, D = draw pile, E = discard/exhaust, P = potions; real controls have full accessible labels and valid targets.

**Component dimensions:** every view has a companion table naming each structural slot and its nominal viewport-relative allocation. See COMPONENT-SIZING.md for units, parent-relative conversion, optional slots, padding, and minimum-size overrides. These are proposed layout targets, not measured game geometry.

**Current specification:** [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md) is authoritative over earlier nominal/iteration notes.

## Wireframe W0: Master shell

**Base wireframe.** Placement anchors: TITLE top-left; EXIT (×) top-right; CLOSE/BACK bottom-left; INTERACTION/CONFIRMATION bottom-right. All anchors use the same shared inset/padding, never label-dependent offsets. Header/body/footer have reserved layout space; content cannot displace or cover the controls. With exactly ONE footer button, that button spans the full usable footer width with a centered label. With two, retain left/right roles and consistent sizing/padding. With zero, omit the footer. Unneeded components may be omitted by explicit capability, without shifting remaining anchors. All four families and their children inherit this positioning, effects and lifecycle.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ {Title}                                    [×] │
├────────────────────────────────────────────────┤
│                                                │
│ {Body supplied by W1–W4}                       │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│ [Close / Back]                       [Primary] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W0.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W0.header` | 95vw | 10vh | W0.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W0.header.title` | 77vw | 6vh | W0.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W0.header.exit` | 8vw | 6vh | W0.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W0.body` | 95vw | 70vh | W0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W0.body.activePane` | 90vw | 66vh | W0.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W0.body.content` | 90vw | 66vh | W0.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W0.footer` | 95vw | 10vh | W0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W0.footer.closeBack` | 44vw | 6vh | W0.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W0.footer.primary` | 44vw | 6vh | W0.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W0.footer.singleAction` | 90vw | 6vh | W0.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ {Title}                      [×] │
├──────────────────────────────────┤
│ {Body from parent variant}       │
│                                  │
├──────────────────────────────────┤
│ [Close / Back]         [Primary] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W0.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W0.header` | 95vw | 10vh | W0.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W0.header.title` | 77vw | 6vh | W0.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W0.header.exit` | 8vw | 6vh | W0.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W0.body` | 95vw | 70vh | W0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W0.body.activePane` | 90vw | 66vh | W0.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W0.body.content` | 90vw | 66vh | W0.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W0.footer` | 95vw | 10vh | W0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W0.footer.closeBack` | 44vw | 6vh | W0.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W0.footer.primary` | 44vw | 6vh | W0.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W0.footer.singleAction` | 90vw | 6vh | W0.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ {Title}               [×] │
├───────────────────────────┤
│                           │
│ {Body from parent}        │
│                           │
│                           │
│                           │
├───────────────────────────┤
│ [Close / Back]  [Primary] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W0.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W0.header` | 95vw | 10vh | W0.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W0.header.title` | 77vw | 6vh | W0.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W0.header.exit` | 8vw | 6vh | W0.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W0.body` | 95vw | 70vh | W0.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W0.body.activePane` | 90vw | 66vh | W0.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W0.body.content` | 90vw | 66vh | W0.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W0.footer` | 95vw | 10vh | W0.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W0.footer.closeBack` | 44vw | 6vh | W0.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W0.footer.primary` | 44vw | 6vh | W0.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W0.footer.singleAction` | 90vw | 6vh | W0.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: definitionId, immutableViewModel, commandBindings, host, inputContext
OUTPUT: viewHandle(update, dispose), semantic intents

FUNCTION MountMaster(inputs):
    definition = ResolveValidatedInheritance(definitionId)
    REQUIRE definition ancestry ends at W0; reject cycles/unknown fields
    viewport = SharedViewportAdapter.AvailableLocalSize(host)
    mode = ChooseContentFitMode(viewport, textScale, targetMinimums)
    shell = CreateHeaderBodyFooterOnce()
    ReserveHeaderAndFooterOutsideBodyScroll(shell)
    ApplyInheritedPaddingSpacingEffects(shell, definition)
    Anchor(title, TOP_LEFT); Anchor(exit, TOP_RIGHT)
    IF definition.titlePlacement == screenCenter: CenterTitleOnFullHost()
    RenderOnlyApplicableComponents(immutableViewModel.capabilities)
    RenderRegisteredBody(immutableViewModel.body)
    RenderFooter(immutableViewModel.actions, definition.footerPlacement)
    BindTopmostInputFocusAndDismissal(shell, definition.interactionPolicy)
    RETURN handle that updates stable nodes and disposes listeners/audio/timers

FUNCTION RenderFooter(actions, placement):
    visible = FilterByDeclaredVisibility(actions) // disabled visible actions count
    IF count(visible) == config.referenceTokens.value_0.value: OmitFooter(); RETURN
    IF count(visible) == config.referenceTokens.value_1.value:
        PlaceOneButtonFullUsableWidth(labelCentered = true); RETURN
    IF placement == packedCombat:
        CenterOneGroup(Actions, Draw, EndTurn, DiscardExhaust, Potions)
        UseMinimalSharedGapsAndPairedSideSizes()
    ELSE:
        Anchor(CloseOrBack, BOTTOM_LEFT); Anchor(Primary, BOTTOM_RIGHT)
        IF declaredMiddleAction exists: Anchor(declaredMiddleAction, CENTER)
    KeepButtonsAndLabelsOnOneHorizontalRow()
    UseConciseLabelsAndSharedSizingWithinTextAndTargetMinimums()
    IF supported size still cannot fit: ReportLayoutFailure(); never silently stack

FUNCTION ResolveControlStyle(action, inputState):
    IF action absent by capability: RETURN absent
    IF action.busy OR NOT action.canActivate: RETURN neutralBrownGoldMuted
    IF action has registeredException: RETURN ResolveException(action, inputState)
    highlighted = hover OR keyboardFocus OR controllerFocus OR selected
    IF action.role == exit: RETURN highlighted ? redEmphasis : brownGold
    IF action.role == primary: RETURN highlighted ? strongGreen : readyGreen
    RETURN highlighted ? goldEmphasis : brownGold

ON resize/orientation/textScale:
    ReprojectLayoutOnly(); PreserveSelectionFocusAndInProgressDomainState()
ON Close/Back/Primary:
    EmitBoundIntentIfAllowed(); never infer behavior from label or color
ON dispose:
    CloseOnceWithReason(dispose); ReleaseAllOwnedResources()
```

## Wireframe W1: Base workspace / modal

**Parent: W0.** Default base modal: one header, category rail, active pane, footer. Compact/mobile moves category navigation above content. Single-category variants may omit the rail. selection body/inspection body/choice body bodies compose inside this frame; do not nest whole modal shells. Selection/detail, inspection/status, and choice/progression are body variants of this same frame. A child without categories omits the rail. Its body differences do not create a new parent renderer.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ {Title}                                    [×] │
├──────────────┬─────────────────────────────────┤
│ Category A   │ {Active body model}             │
│ Category B   │ {Control / choice}              │
│ Category C   │ {Useful feedback}               │
├──────────────┴─────────────────────────────────┤
│ [Back / secondary]                   [Primary] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1.header` | 95vw | 10vh | W1.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1.header.title` | 77vw | 6vh | W1.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1.header.exit` | 8vw | 6vh | W1.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1.body` | 95vw | 70vh | W1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1.body.navigation` | 21.6vw | 66vh | W1.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1.body.activePane` | 65.9vw | 66vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1.body.activePane` | 65.9vw | 66vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1.footer` | 95vw | 10vh | W1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1.footer.closeBack` | 44vw | 6vh | W1.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1.footer.primary` | 44vw | 6vh | W1.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1.footer.singleAction` | 90vw | 6vh | W1.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ {Title}                      [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ {Active body model}              │
│ {Control / choice}               │
│ {Useful feedback}                │
├──────────────────────────────────┤
│ [Back / secondary]     [Primary] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1.header` | 95vw | 10vh | W1.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1.header.title` | 77vw | 6vh | W1.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1.header.exit` | 8vw | 6vh | W1.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1.body` | 95vw | 70vh | W1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1.body.navigation` | 90vw | 6vh | W1.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1.body.activePane` | 90vw | 58vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1.body.activePane` | 90vw | 58vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1.footer` | 95vw | 10vh | W1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1.footer.closeBack` | 44vw | 6vh | W1.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1.footer.primary` | 44vw | 6vh | W1.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1.footer.singleAction` | 90vw | 6vh | W1.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ {Title}               [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ {Active body model}       │
│ {Control / choice}        │
│ {Useful feedback}         │
├───────────────────────────┤
│ [Back]          [Primary] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1.header` | 95vw | 10vh | W1.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1.header.title` | 77vw | 6vh | W1.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1.header.exit` | 8vw | 6vh | W1.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1.body` | 95vw | 70vh | W1.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1.body.navigation` | 90vw | 6vh | W1.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1.body.activePane` | 90vw | 58vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1.body.activePane` | 90vw | 58vh | W1.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1.footer` | 95vw | 10vh | W1.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1.footer.closeBack` | 44vw | 6vh | W1.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1.footer.primary` | 44vw | 6vh | W1.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1.footer.singleAction` | 90vw | 6vh | W1.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: workspaceDefinition, categories, activeCategoryId, bodyModel, actions
INHERITS: W0 geometry, footer, palette, transitions, focus, cleanup

FUNCTION RenderWorkspace(model):
    validCategory = ResolveAvailableCategory(model.activeCategoryId)
    navigation = IF count(categories) > config.referenceTokens.value_1.value THEN
        wide: LeftRail(categories)
        compact/portrait: AccessibleCategorySelector(categories)
      ELSE absent
    body = ProjectOnlyActiveCategory(validCategory)
    RETURN W0.MountOrUpdate(header, navigation, body, actions)

ON chooseCategory(id):
    REQUIRE id is available
    SaveLocalSelectionForCurrentCategory()
    DisposeCurrentBodyBindings(); set activeCategoryId = id
    RestoreLocalSelectionFor(id); update same shell
    DoNotCommitGameplayMerelyBecauseCategoryChanged()

Selection, inspection and choices are registered BODY variants here.
Do not mount a second W0 inside the body.
```

### Wireframe W1a: Settings

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Settings                                   [×] │
├──────────────┬─────────────────────────────────┤
│ Display ●    │ Text size          [control]    │
│ Audio        │ UI scale           [control]    │
│ Accessibility│ Necessary help, if needed       │
│ Advanced     │                                 │
├──────────────┴─────────────────────────────────┤
│ [             Applicable action              ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1a.header` | 95vw | 10vh | W1a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1a.header.title` | 77vw | 6vh | W1a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1a.header.exit` | 8vw | 6vh | W1a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1a.body` | 95vw | 70vh | W1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1a.body.navigation` | 21.6vw | 66vh | W1a.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1a.body.activePane` | 65.9vw | 66vh | W1a.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1a.body.fields` | 31.95vw | 66vh | W1a.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.body.feedback` | 31.95vw | 66vh | W1a.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.footer` | 95vw | 10vh | W1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1a.footer.closeBack` | 44vw | 6vh | W1a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1a.footer.primary` | 44vw | 6vh | W1a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1a.footer.singleAction` | 90vw | 6vh | W1a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Settings                     [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ Text size          [control]     │
│ UI scale           [control]     │
│ Necessary help, if needed        │
├──────────────────────────────────┤
│ [      Applicable action       ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1a.header` | 95vw | 10vh | W1a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1a.header.title` | 77vw | 6vh | W1a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1a.header.exit` | 8vw | 6vh | W1a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1a.body` | 95vw | 70vh | W1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1a.body.navigation` | 90vw | 6vh | W1a.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1a.body.activePane` | 90vw | 58vh | W1a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1a.body.fields` | 90vw | 28vh | W1a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.body.feedback` | 90vw | 28vh | W1a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.footer` | 95vw | 10vh | W1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1a.footer.closeBack` | 44vw | 6vh | W1a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1a.footer.primary` | 44vw | 6vh | W1a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1a.footer.singleAction` | 90vw | 6vh | W1a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Settings              [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ Text size                 │
│ [control]                 │
│ UI scale                  │
│ [control]                 │
│ Necessary help, if needed │
├───────────────────────────┤
│ [   Applicable action   ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1a.header` | 95vw | 10vh | W1a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1a.header.title` | 77vw | 6vh | W1a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1a.header.exit` | 8vw | 6vh | W1a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1a.body` | 95vw | 70vh | W1a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1a.body.navigation` | 90vw | 6vh | W1a.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1a.body.activePane` | 90vw | 58vh | W1a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1a.body.fields` | 90vw | 28vh | W1a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.body.feedback` | 90vw | 28vh | W1a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1a.footer` | 95vw | 10vh | W1a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1a.footer.closeBack` | 44vw | 6vh | W1a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1a.footer.primary` | 44vw | 6vh | W1a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1a.footer.singleAction` | 90vw | 6vh | W1a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: settingsSnapshot, settingsDefinitions, browserCapabilities
PARENT: W1
model.categories = ProjectRegisteredSettingCategories()
model.body = ProjectSettingRows(activeCategory, values, capabilities)
model.actions = ProjectExistingSettingsActions()
RenderWithW1(model)
ON changeSetting(id, value):
    ValidateTypeRangeAndCapability(id, value)
    DispatchSettingsCommandUsingItsExistingApplyOrImmediateSavePolicy()
    RefreshValuesAndFeedback(); do not navigate or rebuild the shell
ON failedBrowserCapability: ShowReasonWithoutPretendingChangeSucceeded()
Palette controls edit shared theme records, not per-component colors.
```

### Wireframe W1b: Town

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. No separate scene/HUD band above the workspace.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Town · Resources                           [×] │
├──────────────┬─────────────────────────────────┤
│ Smith ●      │ [Small NPC portrait] NPC        │
│ Merchant     │ Active service choices          │
│ Rest         │ [Option] [Option]               │
│ Quest NPC    │ Cost / availability             │
├──────────────┴─────────────────────────────────┤
│ [Leave]                          [Talk / Open] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1b.header` | 95vw | 10vh | W1b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1b.header.title` | 77vw | 6vh | W1b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1b.header.exit` | 8vw | 6vh | W1b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1b.body` | 95vw | 70vh | W1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1b.body.navigation` | 21.6vw | 66vh | W1b.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1b.body.activePane` | 65.9vw | 66vh | W1b.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1b.body.npcIdentity` | 65.9vw | 20.67vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.serviceChoices` | 65.9vw | 20.67vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.feedback` | 65.9vw | 20.67vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.footer` | 95vw | 10vh | W1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1b.footer.closeBack` | 44vw | 6vh | W1b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1b.footer.primary` | 44vw | 6vh | W1b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1b.footer.singleAction` | 90vw | 6vh | W1b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Town · Resources             [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ [Small NPC portrait] NPC         │
│ Active service choices           │
│ [Option] [Option]                │
│ Cost / availability              │
├──────────────────────────────────┤
│ [Leave]            [Talk / Open] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1b.header` | 95vw | 10vh | W1b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1b.header.title` | 77vw | 6vh | W1b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1b.header.exit` | 8vw | 6vh | W1b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1b.body` | 95vw | 70vh | W1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1b.body.navigation` | 90vw | 6vh | W1b.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1b.body.activePane` | 90vw | 58vh | W1b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1b.body.npcIdentity` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.serviceChoices` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.feedback` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.footer` | 95vw | 10vh | W1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1b.footer.closeBack` | 44vw | 6vh | W1b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1b.footer.primary` | 44vw | 6vh | W1b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1b.footer.singleAction` | 90vw | 6vh | W1b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Town · Resources      [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ [Small NPC portrait] NPC  │
│ Active service choices    │
│ [Option] [Option]         │
│ Cost / availability       │
├───────────────────────────┤
│ [Leave]     [Talk / Open] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1b.header` | 95vw | 10vh | W1b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1b.header.title` | 77vw | 6vh | W1b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1b.header.exit` | 8vw | 6vh | W1b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1b.body` | 95vw | 70vh | W1b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1b.body.navigation` | 90vw | 6vh | W1b.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1b.body.activePane` | 90vw | 58vh | W1b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1b.body.npcIdentity` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.serviceChoices` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.body.feedback` | 90vw | 18vh | W1b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1b.footer` | 95vw | 10vh | W1b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1b.footer.closeBack` | 44vw | 6vh | W1b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1b.footer.primary` | 44vw | 6vh | W1b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1b.footer.singleAction` | 90vw | 6vh | W1b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: townDefinition, playerSnapshot, npcAndServiceRegistries
PARENT: W1
available = EvaluateTownMembershipAndProgressionPredicates()
model.categories = ProjectNPCServiceCategories(available)
model.header = TownNameAndConciseResources()
model.body = SmallNPCPortraitAndActiveServiceModel(selectedNPC)
model.actions = LeaveAndTalkOrOpenFromDomainCapabilities()
RenderWithW1(model) // no extra scene or HUD band
ON chooseNPC(id): ChangeLocalCategorySelectionOnly(id)
ON Talk/Open: NavigateToRegisteredDialogueOrService(selectedNPC)
ON return: RestoreSelectedNPCAndRefreshAvailability()
ON Leave/Close: DispatchApprovedTownExitIntent(); never bypass a required choice
```

### Wireframe W1c: Character creation

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Show only the active category. Small portrait, compact choices, explicit paging for long collections, persistent footer; avoid page scrolling. Allow one active-pane scroll at extreme text sizes instead of clipping or shrinking controls.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Create character [Face]                    [×] │
├──────────────┬─────────────────────────────────┤
│ Class        │ Attributes       Remaining:3    │
│ Starting kit │ Stat [−]8[+]   Stat [−]8[+]     │
│ Attributes ● │ Stat [−]8[+]   Stat [−]8[+]     │
│ Review       │ Derived effects / blocker       │
├──────────────┴─────────────────────────────────┤
│ [Back]                          [Next / Begin] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1c.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1c.header` | 95vw | 10vh | W1c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1c.header.title` | 77vw | 6vh | W1c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1c.header.exit` | 8vw | 6vh | W1c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1c.body` | 95vw | 70vh | W1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1c.body.navigation` | 21.6vw | 66vh | W1c.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1c.body.activePane` | 65.9vw | 66vh | W1c.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1c.body.stageControls` | 31.95vw | 66vh | W1c.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.body.derivedSummary` | 31.95vw | 66vh | W1c.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.footer` | 95vw | 10vh | W1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1c.footer.closeBack` | 44vw | 6vh | W1c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1c.footer.primary` | 44vw | 6vh | W1c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1c.footer.singleAction` | 90vw | 6vh | W1c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Create character [Face]      [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ Attributes     Remaining:3       │
│ Stat            [−]8[+]          │
│ Stat            [−]8[+]          │
│ Stat            [−]8[+]          │
│ Derived effects / blocker        │
├──────────────────────────────────┤
│ [Back]            [Next / Begin] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1c.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1c.header` | 95vw | 10vh | W1c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1c.header.title` | 77vw | 6vh | W1c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1c.header.exit` | 8vw | 6vh | W1c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1c.body` | 95vw | 70vh | W1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1c.body.navigation` | 90vw | 6vh | W1c.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1c.body.activePane` | 90vw | 58vh | W1c.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1c.body.stageControls` | 90vw | 28vh | W1c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.body.derivedSummary` | 90vw | 28vh | W1c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.footer` | 95vw | 10vh | W1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1c.footer.closeBack` | 44vw | 6vh | W1c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1c.footer.primary` | 44vw | 6vh | W1c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1c.footer.singleAction` | 90vw | 6vh | W1c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Create character      [×] │
│ [Face]                    │
│ [Category ▾]              │
├───────────────────────────┤
│ Attributes                │
│ Remaining:3               │
│ Stat            [−]8[+]   │
│ Stat            [−]8[+]   │
│ Stat            [−]8[+]   │
│ Derived effects / blocker │
├───────────────────────────┤
│ [Back]     [Next / Begin] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1c.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1c.header` | 95vw | 10vh | W1c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1c.header.title` | 77vw | 6vh | W1c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1c.header.exit` | 8vw | 6vh | W1c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1c.body` | 95vw | 70vh | W1c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1c.body.navigation` | 90vw | 6vh | W1c.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1c.body.activePane` | 90vw | 58vh | W1c.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1c.body.stageControls` | 90vw | 28vh | W1c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.body.derivedSummary` | 90vw | 28vh | W1c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1c.footer` | 95vw | 10vh | W1c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1c.footer.closeBack` | 44vw | 6vh | W1c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1c.footer.primary` | 44vw | 6vh | W1c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1c.footer.singleAction` | 90vw | 6vh | W1c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: creationDefinitions, draftCharacter, proposedDestinationSlot
PARENT: W1
model.categories = AvailableCreationStagesWithPrerequisiteReasons()
model.header = TitleAndSmallPortrait(draftCharacter)
model.body = ProjectOnlyActiveStage(draftCharacter)
IF stage == attributes:
    DisplayBudgetAndDerivedEffectsFromDomainProjection()
    UseTwoColumnControlsIfTheyFitOtherwiseOneColumn()
IF stage has tooManyChoices: UseExplicitPagesPreservingSelection()
model.actions = BackAndNextOrBegin()
RenderWithW1(model); ReservePersistentInlineFooter()
ON editDraft: ValidateDraftChange(); ReprojectWithoutSavingRun()
ON Next: ValidateActiveStage(); SelectNextAvailableStage()
ON Back: RestorePreviousStageWithoutDiscardingDraft()
ON Begin:
    RevalidateWholeDraftAndDestinationSlot()
    RequestExistingReplacementConfirmationIfNeeded()
    CommitCreationOnceThroughDomainCommand()
Allow one active-pane scroll only when readable content cannot fit.
```

### Wireframe W1d: Shop

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Offers use a W1v body.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Merchant · Cinders                         [×] │
├──────────────┬─────────────────────────────────┤
│ Cards ●      │ [Offer] [Offer]                 │
│ Relics       │ Price with each offer           │
│ Flasks       │ Availability / reason           │
│ Services     │ Selected offer detail           │
│ Sell         │                                 │
├──────────────┴─────────────────────────────────┤
│ [Leave]                      [Selected action] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1d.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1d.header` | 95vw | 10vh | W1d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1d.header.title` | 77vw | 6vh | W1d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1d.header.exit` | 8vw | 6vh | W1d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1d.body` | 95vw | 70vh | W1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1d.body.navigation` | 21.6vw | 66vh | W1d.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1d.body.activePane` | 65.9vw | 66vh | W1d.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1d.body.offers` | 31.95vw | 66vh | W1d.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.body.offerDetail` | 31.95vw | 66vh | W1d.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.footer` | 95vw | 10vh | W1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1d.footer.closeBack` | 44vw | 6vh | W1d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1d.footer.primary` | 44vw | 6vh | W1d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1d.footer.singleAction` | 90vw | 6vh | W1d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Merchant · Cinders           [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ [Offer] [Offer]                  │
│ Price with each offer            │
│ Availability / reason            │
│ Selected offer detail            │
├──────────────────────────────────┤
│ [Leave]        [Selected action] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1d.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1d.header` | 95vw | 10vh | W1d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1d.header.title` | 77vw | 6vh | W1d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1d.header.exit` | 8vw | 6vh | W1d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1d.body` | 95vw | 70vh | W1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1d.body.navigation` | 90vw | 6vh | W1d.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1d.body.activePane` | 90vw | 58vh | W1d.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1d.body.offers` | 90vw | 28vh | W1d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.body.offerDetail` | 90vw | 28vh | W1d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.footer` | 95vw | 10vh | W1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1d.footer.closeBack` | 44vw | 6vh | W1d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1d.footer.primary` | 44vw | 6vh | W1d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1d.footer.singleAction` | 90vw | 6vh | W1d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Merchant · Cinders    [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ [Offer] [Offer]           │
│ Price with each offer     │
│ Availability / reason     │
│ Selected offer detail     │
├───────────────────────────┤
│ [Leave] [Selected action] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1d.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1d.header` | 95vw | 10vh | W1d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1d.header.title` | 77vw | 6vh | W1d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1d.header.exit` | 8vw | 6vh | W1d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1d.body` | 95vw | 70vh | W1d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1d.body.navigation` | 90vw | 6vh | W1d.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1d.body.activePane` | 90vw | 58vh | W1d.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1d.body.offers` | 90vw | 28vh | W1d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.body.offerDetail` | 90vw | 28vh | W1d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1d.footer` | 95vw | 10vh | W1d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1d.footer.closeBack` | 44vw | 6vh | W1d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1d.footer.primary` | 44vw | 6vh | W1d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1d.footer.singleAction` | 90vw | 6vh | W1d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: savedShopStock, runSnapshot, shopDefinitions, localSelection
PARENT: W1; BODY: W1v offer model
model.categories = ProjectAvailableShopCategoriesFromData()
model.header = MerchantAndCurrentCurrency()
model.body = ProjectOffersFor(activeCategory, savedShopStock)
model.actions = LeaveAndApplicableSelectedOfferAction()
RenderWithW1(model)
ON chooseOffer(stableRef): UpdateSelectionAndDomainPreview(stableRef)
ON Buy/Sell/Remove:
    DispatchRegisteredCommandWithStableRefAndRequestId()
    RevalidateFundsCapacityOwnershipAndStockAtCommit()
    RefreshAfterResult(); PreserveCategoryAndSelectionWhenStillValid()
Do not reroll stock or use stale array indexes as transaction identity.
```

### Wireframe W1e: Armoury

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Preserve saved category IDs; detailed selection uses W1n.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Armoury                                    [×] │
├──────────────┬─────────────────────────────────┤
│ Character    │ [Item choices]                  │
│ Inventory ●  │ [Selected item / portrait]      │
│ Hybrid       │ Stats / requirements            │
│              │ Equipment effects               │
├──────────────┴─────────────────────────────────┤
│ [Back]                    [Equip if available] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1e.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1e.header` | 95vw | 10vh | W1e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1e.header.title` | 77vw | 6vh | W1e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1e.header.exit` | 8vw | 6vh | W1e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1e.body` | 95vw | 70vh | W1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1e.body.navigation` | 21.6vw | 66vh | W1e.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1e.body.activePane` | 65.9vw | 66vh | W1e.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1e.body.itemCollection` | 31.95vw | 66vh | W1e.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.body.equipmentDetail` | 31.95vw | 66vh | W1e.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.footer` | 95vw | 10vh | W1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1e.footer.closeBack` | 44vw | 6vh | W1e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1e.footer.primary` | 44vw | 6vh | W1e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1e.footer.singleAction` | 90vw | 6vh | W1e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Armoury                      [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ [Item choices]                   │
│ [Selected item / portrait]       │
│ Stats / requirements             │
│ Equipment effects                │
├──────────────────────────────────┤
│ [Back]      [Equip if available] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1e.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1e.header` | 95vw | 10vh | W1e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1e.header.title` | 77vw | 6vh | W1e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1e.header.exit` | 8vw | 6vh | W1e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1e.body` | 95vw | 70vh | W1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1e.body.navigation` | 90vw | 6vh | W1e.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1e.body.activePane` | 90vw | 58vh | W1e.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1e.body.itemCollection` | 90vw | 28vh | W1e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.body.equipmentDetail` | 90vw | 28vh | W1e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.footer` | 95vw | 10vh | W1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1e.footer.closeBack` | 44vw | 6vh | W1e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1e.footer.primary` | 44vw | 6vh | W1e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1e.footer.singleAction` | 90vw | 6vh | W1e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Armoury               [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ [Item choices]            │
│ [Selected item /          │
│ portrait]                 │
│ Stats / requirements      │
│ Equipment effects         │
├───────────────────────────┤
│ [Back]            [Equip] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1e.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1e.header` | 95vw | 10vh | W1e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1e.header.title` | 77vw | 6vh | W1e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1e.header.exit` | 8vw | 6vh | W1e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1e.body` | 95vw | 70vh | W1e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1e.body.navigation` | 90vw | 6vh | W1e.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1e.body.activePane` | 90vw | 58vh | W1e.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1e.body.itemCollection` | 90vw | 28vh | W1e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.body.equipmentDetail` | 90vw | 28vh | W1e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1e.footer` | 95vw | 10vh | W1e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1e.footer.closeBack` | 44vw | 6vh | W1e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1e.footer.primary` | 44vw | 6vh | W1e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1e.footer.singleAction` | 90vw | 6vh | W1e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: loadoutSnapshot, armouryDefinitions, savedViewPreference
PARENT: W1
model.categories = CharacterInventoryHybridWithExistingSavedIDs()
model.body = ProjectActiveArmouryPaneUsingExistingLoadoutQueries()
model.actions = BackAndApplicableEquipmentAction()
RenderWithW1(model)
ON view/pane change: PreserveLocalSelectionAndTraySizes()
ON selectItem: RenderW1nBodyInsideExistingShell()
ON equip/unequip/swap: DispatchExistingValidatedEquipmentCommand()
ON result: RefreshAffectedStatsGrantsAndReceiptsFromDomain()
Never copy loadout math or rename persisted grid/rack/hybrid IDs.
```

### Wireframe W1f: Compendium

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Categories are illustrative; use actual registered groups and discovery rules.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Compendium                                 [×] │
├──────────────┬─────────────────────────────────┤
│ Cards ●      │ [Entry list]                    │
│ Items        │ Selected entry                  │
│ Enemies      │ Known facts / description       │
├──────────────┴─────────────────────────────────┤
│ [                    Back                    ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1f.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1f.header` | 95vw | 10vh | W1f.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1f.header.title` | 77vw | 6vh | W1f.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1f.header.exit` | 8vw | 6vh | W1f.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1f.body` | 95vw | 70vh | W1f.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1f.body.navigation` | 21.6vw | 66vh | W1f.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1f.body.activePane` | 65.9vw | 66vh | W1f.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1f.body.entryList` | 31.95vw | 66vh | W1f.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.body.entryDetail` | 31.95vw | 66vh | W1f.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.footer` | 95vw | 10vh | W1f.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1f.footer.closeBack` | 44vw | 6vh | W1f.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1f.footer.primary` | 44vw | 6vh | W1f.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1f.footer.singleAction` | 90vw | 6vh | W1f.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Compendium                   [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ [Entry list]                     │
│ Selected entry                   │
│ Known facts / description        │
├──────────────────────────────────┤
│ [             Back             ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1f.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1f.header` | 95vw | 10vh | W1f.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1f.header.title` | 77vw | 6vh | W1f.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1f.header.exit` | 8vw | 6vh | W1f.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1f.body` | 95vw | 70vh | W1f.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1f.body.navigation` | 90vw | 6vh | W1f.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1f.body.activePane` | 90vw | 58vh | W1f.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1f.body.entryList` | 90vw | 28vh | W1f.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.body.entryDetail` | 90vw | 28vh | W1f.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.footer` | 95vw | 10vh | W1f.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1f.footer.closeBack` | 44vw | 6vh | W1f.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1f.footer.primary` | 44vw | 6vh | W1f.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1f.footer.singleAction` | 90vw | 6vh | W1f.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Compendium            [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ [Entry list]              │
│ Selected entry            │
│ Known facts / description │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1f.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1f.header` | 95vw | 10vh | W1f.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1f.header.title` | 77vw | 6vh | W1f.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1f.header.exit` | 8vw | 6vh | W1f.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1f.body` | 95vw | 70vh | W1f.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1f.body.navigation` | 90vw | 6vh | W1f.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1f.body.activePane` | 90vw | 58vh | W1f.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1f.body.entryList` | 90vw | 28vh | W1f.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.body.entryDetail` | 90vw | 28vh | W1f.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1f.footer` | 95vw | 10vh | W1f.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1f.footer.closeBack` | 44vw | 6vh | W1f.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1f.footer.primary` | 44vw | 6vh | W1f.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1f.footer.singleAction` | 90vw | 6vh | W1f.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: contentRegistries, discoverySnapshot, categoryAndEntrySelection
PARENT: W1
model.categories = RegisteredCompendiumGroups()
model.body = KnownEntryListAndSelectedEntryProjection()
model.actions = BackOnlyWhenApplicable()
RenderWithW1(model)
ON selectCategory/entry: ChangeLocalSelection(); ReprojectKnownFacts()
ON inspect: UseSharedInspectionBodyOrModalAsNavigationRequires()
Do not reveal undiscovered information or mutate progression on inspection.
```

### Wireframe W1g: Profile

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Bind only supported profile categories. Do not conflate profile deletion with run deletion.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Profile                                    [×] │
├──────────────┬─────────────────────────────────┤
│ {Category A} │ Current profile identity        │
│ ●            │                                 │
│ {Category B} │ Selected category records       │
│              │ Applicable status / actions     │
├──────────────┴─────────────────────────────────┤
│ [Back]                     [Applicable action] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1g.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1g.header` | 95vw | 10vh | W1g.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1g.header.title` | 77vw | 6vh | W1g.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1g.header.exit` | 8vw | 6vh | W1g.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1g.body` | 95vw | 70vh | W1g.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1g.body.navigation` | 21.6vw | 66vh | W1g.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1g.body.activePane` | 65.9vw | 66vh | W1g.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1g.body.profileIdentity` | 31.95vw | 66vh | W1g.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.body.categoryRecords` | 31.95vw | 66vh | W1g.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.footer` | 95vw | 10vh | W1g.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1g.footer.closeBack` | 44vw | 6vh | W1g.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1g.footer.primary` | 44vw | 6vh | W1g.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1g.footer.singleAction` | 90vw | 6vh | W1g.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Profile                      [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ Current profile identity         │
│ Selected category records        │
│ Applicable status / actions      │
├──────────────────────────────────┤
│ [Back]       [Applicable action] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1g.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1g.header` | 95vw | 10vh | W1g.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1g.header.title` | 77vw | 6vh | W1g.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1g.header.exit` | 8vw | 6vh | W1g.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1g.body` | 95vw | 70vh | W1g.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1g.body.navigation` | 90vw | 6vh | W1g.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1g.body.activePane` | 90vw | 58vh | W1g.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1g.body.profileIdentity` | 90vw | 28vh | W1g.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.body.categoryRecords` | 90vw | 28vh | W1g.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.footer` | 95vw | 10vh | W1g.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1g.footer.closeBack` | 44vw | 6vh | W1g.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1g.footer.primary` | 44vw | 6vh | W1g.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1g.footer.singleAction` | 90vw | 6vh | W1g.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Profile               [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ Current profile identity  │
│ Selected category records │
│ Applicable status /       │
│ actions                   │
├───────────────────────────┤
│ [Back]           [Action] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1g.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1g.header` | 95vw | 10vh | W1g.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1g.header.title` | 77vw | 6vh | W1g.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1g.header.exit` | 8vw | 6vh | W1g.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1g.body` | 95vw | 70vh | W1g.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1g.body.navigation` | 90vw | 6vh | W1g.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1g.body.activePane` | 90vw | 58vh | W1g.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1g.body.profileIdentity` | 90vw | 28vh | W1g.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.body.categoryRecords` | 90vw | 28vh | W1g.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1g.footer` | 95vw | 10vh | W1g.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1g.footer.closeBack` | 44vw | 6vh | W1g.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1g.footer.primary` | 44vw | 6vh | W1g.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1g.footer.singleAction` | 90vw | 6vh | W1g.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: profileSnapshot, profileCapabilities, categorySelection
PARENT: W1
model.categories = ExistingSupportedProfileCategories()
model.body = ProfileIdentityAndActiveCategoryRecords()
model.actions = ProjectActualBackAndPrimaryCapabilities()
RenderWithW1(model)
IF one footer action: W0 stretches it full width
IF two: W0 keeps Back left and concise primary right, INLINE
ON profileAction(recordId): DispatchExistingProfileCommandAndPolicy()
ON result: RefreshProfileRecordsAndStatus()
Do not conflate archive/restore/profile actions with run-slot deletion.
```

### Wireframe W1h: Discard / Exhaust viewer

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. One combined pile control opens this workspace.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Card piles                                 [×] │
├──────────────┬─────────────────────────────────┤
│ Discard ●    │ [Card] [Card] [Card]            │
│ Exhaust      │ Selected card detail            │
│              │ Count / empty state             │
├──────────────┴─────────────────────────────────┤
│ [                   Close                    ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1h.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1h.header` | 95vw | 10vh | W1h.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1h.header.title` | 77vw | 6vh | W1h.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1h.header.exit` | 8vw | 6vh | W1h.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1h.body` | 95vw | 70vh | W1h.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1h.body.navigation` | 21.6vw | 66vh | W1h.body | top-left | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Left category rail |
| `W1h.body.activePane` | 65.9vw | 66vh | W1h.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1h.body.cardCollection` | 31.95vw | 66vh | W1h.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.body.cardDetail` | 31.95vw | 66vh | W1h.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.footer` | 95vw | 10vh | W1h.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1h.footer.closeBack` | 44vw | 6vh | W1h.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1h.footer.primary` | 44vw | 6vh | W1h.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1h.footer.singleAction` | 90vw | 6vh | W1h.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Card piles                   [×] │
│ [Category ▾]                     │
├──────────────────────────────────┤
│ [Card] [Card] [Card]             │
│ Selected card detail             │
│ Count / empty state              │
├──────────────────────────────────┤
│ [            Close             ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1h.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1h.header` | 95vw | 10vh | W1h.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1h.header.title` | 77vw | 6vh | W1h.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1h.header.exit` | 8vw | 6vh | W1h.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1h.body` | 95vw | 70vh | W1h.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1h.body.navigation` | 90vw | 6vh | W1h.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1h.body.activePane` | 90vw | 58vh | W1h.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1h.body.cardCollection` | 90vw | 28vh | W1h.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.body.cardDetail` | 90vw | 28vh | W1h.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.footer` | 95vw | 10vh | W1h.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1h.footer.closeBack` | 44vw | 6vh | W1h.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1h.footer.primary` | 44vw | 6vh | W1h.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1h.footer.singleAction` | 90vw | 6vh | W1h.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Card piles            [×] │
│ [Category ▾]              │
├───────────────────────────┤
│ [Card] [Card] [Card]      │
│ Selected card detail      │
│ Count / empty state       │
├───────────────────────────┤
│ [         Close         ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1h.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1h.header` | 95vw | 10vh | W1h.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1h.header.title` | 77vw | 6vh | W1h.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1h.header.exit` | 8vw | 6vh | W1h.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1h.body` | 95vw | 70vh | W1h.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1h.body.navigation` | 90vw | 6vh | W1h.body | top / full usable width | start / start | normal grid flow | 2.5vw from left; 2vh from body top | Selector above active pane; consumes body budget |
| `W1h.body.activePane` | 90vw | 58vh | W1h.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1h.body.cardCollection` | 90vw | 28vh | W1h.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.body.cardDetail` | 90vw | 28vh | W1h.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1h.footer` | 95vw | 10vh | W1h.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1h.footer.closeBack` | 44vw | 6vh | W1h.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1h.footer.primary` | 44vw | 6vh | W1h.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1h.footer.singleAction` | 90vw | 6vh | W1h.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: committedCombatSnapshot, selectedPile, selectedCardRef
PARENT: W1
model.categories = DiscardAndExhaustWithCounts()
model.body = ProjectCardsIn(selectedPile)
model.actions = CloseIfApplicable()
RenderWithW1(model)
ON selectPile: PreserveCardSelectionIfStillPresent(); update body
ON selectCard: ProjectReadOnlyCardDetails()
ON combatSnapshotChange: RefreshCountsAndInvalidateMissingSelection()
No draw, discard, exhaust, or turn mutation occurs by opening this viewer.
```

### Wireframe W1i: Smith upgrade

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Upgrade equipment                          [×] │
├──────────────────┬─────────────────────────────┤
│ ○ Item A         │ Selected item               │
│ ● Item B         │ Current → Proposed          │
│                  │ Stat changes / requirements │
│                  │ Cost / available stones     │
├──────────────────┴─────────────────────────────┤
│ [Back]                               [Upgrade] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1i.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1i.header` | 95vw | 10vh | W1i.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1i.header.title` | 77vw | 6vh | W1i.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1i.header.exit` | 8vw | 6vh | W1i.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1i.body` | 95vw | 70vh | W1i.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1i.body.activePane` | 90vw | 66vh | W1i.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1i.body.candidates` | 44vw | 66vh | W1i.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.body.upgradePreview` | 44vw | 66vh | W1i.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.footer` | 95vw | 10vh | W1i.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1i.footer.closeBack` | 44vw | 6vh | W1i.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1i.footer.primary` | 44vw | 6vh | W1i.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1i.footer.singleAction` | 90vw | 6vh | W1i.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Upgrade equipment            [×] │
│ [Selection ▾]                    │
│ Selected item                    │
│ Current → Proposed               │
│ Stat changes / requirements      │
│ Cost / available stones          │
├──────────────────────────────────┤
│ [Back]                 [Upgrade] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1i.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1i.header` | 95vw | 10vh | W1i.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1i.header.title` | 77vw | 6vh | W1i.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1i.header.exit` | 8vw | 6vh | W1i.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1i.body` | 95vw | 70vh | W1i.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1i.body.activePane` | 90vw | 66vh | W1i.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1i.body.candidates` | 90vw | 32vh | W1i.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.body.upgradePreview` | 90vw | 32vh | W1i.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.footer` | 95vw | 10vh | W1i.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1i.footer.closeBack` | 44vw | 6vh | W1i.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1i.footer.primary` | 44vw | 6vh | W1i.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1i.footer.singleAction` | 90vw | 6vh | W1i.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Upgrade equipment     [×] │
│ [Selection ▾]             │
│                           │
│ Selected item             │
│ Current → Proposed        │
│ Stat changes /            │
│ requirements              │
│ Cost / available stones   │
│                           │
├───────────────────────────┤
│ [Back]          [Upgrade] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1i.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1i.header` | 95vw | 10vh | W1i.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1i.header.title` | 77vw | 6vh | W1i.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1i.header.exit` | 8vw | 6vh | W1i.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1i.body` | 95vw | 70vh | W1i.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1i.body.activePane` | 90vw | 66vh | W1i.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1i.body.candidates` | 90vw | 32vh | W1i.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.body.upgradePreview` | 90vw | 32vh | W1i.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1i.footer` | 95vw | 10vh | W1i.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1i.footer.closeBack` | 44vw | 6vh | W1i.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1i.footer.primary` | 44vw | 6vh | W1i.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1i.footer.singleAction` | 90vw | 6vh | W1i.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: serviceDefinition, runSnapshot, selectedItemRef
PARENT: W1; BODY: selection/detail
plan = ExistingSmithingPlan(runSnapshot)
model.body = CandidateRowsAndUpgradeDelta(plan, selectedItemRef)
model.actions = BackAndUpgrade(plan.canConfirm, plan.reason)
RenderWithW1(model)
ON selectItem(ref): SetLocalSelection(ref); RecomputePlanAndPreview()
ON Upgrade: DispatchExistingUpgradeCommand(ref, reviewedConsequence, requestId)
IF stale/rejected: KeepOpenAndRefreshReason()
IF committed: FollowConfiguredExistingCloseOrMultiUseContinuation()
Cancel must leave domain state unchanged.
```

### Wireframe W1j: Extract card

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. A registered mount-selector slot supplies the extra step.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Extract card                               [×] │
├──────────────────┬─────────────────────────────┤
│ ○ Item A         │ Selected item               │
│ ● Item B         │ [Mount selector]            │
│                  │ Card / fallback preview     │
│                  │ Cost / available stones     │
├──────────────────┴─────────────────────────────┤
│ [Back]                               [Extract] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1j.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1j.header` | 95vw | 10vh | W1j.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1j.header.title` | 77vw | 6vh | W1j.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1j.header.exit` | 8vw | 6vh | W1j.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1j.body` | 95vw | 70vh | W1j.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1j.body.activePane` | 90vw | 66vh | W1j.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1j.body.items` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.mounts` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.extractionPreview` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.footer` | 95vw | 10vh | W1j.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1j.footer.closeBack` | 44vw | 6vh | W1j.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1j.footer.primary` | 44vw | 6vh | W1j.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1j.footer.singleAction` | 90vw | 6vh | W1j.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Extract card                 [×] │
│ [Selection ▾]                    │
│ Selected item                    │
│ [Mount selector]                 │
│ Card / fallback preview          │
│ Cost / available stones          │
├──────────────────────────────────┤
│ [Back]                 [Extract] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1j.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1j.header` | 95vw | 10vh | W1j.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1j.header.title` | 77vw | 6vh | W1j.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1j.header.exit` | 8vw | 6vh | W1j.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1j.body` | 95vw | 70vh | W1j.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1j.body.activePane` | 90vw | 66vh | W1j.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1j.body.items` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.mounts` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.extractionPreview` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.footer` | 95vw | 10vh | W1j.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1j.footer.closeBack` | 44vw | 6vh | W1j.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1j.footer.primary` | 44vw | 6vh | W1j.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1j.footer.singleAction` | 90vw | 6vh | W1j.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Extract card          [×] │
│ [Selection ▾]             │
│                           │
│ Selected item             │
│ [Mount selector]          │
│ Card / fallback preview   │
│ Cost / available stones   │
│                           │
├───────────────────────────┤
│ [Back]          [Extract] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1j.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1j.header` | 95vw | 10vh | W1j.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1j.header.title` | 77vw | 6vh | W1j.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1j.header.exit` | 8vw | 6vh | W1j.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1j.body` | 95vw | 70vh | W1j.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1j.body.activePane` | 90vw | 66vh | W1j.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1j.body.items` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.mounts` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.body.extractionPreview` | 90vw | 20.67vh | W1j.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1j.footer` | 95vw | 10vh | W1j.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1j.footer.closeBack` | 44vw | 6vh | W1j.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1j.footer.primary` | 44vw | 6vh | W1j.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1j.footer.singleAction` | 90vw | 6vh | W1j.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: extractionDefinition, runSnapshot, itemSelection, mountSelection
PARENT: W1; BODY: selection/detail with mount selector
plan = ExistingExtractionPlan(runSnapshot)
model.body = ItemsMountsCardAndFallbackPreview(plan, selections)
model.actions = BackAndExtractWithEligibility()
RenderWithW1(model)
ON selectItem: ClearMountSelection(); Reproject()
ON selectMount: SetLocalMountSelection(); Reproject()
ON Extract: DispatchExistingExtractionCommand(itemRef, mountKey, requestId)
ON success: RefreshReceiptAndConfiguredContinuation()
Back/Close never extracts or changes a fallback card.
```

### Wireframe W1k: Install card

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Clear dependent mount/card selections when the parent changes.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Install card                               [×] │
├──────────────────┬─────────────────────────────┤
│ ○ Item A         │ Selected item               │
│ ● Item B         │ [Mount selector]            │
│                  │ [Compatible card selector]  │
│                  │ Cost / available stones     │
├──────────────────┴─────────────────────────────┤
│ [Back]                               [Install] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1k.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1k.header` | 95vw | 10vh | W1k.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1k.header.title` | 77vw | 6vh | W1k.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1k.header.exit` | 8vw | 6vh | W1k.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1k.body` | 95vw | 70vh | W1k.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1k.body.activePane` | 90vw | 66vh | W1k.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1k.body.items` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.mounts` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.cards` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.installPreview` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.footer` | 95vw | 10vh | W1k.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1k.footer.closeBack` | 44vw | 6vh | W1k.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1k.footer.primary` | 44vw | 6vh | W1k.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1k.footer.singleAction` | 90vw | 6vh | W1k.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Install card                 [×] │
│ [Selection ▾]                    │
│ Selected item                    │
│ [Mount selector]                 │
│ [Compatible card selector]       │
│ Cost / available stones          │
├──────────────────────────────────┤
│ [Back]                 [Install] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1k.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1k.header` | 95vw | 10vh | W1k.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1k.header.title` | 77vw | 6vh | W1k.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1k.header.exit` | 8vw | 6vh | W1k.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1k.body` | 95vw | 70vh | W1k.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1k.body.activePane` | 90vw | 66vh | W1k.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1k.body.items` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.mounts` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.cards` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.installPreview` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.footer` | 95vw | 10vh | W1k.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1k.footer.closeBack` | 44vw | 6vh | W1k.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1k.footer.primary` | 44vw | 6vh | W1k.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1k.footer.singleAction` | 90vw | 6vh | W1k.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Install card          [×] │
│ [Selection ▾]             │
│                           │
│ Selected item             │
│ [Mount selector]          │
│ [Compatible card          │
│ selector]                 │
│ Cost / available stones   │
│                           │
├───────────────────────────┤
│ [Back]          [Install] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1k.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1k.header` | 95vw | 10vh | W1k.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1k.header.title` | 77vw | 6vh | W1k.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1k.header.exit` | 8vw | 6vh | W1k.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1k.body` | 95vw | 70vh | W1k.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1k.body.activePane` | 90vw | 66vh | W1k.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1k.body.items` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.mounts` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.cards` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.body.installPreview` | 90vw | 15vh | W1k.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1k.footer` | 95vw | 10vh | W1k.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1k.footer.closeBack` | 44vw | 6vh | W1k.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1k.footer.primary` | 44vw | 6vh | W1k.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1k.footer.singleAction` | 90vw | 6vh | W1k.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: installDefinition, runSnapshot, itemMountCardSelection
PARENT: W1; BODY: selection/detail with dependent selectors
plan = ExistingInstallPlan(runSnapshot)
model.body = ItemsMountsCompatibleCardsAndCost(plan, selection)
model.actions = BackAndInstallWithEligibility()
RenderWithW1(model)
ON selectItem: ClearMountAndCardSelection(); Reproject()
ON selectMount: ClearCardSelection(); Reproject()
ON selectCard(instanceId): ValidateLocalCandidate(); Reproject()
ON Install: DispatchExistingInstallCommand(itemRef, mountKey, instanceId, requestId)
ON rejection: PreserveValidSelectionsAndShowCurrentReason()
Do not change card ownership until the command commits.
```

### Wireframe W1l: New game slot selection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Same SaveSlotSelectionViewModel with a mode; New permits empty slots, Load does not. Selecting does not overwrite storage.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ New game                                   [×] │
│                                                │
│ ● Slot 1 · Identity / location                 │
│ ○ Slot 2 · Identity / location                 │
│ ○ Slot 3 · Empty                               │
│ [Delete selected, if offered]                  │
├────────────────────────────────────────────────┤
│ [Back]                      [Create character] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1l.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1l.header` | 95vw | 10vh | W1l.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1l.header.title` | 77vw | 6vh | W1l.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1l.header.exit` | 8vw | 6vh | W1l.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1l.body` | 95vw | 70vh | W1l.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1l.body.activePane` | 90vw | 66vh | W1l.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1l.body.slotList` | 90vw | 66vh | W1l.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1l.footer` | 95vw | 10vh | W1l.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1l.footer.closeBack` | 44vw | 6vh | W1l.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1l.footer.primary` | 44vw | 6vh | W1l.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1l.footer.singleAction` | 90vw | 6vh | W1l.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ New game                     [×] │
│ ● Slot 1 · Identity / location   │
│ ○ Slot 2 · Identity / location   │
│ ○ Slot 3 · Empty                 │
│ [Delete selected, if offered]    │
├──────────────────────────────────┤
│ [Back]        [Create character] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1l.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1l.header` | 95vw | 10vh | W1l.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1l.header.title` | 77vw | 6vh | W1l.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1l.header.exit` | 8vw | 6vh | W1l.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1l.body` | 95vw | 70vh | W1l.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1l.body.activePane` | 90vw | 66vh | W1l.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1l.body.slotList` | 90vw | 66vh | W1l.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1l.footer` | 95vw | 10vh | W1l.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1l.footer.closeBack` | 44vw | 6vh | W1l.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1l.footer.primary` | 44vw | 6vh | W1l.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1l.footer.singleAction` | 90vw | 6vh | W1l.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ New game              [×] │
│                           │
│ ● Slot 1 · Identity /     │
│ location                  │
│ ○ Slot 2 · Identity /     │
│ location                  │
│ ○ Slot 3 · Empty          │
│ [Delete selected, if      │
│ offered]                  │
│                           │
├───────────────────────────┤
│ [Back] [Create character] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1l.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1l.header` | 95vw | 10vh | W1l.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1l.header.title` | 77vw | 6vh | W1l.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1l.header.exit` | 8vw | 6vh | W1l.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1l.body` | 95vw | 70vh | W1l.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1l.body.activePane` | 90vw | 66vh | W1l.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1l.body.slotList` | 90vw | 66vh | W1l.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1l.footer` | 95vw | 10vh | W1l.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1l.footer.closeBack` | 44vw | 6vh | W1l.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1l.footer.primary` | 44vw | 6vh | W1l.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1l.footer.singleAction` | 90vw | 6vh | W1l.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: saveSlotSummaries, selectedSlot, draftCreationContext
PARENT: W1; BODY: shared SaveSlotSelection(mode = new)
model.body = SlotsWithEmptyAndOccupiedStates()
model.actions = BackAndCreateCharacter(selectedSlotIsValid)
RenderWithW1(model)
ON selectSlot(id): StoreProposedDestinationOnly()
ON CreateCharacter: OpenW1cWithDraftAndProposedDestination()
ON cancel: ReturnWithoutDeletingOrOverwritingAnySlot()
Occupied-slot replacement follows W2c at the approved write boundary.
```

### Wireframe W1m: Load game slot selection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Same SaveSlotSelectionViewModel with a mode; New permits empty slots, Load does not. Selecting does not overwrite storage.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Load game                                  [×] │
│                                                │
│ ● Slot 1 · Identity / location                 │
│ ○ Slot 2 · Identity / location                 │
│ ○ Slot 3 · Empty                               │
│ [Delete selected, if offered]                  │
├────────────────────────────────────────────────┤
│ [Back]                                  [Load] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1m.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1m.header` | 95vw | 10vh | W1m.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1m.header.title` | 77vw | 6vh | W1m.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1m.header.exit` | 8vw | 6vh | W1m.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1m.body` | 95vw | 70vh | W1m.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1m.body.activePane` | 90vw | 66vh | W1m.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1m.body.slotList` | 90vw | 66vh | W1m.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1m.footer` | 95vw | 10vh | W1m.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1m.footer.closeBack` | 44vw | 6vh | W1m.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1m.footer.primary` | 44vw | 6vh | W1m.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1m.footer.singleAction` | 90vw | 6vh | W1m.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Load game                    [×] │
│ ● Slot 1 · Identity / location   │
│ ○ Slot 2 · Identity / location   │
│ ○ Slot 3 · Empty                 │
│ [Delete selected, if offered]    │
├──────────────────────────────────┤
│ [Back]                    [Load] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1m.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1m.header` | 95vw | 10vh | W1m.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1m.header.title` | 77vw | 6vh | W1m.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1m.header.exit` | 8vw | 6vh | W1m.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1m.body` | 95vw | 70vh | W1m.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1m.body.activePane` | 90vw | 66vh | W1m.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1m.body.slotList` | 90vw | 66vh | W1m.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1m.footer` | 95vw | 10vh | W1m.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1m.footer.closeBack` | 44vw | 6vh | W1m.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1m.footer.primary` | 44vw | 6vh | W1m.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1m.footer.singleAction` | 90vw | 6vh | W1m.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Load game             [×] │
│                           │
│ ● Slot 1 · Identity /     │
│ location                  │
│ ○ Slot 2 · Identity /     │
│ location                  │
│ ○ Slot 3 · Empty          │
│ [Delete selected, if      │
│ offered]                  │
│                           │
├───────────────────────────┤
│ [Back]             [Load] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1m.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1m.header` | 95vw | 10vh | W1m.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1m.header.title` | 77vw | 6vh | W1m.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1m.header.exit` | 8vw | 6vh | W1m.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1m.body` | 95vw | 70vh | W1m.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1m.body.activePane` | 90vw | 66vh | W1m.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1m.body.slotList` | 90vw | 66vh | W1m.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1m.footer` | 95vw | 10vh | W1m.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1m.footer.closeBack` | 44vw | 6vh | W1m.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1m.footer.primary` | 44vw | 6vh | W1m.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1m.footer.singleAction` | 90vw | 6vh | W1m.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: saveSlotSummaries, selectedSlot, activeRunContext
PARENT: W1; BODY: shared SaveSlotSelection(mode = load)
model.body = SlotsWithLoadabilityAndReasons()
model.actions = BackAndLoad(selectedSlotCanLoad)
RenderWithW1(model)
ON selectSlot: UpdateLocalSelectionOnly()
ON Load:
    RefreshAndValidateSelectedSaveIdentity()
    IF activeProgressRequiresDecision: OpenW2dWithExactTarget()
    ELSE DispatchExistingLoadCommand()
ON DeleteSelected: OpenW2b; never delete on ordinary selection
Empty/unreadable/incompatible slots cannot load.
```

### Wireframe W1n: Inventory selection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. This body can live inside W1e; render one shell, not two.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Inventory                                  [×] │
├──────────────────┬─────────────────────────────┤
│ ○ Item A         │ Selected item               │
│ ● Item B         │ Stats / requirements        │
│                  │ Compared with equipped      │
│                  │ Eligibility / blocker       │
├──────────────────┴─────────────────────────────┤
│ [Back]                                 [Equip] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1n.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1n.header` | 95vw | 10vh | W1n.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1n.header.title` | 77vw | 6vh | W1n.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1n.header.exit` | 8vw | 6vh | W1n.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1n.body` | 95vw | 70vh | W1n.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1n.body.activePane` | 90vw | 66vh | W1n.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1n.body.items` | 44vw | 66vh | W1n.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.body.comparison` | 44vw | 66vh | W1n.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.footer` | 95vw | 10vh | W1n.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1n.footer.closeBack` | 44vw | 6vh | W1n.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1n.footer.primary` | 44vw | 6vh | W1n.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1n.footer.singleAction` | 90vw | 6vh | W1n.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Inventory                    [×] │
│ [Selection ▾]                    │
│ Selected item                    │
│ Stats / requirements             │
│ Compared with equipped           │
│ Eligibility / blocker            │
├──────────────────────────────────┤
│ [Back]                   [Equip] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1n.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1n.header` | 95vw | 10vh | W1n.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1n.header.title` | 77vw | 6vh | W1n.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1n.header.exit` | 8vw | 6vh | W1n.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1n.body` | 95vw | 70vh | W1n.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1n.body.activePane` | 90vw | 66vh | W1n.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1n.body.items` | 90vw | 32vh | W1n.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.body.comparison` | 90vw | 32vh | W1n.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.footer` | 95vw | 10vh | W1n.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1n.footer.closeBack` | 44vw | 6vh | W1n.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1n.footer.primary` | 44vw | 6vh | W1n.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1n.footer.singleAction` | 90vw | 6vh | W1n.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Inventory             [×] │
│ [Selection ▾]             │
│                           │
│ Selected item             │
│ Stats / requirements      │
│ Compared with equipped    │
│ Eligibility / blocker     │
│                           │
├───────────────────────────┤
│ [Back]            [Equip] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1n.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1n.header` | 95vw | 10vh | W1n.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1n.header.title` | 77vw | 6vh | W1n.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1n.header.exit` | 8vw | 6vh | W1n.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1n.body` | 95vw | 70vh | W1n.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1n.body.activePane` | 90vw | 66vh | W1n.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1n.body.items` | 90vw | 32vh | W1n.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.body.comparison` | 90vw | 32vh | W1n.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1n.footer` | 95vw | 10vh | W1n.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1n.footer.closeBack` | 44vw | 6vh | W1n.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1n.footer.primary` | 44vw | 6vh | W1n.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1n.footer.singleAction` | 90vw | 6vh | W1n.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: inventorySnapshot, equipmentContext, selectedItemRef
PARENT: W1; BODY: selection/detail, embeddable inside W1e
plan = ExistingEquipmentPreview(selectedItemRef, equipmentContext)
model.body = InventoryRowsAndSelectedComparison(plan)
model.actions = BackAndEquip(plan.allowed, plan.reason)
RenderInExistingW1BodyOrMountW1AsContextRequires()
ON selectItem: UpdateLocalSelectionAndPreview()
ON Equip: DispatchExistingEquipmentCommandWithStableRef()
RefreshFromDomainReceipt(); never mutate equipment in renderer.
```

### Wireframe W1o: Item inspection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Item name                                  [×] │
├────────────────────────────────────────────────┤
│ [Art, if present] │ Type · tags                │
│ Stats / requirements                           │
│ Effects                                        │
├────────────────────────────────────────────────┤
│ [           Applicable item action           ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1o.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1o.header` | 95vw | 10vh | W1o.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1o.header.title` | 77vw | 6vh | W1o.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1o.header.exit` | 8vw | 6vh | W1o.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1o.body` | 95vw | 70vh | W1o.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1o.body.activePane` | 90vw | 66vh | W1o.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1o.body.art` | 44vw | 66vh | W1o.body.activePane | next column, left to right | center / center | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.body.itemFacts` | 44vw | 66vh | W1o.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.footer` | 95vw | 10vh | W1o.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1o.footer.closeBack` | 44vw | 6vh | W1o.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1o.footer.primary` | 44vw | 6vh | W1o.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1o.footer.singleAction` | 90vw | 6vh | W1o.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Item name                    [×] │
│ [Small art, if present]          │
│ Type · tags                      │
│ Stats / requirements             │
│ Effects                          │
├──────────────────────────────────┤
│ [    Applicable item action    ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1o.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1o.header` | 95vw | 10vh | W1o.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1o.header.title` | 77vw | 6vh | W1o.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1o.header.exit` | 8vw | 6vh | W1o.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1o.body` | 95vw | 70vh | W1o.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1o.body.activePane` | 90vw | 66vh | W1o.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1o.body.art` | 90vw | 32vh | W1o.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.body.itemFacts` | 90vw | 32vh | W1o.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.footer` | 95vw | 10vh | W1o.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1o.footer.closeBack` | 44vw | 6vh | W1o.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1o.footer.primary` | 44vw | 6vh | W1o.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1o.footer.singleAction` | 90vw | 6vh | W1o.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Item name             [×] │
│ [Art, if present]         │
│                           │
│ Type · tags               │
│ Stats / requirements      │
│ Effects                   │
│                           │
├───────────────────────────┤
│ [Applicable item action ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1o.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1o.header` | 95vw | 10vh | W1o.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1o.header.title` | 77vw | 6vh | W1o.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1o.header.exit` | 8vw | 6vh | W1o.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1o.body` | 95vw | 70vh | W1o.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1o.body.activePane` | 90vw | 66vh | W1o.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1o.body.art` | 90vw | 32vh | W1o.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.body.itemFacts` | 90vw | 32vh | W1o.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1o.footer` | 95vw | 10vh | W1o.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1o.footer.closeBack` | 44vw | 6vh | W1o.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1o.footer.primary` | 44vw | 6vh | W1o.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1o.footer.singleAction` | 90vw | 6vh | W1o.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: itemDefinitionRef, instanceSnapshot, inspectionContext
PARENT: W1; BODY: inspection
model.body = ItemNameArtTagsStatsRequirementsAndEffects()
model.actions = ProjectOnlyApplicableItemActions(inspectionContext)
RenderWithW1(model, categoryRail = absent)
ON action: DispatchBoundDomainIntentWithCurrentInstanceRef()
ON close: RestoreOpenerThroughW0()
Inspection alone is read-only; no invented primary button.
```

### Wireframe W1p: Combatant inspection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Combatant name                             [×] │
├────────────────────────────────────────────────┤
│ [Art, if present] │ HP / resources             │
│ Status / intentions                            │
│ Known combat facts                             │
├────────────────────────────────────────────────┤
│ [                   Close                    ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1p.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1p.header` | 95vw | 10vh | W1p.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1p.header.title` | 77vw | 6vh | W1p.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1p.header.exit` | 8vw | 6vh | W1p.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1p.body` | 95vw | 70vh | W1p.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1p.body.activePane` | 90vw | 66vh | W1p.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1p.body.portrait` | 44vw | 66vh | W1p.body.activePane | next column, left to right | center / center | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.body.combatantFacts` | 44vw | 66vh | W1p.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.footer` | 95vw | 10vh | W1p.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1p.footer.closeBack` | 44vw | 6vh | W1p.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1p.footer.primary` | 44vw | 6vh | W1p.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1p.footer.singleAction` | 90vw | 6vh | W1p.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Combatant name               [×] │
│ [Small art, if present]          │
│ HP / resources                   │
│ Status / intentions              │
│ Known combat facts               │
├──────────────────────────────────┤
│ [            Close             ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1p.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1p.header` | 95vw | 10vh | W1p.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1p.header.title` | 77vw | 6vh | W1p.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1p.header.exit` | 8vw | 6vh | W1p.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1p.body` | 95vw | 70vh | W1p.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1p.body.activePane` | 90vw | 66vh | W1p.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1p.body.portrait` | 90vw | 32vh | W1p.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.body.combatantFacts` | 90vw | 32vh | W1p.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.footer` | 95vw | 10vh | W1p.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1p.footer.closeBack` | 44vw | 6vh | W1p.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1p.footer.primary` | 44vw | 6vh | W1p.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1p.footer.singleAction` | 90vw | 6vh | W1p.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Combatant name        [×] │
│ [Art, if present]         │
│                           │
│ HP / resources            │
│ Status / intentions       │
│ Known combat facts        │
│                           │
├───────────────────────────┤
│ [         Close         ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1p.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1p.header` | 95vw | 10vh | W1p.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1p.header.title` | 77vw | 6vh | W1p.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1p.header.exit` | 8vw | 6vh | W1p.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1p.body` | 95vw | 70vh | W1p.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1p.body.activePane` | 90vw | 66vh | W1p.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1p.body.portrait` | 90vw | 32vh | W1p.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.body.combatantFacts` | 90vw | 32vh | W1p.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1p.footer` | 95vw | 10vh | W1p.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1p.footer.closeBack` | 44vw | 6vh | W1p.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1p.footer.primary` | 44vw | 6vh | W1p.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1p.footer.singleAction` | 90vw | 6vh | W1p.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: combatantRef, committedCombatSnapshot, visibilityRules
PARENT: W1; BODY: inspection
model.body = VisibleCombatantIdentityVitalsStatusesAndIntent()
model.actions = CloseIfApplicable()
RenderWithW1(model, categoryRail = absent)
ON snapshotUpdate: RefreshVisibleFactsWithoutStealingFocus()
ON close: RestoreCombatInputScopeThroughW0()
Do not reveal hidden intent or mutate combat during inspection.
```

### Wireframe W1q: Potion inspection

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Potion name                                [×] │
├────────────────────────────────────────────────┤
│ [Art, if present] │ Charges / capacity         │
│ Effect                                         │
│ Use eligibility                                │
├────────────────────────────────────────────────┤
│ [                Use if legal                ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1q.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1q.header` | 95vw | 10vh | W1q.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1q.header.title` | 77vw | 6vh | W1q.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1q.header.exit` | 8vw | 6vh | W1q.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1q.body` | 95vw | 70vh | W1q.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1q.body.activePane` | 90vw | 66vh | W1q.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1q.body.art` | 44vw | 66vh | W1q.body.activePane | next column, left to right | center / center | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.body.potionFacts` | 44vw | 66vh | W1q.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.footer` | 95vw | 10vh | W1q.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1q.footer.closeBack` | 44vw | 6vh | W1q.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1q.footer.primary` | 44vw | 6vh | W1q.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1q.footer.singleAction` | 90vw | 6vh | W1q.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Potion name                  [×] │
│ [Small art, if present]          │
│ Charges / capacity               │
│ Effect                           │
│ Use eligibility                  │
├──────────────────────────────────┤
│ [         Use if legal         ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1q.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1q.header` | 95vw | 10vh | W1q.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1q.header.title` | 77vw | 6vh | W1q.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1q.header.exit` | 8vw | 6vh | W1q.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1q.body` | 95vw | 70vh | W1q.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1q.body.activePane` | 90vw | 66vh | W1q.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1q.body.art` | 90vw | 32vh | W1q.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.body.potionFacts` | 90vw | 32vh | W1q.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.footer` | 95vw | 10vh | W1q.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1q.footer.closeBack` | 44vw | 6vh | W1q.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1q.footer.primary` | 44vw | 6vh | W1q.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1q.footer.singleAction` | 90vw | 6vh | W1q.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Potion name           [×] │
│ [Art, if present]         │
│                           │
│ Charges / capacity        │
│ Effect                    │
│ Use eligibility           │
│                           │
├───────────────────────────┤
│ [     Use if legal      ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1q.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1q.header` | 95vw | 10vh | W1q.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1q.header.title` | 77vw | 6vh | W1q.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1q.header.exit` | 8vw | 6vh | W1q.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1q.body` | 95vw | 70vh | W1q.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1q.body.activePane` | 90vw | 66vh | W1q.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1q.body.art` | 90vw | 32vh | W1q.body.activePane | next row, top to bottom | center / center | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.body.potionFacts` | 90vw | 32vh | W1q.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1q.footer` | 95vw | 10vh | W1q.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1q.footer.closeBack` | 44vw | 6vh | W1q.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1q.footer.primary` | 44vw | 6vh | W1q.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1q.footer.singleAction` | 90vw | 6vh | W1q.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: potionRef, runSnapshot, useContext
PARENT: W1; BODY: inspection
plan = ExistingPotionUsePlan(potionRef, useContext)
model.body = PotionIdentityChargesEffectAndEligibility(plan)
model.actions = UseOnlyWhenOfferedByContext()
RenderWithW1(model, categoryRail = absent)
ON Use: DispatchExistingPotionCommandAndRevalidateCharges()
ON result: RefreshChargesAndEffectReceipt()
Charges retain semantic resource colors; Use follows primary-state palette.
```

### Wireframe W1r: Save status

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. No art slot. Retry saves storage; it never repeats a gameplay transaction.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Save game                                  [×] │
│                                                │
│ Character · Location                           │
│ Destination: active slot                       │
│ Last saved: …                                  │
│ [Saved status / error]                         │
├────────────────────────────────────────────────┤
│ [Back]                                  [Save] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1r.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1r.header` | 95vw | 10vh | W1r.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1r.header.title` | 77vw | 6vh | W1r.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1r.header.exit` | 8vw | 6vh | W1r.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1r.body` | 95vw | 70vh | W1r.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1r.body.activePane` | 90vw | 66vh | W1r.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1r.body.saveIdentity` | 44vw | 66vh | W1r.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.body.saveStatus` | 44vw | 66vh | W1r.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.footer` | 95vw | 10vh | W1r.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1r.footer.closeBack` | 44vw | 6vh | W1r.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1r.footer.primary` | 44vw | 6vh | W1r.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1r.footer.singleAction` | 90vw | 6vh | W1r.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Save game                    [×] │
│ Character · Location             │
│ Destination: active slot         │
│ Last saved: …                    │
│ [Saved status / error]           │
├──────────────────────────────────┤
│ [Back]                    [Save] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1r.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1r.header` | 95vw | 10vh | W1r.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1r.header.title` | 77vw | 6vh | W1r.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1r.header.exit` | 8vw | 6vh | W1r.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1r.body` | 95vw | 70vh | W1r.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1r.body.activePane` | 90vw | 66vh | W1r.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1r.body.saveIdentity` | 90vw | 32vh | W1r.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.body.saveStatus` | 90vw | 32vh | W1r.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.footer` | 95vw | 10vh | W1r.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1r.footer.closeBack` | 44vw | 6vh | W1r.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1r.footer.primary` | 44vw | 6vh | W1r.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1r.footer.singleAction` | 90vw | 6vh | W1r.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Save game             [×] │
│                           │
│ Character · Location      │
│ Destination: active slot  │
│ Last saved: …             │
│ [Saved status / error]    │
│                           │
├───────────────────────────┤
│ [Back]             [Save] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1r.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1r.header` | 95vw | 10vh | W1r.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1r.header.title` | 77vw | 6vh | W1r.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1r.header.exit` | 8vw | 6vh | W1r.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1r.body` | 95vw | 70vh | W1r.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1r.body.activePane` | 90vw | 66vh | W1r.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1r.body.saveIdentity` | 90vw | 32vh | W1r.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.body.saveStatus` | 90vw | 32vh | W1r.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1r.footer` | 95vw | 10vh | W1r.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1r.footer.closeBack` | 44vw | 6vh | W1r.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1r.footer.primary` | 44vw | 6vh | W1r.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1r.footer.singleAction` | 90vw | 6vh | W1r.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: activeRunIdentity, activeSlotIdentity, saveStatus
PARENT: W1; BODY: status, no art slot
model.body = CharacterLocationDestinationLastSavedAndStatus()
model.actions = BackAndSave(existingSaveCapability)
RenderWithW1(model)
ON Save:
    SetBusy(); result = PersistenceCoordinator.SaveCurrentCommittedRun()
    ClearBusy(); DisplaySavedOrFailure(result)
ON Retry: RetryPersistenceOnly()
Do not replay gameplay commands or silently select another destination.
```

### Wireframe W1s: Rest

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Rest                       {Status}            │
│                                                │
│ [Recover] [Service]                            │
│ Recovery values / service cost                 │
│ Availability / reason                          │
│                                                │
├────────────────────────────────────────────────┤
│ [                  Continue                  ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1s.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1s.header` | 95vw | 10vh | W1s.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1s.header.title` | 77vw | 6vh | W1s.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1s.header.exit` | 8vw | 6vh | W1s.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1s.body` | 95vw | 70vh | W1s.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1s.body.activePane` | 90vw | 66vh | W1s.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1s.body.restChoices` | 44vw | 66vh | W1s.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.body.consequences` | 44vw | 66vh | W1s.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.footer` | 95vw | 10vh | W1s.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1s.footer.closeBack` | 44vw | 6vh | W1s.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1s.footer.primary` | 44vw | 6vh | W1s.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1s.footer.singleAction` | 90vw | 6vh | W1s.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Rest · {Status}                  │
│ [Recover] [Service]              │
│ Recovery values / service cost   │
│ Availability / reason            │
├──────────────────────────────────┤
│ [           Continue           ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1s.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1s.header` | 95vw | 10vh | W1s.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1s.header.title` | 77vw | 6vh | W1s.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1s.header.exit` | 8vw | 6vh | W1s.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1s.body` | 95vw | 70vh | W1s.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1s.body.activePane` | 90vw | 66vh | W1s.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1s.body.restChoices` | 90vw | 32vh | W1s.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.body.consequences` | 90vw | 32vh | W1s.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.footer` | 95vw | 10vh | W1s.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1s.footer.closeBack` | 44vw | 6vh | W1s.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1s.footer.primary` | 44vw | 6vh | W1s.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1s.footer.singleAction` | 90vw | 6vh | W1s.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Rest                      │
│ {Status}                  │
│                           │
│ [Recover] [Service]       │
│ Recovery values / service │
│ cost                      │
│ Availability / reason     │
│                           │
├───────────────────────────┤
│ [       Continue        ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1s.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1s.header` | 95vw | 10vh | W1s.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1s.header.title` | 77vw | 6vh | W1s.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1s.header.exit` | 8vw | 6vh | W1s.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1s.body` | 95vw | 70vh | W1s.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1s.body.activePane` | 90vw | 66vh | W1s.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1s.body.restChoices` | 90vw | 32vh | W1s.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.body.consequences` | 90vw | 32vh | W1s.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1s.footer` | 95vw | 10vh | W1s.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1s.footer.closeBack` | 44vw | 6vh | W1s.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1s.footer.primary` | 44vw | 6vh | W1s.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1s.footer.singleAction` | 90vw | 6vh | W1s.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: restDefinition, runSnapshot, refillAndServiceContext
PARENT: W1; BODY: choice/progression
plan = ExistingRestAndServicePlans()
model.body = RecoveryValuesOptionsCostsAndReasons(plan)
model.actions = ExistingContinueOrRestAction()
RenderWithW1(model)
ON service: OpenRegisteredServicePresenter()
ON recovery: DispatchValidatedRestCommand()
ON result: PreserveExistingOneUseOrMultiUseContinuation()
No healing, refill, or service mutation from rendering a choice.
```

### Wireframe W1t: Rewards

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Rewards                       {Status}         │
│                                                │
│ [Reward] [Reward]                              │
│ Claimed / available state                      │
│ Required choice, if any                        │
│                                                │
├────────────────────────────────────────────────┤
│ [                  Continue                  ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1t.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1t.header` | 95vw | 10vh | W1t.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1t.header.title` | 77vw | 6vh | W1t.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1t.header.exit` | 8vw | 6vh | W1t.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1t.body` | 95vw | 70vh | W1t.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1t.body.activePane` | 90vw | 66vh | W1t.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1t.body.rewardChoices` | 44vw | 66vh | W1t.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.body.claimStatus` | 44vw | 66vh | W1t.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.footer` | 95vw | 10vh | W1t.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1t.footer.closeBack` | 44vw | 6vh | W1t.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1t.footer.primary` | 44vw | 6vh | W1t.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1t.footer.singleAction` | 90vw | 6vh | W1t.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Rewards · {Status}               │
│ [Reward] [Reward]                │
│ Claimed / available state        │
│ Required choice, if any          │
├──────────────────────────────────┤
│ [           Continue           ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1t.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1t.header` | 95vw | 10vh | W1t.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1t.header.title` | 77vw | 6vh | W1t.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1t.header.exit` | 8vw | 6vh | W1t.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1t.body` | 95vw | 70vh | W1t.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1t.body.activePane` | 90vw | 66vh | W1t.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1t.body.rewardChoices` | 90vw | 32vh | W1t.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.body.claimStatus` | 90vw | 32vh | W1t.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.footer` | 95vw | 10vh | W1t.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1t.footer.closeBack` | 44vw | 6vh | W1t.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1t.footer.primary` | 44vw | 6vh | W1t.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1t.footer.singleAction` | 90vw | 6vh | W1t.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Rewards                   │
│ {Status}                  │
│                           │
│ [Reward] [Reward]         │
│ Claimed / available state │
│ Required choice, if any   │
│                           │
├───────────────────────────┤
│ [       Continue        ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1t.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1t.header` | 95vw | 10vh | W1t.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1t.header.title` | 77vw | 6vh | W1t.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1t.header.exit` | 8vw | 6vh | W1t.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1t.body` | 95vw | 70vh | W1t.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1t.body.activePane` | 90vw | 66vh | W1t.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1t.body.rewardChoices` | 90vw | 32vh | W1t.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.body.claimStatus` | 90vw | 32vh | W1t.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1t.footer` | 95vw | 10vh | W1t.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1t.footer.closeBack` | 44vw | 6vh | W1t.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1t.footer.primary` | 44vw | 6vh | W1t.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1t.footer.singleAction` | 90vw | 6vh | W1t.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: persistedPendingRewards, currentPossessions, claimState
PARENT: W1; BODY: choice/progression
plan = ExistingRewardPlan(pendingRewards, capacities)
model.body = RewardChoicesAndClaimedAvailableBlockedStates(plan)
model.actions = ContinueFromExistingRewardPolicy(plan)
RenderWithW1(model)
ON chooseReward: DispatchRegisteredClaimCommand(stableRewardRef)
ON Continue: ResolveExistingAutomaticAndOptionalClaimsThroughDomainCommand()
ON result: PersistPendingRewardProgressAndNavigateWhenComplete()
Reload/duplicate activation must not grant a reward twice or reroll choices.
```

### Wireframe W1u: Event

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Preserve story text and legal mandatory choices.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Event name                       {Status}      │
│                                                │
│ Necessary authored narrative                   │
│ [Response] [Response]                          │
│ Cost / consequence                             │
│                                                │
├────────────────────────────────────────────────┤
│ [           Continue when allowed            ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1u.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1u.header` | 95vw | 10vh | W1u.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1u.header.title` | 77vw | 6vh | W1u.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1u.header.exit` | 8vw | 6vh | W1u.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1u.body` | 95vw | 70vh | W1u.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1u.body.activePane` | 90vw | 66vh | W1u.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1u.body.narrative` | 44vw | 66vh | W1u.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.body.responses` | 44vw | 66vh | W1u.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.footer` | 95vw | 10vh | W1u.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1u.footer.closeBack` | 44vw | 6vh | W1u.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1u.footer.primary` | 44vw | 6vh | W1u.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1u.footer.singleAction` | 90vw | 6vh | W1u.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Event name · {Status}            │
│ Necessary authored narrative     │
│ [Response] [Response]            │
│ Cost / consequence               │
├──────────────────────────────────┤
│ [    Continue when allowed     ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1u.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1u.header` | 95vw | 10vh | W1u.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1u.header.title` | 77vw | 6vh | W1u.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1u.header.exit` | 8vw | 6vh | W1u.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1u.body` | 95vw | 70vh | W1u.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1u.body.activePane` | 90vw | 66vh | W1u.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1u.body.narrative` | 90vw | 32vh | W1u.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.body.responses` | 90vw | 32vh | W1u.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.footer` | 95vw | 10vh | W1u.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1u.footer.closeBack` | 44vw | 6vh | W1u.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1u.footer.primary` | 44vw | 6vh | W1u.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1u.footer.singleAction` | 90vw | 6vh | W1u.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Event name                │
│ {Status}                  │
│                           │
│ Necessary authored        │
│ narrative                 │
│ [Response] [Response]     │
│ Cost / consequence        │
│                           │
├───────────────────────────┤
│ [ Continue when allowed ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1u.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1u.header` | 95vw | 10vh | W1u.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1u.header.title` | 77vw | 6vh | W1u.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1u.header.exit` | 8vw | 6vh | W1u.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1u.body` | 95vw | 70vh | W1u.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1u.body.activePane` | 90vw | 66vh | W1u.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1u.body.narrative` | 90vw | 32vh | W1u.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.body.responses` | 90vw | 32vh | W1u.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1u.footer` | 95vw | 10vh | W1u.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1u.footer.closeBack` | 44vw | 6vh | W1u.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1u.footer.primary` | 44vw | 6vh | W1u.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1u.footer.singleAction` | 90vw | 6vh | W1u.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: eventDefinition, questHistory, runSnapshot
PARENT: W1; BODY: choice/progression, page presentation when required
choices = ExistingAvailableEventChoices(history, snapshot)
model.body = EventTitleNarrativeChoicesAndConsequences(choices)
model.actions = OnlyLegalExistingContinuationActions()
model.capabilities.close = ApprovedEventExitCapability()
RenderWithW1(model)
ON chooseResponse(choiceId):
    ApplyExistingConfirmationPolicy()
    DispatchEventCommandRevalidatingRequirementsAndRecordingHistoryOnce()
ON result: ShowResultOrNavigateToExistingCombatTransition()
Rendering and navigation Back never apply event effects.
```

### Wireframe W1v: Shop offers

**Parent: W1.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Body only inside W1d; category name need not be repeated when navigation labels it clearly.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Selected shop category                         │
│ {Status}                                       │
│                                                │
│ [Offer + price] [Offer + price]                │
│ Availability with each offer                   │
│ Selected offer detail                          │
│                                                │
├────────────────────────────────────────────────┤
│ [           Selected offer action            ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1v.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1v.header` | 95vw | 10vh | W1v.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1v.header.title` | 77vw | 6vh | W1v.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1v.header.exit` | 8vw | 6vh | W1v.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1v.body` | 95vw | 70vh | W1v.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1v.body.activePane` | 90vw | 66vh | W1v.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1v.body.offers` | 44vw | 66vh | W1v.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.body.offerDetail` | 44vw | 66vh | W1v.body.activePane | next column, left to right | start / start | normal grid flow | 2vw column gap | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.footer` | 95vw | 10vh | W1v.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1v.footer.closeBack` | 44vw | 6vh | W1v.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1v.footer.primary` | 44vw | 6vh | W1v.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1v.footer.singleAction` | 90vw | 6vh | W1v.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Selected shop category ·         │
│ {Status}                         │
│ [Offer + price] [Offer + price]  │
│ Availability with each offer     │
│ Selected offer detail            │
├──────────────────────────────────┤
│ [    Selected offer action     ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1v.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1v.header` | 95vw | 10vh | W1v.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1v.header.title` | 77vw | 6vh | W1v.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1v.header.exit` | 8vw | 6vh | W1v.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1v.body` | 95vw | 70vh | W1v.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1v.body.activePane` | 90vw | 66vh | W1v.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1v.body.offers` | 90vw | 32vh | W1v.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.body.offerDetail` | 90vw | 32vh | W1v.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.footer` | 95vw | 10vh | W1v.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1v.footer.closeBack` | 44vw | 6vh | W1v.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1v.footer.primary` | 44vw | 6vh | W1v.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1v.footer.singleAction` | 90vw | 6vh | W1v.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Selected shop category    │
│ {Status}                  │
│                           │
│ [Offer + price] [Offer +  │
│ price]                    │
│ Availability with each    │
│ offer                     │
│ Selected offer detail     │
│                           │
├───────────────────────────┤
│ [ Selected offer action ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1v.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1v.header` | 95vw | 10vh | W1v.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1v.header.title` | 77vw | 6vh | W1v.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1v.header.exit` | 8vw | 6vh | W1v.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1v.body` | 95vw | 70vh | W1v.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1v.body.activePane` | 90vw | 66vh | W1v.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1v.body.offers` | 90vw | 32vh | W1v.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.body.offerDetail` | 90vw | 32vh | W1v.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W1v.footer` | 95vw | 10vh | W1v.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1v.footer.closeBack` | 44vw | 6vh | W1v.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1v.footer.primary` | 44vw | 6vh | W1v.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1v.footer.singleAction` | 90vw | 6vh | W1v.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: activeShopCategory, savedStock, runSnapshot
PARENT: W1; BODY embedded in W1d, not another complete shell
offers = DomainShopQuery(activeCategory, snapshot, savedStock)
body = OfferCardsWithPricesEligibilityAndSelectedDetails(offers)
ReturnBodyModelToW1d(body)
ON offerSelected: EmitSelectionIntent(stableOfferRef)
ON offerActivated: EmitRegisteredBuySellOrRemoveIntent()
W1d owns navigation/footer; domain command owns pricing and mutation.
```

### Wireframe W1w: Entity inspector

**Parent: W1.** Inherits W1/W0. Combatant context: entity name is the modal title. Left is sprite, name and HP only; no intent/defense/effect overlays. Right starts with HP/Intent/Defense in one row, followed by Current state (stance, resources, statuses, buildup in matching label/value rows), Previous actions newest-first, Known abilities, Known traits (weaknesses/resistances), then Lore. Use shared left-aligned label/value columns throughout. Only right details scroll; header/footer stay anchored. No placeholder action: Back fills footer width. Actual contextual commands may use inherited inline two-action footer. Other entities retain their registered detail model. Source facts come from one knowledge-filtered snapshot; examples are illustrative.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ {Combatant name}                           [×] │
├────────────────────────────────────────────────┤
│ Sprite      │ HP | Intent | Defense            │
│             │ Current state                    │
│             │ Stance / resources / effects     │
│             │ Previous actions                 │
│             │ Known abilities                  │
│             │ Known traits                     │
│ Name        │ Lore                             │
│ [HP bar]    │ Details scroll independently     │
├────────────────────────────────────────────────┤
│ [                    Back                    ] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1w.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1w.header` | 95vw | 10vh | W1w.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1w.header.title` | 77vw | 6vh | W1w.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1w.header.exit` | 8vw | 6vh | W1w.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1w.body` | 95vw | 70vh | W1w.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1w.body.activePane` | 90vw | 66vh | W1w.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W1w.body.cardPreview` | 30.6vw | 66vh | W1w.body.activePane | left / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Left: contained sprite/name/HP; max14rem preview width; no overlays |
| `W1w.body.details` | 57.4vw | 66vh | W1w.body.activePane | right / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Right scroll owner; uniform label/value columns |
| `W1w.body.details.summary` | 57.4vw | 6vh | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Top: HP / Intent / Defense in one horizontal row |
| `W1w.body.details.currentState` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.previousActions` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownAbilities` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownTraits` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.lore` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.footer` | 95vw | 10vh | W1w.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1w.footer.closeBack` | 44vw | 6vh | W1w.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1w.footer.primary` | 44vw | 6vh | W1w.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1w.footer.singleAction` | 90vw | 6vh | W1w.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ {Name}                       [×] │
├──────────────────────────────────┤
│ Sprite  │ HP / Intent / Defense  │
│         │ Current state          │
│         │ Previous actions       │
│         │ Known abilities        │
│         │ Known traits           │
│ Name    │ Lore                   │
│ [HP]    │ Scroll details         │
├──────────────────────────────────┤
│ [             Back             ] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1w.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1w.header` | 95vw | 10vh | W1w.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1w.header.title` | 77vw | 6vh | W1w.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1w.header.exit` | 8vw | 6vh | W1w.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1w.body` | 95vw | 70vh | W1w.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1w.body.activePane` | 90vw | 66vh | W1w.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1w.body.cardPreview` | 30.6vw | 66vh | W1w.body.activePane | left / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Left: contained sprite/name/HP; max14rem preview width; no overlays |
| `W1w.body.details` | 57.4vw | 66vh | W1w.body.activePane | right / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Right scroll owner; uniform label/value columns |
| `W1w.body.details.summary` | 57.4vw | 6vh | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Top: HP / Intent / Defense in one horizontal row |
| `W1w.body.details.currentState` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.previousActions` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownAbilities` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownTraits` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.lore` | 57.4vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.footer` | 95vw | 10vh | W1w.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1w.footer.closeBack` | 44vw | 6vh | W1w.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1w.footer.primary` | 44vw | 6vh | W1w.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1w.footer.singleAction` | 90vw | 6vh | W1w.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ {Name}                [×] │
├───────────────────────────┤
│ Sprite │ HP Intent        │
│ Defense                   │
│        │ Current state    │
│        │ Previous actions │
│        │ Known abilities  │
│        │ Known traits     │
│ Name   │ Lore             │
│ [HP]   │ Details scroll   │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W1w.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W1w.header` | 95vw | 10vh | W1w.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W1w.header.title` | 77vw | 6vh | W1w.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W1w.header.exit` | 8vw | 6vh | W1w.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W1w.body` | 95vw | 70vh | W1w.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W1w.body.activePane` | 90vw | 66vh | W1w.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W1w.body.cardPreview` | 28.8vw | 66vh | W1w.body.activePane | left / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Left: contained sprite/name/HP; max14rem preview width; no overlays |
| `W1w.body.details` | 59.2vw | 66vh | W1w.body.activePane | right / top | start / start | two-column grid in every mode | 2vw column gap; body inset inherited | Right scroll owner; uniform label/value columns |
| `W1w.body.details.summary` | 59.2vw | 6vh | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Top: HP / Intent / Defense in one horizontal row |
| `W1w.body.details.currentState` | 59.2vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.previousActions` | 59.2vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownAbilities` | 59.2vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.knownTraits` | 59.2vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.body.details.lore` | 59.2vw | auto; content | W1w.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Ordered normal-flow section; content height may exceed scroll viewport |
| `W1w.footer` | 95vw | 10vh | W1w.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W1w.footer.closeBack` | 44vw | 6vh | W1w.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W1w.footer.primary` | 44vw | 6vh | W1w.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W1w.footer.singleAction` | 90vw | 6vh | W1w.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: entityRef, context, returnFocusTarget
PARENT: W1
ResolveCurrentEntityOrShowUnavailableState()
MountInheritedW1Shell(title, exit, inlineFooter)
ReplaceCategoryRailWithReadOnlyCardPreview()
UseTwoColumns(leftCard=config.inspector.previewFractionForMode, gap=config.inspector.gapVw, rightDetails=remaining)
ContainLeftPreview(maxWidth=config.inspector.maxPreviewWidthRem); reserve header and footer
AlignFactLabelsAndValuesToSharedLeftAlignedColumns()
IfNoRelevantDomainAction: RenderFullWidthBackButton()
RenderWC0PreviewWithInheritedRatiosAndNoNestedInfoButton()
IF combatant: RenderOnlySpriteNameAndHPInLeftPreview()
IF combatant: ProjectAvailableResourcesIntentDefenseStanceStatusesBuildupIntoRightPane()
UseRegisteredDetailProvidersFromTheSameCombatantSnapshot()
SetModalTitle(combatant.displayName)
RenderTopSummary(HP, intent, defense)
FilterCurrentOptionalFactsByDomainActivity(); preserve known history/lore
RenderOrderedSections(currentState, previousActions, knownAbilities, knownTraits, lore)
ApplyPlayerKnowledgeFilterBeforeRendering(); distinguish unknown from none
AlignAllFactLabelsAndValuesToSharedColumns(); body scrolls independently
ProjectDetailsFromRegisteredTagComponentsAndDomainQueries()
KeepCardLeftAndDetailsRightInWideCompactPortrait()
ScrollOnlyDetailsWhenRequired; preserve readable minimums
ON primary: ExistingDomainCommandRevalidatesEntityAndContext()
ON close/back/escape: DisposeThenRestoreOriginSelectionAndFocus()
ON entityRemoved: DisableDomainActionsAndShowUnavailableReason()
No timer callbacks or preview activation may open another inspector.
```

## Wireframe W2: Confirmation variant

**Parent: W0.** Compact decision shell sharing W1 primitives/lifecycle. Safe focus, cancellation, shielding, and emphasis are centrally implemented policies.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ {Concrete question}                        [×] │
│                                                │
│ {Target identity}                              │
│ {Exact consequence}                            │
│                                                │
│ [Back]                                [Action] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2.header` | 50vw | 10vh | W2.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2.header.title` | 32vw | 6vh | W2.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2.header.exit` | 8vw | 6vh | W2.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2.body` | 50vw | 30vh | W2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2.body.activePane` | 45vw | 26vh | W2.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2.body.target` | 45vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.body.consequence` | 45vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.footer` | 50vw | 10vh | W2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2.footer.closeBack` | 21.5vw | 6vh | W2.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2.footer.primary` | 21.5vw | 6vh | W2.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2.footer.singleAction` | 45vw | 6vh | W2.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ {Concrete question}          [×] │
│ {Target identity}                │
│ {Exact consequence}              │
│ [Back]                  [Action] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2.header` | 90vw | 10vh | W2.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2.header.title` | 72vw | 6vh | W2.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2.header.exit` | 8vw | 6vh | W2.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2.body` | 90vw | 30vh | W2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2.body.activePane` | 85vw | 26vh | W2.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2.body.target` | 85vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.body.consequence` | 85vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.footer` | 90vw | 10vh | W2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2.footer.closeBack` | 41.5vw | 6vh | W2.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2.footer.primary` | 41.5vw | 6vh | W2.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2.footer.singleAction` | 85vw | 6vh | W2.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ {Concrete question}   [×] │
│                           │
│ {Target identity}         │
│ {Exact consequence}       │
│                           │
│ [Back]           [Action] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2.header` | 90vw | 10vh | W2.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2.header.title` | 72vw | 6vh | W2.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2.header.exit` | 8vw | 6vh | W2.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2.body` | 90vw | 30vh | W2.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2.body.activePane` | 85vw | 26vh | W2.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2.body.target` | 85vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.body.consequence` | 85vw | 12vh | W2.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2.footer` | 90vw | 10vh | W2.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2.footer.closeBack` | 41.5vw | 6vh | W2.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2.footer.primary` | 41.5vw | 6vh | W2.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2.footer.singleAction` | 85vw | 6vh | W2.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: exactTarget, consequence, decisionPolicy, confirmBinding
PARENT: W0; VARIANT: compact confirmation
model.body = ConcreteQuestionTargetAndConsequence()
model.actions = BackAndConfirmWithCurrentEligibility()
model.paletteException = DestructivePolicyIfApplicable()
MountThroughW0(model); FocusSafeActionAccordingToPolicy()
ON confirm:
    IF alreadyCommitting: RETURN
    RevalidateExactTargetAndReviewedConsequence()
    IF changed: RefreshReviewWithoutCommitting(); RETURN
    result = DispatchBoundCommandOnce(stableRequestId)
    IF rejected: KeepDecisionOpenAndShowReason()
    ELSE CloseWithConfirmReasonAndPreserveNavigationInputShield()
ON Back/Exit: CancelOnceWithoutCallingConfirm()
ON replace/dispose: ReleaseResourcesWithoutPretendingUserConfirmedOrCancelled()
```

### Wireframe W2a: Service confirmation

**Parent: W2.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Apply this service?                        [×] │
│                                                │
│ Item / target                                  │
│ Exact cost and changes                         │
│                                                │
│ [Back]                               [Confirm] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2a.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2a.header` | 50vw | 10vh | W2a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2a.header.title` | 32vw | 6vh | W2a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2a.header.exit` | 8vw | 6vh | W2a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2a.body` | 50vw | 30vh | W2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2a.body.activePane` | 45vw | 26vh | W2a.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2a.body.target` | 45vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.body.consequence` | 45vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.footer` | 50vw | 10vh | W2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2a.footer.closeBack` | 21.5vw | 6vh | W2a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2a.footer.primary` | 21.5vw | 6vh | W2a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2a.footer.singleAction` | 45vw | 6vh | W2a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Apply this service?          [×] │
│ Item / target                    │
│ Exact cost and changes           │
│ [Back]                 [Confirm] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2a.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2a.header` | 90vw | 10vh | W2a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2a.header.title` | 72vw | 6vh | W2a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2a.header.exit` | 8vw | 6vh | W2a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2a.body` | 90vw | 30vh | W2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2a.body.activePane` | 85vw | 26vh | W2a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2a.body.target` | 85vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.body.consequence` | 85vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.footer` | 90vw | 10vh | W2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2a.footer.closeBack` | 41.5vw | 6vh | W2a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2a.footer.primary` | 41.5vw | 6vh | W2a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2a.footer.singleAction` | 85vw | 6vh | W2a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Apply this service?   [×] │
│                           │
│ Item / target             │
│ Exact cost and changes    │
│                           │
│ [Back]          [Confirm] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2a.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2a.header` | 90vw | 10vh | W2a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2a.header.title` | 72vw | 6vh | W2a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2a.header.exit` | 8vw | 6vh | W2a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2a.body` | 90vw | 30vh | W2a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2a.body.activePane` | 85vw | 26vh | W2a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2a.body.target` | 85vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.body.consequence` | 85vw | 12vh | W2a.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2a.footer` | 90vw | 10vh | W2a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2a.footer.closeBack` | 41.5vw | 6vh | W2a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2a.footer.primary` | 41.5vw | 6vh | W2a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2a.footer.singleAction` | 85vw | 6vh | W2a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: selectedServicePlan, targetRef, existingConfirmationPolicy
PARENT: W2
model = ServiceQuestionExactCostChangesAndTarget(selectedServicePlan)
confirmBinding = RegisteredServiceCommand(targetRef, reviewedConsequence)
RenderWithW2(model, confirmBinding)
ON stalePlan: RefreshSelectionReviewInsteadOfChargingDifferentCost()
ON success: ReturnReceiptToServicePresenter()
All arming, focus, cancellation and input shielding remain inherited.
```

### Wireframe W2b: Delete save

**Parent: W2.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Delete this save?                          [×] │
│                                                │
│ Slot · Character                               │
│ Actual loss / retention policy                 │
│                                                │
│ [Back]                                [Delete] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2b.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2b.header` | 50vw | 10vh | W2b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2b.header.title` | 32vw | 6vh | W2b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2b.header.exit` | 8vw | 6vh | W2b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2b.body` | 50vw | 30vh | W2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2b.body.activePane` | 45vw | 26vh | W2b.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2b.body.target` | 45vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.body.consequence` | 45vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.footer` | 50vw | 10vh | W2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2b.footer.closeBack` | 21.5vw | 6vh | W2b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2b.footer.primary` | 21.5vw | 6vh | W2b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2b.footer.singleAction` | 45vw | 6vh | W2b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Delete this save?            [×] │
│ Slot · Character                 │
│ Actual loss / retention policy   │
│ [Back]                  [Delete] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2b.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2b.header` | 90vw | 10vh | W2b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2b.header.title` | 72vw | 6vh | W2b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2b.header.exit` | 8vw | 6vh | W2b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2b.body` | 90vw | 30vh | W2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2b.body.activePane` | 85vw | 26vh | W2b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2b.body.target` | 85vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.body.consequence` | 85vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.footer` | 90vw | 10vh | W2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2b.footer.closeBack` | 41.5vw | 6vh | W2b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2b.footer.primary` | 41.5vw | 6vh | W2b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2b.footer.singleAction` | 85vw | 6vh | W2b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Delete this save?     [×] │
│                           │
│ Slot · Character          │
│ Actual loss / retention   │
│ policy                    │
│                           │
│ [Back]           [Delete] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2b.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2b.header` | 90vw | 10vh | W2b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2b.header.title` | 72vw | 6vh | W2b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2b.header.exit` | 8vw | 6vh | W2b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2b.body` | 90vw | 30vh | W2b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2b.body.activePane` | 85vw | 26vh | W2b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2b.body.target` | 85vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.body.consequence` | 85vw | 12vh | W2b.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2b.footer` | 90vw | 10vh | W2b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2b.footer.closeBack` | 41.5vw | 6vh | W2b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2b.footer.primary` | 41.5vw | 6vh | W2b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2b.footer.singleAction` | 85vw | 6vh | W2b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: selectedSaveIdentity, actualRetentionPolicy
PARENT: W2
model = DeleteQuestionForExactSlotAndCharacter()
model.consequence = DeriveActualDeletionOrArchiveConsequence()
model.paletteException = destructive
confirmBinding = DeleteSaveIfIdentityStillMatches()
RenderWithW2(model, confirmBinding)
ON targetChanged: RequireUpdatedReview(); do not delete replacement occupant
ON success: RefreshSlotList(); preserve profile data
```

### Wireframe W2c: Replace save

**Parent: W2.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Replace this save?                         [×] │
│                                                │
│ Slot · Existing character                      │
│ Replacement: new character                     │
│ Exact replacement consequence                  │
│                                                │
│ [Back]                               [Replace] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2c.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2c.header` | 50vw | 10vh | W2c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2c.header.title` | 32vw | 6vh | W2c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2c.header.exit` | 8vw | 6vh | W2c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2c.body` | 50vw | 30vh | W2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2c.body.activePane` | 45vw | 26vh | W2c.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2c.body.target` | 45vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.body.consequence` | 45vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.footer` | 50vw | 10vh | W2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2c.footer.closeBack` | 21.5vw | 6vh | W2c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2c.footer.primary` | 21.5vw | 6vh | W2c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2c.footer.singleAction` | 45vw | 6vh | W2c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Replace this save?           [×] │
│ Slot · Existing character        │
│ Replacement: new character       │
│ Exact replacement consequence    │
│ [Back]                 [Replace] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2c.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2c.header` | 90vw | 10vh | W2c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2c.header.title` | 72vw | 6vh | W2c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2c.header.exit` | 8vw | 6vh | W2c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2c.body` | 90vw | 30vh | W2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2c.body.activePane` | 85vw | 26vh | W2c.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2c.body.target` | 85vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.body.consequence` | 85vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.footer` | 90vw | 10vh | W2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2c.footer.closeBack` | 41.5vw | 6vh | W2c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2c.footer.primary` | 41.5vw | 6vh | W2c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2c.footer.singleAction` | 85vw | 6vh | W2c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Replace this save?    [×] │
│                           │
│ Slot · Existing character │
│ Replacement: new          │
│ character                 │
│ Exact replacement         │
│ consequence               │
│                           │
│ [Back]          [Replace] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2c.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2c.header` | 90vw | 10vh | W2c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2c.header.title` | 72vw | 6vh | W2c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2c.header.exit` | 8vw | 6vh | W2c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2c.body` | 90vw | 30vh | W2c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2c.body.activePane` | 85vw | 26vh | W2c.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2c.body.target` | 85vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.body.consequence` | 85vw | 12vh | W2c.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2c.footer` | 90vw | 10vh | W2c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2c.footer.closeBack` | 41.5vw | 6vh | W2c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2c.footer.primary` | 41.5vw | 6vh | W2c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2c.footer.singleAction` | 85vw | 6vh | W2c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: occupiedSlotIdentity, validatedNewRunDraft
PARENT: W2
model = ReplacementQuestionOldIdentityNewIdentityAndConsequence()
model.paletteException = destructive
confirmBinding = CommitNewRunToReviewedDestinationWithExistingSaveSemantics()
RenderWithW2(model, confirmBinding)
ON cancel: KeepDraftAndExistingSave()
ON failure: ReportActualStorageOutcome(); never claim replacement succeeded
```

### Wireframe W2d: Load over active run

**Parent: W2.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Load this save?                            [×] │
│                                                │
│ Destination slot · Character                   │
│ Current progress consequence                   │
│                                                │
│ [Back]                                  [Load] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2d.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2d.header` | 50vw | 10vh | W2d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2d.header.title` | 32vw | 6vh | W2d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2d.header.exit` | 8vw | 6vh | W2d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2d.body` | 50vw | 30vh | W2d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2d.body.activePane` | 45vw | 26vh | W2d.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2d.body.target` | 45vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.body.consequence` | 45vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.footer` | 50vw | 10vh | W2d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2d.footer.closeBack` | 21.5vw | 6vh | W2d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2d.footer.primary` | 21.5vw | 6vh | W2d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2d.footer.singleAction` | 45vw | 6vh | W2d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Load this save?              [×] │
│ Destination slot · Character     │
│ Current progress consequence     │
│ [Back]                    [Load] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2d.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2d.header` | 90vw | 10vh | W2d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2d.header.title` | 72vw | 6vh | W2d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2d.header.exit` | 8vw | 6vh | W2d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2d.body` | 90vw | 30vh | W2d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2d.body.activePane` | 85vw | 26vh | W2d.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2d.body.target` | 85vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.body.consequence` | 85vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.footer` | 90vw | 10vh | W2d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2d.footer.closeBack` | 41.5vw | 6vh | W2d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2d.footer.primary` | 41.5vw | 6vh | W2d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2d.footer.singleAction` | 85vw | 6vh | W2d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Load this save?       [×] │
│                           │
│ Destination slot ·        │
│ Character                 │
│ Current progress          │
│ consequence               │
│                           │
│ [Back]             [Load] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2d.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2d.header` | 90vw | 10vh | W2d.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2d.header.title` | 72vw | 6vh | W2d.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2d.header.exit` | 8vw | 6vh | W2d.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2d.body` | 90vw | 30vh | W2d.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2d.body.activePane` | 85vw | 26vh | W2d.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2d.body.target` | 85vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.body.consequence` | 85vw | 12vh | W2d.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2d.footer` | 90vw | 10vh | W2d.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2d.footer.closeBack` | 41.5vw | 6vh | W2d.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2d.footer.primary` | 41.5vw | 6vh | W2d.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2d.footer.singleAction` | 85vw | 6vh | W2d.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: selectedLoadIdentity, currentRunSaveStatus
PARENT: W2
model = LoadQuestionWithExactCurrentProgressConsequence()
confirmBinding = ExistingLoadCommandForReviewedIdentity()
RenderWithW2(model, confirmBinding)
ON cancel: ReturnToActiveRunWithoutMutation()
ON success: DisposeOldPresenterAndRestoreLoadedRunThroughNavigationCoordinator()
Do not add an unrequested autosave or silently replace the load target.
```

### Wireframe W2e: Quit confirmation

**Parent: W2.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Labels reflect the actual selected quit operation.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Leave this run?                            [×] │
│                                                │
│ Current run identity                           │
│ Exact save / loss consequence                  │
│                                                │
│ [Back]                              [Continue] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2e.frame` | 50vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2e.header` | 50vw | 10vh | W2e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2e.header.title` | 32vw | 6vh | W2e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2e.header.exit` | 8vw | 6vh | W2e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2e.body` | 50vw | 30vh | W2e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2e.body.activePane` | 45vw | 26vh | W2e.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W2e.body.target` | 45vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.body.consequence` | 45vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.footer` | 50vw | 10vh | W2e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2e.footer.closeBack` | 21.5vw | 6vh | W2e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2e.footer.primary` | 21.5vw | 6vh | W2e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2e.footer.singleAction` | 45vw | 6vh | W2e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Leave this run?              [×] │
│ Current run identity             │
│ Exact save / loss consequence    │
│ [Back]                [Continue] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2e.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2e.header` | 90vw | 10vh | W2e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2e.header.title` | 72vw | 6vh | W2e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2e.header.exit` | 8vw | 6vh | W2e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2e.body` | 90vw | 30vh | W2e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2e.body.activePane` | 85vw | 26vh | W2e.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2e.body.target` | 85vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.body.consequence` | 85vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.footer` | 90vw | 10vh | W2e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2e.footer.closeBack` | 41.5vw | 6vh | W2e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2e.footer.primary` | 41.5vw | 6vh | W2e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2e.footer.singleAction` | 85vw | 6vh | W2e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Leave this run?       [×] │
│                           │
│ Current run identity      │
│ Exact save / loss         │
│ consequence               │
│                           │
│ [Back]         [Continue] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W2e.frame` | 90vw | 50vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W2e.header` | 90vw | 10vh | W2e.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W2e.header.title` | 72vw | 6vh | W2e.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W2e.header.exit` | 8vw | 6vh | W2e.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W2e.body` | 90vw | 30vh | W2e.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W2e.body.activePane` | 85vw | 26vh | W2e.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W2e.body.target` | 85vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.body.consequence` | 85vw | 12vh | W2e.body.activePane | next row, top to bottom | start / start | normal grid flow | 2vh row gap | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W2e.footer` | 90vw | 10vh | W2e.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W2e.footer.closeBack` | 41.5vw | 6vh | W2e.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W2e.footer.primary` | 41.5vw | 6vh | W2e.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W2e.footer.singleAction` | 85vw | 6vh | W2e.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: requestedQuitOperation, runIdentity, saveCapabilities
PARENT: W2
model = ConcreteQuitQuestionFromActualSaveOrLossPolicy()
model.primaryLabel = VerbForRequestedOperation()
confirmBinding = ExistingSaveAndQuitOrQuitWithoutSaveCommand()
RenderWithW2(model, confirmBinding)
IF save required AND save fails: RemainAndShowFailure()
ON cancel: RestorePreviousViewThroughW0()
Red destructive exception follows consequences, not the word Quit alone.
```

## Wireframe W3: Main-menu composition

**Parent: W0.** One title/menu renderer. Title remains screen-centered and Profile top-right. Menu/preview state comes from one view model; keep focus and avoid hover oscillation.

**Wide**

```text
┌────────────────────────────────────────────────┐
│                                  [Profile] [×] │
│                    {Title}                     │
│                                                │
│ {Centered menu OR menu + preview}              │
│                                                │
│                 {Build stamp}                  │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3.header` | 95vw | 10vh | W3.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3.header.title` | 77vw | 6vh | W3.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3.header.exit` | 8vw | 6vh | W3.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3.body` | 95vw | 70vh | W3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3.body.activePane` | 90vw | 66vh | W3.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W3.body.menu` | 44vw | 66vh | W3.body.activePane | left-center | center / center | normal grid flow | 2vw between menu and preview | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.body.preview` | 44vw | 66vh | W3.body.activePane | right-center | center / center | normal grid flow | 2vw between menu and preview | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.footer` | 95vw | 10vh | W3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3.footer.closeBack` | 44vw | 6vh | W3.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3.footer.primary` | 44vw | 6vh | W3.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3.footer.singleAction` | 90vw | 6vh | W3.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│                    [Profile] [×] │
│             {Title}              │
│ {Menu}                           │
│ {Conditional preview below}      │
│          {Build stamp}           │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3.header` | 95vw | 10vh | W3.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3.header.title` | 77vw | 6vh | W3.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3.header.exit` | 8vw | 6vh | W3.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3.body` | 95vw | 70vh | W3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3.body.activePane` | 90vw | 66vh | W3.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3.body.menu` | 90vw | 32vh | W3.body.activePane | top-center | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.body.preview` | 90vw | 32vh | W3.body.activePane | below menu | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.footer` | 95vw | 10vh | W3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3.footer.closeBack` | 44vw | 6vh | W3.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3.footer.primary` | 44vw | 6vh | W3.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3.footer.singleAction` | 90vw | 6vh | W3.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│             [Profile] [×] │
│          {Title}          │
│                           │
│ {Menu}                    │
│                           │
│ {Conditional preview}     │
│                           │
│       {Build stamp}       │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3.header` | 95vw | 10vh | W3.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3.header.title` | 77vw | 6vh | W3.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3.header.exit` | 8vw | 6vh | W3.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3.body` | 95vw | 70vh | W3.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3.body.activePane` | 90vw | 66vh | W3.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3.body.menu` | 90vw | 32vh | W3.body.activePane | top-center | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.body.preview` | 90vw | 32vh | W3.body.activePane | below menu | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3.footer` | 95vw | 10vh | W3.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3.footer.closeBack` | 44vw | 6vh | W3.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3.footer.primary` | 44vw | 6vh | W3.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3.footer.singleAction` | 90vw | 6vh | W3.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: menuDefinition, supportedDestinations, saveSummaries, highlightState
PARENT: W0; VARIANT: full-screen title menu
model.titlePlacement = screenCenter
model.headerExtras = ProfileActionAtTopRight()
canPreview = ContinueIsAvailable() AND highlightedActionId == continue
model.bodyLayout = canPreview ? continuePreview : centeredMenu
model.preview = canPreview ? PreviewOfExactContinueSlot() : absent
IF mode == wide AND canPreview: PlaceMenuLeftAndPreviewRight()
ELSE: CenterMenu(); PlacePreviewBelowOnlyWhenPresent()
RenderWithW0(model); KeepTitleFixedAtFullScreenCenter()
ON hover/focus/controllerHighlight: UpdateOneSharedHighlightState()
ON layoutChange: PreserveNodeIdentityAndPreventPointerHoverOscillation()
ON activate: NavigateThroughRegisteredDestinationBinding()
Highlighting never loads, deletes, or saves a run.
```

### Wireframe W3a: Main menu — centered, no preview

**Parent: W3.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Continue is not highlighted. No empty preview placeholder. Existing supported destinations are verified before exposure.

**Wide**

```text
┌────────────────────────────────────────────────┐
│                                  [Profile] [×] │
│                  ASHEN SPIRE                   │
│                                                │
│                    Continue                    │
│                    New game                    │
│                   Load game                    │
│                  Multiplayer                   │
│                    Settings                    │
│                      Quit                      │
│                                                │
│                 [Build stamp]                  │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3a.header` | 95vw | 10vh | W3a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3a.header.title` | 77vw | 6vh | W3a.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3a.header.exit` | 8vw | 6vh | W3a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3a.body` | 95vw | 70vh | W3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3a.body.activePane` | 90vw | 66vh | W3a.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W3a.body.menu` | 90vw | 66vh | W3a.body.activePane | center | center / center | normal grid flow | equal free space on both sides | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3a.footer` | 95vw | 10vh | W3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3a.footer.closeBack` | 44vw | 6vh | W3a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3a.footer.primary` | 44vw | 6vh | W3a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3a.footer.singleAction` | 90vw | 6vh | W3a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│                    [Profile] [×] │
│           ASHEN SPIRE            │
│                                  │
│             Continue             │
│             New game             │
│            Load game             │
│           Multiplayer            │
│             Settings             │
│               Quit               │
│                                  │
│          [Build stamp]           │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3a.header` | 95vw | 10vh | W3a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3a.header.title` | 77vw | 6vh | W3a.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3a.header.exit` | 8vw | 6vh | W3a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3a.body` | 95vw | 70vh | W3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3a.body.activePane` | 90vw | 66vh | W3a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3a.body.menu` | 90vw | 66vh | W3a.body.activePane | center | center / center | normal grid flow | equal free space on both sides | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3a.footer` | 95vw | 10vh | W3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3a.footer.closeBack` | 44vw | 6vh | W3a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3a.footer.primary` | 44vw | 6vh | W3a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3a.footer.singleAction` | 90vw | 6vh | W3a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│             [Profile] [×] │
│        ASHEN SPIRE        │
│                           │
│         Continue          │
│         New game          │
│         Load game         │
│        Multiplayer        │
│         Settings          │
│           Quit            │
│                           │
│       [Build stamp]       │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3a.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3a.header` | 95vw | 10vh | W3a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3a.header.title` | 77vw | 6vh | W3a.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3a.header.exit` | 8vw | 6vh | W3a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3a.body` | 95vw | 70vh | W3a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3a.body.activePane` | 90vw | 66vh | W3a.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3a.body.menu` | 90vw | 66vh | W3a.body.activePane | center | center / center | normal grid flow | equal free space on both sides | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3a.footer` | 95vw | 10vh | W3a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3a.footer.closeBack` | 44vw | 6vh | W3a.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3a.footer.primary` | 44vw | 6vh | W3a.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3a.footer.singleAction` | 90vw | 6vh | W3a.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: mainMenuContext where Continue is not actively highlighted
PARENT: W3
model.layout = centeredMenu
model.preview = absent
RenderWithW3(model)
DoNotReserveAnEmptyPreviewColumn()
ON availableContinueHighlighted: ReprojectSameInstanceAsW3b()
Preserve supported menu items, title center, Profile anchor, and build stamp.
```

### Wireframe W3b: Main menu — Continue highlighted

**Parent: W3.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Available Continue reveals the exact save preview. Only menu/body layout moves; title stays screen-centered. Compact/mobile preview appears below the centered menu.

**Wide**

```text
┌────────────────────────────────────────────────┐
│                                  [Profile] [×] │
│                  ASHEN SPIRE                   │
│                                                │
│ [Continue]       [Save preview]                │
│ New game         [Character / world]           │
│ Load game                                      │
│ Multiplayer                                    │
│ Settings                                       │
│ Quit                                           │
│                                                │
│ [Matching save identity/location]              │
│                                                │
│                 [Build stamp]                  │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3b.header` | 95vw | 10vh | W3b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3b.header.title` | 77vw | 6vh | W3b.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3b.header.exit` | 8vw | 6vh | W3b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3b.body` | 95vw | 70vh | W3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3b.body.activePane` | 90vw | 66vh | W3b.body | after category navigation, if present | stretch / start | normal grid flow | 2.5vw after rail; 2vh top inset | All child slots below share this allocation |
| `W3b.body.menu` | 44vw | 66vh | W3b.body.activePane | left-center | center / center | normal grid flow | 2vw between menu and preview | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.body.preview` | 44vw | 66vh | W3b.body.activePane | right-center | center / center | normal grid flow | 2vw between menu and preview | Side-by-side nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.footer` | 95vw | 10vh | W3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3b.footer.closeBack` | 44vw | 6vh | W3b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3b.footer.primary` | 44vw | 6vh | W3b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3b.footer.singleAction` | 90vw | 6vh | W3b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│                    [Profile] [×] │
│           ASHEN SPIRE            │
│                                  │
│             Continue             │
│             New game             │
│            Load game             │
│           Multiplayer            │
│             Settings             │
│               Quit               │
│ [Small save preview]             │
│                                  │
│ [Matching save                   │
│ identity/location]               │
│                                  │
│          [Build stamp]           │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3b.header` | 95vw | 10vh | W3b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3b.header.title` | 77vw | 6vh | W3b.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3b.header.exit` | 8vw | 6vh | W3b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3b.body` | 95vw | 70vh | W3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3b.body.activePane` | 90vw | 66vh | W3b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3b.body.menu` | 90vw | 32vh | W3b.body.activePane | top-center | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.body.preview` | 90vw | 32vh | W3b.body.activePane | below menu | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.footer` | 95vw | 10vh | W3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3b.footer.closeBack` | 44vw | 6vh | W3b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3b.footer.primary` | 44vw | 6vh | W3b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3b.footer.singleAction` | 90vw | 6vh | W3b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│             [Profile] [×] │
│        ASHEN SPIRE        │
│                           │
│         Continue          │
│         New game          │
│         Load game         │
│        Multiplayer        │
│         Settings          │
│           Quit            │
│ [Saved character / world] │
│                           │
│ [Matching save            │
│ identity/location]        │
│                           │
│       [Build stamp]       │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W3b.frame` | 95vw | 90vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W3b.header` | 95vw | 10vh | W3b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W3b.header.title` | 77vw | 6vh | W3b.header | screen top-center | center / center | normal grid flow | center on viewport, not leftover header space | Screen-centered override |
| `W3b.header.exit` | 8vw | 6vh | W3b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W3b.body` | 95vw | 70vh | W3b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W3b.body.activePane` | 90vw | 66vh | W3b.body | after category navigation, if present | stretch / start | normal grid flow | 2vh after selector / top inset | All child slots below share this allocation |
| `W3b.body.menu` | 90vw | 32vh | W3b.body.activePane | top-center | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.body.preview` | 90vw | 32vh | W3b.body.activePane | below menu | center / center | normal grid flow | 2vh between menu and preview | Stacked nominal subdivision; optional slots collapse and siblings reclaim space |
| `W3b.footer` | 95vw | 10vh | W3b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W3b.footer.closeBack` | 44vw | 6vh | W3b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W3b.footer.primary` | 44vw | 6vh | W3b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W3b.footer.singleAction` | 90vw | 6vh | W3b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: mainMenuContext with available Continue highlighted
PARENT: W3
target = ExactSlotUsedByContinueCommand()
model.preview = SavedCharacterWorldAndSummary(target)
model.layout = wide ? menuLeftPreviewRight : centeredMenuPreviewBelow
RenderWithW3(model)
ON highlightMovesAway OR targetUnavailable: ReprojectSameInstanceAsW3a()
ON ContinueActivated: DispatchExistingLoadNavigation(target)
No title movement; no load or storage writes just to show the preview.
```

## Wireframe W4: Gameplay / encounter regions

**Parent: W0.** Shared region host, spacing, safe areas, visual states and transitions. Child view models specify region proportions and registered bodies. Combat, map, and dialogue have distinct domain intents; never copy a command or effect merely because the container is shared.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ {Shared HUD}                                   │
│                                                │
│ {Primary scene region}                         │
│                                                │
│ {Context / hand / dialogue body}               │
│                                                │
│ {Bottom actions}                               │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4.header` | 100vw | 10vh | W4.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4.header.title` | 82vw | 6vh | W4.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4.header.exit` | 8vw | 6vh | W4.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4.body` | 100vw | 75vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4.scene` | 100vw | 40vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.context` | 100vw | 35vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.scene.battlefield` | 95vw | 36vh | W4.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4.context.hand` | 95vw | 31vh | W4.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4.footer` | 100vw | 15vh | W4.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4.footer.closeBack` | 46.5vw | 6vh | W4.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4.footer.primary` | 46.5vw | 6vh | W4.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4.footer.singleAction` | 95vw | 6vh | W4.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ {Compact HUD}                    │
│                                  │
│ {Primary scene}                  │
│                                  │
│ {Context body}                   │
│                                  │
│ {Bottom actions}                 │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4.header` | 100vw | 10vh | W4.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4.header.title` | 82vw | 6vh | W4.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4.header.exit` | 8vw | 6vh | W4.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4.body` | 100vw | 75vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4.scene` | 100vw | 40vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.context` | 100vw | 35vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.scene.battlefield` | 95vw | 36vh | W4.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4.context.hand` | 95vw | 31vh | W4.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4.footer` | 100vw | 15vh | W4.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4.footer.closeBack` | 46.5vw | 6vh | W4.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4.footer.primary` | 46.5vw | 6vh | W4.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4.footer.singleAction` | 95vw | 6vh | W4.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ {Compact HUD}             │
│                           │
│ {Primary scene}           │
│                           │
│                           │
│                           │
│ {Context body}            │
│                           │
│ {Bottom actions}          │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4.header` | 100vw | 10vh | W4.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4.header.title` | 82vw | 6vh | W4.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4.header.exit` | 8vw | 6vh | W4.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4.body` | 100vw | 75vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4.scene` | 100vw | 40vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.context` | 100vw | 35vh | W4.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4.scene.battlefield` | 95vw | 36vh | W4.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4.context.hand` | 95vw | 31vh | W4.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4.footer` | 100vw | 15vh | W4.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4.footer.closeBack` | 46.5vw | 6vh | W4.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4.footer.primary` | 46.5vw | 6vh | W4.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4.footer.singleAction` | 95vw | 6vh | W4.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: committedSnapshot, regionDefinition, localInteractionState
PARENT: W0; VARIANT: gameplay/encounter region host
model.header = SharedHUDProjection(snapshot)
model.body = RegisteredSceneAndContextBodies(regionDefinition)
model.actions = ProjectLegalContextActions(snapshot)
model.layout = ValidatedRegionFractionsAndMinimums()
RenderWithW0(model)
ConvertViewportToLocalCoordinatesThroughSharedAdapter()
ON resize/rotation: ReflowSameSceneAndSelection(); never reset simulation
ON intent: DispatchLocalOrServerAuthoritativeBindingAccordingToSession()
ON navigation: DisposeSceneBindingsAndTransientEffects()
Share chrome/effects, not domain rules, between combat/map/dialogue.
```

### Wireframe W4a: Combat — tightly packed footer

**Parent: W4.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. A/End Turn/P are largest and raised; pile buttons smaller; gaps minimal in every mode. No space-between. Empty resources/piles fade; End Turn does not and turns green when legal with zero actions. Proposed 10% HUD / 40% battlefield / 35% hand / 15% footer is the latest discussed starting allocation, subject to readability/playability verification.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ Identity · Resources                    [Menu] │
│                                                │
│ Battlefield + intentions                       │
│                                                │
│ Hand                                           │
│                                                │
│             (A)[D][END TURN][E](P)             │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4a.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4a.header` | 100vw | 10vh | W4a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4a.header.title` | 82vw | 6vh | W4a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4a.header.exit` | 8vw | 6vh | W4a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4a.body` | 100vw | 75vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4a.scene` | 100vw | 40vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.context` | 100vw | 35vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.scene.battlefield` | 95vw | 36vh | W4a.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4a.context.hand` | 95vw | 31vh | W4a.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4a.footer` | 100vw | 15vh | W4a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4a.footer.actionsRemaining` | 8vw | 8vh | W4a.footer.group | column 1 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group left |
| `W4a.footer.drawPile` | 5.6vw | 6vh | W4a.footer.group | column 2 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.endTurn` | 12vw | 8vh | W4a.footer.group | column 3 (center) | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Large, group center |
| `W4a.footer.discardExhaust` | 5.6vw | 6vh | W4a.footer.group | column 4 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.potions` | 8vw | 8vh | W4a.footer.group | column 5 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group right |
| `W4a.footer.group` | 41.2vw | 11vh | W4a.footer | bottom-center | center / center | single packed row; never distribute across viewport | centered horizontally; 2vh above footer bottom | Four 0.5vw nominal gaps; packed centered, never stretched |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Compact HUD               [Menu] │
│                                  │
│ Battlefield + intentions         │
│                                  │
│ Hand                             │
│                                  │
│      (A)[D][END TURN][E](P)      │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4a.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4a.header` | 100vw | 10vh | W4a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4a.header.title` | 82vw | 6vh | W4a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4a.header.exit` | 8vw | 6vh | W4a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4a.body` | 100vw | 75vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4a.scene` | 100vw | 40vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.context` | 100vw | 35vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.scene.battlefield` | 95vw | 36vh | W4a.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4a.context.hand` | 95vw | 31vh | W4a.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4a.footer` | 100vw | 15vh | W4a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4a.footer.actionsRemaining` | 10vw | 8vh | W4a.footer.group | column 1 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group left |
| `W4a.footer.drawPile` | 7vw | 6vh | W4a.footer.group | column 2 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.endTurn` | 15vw | 8vh | W4a.footer.group | column 3 (center) | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Large, group center |
| `W4a.footer.discardExhaust` | 7vw | 6vh | W4a.footer.group | column 4 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.potions` | 10vw | 8vh | W4a.footer.group | column 5 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group right |
| `W4a.footer.group` | 51vw | 11vh | W4a.footer | bottom-center | center / center | single packed row; never distribute across viewport | centered horizontally; 2vh above footer bottom | Four 0.5vw nominal gaps; packed centered, never stretched |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Compact HUD        [Menu] │
│                           │
│ Battlefield + intentions  │
│                           │
│                           │
│                           │
│ Hand                      │
│                           │
│  (A)[D][END TURN][E](P)   │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4a.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4a.header` | 100vw | 10vh | W4a.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4a.header.title` | 82vw | 6vh | W4a.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4a.header.exit` | 8vw | 6vh | W4a.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4a.body` | 100vw | 75vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4a.scene` | 100vw | 40vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.context` | 100vw | 35vh | W4a.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4a.scene.battlefield` | 95vw | 36vh | W4a.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Art and targets fit inside scene |
| `W4a.context.hand` | 95vw | 31vh | W4a.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Playing-card host allocation, not standalone card size |
| `W4a.footer` | 100vw | 15vh | W4a.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4a.footer.actionsRemaining` | 13vw | 8vh | W4a.footer.group | column 1 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group left |
| `W4a.footer.drawPile` | 9.1vw | 6vh | W4a.footer.group | column 2 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.endTurn` | 19.5vw | 8vh | W4a.footer.group | column 3 (center) | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Large, group center |
| `W4a.footer.discardExhaust` | 9.1vw | 6vh | W4a.footer.group | column 4 | center / center | single packed row; never distribute across viewport | 0.5vw gap; bottom aligned in group | Small |
| `W4a.footer.potions` | 13vw | 8vh | W4a.footer.group | column 5 | center / center | single packed row; never distribute across viewport | 0.5vw gap; lifted 1vh above group bottom | Circle; large, group right |
| `W4a.footer.group` | 65.7vw | 11vh | W4a.footer | bottom-center | center / center | single packed row; never distribute across viewport | centered horizontally; 2vh above footer bottom | Four 0.5vw nominal gaps; packed centered, never stretched |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: committedCombatSnapshot, enginePreviewAPI, localTargetSelection
PARENT: W4
model.scene = BattlefieldIntentAndStatusProjection()
model.context = HandAndTargetingProjection()
model.footerPlacement = packedCombat
model.actions = [ActionsRemaining, DrawPile, EndTurn, DiscardExhaust, Potions]
model.footerSizes = large(ActionsRemaining, EndTurn, Potions), small(pileButtons)
RenderWithW4(model); CenterGroupWithMinimalSharedGapsInEveryMode()
EmptyResourceOrPileIndicatorsFade(); EndTurnNeverUsesEmptyFade()
EndTurnGreen = canEndTurn AND (NoActionsRemain(actionsRemaining) OR highlightedEndTurn)
ON DrawPile: OpenReadOnlyDrawViewer()
ON DiscardExhaust: OpenW1h()
ON EndTurn: DispatchExistingEngineOrServerCommandIfLegal()
ON card/target/potion intent: UseExistingValidatedCombatBindings()
The discussed config.combat.regionFractions region split is a starting allocation to verify.
Preserve RNG calls, simulation timing, combat saves, and server authority.
```

### Wireframe W4b: Map — 10 / 60 / 20 / 10

**Parent: W4.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Normal height budget is 10/60/20/10, with spacing inside the bands and viewport/zoom conversion centralized. Preserve minimum readable/control sizes; map yields only where required. No combat footer.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ HUD · [Region ▾]                 [Menu] 10%    │
├────────────────────────────────────────────────┤
│ ┌────── Map ≈95% viewport width ──────┐        │
│ │            MAP / NODES             │         │
│ │                               60% │          │
│ └───────────────────────────────────┘          │
├────────────────────────────────────────────────┤
│ Selected node · Known facts         20%        │
│ Relevant detail / risk / blocker               │
├────────────────────────────────────────────────┤
│ [Recenter]                             [Enter] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4b.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4b.header` | 100vw | 10vh | W4b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4b.header.title` | 82vw | 6vh | W4b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4b.header.exit` | 8vw | 6vh | W4b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4b.body` | 100vw | 80vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4b.scene` | 100vw | 60vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.context` | 100vw | 20vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.scene.map` | 95vw | 60vh | W4b.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Owner target ≈60vh ×95vw |
| `W4b.footer` | 100vw | 10vh | W4b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4b.footer.closeBack` | 46.5vw | 6vh | W4b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4b.footer.primary` | 46.5vw | 6vh | W4b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4b.footer.singleAction` | 95vw | 6vh | W4b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ HUD · [Region ▾] [Menu]      10% │
├──────────────────────────────────┤
│ [MAP / NODES]                    │
│ Width ≈95%                  60%  │
├──────────────────────────────────┤
│ Node · Facts · Blocker      20%  │
├──────────────────────────────────┤
│ [Recenter]               [Enter] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4b.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4b.header` | 100vw | 10vh | W4b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4b.header.title` | 82vw | 6vh | W4b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4b.header.exit` | 8vw | 6vh | W4b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4b.body` | 100vw | 80vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4b.scene` | 100vw | 60vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.context` | 100vw | 20vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.scene.map` | 95vw | 60vh | W4b.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Owner target ≈60vh ×95vw |
| `W4b.footer` | 100vw | 10vh | W4b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4b.footer.closeBack` | 46.5vw | 6vh | W4b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4b.footer.primary` | 46.5vw | 6vh | W4b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4b.footer.singleAction` | 95vw | 6vh | W4b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ HUD [Region ▾][Menu]  10% │
├───────────────────────────┤
│ [MAP / NODES]             │
│                           │
│ Width ≈95%                │
│                           │
│                      60%  │
│                           │
├───────────────────────────┤
│ Selected node             │
│ Known facts / blocker 20% │
├───────────────────────────┤
│ [Recenter]        [Enter] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4b.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4b.header` | 100vw | 10vh | W4b.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4b.header.title` | 82vw | 6vh | W4b.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4b.header.exit` | 8vw | 6vh | W4b.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4b.body` | 100vw | 80vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4b.scene` | 100vw | 60vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.context` | 100vw | 20vh | W4b.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4b.scene.map` | 95vw | 60vh | W4b.scene | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Owner target ≈60vh ×95vw |
| `W4b.footer` | 100vw | 10vh | W4b.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4b.footer.closeBack` | 46.5vw | 6vh | W4b.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4b.footer.primary` | 46.5vw | 6vh | W4b.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4b.footer.singleAction` | 95vw | 6vh | W4b.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: mapSnapshot, revealRules, selectedNodeId, viewport
PARENT: W4
model.regionFractions = config.map.regionFractions
model.mapInlineFraction = config.map.inlineFraction
model.header = HUDIncludingRegionSelector()
model.scene = RevealedMapAndReachabilityProjection()
model.context = KnownSelectedNodeFactsAndBlockers()
model.actions = [Recenter, EnterSelectedDestination]
RenderWithW4(model); KeepPaddingInsideHeightBudget()
ON selectNode: UpdateLocalPreviewWithoutEnteringOrRevealingHiddenFacts()
ON Recenter: DispatchViewOnlyMapCameraIntent()
ON Enter: RevalidateReachabilityAndDispatchExistingNodeEntryCommand()
ON constrainedTextOrHeight: HonorInputMinimumsAndControlledDetailsOverflow()
Never add combat footer controls or a fifth region-selector band.
```

### Wireframe W4c: Quest dialogue — player left, NPC right

**Parent: W4.** Inherits the parent geometry, spacing, transitions, focus treatment, and lifecycle. Only view-model content, registered body slots, and declared action policies differ. Portraits remain left/right even on mobile. Dialogue replaces the hand. Audio may advance linear speech only; Back/Skip never commit choices or repeat effects. Captions/manual navigation work without playable audio.

**Wide**

```text
┌────────────────────────────────────────────────┐
│ HUD · Resources                         [Menu] │
│                                                │
│ [Player]           [Scene]               [NPC] │
│ Player name                           NPC name │
│                                                │
│ Speaker                              [Voice Ⅱ] │
│ One short caption beat.                        │
│ [Responses only when required]                 │
│                                                │
│ [Back]              [Skip]          [Continue] │
└────────────────────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4c.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4c.header` | 100vw | 10vh | W4c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4c.header.title` | 82vw | 6vh | W4c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4c.header.exit` | 8vw | 6vh | W4c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4c.body` | 100vw | 75vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4c.scene` | 100vw | 40vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.context` | 100vw | 35vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.scene.playerPortrait` | 20vw | 36vh | W4c.scene | left-center | center / center | normal grid flow | 2.5vw from respective scene edge | Left; bounded artwork, intrinsic ratio |
| `W4c.scene.npcPortrait` | 20vw | 36vh | W4c.scene | right-center | center / center | normal grid flow | 2.5vw from respective scene edge | Right; bounded artwork, intrinsic ratio |
| `W4c.context.dialogue` | 95vw | 31vh | W4c.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Short authored caption/response body; shared remaining budget |
| `W4c.footer` | 100vw | 15vh | W4c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4c.footer.closeBack` | 46.5vw | 6vh | W4c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4c.footer.primary` | 46.5vw | 6vh | W4c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4c.footer.singleAction` | 95vw | 6vh | W4c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |
| `W4c.footer.skipSpeech` | 30.67vw | 6vh | W4c.footer | bottom-center | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Three-action variant: each button takes one third minus shared gaps; replaces two-action widths |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Compact**

```text
┌──────────────────────────────────┐
│ Compact HUD               [Menu] │
│ [Player]                   [NPC] │
│ Player name             NPC name │
│ Speaker                [Voice Ⅱ] │
│ One short caption beat.          │
│ [Required responses]             │
│ [Back]       [Skip]   [Continue] │
└──────────────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4c.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4c.header` | 100vw | 10vh | W4c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4c.header.title` | 82vw | 6vh | W4c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4c.header.exit` | 8vw | 6vh | W4c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4c.body` | 100vw | 75vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4c.scene` | 100vw | 40vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.context` | 100vw | 35vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.scene.playerPortrait` | 30vw | 36vh | W4c.scene | left-center | center / center | normal grid flow | 2.5vw from respective scene edge | Left; bounded artwork, intrinsic ratio |
| `W4c.scene.npcPortrait` | 30vw | 36vh | W4c.scene | right-center | center / center | normal grid flow | 2.5vw from respective scene edge | Right; bounded artwork, intrinsic ratio |
| `W4c.context.dialogue` | 95vw | 31vh | W4c.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Short authored caption/response body; shared remaining budget |
| `W4c.footer` | 100vw | 15vh | W4c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4c.footer.closeBack` | 46.5vw | 6vh | W4c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4c.footer.primary` | 46.5vw | 6vh | W4c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4c.footer.singleAction` | 95vw | 6vh | W4c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |
| `W4c.footer.skipSpeech` | 30.67vw | 6vh | W4c.footer | bottom-center | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Three-action variant: each button takes one third minus shared gaps; replaces two-action widths |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Vertical / Mobile**

```text
┌───────────────────────────┐
│ Compact HUD        [Menu] │
│                           │
│ [Player]            [NPC] │
│ Player name      NPC name │
│                           │
│ Speaker         [Voice Ⅱ] │
│ One short caption beat.   │
│                           │
│ [Required responses]      │
│                           │
│ [Back]   [Skip][Continue] │
└───────────────────────────┘
```

**Component IDs and nominal viewport allocations**

| Component / child binding | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Placement / budget |
|---|---:|---:|---|---|---|---|---|---|
| `W4c.frame` | 100vw | 100vh | visible game viewport | center | center / center | root grid item | equal outer margins; safe area applied once | Centered host; W4 fills available game viewport |
| `W4c.header` | 100vw | 10vh | W4c.frame | top / full width | stretch / center | normal grid flow | 0 | Reserved top band |
| `W4c.header.title` | 82vw | 6vh | W4c.header | top-left | start / center | normal grid flow | 2.5vw from left; vertically centered in header | Top-left, shared inset |
| `W4c.header.exit` | 8vw | 6vh | W4c.header | top-right | end / center | normal grid flow | 2.5vw from right; vertically centered in header | Top-right; min-target rule may enlarge |
| `W4c.body` | 100vw | 75vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes internal padding; scroll only this region if needed |
| `W4c.scene` | 100vw | 40vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.context` | 100vw | 35vh | W4c.frame | below preceding band | stretch / stretch | normal grid flow | 0; band padding included in height | Includes region internal spacing |
| `W4c.scene.playerPortrait` | 30vw | 36vh | W4c.scene | left-center | center / center | normal grid flow | 2.5vw from respective scene edge | Left; bounded artwork, intrinsic ratio |
| `W4c.scene.npcPortrait` | 30vw | 36vh | W4c.scene | right-center | center / center | normal grid flow | 2.5vw from respective scene edge | Right; bounded artwork, intrinsic ratio |
| `W4c.context.dialogue` | 95vw | 31vh | W4c.context | center | center / center | normal grid flow | 2.5vw horizontal / 2vh vertical inset, except map has no vertical inset | Short authored caption/response body; shared remaining budget |
| `W4c.footer` | 100vw | 15vh | W4c.frame | bottom / full width | stretch / center | normal grid flow | 0; reserved grid row | Reserved bottom band; no extra height outside total |
| `W4c.footer.closeBack` | 46.5vw | 6vh | W4c.footer | bottom-left | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-left when two actions |
| `W4c.footer.primary` | 46.5vw | 6vh | W4c.footer | bottom-right | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Bottom-right when two actions |
| `W4c.footer.singleAction` | 95vw | 6vh | W4c.footer | bottom / full usable width | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Alternative: exactly one action fills usable width |
| `W4c.footer.skipSpeech` | 30.67vw | 6vh | W4c.footer | bottom-center | center / center | single-row footer grid item | 2.5vw side inset; vertically centered in footer | Three-action variant: each button takes one third minus shared gaps; replaces two-action widths |

Nested rows are subdivisions, not additional viewport bands. Control heights and text are subject to shared readable/minimum-target sizing; figures are proposed targets, not measured pixels. Rendered capability filtering can omit slots.

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: dialogueGraph, questSnapshot, playerIdentity, npcIdentity, locale
PARENT: W4; BODY: portrait dialogue replacing hand/cards
model.scene = PlayerPortraitLeftAndNPCPortraitRight()
model.context = CurrentSpeakerShortCaptionAndRequiredChoices()
model.actions = [Back, SkipSpeech, Continue]
RenderWithW4(model); KeepFooterInlineAndPortraitSidesStable()

FUNCTION ShowBeat(id, reviewing = false):
    StopClipAndTimers(); generation = NextGenerationToken()
    activeGeneration = generation
    ProjectAndRenderBeat(id)
    IF reviewing OR noPlayableVoice: AwaitManualContinue(); RETURN
    Speech.Play(clip, onEnded = FUNCTION:
        IF disposed OR activeGeneration != generation: RETURN
        IF autoAdvance AND nextBeatIsLinearAndNonCommitting:
            ScheduleConfiguredReadablePauseThenAdvance(activeGeneration)
        ELSE AwaitChoiceOrContinue())

ON Continue: CancelPendingAdvance(); AdvanceOneBeatOrConfirmSelectedChoice()
ON SkipSpeech: CancelPendingAdvance(); MoveToNextRequiredBoundaryWithoutEffects()
ON Back: ReviewPreviousVisitedBeatWithoutUndoingOrReplayingDomainCommands()
ON chooseResponse: RevalidateQuestState(); DispatchConfirmedChoiceOnce()
ON voicePause: PauseClipAndAutoAdvanceTimer()
ON audioFailure/mute: KeepCaptionsAndManualControlsAvailable()
ON dispose: InvalidateGeneration(); StopClipTimersAndListeners()
Audio completion, Back, and Skip never grant rewards or choose responses.
```

## Verification

Verify every parent and child in all three views, at supported text/UI scales, with keyboard/controller/touch, long copy, empty/blocked states, active modal and preserved selection across rotation. Portrait is an explicit target: audit the existing upright/orientation gate before implementation. Do not shrink hit targets or clip required text to claim a no-scroll layout. This is a documentation specification; it does not claim implemented or browser-verified UI.

## Card hierarchy — WC0 and descendants

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

**Vertical / Mobile**

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

# Tooltip wireframes

Three configurable sizes: compact, standard and expanded. WT0 is an anchored overlay, not a modal: no close/back/primary footer. It inherits palette, spacing, typography and reduced-motion tokens from W0. Tooltips contain descriptive text only; interactive or lengthy detail opens W1 inspection.

## Wireframe WT0: Shared tooltip

**Parent: shared overlay primitives.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 20vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 30vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Vertical / Mobile**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT0)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=config.referenceTokens.value_1000.value; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT1: Compact tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 12vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 18vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Vertical / Mobile**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 36vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT1)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=config.referenceTokens.value_1000.value; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT2: Standard tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 20vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 30vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Vertical / Mobile**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT2)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=config.referenceTokens.value_1000.value; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT3: Expanded tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 28vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 42vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Vertical / Mobile**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 84vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT3)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=config.referenceTokens.value_1000.value; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```


# Shared component wireframes

WP identifiers describe composable parts, not additional screen families. Every part receives an immutable view model and owner interaction state. WC0/WC4 and W1w compose these same components; context controls visibility and placement. Dimensions are shared configurable proposals.

## Wireframe WCB0: Buttons and inspection

**Parent: none.** Use cases: Buttons and inspection reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB1: Inspect control

**Parent: WCB0.** Use cases: Every selectable card, combatant, inventory tile. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
On continuous selection schedule reveal after1000ms. Cancel on deselect/disposal. On activation stop propagation and open W1w with entity reference and context. Restore origin focus. Read-only inspector previews omit nested inspect.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB2: Context action

**Parent: WCB0.** Use cases: Selected card host or modal footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Project available domain intent. Required target gates readiness. Commit revalidates state once. No generic eligible-target button in production.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB3: Primary / confirmation button

**Parent: WCB0.** Use cases: Modal confirmation, contextual Use/Play/Equip. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Receive label, command intent, readiness and busy state. Green when ready/highlighted; disabled/busy wins. Emit one semantic intent; domain revalidates. Destructive role uses danger override.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB4: Back / cancel button

**Parent: WCB0.** Use cases: W0 modal footers and cancellation. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Inherit action primitive. Highlight danger color on focus/hover. Cancel only current presentation flow; restore origin focus.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB5: Exit button

**Parent: WCB0.** Use cases: Shared modal header. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Use accessible Close label and inherited dismissal policy. Danger highlight; do not commit pending domain actions.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF0: Component foundations

**Parent: none.** Use cases: Component foundations reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF1: Component contract

**Parent: WCF0.** Use cases: All card and combatant parts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Validate model; resolve inherited tokens; render only if active; dispose subscriptions.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF2: Ordered active stack

**Parent: WCF0.** Use cases: Combatant lower region. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Filter inactive components before ordering. Reserve HP and present stance/icon rows. Admit priority bars within remaining budget. Convert excess buildup to icons. Use shared0.2rem gap, no empty rows.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF3: Selection effect

**Parent: WCF0.** Use cases: All selectable cards and combatants. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Observe owner selected state. Apply one shared glow to complete visible assembly; no nested additive glow. Preserve position and omit hidden parts.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF4: Inspector facts

**Parent: WCF0.** Use cases: W1w right pane. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Project knowledge-filtered snapshot through registered providers. Order HP/intent/defense, current state, history, abilities, traits, lore. Use shared label/value columns; right pane scrolls.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI0: Identity and artwork

**Parent: none.** Use cases: Identity and artwork reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI1: Nameplate

**Parent: WCI0.** Use cases: Card header, combatant above HP, inspector title. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve localized display name once. Render text, never HTML. Follow context anchor; inherit owner selected glow.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI2: Sprite / artwork

**Parent: WCI0.** Use cases: Playing card art, combatant sprite, inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered asset and pose. Contain intrinsic aspect ratio. Mirror art only by facing. No independent entity facts.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI3: Metadata footer

**Parent: WCI0.** Use cases: Item and playing-card footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Render applicable registered metadata left/right. Omit unsupported values. No Use/Play button in footer.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM0: Meters and statuses

**Parent: none.** Use cases: Meters and statuses reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM1: Health meter

**Parent: WCM0.** Use cases: Combatants and inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Project HP/current maximum. Render label and accessible meter. HP persists; clamp visual fill only, never mutate value.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM2: Resource meter

**Parent: WCM0.** Use cases: Active combatant resource rows, inspector facts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Filter with domain activity predicate. Project resource metadata/current/max. Use registered semantic color. Reserve available row by configured priority.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM3: Buildup meter

**Parent: WCM0.** Use cases: Threshold progress, overflow status icon. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Project buildup and threshold. If optional row budget exhausted, emit progress-icon model instead. Never treat buildup as active status duration.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM4: Stance strip

**Parent: WCM0.** Use cases: Active combatant stance and inspector fact. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Render active stance only with uniform dimensions. Localize label and tooltip. No stance command from informational activation.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM5: Status icon

**Parent: WCM0.** Use cases: Active effects and overflow buildup. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Render icon only. Accessible name and tooltip contain stacks/duration/progress. Subscribe to owner selection rather than local duplicate state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM6: Icon overflow

**Parent: WCM0.** Use cases: Crowded status rows. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Measure available width. Reserve last slot if all icons cannot fit. N equals hidden entries. Activate opens complete status list in W1w. Recompute on resize/model update.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO0: Combat overlays

**Parent: none.** Use cases: Combat overlays reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO1: Intent indicator

**Parent: WCO0.** Use cases: Active announced combatant intent. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Require active domain intent AND role visibility; default player false, enemy true. Project action preview. No duplicate AI logic.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO2: Defense badge

**Parent: WCO0.** Use cases: Active combatant block/defense. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Render active defense value. Place outside sprite with0.5rem gap and center vertically. Inspector uses facts instead of overlay.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO3: Aura layer

**Parent: WCO0.** Use cases: Tag-driven combatant visual effects. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Match active visual-effect tags to allowlisted provider. Paint full bounds without pointer events. Never create gameplay state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO4: Buff layer

**Parent: WCO0.** Use cases: Active buff visual layer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Reuse effect lifecycle; paint above art below controls. Omit in inspector. Respect reduced motion.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT0: Tooltip components

**Parent: none.** Use cases: Tooltip components reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT1: Tooltip presenter

**Parent: WCT0.** Use cases: Tags, status/intent/defense explanations. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Vertical / Mobile**

```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
// Load and validate pseudocode-config.json once; inject config into this component.
// Config entries carry units; convert through the shared layout adapter.
// Wireframe IDs are identifiers. Domain facts come from the model, not config.
INPUT: immutable component model, owner state, context, layout tokens
Delay1000ms; cancel stale timers. Keep open across trigger-to-tooltip transition. Escape/outside tap dismiss. Reuse active modal overlay root.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```


## Configuration defaults

```json
{
  "combatant": {
    "maxStackRows": 5,
    "extraBarHeightRatio": 0.5,
    "stackGapRem": 0.2,
    "iconSizeRem": 1.575,
    "defenseOffsetRatio": 0.5,
    "defenseGapRem": 0.5,
    "playerIntentVisible": false,
    "enemyIntentVisible": true
  },
  "interaction": {
    "inspectDelayMs": 1000,
    "tooltipDelayMs": 1000
  },
  "card": {
    "bandFractions": {
      "header": 0.1,
      "art": 0.4,
      "body": 0.4,
      "footer": 0.1
    }
  },
  "map": {
    "regionFractions": {
      "topHUD": 0.1,
      "map": 0.6,
      "details": 0.2,
      "footer": 0.1
    },
    "inlineFraction": 0.95
  },
  "combat": {
    "regionFractions": {
      "topHUD": 0.1,
      "battlefield": 0.4,
      "hand": 0.35,
      "footer": 0.15
    }
  },
  "inspector": {
    "widePreviewFraction": 0.34,
    "portraitPreviewFraction": 0.32,
    "gapVw": 2,
    "maxPreviewWidthRem": 14
  },
  "referenceTokens": {
    "value_1000": {
      "value": 1000,
      "unit": "count"
    },
    "value_0": {
      "value": 0,
      "unit": "count"
    },
    "value_1": {
      "value": 1,
      "unit": "count"
    }
  }
}
```
