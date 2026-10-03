# Reading Desk implementation, October 3, 2026

Recovered from **Show deck editor illustrations**
(`01a0ffde-bdb8-75e1-b27a-29a23598427b`), originally designed in
`01a0ee2d-2ae5-7110-90f7-fa014213546a`. The separate authoring editor has its own
implementation at `6bba8aa`; this branch implements the design in the game's
actual `mountDeckEditor` used by Map Quick Access, Armoury and eligible Rest sites.

## Inventory and assets

Three desktop concepts and three mobile concepts remain unchanged in this folder.
`provenance.json` records the original paths and hashes for 78 recovered files.
Seven paintings at two resolutions plus outline symbols match the published
`hd-assets-v6` pack exactly (70 card files checked). The runtime now references
canonical `assets/cards/...` IDs; `assetUrl` resolves them through the normal
verified art pipeline. The background uses the pack's title-city artwork.

## Implemented

- Illustrated collection with search, All / In Deck and explicit addition.
- Native full-card inspection with flavor, visible glossary and resource costs.
- Searchable deck, per-variant counts, List / Cards, collapsible type groups.
- Drag grips/drop target and existing mouse, touch-hold, keyboard/controller paths.
- Multi-step Undo; Cancel restores the opening state; Done preserves valid changes.
- Mobile pane navigation and Back with the original pane retained after removal.
- Ordered mode keeps deck sequence and reorder controls instead of grouping by type.
- Real ownership, copy limits, equipment profiles and locks remain authoritative.

## Local preview

`http://127.0.0.1:4340/deck-reading-desk-preview.html` is an isolated run of the
production component. Add `?ordered=1` for ordered-deck controls.

The packaged game is at
`http://127.0.0.1:4340/build/deck-reading-desk-v6-high/AshenSpire.html?shot=map`.
Open the map's Deck button. Screenshot mode uses ephemeral storage.

## Validation

The final focused suite passed 85 tests, including 588 internal playing-card assertions. Art manifest tests
passed 14 tests. The full bundle and 198 external-pack checks pass. Browser checks
cover the actual game door, add/save/reopen, asset-object loading, Undo, search,
view switching, folded groups and mobile action reachability.

See `/design-qa.md` for captures, intentional visual differences and scope.
Remote CI, merge/promotion and physical device acceptance remain unverified.
