# dist — the standalone build

`AshenSpire.html` is the whole game compiled into **one self-contained HTML
file** (all JS inlined as a classic script, all CSS inlined, all art inlined as
`data:` URIs — no server, no Node, no network). Double-click it to play.

The repository root also carries `AshenSpire.html` as a byte-identical,
easy-to-find current-build alias. `tools/launch.mjs` refreshes both paths in one
operation and `tools/verify-shipped.mjs` verifies both against `build/`.

- `AshenSpire.html` — the canonical dist twin of the root current-build alias,
  **tracked in git** for a player who has no Node and no toolchain. It is a build
  output living in source control, which is a second copy of the source, and it
  is kept only for that reason. See *Why this is tracked, and when it stops
  being* below.
- `AshenSpire-<version>.html` — a version-stamped copy the launcher emits
  (e.g. `AshenSpire-0.2.0-ashen.html`). A build artifact, git-ignored. One of
  these was committed at `40c5b21` because the ignore rule still read
  `EldenSpire-*` after the rename; it has been deleted.

## Rebuild

From the project root:

```
node tools/launch.mjs --build-only     # rebuild build/ and refresh root + dist/
node tools/bundle.mjs                  # ONLY the bundler → build/; root + dist/ untouched
node tools/verify-shipped.mjs          # check root + dist/ ARE that build, and carry art
```

Note the second line, because this file used to get it wrong ("or just the
bundler → build/ + copy"): `bundle.mjs` does **not** write to either
player-facing alias. Only `launch.mjs` copies. That gap is how `dist/` stayed
stale for months while `build/` was correct; the root alias now shares the same
single refresh door.

Or use the one-click launcher (`run.bat` on Windows, `run.sh` on macOS/Linux),
which rebuilds the root and `dist/` aliases, then serves the live app on
localhost and opens it.

## Why this is tracked, and when it stops being

A shipped artifact belongs to a *release*, not to a branch. The right home for a
double-clickable HTML is a release asset built at a tag. This repo has no release
workflow yet, so deleting the tracked copies today would leave the README's
root current-build link pointing at nothing — a broken promise to the one
reader who cannot rebuild.

So it stays, and CI proves it honest instead of trusting that someone remembered
to rebuild: `.github/workflows/ci.yml` rebuilds from source and fails the run if
either `AshenSpire.html` or `dist/AshenSpire.html` is not byte-identical to that
build.

**Removal condition:** both tracked player-facing aliases (`AshenSpire.html` and
`dist/AshenSpire.html`) are deleted — not amended — the day a release workflow
attaches the standalone as a release asset and `README.md` links the release
instead of these paths. At that point each git copy is a second copy with a live
alternative, which is the defect this section spends three paragraphs excusing.

## file:// caveat

The standalone runs from `file://` with the built-in generated score. External
music from a folder (Settings → Audio → Music folder) needs the game served over
http — use the launcher or `node tools/serve.mjs`.
