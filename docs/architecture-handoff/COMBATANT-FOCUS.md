# Combatant focus geometry

Selection must never change the scale used to fit the battlefield. Player and enemy groups of the same size category use a shared base scale calculated from their unselected envelopes. Recompute that base only when host allocation, roster, size category, or configuration changes.

`combatant-focus.mjs` supplies defaults; `combatant-focus.js` contains pure calculations. Upper/middle/lower depth factors are 0.9/0.95/1. Selected growth is 1.1/1.05/1.1, read from configuration. Selection raises an actor within its formation-column layer. Outer columns carry the back-row tag and always paint above inner/front-row columns.

## Integration

1. Capture or derive each actor's unselected sprite/frame envelope before enabling inspection, target controls, or expanded status details. Keep these dimensions separate from current DOM bounds. Do not temporarily remove selection for every layout pass: measure once per geometry invalidation or use the declared component model.
2. Group actors by shared size category. Pass the player and enemy allocations together to `sharedCombatantBaseScale(groups, config)`. Each group represents one row; nested lower/middle/upper depth arrangements should supply their individual row allocations.
3. Calculate `rowPresentationScale(actor.row, actor.selected, config)`. Final transform scale equals shared category base scale multiplied by its returned factor. Add the configured formation-column layer to returned `zPriority` on the actor positioning wrapper.
4. Keep the actor's configured sprite baseline center fixed and use that point as the transform origin. Do not reposition the actor using the expanded inspector, info button, or status bounds.
5. Selected details may paint beyond the allocation. They must not introduce scrollbars or trigger a smaller battlefield fit. Pointer targets and keyboard focus remain attached to their owning actor.
6. Resolve competing selected actors deterministically using existing selection ordering; the helper provides the focus layer but does not invent selection state.

```text
INPUT categoryGroups, presentationConfig, selectionSnapshot
// Recompute only after unselected geometry or allocated host space changes.
baseScale = SharedCombatantBaseScale(categoryGroups, presentationConfig)
FOR actor IN categoryGroups
  rowStyle = RowPresentationScale(actor.row, selectionSnapshot.contains(actor.id), presentationConfig)
  SetTransformOrigin(actor, presentationConfig.stableAnchor)
  ApplyScale(actor, baseScale * rowStyle.factor)
  SetPaintPriority(actor, FormationColumnLayer(actor.formationRow) + rowStyle.zPriority)
// Never feed selected bounding rectangles back into baseScale.
```

The minimum scale is a presentation fallback; a zero-sized or heavily crowded host cannot guarantee readable or contained actors. Existing legibility compensation and status overflow handle those conditions separately. Selection growth deliberately overflows its unselected envelope instead of shrinking the opposing faction.


## Composition constraint

The current combat allocation is nominally 10% HUD / 50% battlefield / 35% hand / 5% footer. The footer has a configured 56px touch floor and the hand yields the extra space on short viewports. That responsive allocation can invalidate the cached battlefield host geometry; selection itself cannot. Compute row factors from config: back/middle/front 0.9/0.95/1, selected growth 1.1/1.05/1.1. Keep the shared category fit across factions, foot anchor and highest selected paint layer unchanged.
