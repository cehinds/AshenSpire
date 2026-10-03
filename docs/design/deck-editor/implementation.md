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
`hd-assets-v6` pack exactly (70 card files checked). The v7 adoption preserves
every v6 asset and adds the published sapphire mana diamond and green stamina
orb. All new high/light files were checked against their release hashes. The runtime references
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
- All cards can be removed to the library; equipment tags gate additions.
- Removed equipment grants remain sideboarded through save/load and combat swaps.
- Fixed-height rows with two-line bottom-anchored descriptions and inline Inspect.
- Canonical 5:7 inspection, proportional thumbnails, compact desktop layout.
- Configurable resource groups and order, default MP then combined SP; icon numbers are separate text.
- Desktop-only skill sprite playback uses combat routing and supports exact-frame Pause/Play.
- The alternative-art control stays unavailable until alternate artwork is authored.
- `../deck-row-editor/` provides snapping, resizing, position/font controls, wireframe mode,
  independent resource icon/text layers and validated JSON import/export for layout references.

## Local preview

`http://127.0.0.1:4340/deck-reading-desk-preview.html` is an isolated run of the
production component. Add `?ordered=1` for ordered-deck controls.

The prior packaged preview is at
`http://127.0.0.1:4340/build/deck-reading-desk-v6-high/AshenSpire.html?shot=map`.
Open the map's Deck button. Screenshot mode uses ephemeral storage.

## Validation

The previous illustration integration passed 85 tests, including 588 internal playing-card assertions. Art manifest tests
passed 14 tests. The full bundle and 198 external-pack checks pass. Browser checks
cover the actual game door, add/save/reopen, asset-object loading, Undo, search,
view switching, folded groups and mobile action reachability.

See `/design-qa.md` for captures, intentional visual differences and scope.
Current refinement checks: 39 deck DOM tests; 100 combined model/removal, save/pool
and smith extraction/install regressions; five animation lifecycle/routing tests; 35 cost/config tests; three
row-editor geometry/import tests. Browser checks verified exact-frame pause,
mobile absence of sprite images, all resource icons loaded, fixed 82px rows,
two-line descriptions, editor drag/resize/snapping, saved drafts and JSON copy.
Independent review of PR #1535 found and verified a fix for stale sideboard
mount contents after smith extraction/installation, including unequipped gear.
The reviewer approved the fix and independently reran its three regression cases.
Build 0.7.1.840 (digest `6f15217dd5`) completed with the pack and light standalone
outputs. The packaged game was opened through Map → Deck → Edit deck: inline
Inspect left the previous card unchanged until pressed, Pause changed to Play,
all deck images loaded, the card retained its 5:7 ratio, and an equipment card
was removed and restored successfully. No browser errors were logged.
The broader test run overlapped a base merge and is being rerun on the settled
tree. Final CI/merge evidence will be recorded before promotion.
