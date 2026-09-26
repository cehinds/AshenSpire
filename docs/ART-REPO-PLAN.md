# Moving high-res art out of this repository — plan

Status: **PLAN ONLY — nothing has moved.** This is step 5 of the LFS / art-tier
work (2026-09-26). Every step below that creates a repository, publishes a
release, or deletes files from the tree waits for the owner's answers to the
questions at the end.

## Why

- The Git LFS budget ran out on built HTML. That part is fixed:
  - #1332 stops committing built HTML;
  - #1336 makes dev/test builds use the light art tier.
- The source art is still the bulk of every clone. Measured on `dev` at `877b4807`:

  | tree | working-tree size | tracked files | what it is |
  |---|---|---|---|
  | `art/` | 1.6 GB | 6,536 | authoring sources: reference sheets, pose studies, outfit and weapon sets, map sources, inspection pages |
  | `assets/` | 194 MB | 5,265 | full-resolution runtime art (5,201 files that ship), 41 authoring-only files in `equipment/components/` (39 WebP reference strips, a README and a manifest), and **23 non-art files** (below) |
  | `assets-mobile/` | 27 MB | 5,201 | the light tier, generated from `assets/` by `tools/mobile-art.mjs` |
  | `map-detail/`, `music/` | 12 MB, 5.6 MB | 116 + 5 | runtime data that both tiers ship |
  | `docs/preview/` | 161 MB | — | screenshots; stays, with new screenshots capped (owner) |

- The high-res tier does not need to be in this repo for now (owner, 2026-09-26).
  Dev/test builds already ship the light tier only.

## Owner decisions this plan follows (2026-09-26)

1. **Where the originals go:** a **tarball attached to a GitHub Release** (for
   example `hd-assets-v1`), **not Git LFS**. LFS is billed per account.
2. **A committed manifest** lists every file: path, sha256, size and pixel
   dimensions. It is `art-manifest.json` from #1338
   (`tools/art-manifest.mjs`).
3. **A fetch tool** downloads a release and checks every hash before anything
   uses it.
4. **`art/` moves too.** `art/` (the source art) moves out with the high-res
   originals. `docs/preview` stays, with new screenshot sizes capped.
5. **History is left alone:** no rewrite and no force-push. The owner asks GitHub
   Support to purge the old LFS build objects.

## Where it goes

A new repository, **`cehinds/AshenSpire-art`**, holds:

- **`art/`:** the authoring sources, as plain Git (they have never been in LFS),
  plus `assets/equipment/components/`: its 39 WebP strips are modelling and
  inventory-art references (CREDITS.md), never shipped (`tools/assetmime.mjs`
  excludes them), so they are source art and move with its README and manifest.
- **`hd/assets/`:** the full-resolution runtime art, as plain Git. It is the
  reviewable source of every release, so an art change is a normal PR there.
- **A pack script and CI:** they build `hd-assets-v<N>.zip` and its
  `art-manifest.json` from `hd/assets/`, and verify one against the other.
- **Releases `hd-assets-v<N>`:** each has the `.zip` and `art-manifest.json`
  attached. Only the owner publishes a release.

This repository keeps:

- `assets-mobile/` (the light tier);
- `map-detail/` and `music/`;
- `art-manifest.json` (derived, as today) and **`art-release.json`**, the
  authored pin: the release's repo, tag, zip name and zip sha256. The pin is its
  own file because `--write` regenerates the manifest from the trees. Both
  **join the build identity** (`BUILD_IDENTITY_FILES` in `tools/buildversion.mjs`)
  in the step-4 PR that first builds full art from the fetched cache: from then
  on the digest no longer sees the full art itself, so moving the pin must move
  the build number. (While `assets/` is still here both files are derived from
  inputs the digest already covers.) That PR also adds the two root files to
  every sandbox that copies the repo and builds or serves it: doorplant's
  `COPY_SET`, `tools/bundle.test.mjs`, `tools/sfx-filename-convention.mjs` and
  the rest a `git grep mkdtempSync` finds, or `sourceDigest` refuses there;
- `tools/fetch-art.mjs`;
- **the 23 non-art files now under `assets/`**, moved to a tracked root folder such as `asset-data/` (`content/` accepts only compiled sources)
  (or kept in a tracked `assets/` that holds only them; decided in step 4).
  They are:
  - 12 JSON manifests: `equipment/manifest.json`, `poses/pose-sprites.manifest.json`,
    `sprites/class-sprites.manifest.json` and others;
  - `framework/silence.txt`, named as a source path by `src/framework/data/assets.js`;
  - `fonts/OFL.txt`;
  - the scripts and notes under `assets/classes/`.

### How an art change flows after the move

1. A PR in AshenSpire-art changes `hd/assets/` (or `art/` and a ship tool).
2. The owner publishes `hd-assets-v<N+1>`.
3. A PR here bumps the pin in `art-release.json`, runs
   `tools/fetch-art.mjs`, and regenerates `assets-mobile/` with
   `tools/mobile-art.mjs` from the fetched cache. `art-manifest.mjs --check`
   then confirms that the light and high tiers agree.

## Every reader of `art/` and `assets/`, and what each becomes

### Readers of `assets/` (the high tier)

| reader | when it runs | reads | becomes |
|---|---|---|---|
| `tools/bundle.mjs --light` / `--mobile` | **every dev/test build** (ci.yml, dev-preview.yml, launch.mjs) | walks `assets/` as the reference list the twins must mirror | reads the id list from `art-manifest.json`; no fetch needed |
| `tools/bundle.mjs --full-art` | release/main builds, including pages-builds' main build | `assets/` | `.art-cache/hd-assets-v<N>/` filled by `tools/fetch-art.mjs`; each of those jobs fetches first |
| `tools/mobile-art.mjs --check` | **every push** (ci.yml, dev-preview.yml) | sizes `assets/` against its twins | checks the twins against the manifest's high-tier sizes and dimensions; no fetch |
| `tools/mobile-art.mjs` (regenerate) | when art changes | `assets/` | the fetched cache |
| `tools/credits-check.mjs` | every push (ci.yml) | enumerates `assets/*` folders | enumerates the manifest's id prefixes |
| `tools/verify-external.mjs` | every push (dev-preview.yml) | takes its file list from `assets/` | takes it from the manifest (full or light tier by the page's edition) |
| `tools/hand-side-probe.mjs` | every push (ci.yml, dev-preview.yml) | `existsSync` on `assets/equipment/*`; measures pixels served from `assets/` | measures the light tier (baselines re-measured in that PR), or fetches for a full-art run |
| dev-preview "Collect the playable build" | every push | `cp -r assets/environments`, `pose-effects`, `combat-effects`, `painted-outfits` into `preview/` | copies from the built web edition (which already carries the tier's art) |
| `tests/run-node.mjs` check 33 | every test run | reads `assets/equipment/manifest.json` (it warns and skips without it) | reads it from its new home in this repo; **it must not start skipping** |
| `tests/run-node.mjs` check 49 (`assetExists`) | every test run | stats files under `assets/` | checks ids against the manifest |
| `tests/run-node.mjs` check 79 (pose frames) | every test run | `existsSync` on every generated frame under `POSE_DIR` (`assets/poses/`) | checks the frame ids against the manifest |
| `tools/bundle.test.mjs` (parse gate, EOL corpus) | every CI run (`ci.yml`, `tests.yml`) | its sandboxes copy `assets/`, run the unflagged (full-art) bundler, and read `assets/bg/bg_act1.webp` | sandboxes copy `assets-mobile/` and build with `--light`; the EOL corpus reads the light twin |
| `tools/content-build.mjs --mutate` (M6/M7) | by hand and its self-test | sweeps the real `assets/` and copies it into fixtures; M6 renames `assets/sprites/enemy_wanderingSoldier.webp` | builds its fixture tree from the manifest's ids (placeholder bytes, as its other cases already write) |
| `tests/content-expansion-equipment.test.mjs` | every test run | `existsSync` on `assets/equipment/icon_*`, `weapon_*`, `body_*` | checks ids against the manifest |
| `tools/rogue-parity.mjs` (spawned by `tests/content-validators.test.mjs`) | every test run | `existsSync` on `assets/sprites/rogue_*.webp` and `assets/equipment/body_rogue_*.webp` | checks ids against the manifest |
| `tests/environment-art.test.mjs`, `tests/relic-art.test.mjs` | every test run | `existsSync` on every environment, world-map and painted-relic path | check ids against the manifest |
| `tools/buildversion-selftest.mjs` (run by `buildversion --selftest` in `ci.yml`'s reproducible job) | every CI run | copies `assets/` into its corpus; a planted case edits `assets/classes/successor-packet.manifest.json` | copies the kept non-art folder instead of `assets/`, and plants on that file's new path, in the same PR that moves it |
| output-only writers: `tools/concept-cutout.mjs` and `tools/pose-cutout.mjs` (`assets/sprites`), `tools/parchment.mjs` (`assets/map`), `tools/reaver-attack-animation.mjs` (`assets/animations`) | when art changes | nothing; they **write** under `assets/` | move to AshenSpire-art with the ship tools, writing into its `hd/assets/`, so their output enters a release |
| `src/framework/data/assets.js` | runtime data | names `assets/framework/silence.txt` | keeps working because that file stays tracked (see above) |
| `tools/screenshot.mjs` | by hand | reads `assets/sprites/class-sprites.manifest.json` | reads it from its new home |
| `styles/kit.css` | every build | `../assets/fonts/*` | unchanged: fonts have twins, and the build substitutes them |
| README (`npx serve .`, `python -m http.server`) and DEVELOPER ("any static server works") | local dev | a plain static server serves `/assets/…` from disk | the docs name `node tools/serve.mjs` as the way to run from source, because a plain server cannot remap `/assets/…`; the built `AshenSpire.html` still needs no server |
| `tools/serve.mjs` | local dev | serves the repo root, so `/assets/…` is the full art | maps every `/assets/…` URL to `assets-mobile/` by default, and to the kept non-art files for those that have no twin; `--hd` serves the fetched cache |
| `pose-studio/package.mjs`, `editor/server.mjs` | by hand | four `assets/*` trees; `editor` walks all of `assets/` | read the fetched cache (and `art/` below) |

### Readers of `art/` (source art)

| reader | when it runs | becomes |
|---|---|---|
| ship tools: `pose-ship`, `painted-outfits-ship`, `painted-items-ship`, `readiness-poses-ship`, `combat-effects-ship`, `environment-art-build`, `map-detail-build`, `card-effect-art-build` | when art changes | move to AshenSpire-art; their output lands in `hd/assets/` there |
| checks: `painted-outfits-check`, `painted-items-check`, `card-effect-art-check`, `card-effect-layers-check` | by hand / art PRs | move with the ship tools |
| browser QA: `sword-shield-`, `twin-sword-`, `unarmed-animation-browser` | by hand | move to AshenSpire-art |
| `tools/readiness-preview-build.mjs` | **every push** (dev-preview.yml) | reads `art/readiness-poses/preview.html`; that page moves to AshenSpire-art's own preview workflow, and this step is dropped here in the same PR |
| dev-preview copies of `art/…/inspection`, `art/pose-studio`, `art/card-effect-refresh-…` | every push | published from AshenSpire-art's preview workflow |
| `pose-studio/package.mjs`, `editor/server.mjs` | by hand | read a local AshenSpire-art checkout (a path setting), or move there |
| tests: `dagger-animation`, `twin-sword-animation`, `unarmed-animation`, `unarmed-magic`, `prologue`, `combat-prototypes-ui` | every test run | the source-art parts move to AshenSpire-art's CI; the runtime parts read `assets-mobile/`, the manifest or small committed fixtures |

**The tables are a starting inventory, not the whole of it.** Step 4's first
PR records the complete one: every file under `tools/`, `tests/`, `src/`,
`.github/` and `pose-studio/` that `git grep -n "assets/"` finds on `dev` (15 tools
alone on 0.7.1), each classified as reads the high tier, reads a kept non-art
file, writes art, or names an id only through `assetUrl()`. Each gets a row
here, and no reader is left for step 6's grep to find.

**No test is skipped, weakened or deleted to get green.** A check that loses its
input moves along with it, or gets the same input from the manifest.

## Sequence

Each step is one reviewed PR, or one owner action.

1. **Owner:** create `cehinds/AshenSpire-art` and answer Q1 (public or private).
2. **PR in AshenSpire-art:** import `art/` and `assets/` (as `hd/assets/`) from
   this repo's `dev`, with a pointer to the source commit. History stays here.
   Add the pack script and the CI that verifies it.
3. **Owner:** publish release `hd-assets-v1` from that PR's merge.
4. **PR here — readers stop needing `assets/`:**
   - Add `tools/fetch-art.mjs`. It downloads the pinned release, checks the
     zip's sha256 and then every file's sha256 against the manifest, unpacks
     into `.art-cache/` (gitignored), and refuses on any mismatch.
   - Pin the tag and hash in `art-release.json`.
   - Move the 23 non-art files.
   - Add `art-manifest.json` and `art-release.json` to `BUILD_IDENTITY_FILES`, with the sandbox copies that need them (above), in the PR that first builds full art from the cache.
   - Switch every `assets/` reader in the first table to the manifest, or to a
     fetch in the jobs that build full art.
5. **PR here — readers stop needing `art/`:** move or repoint every reader in the
   second table. Delete nothing that still has a reader.
6. **PR here — delete:** remove `art/` and the art under `assets/` from the `dev`
   tree and add them to `.gitignore`.
   - **Precondition:** `git grep -nE "['\"\`/](art|assets)/"` outside `assets-mobile`
     and the manifest finds only fetch-aware code, or ids resolved through
     `src/ui/assetmap.js`.
   - The PR lists that grep's output.
   - History is untouched.
7. **Owner, separately:** ask GitHub Support to purge the old LFS build objects
   (about 47.6 GB, 306 objects since 2026-09-19, as reported to the owner).
   - **Precondition:** `release` and `main` no longer track LFS HTML (their
     promotions carry #1332), and `pages-builds` no longer checks out with
     `lfs: true` or reads purged historical builds.
   - Otherwise that job, and the Pages history it assembles, break.
   - Old commits lose their embedded builds; the owner has accepted that.

`release` and `main` are untouched until the owner promotes these changes.

## What it buys, and what it does not

- **This repo stops growing with art.** New art lands in AshenSpire-art instead.
- **A plain clone does not get smaller.** Git keeps the old blobs in history, and
  step 7 purges LFS objects only. A shallow or blobless clone (`--depth 1`,
  `--filter=blob:none`) does lose the ~1.8 GB working-tree weight once step 6
  lands. A smaller full clone would need a history rewrite, which is out of
  scope and the owner's call alone.
- **Release assets cost nothing to store or download, and each version keeps a
  permanent URL.** No file here comes near the 2 GiB per-asset limit: the
  largest single file in `art/` or `assets/` is under 50 MB.

## Owner answers (2026-09-26)

- Q1. **Private.** `cehinds/AshenSpire-art` is a private repository.
  - CI in this repo cannot read its releases with the default `GITHUB_TOKEN`. The jobs that fetch (full-art builds, pages-builds' main build) read a repository secret `ART_REPO_TOKEN`: a fine-grained token with read-only *Contents* access to `AshenSpire-art`. The owner creates it; step 4 names the secret and fails with that name when it is missing.
  - `tools/fetch-art.mjs` reads the same token from `ART_REPO_TOKEN` (or `GITHUB_TOKEN`) for a local fetch.
  - A private release is downloadable only by people with access to the repo, so it does not by itself reach players who want **Local high-res**; see the open question below.
- Q2. **Zip.** Releases are `hd-assets-v<N>.zip`.
- Q3. **Yes.** Go ahead with steps 1–4; steps 5–7 each still need their own go-ahead.
- #1332 is approved for promotion to `release` (the owner merges it there).

## Status

- Step 1 is waiting on the owner: this session's GitHub integration cannot create repositories (403), so `cehinds/AshenSpire-art` must be created by hand (private, empty or with a README), with the Claude GitHub App given access to it.
- Step 2's contents (pack script, CI, README) are prepared and pushed as soon as the repository exists.

## Open question

- Should players get the high-res zip from somewhere public, since the art repo is private? (attach to AshenSpire releases / collaborators only)
  - Why it matters: the Local high-res setting needs the files on the player's device; a private release reaches only people with repo access.
