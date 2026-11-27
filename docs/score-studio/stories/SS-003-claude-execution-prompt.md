# SS-003 Claude execution prompt

Copy the prompt below into Claude. The [SS-003 story](SS-003-studio-save.md) is the acceptance reference. Check live branch and PR state before you start; the status in this prompt is a snapshot.

```text
Implement Score Studio story SS-003: the Save tier, saving the Studio's own config file.

Build it and verify it through the Studio UI. The story and its acceptance criteria are the reference. Do not stop after a plan.

Repository
C:\repos\AshenSpire
https://github.com/cehinds/AshenSpire

Read CLAUDE.md, CONTRIBUTING.md, DEVELOPER.md and the guidance they point to before changing anything. Follow the delegation rules. Keep existing edits, drafts, untracked files and worktrees. Never reset, clean or overwrite unrelated work.

References
- docs/score-studio/stories/SS-003-studio-save.md (save model, AC01 to AC14, reuse list, traps)
- docs/EDITOR-SPEC.md, section 11 (transactions and persistence) and section 4 (File menu)
- docs/score-studio/IMPLEMENTATION-PLAN.md (W01, W02, W09)

DEPENDENCY

SS-003 builds on SS-001, PR #3008, and SS-002. The reuse list was read at 086c16900ed on feature/ScoreStudioPersistentWorkspace. Check what is merged into dev. Branch from origin/dev if both are in; otherwise branch from the newest of them and say so in the PR.

USER STORY

As a designer, I want File > Save and Ctrl+S to keep my Studio work in a file in the repository, so it survives a cleared browser, follows me to another computer through git, and is not mixed into the game until I export it.

SAVE MODEL (owner, 2026-11-22)

- Auto-save: every change goes to a temp draft. Today the localStorage draft; later git-ignored .studio-temp/*.draft.json. Not this story.
- Save: the Studio's own config. This story.
- Export: into the game's card sources or an importable JSON. Later.

SCOPE

Save writes two fixed files through the local server's editor-write path:
- content/source/studio/cards.json: edited and added cards as the draft keeps them (editedCards()), plus removedCoreIds().
- content/source/studio/artLayers.json: state.artLayers and state.itemArtLayers.
Never view state, Undo stacks, staged weights or generator settings. Never any other path.

The Studio loads the saved config on start, after loadFromRepo and before the draft. One indicator shows Draft or Saved. Web mode downloads one ashenspire-studio-save.json instead. Add .studio-temp/ to .gitignore.

Out of scope: Export, templates (SS-004), moving the draft to .studio-temp, weights, decks, classes, subclass catalogs, item edits, loading a downloaded save, named revisions.

ACCEPTANCE CRITERIA

Use the full table in the story. In short:

AC01 File > Save writes both files with kind and formatVersion; git status shows only them; indicator reads Saved.
AC02 Ctrl+S works in a text field and on a tile; the browser Save page dialog never opens; the last typed value is saved.
AC03 Saved work returns after clearing site data and reloading; view state does not come from the file.
AC04 An unsaved edit returns as a draft on top of the saved config; indicator reads Draft.
AC05 A second tab with a stale revision is refused; the file is unchanged; its draft is kept.
AC06 A file changed outside the Studio is not overwritten by an older draft; one choice: Keep my draft or Use the saved file.
AC07 Undo after Save still works, reads Draft; Redo back reads Saved; neither writes the file.
AC08 A failed write leaves both files' bytes, no temp file and the draft intact; indicator says so.
AC09 The endpoint refuses paths, .. segments, extra keys and oversize bodies; it writes only the two fixed paths.
AC10 Web mode downloads one file and sends no /__studio/ request.
AC11 No .studio-temp file, secret or view state is tracked or written.
AC12 Saving with no changes changes no bytes.
AC13 Narrow 390 x 844 and keyboard: Save reachable, Ctrl+S works, indicator visible.
AC14 Actual local game unchanged; no content rebuild; an ordinary card renders and plays.

IMPLEMENTATION TASKS

Follow T01 to T11 in the story. Do T02 first: prove content-build.mjs, build-game.mjs, engine-export.mjs and the --watch server ignore content/source/studio/. If any of them reads or rebuilds on it, stop and ask the owner before writing code.

ENGINEERING CONSTRAINTS

- Fixed paths only. Do not reuse resolveRepoPath for this endpoint; it accepts any .json in the repo.
- Reuse the /__studio/ route guards in serve.mjs, the symlink guard and rollback in saveSubclassCatalogLocked, writeFileAtomic, and the sha256 revision check in card-layout-save.mjs.
- Both files change together or neither does.
- Save is not a history step. Do not clear or push Undo.
- Handle Ctrl+S before the text-field early return in setupShortcuts; commit the field and end the edit burst first.
- Keep the existing Weights Save and "Save Studio bundle to repository" as they are. Name the new function and command by what they save.
- The game must not read the Studio files.
- Acceptance uses UI controls only. No console state injection, no hand-edited saves.
- Do not weaken tests. Small commits, each pushed as made.

MEASUREMENTS

For each workflow in the story record: I want to, starting state, activations, menus, dialogs, maximum modal depth, expected, actual and evidence.

Targets:
- Ctrl+S: 1 shortcut, 0 menus, 0 dialogs.
- File > Save: 2 activations.
- Reload after Save: 0 activations.
- Stale-file recovery: 1 choice, 0 lost edits.

Targets are not results.

DELIVERY

Return:
1. Branch, base and commits.
2. What changed and why, including the T02 finding.
3. AC01 to AC14 PASS or FAIL with evidence.
4. Checks run and results.
5. Fresh 1280 x 800 and 390 x 844 screenshots of the indicator and File menu, and a preview link.
6. Measured interaction costs.
7. Remaining work.

Tick story tasks only after verification. Do not claim the story is done from unit tests or screenshots alone.
```
