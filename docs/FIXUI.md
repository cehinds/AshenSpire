# chore/fixUI — working notes

Branch for hand-made UI fixes in Visual Studio 2026. Cut from `dev` on 2026-11-15
(`f37a5c3c36`, build 0.7.4.89).

## What to fix

Write each fix here as you go, one line each. Tick it when it works in the browser.

- [ ] _(first fix goes here)_

## Open it in Visual Studio 2026

1. **File → Open → Folder** → this repository folder.
   - No solution file is needed.
2. Needs the **Node.js development** workload and Node 22.14 or newer.
3. Right-click the root `package.json` in Solution Explorer for the **AshenSpire** tasks.
   - If you see false red JavaScript errors, turn off the native TypeScript preview
     (**Tools → Options → Preview Features**).

## The edit loop

1. Run **AshenSpire: Dev server (live reload)**.
   - The game opens in your browser and reloads each time you save.
2. Edit a file from the table below and save.
3. Check the result in the browser (F12 for the browser's dev tools).
4. Before committing, run **AshenSpire: UI: Check screens and components** and
   **AshenSpire: Fast core tests**.

## Where UI lives

| I want to change… | Edit | Then run (task) |
|---|---|---|
| A screen's code | `src/ui/screens/` | Dev server reloads it |
| A screen's layout data | `content/config/ui/screens/` | UI: Check screens and components |
| A component | `src/ui/components/`, `content/config/ui/components/` | UI: Check screens and components |
| Styles and colours | `styles/` (colours in `styles/base.css` `:root`) | UI: Lint styles |
| Font sizes, layers, motion | `content/config/ui/tokens.json` | UI: Rebuild style tokens CSS |
| HUD placement | `content/hud-layout/` | UI: Rebuild HUD layout CSS |
| On-screen text | `content/source/uiStrings.csv` | Compile authored content |
| Named icons | see [MANUAL-EDITING.md](MANUAL-EDITING.md) | Check named icon vocabulary |

More rows: [CODE-MAP.md](CODE-MAP.md#i-want-to--go-to--then-run).

## Do not edit by hand

- `src/config/generated/`, `src/content/generated/`, `styles/*.generated.css`, `engine/ui/index.json`.
  - These are rebuilt by the tasks above; edit their source instead.
- Never commit built HTML (`AshenSpire.html`, `dist/*.html`, `build/*.html`).

## Saving your work

```bash
git add -A
```

```bash
git commit -m "fix(ui): <what you changed>"
```

```bash
git push
```

## When it is ready for a pull request

1. Run **AshenSpire: PR: Fast checks (run before a pull request)**.
2. Ask Claude to run sandbox QA and open the PR into `dev`
   ([CONTRIBUTING.md](../CONTRIBUTING.md#a-pull-request-is-not-done-until-it-is-merged-and-promoted)).
