# dist — the build, as a player gets it

**On `dev` nothing built is tracked here** (since 2026-09-26): every rebuild
uploaded ~284 MB of new Git LFS objects and exhausted the repository's LFS
budget. `node tools/launch.mjs --build-only` writes the files described below
locally (git ignores them), and CI publishes each commit's light single file as
the `dev-standalone-<commit>` artifact of `.github/workflows/dev-preview.yml`.
`release` and `main` still track their older single-file copies through Git LFS
until the owner promotes this change.

## One tree (docs/EXTERNAL-ASSETS-PLAN.md, step 8e)

`tools/launch.mjs` writes the same tree into `build/` and `dist/`:

```
AshenSpire.html              the game file: ~10 MB of code, no media inside it
AshenSpire-<version>.html    the same file, version-stamped (dist/ only)
asset-base.json              {"base":"./"}: where the packs are, for the loader
packs/                       one index per pack (light, common, and high on
                             release/main), each with its .js twin, and the
                             font sidecar fonts-<digest>.js
objects/<xx>/<sha256>.<ext>  the art, fonts, music and map tiles, named by
                             their bytes
download/AshenSpire.html     the LIGHT SINGLE FILE: everything inline, ~31 MB
```

The root of the repository also carries `AshenSpire.html` as an easy-to-find
alias. It is the **light single file** (the root has no `packs/` beside it), so
it plays on its own.

| | size | needs | good for |
|---|---|---|---|
| `AshenSpire.html` here (and in `build/`) | **~10 MB** + `packs/` and `objects/` beside it (~47 MB light, ~230 MB with high) | a server, or a double-click **while the folder stays together** | the hosted site's page; the folder copy |
| `download/AshenSpire.html` here (and in `build/`, and the root alias) | **~31 MB** | nothing — `file://` | the download: double-click, offline, phones |

- **The game file** carries the sha256 of each pack index it uses (the
  `ASSET_PACKS` pin) and checks every index at boot. Its default tier is
  `light` on dev/test and `high` on release/main (`--full-art`), and Settings →
  Display → Art quality switches it at runtime (*Auto* picks light on a phone).
  A high-default build whose high index is missing falls back to light; with no
  index at all it boots on placeholders, system fonts and the synthesized score,
  and offers Retry. Opened by double-click it reads the indexes and fonts through
  their `.js` twins, and the score stays synthesized (Chrome refuses audio
  routed through Web Audio from a `file:` page).
- **The light single file** carries the light art inline as `data:` URIs, read
  from the fetched light pack (`node tools/fetch-art.mjs --pack light,common`;
  the art repository generates the twins from the high tier). It is the only inline shape
  left: the full-art single file (~255 MB) and the separate mobile file
  (`AshenSpire-mobile.html`) were retired at step 8e (owner answers 2 and 6).

`tools/verify-shipped.mjs` proves the copies are this build: the light single
file and its two copies carry their art and are byte-identical to
`build/download/AshenSpire.html`; `dist/AshenSpire.html` is
`build/AshenSpire.html` and the indexes it pins are in `dist/packs/` at their
pins. `tools/verify-external.mjs` checks every object of a pack-shaped tree;
`tools/external-play.mjs` plays it in a browser, served and by `--file`.

## Rebuild

From the project root:

```
node tools/fetch-art.mjs --pack light,common   # once per art release (all for --full-art): the art is not in this repository
node tools/launch.mjs --build-only     # build/ and dist/ (light art; --full-art for high + light), and the root alias
node tools/bundle.mjs [--light]        # ONLY the pack-shaped game → build/ (packs/ and objects/ beside it)
node tools/bundle.mjs --single-file    # ONLY the light single file → build/download/AshenSpire.html
node tools/verify-shipped.mjs          # the root alias and dist/ ARE those builds; the single file carries art
node tools/verify-external.mjs         # the pinned packs and every object they list are present (build/)
CHROME=… node tools/external-play.mjs [--file]   # it loads, served and by double-click, and nothing 404s
```

`bundle.mjs` does **not** write to `dist/` or the root alias. Only `launch.mjs`
copies, in one refresh, and it removes what an older launcher left there (the
mobile files, `build/web/`, the `music/` and `map-detail/` copies, older
version-stamped HTML). `--out` must be under `build/` or `dist/`, or outside the
checkout; `--external-art`, the flag that used to choose the pack shape, is
still accepted and changes nothing.

Or use the one-click launcher (`run.bat` on Windows, `run.sh` on macOS/Linux),
which rebuilds, then serves the live app on localhost and opens it.

## Keep the folder together

`dist/AshenSpire.html` is not self-contained: moved away from `packs/` and
`objects/` it shows placeholders and says the art could not be loaded. To hand
someone the game as one file, give them `download/AshenSpire.html`. To hand them
the folder, zip `dist/` whole (or use the game's own *Download a folder copy
(zip)* on the Pages site).

## file:// caveat

From `file://` both shapes play the built-in synthesized score; the rendered
tracks and an external music folder (Settings → Audio → Music folder) need the
game served over http — use the launcher or `node tools/serve.mjs`. LAN co-op
needs the launcher too.
