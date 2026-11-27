# SS-001 Claude execution prompt

Copy the prompt below into Claude. The [SS-001 story](SS-001-persistent-workspace.md) remains the acceptance reference. Verify live branch and PR status before execution; the handoff status inside this prompt is historical context, not a current merge guarantee.

```text
Implement the first Score Studio priority task: SS-001, Persistent library, preview and inspector.

Complete the scoped implementation and verify it through the interface. Use the existing user story and acceptance criteria as your reference. Do not stop after proposing a plan.

Repository
C:\repos\AshenSpire
https://github.com/cehinds/AshenSpire

Read the applicable AGENTS.md, CLAUDE.md, AURORA.md and referenced repository guidance before changing anything. Follow repository delegation requirements using available agents. Preserve existing edits, drafts, untracked files, archives and worktrees. Never reset, clean or overwrite unrelated work.

Shared references

Documentation PR:
https://github.com/cehinds/AshenSpire/pull/3006

Reference entry point:
docs/score-studio/README.md

First story:
docs/score-studio/stories/SS-001-persistent-workspace.md

Supporting references:
- docs/score-studio/FEATURE-CHECKLIST.md
- docs/score-studio/IMPLEMENTATION-PLAN.md
- docs/score-studio/USE-CASES.md
- docs/score-studio/implementation-plan.json

Check live GitHub state before acting. At this handoff, PR #3006 remains open at c906cb26576bdd8f77f6d8dca3a2551f1724fde0. Its documentation, receipt validation and independent review passed, but existing game-code CI failures prevent merging. Repair PR #3003 also remains open.

The user explicitly requested merging the documentation reference into dev. Complete that merge when its required checks pass. Do not bypass checks or merge unrelated PRs. You may continue independent local SS-001 implementation while the documentation merge waits. Keep implementation separate from the documentation PR.

Obtain the reference files from PR #3006 if they are not yet on dev. Do not assume the current working checkout contains them.

USER STORY

As a designer editing cards in Score Studio, I want the card library, the native preview of my selected card and its relevant editing controls connected in one workspace, so I can browse, inspect and edit without repeatedly opening dialogs, losing my place or accidentally changing another card.

SCOPE

Adapt the existing dockable customization pane and native preview.

Connect the existing Properties, Design, Weights and Deck lists surfaces. On desktop, keep the library, preview and active editor available together. They do not need three equal columns. On narrow screens, provide clear coordinated navigation.

Distinguish selected-card controls from shared-template, global-scoring and deck controls.

Known source candidates:
- tools/score-studio/cardEditorDock.js
- tools/score-studio/cardEditorDock.css
- tools/score-studio/studio.js
- tools/score-studio/deckListPanel.js
- Existing card/item selection and native preview components

Resolve the actual serving checkout before editing. The previously tested Studio was http://127.0.0.1:4187/tools/score-studio/, but its served source differed from the main checkout. Verify the current server, source and revision.

Do not expand this task into new drag/drop, presets, mechanic fields, generation systems, six empty replacement workspaces or the custom-starter game bridge. Preserve existing functionality.

ACCEPTANCE CRITERIA

Use the full SS-001 document. Its required outcomes are:

AC01 — Desktop:
At 1280×800 and 1920×1080, normal docked operation keeps library, native selected-card preview and active editor available without a blocking inspection modal. Optional floating mode may remain.

AC02 — Selection:
Selecting card B after card A updates the preview, inspector identity and editable definition in one selection action. No separate Edit/View/modal step is required. Card A remains unchanged.

AC03 — Connected surfaces:
Switching existing customization surfaces retains a coordinated active entity and accessible library/preview. Global and shared editing scopes are clear. Switching views does not apply changes.

AC04 — One live draft:
An existing harmless field edited on a disposable QA card updates its native preview and library entry consistently. Do not clone independent forms or drafts. Preserve existing draft and Undo semantics; do not silently save game files.

AC05 — Deck-list navigation:
Selecting a deck-list card makes its promised Properties available directly, without another manual customization-view change. The library/deck remains reachable.

AC06 — Empty and invalid state:
Unavailable or invalid selection produces a useful empty state. Actions cannot edit a stale or different card.

AC07 — Pane controls:
Supported resize, collapse/reopen and float/dock operations preserve input and the correct active entity. Resizing is labelled and keyboard operable.

AC08 — Narrow layout:
At 390×844, library, preview and editor remain clearly reachable without document-level horizontal overflow, clipped primary controls or required stacked dialogs. Returning preserves the immediate active card.

AC09 — Keyboard and focus:
Essential actions work without hover. Focus is visible, selection does not unexpectedly jump into a field, and no focus trap prevents returning to the library.

AC10 — No unintended writes:
Browsing and changing views/layout do not alter canonical cards, weights, decks or game saves. View-state storage is allowed. Preserve pre-existing drafts and edits.

AC11 — Regression:
Repeated selection/view changes cause no duplicated forms/IDs/listeners, stale titles/previews, lost input or new console errors. Existing item editing and supported tools remain usable.

AC12 — Actual local-game regression:
Open the existing actual local game and inspect/play an ordinary supported card. Rendering, controls and targeting still work. This does not require implementing the later custom-starter bridge.

IMPLEMENTATION TASKS

1. Identify the actual serving checkout and revision; record repository and draft baseline.
2. Capture current desktop/narrow screenshots and interaction paths, including the deck-row issue.
3. Map existing dock, preview, selection and view ownership.
4. Write the bounded layout/state contract using the existing visual language.
5. Connect one active entity to the native preview and existing live inspector.
6. Correct gallery/deck-list routing, titles and empty states.
7. Implement responsive sizing and keyboard/focus behaviour.
8. Add proportionate focused tests and run relevant existing checks.
9. Execute AC01–AC11 through the local Studio interface.
10. Execute AC12 in the actual local game; restore disposable QA changes.
11. Independently review the diff and produce criterion-by-criterion results.

ENGINEERING CONSTRAINTS

- Reuse one native renderer and live form; avoid parallel state systems.
- Watch for edit() forcing a modal, deck callbacks selecting without opening Properties, stale selected IDs, inappropriate hidden state after reparenting and duplicated listeners.
- Keep global Weights edits distinct from card edits.
- Keep Studio styles scoped so game rendering is unaffected.
- Use UI controls for acceptance actions. Do not inject application state, hand-edit saves or substitute a simulator.
- Use read-only logs and exports to verify results.
- Do not weaken tests or change unrelated combat code to make this task pass.
- Keep commits small and scoped.
- Implementation push/merge requires authorization in the current session. Do not infer release or branch-promotion authority from the documentation merge request.

MEASUREMENTS

Report each workflow as:

“I want to…”
- Starting state
- Actual button/menu activations
- Field edits and dropdown selections
- Keyboard actions or drag gestures
- Menus and panels opened
- Workspace switches and maximum modal depth
- Scrolling required
- Related actions unavailable in context
- Expected versus actual result
- Evidence

Targets:
- Select another visible card: one selection action, no menu or required modal.
- Switch an available customization surface: at most two pointer activations with a dropdown.
- Record narrow-screen and keyboard costs separately.

Do not present targets as measured results.

DELIVERY

Return:
1. Exact branch, checkout and implementation commit.
2. Documentation PR #3006 merge status.
3. What changed and why.
4. AC01–AC12 PASS/FAIL with evidence and limitations.
5. Checks run and their results.
6. Fresh inspected desktop and narrow screenshots plus a working local preview.
7. Actual interaction measurements.
8. Remaining work.

Mark story tasks complete only after verification. If an external prerequisite blocks part of the work, identify it precisely and continue independent scoped work. Do not claim the feature is complete from unit tests, screenshots or a static mock alone.
```
