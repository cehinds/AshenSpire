# dist — the standalone build

**There are two shapes of this build now, and this directory holds one of them.**
`tools/bundle.mjs` writes the consolidated single file by default and the
de-inlined one with `--external-art`:

| | size | needs | good for |
|---|---|---|---|
| consolidated (this directory, `build/`, the root alias) | **57.6 MB** | nothing — `file://` | double-click, offline, no toolchain |
| de-inlined (`build/web/`, CI's `preview/`) | **4.9 MB** + art beside it | a server | phones, the hosted site |

91.6% of the single file is 1,929 base64 art URIs, which is the whole 12x
difference. The de-inlined build fetches art per screen and the browser caches
it, so a second visit re-downloads none of it; the single file is re-read whole
every time. Neither replaces the other — ES modules cannot load from `file://`,
which is why this bundler exists at all, and the de-inlined shape needs http.

Both carry the SAME art: one sweep of `assets/` either inlines each file or
copies it, so a file good enough to inline is good enough to serve and a file it
skips is absent from both. `tools/verify-shipped.mjs` proves it for the single
file (the art is inside it); `tools/verify-external.mjs` and
`tools/external-play.mjs` prove it for the other, on disk and in a browser.

`AshenSpire.html` here is the whole game compiled into **one self-contained HTML
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

node tools/bundle.mjs --external-art --out build/web   # the de-inlined build
node tools/verify-external.mjs                         # its art is present and byte-identical
CHROME=… node tools/external-play.mjs                  # it actually loads, and nothing 404s
```

`--external-art` writes `AshenSpire.html`, `assets/` and `map-detail/` into the
output directory in one pass. The map tiles matter: `src/ui/components/
mapDetail.js` says detail files are never bundled into the single HTML and that
"hosted builds carry a sibling map-detail directory" — the de-inlined build is a
hosted build, so it carries them. `build/web/` is git-ignored; CI rebuilds it.

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
