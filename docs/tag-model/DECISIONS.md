# Tag model: owner decisions

Each section records one owner decision from 2026-10-11, what it decided, and
what changed in the tables. A decision that changes no table says so. Open
points are listed in *Couldn't place* at the end of each section and again in
the final section.

Tables are regenerated with `tools/build.mjs`; `tools/check.mjs` validates them.
Formula, relation and value keys follow the README conventions.

---

## 1. Settings are split (per-device and global)

- **Date:** 2026-10-11 (owner).
- **Decision:** Settings are split in two. *Per-device* settings are layout,
  text size and similar. *Global* settings are audio, difficulty, keybinds and
  similar.
- **Tables changed:** none in this step. `settings.csv` `scope` still derives
  `player` or `tuning` from the source file (`scopeOf` in `tools/build.mjs`).
  The device/global split has no column and no classifier rule yet.
- **Couldn't place:** the rule that maps each settings row to device or global.
  It needs a classifier rule before it can be a column.
