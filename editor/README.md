# AshenSpire Studio

A standalone local editor for the existing AshenSpire project. It has its own
interface and launcher and does not become part of the shipped game. Node 22+
is required. There are no npm dependencies and no API keys.

## Open the editor

On Windows, double-click **Start Studio.cmd** in this folder. It opens a separate
Edge app window when Edge is available, or your browser otherwise. The local
server stays running after the window closes, so reopening is quick.

From a terminal in the repository:

```powershell
node editor/server.mjs
```

Open <http://127.0.0.1:4317>. Use Ctrl+C in that terminal to stop the server.
This is a local web application with a Windows launcher, not a packaged EXE.

To edit another AshenSpire checkout explicitly:

```powershell
./editor/Start-Studio.ps1 -Project D:/repos/AshenSpire -Port 4318
```

The project and branch are shown in the header and footer. By default this
launcher edits the checkout containing the editor. It does not change branches,
commit, push, publish, or merge anything. Keep feature work in a feature branch.

## Everyday workflows

1. **Sprites:** search existing artwork, drop images or use Import sprites,
   inspect dimensions, and play a group of sequential frames. Imports use new
   filenames under `assets/imported/`; no existing artwork is replaced. Assign
   artwork edits a framework asset's `sourcePath`. New asset IDs can then be
   used in an entity's `artId`. This is not an automatic legacy-art migration:
   weapons use `artKey` filename keys, and enemy/outfit conventions still apply.
2. **Tables:** edit CSV cells and object-array JSON tables, add or duplicate
   records, open a full record form, filter records, or edit nested JSON as
   source. Numbers, booleans, arrays, and objects retain their types when an
   existing JSON field supplies its type. New fields require explicit source
   editing. CSV comments are retained at the top; quoting and whitespace are
   normalized to the game compiler's line-oriented format.
3. **Relations:** drag properties into source/target selectors or choose them
   with the keyboard. Add supported property connections and check dangling
   property IDs. Entity links provide artwork and property selectors while
   preserving existing property parameters. Map table columns to check cross-table references, including
   pipe-separated CSV values. Mappings saved in `editor/workspace` are editor
   annotations; they do not invent runtime mechanics.
4. **Scripts:** edit existing source and styles. JavaScript is syntax-checked
   before saving. New workspace scripts are inert until explicitly imported;
   game scripts remain subject to the existing DSL and script-budget contract.
5. **Plugins:** register an existing local HTML tool or import a JSON manifest
   with `name`, `description`, and a project-relative `path`. Enable/disable
   registered tools. This first plugin format hosts local tools; it is not an
   npm installer or an engine-plugin package manager.
6. **Prompts:** click Connect Codex to reuse the local Codex login, or Sign in
   with ChatGPT and complete the official browser flow. Ask for explanations,
   concrete proposals, and content plans. The selected file's draft and sprite
   path can be included explicitly. Save prompt templates in this browser, or
   copy a prepared prompt and open ChatGPT.
7. **Previews:** find the live game, component catalog, card previews, enemy
   poses, defeated poses, and class combat-animation galleries. Open them in
   the editor, at 390px phone width, or in a separate window. Discovery uses
   the selected checkout; unmerged work in other checkouts is not silently
   imported. Launch Studio against that checkout to use its tools.

## Save and validate

**Review changes** (Ctrl+S) shows the previous and proposed file contents.
Save checks syntax, CSV structure, duplicate IDs where a table has an `id`
column, and the file's expected SHA-256. It refuses a stale draft instead of
overwriting another task's work. Generated artifacts are not editable here.
These checks are not a replacement for the game's complete schema validation.

Draft text is recovered from browser local storage on restart. Ctrl+Z and
Ctrl+Shift+Z undo/redo staged changes when focus is outside a text field;
inside a text field, native text undo remains available. Unsaved raw source
may be invalid while typing; saving rejects invalid JSON/CSV/JavaScript.

Every saved source batch keeps original bytes and a manifest under
`editor/.studio/<project-hash>/backups`. Overview → Save history stages a
previous version for review. Restoring refuses to overwrite newer disk
changes and retains newly created files. Backups do not include generated
build output. There is no deletion or publish button.

After saving, go to **Overview**:

- **Compile content** runs the existing content and framework compilers.
- **Build game** runs `node tools/launch.mjs --build-only`.
- **Check game** runs the Node suite, build-version check, and shipped-file check.

Actions report running/passed/failed and real output. They serialize with
editor writes; external tools can still edit this checkout, so use a dedicated
feature checkout. The preview uses saved game content and must be reloaded
after compilation. It does not pretend an unsaved draft is already running.

## Codex integration

Studio uses the documented Codex app-server over stdio. It never reads auth
files, stores passwords, or asks for an API key. If `codex` is not on PATH,
set `STUDIO_CODEX` to its executable path before starting. The Windows launcher
resolves it automatically when available.

The embedded assistant is read-only in this version. It can inspect and
propose changes; use the editor or the Codex app for implementation. Interactive
tool approvals are refused with an explanatory message. ChatGPT itself opens
in its official website, with a copy/paste prompt handoff. Existing account
limits apply. OAuth credential entry remains in the official browser flow.

Sources checked September 8, 2026:

- [Codex app-server and account login](https://learn.chatgpt.com/docs/app-server)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)

## Local boundaries

The server listens only on 127.0.0.1. The editor uses the 127.0.0.1 origin;
preview HTML uses the separate localhost origin and cannot access editor APIs.
File actions require a per-process token, exact host and origin checks, an
editable source allowlist, and paths without traversal or symlinks. Imported
images have checked signatures and size limits. Do not expose this development
server through a network proxy. Local tools may execute their own browser code.

## Testing

```powershell
node --test editor/tests/*.test.mjs
```

The tests use disposable workspaces and cover CSV round trips, allowed source
paths, traversal and symlink refusal, backups, expected-hash conflicts,
batch preflight, concurrent writes, HTTP isolation, JS syntax, and image imports.
The editor does not alter the game's component IDs or renderers, so the existing
component catalog is integrated as a preview without changing those components.

## Next features, in order of usefulness

1. **Entity wizard and dependency inspector:** create an enemy, card, item, or
   quest from a template, show all required records, and jump to every use.
2. **Sprite timeline:** frame trimming, anchor/ground-line overlays, mirrored
   facing checks, animation events, onion skinning, and sprite-sheet slicing.
3. **World and encounter canvas:** drag rooms, routes, spawn points, and enemy
   groups; preview seeded encounters. This should follow the approved world
   spec instead of inventing a second world model.
4. **Visual behavior builder:** compose the existing opcode/trigger DSL with
   blocks, explain each condition in plain language, and expose resulting code.
5. **Balance workbench:** bulk edits with a change summary, CSV paste/import,
   simulations, distributions, loot odds, and comparison against the last build.
6. **Quest/dialogue graph:** branching conversations, flags, rewards, and
   unreachable-path checks tied to the actual content model.
7. **Asset provenance and budgets:** credit/license fields, unused-asset reports,
   texture dimensions, compression, and before/after game-size measurements.
8. **Build comparison:** desktop/phone screenshots, saved playtest scenarios,
   visual diffs, error links, and a one-click path from a finding to its source.
9. **Deeper tool adapters:** explicit adapters for Blender, Aseprite, audio tools,
   and the existing sprite pipeline, followed by signed plugin packages and a
   packaged desktop installer. Add each only where it simplifies a real workflow.
10. **Reviewable AI edits:** structured proposals tied to selected entities,
    streamed progress, approval UI, and per-change accept/reject before applying.

This version does not yet include a scene canvas, node-based scripting,
sprite-sheet slicing, engine plugin installation, or an embedded ChatGPT client.
