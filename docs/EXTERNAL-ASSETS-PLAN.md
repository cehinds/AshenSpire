# Every asset outside the game file — plan

Status: **steps 2, 3a, 3b, 3c, 6a and 8c built** (2026-10-01: `tools/asset-pack.mjs`,
`art-manifest.json` schema 2; 2026-10-02: the loader `src/ui/assetPacks.js`,
`setBuiltInSource`, the `ASSET_PACKS` stamp and the tier fallback, with
`bundle.mjs --external-art` writing packs and `verify-external` rewritten; see
[Step 3a as built](#step-3a-as-built); the `ASSET_CSS` template for the fonts
and backdrops, the masks inline, see [Step 3b as built](#step-3b-as-built);
the map tiles and the shipped score through the common index, see
[Step 3c as built](#step-3c-as-built); the Pages base tree without `art/`, the
`og:image` Pages path and the site size in `pages-site --check`, see section 4;
Settings → Art quality Auto / Light / High, see
[Step 8c as built](#step-8c-as-built)); **step 8d built** (2026-10-02:
`buildPageUrl`/`serveDir` in `tools/browser.mjs`, and the 30 tools that opened
a built page by `file://` ask it); **step 6b built** (2026-10-02: the Pages
store, `asset-base.json` for every page kind, `/AshenSpire/sw.js` with
Range/206 and a kill-switch, "Make available offline", and the light single
file at `download/` for every kept build; see
[Step 6b as built](#step-6b-as-built)); **step 4 built** (2026-10-02: the web
edition plays by double-click: the indexes through their `.js` twins, the
faces through the font sidecar, tiles from the objects under `file://`, the
score synthesized, and `external-play --file`; see
[Step 4 as built](#step-4-as-built)); **step 5 built** (2026-10-02: the
startup gate drawn at once with its "Loading art" line and the critical set
from `content/config`, the title's notice with Retry and Settings' Retry,
`external-play --block-index`; see [Step 5 as built](#step-5-as-built));
**step 7 built** (2026-10-02: the in-game folder copy, a zip the game
assembles beside the light single-file download, and `offline-play-qa --zip`;
see [Step 7 as built](#step-7-as-built));
**step 11 built** (2026-10-02: `art-release.json` schema 2 pins `hd-assets-v2`'s three zips,
`fetch-art --pack` and `--agree`, `asset-pack --source cache`, the pin and
manifest in `BUILD_IDENTITY_FILES`, and a fetch in every building workflow;
the art repository is public since step 10a);
 the rest is plan (2026-09-27). The owner answered its
questions the same day; see [Owner answers (2026-09-27)](#owner-answers-2026-09-27).
It follows
[ART-REPO-PLAN.md](./ART-REPO-PLAN.md): it adds rows to that plan and
**replaces** some of its lines, which are listed under
[Supersedes](#supersedes). ART-REPO-PLAN is edited in the same PR, so the two
documents agree.

## The owner decision this plan follows

> "all assets shouldn't be bundled but should be like the art" (owner,
> 2026-09-27). Asked to clarify, the owner chose **both**:

- **(a) Storage.** Fonts, audio and every other asset are stored in
  `cehinds/AshenSpire-art` next to the art. The build fetches them from the
  pinned release, as ART-REPO-PLAN already does for the high-res art.
- **(b) Runtime.** The game file no longer inlines assets. It loads them at
  runtime, as the optional high-res art pack already is.

This replaces the earlier open question of whether to bundle the Cinzel/Inter
interface fonts (SPEC §7.5, CREDITS.md line 119). They become pack files like
everything else.

## Supersedes

These lines no longer hold once this plan lands. Each one changes in the step
named.

- **ART-REPO-PLAN, *This repository keeps*.**
  - `assets-mobile/` (the light tier) moves to the art repo and is generated
    there (steps 9–13).
  - `map-detail/` and `music/` move to the art repo's `common` pack.
  - The fonts leave `assets/fonts/`.
- **ART-REPO-PLAN, *How an art change flows*, step 3.** The light tier is no
  longer regenerated here from the fetched cache: the art repo generates it
  and a PR here bumps the pin (step 9).
- **ART-REPO-PLAN, first table, these rows:**
  - `styles/kit.css` ("unchanged: fonts have twins") → fonts are one `common`
    record each and load through `ASSET_CSS` (step 3b);
  - `tools/serve.mjs` ("maps `/assets/…` to `assets-mobile/`") → it maps ids to
    the fetch cache's light and common packs (step 12);
  - `tools/mobile-art.mjs --check` and the regenerate row → both move to the
    art repo's CI (steps 9 and 11).
- **ART-REPO-PLAN step 6** (the delete) is folded into step 13 here. It still
  needs **its own owner go-ahead** (ART-REPO-PLAN, Q3: steps 5–7 each need one).
- **FINISH.md D5** (owner, 2026-09-26): *"Pages with external art and a service
  worker, installable; **the 254 MB file stays a download**."* This plan keeps
  D5's first half: the Pages web edition, the service worker, installable. It
  retires the 254 MB file at step 8e (owner answer 6, FINISH D24). FINISH §4's
  line 107 (*"the single-file download stays available"*) still holds, for the
  **light** single file the owner kept (answer 3, D24).
- **ART-REPO-PLAN Q1 ("Private") and its *Owner answer (2026-09-27)*, and
  FINISH.md D20** ("the high-res zip stays private"): `cehinds/AshenSpire-art`
  becomes **public**, the high-res zip included (owner answer 1, FINISH D22).
  No token is needed to fetch a release once it is public. The owner made it
  public on 2026-10-02 (step 10a, done before step 11 landed). The
  `ART_REPO_TOKEN` path in `fetch-art` is a belt-and-braces fallback, not a
  substitute for the flip.

## Summary

- One HTML file per build, about 9.5 MB of code and no media. The art, fonts,
  music and map tiles are loaded from **content-addressed files** (named by
  their sha256) that the HTML's **pack index** lists. The index is hash-pinned
  inside the HTML.
- `tools/bundle.mjs --external-art` already builds this shape without the pinning
  (`build/web/`, dev-preview's `preview/`). The plan makes it the game's
  shape, adds the index and hashes, and retires two of the three single files
  (the full-art and the mobile one). **One light single file stays** as a
  self-contained download (owner answer 3).
- The art repository's release grows from one zip to three: `high` (today's
  `hd-assets-v<N>.zip`), `light` and `common`. The existing `art-release.json` and
  `tools/fetch-art.mjs` pin and fetch all three. No second system is added.
- On Pages, every build shares one object store, so a file is stored once
  however many builds use it. Media leaves main's base tree.
- Offline, there are three paths: the **light single file** (about 30 MB,
  plays by double-click, owner answer 3), a **service worker** install
  (phones and desktop), and a **zip the game assembles itself** (desktop). The
  separate mobile file is dropped (answer 2): one HTML picks the light or high
  tier at runtime, and falls back to light whenever high is not there.
- Assets that fail to load fall back to what already exists: placeholders
  (SPEC §2.4), the synth score, the offline map and system fonts. The game
  never stops because a file is missing.

---

## 1. Inventory — what the build inlines today

Measured on `dev` at `33c57292f` (ordinal 668) by building every edition into
a scratch directory. `art-manifest.json` gives the counts per id and tier.

### What goes into the single file

| class | files | light tier (`assets-mobile/`) | high tier (`assets/`) | how it enters the HTML |
|---|---|---|---|---|
| images, WebP | 5,180 | 14,324,450 B | 184,700,880 B | `ASSET_MAP` data URIs (`tools/bundle.mjs:376-461`, the URI at `:439`), with byte-identical images aliased to one entry |
| images, SVG | 6 | 4,863 B | 4,863 B | the same map; two of them are also CSS masks |
| fonts, WOFF2 (8 "AS Lore" families, 15 faces) | 15 | 400,484 B | 400,484 B | **CSS only**: the `@font-face` `url()`s in `styles/kit.css:4078-4092`, inlined by `inlineCssUrls` (`bundle.mjs:671-727`). The map skips them on purpose (`bundle.mjs:423-430`). |
| of those, CSS `url()` targets: 15 fonts, **9** backdrops, 2 SVG masks | **29** `url()` occurrences in `styles/`: 15 fonts + 10 backdrop uses + 4 mask uses | 464 KiB raw | 1,521 KiB raw | base64 in the inlined `<style>` (`kit.css:2062`, `4534-4602`; `combat.css`, `ui.css`). The 9 backdrops are `bg_act1`–`3`, `title-city-tower`, `river-citadel-unlit`/`-lit`, `tower-city-background-unlit`, `tower-entrance-hall`, `tower-entrance-hall-phone`; the masks are `tower-door-mask.svg` and `-phone.svg`. |
| **total, art manifest** | **5,201** | **14,729,797 B** | **185,106,227 B** | 5,186 map entries + the CSS url()s |

`tools/assetmime.mjs:13-18` decides what ships: `.webp .png .jpg .jpeg .gif
.svg .ogg .mp3 .wav .m4a .woff2`. `runtimeAsset()` (`:27-29`) excludes the
authoring-only `equipment/components/` strips (39 files, 41 in the
directory).

### What the build already carries beside the HTML (never inlined)

| class | files | bytes | today |
|---|---|---|---|
| music, MP3 | 13 of the 31 files in `music/` | 20,274,812 | fetched from `music/` beside a page served over http(s) (`src/content/music.js:29` `SHIPPED_MUSIC_FOLDER`, `src/ui/audio.js:599`, `:634`). A `file://` page keeps the synth. `bundle.mjs:1087-1091` copies the **whole** folder: 31 files, i.e. the 13 tracks, `manifest.json` and 17 authoring files (score sources and READMEs). The 18 non-MP3 files come to 62 KB. |
| map detail tiles, WebP | 116 | 11,475,906 | fetched with `fetch` → blob from `map-detail/` beside the page (`src/ui/components/mapDetail.js:15-18`, `:45-48`). Under `file://` the map shows its low-detail fallback. |
| SFX | 0 | — | synthesized (`src/content/sfx.js` `SFX_RECIPES`); `SFX_MANIFEST` ships empty |

### What stays in the HTML

These stay inline because they are markup or code, or too small to be worth a
request:

- the favicon (a 300-byte inline SVG, `index.html:15`), which works under
  `file://`;
- the **two SVG masks** (4.8 KB together, see section 3), which stay as `data:`
  URIs inside `ASSET_CSS`;
- the inline SVG glyph markup in about 11 `src/` files, which is code.

`asset-data/` (JSON manifests, the class-art notes, `framework/silence.txt`)
holds build-time data, not player media, and stays in this repository.
`asset-data/fonts/OFL.txt` is also packed into `common` (section 2).

### The size of each edition today

| edition | built by | file | size |
|---|---|---|---|
| light single file (dev/test default) | `launch.mjs` → `bundle.mjs --light` | `AshenSpire.html` | **29,527,392 B** |
| full single file (release/main) | `launch.mjs --full-art` → `bundle.mjs` | `AshenSpire.html` | **255,520,031 B** |
| mobile single file (release/main) | `bundle.mjs --mobile` | `AshenSpire-mobile.html` | **29,527,393 B** (the budget is 30 MB, `mobileart-policy.mjs`) |
| web edition, light (dev/test) | `bundle.mjs --external-art --light` | `build/web/AshenSpire.html` + beside it | **9,484,484 B** HTML (2.3 MB gzipped) + 14.7 MB `assets/` + 11.5 MB `map-detail/` + 20.3 MB `music/` = 56.0 MB |
| web edition, full (release/main) | `bundle.mjs --external-art` | the same | 9,484,483 B HTML + 185.1 MB `assets/` + the same tiles and music |

About 68% of the light single file, and 96% of the full one, is base64 media.
The 9.5 MB left is code and generated content. The largest parts are
`src/config/generated/ui.js` (1.1 MB), `changelog.generated.js` (0.4 MB) and
`styles/kit.css` (0.4 MB).

---

## 2. Storage — what moves into the art repository

### What moves

| today, in this repo | moves to `cehinds/AshenSpire-art` | pack |
|---|---|---|
| `assets/` (high tier), already imported as `hd/assets/` | unchanged: ART-REPO-PLAN | `high` |
| `assets-mobile/` (light tier, 5,186 files once the fonts move to `common`, 14.3 MB) | `light/assets/`, **generated there** from `hd/assets/` by `tools/mobile-art.mjs` + `tools/mobileart-policy.mjs`, which move with it | `light` |
| `assets/fonts/*.woff2` (15), `asset-data/fonts/OFL.txt` (a copy) | `common/assets/fonts/`, `common/licenses/OFL.txt` | `common` |
| `music/**/*.mp3` (13) and `music/manifest.json` | `common/music/` | `common` |
| `music/score/*.mjs`, `music/PROMPTS.md`, `music/README.md`, `tools/score/render.mjs` | `art/music/` and its tools: the score's source, like `art/` for images | none (authoring) |
| `map-detail/` (116 tiles) | `common/map-detail/`, built by `tools/map-detail-build.mjs`, which already moves under ART-REPO-PLAN's second table | `common` |
| future SFX samples (`assets/sfx/<id>.ogg`, CONTRIBUTING rule 2) | `common/assets/sfx/` | `common` |

### The release

- The tag family stays `hd-assets-v<N>`, so the pin's shape rules
  (`tools/fetch-art.mjs:48-60`) change as little as possible.
- Releases are automatic: the art repo's release workflow
  ([AshenSpire-art#2](https://github.com/cehinds/AshenSpire-art/pull/2))
  publishes on every merge to its `main` that changes a pack. It attaches three
  zips and the manifest:

```
hd-assets-v<N>.zip        high tier (as today)
light-assets-v<N>.zip     light tier
common-assets-v<N>.zip    fonts, OFL.txt, music, map tiles
art-manifest.json         every id, every pack
```

### `art-release.json`, extended (schema 2)

```json
{
  "_": "AUTHORED — …",
  "schema": 2,
  "repo": "cehinds/AshenSpire-art",
  "tag": "hd-assets-v2",
  "zip": "hd-assets-v2.zip",
  "sha256": "<high zip sha256>",
  "packs": {
    "high":   { "zip": "hd-assets-v2.zip",     "sha256": "<…>" },
    "light":  { "zip": "light-assets-v2.zip",  "sha256": "<…>" },
    "common": { "zip": "common-assets-v2.zip", "sha256": "<…>" }
  }
}
```

The top-level `zip` and `sha256` stay equal to `packs.high` for one release,
so a reader that has not been switched still works. `readPin` refuses a
schema-2 pin whose top level disagrees with `packs.high`.

### `art-manifest.json`, extended (schema 2)

- **Art ids** (5,186: images and SVGs) keep their `light` and `high` records.
- **The 15 existing font ids are migrated.** `assets/fonts/*.woff2` lose their
  `light` and `high` records and gain one `common` record, `{path, bytes,
  sha256}` (the twins are byte-identical today). Every reader that walks the
  twins learns to skip `common` ids in the same PR:
  - the twin check in `bundle.mjs:360-375`;
  - `mobile-art.mjs --check`;
  - `verify-external` C;
  - `tests/art-manifest.test.mjs`.
  Step 2 switched the readers of the manifest's records (`fetch-art` and the
  manifest test). The twin check in `bundle.mjs`, `mobile-art --check` and
  `verify-external` C walk the trees, not the manifest. They stay tree-based
  on purpose until the fonts leave `assets-mobile/` (step 13), because the
  fonts are byte-identical in both trees and those gates still check them.
- **New ids** get one `common` record: `music/manifest.json`,
  `music/<context>/<track>.mp3` and `map-detail/<hash>/<size>/<x>-<y>.webp`.
- **`licenses/OFL.txt`** is a listed `common` record too, so `fetch-art`'s
  "the zip holds nothing else" check passes. It is not an asset id:
  `assetUrl()` never asks for it and `assetmime` does not ship `.txt` as art.
  It is carried in the pack index as `text/plain` so the object store, the zip
  and the service worker carry the licence next to the fonts.
- The `tiers` block gains `common`. Once the trees leave this repository
  (step 13), `tools/art-manifest.mjs --write` stops deriving the file from them
  and **copies the release's own manifest**; `--check` compares the two.
  *(Step 11 as built: the trees are still here and still the builds' source,
  so `--write` keeps deriving from them, and `fetch-art --agree` proves the
  release's rows are exactly the rows the trees give, and every file is the
  same bytes. This plan said "from step 11"; moving the switch to the step
  that removes the trees keeps one source of truth at every step.)*

### `tools/fetch-art.mjs`, extended

- `--pack light|high|common|all`, or a comma list. With no `--pack` the tool
  fetches all three. Each workflow asks for what its build needs: `light` and
  `common` on dev/test, all three on release/main. `tests.yml`'s core job,
  which gates every pull request, fetches `light,common` for `--agree` on a
  pull request and a push to dev, and all three only on test and release, so
  a high-tree or high-release mismatch is caught after promotion, not at the
  pull-request gate.
- Each pack is cached as `.art-cache/<tag>/<pack>/`, with the checks it already
  has: the zip's sha256, then each file against its record, nothing extra in
  the zip, the `.verified` marker written last and the unpack published with
  one rename. A pack zip's own manifest must name its pack (`"pack"`, written
  by the art repository's `tools/pack.mjs`) and carry exactly that pack's rows.
- `--agree` (step 11, while the trees are still here): every verified cache
  equals the trees byte for byte, every shippable tree file is in a cache, and
  the release's rows equal the rows derived from the trees.
- **No token is needed:** `cehinds/AshenSpire-art` is public (owner answer 1,
  made so on 2026-10-02 as step 10a), and with none set the zip comes from the
  release's public download URL. Every run that fetches (every pull request,
  same-repository or fork, Dependabot, and every push or dispatch) downloads
  the packs its branch uses and runs `--agree`; nothing skips the fetch, and a
  run that cannot fetch fails and names why. A token, when set
  (`ART_REPO_TOKEN`, else `GITHUB_TOKEN`), is sent to the API only and **only
  raises GitHub's rate limit**. A token that cannot read the repository falls
  back to the public URL, so a stale secret does not stop a fetch. Every
  failure names its cause: the token refused, the repository unreadable, the
  rate limit, the network.
- **The token rule in CI is defence in depth, not a security boundary.** CI
  passes the `ART_REPO_TOKEN` secret only to a push or dispatch of a protected
  branch (dev, test, release, main); a pull request or a dispatch of any other
  ref gets an empty string. That stops a branch that edits only
  `tools/fetch-art.mjs` from reading the token. It does not stop a writer: a
  same-repository pull request or a dispatched branch runs its own workflow
  files, so anyone who can push a branch can edit a workflow to read any
  secret. Because the repository is public the token buys only rate-limit
  headroom, so **the real fix is an owner action**: delete the
  `ART_REPO_TOKEN` repository secret, or, if it must stay, move it into a
  GitHub Environment whose deployment branches are limited to dev, test,
  release and main. `tests/fetch-art.test.mjs` holds the expression in place
  in every workflow until then.

### Build identity

- `art-release.json` and `art-manifest.json` join `BUILD_IDENTITY_FILES`, as
  ART-REPO-PLAN step 4 already requires (done at step 11; the sandboxes that
  run the bundler, `tools/bundle.test.mjs` and `tools/sfx-filename-convention.mjs`,
  copy both).
- `assets`, `assets-mobile` and later `music` and `map-detail` leave
  `INPUT_ROOTS` (`tools/buildversion.mjs:168`) in the PR that deletes them.
  From then on the pin is how the digest sees the media.

---

## 3. Runtime loading

### The pieces

1. **Object store.** Every shipped file is written once as
   `objects/<sha256[0:2]>/<sha256>.<ext>`. Because the name is the content:
   - identical bytes are stored once (the ~50 aliased images);
   - a stale cache can never serve different bytes under the same name;
   - Pages, the service worker and the zip can share files between builds.
2. **Pack index.** One file per pack, `packs/<pack>-<digest12>.json`: a sorted
   map of id → `[sha256, bytes, mime]`. With about 5,330 ids it is about
   700 KB, 350 KB gzipped. A light build loads the light and common indexes.
   - **The `.js` twin** is for `file://`. It is exactly
     `window.__ashenPack("<pack id>", "<the .json file's text, as a JS string>")`.
     The loader hashes **the string** before `JSON.parse`. That string is,
     byte for byte, the `.json` file, so one pinned sha256 covers both. A twin
     whose string does not hash to the pin is dropped unparsed.
   - What the twin cannot prevent: it has already run when its argument is
     checked. It runs from the build's own folder, like the HTML, so the trust
     is the same as the HTML's. The pin catches a wrong or stale twin, not a
     hostile one.
3. **Pin in the HTML.** `bundle.mjs` stamps `ASSET_PACKS` in memory, as it
   already stamps the version and edition (`bundle.mjs:490-518`). For each pack
   it records the index text's sha256, its object count and its total bytes,
   plus the font sidecar's text sha256, and it names the **default tier**.
   `ASSET_MAP` stays empty (`src/ui/assetmap.js:16-18`).
4. **Loader** (`src/ui/assetPacks.js`, new; UI layer, not engine). At boot:
   1. It finds the base: `asset-base.json` beside the page if there is one
      (written by the Pages site, section 4), otherwise `./`.
   2. It loads each index: `fetch` over http(s), a `<script>` tag of the `.js`
      twin under `file://`.
   3. It checks each index's sha256 against the pin, using SubtleCrypto where
      it exists and a ~2 KB bundled SHA-256 elsewhere.
   4. It hands `assetmap.js` a Map of id → **relative object path**
      (`<base>objects/xx/<sha>.webp`, not a `blob:` URL).
5. **Tier selection, with fallback.** The requested tier is Settings → Art
   quality (Auto/Light/High, section 5). *Auto* means the build's default,
   except light on a narrow layout or phone-sized screen, with Save-Data on or
   on a low-memory device (see [Step 8c as built](#step-8c-as-built)).
   If the requested tier's index cannot be loaded or fails its hash, the loader
   uses the light index. The fallback order is **high → light → placeholders**.
   So a main build whose default is high still shows the light art:
   - in the offline zip, which carries light and common only;
   - when the service worker precached only light and common;
   - on a host that did not publish high.
   *Auto* offline therefore means light, not placeholders.
6. **`assetUrl()`** (`src/ui/assetmap.js:54-56`) resolves in the order: high-res
   overlay (unchanged), then the **built-in pack**
   (`setBuiltInSource(map)`, new, beside `setHighResSource`), then `ASSET_MAP`
   (older inline builds), then the path. An unknown id still passes through
   and 404s visibly, as it does today.
7. **CSS assets.** In the pack shape, `bundle.mjs` stops rewriting CSS
   `url()`s. Every rule that names an asset moves out of the inlined `<style>`
   into an `ASSET_CSS` template with `{{id}}` slots; the loader fills the slots
   once the index resolves and injects the template as one `<style>`. This
   covers the 15 `@font-face` rules and the backdrop rules, and closes the CSS
   bypass SPEC §2's status row calls open (*"14 CSS `url(../assets/…)`
   backdrops still bypass `assetUrl()`"*).
   - **The two SVG masks stay inline** as `data:` URIs in the template.
     `mask`/`mask-image` load in CORS mode (the CSS Masking spec), which
     Chromium refuses for `file:` URLs. A failed mask is transparent, so the
     entrance-hall layer on the startup gate would vanish.
8. **Map tiles.** `mapDetail.js` builds tile ids
   (`map-detail/<hash>/<size>/<x>-<y>.webp`) and resolves them with
   `assetUrl()`. This **rewrites `load()`** (`mapDetail.js:40-50`), which today
   does `fetch` → `blob` → object URL: tiles become `Image` loads of the
   object path, so they also work under `file://`.
9. **Music.** `audio.js` reads the shipped manifest and tracks through the
   common index instead of `music/` beside the page, and `SHIPPED_MUSIC_FOLDER`
   becomes the id prefix.
   - **Under `file://` the score stays synthesized, as SPEC §7.4 says today.**
     `playExternal` (`audio.js:475-490`) sets `crossOrigin = 'anonymous'` and
     routes the element through `createMediaElementSource`. Chrome refuses a
     CORS-mode `file:` load, and without `crossOrigin` the opaque origin makes
     Web Audio output silence. The manifest also comes through `fetch`
     (`:599`).
   - A later option, not in this plan's steps: base64 `.js` per track, decoded
     with `decodeAudioData` (about 27 MB of script for the 20 MB score).
10. **Fonts under `file://`.** Chrome refuses cross-origin font loads from a
   `file://` page. The common pack therefore also ships
   `packs/fonts-<digest12>.js` in the same twin form:
   `__ashenFonts("<id>", "<JSON text: face → base64>")`.
   - Its text is hashed against its own pin, and each decoded face against its
     `common` record.
   - The loader then calls `new FontFace(name, bytes)`, and uses this only
     under `file://`.
   - It is a sidecar file, not inlined in the HTML.
11. **CSP.** There is none today: no meta tag in `index.html`, and none set
    anywhere in `src/` or `tools/`. If one is ever added it must allow
    `script-src 'self'` (the sidecars), `img-src 'self' blob: data:` (the masks,
    the high-res folder picker) and `font-src 'self' data:` (with `FontFace`
    given `ArrayBuffer`s, `font-src` is not consulted, but the `url()` form is).

### Integrity

| where | what is checked | against |
|---|---|---|
| boot, every build | each pack index's text, and the font sidecar's text | `ASSET_PACKS` in the HTML (a mismatch drops that index, and the tier fallback applies) |
| service worker, before caching an object | the object's sha256 | its name (and so the index) |
| in-game zip download | every object's sha256 as it streams | the index |
| CI (`verify-external`, pages-site `--check`) | every object | the index and `art-manifest.json` |
| art fetch (`fetch-art.mjs`) | each zip, then each file | the pin, then the manifest |

The page does not hash each `<img>` it loads directly: the browser cannot hash
a response it hands to an image, and a `fetch` → hash → blob URL round trip
for each of up to 5,201 files would cost more than it protects. Without the
service worker, integrity for those files rests on the content-addressed name
and on the CI gates.

### Failure and fallback

- **Every index missing or wrong hash:**
  - The game boots on placeholders (SPEC §2.4: *"fully playable with zero
    downloaded assets"*), the synth score and system fonts.
  - A non-blocking notice says the art could not be loaded and offers
    **Retry**.
  - The debug failure banner stays quiet, because this is not a dead control
    (`tests/debug-banner.test.mjs`).
- **One file fails (404, network, hash):**
  - The existing document-level `error` listener (`highResArt.js`
    `watchMissingFiles`) is extended to the built-in pack: a high file falls
    back to its light twin when the light index is loaded, and otherwise to the
    placeholder recipe in `src/ui/assets.js`.
  - A missing track plays the synth bed, as it already does (SPEC §7.4).
  - A missing tile keeps the low-detail map, as it already does.
  - A missing font falls back to the system faces the `font-family` stacks
    already name.
- **Local high-res** is unchanged: it still lays over whatever the built-in
  tier is.

### The loading screen

- Loading happens behind the **startup gate** that already owns the cold boot
  (`src/ui/components/startupGate.js`, gated by `tools/startup-gate.mjs`).
- While the gate waits for its first press, the loader fetches the indexes and
  a **critical set**: the fonts and the title backdrops. The set is listed in
  `content/config`, not typed in code.
- The gate shows one line of progress ("Loading art · 12 of 21") and never
  blocks. A press before the set finishes goes straight to the title, where
  the late art swaps in as it arrives (`font-display: swap` is already set).
- Everything else loads per screen, as the web edition does now. The existing
  warm-ups (`posePreloads.js`, `reaverAttack.js`, `combatEffectSprites.js`)
  keep the first attack from stalling.
- With Reduced motion on, the progress line is plain text.

---

## 4. Hosting

### Build outputs

`tools/launch.mjs` writes one tree, the same for `build/`, `dist/`, the
dev-preview artifact and the zip:

```
AshenSpire.html  AshenSpire-<ver>.html (dist)
packs/light-<d12>.json|.js  packs/common-<d12>.json|.js  [packs/high-<d12>.json|.js]  packs/fonts-<d12>.js
objects/<xx>/<sha256>.<ext>
download/AshenSpire.html   the light single file: inline, about 30 MB (owner answer 3)
```

- `dist/AshenSpire.html` still opens by double-click (section 5), so the
  player door in ARCHITECTURE-MAP.md stays open.
- **`.gitignore`.** `build/` and `dist/` used to ignore only `*.html` and named
  subfolders, so `packs/` and `objects/` were not ignored. Step 2 added
  `build/**/packs/`, `build/**/objects/`, `dist/**/packs/` and
  `dist/**/objects/` (and the `.asset-pack` markers) when `asset-pack` first
  wrote there; the plan had put this in step 3a.

### GitHub Pages (`tools/pages-site.mjs`, `pages-builds.yml`)

The project site lives at `https://cehinds.github.io/AshenSpire/`, so "site
root" below means `/AshenSpire/`.

- **Store.** Pack-shaped builds share one object store and one pack folder:
  `/AshenSpire/objects/…` and `/AshenSpire/packs/…`.
- **Each page's base.** Every page that serves a pack-shaped HTML gets an
  `asset-base.json` beside it, with the relative path to the site root:

  | page | depth | `asset-base.json` |
  |---|---|---|
  | `/<branch>/<ordinal>/index.html`, `/<branch>/latest/index.html` | 2 | `{"base":"../../"}` |
  | `/build/AshenSpire.html`, `/dist/AshenSpire.html` (main's stable aliases, `pages-site.mjs:642-670`) | 1 | `{"base":"../"}` |
  | `/AshenSpire.html` (README's Play link) | 0 | none needed (the default `./` is right), but written anyway, so every page states its base |

- **`/AshenSpire-mobile.html`** (README's stable mobile link) becomes a
  one-line redirect page to `AshenSpire.html` at step 8e, and README's link is
  edited in the same PR (owner answer 2).
- **The light single file** is published at
  `/<branch>/<ordinal>/download/AshenSpire.html` (step 6b) and stays there: the
  build list's *Download* link and `offlineDownload.js` point at it (owner
  answer 3).
- **Byte-proof.** The HTML stays byte-identical to the build, so the byte-proof
  per build (`pages-site.mjs` `check`) is unchanged.
- **No per-build media copies.** The copies of `map-detail/` and `music/` per
  build (`pages-site.mjs:716-738`, `:761-764`), and `/build/music` and
  `/dist/music` (`:672-676`), stop for pack-shaped builds.
- **Two new `--check` rows:**
  - every object a served index lists is present with that hash, and no object
    is unreferenced;
  - every page that serves a pack-shaped HTML has an `asset-base.json` that
    resolves its indexes.
- **Service worker.** One script at **`/AshenSpire/sw.js`**, scope
  `/AshenSpire/`. The page registers it with a **relative** URL,
  `new URL(base + 'sw.js', location.href)`, where `base` is the one
  `asset-base.json` gave, and never with `/sw.js`, which would name the
  `cehinds.github.io` root.
- **Older builds** (inline single files, and the per-build `mobile/` folder)
  keep their current shape. `pages-site` serves both shapes side by side until
  they age out of `--keep`.
- **Where the objects come from.**
  - Current builds: the object tree `launch.mjs` wrote.
  - Rebuilt builds (`--build-missing`): the same, from the pin at that commit.
    The fetch cache is keyed by tag, so one fetch serves every rebuild.
  - From step 11 on, `pages-builds.yml`'s main build fetches the release
    main pins, once main's pin is schema 2. The art repository is public
    (owner answer 1, step 10a), so it needs no secret; the `ART_REPO_TOKEN`
    it passes on a protected branch only raises the rate limit.
- The **main** build, whose default tier is `high`, also carries the `light`
  pack. A phone, and the high → light fallback, use it from the same page.
  Serving the high tier publicly on Pages for main and release is the owner's
  answer 4.

### Main's base tree, and the site's size

`assemble()` (`pages-site.mjs:623-635`) `git archive`s **main's whole tree**
into the site root, and nothing excludes media. On `origin/main` today that is
**1,089 MB** of blobs:

- `art/` 604 MB;
- `docs/` 239 MB, of which `docs/preview` is 161 MB;
- the committed builds `AshenSpire.html`, `build/` and `dist/`, about 56 MB
  each;
- `assets/` 43 MB;
- `map-detail/` 11 MB.

**Step 6a**, a precondition of the store, makes `pages-site` exclude the media
and authoring roots from the base tree: `art/`, `assets-mobile/`,
`map-detail/`, `music/` and the committed build HTML. **`assets/` stays** (owner,
2026-10-02), and so does `docs/preview` (owner answer 7, FINISH D26).

As built (corrected against the code; the first draft said these roots "are
only ever served as build payloads", and listed `assets/` among them):

- **No build page reads them from the root.** Each `/<branch>/<ordinal>/`
  build is one inline file that reads only the `map-detail/` and `music/`
  written beside it. The stable links are the same kind of file: every image
  under `assets/` is in their `ASSET_MAP`, and they fetch only `map-detail/`
  and `music/` beside themselves.
- **The stable links keep their payload.** `pages-site` writes
  `/AshenSpire.html`, `/build/`, `/dist/` and `-mobile` from main's committed
  build (or from `--main-build` once main no longer commits one), as before. It
  writes main's `map-detail/` and `music/` back beside **every** stable
  location (the root, `/build/` and `/dist/`), so each one finds its tiles and
  score through its own base URL. Those two folders cost what they did until
  step 6b serves the stable links from the store.
- **`assets/` stays because pages other than builds load images from it:**
  main's source page at `/index-game.html`, `docs/component-catalog.html`,
  `items-preview.html`, `docs/low-poly-fighters/` and `pose-studio/`. It
  leaves the base tree with step 13, when `assets/` leaves main.
- **`art/` goes.** Its seven review sections leave the site, and the build
  index stops listing them, because page discovery reads the assembled tree.
  The plain links into `art/` from `docs/component-catalog.html`,
  `pose-studio/` and `docs/low-poly-fighters/index.html:38` (`../../art/poses/`)
  now 404; nothing loads an image from `art/`.
- **The share image.** `og:image` is now
  `https://cehinds.github.io/AshenSpire/og-image.webp`. `pages-site` writes it
  at the site root from `assets/bg/title-city-tower.webp` in main's tree, or
  from the first other branch that has it. `OG_IMAGE` in `tools/og-image.mjs`
  (a Pages-only module, so it is not a build-identity input)
  names all three, and `--check` is red without it. **Before step 13 removes
  `assets/` from main, step 6b or 13 must take this file from the object store
  instead**, or every branch loses its source and `--check` goes red.

| term | today | steady state after the plan |
|---|---|---|
| main's base tree | 1,089 MB (about 485 MB after step 6a: `art/` out, `assets/` 43 MB kept) | about 470 MB while `assets/` is kept (dev's `assets/` is 206 MB); about 265 MB after step 13 (about 105 MB without `docs/preview`) |
| build HTML (`builds.json`, 2026-09-27 15:15Z, `--keep 10`) | **2,760 MB**: dev 294 (10 light), test 1,196 + 117 mobile, release 798 + 29 mobile, main 328 (8 full) | 38 × 9.5 MB ≈ 360 MB |
| per-build music and tiles | about 32 MB × 38 ≈ 1,200 MB | 0 |
| stable links (`/AshenSpire.html`, `/build/`, `/dist/`, `-mobile`) | 4 × up to 255 MB | 3 × 9.5 MB + a redirect ≈ 30 MB |
| light single files (`download/`, owner answer 3) | (inside the build HTML above) | not in the total below: 4 × 29.5 ≈ 120 MB if only each branch's latest build carries one, 38 × 29.5 ≈ 1,120 MB if every kept build does (step 6b picks) |
| object store (high 185 + light 14 + common 32, plus the files each release changes) | — | about 240 MB |
| **total** | **well above 5 GB** | **about 1.1 GB** before the light single files while `assets/` is kept (about 895 MB after step 13): about 1.2 GB with one per branch, about 2.2 GB with one per kept build |

**Step 6b keeps one for every retained pack-shaped build** (see
[Step 6b as built](#step-6b-as-built)): every Download link stays valid
without the zip of step 7, and the higher estimate applies.

If step 6b keeps light single files only for each branch's latest build, every older retained build must hide its per-build Download cell and use the offline zip path inside the game; no link may target an absent `download/AshenSpire.html`. Its check iterates every rendered build-list link and every offered offline-download action and verifies that the destination exists. Keeping a single file for every retained build keeps those links and uses the higher storage estimate.

- **The published site is already far over the documented 1 GB Pages limit**
  (docs/plan-polish-review-2026-09.md:452), mostly because of the inline full
  and test builds. Deploys still succeed, so the limit is not hard-enforced
  today, but the plan should not count on that.
- **Transition peak.** While old inline builds and the new store are both
  published, the site is today's size plus the store, about 240 MB more. It
  then falls by one old build per new build until the old ones age out of
  `--keep` (for dev, about 10 dev merges). Step 6a removes about 600 MB of the
  base tree (`art/`; measured 1,089 → about 485 MB on `origin/main`) before
  the store is added, so the peak stays below today's size.
  To shorten the peak, the owner can dispatch `pages-builds` once with a lower
  `keep` after step 6.
- `pages-site --check` prints the assembled site's total size, so growth is
  seen.

### Releases

- A public AshenSpire release carries nothing new.
- The high-res zip is public once the art repository is (owner answer 1,
  superseding ART-REPO-PLAN's *Owner answer 2026-09-27* and FINISH D20):
  anyone can download it from that repository's `hd-assets-v<N>` releases for
  **Local high-res**. It is still not attached to AshenSpire releases.
- The offline zip is assembled by the game (section 5), and the light single
  file is published on Pages (section 4), so no release asset is needed.

---

## 5. Offline and mobile

What changes: *"download one .html, double-click, play offline"* stays for the
light art (owner answer 3), and gains *"one folder"* and *"install it"*. The
in-game **Download & saves** screen (`src/content/offlinePlay.js`,
`src/model/offlineDownload.js:3-10`, which fetches `../<ordinal>/index.html`
today) and the separate 29 MB mobile file are the two surfaces affected.

### Options

| option | desktop | phone | cost | trade-offs |
|---|---|---|---|---|
| **A. Service worker + install** (PWA manifest, "Make available offline" button) | yes: works offline at the same URL | **yes**: the only option that works well on iOS and Android | `sw.js` + `manifest.webmanifest` + a precache list read from the indexes; ~47 MB light + common (or +185 MB high) in Cache Storage | Hosted only (not `file://`). Browsers may evict it unless `navigator.storage.persist()` is granted or the app is installed (iOS evicts after about 7 days unused). Saves stay in the site's `localStorage`, so online and offline share one set of saves, which is better than today's split between a downloaded copy and the site. `<audio>` sends `Range` requests, and Safari needs `206` partial responses, so the worker must answer them from the cached object (below). |
| **B. Zip the game assembles** (Download game → `AshenSpire-<branch>-<ver>.zip`: HTML + `packs/` + `objects/`, light + common) | yes: unzip, double-click | poor: phones cannot open an unzipped HTML with its folder reliably | a small store-only zip writer in the browser (ported from `tools/zip.mjs` `writeZip`), streaming to `showSaveFilePicker` where it exists, else a Blob; each object is hash-checked as it is written; no hosting cost | Works under `file://`: images and CSS by path, the index and fonts through the `.js` sidecars, and the synth score (section 3.9). The HTML's default may be high (main), and the tier fallback shows the packed light art. About 57 MB, not 29 MB. Saves stay separate from the site's, as they are today. |
| **C. Keep a light single file for offline** (inline, `download/AshenSpire.html`) | yes | as today (29 MB) | keeps `ASSET_MAP` inlining for the light tier, and `verify-shipped` check A, alive | An exception to decision (b) the owner chose (answer 3). Two shapes to keep working. |
| **D. Drop offline** | no | no | none | Removes a feature that has a screen, content and a QA tool (`tools/offline-play-qa.mjs`). |

### Owner's choice: A + B + C, and drop D

The plan recommended A + B only. The owner kept C as well (answer 3): one
light single file, about 30 MB, self-contained, plays by double-click. The
254 MB full single file is retired (answer 6).

- **A** is the phone story and the main offline path. The worker:
  - serves HTML network-first;
  - serves objects cache-first, checking each object's hash before caching it;
  - answers `Range` requests for `audio/*` with a `206` slice of the cached
    response;
  - carries a kill-switch version.
- **Auto offline falls back to light.** "Make available offline" precaches
  light and common, plus high only if the player asks. On main, whose default
  is high, *Auto* offline therefore shows light art through the tier fallback
  (section 3.5), not placeholders.
- **B** adds a folder copy (the pack shape, light and common) for desktop
  players who want one to keep.
- **C** is the *Download* link: the light single file, the same as today's
  light build.
- **The separate mobile file is dropped** (answer 2). One HTML chooses its
  tier at runtime:
  - Settings → Display → Art quality becomes **Auto / Light / High /
    Local high-res**.
  - *Auto* means light on a narrow layout (`data-layout`), with Save-Data on,
    or on a low-memory device, and the build's default otherwise.
  - The choice stays in `LOCAL_ONLY_KEYS` (`src/model/settingsSync.js:86`).
  - This also retires `--mobile` and the `mobile/` pages. The 30 MB budget
    (`mobileart-policy.mjs`) moves to the light single file.
- **D5.** The 254 MB file that D5 kept ends at step 8e (answer 6, FINISH D24).
  The light single file stays.
- The hosted build list keeps a single **Play** link. The *Download* link opens
  the game's Download screen, which offers the light single file, the zip and
  the install.

---

## 6. Every gate, test and rule that assumes one self-contained file

"Step" refers to section 7.

### Build and CI

| gate / test | where it runs | assumes | becomes | step |
|---|---|---|---|---|
| `tools/bundle.mjs` single-file shapes (default, `--light`, `--mobile`) | every build | media inline | the pack shape (the old `--external-art` plus packs), plus `--light` inline for the light single file only (owner answer 3). The default full-art shape and `--mobile` are removed at the flip; `--external-art` stays as an alias for one release. | 3a, 8e |
| `tools/bundle.mjs` literal-ref check (`:1000-1045`) | every build | `assets/…` exists on disk | checks the literal ids against `art-manifest.json` | 12 |
| `tools/launch.mjs` (`:75-76`, `:123-129`, `:143-176`, `:180`) | every build | three single files, then copies of music and tiles | writes one tree (section 4), with the light single file under `download/`; no mobile or full-art single file | 3a, 8e |
| **The `EDITION` stamp.** `src/buildversion.js:248-265` (`EDITION`, `BUILD_IS_MOBILE`, `BUILD_IS_LIGHT`), the "· mobile edition" / "· light art" identity line (`:315`); `bundle.mjs:514`; `tools/buildversion.mjs:105-117`, `BUNDLE_EDITIONS`, the `:772` edition check and rows **E/E2** (`:959-1032`, where E2 checks the mobile single file); `verify-external.mjs:90`; `verify-shipped.mjs:222-246` | every build, CI | one of three single files | the edition becomes **the default tier** (`light`/`high`), and the light single file stamps `light`; `mobile` is removed; E2 checks that the packs the HTML pins are present instead of a mobile file; the identity line says "· light art" / "· high art". | 8e |
| `src/ui/assetmap.js:59` `assetsAreInlined()` | runtime | an inline build has a filled `ASSET_MAP` | true only for the light single file and older inline builds; its callers ask `builtInSource()` (pack loaded) as well | 3a |
| `tools/verify-shipped.mjs` check A (art inline, the count floor) | `ci.yml` reproducible, `dev-preview.yml` | ASSET_MAP entries in the HTML | **stays, for the light single file** (owner answer 3), with its light count floor. The pack HTML gains its own checks: it carries `ASSET_PACKS`, zero `data:` media except the two masks, and each named index is in `packs/` with that hash. Checks B and C (the aliases are this build, nothing tracked) stay. | 8e |
| `verify-shipped` mobile-edition check (budget, smaller than full) | same | a mobile file | removed with the edition | 8e |
| `tests/mobile-art-distinct.test.mjs:20` | core suite | the bundle's `ASSET_MAP[alias] = ASSET_MAP[key]` loop | unchanged for the light single file, which keeps the loop; adds that the pack index maps aliased ids to one object | 8e |
| `tools/verify-external.mjs` A–E (`--dir preview`, `--selftest`) | dev-preview | `assets/` copied beside the HTML, compared with source `assets/` | A: pins are present; B: no `data:` media except the masks; C: every object in every index is present and hashes to its name; D: every `ASSET_CSS` slot names an id the index has; E (3c): the common index lists every map tile and every track the score's manifest names, and no `map-detail/` or `music/` copy sits beside the HTML. The selftest plants a missing object, a wrong hash, a stale pin and a twin whose string does not match. | 3a–3c |
| `tools/external-play.mjs` (reachability job) | `test`, `release`, `main`, dispatch | served build, art over the wire | unchanged over http; adds a `file://` pass (the zip shape, masks and fonts included) and a pass that must stay playable with the index blocked (placeholders), plus one with only light present on a high-default build | 3a, 4, 5 |
| `tools/bundle.test.mjs` parse gate and EOL corpus (`tests.yml:125`, `ci.yml:287-308`) | `test`/`release` | sandboxes copy `assets/`, run the unflagged full-art build, and read `bg_act1.webp` | sandboxes build the pack shape from a small fixture pack and the light single file with `--light`; the EOL corpus reads a fixture object | 8e |
| `ci.yml` reproducible (3 OSes) and `reproducible-agree` | `test`/`release` | the HTML digest is the build | digests of the HTML, the light single file **and** each pack index; objects are a function of the pin | 8e |
| `tools/rebuild-matches.mjs`, `buildversion --check` | CI | the HTML carries everything | unchanged for the HTML | — |
| `tools/buildversion-selftest.mjs` | `ci.yml` reproducible | `COPY` (`:65`) includes `assets` and `assets-mobile`; the mobile-edition plant (`:306-312`) | copies the fixture pack instead; the mobile plant becomes a "pinned pack missing" plant | 8e, 11 |
| `tools/readiness-preview-build.mjs:15` | every push (dev-preview) | builds its own data-URI asset map for an "offline gallery and standalone game" | moves to AshenSpire-art under ART-REPO-PLAN step 5; until then, it keeps its own inline map (it is a preview page, not the game) | ART-REPO-PLAN 5 |
| `tools/mobile-art.mjs --check` / `--selftest` (`ci.yml:270-274`, `dev-preview.yml:178`) | every push | twins are in this repo | the art repo's CI already runs them where the light tier is generated (step 9). Here they stay while `assets-mobile/` does, beside `fetch-art --agree` (step 11), and go with the tree; then `art-manifest.mjs --check` compares the pinned release | 11, 13 |
| `tools/credits-check.mjs` | every push | enumerates `assets/*` | enumerates manifest id prefixes, including `music/`, `map-detail/` and `assets/fonts/` (ART-REPO-PLAN already plans this) | 12 |
| `tools/hand-side-probe.mjs`, `shotguard-probe`, `startup-gate`, `map-two-axis-pan` | browser jobs | served source or build with art beside it | source mode is served by `tools/serve.mjs`, which maps ids to the fetch cache | 12 |
| about 40 browser tools with `--dist` over `file://` (`mapfit`, `screenreach`, `release-shots`, `about-changelog`, `offline-play-qa` and others; `git grep -l "dist/AshenSpire.html" tools`) | browser jobs, by hand | `dist/AshenSpire.html` is complete alone | keep working under `file://` once step 4 lands (objects beside it); where a tool needs `fetch`, one helper in `tools/browser.mjs` serves `dist/` over http. One PR flips them all and lists them. **Built (8d), against the real tree:** 30 tools built a `file://` URL for a built page and now ask `buildPageUrl()`, which returns that same `file://` URL for a self-contained file and serves the HTML's folder over local http when the HTML carries a non-empty `ASSET_PACKS` pin (the pack shape), under `/<channel>/latest/` so the page keeps the channel and debug state its file reads (`unknown` for `dist/AshenSpire.html`; `buildChannel()` reads that path) (`ASHEN_BUILD_OVER=file|http` forces either): `actends`, `actionreach`, `advanced-config-preview`, `arcane-exposure-visual`, `axisfit`, `card-drag-targeting`, `combat-action-row`, `combatant-stage`, `controlstrip`, `gesture-cancel`, `hand-pager-threshold`, `holdbeat`, `holdconfirm`, `hudbars`, `mapfit`, `mapfog`, `mapreach`, `mapspacing`, `menufit`, `mobilefit`, `presentation-matrix`, `screenreach`, `scroll-cue-bleed`, `short-landscape-support`, `tapsize`, `text-geometry`, `uprightgate`, `uprightsetting`, `veil-owns-input`, `zoomplace`. The rest of the grep already served the repository over http through `tools/serve.mjs` (`release-shots`, `about-changelog`, `settingsreach`, `watched`, `doublescroll`, `profile-first-run`, `armoury-inventory-disclosure`, `current-build-ui-repair`, `hud-quick-compact`, `screenshot`, `card-feedback`, `external-play`), or reads the file without a browser; `offline-play-qa` stays on `file://` by design (its row below). | 8d |
| `tools/offline-play-qa.mjs` | by hand | downloads one HTML and opens it under `file://` | keeps its single-file pass for the light single file; adds: downloads the zip, unzips it and opens it under `file://` (**built, step 7: `--zip`**); installs the service worker, goes offline, boots and plays a track (the `206` path; built in `tools/pages-offline.mjs`, step 6b) | 6b, 7 |
| `tests/web-meta.test.mjs:57` | core suite | `build/AshenSpire.html` and `-mobile.html` | `build/AshenSpire.html` and the light single file | 8e |
| `index.html:14` `og:image` (copied into the build by `tools/head-meta.mjs`) | every build | `raw.githubusercontent.com/…/main/assets/bg/title-city-tower.webp` exists | points at the Pages object for that backdrop (a stable path the site writes, `/AshenSpire/og-image.webp`), before `assets/` leaves main | 6a |
| `tests/settings-revamp.test.mjs:21-25` (`buildChannel` of a `file://` name) | core suite | a single downloaded file's name | unchanged: the name inside the zip keeps the channel (`src/ui/buildChannel.js`) | — |
| `tools/pages-site.mjs` `--check`, `--selftest`, the mobile editions (`:432-455`, `:700-766`), the base-tree archive (`:623-635`) | `pages-builds.yml` | one HTML (+ mobile) per build, copies of music and tiles, the whole main tree | base-tree exclusions; the object store and `asset-base.json` for every page kind; new checks (section 4); mobile links only on old builds | 6a, 6b |
| dev-preview "Collect the playable build" (`dev-preview.yml:202-254`) | every push | `cp -r assets/…` into `preview/` | copies the built tree; the extra `assets/` copies for preview pages read the cache | 3a, 12 |
| `pages-builds.yml` "Build main from source" (`:222-232`) | push to `main`, dispatch | copies two single files | copies the tree; fetches the release main pins (the art repository is public: no secret is needed; `ART_REPO_TOKEN`, on a protected branch, only raises the rate limit) | 6b, 11 |
| `tests/run-node.mjs` checks 33, 49, 79; `content-expansion-equipment`, `rogue-parity`, `environment-art`, `relic-art` tests | core suite | files on disk under `assets/` | ids against the manifest (ART-REPO-PLAN step 4 rows, extended to the light tier, music and tiles) | 12 |
| `tests/art-manifest.test.mjs`, `tests/fetch-art.test.mjs`, `tests/high-res-art.test.mjs` | core suite | schema 1, one pack | schema 2, three packs, the font migration, `licenses/OFL.txt`, the pin's aliases | 2, 11 |
| doorplant `COPY_SET`, `sfx-filename-convention`, every `mkdtempSync` sandbox | various | the trees are in the repo | copy the pin and manifest (ART-REPO-PLAN). Step 11: every sandbox that runs the bundler copies both, because the build digest now refuses a tree without them (`bundle.test.mjs`, `sfx-filename-convention`; `buildversion-selftest` and `buildstamp-shot-selftest` copy `BUILD_IDENTITY_FILES` already). doorplant's `COPY_SET` builds nothing and needs neither until step 12 | 11, 12 |

### Written rules

| rule | text today | becomes | owner sign-off |
|---|---|---|---|
| SPEC §3.2, `build/ · dist/` row | "The single-file bundle emitted by `tools/bundle.mjs` and its shipped copy" | "The game file, its pack indexes and its object store, and the light single file …" | **yes** |
| SPEC §7.4, the music paragraph | the `music/` beside the page; "a `file://` page cannot fetch it and keeps the synth" | tracks are read through the common pack; `file://` still keeps the synth (unchanged) | **yes** |
| SPEC §7.5, fonts **TO BUILD** | "Cinzel/Inter … NOT bundled … self-hosting the woff2 under `assets/fonts/` is unfinished" | the interface faces are pack files loaded at runtime; system fallbacks stay. Replaces the bundling question (owner, 2026-09-27). | **yes** |
| SPEC §11, non-goals | "bundled audio asset files" is a non-goal | still true in letter; reword to "audio ships as pack files; SFX stay synthesized" | **yes** |
| SPEC §1, *Entry point* | "`index.html` opened directly or via any static server" | "via `node tools/serve.mjs`" once the media leaves the tree (ART-REPO-PLAN already names this) | **yes** |
| FINISH.md D5 and §4 line 107 | "the 254 MB file stays a download"; "the single-file download stays available" | the 254 MB file is retired; the light single file stays a download, beside the install and the zip (owner answers 3 and 6; FINISH D24) | **yes** |
| SPEC §7.1, the cold boot (*"It contains only the Ashen Spire wordmark, decorative ash/embers, the input-family prompt, and the shared BUILD/source stamp"*) | the gate contains only those four, and a press reveals the title | unchanged for the gate itself: step 5 keeps the boot status line **outside** the gate (`boot-art-status`, a sibling in `#app`). Whether SPEC should name that line, the wait for the load before the title, and the title's art notice with Retry is a question for the 8a SPEC PR ([#1440](https://github.com/cehinds/AshenSpire/pull/1440), awaiting owner approval) | **yes** |
| SPEC §2 status row and §2.4 | the CSS backdrops bypass `assetUrl()` (open) | closed by `ASSET_CSS` | no (a status row) |
| SPEC §8, the `release-shots` row | "the built bundle (`dist/AshenSpire.html`)" | `dist/` (HTML + packs) | no (wording) |
| DEVELOPER.md, *Standalone build* (`:873-885`) | "single self-contained HTML … no external files" | the build tree, whose light single file is still self-contained; the pack HTML's double-click works when the folder stays together | no |
| DEVELOPER.md, *Run & test* (the editions, light/full/mobile, the 30 MB mobile file, `npx serve .`) | three single files | the pack shape plus the light single file; the tiers are packs; `tools/serve.mjs` | no |
| README.md `:13` (the stable and mobile Play links), `:36` (art tiers, "one ~29 MB file"), `:38` ("any single `.html` above plays by double-click") | single files | one Play link; the tiers; offline = the light single file, the install or the game's zip; `-mobile` redirects | no |
| `dist/README.md` ("the build shapes"; "the complete HTML plays offline") | three shapes | one tree, what to keep together, and the light single file | no |
| CONTRIBUTING.md rule 2 (where assets live) | `assets/`, `assets/sfx`, `music/`, `assets/fonts/` here | they enter through the art repository and a pin bump | no, but the owner reads it |
| CREDITS.md:119-120 (fonts "the bundler inlines") | inlined through `kit.css` | loaded from the common pack; `OFL.txt` travels in the pack, and the `kit.css` licence header still ships | no |
| ARCHITECTURE-MAP.md, *Player door* and *Root allowlist* | "Portable build: `dist/AshenSpire.html`"; `assets-mobile/`, `music/`, `map-detail/` at the root | the door stays (double-click works from `dist/`); the moved roots leave the allowlist | no |
| CLAUDE.md, *Never commit built HTML* | built HTML | add `packs/` and `objects/` under `build/` and `dist/` | no |
| `tools/content-build.mjs:5` (comment) | "ship as one self-contained HTML" | reworded when that file is next touched; the code is unaffected | no |

SPEC and FINISH edits go in **their own PR before the flip** (step 8a;
CONTRIBUTING rule 1).

---

## 7. Migration steps

Every step is one reviewed PR (or one owner action), and the game still works
after each. Runtime loading (b) comes first, while every file is still in this
repository; storage (a) follows. The art repository therefore only becomes a
build dependency at step 11. No token does: the owner made it public (answer
1, step 10a, which comes before step 11), and a token only raises the rate
limit. `fetch-art` still sends `ART_REPO_TOKEN` when CI passes it; that is
defence in depth, not a boundary (section 2).

| # | step | ships | what still works |
|---|---|---|---|
| 1 | **This plan** (docs only; ART-REPO-PLAN edited to agree). | — | everything |
| 2 | **Pack format + schema 2, from the trees here.** `tools/asset-pack.mjs` writes `objects/` + `packs/` (JSON + `.js` twins + the font sidecar, sorted, byte-stable across OSes) from `assets-mobile/`, `assets/`, the fonts, `OFL.txt`, `music/` and `map-detail/`. `art-manifest.json` schema 2: the font migration, the new `common` ids and `licenses/OFL.txt`. Tests: `asset-pack.test.mjs` (determinism, a planted wrong hash, a planted stray, a twin that does not match). Not used by the game yet. | a tool and a test | every edition, unchanged |
| 3a | **Loader and images, in the web edition only.** `src/ui/assetPacks.js`, `setBuiltInSource`, the `ASSET_PACKS` stamp and the tier fallback. `bundle.mjs --external-art` emits packs instead of copying trees; `verify-external` is rewritten; `.gitignore` gains `packs/` and `objects/`. The single files are untouched: the loader does nothing when `ASSET_MAP` is filled. | `build/web`, dev-preview `preview/` | the single files; the web edition, now pinned |
| 3b | **`ASSET_CSS`.** Fonts, backdrops, and the masks inline. | the web edition's CSS through the index | all |
| 3c | **Music and tiles through the index.** The `mapDetail.js` `load()` rewrite; `audio.js` reads the common index. | — | all |
| 4 | **`file://` for the pack shape.** The `.js` twins, the font sidecar, tiles as `Image` loads, the synth under `file://`, and `external-play --file`. | the web edition opens by double-click | all |
| 5 | **Loading UX and fallbacks.** Progress on the startup gate, the critical set in `content/config`, the Retry notice, placeholders on a failed load, and tests that block the index and that remove the high index. Also **the window before the load settles** (step 3a): a pack build draws nothing but a static "Loading art…" line until its indexes load or fail (up to `BOOT_WAIT_MS`, 8 s), so step 5 moves that wait behind the startup gate, takes the line's wording from `content/config`, and adds the Retry that reloads the indexes and redraws. | player-visible boot line | all |
| 6a | **Pages base tree.** `pages-site` excludes `art/`, `assets-mobile/`, `map-detail/`, `music/` and the committed build HTML from main's base tree; `assets/` stays (owner, 2026-10-02) and so does `docs/preview` (owner answer 7); the stable links get `map-detail/` and `music/` beside each location; `og:image` moves to a Pages path; `--check` prints the site's size. | a smaller site | every build, as it was |
| 6b | **Pages store + service worker, and the Download kept whole.** `pages-site` publishes pack-shaped builds with `/objects`, `/packs`, `asset-base.json` for every page kind (section 4) and `/AshenSpire/sw.js` (Range/`206` for audio, kill-switch). The **light single file is built and published at a separate path**, `/<branch>/<ordinal>/download/AshenSpire.html`, and stays there (owner answer 3): the build list's *Download* and `offlineDownload.js` point there, so no download is a 9.5 MB HTML with no art. This step picks whether every kept build or only each branch's latest carries it (section 4). "Make available offline" arrives on Download & saves. This is the first time hosted players get the pack shape. That is intended, because D5 already accepted a Pages web edition. | hosted offline | older builds as they were; the light single-file download |
| 7 | **In-game zip download.** Added beside the light single-file download in `offlineDownload.js`, with new `offlinePlay.js` instructions and `offline-play-qa` on the zip. The `download/` light single file stays. | desktop offline copy | both downloads |
| 8a | **SPEC + FINISH PR** (section 6's sign-off rows, D5). Owner review there (owner answer 5). | text | — |
| 8c | **Art quality Auto / Light / High** in the web edition, with Auto's tier detection. Does not depend on the flip. | a player-facing setting | all |
| 8d | **`tools/browser.mjs` serve-`dist/` helper, and the ~40 `--dist` tools** flipped to it where they need `fetch`. **Built:** 30 tools flipped; the others already served over http (section 6). | — | all |
| 8e | **The flip.** `launch.mjs` builds the pack shape and the light single file; `--light`/`--full-art` choose the default tier and which packs to carry; `--mobile` and the full-art single file are removed, and inline mode stays only for the light single file at `download/` (owner answers 2, 3, 6); the `EDITION` stamp becomes the default tier; `verify-shipped` A stays for the light single file and the mobile checks are retired; `bundle.test`, `web-meta`, `mobile-art-distinct` and `buildversion-selftest` follow; `/AshenSpire-mobile.html` redirects; README, `dist/README`, DEVELOPER, CREDITS, ARCHITECTURE-MAP and CLAUDE follow. Needs 8a approved. | one HTML, ~9.5 MB, and the ~30 MB light single file | every door: the light single file, double-click `dist/`, hosted, installed |
| 9 | **Art repo PR.** Import the light tier generator (`mobile-art.mjs`, `mobileart-policy.mjs`) and generate `light/assets/` from `hd/assets/`; add `common/` (fonts, `OFL.txt`, music, tiles) with the score and tile tools; the pack script writes three zips and the schema-2 manifest; CI verifies each zip against the manifest. | — | this repo unchanged |
| 10 | **Owner: merge step 9.** Releases are automatic (AshenSpire-art#2), so the merge publishes `hd-assets-v<N>` with three zips. | — | — |
| 10a | **Owner: make `cehinds/AshenSpire-art` public** in its GitHub settings (owner answer 1). **Done 2026-10-02**, before step 11 landed. | — | — |
| 11 | **Pin and fetch.** `art-release.json` schema 2; `fetch-art --pack`; `asset-pack.mjs` reads the cache (`--source cache`); the pin and manifest join `BUILD_IDENTITY_FILES`; every building workflow (dev-preview, tests, ci, pages-builds) fetches. They fetch the public release, every run including pull requests, and run `--agree`. Only a push or dispatch of a protected branch (dev, test, release, main) also gets the `ART_REPO_TOKEN` secret, which only raises the rate limit; that rule is defence in depth, not a security boundary (section 2: the owner's real fix is to delete the secret or move it into a GitHub Environment limited to those branches). `fetch-art` sends `ART_REPO_TOKEN` (else `GITHUB_TOKEN`) whenever one is set, and uses the public release URL with none or when the token cannot read the repository (it no longer refuses without a token; README.md and DEVELOPER.md follow). A failure names its cause. Needs step 10a (done 2026-10-02). The trees here are still present, and `fetch-art --agree` proves the cache and the trees agree byte for byte. | builds can read the release | all, with either source |
| 12 | **Switch every reader** of `assets-mobile/`, `music/`, `map-detail/` and `assets/fonts/` to the manifest or the cache (section 6; ART-REPO-PLAN step 4's rows, extended). The PR records `git grep` output for each tree. | — | all |
| 13 | **Delete** `assets-mobile/`, the MP3s, `map-detail/` and `assets/fonts/` from `dev` and add them to `.gitignore`, together with ART-REPO-PLAN step 6 for `assets/` and `art/`. **Needs its own owner go-ahead** (ART-REPO-PLAN Q3). Precondition: step 12's grep finds only fetch-aware code. History is untouched. | a smaller tree | all |

Steps 2–8e need no token and no art-repo change, so they can start now (step
8e also needs 8a). ART-REPO-PLAN step 5 (the `art/` readers) is
independent of all of them.

### Step 3a as built

Where the build differs from, or settles, the text above (2026-10-02):

- **CSS `url()`s name objects directly** until step 3b. `bundle.mjs
  --external-art` rewrites each one to the default tier's object (the common
  pack's for a font), relative to the HTML, instead of to a copied `assets/`
  tree. The rules stay in the inlined `<style>`; `verify-external` D checks
  that each `url()` names an object a pinned index lists. **This bypasses the
  loader** (review of #1443), and two later steps must close it:
  - **3b:** the CSS-named ids move into the `ASSET_CSS` template, filled from
    the index the loader actually used, so a high-default build whose high
    index failed shows light backdrops and fonts instead of 404ing high
    objects, and a failed load leaves the CSS on its fallbacks. Done: see
    [Step 3b as built](#step-3b-as-built).
  - **6b:** CSS urls are relative to the HTML, not to `asset-base.json`'s
    base. On a Pages page at depth 1 or 2 they would miss the shared store, so
    pack-shaped builds must not be published there before 3b fills the
    template from the base. Met by 3b: the slots are filled from the loader's
    map, whose object paths are built on `asset-base.json`'s base.
- **`map-detail/` and `music/` were still copied** beside the HTML until step
  3c read them through the common index, so a 3a web edition carried those
  bytes twice (as copies and as common objects, about 32 MB). Done: see
  [Step 3c as built](#step-3c-as-built).
- **The first screen waits for the index**, behind a static "Loading art…"
  line (pack builds only). `src/main.js` draws its first
  screen through `whenBuiltInArtReady()`: at once when nothing is pinned (the
  single files, the source tree), else once the load has settled. It settles
  by `BOOT_WAIT_MS` (8 s) at the latest: a load still running then is aborted
  and counts as failed, and an index that arrives later is dropped. A screen
  drawn on placeholders cannot be re-pointed, because the images' error
  handlers clear or replace the nodes that named the asset id (`enemySprite`,
  `pieceArt`), so the source is final before anything draws (review of #1443).
  Retry is step 5. The shipped music folder is applied after that first
  screen, so a `?shot=` boot that walks through two screens does not start and
  abort a track. Screens drawn later re-point on a source change as before
  (`builtInArtArrived` in `highResArt.js`).
- **Over http(s) only.** Under `file://` the loader loads nothing and the web
  edition shows placeholders (the `.js` twins are step 4). The single files are
  unaffected. Done: see [Step 4 as built](#step-4-as-built).
- **`asset-base.json` is written by the bundler** beside every web-edition
  HTML (`{"base":"./"}`), so the loader's first request is never a 404; the
  loader accepts only a plain relative folder from it.
- **The build stops on a stale manifest.** The packs are written from
  `art-manifest.json`, and `asset-pack` refuses when a tree's file does not
  match its record; before, the web edition copied whatever the tree held.
- **dev-preview copies `build/web` (which `launch.mjs` already built) into
  `preview/`**, because `asset-pack` writes `packs/` and `objects/` only under
  `build/` or `dist/`. The pages that read `assets/` by path (the source-module
  previews, the pose studio, the art inspection pages, `docs/preview`) moved
  into `preview/workbench/` with the tier's art tree, until step 12, so the
  game in `preview/` has no `assets/` beside it to fall back on.
- **No stalled request defeats the fallback** (review of #1443). The common
  index is fetched in parallel with the art tiers and only ever adds to a
  verified art map; high gets half the deadline before light is tried;
  `asset-base.json` gets a quarter, then `./` is assumed.
- **The music hold applies to pack builds only**; a single file applies the
  music folder before its first screen, as before.
- **`.gitignore`** already carried `build/**/packs/`, `build/**/objects/`,
  `dist/**/packs/` and `dist/**/objects/` from step 2, so 3a adds nothing there.
- **`assetsAreInlined()` has no callers** on dev, so nothing switched to
  `builtInSource()`; both are exported.
- A pre-pack `assets/` tree left in `build/web` (or any output under `build/`
  or `dist/`) by an earlier build is removed, so it cannot serve an id the index
  lacks.
- `external-play` now also requires every screen to have loaded the pinned
  tier (`<html data-built-in-art>`) and its images to come from `objects/`.

### Step 3b as built

Where the build differs from, or settles, §3.7 (2026-10-02):

- **The backdrop rules stay where they are; only their `url()` moves.**
  §3.7 says every rule that names an asset moves into the template. Moved into
  a later `<style>`, a rule would win where it lost before: `.startup-gate`
  names `title-city-tower` and is restated as `background: #100e0b` further
  down `kit.css`, so the moved rule would bring that backdrop back. Instead
  `tools/asset-css.mjs` rewrites each backdrop `url()` in place to
  `var(--as-css-<id>, none)`, and the template carries one rule per id,
  `:root{--as-css-<id>:url("{{id}}")}`. Every selector keeps its place in the
  cascade; an unset variable falls back to `none`, which is what a backdrop
  that never loaded showed anyway, and a gradient layer beside it stays. Only
  `background` and `background-image` may carry such a `url()`; anywhere
  else, where `none` would change the declaration's meaning, the build stops.
- **The 15 "AS Lore" `@font-face` rules move whole** into the template (no two
  name the same face, so their order is free), with `{{assets/fonts/…}}` slots
  the common index fills.
- **The two SVG masks stay inline as `data:` in the inlined `<style>`**, not
  in the template: inlined from the default tier's object, as the single file
  inlines them. They then never depend on the load (a mask loads in CORS mode,
  §3.7), and nothing about them changes when the load fails.
- **`ASSET_CSS` is stamped into `src/ui/assetPacks.js`** beside `ASSET_PACKS`
  (`{"schema":1,"rules":[…]}`, one line of JSON; `null` in the single files
  and the source tree), so the bundler computes the CSS in section 2b, before
  the modules are transformed.
- **The loader fills the slots from the map it handed `setBuiltInSource`**:
  the tier that loaded plus common. A high-default build whose high index
  failed gets light backdrops; a rule whose id that map lacks (a face, when
  the common index failed) is left out on its own and reported in the load's
  `failed` list; a failed load injects nothing. Object paths are made absolute
  against the page before injection, so a `url()` read through a custom
  property cannot resolve against anything else. The rules go into one
  `<style data-asset-css>` at the end of `<head>`.
- **The bundler refuses a slot that a tier could not fill**: each id must be
  in the common index or in every art tier the build carries.
- **`verify-external` D** now checks that no inlined stylesheet names a file by
  `url()` (only the SVG masks, as `data:`), that `ASSET_CSS` is present, that
  every slot names an id the common index or every pinned art tier lists, and
  that the `--as-css-…` variables read and defined agree. Its selftest plants
  a direct object `url()`, an unlisted slot, an undefined variable and a missing
  template (16 plants).
- **`external-play`** also mounts the cold-boot startup gate (four screens),
  and checks on each that every CSS background is an object of the loaded tier
  (or common) that decodes, every mask is an inline SVG, the template is in the
  page with no unfilled slot, and the 15 lore faces load; across the screens,
  that every object requested belongs to the loaded tier or common and every
  font came from common. `--expect-tier light` runs it on a high-default build
  whose high index was removed (the removed index's 404 is the plant, not a
  finding). `dev-preview.yml`'s browser-gates job runs that pass on every push
  to `test`, `release` and `main`: it builds a high-default web edition when
  the job's own build is light, hard-link copies it, deletes the pinned high
  index and its twin, and runs `external-play --expect-tier light`.
- **The act backdrops** (`.backdrop.act-N`, `bg_act1`–`3`) are slotted like the
  rest, but nothing on dev draws them (`backdropClass()` has no caller), so no
  browser check sees them load.
- The source tree and the light single file are unchanged: the single file's
  `ASSET_MAP` and inlined `<style>`s hash the same as dev's, and its
  `ASSET_CSS` is `null`. SPEC §2's status row (the CSS bypass) still holds for
  them and is left to step 8a.

### Step 3c as built

Where the build differs from, or settles, §3.8 and §3.9 (2026-10-02):

- **Tiles.** `mapDetail.js` names each tile by its id, `tileId(hash, key)` =
  `map-detail/<hash>/<edge>/<x>-<y>.webp`, and resolves it with `assetUrl()`.
  `load()` is now an `Image` load of that URL, awaited with `decode()`: no
  `fetch`, no `blob:` URL, nothing to revoke. A tile still loading when the map
  is disposed has its `src` dropped, which stops the request (the old
  `AbortController`). The `file://` guard stays: under `file://` the map
  requests nothing and keeps its low-detail fallback until step 4 lifts it.
  Done: see [Step 4 as built](#step-4-as-built).
- **Music.** For the shipped score only (the Custom music folder blank),
  `configureMusic` in `audio.js` passes the manifest path and every relative
  track path through `assetUrl()`; `SHIPPED_MUSIC_FOLDER` (`music`) is the id
  prefix (`music/manifest.json`, `music/<context>/<track>.mp3`). `main.js`
  says which with `indexed`. A folder the player typed is always fetched by
  its literal path, even one spelled `music/` (music/README.md's own example;
  review of #1454). A single file and the source tree pass through unchanged,
  and an absolute URL is left alone. Paths are resolved when the folder is
  applied, so when the boot load failed (no source, the synth plays) and a
  later Art quality switch loads, `musicHold().sourceArrived()` applies the
  shipped score again through the new source. "Missed" means the source did
  not list `music/manifest.json` (`shippedScoreResolves`), which also covers
  a boot whose art loaded and whose common index did not.
- **Tiles retry on a source change.** A mounted detail layer listens for
  `ART_SOURCE_EVENT` (`highResArt.js`, sent after `builtInArtArrived`); it
  forgets its failed tiles and requests the visible set again, so a switch
  that brings the common index draws the tiles a failed one could not. A load
  still in flight when the source changes belongs to the old source (a
  generation counter): its failure is not recorded, and the tile is asked for
  again once it ends.
- **SPEC §7.4** still describes "the `music/` beside the page"; that wording is
  left to step 8a (section 6, *Written rules*), as 3b left SPEC §2's status
  row. The web edition reaches players only at step 6b.
- **A tier switch keeps common.** Each load fetches the common index again;
  when that fetch fails or misses its deadline on a switch, the entries the
  earlier load verified (same pin, same base) are kept, so tiles, fonts and the
  score do not fall back to bare paths for the rest of the session. `main.js`
  still applies the folder only when served over http(s), so `file://` keeps
  the synth (§3.9, unchanged).
- **Only with an art index.** The common ids reach `assetUrl()` through the map
  the loader sets, and the loader sets none when no art index loads (3a: "the
  common pack alone does not make a source"). That was kept: a build whose art
  failed shows placeholders, the synth score and the low-detail map, which is
  what a missing track or tile already gave. Making common usable on its own
  was left to step 5's failure handling, which **kept** it (see
  [Step 5 as built](#step-5-as-built)): a Retry that loads brings the score
  and the tiles back with the art.
- **The single files and the source tree are unchanged.** Their `ASSET_MAP`
  is empty of music and tiles, so the ids pass through as the paths of the
  `music/` and `map-detail/` folders `launch.mjs` still writes beside
  `build/` and `dist/` (and `pages-site` beside each build); the light single
  file's `ASSET_MAP` and inlined `<style>`s hash the same as dev's, and its
  `ASSET_PACKS` and `ASSET_CSS` stay `null`.
- **The web edition stops carrying the copies.** `bundle.mjs --external-art`
  no longer copies `map-detail/` or `music/` beside the HTML, and removes a
  copy an earlier build left there (under `build/` or `dist/` only, as for the
  retired `assets/` tree), because a copy would quietly serve a tile or a
  track the index misses. Only a folder strictly inside `build/` or `dist/`
  counts (`strictlyUnderBuild` in `tools/asset-pack.mjs`): `--out build` or
  `--out dist` themselves keep the `music/` and `map-detail/` the single files
  read. The summary counts the tiles and score files the
  common index lists instead.
- **`verify-external` E**: the common index lists `music/manifest.json`, every
  track that manifest (read from its object) names, and every tile the map can
  ask for (each `MAP_ART` source, each level, the whole painting, through the
  page's own `tileId()` and `visibleTiles()`); and no `map-detail/` or `music/`
  folder sits beside the HTML. Five new plants (21 in all); the three that
  drop an id from the common index re-pin it, and must be caught by E's own
  finding, not by C's.
- **`external-play`** runs Chromium with autoplay allowed (output muted, as
  every browser tool is), so the title's track is fetched without a gesture.
  It requires: the map screen's detail layer to reach `ready` with each tile a
  common `map-detail/` object that decodes; `music/manifest.json` and at least
  one track requested as common objects, each track decoding with
  `decodeAudioData`; and no request for a bare `music/` or `map-detail/` path.
  With the audio context running, every SFX cue also probes
  `assets/sfx/<id>.ogg` (the filename convention; no build ships one), so a
  404 on that bare path is filtered by name, as `/api/lan/` already was, and
  only for an id that is an `SFX_RECIPES` key with no `SFX_MANIFEST` entry.
  Against the 3b runtime with this step's build (no copies) it is red on the
  bare requests, the missing manifest and the missing track.

### Step 4 as built

Where the build settles §3.2, §3.8–§3.10 for `file://` (2026-10-02):

- **The indexes.** Under `file://`, `loadBuiltInPacks` reads each pinned index
  from its `.js` twin (`loadTwinIndex`), one classic `<script>` per twin,
  removed once it has run. The twin calls `window.__ashenPack(name, text)`;
  the loader keeps a call only while it is waiting for that name, and only
  the first one: a call nobody is waiting for, or one that arrives after the
  reader gave up, is dropped. It hashes **the string** (as UTF-8) against the
  index's pin and only then parses it, so a twin that does not match is
  dropped unparsed and the tier fallback applies exactly as for a `.json` that
  fails its pin.
- **What the pin covers.** The pin covers the **data** a twin hands over, not
  the **code** the twin runs: a `<script>` from the build's folder executes
  before its argument can be checked, with the same trust as the HTML beside
  it (§3.2). The pin catches a wrong or stale twin, not a hostile one. The two
  hooks, `window.__ashenPack` and `window.__ashenFonts`, are installed when the
  first twin is asked for and **stay installed** for the page's life, because a
  later tier switch reads twins too; outside a wait they keep nothing. A twin that is missing, or never calls its hook,
  is a failed index. The deadlines, the high sub-budget, the parallel common
  load and `keepOnFail` are the http(s) ones.
- **The base is `./`.** A `file://` page cannot fetch `asset-base.json`, and
  is always the build's own folder (the bundler's `build/web`, `dist/`, or the
  unpacked zip of step 7), so the loader does not read it there.
- **The faces.** Once the common index is verified, the font sidecar is read
  the same way (`__ashenFonts`), its text checked against `ASSET_PACKS.fonts`,
  and each face it carries must be one an `ASSET_CSS` `@font-face` rule
  declares, listed by the verified common map, and decode to bytes that hash
  to that common record. Each that passes becomes a `FontFace` whose family
  and descriptors are read from that same rule (`fontFaceRules`, comments
  stripped, every standard descriptor in `FACE_DESCRIPTORS`; `verify-external`
  D refuses a rule carrying one it does not map), added to
  `document.fonts`; the `@font-face` rules themselves are left out of the
  injected `<style data-asset-css>` under `file://` (Chrome refuses their
  url() loads). A tier switch never adds the same faces twice. The faces are
  loaded first and added together, and nothing is added (nor the faces cache
  written) once the deadline has aborted the load or the player has replaced
  the switch it belongs to (`stillWanted`); `stillWanted` is checked again
  after the sidecar, before anything is published (review of #1461). A sidecar off
  its pin, or a face off its record, leaves that face on the system fallback
  and is reported in the load's `failed` list; the art still loads.
- **The backdrops** need nothing new: `ASSET_CSS` fills each slot with the
  object path made absolute against the page, and a `file:` background is a
  plain image load. **The masks** stay inline (step 3b), so the entrance hall
  keeps its door under `file://`.
- **The map tiles** (`mapDetail.js`) are requested under `file://` when the
  built-in source lists the tile id (`tileReachable`), as `Image` loads of its
  object. A single file under `file://` has no index, so it asks for nothing
  and keeps its low-detail fallback, as before; a tile the index lacks counts
  as failed, as a 404 would, so the listed ones still draw.
- **The score stays synthesized** under `file://` (§3.9, SPEC §7.4):
  `main.js` still applies the shipped folder only over http(s). Nothing else
  changed for audio.
- **Not changed:** `tools/browser.mjs` `buildPageUrl` still serves a
  pack-shaped build over http for the measuring tools (step 8d's choice: the
  loader's primary path, and the score); `ASHEN_BUILD_OVER=file` puts them on
  the double-click door. A sprite whose bounds are read from its pixels
  (`combatSpriteGeometry.js`) cannot read a `file:` image (a tainted canvas),
  so under `file://` it keeps its box geometry, as its own fallback already
  does.
- **`external-play --file`** opens the build by its `file://` URL, with no
  server and no flag that loosens Chrome's `file://` rules, and runs the same
  seven screens. It also requires that no `.json` index and no font object was
  asked for, that the art and common twins and the font sidecar were loaded,
  that the 15 lore faces loaded, and that no music object or `music/` path was
  asked for. Two non-findings are filtered by name: the SFX convention probe
  (`fetch` refuses a `file:` url, as it always has for the single file) and the
  launcher's `/api/lan/`. `dev-preview.yml`'s browser-gates job runs it on the
  web edition and on the high-default build with its high twin removed
  (`--expect-tier light`). Against dev's runtime it is red (built-in art
  `failed`, no ASSET_CSS, no faces, bare `assets/` images).

### Step 5 as built

Where the build settles §3 (*The loading screen*, *Failure and fallback*) and
the step 3a boot wait (2026-10-02):

- **The gate is drawn at once, and the wait moved behind it.** In a pack
  build, the cold boot (no `?shot=` state, or `?shot=startup`) draws the
  startup gate before the load has settled (`gateFirst` in `src/main.js`): the
  gate shows no pack art through an `<img>`, and its backdrops are `ASSET_CSS`,
  which arrive with the load. A press during the load runs the reveal, and the
  title is drawn only once the load has settled (`afterBootArt`), by
  `BOOT_WAIT_MS` (8 s) at the latest, as 3a required (a screen drawn on
  placeholders cannot be re-pointed). Every other first screen (a `?shot=`
  state) still waits behind the static boot line. The music hold is released
  when the load settles, either way. A single file and the source tree settle
  at once and are unchanged.
- **The line is not part of the gate.** One polite, `aria-busy` status line
  (`boot-art-status`, `src/ui/components/bootArtStatus.js`, its words from
  `src/ui/bootArt.js`): "Loading art…" while the indexes load, "Loading art ·
  n of N" while the critical set warms, nothing once it is done, and the
  failure sentence when the load failed. It is its own component, mounted by
  `showStartupGate` as a **sibling** of the gate in `#app`, laid over the
  gate's top edge and taking no input (a press on it is a press on the gate):
  the gate's model, children and markup are unchanged, so SPEC §7.1's
  "contains only" still holds, and the live region is not inside the gate's
  `role="button"`, where assistive tech would treat it as presentational
  (review of #1471). It stays through the reveal while a late load settles,
  and is replaced with the rest of `#app` by the title. It pulses unless
  Reduced motion is on (`.reduced-motion` or `prefers-reduced-motion`), where
  it is plain text.
- **The critical set** is `presentation.startupGate.components.artLoading.critical`
  in `content/config`: the 15 faces and the five backdrops the gate and the
  title's hall draw. An entry may carry `orientation` (`portrait` or
  `landscape`): the entrance hall and its phone cut are swapped by kit.css's
  `@media (orientation: portrait)`, so a screen warms only the one its CSS
  asks for, and "n of N" counts only those (19 either way; review of #1471).
  `title-city-tower` is not in it: the gate's later `background: #100e0b`
  covers it, so nothing shows it. `behavior.artLoading.criticalWaitMs` (20 s)
  caps how long the line counts. Each id the published map lists is warmed
  once: an image is loaded, a face
  over http(s) is fetched by the same url its `@font-face` names; under
  `file://` the faces are already `FontFace` objects from the sidecar and
  count at once. Nothing waits for it.
- **The wording is in `content/source/uiStrings.csv`** (`art.loading`,
  `art.progress`, `art.failed.*` including Settings' `art.failed.settings`,
  `art.retry`), not in `content/config` as
  the step's row says: every sentence the interface says is a row of that
  table (DEVELOPER.md, *Reword the interface*), and `content/config` holds
  layout numbers and options. `content/config` holds the critical set and its
  cap. The 3a boot line (`bootLine`) reads `art.loading` too.
- **The Retry notice** (`art-load-notice`, `src/ui/components/artLoadNotice.js`)
  is drawn on the title, not on the gate: the gate consumes Enter, Space and
  every click as its one first press (SPEC §7.1), so a control on it could not
  be reached by keyboard or controller. It is a non-blocking panel inside the
  title (in `#app`, so the controller cursor reaches it), redrawn with each
  title render through `mountTitle`'s `artNotice`; its message is a polite
  live region, ONE node per title root whose text is rewritten in place (a
  state not yet announced is written just after the node appears, so it is
  announced); the notice is the title root's FIRST child, so reading, Tab and
  cursor order meet it before the menu, as it is drawn at the top. Retry is
  `aria-disabled` while it runs (a disabled control would drop the focus on
  it), and a Retry that fails again keeps focus on it. Settings → Art quality
  offers the same Retry beside its line when the load has failed (the line no
  longer says to reload the page), also `aria-disabled` while it runs; when it
  loads, its button hides and the focus moves to the row's live line
  (`tabindex="-1"`). A Retry the player replaces with a tier switch is not a
  failure: the notice goes back to what it said (review of #1471).
  The debug failure banner stays quiet: a failed load only warns.
- **Retry** (`retryBuiltInArt` in `src/ui/artTier.js`) loads the tier the
  setting asks for through the same queue as a tier switch, so the 8c rules
  hold: it supersedes a switch still waiting, a switch made after it
  supersedes it (`stillWanted`; the newer round also aborts the requests of
  the load in flight through its `signal`, so a Retry stalled on its 60 s
  deadline settles as superseded at once and the switch starts; review of
  #1471), and it keeps the art on screen when it fails
  (`keepOnFail`). A map that loads goes through `onTierArrived`: the images on
  screen are re-pointed, the shipped score is applied again (3c's
  `musicHold().sourceArrived()`), `ART_SOURCE_EVENT` makes the map tiles ask
  again, and the title, when it is on screen, is drawn again on the new art
  (`artArrivedAfterFailure`) — once nothing is open over it (Settings, the
  Load/New door: `whenNoOverlay`), so the control a dialog returns focus to is
  not replaced under it, and the focused title control keeps the focus. On
  any other screen (a Retry from the in-run Settings) the same moment sends
  `ART_REDRAW_EVENT` (`highResArt.js`): re-pointing cannot reach an enemy an
  error handler already swapped for its placeholder, so combat forgets its
  cached figures and draws the board again from its own state, keeping the
  combat, the hand and the turn (review of #1471; `external-play
  --block-index` checks the enemies become images). **Every placeholder
  comes back, whatever screen it is on:** each place that swaps a failed
  image for a glyph or a placeholder, or hides it, marks the node standing in
  for the art (`data-art-placeholder`, `src/ui/artFallback.js`:
  `swapOnError`, `hideOnError`, or `markArtPlaceholder` with the site's own
  builder for `enemySprite`, `classSprite` and `relicIcon`), and main.js runs
  `restoreArtPlaceholders()` once at that moment, before the screen redraw.
  That covers the dialogue portraits, co-op enemies, the Armoury, the smith
  and the compendium with no per-screen listener; a census test refuses an
  image error handler that swaps or removes art without marking it.
  `external-play --block-index` checks combat and a dialogue. Screens that
  only flag a missing image (the map's plate) are re-pointed as before.
  Combat's own redraw waits until no animation or resolving card owns the
  board (`busy`), and puts the focus back on the same combatant; a hidden
  image that re-pointing already loaded is shown at once by its restore; a
  swap made before the image was attached is still marked; and the notice's
  state counts as announced only once its words land (review 5394761200).
  `tests/art-restore.test.mjs` restores `relicIcon`, `classSprite` and
  `enemySprite` in a small fake DOM, and `--block-index` checks that combat's
  frames are rebuilt with the focus kept and that the relic icon returns.
  **A Retry has its own deadline**, `behavior.artLoading.retryWaitMs` (60 s,
  `RETRY_WAIT_MS`), not the boot's 8 s: nothing waits on a Retry, and a link
  too slow to bring the ~790 KB light index in 8 s failed every Retry the same
  way before (review of #1471; `tests/boot-art.test.mjs` loads an index slower
  than `BOOT_WAIT_MS` on Retry). Under `file://` it reads the `.js` twins (step
  4). While it runs the loader's state is `loading`, so the offline panel
  (6b) says the page is still loading, and offers the keep once it has loaded.
- **The common pack alone still does not make a source** (the question 3c
  left here). When every art index fails, a verified common index is not
  published on its own. The likeliest way to get there is a slow link: the
  19 KB common index arrives inside the boot's 8 s and the ~790 KB light index
  does not. That case is now answered by the Retry, which has 60 s and so
  brings the art index, and with it the score and the tiles, on the same
  link; publishing common alone would give that player fonts, music and tiles
  over placeholders for a few seconds more, at the cost of a half state
  (fonts, score and tiles but no art) that every reader of the loader's status
  (the tier row, the offline keep, `data-built-in-art`, the gates, the Retry
  offer) would have to learn, and a second "loaded" that is not. The other way
  there, an art index that fails its pin, is a broken build that no fallback
  repairs. So the failure stays one state with one Retry.
- **No per-file high → light fallback.** The light index is not loaded beside
  a high one (a second ~700 KB index on every high boot), so a high object that
  fails falls to its element's own placeholder recipe, as any missing file
  does (§3, *Failure and fallback*, "otherwise to the placeholder recipe").
- **SPEC §7.1** says the gate "contains only" the wordmark, the ash, the
  prompt and the build stamp. Step 5 does not change SPEC (CONTRIBUTING rule
  1): the status line stays outside the gate. Whether SPEC should mention the
  boot status, the title's wait for the load and the art notice belongs with
  the 8a SPEC PR ([#1440](https://github.com/cehinds/AshenSpire/pull/1440),
  awaiting owner approval; section 6, *Written rules*).
- **The debug profile auto-load** (Settings → Advanced → Defaults & sync, on
  a dev or test page) used to make the cold boot wait up to 3 s before the
  gate; with the gate drawn at once that wait was a blank screen (review of
  #1471). In a pack build the gate is now drawn at once and the title waits
  for the profile as well as the art (`holdTitleFor`); elsewhere it is as
  before.
- **Follow-up (not in this step):** run `tools/startup-gate.mjs` against
  `build/web` with the indexes held, so the gate's focus and first-press
  checks cover the wait between a press and the title (today it serves the
  source tree, which pins no packs; review of #1471). Whether SPEC §7.1 should
  bound or describe that wait is on the #1440 question list.
- **`external-play --block-index`** (http only; Chromium cannot intercept a
  `file://` twin): every `packs/` request is held on the cold boot, and the
  gate must be drawn before the load settles with its line saying "Loading
  art…" as a polite, busy live region; a press must not draw the title before
  the load fails; the title must then carry the notice with Retry, put no pack
  art in the page, and raise no failure banner; with the block lifted, Retry
  must load the pinned tier and redraw the title (`ASSET_CSS` in, notice
  gone); with the index refused, combat and the map must mount on placeholders
  with no object image. The cold boot runs with the debug profile auto-load on
  and its GitHub request held, and the gate must be drawn within 2.5 s of
  that request (it was 3 s late before the fix). Against the 3a boot (the
  gate drawn after the load, no notice) it is red on ten findings; with the
  profile branch planted back, on that one. `dev-preview.yml`'s browser-gates job
  runs it on the web edition. The remove-high pass is 3b's
  `--expect-tier light`, unchanged; `tests/boot-art.test.mjs` covers both at
  the loader, the critical set, the line, the warm-up and the Retry.

### Step 8c as built

Where the build settles the text above (2026-10-02):

- **The choices** are *Auto*, *Light*, *High* and *Local high-res*
  (`src/ui/highResArt.js` `ART_QUALITY_CHOICES`); the default is *Auto*. The
  one choice before, *Built-in*, is read as *Auto* (`legacyChoices` on the row,
  and `artQualityChoice()`), so a stored value keeps working and imports.
- **Auto** (`src/ui/artTier.js` `autoTier`) asks for light when the build's
  default is high and any of these holds: `navigator.connection.saveData`, the
  layout is narrow (`<html data-layout="narrow">`, written by `applyUiScale`
  before the boot load starts), the screen's short side is at most
  `SMALL_SCREEN_PX` (600 CSS px, so a phone booted in landscape counts: Safari
  and Firefox report no `deviceMemory`), or `navigator.deviceMemory` is at or
  under `LOW_MEMORY_GB` (2). A coarse pointer alone was not used, because it
  would also send tablets and touch laptops to light. Otherwise it asks for the default. A light-default build
  always asks for light. *Local high-res* lays its folder over Auto's tier,
  unchanged otherwise.
- **When it applies.** The boot load asks for the setting's tier
  (`loadBuiltInPacks({ tier })`; with no tier it is still the build's
  default). A change in play **reloads the indexes at once** (`applyArtTier`,
  called from `applyDisplaySettings`): the new map goes through
  `builtInArtArrived`, which re-points the images on screen. A switch that
  cannot load anything keeps the art already shown (`keepOnFail`) and records
  the tier it asked for, so the row says that one failed. Quick switches run
  one at a time, only the latest, and a load the player has replaced while it
  was in flight publishes nothing (`stillWanted`). Auto is decided at boot and
  when it is chosen, in the queued job, so a batch that sets Auto and a new
  layout together reads the new layout; a window resized later does not swap
  the art.
- **The fallback is the loader's**: High on a build that pins no high pack, or
  whose high index fails, shows light; the row's live line says which tier is
  on screen and why (`tierStatus`, `aria-live="polite"`).
- **A single file and the source tree** pin no packs, so *Light* and *High* are
  shown **disabled** (the row's new `choiceDisabled`, honoured by the choice
  renderer for `<option>`s and segment buttons; `settings-choice-row` in the
  component catalogs) and the live line says the file
  carries its art inside it. A stored *Light* or *High* is kept, not
  rewritten, so the same choice still applies in the web edition on the same
  origin.
- **`external-play`** now expects Auto's tier for each window: its
  phone screens must load light (Auto on a narrow layout), and three more
  passes, the startup gate, combat and the map on a 1280×800 desktop window, must load the tier the build
  pins, so a high build is checked at both tiers. Each pass also sets the
  emulated screen size: a headless browser's own screen is 800×600, whose
  short side would read as a small screen.
- **The CSS follows a switch** (step 3b): a switch in play goes through
  `loadBuiltInPacks`, which fills `ASSET_CSS` from the map it publishes and
  replaces the one `<style data-asset-css>`, so *Light* on a high-default
  build swaps the backdrops too, and fonts stay on common. A switch that fails
  or is superseded publishes nothing and leaves the CSS as it was.
- **`external-play` with 3b**: the phone screens (the startup gate among them)
  check light objects and CSS, the desktop screens the build's tier, or the
  one `--expect-tier` names; each screen's requested objects (its own
  requests, by the navigation's `loaderId`, with the cache off) are checked
  against that screen's tier. `--plant desktop-light` gives the desktop
  screens a phone-sized screen, so Auto loads light there, and the run must
  go RED.

### Step 6b as built

Where the build differs from, or settles, §4 and §5 A (2026-10-02):

- **Which builds are pack-shaped.** `pages-site` serves a build as the web
  edition when its commit's rebuild writes a pack-shaped `build/web/`
  (`ASSET_PACKS` pinned, so every dev build from step 3a on). That HTML is the
  page at `/<branch>/<ordinal>/`, byte-proven against the rebuild and its
  source digest like the single file was; its indexes, twins, font sidecar and
  objects are merged into the one store at the site root (`/packs/`,
  `/objects/`), only what its pin names, so a stale object beside a build is
  never published. Two builds that disagree about one index name stop the run.
  Committed (older) builds, and rebuilds of commits before step 3a, keep their
  inline shape and their `mobile/` folder (`tools/pages-store.mjs`).
- **`asset-base.json` for every page kind**: `{"base":"../../"}` beside each
  `/<branch>/<ordinal>/` and `/latest/`, `{"base":"../"}` at `/build/` and
  `/dist/`, `{"base":"./"}` at the root, written by the same function
  (`assetBaseFor`). The stable links become the web edition only when the main
  build handed in (`--main-build`) carries one: `pages-builds.yml` now copies
  `build/web` there as `web/`. While main still commits its inline build,
  nothing about the stable links changes.
- **The download, kept whole, for every retained pack-shaped build** (the
  choice §4 left to this step): `download/AshenSpire.html` is the build's light
  single file (`AshenSpire.html` of a light rebuild; the light-art
  `AshenSpire-mobile.html` of a `--full-art` one, until step 8e names the light
  single file). The build lists' Download links name it. `build.json` records
  it as `download: {path, bytes, sha256}`, and its top-level `bytes` is
  **null** for a pack-shaped build (the page's size is `pageBytes`): a copy of
  the game from before 6b reads only `bytes` and `../<ordinal>/index.html`,
  and null is a size it refuses, so it says the download is not ready instead
  of saving a 9.5 MB page with no art. `src/model/offlineDownload.js` reads
  `download` and refuses a path that is not a plain relative `.html` file.
- **Map tiles and the score are still copied beside each page** until step 3c
  reads them through the common index (their objects are already in the
  store). So the "no per-build media copies" saving of §4 waits for 3c.
- **The service worker** (`tools/pages-sw.mjs`, written as `/sw.js`):
  objects cache-first, each checked against its own name before it is cached
  (a mismatch answers 502 and is never cached); a Range on a cached object is
  a `206` slice, and a Range on a miss is answered only after the whole object
  is fetched, checked and cached, so no unchecked byte is served; pages (navigations, `asset-base.json`, `build.json`,
  `packs/`) network-first, written to the cache **only** when "Make available
  offline" asks (an `X-Ashen-Offline` request header), read only when the
  network fails. Browsing never writes a page, so an offline copy is the HTML,
  indexes and objects of one moment, and online the network always wins.
  Everything else in scope passes through untouched.
- **The kill-switch is the committed constant `SW_KILL`** in
  `tools/pages-sw.mjs`, not a dispatch input: every push to dev republishes
  the site, so a switch thrown by one run would be undone by the next. Its
  worker registers no fetch handler, deletes every `ashen-` cache, unregisters
  and reloads the pages it controlled; the page registers with
  `updateViaCache: 'none'`, so the browser re-checks `sw.js` on each
  navigation. `builds.json` records the worker's version, kill state and
  sha256 instead of the worker reading `builds.json` (§8's wording): the
  browser's own update check is what delivers a new worker.
- **Pulling the worker (the recipe).** Set `SW_KILL = true` in
  `tools/pages-sw.mjs` and merge that one-line PR to `dev`: the push to `dev`
  republishes the site with the kill-switch `sw.js` (`--check` proves the
  published file is it). Each browser that kept a build picks it up on its next
  visit to any page under `/AshenSpire/`, deletes its `ashen-` caches,
  unregisters, and reloads **every window the worker controlled**, losing
  nothing but the offline copy (saves live in `localStorage`). Leave it
  published for weeks, since a browser only meets it on a visit; set it back to
  `false` in a later PR to offer offline play again. `node tools/pages-site.mjs
  --sw-kill` writes it for one local run, for a test.
- **Risk: a publication by a pre-6b `pages-site`** (for example the owner's
  `PUBLISH` dispatch from a branch whose tool predates this step) leaves `/sw.js`
  out. A browser's update check then gets a 404, which does **not** unregister
  a worker: kept builds keep working offline and online (pages are
  network-first), but no new worker, kill-switch included, can arrive until a
  6b `pages-site` publishes again. Publish the kill-switch from `dev`.
- **The worker is registered only when the player asks** (Download & saves →
  "Make available offline", `src/ui/offlineInstall.js`), relative to the base
  the loader read (`builtInArtStatus().base`), with the default scope, which is
  the site root `/AshenSpire/`. It keeps light and common, plus high only when
  the player ticks it. The worker is shared by every build under the root, so
  "kept" is decided per page: this page's HTML and its pinned indexes are in
  the page cache. The page is written last, and only when every object
  arrived, so a keep that fails partway does not count. "Remove this build's offline copy" deletes that page, its
  `asset-base.json` and the indexes no other kept build pins; the shared
  objects stay until the last kept build is removed, which also unregisters
  the worker and deletes every `ashen-` cache. The section shows only on a pack-shaped build; on `file://` or
  without service workers it says why in one line. The PWA manifest and the
  install prompt of §5 A are not in this step.
- **`--check` rows**: per pack-shaped build, the download's bytes and hash;
  for every pack-shaped page found in the tree (each build, each `/latest/`,
  the stable links), an `asset-base.json` that resolves to the site root and
  each pinned index (and the font sidecar, by its text) hashing to the pin;
  every object a served index lists present with its hash; no store file
  unreferenced; `sw.js` byte-identical to `tools/pages-sw.mjs`'s text for the
  recorded kill state; every Download link on the build lists a file on the
  site. `--selftest` publishes a real rebuild of dev's head into a fixture
  store and plants a missing object, a missing index, a stale `sw.js`, a
  missing `download/` file, a missing `asset-base.json` and a stray object,
  each red by its own name.
- **`tools/pages-offline.mjs`** drives it in Chromium over
  `tools/browser.mjs serveDir` under `/AshenSpire/`: the keep, the scope, the
  kept files, network-first online, an offline boot, offline `206` answers for
  a music object and an `<audio>` load, and the kill-switch unregistering.
  `dev-preview.yml`'s browser-gates job runs it (about a minute);
  `--selftest` (several minutes, by hand) plants a Range answered with `200`, a kill-switch
  that keeps its registration, and a kept page served before the network.

### Step 7 as built

Where the build settles §5 B (2026-10-02):

- **Where it is offered.** Download & saves keeps the light single file as
  *Download game* (step 6b) and adds **Download a folder copy (zip)** below
  it. The zip is offered only when the selected branch's `build.json` says
  `shape: "pack"`; for an older inline build one line says its Download is
  already the whole game, and no zip control is drawn, so nothing offered
  names a file the site lacks. Step 6b keeps a `download/` light single file
  for **every** retained pack-shaped build, so §4's alternative (older builds
  hiding their Download cell) does not arise, and the build lists are unchanged.
- **What it holds.** `AshenSpire-<branch>-<version>.zip` holds one folder of
  the same name: the build's page as `AshenSpire-<branch>-<version>.html` (the
  name a download has, so `buildChannel` reads the same channel from it),
  `asset-base.json` (`{"base":"./"}`), the **light and common** indexes with
  their `.js` twins, the font sidecar (always `packs/fonts-<digest12>.js`, the
  only name `asset-pack` writes; a pin naming anything else is refused by the
  zip and by `pages-store` `publishPack`, as `verify-external` already does;
  Codex, #1480; `verify-external` checks the sidecar only when the common
  pack is pinned, and requires it there), and every object those two indexes
  list (about 5,500 entries, 58 MB for a dev build). **High is never packed**
  (`offlinePlay.zip.packs`): a build whose default is high shows the packed
  light art through the tier fallback. The score is packed with common, and a
  double-clicked folder keeps the synth (§3.9); served over http it plays.
- **Where it comes from.** `src/model/offlineDownload.js` `releasedZip` reads
  the branch's `build.json`; `assembleZip` fetches the page
  (`../<ordinal>/index.html`), reads the pin **from that page**, finds the store
  through the page's `asset-base.json`, and streams the archive. From a
  downloaded copy these are cross-origin reads of the Pages site, like the
  single-file download's.
- **Integrity** (§3's table): the page against `build.json`'s `pageBytes` and
  `pageSha256`; each index against the pin; each twin and the font sidecar by
  the string they hand the loader, against the same pin, and by the id they
  call it with (their file's basename); every object against its name and its
  listed size before it is written, and two indexes listing one object at two
  sizes are refused. A failure is refused by code (`ZipDownloadError`:
  `unreachable`, `page`, `pack`, `hash`); the screen maps it, a cancel, a full
  disk and a refused save location to uiStrings rows, anything else to a
  generic row (its raw text to the console only), and nothing is called saved.
  Each request waits `headerTimeoutMs` (60 s) for its headers and then fails
  when no body chunk arrives for `idleTimeoutMs` (30 s), an idle deadline so a
  slow but moving connection finishes the 10 MB page; it is tried twice, except
  after a definitive 4xx. Objects are fetched six at a time and written in order.
- **The screen** (`src/ui/offlineZipFlow.js`, no DOM, so CI drives it): which
  box shows for a feed, the failure words, and one save from click to final
  status. The polite status line is rewritten at most every 2 s while the zip
  is built (the progress bar takes every step), and the final state is always
  announced. A branch change forgets a prepared Blob.
- **The writer** is `src/model/zipStream.js`: store-only, the same bytes as
  `tools/zip.mjs` `writeZip` for the same entries (the test holds them equal),
  entries in byte order. It streams to `showSaveFilePicker` where it exists
  (writes coalesced to about 1 MiB), else gathers a Blob and saves it, with a
  *Save zip file* retry, as the single-file download does.
- **`pages-site`** now records `pageSha256` and `zipBytes` (the zip's exact
  size, from `folderZipBytes`, the same layout `assembleZip` writes, read from
  the store just published) in a pack build's `build.json`; `--check`'s
  DOWNLOAD DRIFT row compares both, and `--selftest` plants each. A
  `build.json` without `pageSha256` (a site from before this step) still zips,
  checked by size and the pin; without `zipBytes` the size is not shown.
- **The words** are `offline.zip.*` rows in `content/source/uiStrings.csv`;
  `src/content/offlinePlay.js` `zip.instructions` names the four shown, in order.
- **`offline-play-qa --zip`** publishes `build/web` into a local Pages shape
  (`publishPack`, a `download/` light single file, a `build.json` as
  `pages-site` writes it), boots the hosted page, has the game build the zip by
  both save paths (a Blob download, and a stubbed save-picker handle whose
  writes must equal it byte for byte), checks its size is `zipBytes`, unzips it, checks every entry against
  the pin and the indexes, stops the server, and plays the folder under
  `file://` with the network off: light art from its own packs, the 15 lore
  faces, a title backdrop from its objects, then the shared import → map →
  combat → blocked-storage pass. Not exercised: a real OS save dialog, a
  phone, and Safari or Firefox.

---

## 8. Risks

- **`file://` differs between browsers.**
  - Chrome blocks `fetch`, cross-origin fonts and CSS masks.
  - Firefox's `file://` origin rules are stricter still.
  - Phones cannot reliably open an unzipped folder.
  - Mitigation: the `.js` sidecars, the inline masks, the synth score under
    `file://`, the `file://` pass in `external-play`, and the service worker as
    the phone story.
- **Service-worker staleness.** A buggy worker can pin an old build.
  Mitigations:
  - HTML is network-first;
  - objects are immutable by name;
  - the worker carries a version it checks against `builds.json`;
  - a kill-switch `sw.js` that unregisters itself is kept ready.
  - As built (6b): the kill-switch is `SW_KILL` in `tools/pages-sw.mjs`; it
    reloads every window the worker controlled; and a publication by a pre-6b
    `pages-site` drops `/sw.js`, which does not unregister a worker (see
    [Step 6b as built](#step-6b-as-built)).
- **Safari audio in the worker.** A `200` answer to a `Range` request breaks
  MP3 playback on iOS. The worker slices cached responses into `206`, and
  `offline-play-qa` plays a track offline.
- **Many small requests.** The 3,071 animation frames arrive one per request,
  as they already do in the web edition. HTTP/2 on Pages plus the existing
  warm-ups cover first play. Sprite sheets are out of scope here.
- **The art release becomes a build dependency** (step 11): every CI build,
  agent session and local build fetches it. No token is needed once the art
  repository is public (owner answer 1); a build without one can hit GitHub's
  unauthenticated rate limit, which `ART_REPO_TOKEN` or `GITHUB_TOKEN` raises.
  Since step 10a (2026-10-02) the repository is public, so a fetch needs no
  token; before it, a fetch without one failed by name.
  Source play without a fetch shows placeholders, not an error.
- **Pages size.** The site is already over the documented 1 GB. Steps 6a and
  6b bring it to about 1.1 GB while `assets/` stays on Pages, and about 0.9 GB
  after step 13 (section 4). If GitHub starts enforcing the
  limit, the rest comes from a lower `--keep`, or from publishing the light
  single file for each branch's latest build only; `docs/preview` stays (owner
  answer 7).
- **Reproducibility.** Pack JSON must be byte-stable on all three OSes: sorted
  keys and `\n` only, like `tools/dirorder.mjs` requires. `reproducible-agree`
  compares the index digests.
- **Two shapes on Pages at once** (inline old builds and pack builds) until
  the old ones age out of `--keep`. `pages-site` handles both, and its selftest
  plants both.

---

## Owner answers (2026-09-27)

1. **Keep the light and common packs private? No.** The owner then chose to
   make **`cehinds/AshenSpire-art` public**: everything in it, the high-res
   zip included. This supersedes FINISH D20 and ART-REPO-PLAN's Q1 and *Owner
   answer (2026-09-27)* (FINISH D22).
   - No `ART_REPO_TOKEN` is needed to fetch a release. `fetch-art` keeps the
     token as optional, for rate limits (section 2).
   - Step 11 needs no secret: builds fetch the public release. *(As built,
     CI also passes the `ART_REPO_TOKEN` secret, as a belt-and-braces
     fallback.)*
   - **Done 2026-10-02:** the owner made the repository public (step 10a),
     before step 11 landed.
2. **Drop the separate mobile download? Yes** (FINISH D23). One HTML picks the
   light or high tier at runtime; `AshenSpire-mobile.html` redirects and
   `--mobile` and the `mobile/` pages go at step 8e.
3. **Offline only through the install and the game's zip, with no single file
   kept? No.** The owner keeps **one light-art single file** (about 30 MB,
   self-contained, plays by double-click) as the download; the 254 MB high-res
   single file is still retired (FINISH D24).
   - Step 8e keeps inline mode for the light single file only; it retires
     `--mobile` and the full-art single file.
   - `verify-shipped` check A stays, for the light single file.
   - The `download/` path stays, serving the light single file.
   - The service-worker install and the zip remain as additional offline
     paths (section 5).
4. **Serve high-res on Pages for main and release? Yes** (FINISH D25).
5. **SPEC and FINISH wording in its own PR (8a)? Yes, reviewed there.**
6. **Retire D5's "the 254 MB file stays a download"? Yes** (FINISH D24).
7. **Stop serving `docs/preview`? No, keep it** (FINISH D26).
