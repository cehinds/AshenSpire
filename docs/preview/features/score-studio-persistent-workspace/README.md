# Capture record: Score Studio persistent workspace (SS-001)

- Feature: one workspace for the card library, the selected card's preview and its editor (PR #3008).
- Source commit: ebcd01a9825 (branch feature/ScoreStudioPersistentWorkspace).
- Build: 0.7.5.130.
- Captured: 2026-11-27, Microsoft Edge via Playwright, from `tools/serve.mjs` on this branch.
- Page: `/tools/score-studio/`, card "Advance" selected.
- Card art shows placeholders: the art packs are not fetched in the capture worktree.

| File | Viewport | Shows |
| --- | --- | --- |
| desktop-before.png | 1280x800 | Before (dev): Edit on a card opens a modal over the library |
| desktop.png | 1280x800 | Library, preview and Properties side by side |
| desktop-weights.png | 1280x800 | Weights view: preview stays, labelled "Global scoring" |
| wide.png | 1920x1080 | Same layout on a wide screen |
| tablet.png | 768x1024 | Narrow layout, Card panel |
| mobile-library.png | 390x844 | Narrow layout, Library panel |
| mobile.png | 390x844 | Narrow layout, Card panel |

Game build (Score Studio is not inside it): feature-preview artifact of run 45923237379.
