# SS-002 Claude execution prompt

Copy the prompt below into Claude. The [SS-002 story](SS-002-shared-working-context.md) is the acceptance reference. Check live branch and PR state before you start; the status in this prompt is a snapshot.

```text
Implement Score Studio story SS-002: one active entity and shared working context.

Build it and verify it through the Studio UI. The story and its acceptance criteria are the reference. Do not stop after a plan.

Repository
C:\repos\AshenSpire
https://github.com/cehinds/AshenSpire

Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and the guidance they point to before changing anything. Follow the delegation rules. Keep existing edits, drafts, untracked files and worktrees. Never reset, clean or overwrite unrelated work.

References
- docs/score-studio/stories/SS-002-shared-working-context.md (story, AC01 to AC13, reuse list, traps)
- docs/EDITOR-SPEC.md, section 3 (context, pin and hide) and DR05
- docs/score-studio/FEATURE-CHECKLIST.md
- docs/score-studio/IMPLEMENTATION-PLAN.md (W03)

DEPENDENCY

SS-002 builds on SS-001, PR #3008 (feature/ScoreStudioPersistentWorkspace). The reuse list was read at 086c16900ed. Check whether #3008 is merged into dev. If it is, branch from origin/dev. If not, branch from the #3008 branch and say so in the PR. Do not start from a dev that lacks the SS-001 dock and banner.

USER STORY

As a designer working in Score Studio, I want the card or item I am working on, and my place in the library, to stay the same when I switch views, galleries or panels, filter, undo or reload, so I never edit a different card by mistake or have to find my place again.

SCOPE

One card setter and one item setter. Every writer goes through them: gallery tiles, deck rows, the Design preview picker, the Design Cards/Items target, New, Duplicate, Delete, generation, subclass open, Revert, import, Undo/Redo and boot. No silent jump to the first card. Filters never change the active entity. Each gallery keeps its active entity and scroll. Re-renders keep tile focus. An entity change ends the edit burst. Reload restores gallery, card, item and view from separate view-state storage.

Out of scope: pin and compare, multiselect gestures, sort and table view (W05), presets and templates (W12, SS-004), named Undo (W09), Save and status indicators (SS-003), tool groups and command search, the game bridge, and Combat Sandbox following the selection.

ACCEPTANCE CRITERIA

Use the full table in the story. In short:

AC01 Same card everywhere: tile, banner, preview, Properties, Design, deck row and nav label agree after selecting from a tile, a deck row and the Design picker.
AC02 Design picker: choosing B makes B active everywhere; an edit changes only B.
AC03 Design target: switching Cards/Items matches the gallery and banner; no edit lands on the other kind.
AC04 Gallery switch: Cards, Items, Cards keeps each active entity and shows its tile without scrolling.
AC05 Filters: hiding the active card keeps it active, shows "Hidden by current filters" and one Clear filters action.
AC06 Focus: a re-render keeps focus on the same tile ID or a named gallery control, never the page body.
AC07 Removal: Delete names the next card; Undo of New, Revert and import show the empty state or a named valid entity.
AC08 Undo: edits on A then B undo one card at a time; the active entity does not jump.
AC09 New entities: New, Duplicate, generation and subclass open show the new entity in the banner and in view.
AC10 Reload: gallery, card, item and view return; a stale stored ID falls back without error; the draft and bundle hold no view state.
AC11 Narrow and keyboard: AC01, AC04 and AC05 at 390 x 844 and keyboard only.
AC12 No content change from browsing; no new console errors or duplicate listeners; SS-001 checks still pass.
AC13 Actual local game: inspect and play an ordinary card.

IMPLEMENTATION TASKS

Follow T01 to T11 in the story. Start by listing every writer of state.selectedCardId, state.selectedItemKey, state.artTarget, activeGallery and the dock context; the story's reuse list names them with line numbers.

ENGINEERING CONSTRAINTS

- Reuse the dock, the one native preview and the live form. Add no fourth context variable.
- Confirm the Design picker bug in the browser before fixing it.
- Do not call syncAllViews on selection.
- Keep view state out of snapshotState, DRAFT_STORAGE_KEY and Studio bundle exports.
- Combat Sandbox keeps the card it started with.
- Acceptance uses UI controls only. No console state injection, no hand-edited saves.
- Do not weaken tests or change combat code to pass.
- Small commits, each pushed as made.

MEASUREMENTS

For each workflow in the story record: I want to, starting state, activations, field edits, menus, pane switches, maximum modal depth, scroll travel, expected, actual and evidence.

Targets:
- Cards, Items, Cards: 2 activations, 0 re-selections, active tile in view.
- Design picker then edit: 1 choice plus at most 2 activations, 0 re-selections.
- Clear filters: 1 activation.
- Undo with a tile focused: 1 shortcut, 0 focus recovery.
- Reload: 0 activations.

Targets are not results.

DELIVERY

Return:
1. Branch, base (dev or #3008) and commits.
2. What changed and why.
3. AC01 to AC13 PASS or FAIL with evidence.
4. Checks run and results.
5. Fresh 1280 x 800 and 390 x 844 screenshots and a preview link.
6. Measured interaction costs.
7. Remaining work.

Tick story tasks only after verification. Do not claim the story is done from unit tests or screenshots alone.
```
