# SS-001 Persistent library preview and inspector

Status: specified; implementation and acceptance are pending.

Execution handoff: [Claude prompt for this story](SS-001-claude-execution-prompt.md).

This is the first selected task from [Tool features](../FEATURE-CHECKLIST.md#first-delivery-tool-features). It implements the bounded workspace foundation in W03 and the selection-to-inspector wiring needed by W04/W05, rather than every later feature in those packages. See the [prioritized plan](../IMPLEMENTATION-PLAN.md).

## User story

As a designer editing cards in Score Studio, I want the card library, the native preview of my selected card and its relevant editing controls to stay connected in one workspace, so I can browse, inspect and make a routine change without repeatedly opening dialogs, losing the card I am working on or editing a different card by mistake.

## Scope

Use the current local Studio and its existing dockable customization pane. On desktop, keep the library, preview and active editing surface available together. Connect the existing Properties, Design, Weights and Deck lists capabilities; do not invent six empty replacement workspaces. Make global/shared controls visibly different from selected-card controls. On narrow screens, use a clearly labelled coordinated layout rather than forcing three squeezed columns.

This story covers immediate within-page entity coordination and the layout needed for it. Deep per-tool preset/filter/default persistence, new multiselect gestures, drag/drop, new mechanic fields and the Studio-to-game starter bridge are later stories. Existing persistence and editing behavior must continue to work.

## Acceptance criteria

All criteria are pending until executed. Counts below are targets, not measured results.

| ID | Given and when | Observable pass condition |
| --- | --- | --- |
| AC01 | Open the local Studio in its normal docked mode at 1280 x 800 and 1920 x 1080. | Library, selected-card native preview and active editor are available together, with no blocking modal required for routine inspection. The three functional regions need not be three equal columns. Explicit optional floating mode can remain. |
| AC02 | Select card A and then card B from the library. | One selection activation updates the preview, inspector identity and active editable definition to B. No separate Edit button, View menu or modal is required. A is not modified. |
| AC03 | Switch among available Properties, Design, Weights and Deck lists surfaces. | The library and native selected-card preview remain accessible; surfaces use one coordinated active entity. Selected-card, shared-template, global-scoring and deck scopes are labelled honestly; switching views does not apply a global edit. |
| AC04 | Change a valid name or another existing harmless field on a disposable QA card through its inspector. | The native preview and library entry reflect the same accepted draft value. There is one live definition/form rather than cloned independent drafts; source/game files are not silently saved. Existing draft/Undo semantics are preserved. |
| AC05 | Select a card from a deck list. | Its preview and Properties become available directly, matching the row's stated action. The user does not need a second manual Customization view change to find the promised editor. The deck/library remains reachable without reopening menus. |
| AC06 | There is no valid selected card, or the selected definition becomes unavailable. | A useful empty state replaces stale content and card-specific actions cannot act on the previously selected card. Invalid IDs do not produce an exception or edit a different definition. |
| AC07 | Resize, collapse/reopen or explicitly float/dock the supported pane. | Controls remain usable, existing draft input is retained and preview/inspector still refer to the active card. Resizing has a named keyboard-operable control and an understandable minimum width. |
| AC08 | Use the workspace at 390 x 844. | Library, preview and editor have clear reachable navigation; no document-level horizontal overflow, clipped primary control or required stacked dialog. Returning to the library preserves the immediate active card. Simultaneous three-column display is not required. |
| AC09 | Navigate using keyboard and focus-visible controls, including available pane/view controls and return paths. | All essential actions are reachable without hover, focus is visible and no modal/focus trap prevents returning to the library. Card selection does not unexpectedly jump focus into a field. |
| AC10 | Browse cards and change only views/layout. | Canonical authored content, weights, decks and game saves remain unchanged. View-state persistence is allowed. Pre-existing uncommitted edits and user drafts are preserved. |
| AC11 | Repeat selection and view changes, then use existing card/item editing and optional modal controls. | No duplicated IDs/forms, duplicate change handling, stale title/preview, lost input or new console error appears. The item flow and existing supported tools remain usable. |
| AC12 | Open the actual existing local game after the Studio change and inspect/play an ordinary supported card. | Native game card rendering, controls and targeting continue to work. This is a regression check, not a claim that this story implements custom starter installation or the later complete authored-card handoff. |

## Reference UI workflow and measurement

Starting point: local Studio loaded in a normal docked desktop workspace with the library visible and a disposable QA definition available.

1. Select a visible card: target one selection activation, zero top-level menu openings, zero required modal windows.
2. Inspect its preview and Properties in place.
3. Select another visible card: target one selection activation; preview/inspector update together.
4. Change an existing QA field and observe the same live draft in preview/library. Count field focus/entry and any existing commit/blur action separately.
5. Change an available customization surface and return: target at most two pointer activations per switch when a dropdown is used; zero required workspace-reconstruction menus.
6. Repeat with keyboard and narrow-screen navigation. Count the actual path rather than assuming desktop costs carry over.

Record I want to / starting state / clicks or activations / field edits / menus / interfaces and pane switches / maximum modal depth / scroll travel / related actions outside context / expected / actual / evidence. Distinguish an intentional global/shared control from a selected-card action. Do not claim zero scrolling for all inspector fields.

## Implementation task checklist

- [ ] T01 Identify the actual local server checkout, runtime and applicable guidance; record baseline worktree/draft state without changing existing work.
- [ ] T02 Capture the current desktop/narrow layouts and exact library-to-preview-to-editor paths, including the deck-row failure.
- [ ] T03 Map the existing dock, native preview, card/item selection and view ownership; identify stale/duplicate state paths.
- [ ] T04 Write a bounded layout/state contract using the current visual language: desktop functional regions, narrow navigation, global-versus-card scope and optional floating behavior.
- [ ] T05 Connect one active entity and native preview to the existing live inspector; avoid cloning forms or creating a second renderer.
- [ ] T06 Route gallery and deck-list selection into the intended editing surface; update titles and handle invalid/empty selection safely.
- [ ] T07 Implement responsive pane sizing, keyboard/focus behavior and labelled view controls while preserving existing dock/input behavior.
- [ ] T08 Add proportionate focused tests for selection/view synchronization, no silent content mutation, empty states and existing item flow; run relevant existing checks.
- [ ] T09 Execute AC01-AC11 through the actual local Studio UI, including keyboard and narrow/desktop paths; record actual interaction costs and inspect before/after screenshots.
- [ ] T10 Execute AC12 in the actual local game and compare the affected source/draft state with the baseline; restore disposable QA changes.
- [ ] T11 Review the scoped diff and publish a review packet with criterion-by-criterion PASS/FAIL, evidence and remaining limitations. Do not mark the story complete from unit tests or screenshots alone.

## Reuse candidates and engineering traps

Resolve the served checkout before editing these known candidates: cardEditorDock.js and its CSS; the composition root in studio.js; deckListPanel.js; the existing card/item selection and native preview renderers. Local source already describes one live customization pane with Properties/Design/Weights/Deck lists and dock state. That is a candidate to adapt, not proof the served UI already meets this story.

Watch for edit() implicitly opening a modal, a deck-row callback selecting without opening Properties, reparented nodes retaining inappropriate hidden/layout state, global Weights changes being mistaken for per-card edits, stale selected IDs and duplicate event listeners. Preserve current drafts and the actual owning source revision. Later acceptance tests must not use console state injection or hand-edited saves.

## Definition of done

All twelve criteria have actual results, relevant checks pass, screenshots and interaction measurements are reviewed, QA edits are restored, and the exact implementation diff is reviewed. A documentation merge records this specification only; it does not complete any checkbox or implement the UI.
