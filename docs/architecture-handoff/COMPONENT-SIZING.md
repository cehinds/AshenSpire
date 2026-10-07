> Current authority: [CURRENT-SPECIFICATION.md](CURRENT-SPECIFICATION.md). It supersedes conflicting earlier iteration notes. Documentation only.

# Component naming and viewport-size contract

Every ASCII view in wireframe.md and card-wireframes.md has an adjacent width/height table. These values are **proposed nominal allocations**, not measurements, hard maximums, or claims of tested geometry. Content-fit, accessibility and existing UI zoom must be verified during implementation.

## Names

Use `wireframeId.region.component`, optionally followed by a semantic sub-name: `W0.header.title`, `W1b.header.title` (town name), `W1c.body.stageControls`, `W4a.footer.endTurn`, `WC0.body.art`, `WC2a1.body.damage`. A child's local path binds to the corresponding inherited slot; do not create another renderer simply because the prefix changes. Components repeated in a collection add a stable instance reference, not an array index.

Each named parent and child slot is shown in the adjacent dimension table. This keeps the diagrams readable rather than stuffing every box with coordinates. Keep table and diagram generated from the same definition.

## Units and budgets

- `1vw` means 1% of available visible game viewport width; `1vh` means 1% of its height. Safe areas and browser chrome are removed once at the outer host. Convert to the existing scaled local coordinate system once, through the viewport adapter.
- Inside the application use container-relative grid/flex percentages and shared tokens, not scattered raw vh/vw inside zoomed elements. The table communicates screen allocation; it is not a command to write viewport units on every nested element.
- Container rows include their children. A 70vh body plus two 33vh children with internal padding is 70vh, not 136vh. Width/height rows must be read as a hierarchy.
- Standard modal proposed envelope: 95vw ×90vh, header10vh/body70vh/footer10vh. Decision envelope: 50vw ×50vh wide, 90vw ×50vh compact/portrait, with header10/body30/footer10. These are planning starting values; concise content may use a smaller natural envelope.
- Gameplay W4 uses the full visible host. Map keeps the explicit 10/60/20/10 height budget and map width≈95vw. Combat's discussed 10/40/35/15 remains a proposed baseline to test.
- Shared normal shell inset: 2.5vw horizontally; normal band internal vertical padding: 2vh at each body edge. Footer controls target6vh, large combat controls8vh. Minimum physical hit-target and readable text constraints override these nominal dimensions, especially in short landscape windows. Do not blindly shrink controls below those constraints.
- Mode-specific values and overrides are authored once as typed relations. The table's repeated inherited numbers are derived documentation, not repeated authoritative values.
- Zero actions: omit footer and reclaim its band. One action: full usable footer width. Two actions: inline left/right. Dialogue three actions: use three nonoverlapping columns inside the same footer. Combat: explicit packed center group. These modes replace one another; their widths are not additive.
- Optional region omitted: no empty placeholder. Recompute sibling allocation within the same parent. The viewport table documents nominal present-slot state; capability conditions determine the actual state.
- Artwork keeps intrinsic aspect ratio with contained/cropped treatment specified by its registered asset role. Dimensions refer to the art well, not permission to stretch the image.

## Normalized proposed relations

```text
LayoutSlot(wireframeId, slotId, parentSlotId, semanticRoleId;
           PK wireframeId+slotId)
LayoutSlotMode(wireframeId, slotId, modeId, widthRuleId, heightRuleId;
               PK wireframeId+slotId+modeId)
LengthRule(id PK, kind, numericValue, unit, referenceSlotId nullable)
SlotBinding(childWireframeId, inheritedSlotId, providerId;
            PK childWireframeId+inheritedSlotId)
```

Review exact foreign keys against the final schema. Use validated kinds such as viewportFraction, parentFraction, remaining, intrinsic; never evaluate arbitrary formulas from strings. Root overrides exist once, inherited effective values are compiled. Validate cycles, unknown slots, incompatible unit references, overlapping sibling allocations, and unsupported variants. Do not duplicate dimensions into entity/tag membership records.

## Verification

For each parent/child and each mode: sum the top-level bands, inspect nested sibling budgets, test min target/text constraints, and compare rendered bounds to the resulting computed layout. Fail visibly if a supported viewport cannot fit the inline footer; do not stack, clip, or quietly reduce user text settings. Validate long translated text, safe areas, UI zoom, portrait rotation, empty/disabled state and optional slots.

## Placement columns (all screen and card views)

Every component table specifies **Relative to**, **Anchor**, **Align X / Y**, **Positioning**, and **Offset / gap** alongside its width and height. Start/end mean left/right in the current left-to-right wireframes. Alignment describes the component or its content within its allocated slot; an anchor identifies the slot edge or row. All offsets are measured inside the named parent, never from an unrelated screen corner. Row/column order follows the diagram and table order.

Use normal grid/flex flow for structural regions; corner anchors do not imply absolute positioning. Header and footer reserve space so body content cannot push their controls away. Overflow stays in the body. Footer actions share a single horizontal row with centered labels. A single action fills the usable row. Cards are positioned by their owning hand/grid, not independently centered over the screen.

W3 keeps its title screen-centered. Its default menu is centered; Continue preview uses left/right columns in wide and consecutive centered rows in compact/portrait. W4a keeps the five controls in one centered packed group: actions, draw, End Turn, discard/exhaust, potions. The three large controls lift together; the two small ones align with the group bottom. These are proposed shared positioning tokens, configurable with the other layout relations.

Card geometry revision: WC0 and every descendant now use 10/40/40/10 percent of CARD height. Selection/info overlays are outside that budget. CARD-SELECTION-CONTRACT.md supersedes earlier fixed card band heights and card footer-collapse guidance.

Latest card sizing: shared aspect ratio and clamped width determine height. Card table viewport equivalents are examples at wide1600×1000 / compact1000×800 / portrait400×800; they are not independent runtime width/height rules. Footer is metadata. See latest revision in CARD-SELECTION-CONTRACT.md.
