# dist — the standalone build

**On `dev` nothing built is tracked here any more** (since 2026-09-26): every
rebuild uploaded ~284 MB of new Git LFS objects and exhausted the repository's
LFS budget. `node tools/launch.mjs --build-only` writes the files described
below locally (git ignores them), and CI publishes each commit's build as the
`dev-standalone-<commit>` artifact of `.github/workflows/dev-preview.yml`.
`release` and `main` still track their copies through Git LFS until the owner
promotes this change. Wherever it came from, the complete HTML plays offline
without Git or other tools. The rest of this file describes the build shapes; its
"tracked in git" wording is true of `release`/`main`, not of `dev`.

**There are three shapes of this build now, and this directory holds two of
them.** `tools/bundle.mjs` writes the consolidated single file by default, the
mobile single file with `--mobile`, and the de-inlined one with `--external-art`:

| | size | needs | good for |
|---|---|---|---|
| consolidated, full (`AshenSpire.html` here, in `build/`, and the root alias) | **~253 MB** | nothing — `file://` | double-click, offline, the art as painted |
| consolidated, mobile (`AshenSpire-mobile.html` here, in `build/`, and the root alias) | **under 30 MB** (gated) | nothing — `file://` | phones, slow connections, the second download on the site |
| de-inlined (`build/web/`, CI's `preview/`) | **~8 MB** + art beside it | a server | the hosted site's own page |

Over 95% of the full single file is base64 art. The mobile file carries the
SAME files under the SAME `assets/…` keys, read from `assets-mobile/` — a
committed twin tree that `tools/mobile-art.mjs` shrinks from `assets/` (every
image with a side of 384 px or more cut to 5/16 scale, all re-encoded lossy at
quality 35 / alpha 40 — except the full-screen backdrops under `environments/`, `bg/`
and `map/`, which keep 0.4 scale at quality 50 so they do not block on a phone; the
rule is `tools/mobileart-policy.mjs`). It plays identically and looks softer. The
budget is the owner's number — under 30 MB — and it is a refusal, not a
warning: `bundle.mjs --mobile` will not write a file over it, and
`tools/verify-shipped.mjs` fails a committed one. The de-inlined build fetches
art per screen and the browser caches it; the single files are re-read whole
every time. None replaces another — ES modules cannot load from `file://`,
which is why this bundler exists at all, and the de-inlined shape needs http.

All three carry the SAME set of art: one sweep either inlines each file, inlines
its twin, or copies it, and `--mobile` refuses a twin tree that is not file for
file the mirror of `assets/`. `tools/verify-shipped.mjs` proves it for both
single files (the art is inside them); `tools/mobile-art.mjs --check` proves the
twin tree; `tools/verify-external.mjs` and `tools/external-play.mjs` prove the
de-inlined one, on disk and in a browser.

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
- `AshenSpire-mobile.html` — the mobile single file's dist twin, **tracked in
  git** (LFS) for the same reader and the same reason, and on
  `verify-shipped.mjs`'s allowlist by name. The root carries the byte-identical
  alias `AshenSpire-mobile.html`.
- `AshenSpire-<version>.html` and `AshenSpire-mobile-<version>.html` — the
  version-stamped copies the launcher emits (e.g. `AshenSpire-0.7.1.340.html`).
  Build artifacts, git-ignored. One of these was committed at `40c5b21` because
  the ignore rule still read `EldenSpire-*` after the rename; it has been deleted.

## Rebuild

From the project root:

```
node tools/launch.mjs --build-only     # rebuild build/ (light art; --full-art for full + mobile) and refresh root + dist/
node tools/bundle.mjs                  # ONLY the bundler → build/AshenSpire.html; root + dist/ untouched
node tools/bundle.mjs --mobile         # ONLY the mobile bundler → build/AshenSpire-mobile.html
node tools/verify-shipped.mjs          # check root + dist/ ARE those builds, carry art, and the mobile one fits
node tools/mobile-art.mjs              # regenerate assets-mobile/ from assets/ (needs cwebp); --check needs no encoder

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
to rebuild: `.github/workflows/ci.yml` rebuilds from source and fails the run if any of
`AshenSpire.html`, `AshenSpire-mobile.html` or their `dist/` twins is not
byte-identical to that build.

**Removal condition:** all four tracked player-facing aliases (`AshenSpire.html`,
`AshenSpire-mobile.html` and their `dist/` twins) are deleted — not amended — the day a release workflow
attaches the standalone as a release asset and `README.md` links the release
instead of these paths. At that point each git copy is a second copy with a live
alternative, which is the defect this section spends three paragraphs excusing.

## file:// caveat

The standalone runs from `file://` with the built-in generated score. External
music from a folder (Settings → Audio → Music folder) needs the game served over
http — use the launcher or `node tools/serve.mjs`.
