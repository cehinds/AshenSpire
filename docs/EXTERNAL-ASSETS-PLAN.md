# Every asset outside the game file — plan

Status: **plan only, nothing built** (2026-09-27). It follows
[ART-REPO-PLAN.md](./ART-REPO-PLAN.md) and extends it. Where the two overlap
(step 4's switch of the `assets/` readers, step 6's delete), that plan's steps
still apply and this one adds rows to them.

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

## Summary

- One HTML file per build, about 9.5 MB of code and no media. The art, fonts,
  music and map tiles are loaded from **content-addressed files** (named by
  their sha256) that the HTML's **pack index** lists. The index is hash-pinned
  inside the HTML.
- `tools/bundle.mjs --external-art` already builds this shape without the pinning
  (`build/web/`, dev-preview's `preview/`). The plan makes it the only
  shape, adds the index and hashes, and retires the three single files.
- The art repository's release grows from one zip to three: `high` (today's
  `hd-assets-v<N>.zip`), `light` and `common`. The existing `art-release.json` and
  `tools/fetch-art.mjs` pin and fetch all three. No second system is added.
- On Pages, every build shares one object store at the site root, so a file is
  stored once however many builds use it.
- Offline and on phones, a **service worker** installs the build for offline
  play (recommended). A **zip the game assembles itself** replaces the
  single-file download on desktop. The separate mobile file is dropped: one
  HTML picks the light or high tier at runtime.
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
| images, SVG (masks) | 6 | 4,863 B | 4,863 B | the same map, and CSS `url()` |
| fonts, WOFF2 (8 "AS Lore" families, 15 faces) | 15 | 400,484 B | 400,484 B | **CSS only**: the `@font-face` `url()`s in `styles/kit.css:4078-4092`, inlined by `inlineCssUrls` (`bundle.mjs:671-727`). The map skips them on purpose (`bundle.mjs:423-430`). |
| of those, CSS `url()` targets (15 fonts, 8 backdrops, 2 SVG masks) | 29 url()s in `styles/` | 464 KiB raw | 1,521 KiB raw | base64 in the inlined `<style>` (`kit.css:2062`, `4534-4602`; `combat.css`, `ui.css`) |
| **total, art manifest** | **5,201** | **14,729,797 B** | **185,106,227 B** | 5,186 map entries + 29 CSS url()s |

`tools/assetmime.mjs:13-18` decides what ships: `.webp .png .jpg .jpeg .gif
.svg .ogg .mp3 .wav .m4a .woff2`. `runtimeAsset()` (`:27-29`) excludes the
authoring-only `equipment/components/` strips (39 files, 41 in the
directory).

### What the build already carries beside the HTML (never inlined)

| class | files | bytes | today |
|---|---|---|---|
| music, MP3 | 13 (+ `music/manifest.json`) | 20,274,812 | fetched from `music/` beside a page served over http(s) (`src/content/music.js:29` `SHIPPED_MUSIC_FOLDER`, `src/ui/audio.js:599`, `:634`). A `file://` page keeps the synth. `bundle.mjs:1087-1091` copies the **whole** folder, including 18 authoring files (score sources, READMEs, 62 KB). |
| map detail tiles, WebP | 116 | 11,475,906 | fetched from `map-detail/` beside the page (`src/ui/components/mapDetail.js:15-18`). Under `file://` the map shows its low-detail fallback. |
| SFX | 0 | — | synthesized (`src/content/sfx.js` `SFX_RECIPES`); `SFX_MANIFEST` ships empty |

### What stays in the HTML and is not an asset

- The favicon, a 300-byte inline SVG in `index.html:15`, stays inline. It is
  markup, and it works under `file://`.
- The inline SVG glyph markup in about 11 `src/` files is code.
- `asset-data/` (JSON manifests, the class-art notes, `framework/silence.txt`)
  holds build-time data, not player media. It stays in this repository.
  `asset-data/fonts/OFL.txt` is also copied into the `common` pack, so the
  licence travels with the fonts.

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
| `assets-mobile/` (light tier, 5,201 files, 14.7 MB) | `light/assets/`, **generated there** from `hd/assets/` by `tools/mobile-art.mjs` + `tools/mobileart-policy.mjs`, which move with it | `light` |
| `assets/fonts/*.woff2` (15), `asset-data/fonts/OFL.txt` (copy) | `common/assets/fonts/` | `common` |
| `music/**/*.mp3` (13) and `music/manifest.json` | `common/music/` | `common` |
| `music/score/*.mjs`, `music/PROMPTS.md`, `tools/score/render.mjs` | `art/music/` and its tools: the score's source, like `art/` for images | none (authoring) |
| `map-detail/` (116 tiles) | `common/map-detail/`, built by `tools/map-detail-build.mjs`, which already moves under ART-REPO-PLAN's second table | `common` |
| future SFX samples (`assets/sfx/<id>.ogg`, CONTRIBUTING rule 2) | `common/assets/sfx/` | `common` |

The fonts are one `common` file each rather than a light/high twin pair: the
twins are byte-identical today (same sha256 in both tiers of
`art-manifest.json`).

### The release

The tag family stays `hd-assets-v<N>`, so the pin's shape rules
(`tools/fetch-art.mjs:48-60`) change as little as possible. The art repo's
existing release workflow ([AshenSpire-art#2](https://github.com/cehinds/AshenSpire-art/pull/2)) attaches
three zips and the manifest:

```
hd-assets-v<N>.zip        high tier (as today)
light-assets-v<N>.zip     light tier
common-assets-v<N>.zip    fonts, music, map tiles, OFL.txt
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

- Every existing id keeps its `light` and `high` records.
- New ids get one **`common`** record `{path, bytes, sha256}`: `music/…`,
  `map-detail/…` and the fonts' `assets/fonts/…`.
- The `tiers` block gains `common`. `tools/art-manifest.mjs --write` stops
  deriving the file from the trees here; from step 11 it **copies the release's
  own manifest** and `--check` compares the two.

### `tools/fetch-art.mjs`, extended

- `--pack light|high|common|all`. The default is what the build needs: `light` and
  `common` on dev/test, all three on release/main.
- Each pack is cached as `.art-cache/<tag>/<pack>/`, with the checks it already
  has: the zip's sha256, then each file against its record, nothing extra in
  the zip, the `.verified` marker written last and the unpack published with
  one rename.
- The token rules stay the same: `ART_REPO_TOKEN`, else `GITHUB_TOKEN`.

### Build identity

- `art-release.json` and `art-manifest.json` join `BUILD_IDENTITY_FILES`, as
  ART-REPO-PLAN step 4 already requires.
- `assets`, `assets-mobile` and later `music` and `map-detail` leave
  `INPUT_ROOTS` (`tools/buildversion.mjs:168`) in the PR that deletes them.
  From then on the pin is how the digest sees the media.

---

## 3. Runtime loading

### The pieces

1. **Object store.** Every shipped file is written once as
   `objects/<sha256[0:2]>/<sha256>.<ext>`. Because the name is the content:
   - identical bytes are stored once (the ~50 aliased images, the fonts);
   - a stale cache can never serve different bytes under the same name;
   - Pages, the service worker and the zip can share files between builds.
2. **Pack index.** One file per pack, `packs/<pack>-<digest12>.json`: a sorted
   map of id → `[sha256, bytes, mime]`, with a `.js` twin
   (`window.__ashenPack("<id>", {…})`) for `file://`. With about 5,330 ids it is
   about 700 KB, 350 KB gzipped. A light build loads the light and common
   indexes.
3. **Pin in the HTML.** `bundle.mjs` stamps `ASSET_PACKS` in memory, as it
   already stamps the version and edition (`bundle.mjs:490-518`). For each
   pack it records the index file's sha256, its object count and its total
   bytes, and it names the default tier. `ASSET_MAP` stays empty
   (`src/ui/assetmap.js:16-18`).
4. **Loader** (`src/ui/assetPacks.js`, new; UI layer, not engine). At boot:
   1. It finds the base. It reads `asset-base.json` beside the page if there is
      one (`{"base":"../../"}`, written by the Pages site, below); otherwise the
      base is `./`.
   2. It loads each pack index: `fetch` over http(s), a `<script>` tag of the
      `.js` twin under `file://`.
   3. It checks each index's sha256 against the pin, using SubtleCrypto where
      it exists and a ~2 KB bundled SHA-256 elsewhere.
   4. It hands a Map of id → object URL to `assetmap.js`.
5. **`assetUrl()`** (`src/ui/assetmap.js:54-56`) resolves in the order: high-res
   overlay (unchanged), then the **built-in pack**
   (`setBuiltInSource(map)`, new, beside `setHighResSource`), then `ASSET_MAP`
   (older inline builds), then the path. An unknown id still passes through
   and 404s visibly, as it does today.
6. **CSS assets.** In the pack shape, `bundle.mjs` stops rewriting CSS
   `url()`s. Every rule that names an asset is moved out of the inlined
   `<style>` into an `ASSET_CSS` template with `{{id}}` slots. Once the index
   resolves, the loader fills the slots and injects the template as one
   `<style>`. That covers the 15 `@font-face` rules and the 14 backdrop and mask
   rules, so the CSS bypass SPEC §2's status row calls open (*"14 CSS
   `url(../assets/…)` backdrops still bypass `assetUrl()`"*) is closed.
7. **Music and map tiles.**
   - `audio.js` reads the shipped manifest and tracks through the common index
     instead of `music/` beside the page. `SHIPPED_MUSIC_FOLDER` becomes the
     id prefix.
   - `mapDetail.js` builds tile ids (`map-detail/<hash>/<size>/<x>-<y>.webp`)
     and resolves them with `assetUrl()`.
   - Under `file://`, a tile is an `<image href>` and a track an
     `HTMLAudioElement` source (`audio.js:479` already makes one). Neither
     needs `fetch`, so a downloaded build gains the detailed map and the score,
     which it lacks today.
8. **Fonts under `file://`.** Chrome refuses cross-origin font loads from a
   `file://` page. The common pack therefore also ships
   `packs/fonts-<digest12>.js`, which calls `new FontFace(name, bytes)` from
   base64. The loader uses it only under `file://`. It is a sidecar file, not
   inlined in the HTML.

### Integrity

| where | what is checked | against |
|---|---|---|
| boot, every build | each pack index's sha256 | `ASSET_PACKS` in the HTML (a mismatch means the index is refused and the game plays on placeholders) |
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

- **Index missing or wrong hash:**
  - The game boots on placeholders (SPEC §2.4: *"fully playable with zero
    downloaded assets"*), the synth score and system fonts.
  - A non-blocking notice says the art could not be loaded and offers
    **Retry**.
  - The debug failure banner stays quiet, because this is not a dead control
    (`tests/debug-banner.test.mjs`).
- **One file fails (404, network, hash):**
  - The existing document-level `error` listener (`highResArt.js`
    `watchMissingFiles`) is extended to the built-in pack: it swaps in the
    placeholder recipe from `src/ui/assets.js`, where today it falls back
    from high-res to built-in.
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
```

`dist/AshenSpire.html` still opens by double-click (see section 5), so the
player door in ARCHITECTURE-MAP.md stays open. `packs/` and `objects/` under
`build/` and `dist/` are git-ignored, as the HTML already is.

### GitHub Pages (`tools/pages-site.mjs`, `pages-builds.yml`)

- Pack-shaped builds share **one object store and one pack folder at the site
  root**: `/objects/…` and `/packs/…`. Each build page
  (`/<branch>/<ordinal>/index.html`) and each `/<branch>/latest/` gets an
  `asset-base.json` of `{"base":"../../"}` beside it.
- The HTML stays byte-identical to the build, so the byte-proof per build
  (`pages-site.mjs` `check`) is unchanged.
- The per-build copies of `map-detail/` and `music/` (`pages-site.mjs:716-738`,
  `:761-764`) stop for these builds.
- `--check` gains two checks: every object a served index lists is present with
  that hash, and no object is unreferenced.
- **Dedupe.** A file is stored once across every build, branch and pack
  version that uses it. Estimate at `--keep 10` on four branches:
  - HTML: 40 × 9.5 MB ≈ 380 MB;
  - objects: high 185 MB + light 15 MB + common 32 MB, plus the few files each
    new release changes.
  - That is about 620 MB. It fits Pages' 1 GB site limit
    (docs/plan-polish-review-2026-09.md:452). Today's shape would not at the
    same `--keep`: a 29 MB light HTML plus per-build music and tiles is about
    61 MB per build, so about 610 MB for dev alone.
- **Older builds** (inline single files, and per-build `mobile/`) keep their
  current shape. `pages-site` serves both shapes side by side until they age
  out of `--keep`.
- **Where the objects come from.**
  - Current builds: the object tree `launch.mjs` wrote.
  - Rebuilt builds (`--build-missing`): the same, from the pin at that commit.
    The fetch cache is keyed by tag, so one fetch serves every rebuild.
  - `pages-builds.yml` needs `ART_REPO_TOKEN` from step 11 on.
- The **main** build, whose default tier is `high`, also carries the `light`
  pack. A phone gets light art from the same page (section 5).
- The service worker script is written once, at `/sw.js`, with the scope of the
  whole site.

### Releases

- A public AshenSpire release carries nothing new. The owner's rule that the
  high-res zip stays private (ART-REPO-PLAN, *Owner answer 2026-09-27*) is
  kept.
- The offline zip is assembled by the game (section 5), so no release asset
  is needed.

---

## 5. Offline and mobile

What changes: *"download one .html, double-click, play offline"* becomes
*"one folder"*, or *"install it"*. The in-game **Download & saves** screen
(`src/content/offlinePlay.js`, `src/model/offlineDownload.js:3-10`, which fetches
`../<ordinal>/index.html` today) and the separate 29 MB mobile file are the two
surfaces affected.

### Options

| option | desktop | phone | cost | trade-offs |
|---|---|---|---|---|
| **A. Service worker + install** (PWA manifest, "Make available offline" button) | yes: works offline at the same URL | **yes**: the only option that works well on iOS and Android | `sw.js` + `manifest.webmanifest` + a precache list read from the indexes; ~47 MB light + common (or +185 MB high) in Cache Storage | Hosted only (not `file://`). Browsers may evict it unless `navigator.storage.persist()` is granted or the app is installed (iOS evicts after about 7 days unused). Saves stay in the site's `localStorage`, so online and offline share one set of saves, which is better than today's split between a downloaded copy and the site. |
| **B. Zip the game assembles** (Download game → `AshenSpire-<branch>-<ver>.zip`: HTML + `packs/` + `objects/`, light + common) | yes: unzip, double-click | poor: phones cannot open an unzipped HTML with its folder reliably | a small store-only zip writer in the browser (ported from `tools/zip.mjs` `writeZip`), streaming to `showSaveFilePicker` where it exists, else a Blob; each object is hash-checked as it is written; no hosting cost | Works under `file://`: images and CSS by URL, the index and fonts through the `.js` sidecars. About 57 MB, not 29 MB. Saves stay separate from the site's, as they are today. |
| **C. Keep a light single file for offline** (a `--offline` inline edition) | yes | as today (29 MB) | keeps `ASSET_MAP` inlining, the budget and `verify-shipped` check A alive | Goes against the owner's decision (b). Two shapes to keep working forever. |
| **D. Drop offline** | no | no | none | Removes a feature that has a screen, content and a QA tool (`tools/offline-play-qa.mjs`). |

### Recommendation: A + B, and drop C and D

- **A** is the phone story and the main offline path.
- **B** replaces the single-file download for desktop players who want a copy
  to keep.
- The **separate mobile file is dropped.** One HTML chooses its tier at runtime:
  - Settings → Display → Art quality becomes **Auto / Light / High /
    Local high-res**.
  - *Auto* means light on a narrow layout (`data-layout`), with Save-Data on,
    or on a low-memory device, and the build's default otherwise.
  - The choice stays in `LOCAL_ONLY_KEYS` (`src/model/settingsSync.js:86`).
  - This also retires `--mobile`, the 30 MB budget and the `mobile/` pages.
- The hosted build list keeps a single **Play** link. The *Download* link opens
  the game's Download screen instead of pointing at a raw HTML.

---

## 6. Every gate, test and rule that assumes one self-contained file

"Step" refers to section 7.

### Build and CI

| gate / test | where it runs | assumes | becomes | step |
|---|---|---|---|---|
| `tools/bundle.mjs` single-file shapes (default, `--light`, `--mobile`) | every build | media inline | one shape (the old `--external-art` plus packs). The flags are removed at the flip; `--external-art` stays as an alias for one release. | 3, 8 |
| `tools/bundle.mjs` literal-ref check (`:1000-1045`) | every build | `assets/…` exists on disk | checks the literal ids against `art-manifest.json` | 12 |
| `tools/launch.mjs` (`:75-76`, `:123-129`, `:143-176`, `:180`) | every build | three single files, then copies of music and tiles | writes one tree (section 4); no mobile file | 3, 8 |
| `tools/verify-shipped.mjs` check A (art inline, the count floor) | `ci.yml` reproducible, `dev-preview.yml` | ASSET_MAP entries in the HTML | **removed, by its own removal condition** (`verify-shipped.mjs:41-43`); replaced by: the HTML carries `ASSET_PACKS`, zero `data:` media, and each named index is in `packs/` with that hash. Checks B and C (the aliases are this build, nothing tracked) stay. | 8 |
| `verify-shipped` mobile-edition check (budget, smaller than full) | same | a mobile file | removed with the edition | 8 |
| `tools/verify-external.mjs` A–D (`--dir preview`, `--selftest`) | dev-preview | `assets/` copied beside the HTML, compared with source `assets/` | A: pins are present; B: no `data:` media; C: every object in every index is present and hashes to its name; D: every `ASSET_CSS` slot names an id the index has. The selftest plants a missing object, a wrong hash and a stale pin. | 3 |
| `tools/external-play.mjs` (reachability job) | `test`, `release`, `main`, dispatch | served build, art over the wire | unchanged over http; adds a `file://` pass (the zip shape) and a pass that must stay playable with the index blocked (placeholders) | 3, 4 |
| `tools/bundle.test.mjs` parse gate and EOL corpus (`tests.yml:125`, `ci.yml:287-308`) | `test`/`release` | sandboxes copy `assets/`, run the unflagged full-art build, and read `bg_act1.webp` | sandboxes build the pack shape from a small fixture pack; the EOL corpus reads a fixture object | 8 |
| `ci.yml` reproducible (3 OSes) and `reproducible-agree` | `test`/`release` | the HTML digest is the build | digests of the HTML **and** each pack index; objects are a function of the pin | 8 |
| `tools/rebuild-matches.mjs`, `buildversion --check`, `--selftest` | CI | the HTML carries everything | unchanged for the HTML; the selftest corpus copies the fixture pack instead of `assets/` | 11 |
| `tools/mobile-art.mjs --check` / `--selftest` (`ci.yml:270-274`, `dev-preview.yml:178`) | every push | twins are in this repo | move to the art repo's CI, where the light tier is generated; here `art-manifest.mjs --check` compares the pinned release | 11 |
| `tools/credits-check.mjs` | every push | enumerates `assets/*` | enumerates manifest id prefixes, including `music/`, `map-detail/` and `assets/fonts/` (ART-REPO-PLAN already plans this) | 12 |
| `tools/hand-side-probe.mjs`, `shotguard-probe`, `startup-gate`, `map-two-axis-pan` | browser jobs | served source or build with art beside it | source mode is served by `tools/serve.mjs`, which maps ids to the fetch cache (ART-REPO-PLAN, `serve.mjs` row) | 12 |
| about 40 browser tools with `--dist` over `file://` (`mapfit`, `screenreach`, `release-shots`, `about-changelog`, `offline-play-qa` and others; `git grep -l "dist/AshenSpire.html" tools`) | browser jobs, by hand | `dist/AshenSpire.html` is complete alone | keep working under `file://` once step 4 lands (objects beside it); where a tool needs `fetch`, one helper in `tools/browser.mjs` serves `dist/` over http. One PR flips them all and lists them. | 4, 8 |
| `tools/offline-play-qa.mjs` | by hand | downloads one HTML and opens it under `file://` | downloads the zip, unzips it and opens it under `file://`; installs the service worker, goes offline and boots | 6, 7 |
| `tests/web-meta.test.mjs:57` | core suite | `build/AshenSpire.html` and `-mobile.html` | `build/AshenSpire.html` only | 8 |
| `tests/settings-revamp.test.mjs:21-25` (`buildChannel` of a `file://` name) | core suite | a single downloaded file's name | unchanged: the name inside the zip keeps the channel (`src/ui/buildChannel.js`) | — |
| `tools/pages-site.mjs` `--check`, `--selftest`, the mobile editions (`:432-455`, `:700-766`) | `pages-builds.yml` | one HTML (+ mobile) per build, copies of music and tiles | the object store and `asset-base.json`; new checks (section 4); mobile links only on old builds | 6 |
| dev-preview "Collect the playable build" (`dev-preview.yml:202-254`) | every push | `cp -r assets/…` into `preview/` | copies the built tree; the extra `assets/` copies for preview pages read the cache | 3, 12 |
| `pages-builds.yml` "Build main from source" (`:222-232`) | push to `main`, dispatch | copies two single files | copies the tree; needs `ART_REPO_TOKEN` | 6, 11 |
| `tests/run-node.mjs` checks 33, 49, 79; `content-expansion-equipment`, `rogue-parity`, `environment-art`, `relic-art` tests | core suite | files on disk under `assets/` | ids against the manifest (ART-REPO-PLAN step 4 rows, extended to the light tier, music and tiles) | 12 |
| `tests/art-manifest.test.mjs`, `tests/fetch-art.test.mjs`, `tests/high-res-art.test.mjs` | core suite | schema 1, one pack | schema 2, three packs, the pin's aliases | 2, 11 |
| doorplant `COPY_SET`, `sfx-filename-convention`, every `mkdtempSync` sandbox | various | the trees are in the repo | copy the pin and manifest (ART-REPO-PLAN) | 11 |

### Written rules

| rule | text today | becomes | owner sign-off |
|---|---|---|---|
| SPEC §3.2, `build/ · dist/` row | "The single-file bundle emitted by `tools/bundle.mjs` and its shipped copy" | "The game file, its pack indexes and its object store …" | **yes** |
| SPEC §7.4, the music paragraph | the `music/` beside the page; "a `file://` page cannot fetch it and keeps the synth" | tracks are read through the common pack; a downloaded build plays them too | **yes** |
| SPEC §7.5, fonts **TO BUILD** | "Cinzel/Inter … NOT bundled … self-hosting the woff2 under `assets/fonts/` is unfinished" | the interface faces are pack files loaded at runtime; system fallbacks stay. Replaces the bundling question (owner, 2026-09-27). | **yes** |
| SPEC §11, non-goals | "bundled audio asset files" is a non-goal | still true in letter; reword to "audio ships as pack files; SFX stay synthesized" | **yes** |
| SPEC §1, *Entry point* | "`index.html` opened directly or via any static server" | "via `node tools/serve.mjs`" once the media leaves the tree (ART-REPO-PLAN already names this) | **yes** |
| SPEC §2 status row and §2.4 | the CSS backdrops bypass `assetUrl()` (open) | closed by `ASSET_CSS` | no (a status row) |
| SPEC §8, the `release-shots` row | "the built bundle (`dist/AshenSpire.html`)" | `dist/` (HTML + packs) | no (wording) |
| DEVELOPER.md, *Standalone build* (`:861-873`) | "single self-contained HTML … no external files" | the build tree; double-click still works when the folder stays together | no |
| DEVELOPER.md, *Run & test* (the editions, light/full/mobile, the 30 MB mobile file, `npx serve .`) | three single files | one shape; the tiers are packs; `tools/serve.mjs` | no |
| CONTRIBUTING.md rule 2 (where assets live) | `assets/`, `assets/sfx`, `music/`, `assets/fonts/` here | they enter through the art repository and a pin bump | no, but the owner reads it |
| CREDITS.md:119-120 (fonts "the bundler inlines") | inlined through `kit.css` | loaded from the common pack; `OFL.txt` travels in the pack, and the `kit.css` licence header still ships | no |
| ARCHITECTURE-MAP.md, *Player door* and *Root allowlist* | "Portable build: `dist/AshenSpire.html`"; `assets-mobile/`, `music/`, `map-detail/` at the root | the door stays (double-click works from `dist/`); the moved roots leave the allowlist | no |
| CLAUDE.md, *Never commit built HTML* | built HTML | add `build/`, `dist/` `packs/` and `objects/` | no |

SPEC edits go in **their own PR before the flip** (CONTRIBUTING rule 1).

---

## 7. Migration steps

Every step is one reviewed PR (or one owner action), and the game still works
after each. Runtime loading (b) comes first, while every file is still in this
repository; storage (a) follows. The token and the art repository therefore
only become build dependencies at step 11.

| # | step | ships | what still works |
|---|---|---|---|
| 1 | **This plan** (docs only). | — | everything |
| 2 | **Pack format + schema 2, from the trees here.** `tools/asset-pack.mjs` writes `objects/` + `packs/` (JSON + `.js`, sorted, byte-stable across OSes) from `assets-mobile/`, `assets/`, the fonts, `music/` and `map-detail/`. `art-manifest.json` schema 2 gains `common` ids. Tests: `asset-pack.test.mjs` (determinism, a planted wrong hash, a planted stray). Not used by the game yet. | a tool and a test | every edition, unchanged |
| 3 | **Runtime loader, in the web edition only.** `src/ui/assetPacks.js`; `setBuiltInSource` in `assetmap.js`; `ASSET_PACKS` stamp; `ASSET_CSS` template; music and tiles through the index. `bundle.mjs --external-art` emits packs instead of copying trees. `verify-external` and `external-play` are rewritten for it. The single files are untouched: `ASSET_CSS` and the loader do nothing when `ASSET_MAP` is filled. | `build/web`, dev-preview `preview/` | the single files, as before; the web edition with hashes |
| 4 | **`file://` for the pack shape.** The `.js` sidecars, the font sidecar, `<image>`/`HTMLAudioElement` paths, and `external-play --file`. | the web edition opens by double-click | all |
| 5 | **Loading UX and fallbacks.** Progress on the startup gate, the critical set in `content/config`, the Retry notice, placeholders on a failed load, and a test that blocks the index and still plays. | player-visible boot line | all |
| 6 | **Pages object store + service worker.** `pages-site` writes `/objects`, `/packs`, `asset-base.json` and `/sw.js` (network-first HTML, cache-first objects checked by hash, a kill-switch version) and adds the new `--check` rows. The Download & saves screen gains "Make available offline". `offline-play-qa` gains an offline boot. | hosted offline | older builds, as they were |
| 7 | **In-game zip download.** Replaces the single-HTML download in `offlineDownload.js`, with new `offlinePlay.js` instructions and `offline-play-qa` on the zip. | desktop offline copy | the old download, until step 8 |
| 8a | **SPEC PR** (section 6's sign-off rows). Owner review. | text | — |
| 8b | **The flip.** `launch.mjs` builds only the pack shape; `--light`/`--full-art` choose the default tier and which packs to carry; `--mobile` and inline mode are removed; Art quality becomes Auto/Light/High/Local; `verify-shipped` A and the mobile checks are retired; `bundle.test`, `web-meta`, the `--dist` tools and the DEVELOPER/CREDITS/ARCHITECTURE-MAP/CLAUDE text follow. | one HTML, ~9.5 MB | every door: double-click `dist/`, hosted, installed |
| 9 | **Art repo PR.** Import the light tier generator (`mobile-art.mjs`, `mobileart-policy.mjs`) and generate `light/assets/` from `hd/assets/`; add `common/` (fonts, `OFL.txt`, music, tiles) with the score and tile tools; the pack script writes three zips and the schema-2 manifest; CI verifies each zip against the manifest. | — | this repo unchanged |
| 10 | **Owner:** publish `hd-assets-v<N>` with three zips. | — | — |
| 11 | **Pin and fetch.** `art-release.json` schema 2; `fetch-art --pack`; `asset-pack.mjs` reads the cache; the pin and manifest join `BUILD_IDENTITY_FILES`; `ART_REPO_TOKEN` is added to every building workflow (dev-preview, tests, ci, pages-builds) and named on failure. The trees here are still present, and a check proves the cache and the trees agree byte for byte. | builds from the release | all, with either source |
| 12 | **Switch every reader** of `assets-mobile/`, `music/`, `map-detail/` and `assets/fonts/` to the manifest or the cache (section 6; ART-REPO-PLAN step 4's rows, extended). The PR records `git grep` output for each tree. | — | all |
| 13 | **Delete** `assets-mobile/`, the MP3s, `map-detail/` and `assets/fonts/` from `dev` and add them to `.gitignore`, together with ART-REPO-PLAN step 6 for `assets/` and `art/`. Precondition: step 12's grep finds only fetch-aware code. History is untouched. | a smaller tree | all |

Steps 2–8b need no token and no art-repo change, so they can start now.
ART-REPO-PLAN step 5 (the `art/` readers) is independent of all of them.

---

## 8. Risks

- **`file://` differs between browsers.**
  - Chrome blocks `fetch` and cross-origin font loads.
  - Firefox's `file://` origin rules are stricter still.
  - Phones cannot reliably open an unzipped folder.
  - Mitigation: the `.js` sidecars, the `file://` pass in `external-play`, and
    the service worker as the phone story.
- **Service-worker staleness.** A buggy worker can pin an old build.
  Mitigations:
  - HTML is network-first;
  - objects are immutable by name;
  - the worker carries a version it checks against `builds.json`;
  - a kill-switch `sw.js` that unregisters itself is kept ready.
- **Many small requests.** The 3,071 animation frames arrive one per request,
  as they already do in the web edition. HTTP/2 on Pages plus the existing
  warm-ups cover first play. Sprite sheets are out of scope here.
- **The token becomes a build dependency** (step 11): every CI build, every
  agent session and every local build needs `ART_REPO_TOKEN`. A missing token
  fails by name. Source play without a fetch shows placeholders, not an error.
- **Pages' 1 GB limit.** The object store is what keeps the site under it
  (estimate in section 4). `pages-site --check` should print the site's size
  so growth is seen.
- **Reproducibility.** Pack JSON must be byte-stable on all three OSes: sorted
  keys and `\n` only, like `tools/dirorder.mjs` requires. `reproducible-agree`
  compares the index digests.
- **Two shapes on Pages at once** (inline old builds and pack builds) until
  the old ones age out of `--keep`. `pages-site` handles both, and its selftest
  plants both.

---

## Questions only the owner can answer

- Keep the light and common packs in the private art repo, with `ART_REPO_TOKEN` added to every CI build and agent session? **Yes/no** (default **yes**).
  - A "no" means they are published somewhere public instead (they are already public on Pages), which drops the token from dev builds; decides step 11.
- Drop the separate mobile download and let one HTML pick light or high art at runtime (Art quality: Auto/Light/High/Local)? **Yes/no** (default **yes**).
  - Removes `AshenSpire-mobile.html`, its 30 MB budget and the `mobile/` pages at step 8b.
- Offline = service-worker install (phones and desktop) + a zip the game builds (desktop), with no inlined single file kept? **Yes/no** (default **yes**).
  - A "no" keeps option C, an inlined light file, which is what decision (b) asked to end; decides steps 6–8b.
- Main and release hosted builds serve the high tier's files publicly on Pages, as today's 255 MB full file already does? **Yes/no** (default **yes**).
  - A "no" limits main to the light tier, with high-res only through Local high-res.
- Approve the SPEC wording for §1, §3.2, §7.4, §7.5 and §11 when its PR (step 8a) is opened? **Yes/no in that PR** (default: review there).
  - The flip (8b) waits on it.
