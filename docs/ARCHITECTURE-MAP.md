# AshenSpire architecture map

This is the stable core contract and navigation map for the AshenSpire
composition/component remodel. It describes ownership boundaries that must
survive every current-`dev` refresh without changing how the game starts or how
ES modules resolve. It is a migration contract, not permission for a bulk move.

The changing implementation inventory is generated in
[`ARCHITECTURE-CURRENT-DEV.md`](./ARCHITECTURE-CURRENT-DEV.md) by
`tools/update-architecture.mjs`. The refresh routine may update that snapshot;
it does not rewrite this core contract or the component-model contract.

## Player door stays fixed

- Windows: `run.bat`
- macOS/Linux: `run.sh`
- Source entry: `index.html` -> `src/main.js`
- Portable build: `dist/AshenSpire.html`, written locally by `run.sh` / `run.bat`
  (`tools/launch.mjs`). Since EXTERNAL-ASSETS-PLAN step 8e it is the pack-shaped
  game file and opens by double-click while its `packs/` and `objects/` stay
  beside it; `dist/download/AshenSpire.html` (and the root `AshenSpire.html`)
  is the self-contained light single file. Not tracked on `dev`, where CI
  publishes the light single file as the `dev-standalone-<commit>` workflow
  artifact

Those public doors remain compatible throughout any restructuring. A structural
pull request must prove each door it touches before and after the change.

## Core redesign contract

AshenSpire uses a composition/component-based architecture. .NET and Dimitar's
naming and coding practices are conventions for clarity, not a requirement to
introduce a .NET runtime, MVC framework, or MVVM folder structure.

- `src/main.js` is the composition root: it wires existing owners and contains
  no reusable domain owner.
- `src/model/` owns pure state, schemas, formulas, validation, and projections;
  it never owns the DOM.
- `src/engine/` owns headless simulation, orchestration, RNG, and persistence;
  it never imports presentation code or browser hosts.
- UI screen hosts act as presenters: they project domain snapshots into
  immutable Component Models, ask components to render, and bind semantic
  commands at the boundary.
- Component Models are serializable, deeply frozen trees. Renderers own DOM
  markup; Behavior Models and observer-style adapters own interaction wiring.
- JSON/CSV source data owns content and tuning. Code supplies reusable rules and
  interpreters rather than one imperative implementation per card, enemy, or
  item.
- MVP and Observer are useful presentation techniques inside these boundaries;
  they are not permission to move game rules into views or make the DOM the
  source of truth.
- Public player doors, save compatibility, keyboard/gamepad semantics, and
  exact-head verification remain stable while seams migrate.

## Current `dev` layers and ownership

AshenSpire already has most of the desired separation. Preserve the existing
paths because browser imports and the no-build ES-module runtime make them part
of the compatibility surface.

| Composition/component role | AshenSpire owner | Boundary |
|---|---|---|
| Configuration | `src/config/` | Authored and generated config; imports nothing (rank 0) |
| Kernel and runtime | `engine/` | Root kernel, runtime interpreter, mechanics/UI contracts, and Unity export; headless, below `src/model/` |
| Domain models and contracts | `src/model/` | Schemas, state, formulas, validation, and read models; no DOM |
| Framework | `src/framework/` | Reusable game-framework pieces beside the model; imports no `src/ui/` |
| Headless simulation | `src/engine/` | Game operations, orchestration, RNG, and persistence; no browser host |
| Services | `src/services/` | Headless services beside the engine |
| Screen hosts / presenters | `src/ui/screens/` | Projects snapshots, chooses composition, and binds semantic commands |
| Presentation projections | `src/ui/viewModels/` | Domain-to-screen projection and composition of reusable models |
| Component models and behaviors | `src/ui/models/` | Immutable serializable presentation and interaction records |
| DOM components / observers | `src/ui/components/` | Markup, DOM ownership, lifecycle/event adapters, and rendering |
| Configuration and domain data | `src/content/`, `content/source/` | Pure definitions, balance, JSON, and CSV; no runtime orchestration |
| Assets | `assets/`, `styles/`, `music/` | Player-facing media and presentation resources |
| Dev screens | `src/dev/` | Dev- and test-only screens; top layer, nothing imports them |
| Composition root | `src/main.js` | Wires the layers together; contains no reusable domain owner |
| Verification | `tests/`, `tools/` | Headless behavior checks, browser witnesses, build and support tools |

Dependencies point from presenters/components to engine, model, and content;
from engine to model/content; and from model to content where definitions are
required. Shared contracts belong in `src/model/`; creating parallel
`application/`, `infrastructure/`, or `interfaces/` trees without a concrete
seam would split one source of truth.

### Layer rank

Lowest first:

0. `src/config/`
1. `src/content/`
2. `engine/` (root kernel)
3. `src/model/` and `src/framework/` (peers; either may import the other)
4. `src/engine/` and `src/services/` (peers)
5. `src/ui/`, `src/main.js`, `src/dev/` and any other `src/*` file (top)

An import points from a higher rank to a lower or equal rank, and
`src/framework/` imports no `src/ui/`. `tests/layering.test.mjs` enforces this
with a shrinking `KNOWN_INVERSIONS` list: a new inversion fails, and a listed
one that no longer occurs must be deleted.

## Root allowlist

The root is a front door, not a workspace. New root entries require an
architecture reason. The intended categories are:

| Root entry | Purpose |
|---|---|
| `.claude/`, `.github/`, `.gitignore`, `.gitattributes` | Repository automation and contributor guidance |
| `tasks.vs.json` | Shareable Visual Studio Open Folder commands for the existing Node scripts; local Visual Studio state stays in ignored `.vs/` |
| `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `DEVELOPER.md`, `SPEC.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE` | Human entry points, contracts, receipts, and licensing |
| `index.html`, `run.bat`, `run.sh` | Obvious player/developer entry points |
| `src/`, `content/` | Runtime source and authoritative source data |
| `styles/`, `music/` | Static presentation resources: the stylesheets, and `music/score/` (the score as code; its renders are the art release's). `assets/`, `assets-mobile/` and `map-detail/` left the root at EXTERNAL-ASSETS-PLAN step 13 (2026-10-03): they are the art release's packs, fetched into the ignored `.art-cache/` (`tools/fetch-art.mjs`) |
| `asset-data/` | The non-art files that used to sit under `assets/` (JSON manifests, class-art notes and checkers, the font licence text, the silent audio stub), at the same paths below the folder ([ART-REPO-PLAN.md](./ART-REPO-PLAN.md), step 4) |
| `art-manifest.json`, `art-release.json` | The per-tier asset manifest and the pinned art release (`cehinds/AshenSpire-art`); `art/`, the source art, left with step 13 ([ART-REPO-PLAN.md](./ART-REPO-PLAN.md) step 6) |
| `editor/`, `pose-studio/`, `ui-studio/`, `*-preview.html` | Local authoring tools and content preview pages |
| `tests/`, `tools/` | Verification and development support |
| `build/`, `dist/`, `buildordinal.json` | Build outputs: the pack-shaped game file with its `packs/` and `objects/`, and the light single file under `download/` (EXTERNAL-ASSETS-PLAN step 8e), all ignored on `dev` (only `dist/README.md` is tracked); `buildordinal.json` is committed and checked by `tools/buildversion.mjs --check` |
| `desktop/` | Optional desktop wrapper kept separate from the browser application |
| `docs/` | Supporting design, architecture, and evidence documents |
| `scratch/`, `tooltip-review.html`, `tooltip-review-scene.html`, `.nojekyll` | Also tracked at the root today: a scratch area, tooltip review pages, and the Pages no-Jekyll marker |

IDE state, scratch files, ad-hoc reports, and one-off scripts do not belong at
the root. They stay ignored, live under an existing owned folder, or remain
outside the repository.

## Reversible migration rule

Restructure one seam per pull request:

1. Name the old public path and its consumers.
2. Add the destination or compatibility adapter without deleting the old door.
3. Run the same-door tests and rebuild checks relevant to that seam. If the seam
   changes bundled source, rebuild and commit what the tools regenerate
   (generated content/config modules, `buildordinal.json`, the changelog
   module; DEVELOPER.md, *Run & test*); built HTML is never committed on `dev`.
4. Move consumers in a separate, reviewable step.
5. Remove the adapter only after repository-wide search proves no live reader.

Do not combine structural work with balance changes, generated content, or
player-facing UI changes. A rebuild does not authorize independent release
work, a release branch, a tag, or a release. Never mass-move `src/`: its existing layers are already the desired
architecture, and moving them would create import churn without improving
ownership.

## First safe follow-ups

These are candidates, not pre-approved work:

1. Add a root-shape check that reports unexpected tracked root entries without
   moving any file.
2. Document the composition boundary of `src/main.js`, then extract at most one
   behavior-neutral wiring seam if it has more than one owner.
3. Keep developer launch details behind `tools/launch.mjs`; retain `run.bat`
   and `run.sh` as the stable, obvious wrappers.

Any follow-up must begin from current `dev`, claim exact paths, avoid the
authoritative CSV/generated-content boundary, and receive independent review.

## Automatic current-`dev` refresh

`.github/workflows/architecture-sync.yml` runs on every push to `dev`, including
the push created by a merged pull request. It runs
`tools/update-architecture.mjs --verify`, updates only
`docs/ARCHITECTURE-CURRENT-DEV.md`, and leaves this contract and
`docs/COMPONENT-MODEL-ARCHITECTURE.md` untouched. The generated commit is marked
`[architecture-sync]` so the routine cannot loop on its own update.
