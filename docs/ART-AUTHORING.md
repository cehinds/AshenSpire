# Edit game code and art in Visual Studio

Use the full **Visual Studio 2022** application. In **File → Open → Folder**,
open your AshenSpire game checkout. Install its **Node.js development** workload
and Node.js 22.14 or newer. The game has no root npm dependencies; its
`tasks.vs.json` tasks appear when you right-click the root `package.json` in
Solution Explorer. Use **View → Terminal** for the commands below.

Keep two separate checkouts, for example `C:\Projects\AshenSpire` and
`C:\Projects\AI-Art`. The game keeps its own feature branches. The shared art
repository keeps AshenSpire work on **`ashenspire`**; its `ff2`,
`dungeon-crawler` and other game branches belong to those games.

| What you are changing | Open/edit this checkout |
| --- | --- |
| Game rules, cards, balance, UI behavior, editor application JavaScript, tests | `AshenSpire`: `src/`, `games/`, `content/`, `styles/`, `tools/`, `pose-studio/`, `workbench/` |
| Editable art masters, images, prompts, design references and portable art projects | `AI-Art`, branch `ashenspire`: `art/`, `docs/design/`, `pose-studio/renewal/`, `pose-studio/stances/`, `tools/hud-component-studio/projects/` |
| Display-image exports, still identified by `assets-display/...` in game code | `AI-Art`: `common/assets-display/...` |
| Other shipped art, fonts, sound and music renders | `AI-Art`: `hd/assets/`, `light/assets/`, `common/assets/fonts/`, `common/music/`, `common/map-detail/` |
| Generated game catalogs and display JSON indexes | `AshenSpire`: `src/content/`, `src/ui/`, `assets-display/**/*.json`; use the matching exporter |
| Score composition source and software/font licenses | Keep their existing game source/license records; score source remains `music/score/*.mjs` |

Source packages retain their original game-relative paths in AI-Art. For
example, edit `AI-Art\pose-studio\stances\update-stances\selections.json`.
Its editor page and imports such as `../../src/*` are game code: open the
composite local editor below. A copied gallery folder is not a standalone app.
Existing provenance, original repository URLs, source hashes and license
records describe where bytes came from; preserve them when editing or moving art.

## Check out the art and make a branch

Clone the art repository once in the Visual Studio terminal, then open that
folder in a second Visual Studio window for artwork/project data edits:

```powershell
cd C:\Projects
git clone --branch ashenspire --single-branch https://github.com/cehinds/AI-Art.git
cd AI-Art
git switch ashenspire
git pull --ff-only
git switch -c feature/ashenspire-my-art
```

Create your usual game feature branch separately in AshenSpire. Do not switch
an art checkout to another game's branch to do AshenSpire work.

## Preview and export from the game checkout

Set the explicit mutable authoring checkout in each new terminal session:

```powershell
cd C:\Projects\AshenSpire
$env:ASHEN_ART_CHECKOUT = 'C:\Projects\AI-Art'
node pose-studio/server.mjs --project C:\Projects\AshenSpire
```

Open `http://127.0.0.1:4318/pose-studio/index.html`. Game modules/editor pages
come from AshenSpire; source images and portable projects come from AI-Art.
For the stance review or source game, use either command in another terminal:

```powershell
node tools/alternative-stances-serve.mjs --asset-root C:\Projects\AI-Art
node tools/serve.mjs --asset-root C:\Projects\AI-Art --no-lan --host 127.0.0.1
```

The stance URL is `http://127.0.0.1:4329/pose-studio/stances/index.html`.
Run an exporter from AshenSpire after reviewing its source selection, for example:

```powershell
python tools/class-smash-export.py --asset-root C:\Projects\AI-Art --check
node tools/selected-smash-registration.mjs --asset-root C:\Projects\AI-Art --check
node tools/export-layered-card-art.mjs --asset-root C:\Projects\AI-Art --check
```

`--check` verifies existing outputs. Omit it only when deliberately exporting
reviewed changes. The exporter writes image/project outputs to AI-Art and
generated catalogs/indexes to the game checkout. Keep each generated catalog
with the matching art PR; compare `git diff` in **both** checkouts. Exporters
that encode images still require their documented existing encoder/Pillow or
browser tooling. These commands do not install dependencies or publish a release.

## Publish art, then pin a verified release in the game

1. Commit sources/exports and preserved attribution to your AI-Art feature
   branch. Review/merge that PR into **`ashenspire`**. Follow that branch's
   release workflow to publish an **`ashenspire-hd-assets-v<N>`** release.
   Archive filenames remain `hd-assets-v<N>.zip`, `light-assets-v<N>.zip` and
   `common-assets-v<N>.zip`. A source commit alone does not update the game.
2. The game pin-bump workflow can open the matching game PR. For the manual
   path, update `art-release.json` to the published tag, all archive names and
   their verified SHA-256 checksums; then run `node tools/art-manifest.mjs --write`
   and `node tools/fetch-art.mjs --pack light,common` in AshenSpire. Include
   matching generated catalog changes in that game PR. Never invent checksums
   or advance a pin to an unpublished release.
3. Clear the authoring override before validating the pinned game:

   ```powershell
   Remove-Item Env:ASHEN_ART_CHECKOUT -ErrorAction SilentlyContinue
   node tools/art-manifest.mjs --check
   node tools/serve.mjs --no-lan --host 127.0.0.1
   ```

The verified runtime download lives under `.art-cache/<tag>/<pack>/`. Treat it
as immutable: do not edit images there or point an exporter at it. With no
`ASHEN_ART_CHECKOUT`, the source game and Asset Gallery use the pinned runtime
release; unpublished art appears only in explicit authoring mode. The common
pack carries the display images; the game retains their JSON/catalog metadata.
`ASHEN_ART_SOURCE=trees` is reserved for tools' copied test sandboxes.

## Source checks and runtime checks

The game test `tests/class-smash-export.test.mjs` keeps a separate game/art
fixture with real tiny PNGs. It checks geometry, airborne registration,
bookends, malformed/corrupt sources and approval rejection. Its production
runtime test verifies final raster bytes and retained registration metadata.
It does not re-read production art masters from the game checkout.

The corresponding production-source checks run in **AI-Art/ashenspire** with
`node tools/source-integrity.mjs`: actual PNG hashes for all four class-Smash
roles, the original provenance JSON hash, and the original first/last held PNG
hashes and byte identity for rogue, starseer and herald. These are separate
from runtime-image/manifest checks; source hashes recorded in metadata alone
do not establish source-file integrity. Run that command in an explicit art
checkout when changing those packages. Existing historical source/credit
records remain preserved.

## Online documents and local interactive galleries

Retained Markdown documents use immutable AI-Art links for moved images and downloads, so their online previews keep working after relocation. Interactive HTML galleries keep relative project paths and game-code imports. For local or offline review, keep both checkouts available and use the composite server commands above with an explicit `ASHEN_ART_CHECKOUT` or `--asset-root`; opening the game HTML directly from disk does not compose the separate art tree. The composite server serves game code from AshenSpire and editable art from AI-Art without allowing an art checkout to replace executable game modules.
