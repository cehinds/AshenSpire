# Workbench consolidation: tool inventory, grouping and game plan

Branch: `Chore/ImproveTooling`. Owner priorities: ease of use and a clean desktop UI
first, deep customization, and the better implementation wins wherever two tools overlap.

## 1. Every tool, grouped into 8 Workbench modules

Source: feature audits of dev on 2026-10-11, `origin/main` (`art/`, now in
`cehinds/AshenSpire-art`) and `feature/TagRefactor`. UX scores are out of 5.
"Base" is the implementation the module is built on; "Take" lists features
ported from the other tools.

### A. Layout Studio (canvas editing of layouts)
| Tool today | UX | Output | Fate |
|---|---|---|---|
| `ui-studio/` | 4 | Writes `content/config/ui/*.json` (validated, hash-checked, backups) | **Base** |
| Combat Studio `docs/design/combat-depth-2026-10-05/editor/battlefield-wireframe-editor.html` | 4 | Download `ashenspire-combat-layouts.json` | Mode "Battlefield" |
| `editor-legacy.html` (same folder) | 3 | Download wireframe JSON | Retired; its features are ported |
| `docs/design/deck-row-editor/` | 4 | Download `ashenspire-deck-row-layout.json` | Mode "Deck row" |
| SP Atelier `docs/design/sp-orb-editor/` | 3 | Download JSON + PNG | Mode "SP orb" |
| Book Atelier `docs/preview/book-library/layers/atelier.html` | 3 | Downloads 2 files (`bookArtPresets.js` + JSON) | Mode "Book recipes" (form) |

- **Keep from the base (UI Studio):**
  - `snapRect`: edge-aware snapping with grid, viewport, safe-area and other-box targets.
  - `History`: undo/redo that skips no-op steps.
  - Align, the editable device table, rotate, per-breakpoint overrides, Compare mode.
  - Typing-safe shortcuts and saving back to the repo.
- **Take from the legacy editor:**
  - Distribute, group/ungroup, lock and marquee selection.
  - Space-drag to pan, Ctrl+wheel to zoom, and the `?` help dialog.
- **Take from Combat Studio:**
  - Layers panel: drag to reorder, context menu, drill into a combatant's parts.
  - Strict validation of loaded files, plus upgrade of old-format files (`validateDocument`/`migrateLegacy`).
  - Parallax/effect preview.
- **Take from the others:**
  - Deck row: validated import and the clipboard fallback.
  - SP Atelier: PNG export.
  - Book Atelier: generating a ready-to-use source file.
- **Fixes:** every mode saves to the repo through the shared save path (no more double download), and gets undo, zoom and keyboard support.

### B. Data Studio (tables, relations, tags)
| Tool today | UX | Output | Fate |
|---|---|---|---|
| `editor/` Content Editor (tables, relations, sprites, scripts, Codex) | 3 | Writes repo (atomic, hash, backups, diff) | **Base for saving and safety** |
| Tag Workbench `docs/tag-model/workbench.html` (on `feature/TagRefactor`) | 4 | CSV/JSON download | Grid, validation, Check tab, object sheet |
| `tools/world-atlas-data.mjs` (CLI) | 3 | Writes repo; CSV/JSON/sqlite | Server-side validator and import/export formats |

- **Take from the Tag Workbench:**
  - Toolbar to add a column, add or delete a row, and page through rows.
  - Per-cell reference checks, plus a Check tab that jumps to each problem.
  - Expression language with live results.
  - Object sheet with rank progression.
  - CSV import that merges by key.
- **Take from the Content Editor:**
  - Typed parsing of numbers and booleans.
  - Hash-checked atomic save, backups, review diff (upgraded to line-level) and undo.
  - Drag-and-drop relation builder.
- **Take from `world-atlas-data`:** SQLite foreign-key validation as the server-side authority, and JSON/CSV/sqlite import and export.
- **Take from the component catalog:** sort, density, URL state and `/` to search.
- **New:** multi-select, range paste, bulk edit, a virtualised grid and frozen columns.

### C. Motion Studio (poses, effects, sequences)
| Tool today | UX | Output | Fate |
|---|---|---|---|
| `pose-studio/` | 4 | Download `.pose.json`; game override in browser storage | **Base** |
| `pose-studio/renewal/` (card-action atelier) | 3.5 | Rig download | "Preview" sub-mode |
| `pose-studio/stances/` | 3 | Project downloads | "Stances" sub-mode |
| `pose-studio/stances/options-20261008/` | 3.5 | Picks to clipboard | Asset Gallery "Pick" board (frozen) |
| Prologue studio `art/prologue-2026-09-19/` (art repo) | 4 | Validated JSON + WebP downloads | "Sequence" mode, loaded from the art checkout |

- **Keep from the base (Pose Studio):**
  - Timeline with scrub, play, loop and speed.
  - Stage zoom and pan, exact drop placement.
  - Undo, reduced motion and reduced flashes.
  - Binding rules (the Connect tab).
- **Take from the others:**
  - painted-combat: step one frame at a time.
  - Prologue studio: validated import, and scene and copy editing.
- **New:**
  - Save to the repo instead of download-only.
  - Onion skin and per-frame keyframes.
  - Undo in Sequence mode.

### D. Entity Browser (game objects drawn by the real game renderer)
| Tool today | UX | Fate |
|---|---|---|
| `weapon-cards-preview.html` | 4 | Search over tags and types, URL state (best filter) |
| `items-preview.html` | 4 | Master/detail layout (best detail card) |
| `item-cards-preview.html` | 2 | "Class wearing it" stage with pose picker |
| `armament-kits-preview.html` | 4 | Loadout compare + "Try in fight" |
| `tooltip-review.html` catalog scene | 3 | All 8 categories plus the hover-timing lab |
| `docs/component-catalog.html` | 4 | **Shell**: search, 5 sorts, density, grid/list, URL, drawer |

One browser across Armaments, Armor, Potions, Relics, Cards, Statuses, Stances, Keywords, Enemies and Classes. Each entity has a detail drawer with tabs (Card, Inventory, Worn by class, Tooltip, Data, Try in fight) and an **Edit** button that opens that row in Data Studio.

### E. Asset Gallery (one gallery fed by the art manifests)
Replaces 13 frozen review pages, which become saved views of one gallery:
- low-poly-fighters, board-fidelity, class-armor-rear
- player-polish, player-polish-asset-kit, player-components
- the three combat-depth pages
- in the art repo: sprite-catalog, integrated-tag-mappings, webp-pack desk, painted-combat
- stance-options

Data comes from `art-manifest.json`, `asset-data/*.json` and the art checkout.

| Feature | Taken from |
|---|---|
| Grid with search, facets and detail dialog | combat-depth `preview.js` |
| Lightbox with arrow keys | player-polish |
| Light/checker/dark backdrop to check transparency | class-armor-rear |
| Frame-strip player with step and speed | painted-combat |
| Layered scene with device and depth toggles | combat-depth `continuation/review.js` |
| Picks saved and copied | stance-options |
| Tag → effect sprite rules view | Pose Studio bindings (live, not a snapshot) |

### F. Visual Review (screenshots and QA)
- **Replaces 8 hand-written galleries:** `docs/preview/{responsive-type, combat-formation, combat-ground, hud-followup, concise-card-tooltips, starting-equipment, world-atlas}` and `docs/qa/mobile-combat-20261009/hud-comparison.html`.
- **One manifest file:** capture tools write `review.json` through `tools/lib/review-manifest.mjs`. Its row shape follows `release-shots.mjs` and its integrity hashes follow `hybrid-input-parity.mjs`.
- **One viewer with:**
  - side-by-side (taken from responsive-type), a slider and onion opacity
  - a state toggle (taken from hud-comparison)
  - device and state chips
  - a lightbox
  - approve or reject per image, exported as `verdicts.json`
  - provenance and boundary notes (taken from world-atlas)
  - a zip download

### G. Scenes & Fixtures (launch whole live screens)
These stay as they are and are launched from the Library, in the preview pane at any device size:
- world-atlas-preview, deck-reading-desk, equipment-selection, the tooltip-review scenes
- the live QA fixtures: card-layers, card-rank-layers, card-solid-bb, class-mastery, intent-hit, starter-card-art, book-library, merchant
- tray-gallery and the wireframe gallery

The card-layers explorer (UX 5) is promoted to a Layout Studio mode.

### H. Build & Export (already built)
- Jobs: compile content, compile UI config, build the game, run tool tests, with live logs and history.
- **Engine export** (`tools/engine-export.mjs`): 152 tables and 16,779 rows as JSON, with JSON schemas and a manifest, plus importers for Unity and Unreal.

**Not merged:**
- `tools/palette-probe.html` is a CI test instrument and stays a test.
- `cehinds/AshenedSpire-Editor` is linked as an external tool (owner decision).

## 2. Shared platform (built once, used by every module)
- **Saving:** one save path. It checks that the file hasn't changed on disk, writes atomically, keeps backups, shows a line-level diff to review, and validates first. Drafts autosave, and a restore point is kept per file.
- **Undo:** one `History` (UI Studio's) shared by every editor, with an undo history panel and a step for each gesture.
- **Canvas kit:** snapping and guides, align and distribute, group, marquee, zoom and pan, rulers, nudge.
- **Shortcuts:**
  - The same keys mean the same thing in every module.
  - Shortcuts can be remapped in Settings.
  - `?` lists all of them, and Ctrl+K searches everything.
- **Live preview:**
  - Saving in any module reloads the game pane.
  - The pane can show **unsaved** drafts, by injecting a draft override so the game is never mutated.
- **Deep customization** (Settings):
  - Theme (accent, light or dark), density, font size.
  - Panel layout: dock or float, saved workspaces.
  - Default device, snap threshold and grid size.
  - Autosave interval and backup retention.
  - Shortcut map, plus per-module defaults.
  - Import or export all settings as JSON.
- **Cross-links:**
  - "Edit" from any viewer opens the owning editor at that row or object.
  - "Show in game" opens the preview pane at the matching `?shot=`.

## 3. Game plan (all on `Chore/ImproveTooling`)
| Phase | Delivers | Retires |
|---|---|---|
| 0 (in progress) | Workbench shell, Library registry of all ~50 tools, live reload, command palette, engine export, Build & Checks, CI workflow with screenshots | — |
| 1 | Shared platform: save service, History, canvas kit, shortcuts/remap, Settings and customization, draft-injecting preview | Duplicate server code in editor/ and ui-studio/ |
| 2 | Entity Browser, Asset Gallery, Visual Review (read-only, low risk) | 5 entity previews, 13 frozen galleries, 8 screenshot pages |
| 3 | Layout Studio with all 6 modes | Combat Studio, legacy editor, deck-row, SP Atelier, Book Atelier |
| 4 | Data Studio | Content Editor tables and relations, Tag Workbench (once TagRefactor merges), world-atlas CLI UI |
| 5 | Motion Studio | renewal, stances, prologue studio (art checkout) |
| 6 | Cleanup: old URLs become one-line redirects to Workbench deep links; README/DEVELOPER updated; screenshots | Old pages |

Each phase:
- ships with screenshots in `docs/workbench/screenshots/`
- has tests run in CI (`workbench.yml`)
- passes a review agent before merge
- keeps every old tool reachable until its replacement has every feature listed above
