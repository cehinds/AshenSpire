# W0 master shell → four parent wireframes → children

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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


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

## Verification

Verify every parent and child in all three views, at supported text/UI scales, with keyboard/controller/touch, long copy, empty/blocked states, active modal and preserved selection across rotation. Portrait is an explicit target: audit the existing upright/orientation gate before implementation. Do not shrink hit targets or clip required text to claim a no-scroll layout. This is a documentation specification; it does not claim implemented or browser-verified UI.
