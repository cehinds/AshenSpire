# Moving high-res art out of this repository — plan

Status: **PLAN ONLY — nothing has moved.** Step 5 of the LFS / art-tier work
(2026-09-26). Every step below that creates a repository, publishes a release,
or deletes files from the tree waits for the owner's go-ahead on the questions
at the end.

## Why

- The Git LFS budget ran out on built HTML. That part is fixed by #1332 (built
  HTML is no longer committed) and #1336 (dev/test builds use the light art tier).
- The source art is still the bulk of every clone. Measured on `dev` at
  `877b4807`:

  | tree | size | tracked files | what it is |
  |---|---|---|---|
  | `art/` | 1.6 GB | 6,536 | authoring sources: reference sheets, pose studies, outfit and weapon sets, map sources, inspection pages |
  | `assets/` | 194 MB | 5,265 | the full-resolution runtime art (the high-res tier) |
  | `assets-mobile/` | 27 MB | — | the light tier, generated from `assets/` by `tools/mobile-art.mjs` |
  | `map-detail/`, `music/` | 12 MB, 5.6 MB | 121 | runtime data both tiers ship |

- The high-res tier does not need to be in the repo for now (owner, 2026-09-26).
  Dev/test builds already ship the light tier only.

## Owner decisions this plan follows (2026-09-26)

1. The high-res originals go in a **tarball attached to a GitHub Release** (for
   example `hd-assets-v1`), **not Git LFS**, because LFS is billed per account.
2. A **committed manifest** lists every file in the tarball: path, sha256, size,
   and pixel dimensions.
3. A **fetch tool** downloads a release and checks every hash before anything
   uses it.
4. `art/` (source art) moves out together with the high-res originals.
   `docs/preview` stays, with a cap on new screenshot sizes.
5. History is left alone: no rewrite, no force-push. The owner asks GitHub
   Support to purge the old LFS build objects.

## Where it goes

A new repository, **`cehinds/AshenSpire-art`**, holds:

- `art/` — the authoring sources, as ordinary Git (it has never been LFS);
- `hd/` — the build script that packs `assets/` into the release tarball;
- `manifest.json`, generated, one row per file:
  `{ "path": "assets/…", "sha256": "…", "bytes": n, "width": w, "height": h }`;
- Releases `hd-assets-v<N>`, each with `hd-assets-v<N>.tar.zst` (or `.zip`) and
  its `manifest.json` attached.

This repository keeps:

- `assets-mobile/` (the light tier);
- `map-detail/` and `music/`;
- `content/art-manifest.json` from step 3, extended with the pinned release tag
  and the tarball's sha256;
- `tools/fetch-art.mjs`.

`assets/` itself is removed from the tree in the last step (below), once nothing
reads it except the high-res tier.

## What reads these trees today, and what each becomes

| reader | reads | after the move |
|---|---|---|
| `tools/bundle.mjs --full-art` (release/main builds) | `assets/` | reads `.art-cache/hd-assets-v<N>/assets/`, filled by `tools/fetch-art.mjs`; CI fetches before building |
| `tools/mobile-art.mjs` (regenerates the light tier) | `assets/` | same fetch; runs only when the art changes |
| `tools/serve.mjs` (local dev from source) | `assets/` | serves the light tier by default; `--hd` serves the fetched cache |
| ship tools: `pose-ship`, `painted-outfits-ship`, `painted-items-ship`, `readiness-poses-ship`, `combat-effects-ship`, `environment-art-build`, `map-detail-build`, `card-effect-art-build` | `art/` | move to `AshenSpire-art`; each publishes its runtime output into a new `hd-assets` release |
| checks: `painted-outfits-check`, `painted-items-check`, `card-effect-art-check`, `card-effect-layers-check` | `art/` | move with the ship tools, or read the fetched cache |
| browser QA: `sword-shield-`, `twin-sword-`, `unarmed-animation-browser` | `art/` | move to `AshenSpire-art` |
| tests: `dagger-animation`, `twin-sword-animation`, `unarmed-animation`, `unarmed-magic`, `prologue`, `combat-prototypes-ui` | `art/` | the parts about source art move to `AshenSpire-art`'s CI; the parts about runtime behaviour read `assets-mobile/` or small committed fixtures. **Nothing is skipped or deleted to get green.** |
| `dev-preview.yml` "Collect the playable build" | `art/…/inspection`, `art/pose-studio`, `art/card-effect-refresh-…` | those inspection pages are published from `AshenSpire-art`'s own preview workflow |

## Sequence (one reviewed PR, or one owner action, per step)

1. **Owner:** create `cehinds/AshenSpire-art` and decide public or private (Q1).
2. **PR in AshenSpire-art:** import `art/` from this repo's `dev` as it stands. It
   is a plain copy with a pointer to the source commit, so history stays here.
   Add the pack script, which builds the tarball and `manifest.json`, plus CI that
   verifies the manifest against the tarball.
3. **Owner:** publish release `hd-assets-v1` from that PR's merge. Creating a
   release is owner-only (CONTRIBUTING, *Coordination and release boundary*).
4. **PR here:**
   - Add `tools/fetch-art.mjs`. It downloads the pinned release, checks the
     tarball's sha256 and then every file's sha256 against the manifest,
     unpacks into `.art-cache/` (gitignored), and refuses on any mismatch.
   - Pin the tag and hash in `content/art-manifest.json`.
   - Point `--full-art` builds, `mobile-art.mjs` and `serve.mjs --hd` at the cache.
   - CI fetches before any `--full-art` build.
5. **PR here:** move the listed tools and tests (table above) to `AshenSpire-art`,
   or repoint them. Delete nothing that still has a reader.
6. **PR here:** remove `art/` and `assets/` from the `dev` tree, and add them to
   `.gitignore`. By then every reader goes through the fetch, so CI stays green.
   History is untouched.
7. **Owner, separately:** ask GitHub Support to purge the old LFS build objects
   (about 47.6 GB, 306 objects since 2026-09-19). Old commits then lose their
   embedded builds, which the owner has accepted.

`release` and `main` are untouched until the owner promotes these changes.

## What it buys, and what it does not

- **New work stops adding source art to this repo.** Every art change lands in
  `AshenSpire-art` instead.
- **A plain clone does not get smaller.** Git keeps the old blobs in history,
  and step 7 purges only LFS objects, not ordinary Git history. A shallow or
  blobless clone (`--depth 1`, `--filter=blob:none`) does get the ~1.8 GB saving
  once step 6 lands. A smaller full clone would need a history rewrite, which is
  out of scope (only the owner can decide that).
- **Release tarballs are free to store and download,** and each version keeps a
  permanent URL.

## Questions for the owner

- Should `cehinds/AshenSpire-art` be public or private? (public / private)
  - Why it matters: a public repo's release tarball is public too. If the
    originals must stay private, the tarball needs a private repo plus a token
    in CI, or a private bucket.
- Should the tarball be `.tar.zst` (smaller, needs `zstd`) or `.zip` (opens
  anywhere)? (zst / zip)
  - Why it matters: `.zip` is what a player opening "Local high-res" on Windows
    can unpack without tools.
- Go ahead with sequence step 1 (you create the repo), then steps 2–4? (yes/no)
  - Why it matters: nothing moves until you say yes; steps 5–6 get their own
    go-ahead after steps 2–4 land.
