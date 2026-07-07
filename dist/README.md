# dist — standalone builds

`EldenSpire.html` is the whole game compiled into **one self-contained HTML
file** (all JS inlined as a classic script, all CSS inlined — no server, no
Node, no network). Double-click it to play.

- `EldenSpire.html` — the current standalone build (tracked in git).
- `EldenSpire-<version>.html` — a version-stamped copy produced by the launcher
  (e.g. `EldenSpire-0.1.0-m1.html`). These are build artifacts and are git-ignored.

## Rebuild

From the project root:

```
node tools/launch.mjs --build-only     # refresh dist/ only
node tools/bundle.mjs                   # or just the bundler → build/ + copy
```

Or use the one-click launcher (`run.bat` on Windows, `run.sh` on macOS/Linux),
which rebuilds `dist/`, then serves the live app on localhost and opens it.

## file:// caveat

The standalone runs from `file://` with the built-in generated score. External
music from a folder (Settings → Audio → Music folder) needs the game served over
http — use the launcher or `node tools/serve.mjs`.
