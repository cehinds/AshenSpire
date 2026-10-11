# Workbench modules

A **module** is a native part of the Workbench page: it renders into the page
instead of an iframe, and the host gives it undo, shortcuts, preferences and
the game preview. The list is `workbench/modules/index.mjs` (`MODULES`); the
rail shows the Studios group from it, and Home shows a card for each.

Each module is a folder `workbench/modules/<id>/index.mjs` that default-exports:

```js
export default {
  mount(el, ctx) {
    // Render into el. Return the instance.
    return {
      unmount() {},          // optional; the host does not call it yet
      onShow() {},           // optional: the module became the visible view
      onHide() {},           // optional: another view took over
      commands: () => [      // optional: entries for Ctrl+K, under the module's label
        { title: 'Duplicate row', sub: 'Ctrl+D', run: () => {} },
      ],
    };
  },
};
```

`mount` runs once, the first time the module is shown. The instance is kept
while the user visits other views, as the iframe studios are.

## Registering a module

1. Create `workbench/modules/<id>/index.mjs`.
2. Add an entry to `MODULES` in `workbench/modules/index.mjs`:
   `{ id, label, icon, group: 'Studios' | 'Project', blurb, load: () => import('./<id>/index.mjs') }`.
   `icon` is a name from `workbench/ui/icons.mjs`.
3. `workbench/tests/modules.test.mjs` checks that every id loads and exports `mount`.

Until the real work lands, a module can be `placeholderModule({ label, will, replaces })`
from `workbench/modules/placeholder.mjs`.

## The context (`ctx`)

| Member | What it does |
|---|---|
| `id` | The module id. |
| `api(path, body?)` | The Workbench's JSON API (`GET` without a body, `POST` with one). A non-OK reply throws an `Error` whose message is the body's `error` (or `HTTP <status>`), with `err.status` (the HTTP status) and `err.body` (the parsed JSON body, or `null`). A 409 carries `body.conflicts`; a 422 carries `body.problems`. |
| `apiBlob(path)` | The same API as a `Blob` (for example a PNG), with the session token. Use `URL.createObjectURL` to show it; a non-OK reply throws as `api` does. |
| `toast({ kind, title, detail, actions, timeout, record })` | A toast; errors stay until dismissed. |
| `history` | This module's `History` (`workbench/ui/kit/history.mjs`): `push({label, undo, redo, before?, after?})`, `pushChange({label, undo: snapshot, redo: snapshot}, apply)` for snapshot changes such as the grid model's, `undo()`, `redo()`, `canUndo`, `canRedo`, `list()`, `clear()`, `group(label, fn)`, `onChange(fn)`. The header's Undo and Redo buttons and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y use it while the module is showing. Call `push` after the change has been applied. |
| `shortcuts.register(combo, label, handler, { inInput })` | A shortcut in this module's scope (combos like `'Mod+D'`, `'Alt+1'`, `'?'`; `Mod` is Ctrl or ⌘). It fires only while the module shows. A handler that returns `false` passes the key on. Users can remap it in Settings → Shortcuts. |
| `preview.reload()` | Reloads the game preview. |
| `preview.showUrl(url)` | Shows `url` in the preview dock instead of the game (`null` goes back). |
| `preview.setOverride(key, value)` | Adds `?wb.<key>=<value>` to the preview URL (`null` removes it). |
| `settings.get(name, fallback)`, `settings.set(name, value)`, `settings.all()` | Per-module preferences, stored in localStorage under `wb.mod.<id>`. They are per browser and may be lost; keep state that matters in the project. |
| `openModule(id, params?)` | Opens another module, optionally with params. |
| `params` | The deep-link params of the current visit (read in `onShow`). |

## Deep links

`#mod=<id>&<name>=<value>…` opens a module with those params, e.g.
`#mod=data&table=cards`. The Workbench writes the hash when a module is opened
and removes it when another view is shown.

## Shortcut scopes

Scope `global` is the Workbench (Ctrl+K, Ctrl+\, Ctrl+R, Ctrl+1…9 and Ctrl+0
for the rail, Ctrl+, Settings, `?`, Ctrl+Z / Ctrl+Y). A module's own actions
are scoped to its id and take precedence while it shows. Remaps are stored in
localStorage `wb.shortcuts`; a remap is refused when the combo is already used
in the same scope or globally.

## Rules

- A module does not touch other modules' DOM, and the engine stays headless:
  modules read and write content through the API, not by reaching into `src/`.
- Modules are plain ES modules, with no npm packages and no build step.
- Do not import from `workbench/app.mjs`; everything a module needs is in `ctx`.
