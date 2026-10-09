# Native card master evidence

Captured October 9, 2026 from local source. These are real renderer captures,
not drawn mockups. The editor capture precedes dev reconciliation (`fa955e2130`,
working changes on `62d46efa5f`). Combat and inspection were recaptured after
reconciliation at `cddfeb2076`, using the pinned `hd-assets-v15` cache and the
tracked display-art overrides. These are source screenshot states, not evidence
of a completed playthrough.

- `editor.png`: shared component appearance editor, 1500 × 1100.
- `game-desktop.png`: posed combat screenshot state, 1440 × 1000.
- `game-inspection.png`: native card inspection at the same desktop size.
- `game-phone.png`: posed combat screenshot state, 390 × 844.

The isolated `tools/card-master-qa.mjs` run changed an action PNG through the
editor, saved it, changed the title color and footer PNG in the master file,
and verified all changes in the actual game after refresh. Captures restore
the approved appearance. `tools/card-layout-save-qa.mjs` independently verifies
grouped rank/panel transforms, save/reload, export equality and stale-write
rejection. The full card corpus passed 2,198 faces on each viewport.

These captures prove the local source presentation, not release publication.
