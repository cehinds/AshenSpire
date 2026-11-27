# SS-002 One active entity and shared working context

Status: specified; implementation and acceptance are pending. Builds on SS-001 (PR #3008).

Execution handoff: [Claude prompt for this story](SS-002-claude-execution-prompt.md).

The [editor specification](../../EDITOR-SPEC.md) controls the persistent parent workbench (§3 context, pin and hide; DR05). This is the second item in [Tool features](../FEATURE-CHECKLIST.md#first-delivery-tool-features). It completes the bounded W03 context slice that SS-001 started. It does not deliver W05 selection gestures, W12 presets or W09 named Undo. See the [prioritized plan](../IMPLEMENTATION-PLAN.md).

## User story

As a designer working in Score Studio, I want the card or item I am working on, and my place in the library, to stay the same when I switch views, galleries or panels, filter, undo or reload, so I never edit a different card by mistake or have to find my place again.

## Scope

In scope:

- One active-entity setter for cards and one for items. Every current writer uses it: gallery tiles, deck rows, the Design preview picker, the Design Cards/Items target, New, Duplicate, Delete, generation, subclass open, Revert, import, Undo/Redo and boot.
- The Design preview picker and Cards/Items target follow the active entity and gallery. Changing them changes the active entity everywhere, or they become plain labels. They never diverge.
- No silent jump to the first card. When an operation removes the active entity, show the empty state or a named, explicit replacement.
- Filters never change the active entity. When filters hide it, the header says so and offers one Clear filters action.
- Switching Cards and Items keeps each gallery's active entity and scroll position. Returning shows the active tile.
- A gallery re-render keeps keyboard focus on the same stable-ID tile.
- An active-entity change ends any open edit burst, so one Undo never spans two cards.
- Reload restores the gallery, the active card, the active item and the customization view. This is view state only, stored apart from the draft.

Out of scope, owned by later packages:

- Pin, compare and multiple inspectors.
- Multiselect gestures, sort, table view and saved filters (W05).
- Presets and templates (W12; see SS-004).
- Named Undo and history UI (W09).
- Draft/Applied/Saved/Loaded indicators and the Save tier (W01, W02, W09; see SS-003).
- The six tool groups, breadcrumbs and command search (W03 later).
- The starter and game bridge (W06, W07).
- Combat Sandbox. It keeps the card it injected at start.

Existing editing, dock and draft behavior must keep working.

## Acceptance criteria

All criteria are pending until executed. Counts below are targets, not measured results.

| ID | Given and when | Observable pass condition |
| --- | --- | --- |
| AC01 | Select a card from a gallery tile, then from a deck row, then from the Design preview picker. | Each time, the tile highlight, card banner, preview, Properties fields, Design preview, deck-row current mark and narrow nav label all show the same card. |
| AC02 | Card A is active. Choose card B in the Design preview picker, switch to Properties and change a harmless field on a disposable QA card. | B is active everywhere before the edit. The edit changes only B; A is byte-identical. |
| AC03 | Switch the Design Cards/Items target. | The gallery context matches the target and the banner shows the matching active item or card. No edit lands on the other kind. |
| AC04 | Scroll the Cards gallery, select a card, switch to Items, select an item, switch back to Cards. | The same card is active, its tile is in view without scrolling, and the Items gallery keeps its own active item. |
| AC05 | Apply a filter that hides the active card, then use the banner's Clear filters action. | The active card does not change and Properties still edits it. The banner says "Hidden by current filters". After clearing, its tile is in view. No filter change selects another card. |
| AC06 | Focus a gallery tile, then trigger a re-render (Ctrl+Z, filter change, rescore). | Focus stays on the tile with the same ID, or moves to a named gallery control if that card is gone. Focus never drops to the page body. |
| AC07 | Delete an added card; separately Undo a New card, Revert, and import a bundle that drops the active card. | Delete selects the next card in displayed order and names it. The other operations show the empty state or a named, still-valid entity, never a silent first card. No action targets the removed ID. |
| AC08 | Type in a field on card A, select B, type in B, then Undo once and again. | The first Undo reverts only B's change, the second only A's. The active entity does not jump during Undo. |
| AC09 | Create a card with New, Duplicate, generation and subclass open. | The new active entity shows in the banner, its tile is highlighted and in view, and the banner and Properties agree. |
| AC10 | Reload the page with a card, an item and a view active. Repeat after deleting the stored card. | The same gallery, card, item and view return without any activation. An invalid stored ID falls back to the existing default without error. The draft and bundle do not contain the view state. |
| AC11 | At 390 x 844 and with keyboard only, repeat AC01, AC04 and AC05. | The Library/Card switch keeps the active entity and the library scroll position. The nav label matches the banner. Focus is visible and never trapped. |
| AC12 | Browse, switch, filter and reload only. | Canonical cards, weights, decks, art layers and game saves do not change. Pre-existing drafts are kept. No new console errors or duplicate listeners appear. SS-001 checks still pass. |
| AC13 | Open the actual local game and inspect and play an ordinary supported card. | Rendering, controls and targeting work. This is a regression check only. |

## Reference UI workflow and measurement

Starting point: local Studio docked at 1280 x 800, Cards gallery scrolled part way, a disposable QA card active.

1. Switch Cards, then Items, then Cards. Target: 2 activations and 0 re-selections; the active tile is in view with no scroll.
2. Pick a card in the Design preview picker, then edit it in Properties. Target: 1 dropdown choice plus at most 2 activations for the view switch; 0 re-selections.
3. Hide the active card with a filter, then clear it. Target: 1 activation from the banner.
4. Undo with a tile focused. Target: 1 shortcut; 0 focus recovery actions.
5. Reload. Target: 0 activations to return to the same card and view.
6. Repeat 1, 3 and 5 at 390 x 844 and with keyboard. Record the actual path.

Record for each step: I want to, starting state, activations, field edits, menus, pane switches, maximum modal depth, scroll travel, expected, actual and evidence. Do not present targets as results.

## Implementation task checklist

- [ ] T01 Confirm the served checkout and that SS-001 code is present; record the baseline draft and worktree state.
- [ ] T02 Reproduce current behavior for AC01 to AC10 in the browser, including the Design picker case; capture screenshots.
- [ ] T03 List every writer of the active card and item, plus `state.artTarget`, `activeGallery` and the dock context; write a short state contract.
- [ ] T04 Add one card setter and one item setter that refresh tiles, banner, Properties, Design and deck rows once; route all writers through them.
- [ ] T05 Remove silent first-card fallbacks; define the removal rule for Delete, Undo/Redo, Revert and import.
- [ ] T06 Join the Design target and preview picker to the gallery context and active entity.
- [ ] T07 Add the Hidden by current filters notice with Clear filters; keep per-gallery scroll anchors; restore tile focus after re-render.
- [ ] T08 End open edit bursts on entity change; add reload restore as separate view-state storage.
- [ ] T09 Add focused tests for setter routing, removal fallback, filter-hidden state, focus restore, burst boundary and reload restore; run existing Studio checks.
- [ ] T10 Execute AC01 to AC12 through the actual Studio UI, desktop, narrow and keyboard; record measurements.
- [ ] T11 Execute AC13 in the actual local game; restore QA changes; review the diff and publish criterion-by-criterion PASS/FAIL.

## Reuse candidates

Confirm names and line numbers on your checkout before editing; they move as SS-001 lands. Read from PR #3008's branch `feature/ScoreStudioPersistentWorkspace` at `086c16900ed` ("Show the card menu as a plain ellipsis on the Generate line"). All paths are under `tools/score-studio/`.

Dock, `cardEditorDock.js`:

- `selectedId(kind)` (about line 41) reads the active card or item through `ctx.getSelectedId` or `state.selectedCardId`. Keep it as the one read path.
- `isValid(kind)` (about 44) checks the ID still exists. Reuse it for the empty state and the filter-hidden check.
- `actOnSelection(cardAction, itemAction)` (about 237) reads the ID at click time. Copy this pattern for any new card action.
- `placeQuickFields()` (about 175) moves quick fields into the header. It must run after every entity change.
- `showLibrary(kind)` (about 300) scrolls to and focuses the active tile. Reuse it for the Cards/Items return and Clear filters.
- `setContext(value)` (about 332) is the dock's `context`. It calls `ctx.onContextChange`. Join it to `activeGallery` and `state.artTarget`.
- `edit(id, kind)` (about 345) selects through `ctx.selectCard` or `ctx.selectItem`, then shows Properties.
- `showProperties()` (about 355) shows Properties in place and focuses the entity heading.
- `renderEntity()` (about 381) owns the banner, empty state, scope line and narrow nav labels. Add the "Hidden by current filters" notice here.
- `refresh()` (about 410) re-renders the whole pane. The public API (about 467) exposes `refresh`, `refreshEntity`, `setContext` and `setView`.

Deck list, `deckListPanel.js`:

- `renderRow` (about 109) marks the current row with `is-current` and `aria-current`. The row click (about 120) calls `ctx.selectCard` or `ctx.selectItem`, then `ctx.onRowSelect`, then `refresh()`.
- `studio.js` wires it in boot (about 5049). `selectCard` clicks the Cards tab and calls `selectStudioCard`; `onRowSelect` calls `cardEditorDockUi.showProperties()`.

Composition root, `studio.js`:

- `selectStudioCard(id)` (about 1520) and `selectStudioItem(key)` (about 3029) are the closest thing to setters today. Grow these into the two setters.
- `renderInspector()` (about 1621) and `renderItemInspector()` (about 3038) fall back to `state.cards[0]` and `state.items[0]` and write the ID back. Remove the fallback.
- `selectedCardDef()` (about 2255) is what edits act on. `mutateSelectedCard` (about 2336) and `applyLiveCardEdit` go through it.
- `createEditBurst()` (about 2260) returns `begin` and `end`. Call `end()` on every open burst when the entity changes.
- `getFilteredCards()` (about 1459) is the filter. Use it to decide "hidden by filters"; never use it to pick a new card.
- `renderCardsGrid()` (about 1483) and `renderItemsGrid()` (about 2982) clear `innerHTML`. Restore focus by `data-card-id` or `data-item-key` after the rebuild.
- `renderArtTab()` (about 3176) fills `#art-preview-card-select` (about 3191) from all cards or items and prefers the active one.
- The preview picker change handler (about 4760) writes `state.selectedCardId` or `state.selectedItemKey` and calls only `renderArtPreviewOnly()` (about 3164). Route it through the setters.
- The art target buttons, `[data-art-target]` (about 4741), set `state.artTarget` without touching `activeGallery` or the dock context.
- The tab handler (about 4221) sets `activeGallery`, `state.artTarget` and the dock context for Cards and Items. `weights` and `art` tabs re-click the active gallery and set the dock view.
- `setCustomizationView(view)` (about 3923) re-clicks the active gallery tab, then sets the dock view and panel.
- `syncAllViews()` (about 3825) rebuilds everything. Keep it for data changes, not selection.
- `snapshotState()` (about 338), `pushHistory()` (about 358) and `restoreSnapshot()` (about 570). The snapshot holds content only. `restoreSnapshot` silently resets the selection to the first card and item (about 582 and 583).
- Undo and Redo buttons (about 4908 and 4914) call `restoreSnapshot`. The Ctrl+Z and Ctrl+Y shortcuts (about 4086) click them.
- Selection writers outside the setters: New (about 4272, sets `state.selectedCardId = id`), Duplicate (about 4298), Delete (about 4327, picks the card at the same index), generation `applyGeneratedPool` (about 977, sets the first fresh card at about 1007), `revertToRepo()` (about 3730, keeps the old ID or falls back to the first at about 3742 and 3743) and `boot()` (about 4980, first card and first item at about 4996 and 5000).
- `applyCardJson()` (about 1993) already calls `selectStudioCard` when the dialog's card is not active. Keep that.
- `writeStoredJson` and `readStoredJson` (about 3848) are the safe storage helpers. Use them with a new view-state key, apart from `DRAFT_STORAGE_KEY` (about 52). The dock already keeps its own `VIEW_KEY` and `CARD_EDITOR_DOCK_KEY`.

Removal, `cardSelection.js`:

- `removeCardsAndReferences(state, ids)` (about 54) returns `selectedCardId: cards[0]` when the active card is removed (about 77). `removeAddedCardsFromState` (about 87) wraps it for Delete. Return "no choice" here and let the caller apply the named replacement rule.

Other selection writers:

- `studioToolsModal.js`: `runBatchGenerate()` (about 536) sets the first card (about 575) or first item (about 605). `applyImportedBundle()` (about 170) replaces cards and calls `syncAllViews` without checking the active ID.
- `subclassCatalog.js`: `mergeSubclassCatalog()` (about 98) returns `selectedCardId: cards[0]` (about 124). The subclass preview click handler (about 276) sets `state.selectedCardId = list.cardIds[0]` (about 283) and calls `syncAllViews` twice.

Tests to extend:

- `tests/score-studio-editor-dock.test.mjs`: dock context, view and selection (for example "customization views reuse live inputs and preserve the gallery and selection across context changes").
- `tests/score-studio-selection.test.mjs`: `removeCardsAndReferences` fallback and removal rules.
- `tests/score-studio-deck-catalog.test.mjs`: deck row selection.
- `tests/score-studio.browser.mjs`: browser checks for reload, draft restore and focus.

## Engineering traps

- The Design preview picker's change handler sets `state.selectedCardId` but only re-renders the art preview. The banner and Properties keep showing A while `selectedCardDef()` returns B. Confirm this in the browser before fixing it.
- `renderInspector` and `renderItemInspector` fall back to the first card or item. With `restoreSnapshot` and `removeCardsAndReferences` (cardSelection.js) they can swap the active card without telling anyone.
- Three variables describe one context: `activeGallery`, `state.artTarget` and the dock `context`. Join them; do not add a fourth.
- `renderCardsGrid` and `renderItemsGrid` clear `innerHTML`, which destroys the focused tile.
- An edit burst holds one history entry for about a second. Selecting another card inside that window can merge two cards into one Undo.
- Keep view state out of `snapshotState`, the draft (`DRAFT_STORAGE_KEY`) and Studio bundle exports. Use a separate key.
- Do not call `syncAllViews` on each selection. It rebuilds everything and is slow with large pools.
- Combat Sandbox (`startSandboxCombat`) reads the selection once at start. Do not make it follow the selection silently.
- Do not clone the native preview into Design. SS-001 moved the single preview into the card banner section.
- Acceptance uses UI controls only. Do not inject console state or hand-edit saves.

## Definition of done

All thirteen criteria have actual results and relevant checks pass. Screenshots and measurements are reviewed, QA edits are restored and the exact diff is reviewed. Merging this document records the specification only; it does not tick any checkbox.
