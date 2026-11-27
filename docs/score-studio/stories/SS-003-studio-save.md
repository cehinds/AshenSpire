# SS-003 Save tier: save the Studio's own config file

Status: specified; implementation and acceptance are pending. Builds on SS-001 (PR #3008) and SS-002.

Execution handoff: [Claude prompt for this story](SS-003-claude-execution-prompt.md).

The [editor specification](../../EDITOR-SPEC.md) controls the persistent workbench (§11 transactions and persistence; §4 File menu). This story is the first slice of W01, W02 and W09 in the [prioritized plan](../IMPLEMENTATION-PLAN.md) and of "Make source scope, Draft/Applied/Saved/Loaded state, Undo and import/export explicit" in [Tool features](../FEATURE-CHECKLIST.md#first-delivery-tool-features).

## Save model

The owner set three tiers on 2026-11-22. This story delivers the middle one only.

| Tier | What it does | Where it goes | Story |
| --- | --- | --- | --- |
| Auto-save | Every change goes to a temp draft. | Today: the localStorage key `ashenspire:scoreStudioDraft:v1`. Proposed later: git-ignored `.studio-temp/*.draft.json`. | Exists; the file move is later. |
| Save | Saves the Studio's own config. | Committed `content/source/studio/cards.json` and `content/source/studio/artLayers.json`. | SS-003 |
| Export | Writes into the game's card source files or an importable external JSON. | Game source, or a download. | Later |

## User story

As a designer, I want File > Save and Ctrl+S to keep my Studio work in a file in the repository, so it survives a cleared browser, follows me to another computer through git, and is not mixed into the game until I export it.

## Scope

In scope:

- File > Save and Ctrl+S write the Studio config through the local server, started with `--editor-write` (`npm run studio`).
- The Studio loads the saved config on start, after the game content and before the draft.
- One status indicator shows Draft or Saved, with the last save time and the two file paths in its title.
- In web mode (GitHub Pages, no local server) Save offers Download instead.

What Save writes:

- `content/source/studio/cards.json`: the edited and added cards, exactly the objects the draft keeps today (`editedCards()`), with their Studio `_` flags, plus the removed Core card IDs (`removedCoreIds()`). The format is `{ kind: "ashenspire.studioCards", formatVersion: 1, savedAt, cards, removedCardIds }`.
- `content/source/studio/artLayers.json`: the card and item art layer sets (`state.artLayers`, `state.itemArtLayers`). They are small and already in every snapshot, so they are cheap. The format is `{ kind: "ashenspire.studioArtLayers", formatVersion: 1, savedAt, cardArtLayers, itemArtLayers }`.
- In web mode, one download, `ashenspire-studio-save.json`, holds both sections.

Save never writes:

- View state: gallery, active card or item, dock, view, panel, filters, scroll, zoom.
- Undo and Redo stacks, staged weights, generator settings.
- Anything outside `content/source/studio/`.

Out of scope:

- Export to game card sources or an external JSON (later).
- Templates (SS-004).
- Moving the draft to `.studio-temp/` (later). This story only adds `.studio-temp/` to `.gitignore` so the later move cannot leak into git.
- Weights, decks, classes, subclass catalogs and item edits. They keep their current save paths: Weights Save writes `tools/score-studio/saved-scoring.json`, and "Save Studio bundle to repository" writes the game file `content/source/studioDecks.json`.
- Loading a downloaded save in web mode.
- Named revisions and a revision list (W09 later).

## Acceptance criteria

All criteria are pending until executed. Counts below are targets, not measured results.

| ID | Given and when | Observable pass condition |
| --- | --- | --- |
| AC01 | Local Studio on `npm run studio`. Edit a disposable QA card, then File > Save. | Both files exist under `content/source/studio/`, parse as JSON with the stated `kind` and `formatVersion`, hold the QA card and the art layers, and nothing else in the tree changes (`git status` shows only those two files). The indicator reads Saved. |
| AC02 | Edit again and press Ctrl+S, once with focus in a text field and once on a tile. | Both save. The browser's own Save page dialog never opens. The value typed last is in the file. |
| AC03 | Save, clear site data for the Studio origin, reload. | The saved QA card and art layers return. The indicator reads Saved. View state is not restored from the file. |
| AC04 | Save, edit, reload without saving. | The draft is restored on top of the saved config. The indicator reads Draft. |
| AC05 | Save in tab 1. In tab 2, which loaded before that save, edit and Save. | Tab 2 is refused with a plain message that the file changed since it loaded. Tab 1's file is unchanged. Tab 2 keeps its draft. |
| AC06 | Change a saved file outside the Studio (for example a `git pull`) while a draft from before exists, then reload. | The draft is not applied silently. One choice offers Keep my draft or Use the saved file. Either way nothing is lost until chosen. |
| AC07 | Save, then Undo, then Redo. | Undo is still available after Save. Undo makes the indicator read Draft. Redo back to the saved content reads Saved. Undo and Redo never write the file. |
| AC08 | Force a write failure (read-only file or a server that rejects the request). | The indicator reads Save failed and then Draft. Both files keep their previous bytes. No temp file is left behind. The draft is intact. |
| AC09 | Send a POST to the save endpoint with a path, a `..` segment, extra keys or a body over the size limit. | Every one is refused. The server writes only the two fixed paths. No request field chooses a path. |
| AC10 | Open the Pages build (web mode) and use File > Save and Ctrl+S. | One `ashenspire-studio-save.json` downloads. No request goes to `/__studio/`. The indicator says web mode and Download. |
| AC11 | Run `git status` after a Save session and inspect the saved files. | Only the two Studio files changed. No `.studio-temp/` file, `.env` value, token or view state is tracked or written into them. |
| AC12 | Save with no edits since the last Save. | No file bytes change (or the write is skipped), and the indicator stays Saved. |
| AC13 | Repeat AC01 and AC07 at 390 x 844 and with keyboard only. | File > Save is reachable, Ctrl+S works, the indicator is visible and focus returns to where it was. |
| AC14 | Open the actual local game after a Save. | The game is unchanged: it does not read `content/source/studio/`, no game content rebuild runs, and an ordinary card renders and plays. |

## Reference UI workflow and measurement

Starting point: local Studio docked at 1280 x 800, a disposable QA card active.

1. Edit a field and save with Ctrl+S. Target: 1 shortcut, 0 menus, 0 dialogs.
2. Save from the menu. Target: 2 activations (File, Save), 0 dialogs.
3. Reload after a Save. Target: 0 activations to see the saved work.
4. Recover from a stale-file refusal. Target: 1 choice, 0 lost edits.
5. Web mode Save. Target: 1 shortcut plus the browser's own download handling.

Record for each step: I want to, starting state, activations, menus, dialogs, maximum modal depth, expected, actual and evidence. Do not present targets as results.

## Implementation task checklist

- [ ] T01 Confirm the served checkout, that SS-001 and SS-002 code is present, and record the baseline worktree and draft.
- [ ] T02 Confirm `content-build.mjs`, `build-game.mjs`, `engine-export.mjs` and the `--watch` server ignore `content/source/studio/`. If any does not, stop and ask the owner for the folder before writing code.
- [ ] T03 Add read and save helpers for the two fixed files in `tools/score-studio-save.mjs`: schema check, symlink and escape guard, content revision, atomic two-file write with rollback.
- [ ] T04 Add one localhost endpoint in `tools/serve.mjs` with the same guards as the existing `/__studio/` routes (localhost, `--editor-write`, same origin, JSON content type, size limit). It takes no path.
- [ ] T05 Add File > Save at the top of the File menu and Ctrl+S. Commit the focused field and end any edit burst first. Web mode downloads instead.
- [ ] T06 Load the saved config in `boot()` after `loadFromRepo` and before the draft restore. Record its revision on the draft; add the Keep my draft or Use the saved file choice.
- [ ] T07 Turn `#draft-status` into the Draft / Saved indicator for the Save scope, compared against the last saved content, not a dirty flag.
- [ ] T08 Add `.studio-temp/` to `.gitignore`.
- [ ] T09 Add tests: helper path, schema, revision and rollback cases; endpoint refusals; boot order; indicator after Save, Undo and Redo. Run the existing Studio checks.
- [ ] T10 Execute AC01 to AC13 through the actual Studio UI, desktop, narrow and keyboard; record measurements.
- [ ] T11 Execute AC14 in the actual local game. Remove the QA files or restore them, review the diff and publish criterion-by-criterion PASS/FAIL.

## Reuse candidates

Read from PR #3008's branch at `086c16900ed`. Confirm names and line numbers before editing.

Server:

- `tools/serve.mjs`, the `/__studio/*` route block (about 452 to 497): localhost check, `safeHost`, `editorWrite`, origin and content-type checks, chunked body with `maxBytes`, `reply()`. Add the new route here, in the same shape.
- `tools/score-studio-save.mjs`:
  - `resolveRepoPath` (about 18) accepts any `.json` inside the repo. Do not use it for this endpoint; use fixed paths.
  - `saveSubclassCatalogLocked` (about 158): `pathOf` refuses symbolic links and paths that resolve outside the repo (about 162). The snapshot and rollback (about 240 to 268) restore exact prior bytes on failure. Reuse both.
  - `saveStudioDecks` (about 112) and `readStudioConfig` (about 33) show the read and write shape.
- `tools/lib/write-atomic.mjs`: `writeFileAtomic(file, bytes)` writes a temp file beside the target and renames it. Its dot-prefixed `.tmp` name is skipped by the `--watch` server (`WATCH_SKIP`, serve.mjs about 101).
- `tools/card-layout-save.mjs`: `hash()` (about 8) and `saveCardLayout` (about 12) refuse a save when the file's sha256 differs from the revision the editor loaded. Copy that revision check.

Studio, `tools/score-studio/studio.js`:

- `editedCards()` (about 365) and `removedCoreIds()` (about 383): the card scope, the same one the draft writes.
- `writeDraftNow()` (about 521), `saveDraft()` (about 556), `flushDraft()` and `DRAFT_STORAGE_KEY` (about 52): add the saved revision to the draft object.
- `refreshDirtyStatus()` (about 399) and `isDirty()` (about 388) drive `#draft-status`. `artLayersChanged()` (about 377) compares JSON the same way the indicator should.
- `boot()` draft restore (about 5085 to 5130) checks everything before it changes state, then merges cards by ID. Extract that card merge and reuse it for the saved file.
- `loadFromRepo()` (about 3493) reads `/__studio/config`. Load the Studio save after it.
- `saveStudioConfig()` (about 3631) is the existing Weights Save to `tools/score-studio/saved-scoring.json`. Keep it; name the new function differently.
- `setupStudioMenubar()` (about 3948): `command('file', ...)` adds File menu items. `setupShortcuts()` (about 4069) handles Ctrl+Z and Ctrl+Y after an early return for text fields.
- `isLocalServer` (about 64) and the web-mode block in boot (about 5075) hide local-only buttons. `downloadJsonFile` (`studioToolsModal.js` about 30) does the download.
- `pushHistory`, `snapshotState` and the Undo and Redo handlers (about 358, 338, 4908): Save must not touch them.

Tests:

- `tests/score-studio.test.mjs`, "score-studio-save: reads/writes custom paths inside repo and rejects escaping paths" (about 40): extend with the fixed-path, symlink, revision and rollback cases.
- `tests/score-studio.browser.mjs`: the draft restore checks (about 55 to 68) show how to boot with a stored draft through the UI.
- `tests/browser-serve.test.mjs` and `tests/serve-watch.test.mjs` for the endpoint and the watcher.

## Engineering traps

- `content/source/` is the game's authored tree. `content-build.mjs` reads its flat files and the `cards/` and `mechanics/` folders, and the `--watch` server runs a content build and reloads the page for any change under it (`buildToolFor`, serve.mjs about 108). Prove that a Save under `content/source/studio/` triggers neither. If it does, exclude the folder in `buildToolFor` with a test, or ask the owner.
- Writing outside the allowed paths: the existing `resolveRepoPath` lets a client pick any `.json` in the repo, including `package.json`. The new endpoint takes no path at all.
- Partial writes: two files must change together. Write both through `writeFileAtomic`, and if the second fails, put the first back from its prior bytes. Never leave one new and one old.
- Draft restore conflict: today the draft is applied over whatever boot loaded. Once a saved file exists, a draft made before a newer save or a `git pull` would silently undo that work. Store the saved revision in the draft and ask when it does not match.
- Undo after Save: Save is not a history step and must not clear the stacks. The indicator must compare content with the last save, so Undo back to the saved state reads Saved again.
- Ctrl+S in a text field: the current shortcut handler returns early for text fields, so the browser's Save page dialog would open. Handle Ctrl+S before that return, commit the field, end the edit burst, flush the draft, then save.
- Two "Save" commands already exist (Weights Save and "Save Studio bundle to repository"). Do not merge them into this one or rename them here. Label the new command by what it saves and where, as EDITOR-SPEC §11 asks.
- Keep `.studio-temp/` and secrets out of git: add `.studio-temp/` to `.gitignore`, write only the listed keys, and never write view state, tokens or environment values.
- The saved files are committed but are not game content. The game must not import them. Export is a separate, later step.
- Acceptance uses UI controls only. Do not inject console state or hand-edit saves to pass a check.

## Definition of done

All fourteen criteria have actual results and relevant checks pass. Screenshots and measurements are reviewed, QA files are restored and the exact diff is reviewed. Merging this document records the specification only; it does not tick any checkbox.
