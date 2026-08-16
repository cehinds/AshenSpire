# AshenSpire architecture map

This is the behavior-neutral target map for making the repository easier to
navigate without changing how the game starts or how ES modules resolve. It is
a migration contract, not permission for a bulk move.

## Player door stays fixed

- Windows: `run.bat`
- macOS/Linux: `run.sh`
- Source entry: `index.html` -> `src/main.js`
- Portable build: `dist/AshenSpire.html`

Those public doors remain compatible throughout any restructuring. A structural
pull request must prove each door it touches before and after the change.

## Current layers, in familiar application terms

AshenSpire already has the separation commonly expressed as Models, Services,
Controllers, and Assets. Preserve the existing names because browser imports
and the no-build ES-module runtime make their paths part of the compatibility
surface.

| Familiar application term | AshenSpire owner | Boundary |
|---|---|---|
| Models and interfaces | `src/model/` | Schemas, state, formulas, validation, and read models; no DOM |
| Services | `src/engine/` | Headless game operations, orchestration, RNG, persistence, and networking adapters |
| Controllers and views | `src/ui/` | Input translation and rendering; the only layer that owns the DOM |
| Configuration and domain data | `src/content/` | Pure definitions and balance data; no runtime orchestration |
| Assets | `assets/`, `styles/`, `music/` | Player-facing media and presentation resources |
| Application composition root | `src/main.js` | Wires the layers together; contains no reusable domain owner |
| Verification | `tests/`, `tools/` | Headless behavior checks, browser witnesses, build and support tools |

Dependencies continue to point from UI to engine/model/content, from engine to
model/content, and from model to content where definitions are required. Shared
contracts belong in `src/model/`; creating a parallel `interfaces/` tree would
split one source of truth.

## Root allowlist

The root is a front door, not a workspace. New root entries require an
architecture reason. The intended categories are:

| Root entry | Purpose |
|---|---|
| `.claude/`, `.github/`, `.gitignore`, `.gitattributes` | Repository automation and contributor guidance |
| `README.md`, `CONTRIBUTING.md`, `DEVELOPER.md`, `SPEC.md`, `PROMPT.md`, `CREDITS.md`, `LICENSE` | Human entry points, contracts, and licensing |
| `index.html`, `run.bat`, `run.sh` | Obvious player/developer entry points |
| `src/`, `content/` | Runtime source and authoritative source data |
| `assets/`, `styles/`, `music/` | Static presentation resources |
| `tests/`, `tools/` | Verification and development support |
| `build/`, `dist/`, `buildordinal.json` | Derived and distributable artifacts governed by existing provenance checks |
| `desktop/` | Optional desktop wrapper kept separate from the browser application |
| `docs/` | Supporting design, architecture, and evidence documents |

IDE state, scratch files, ad-hoc reports, and one-off scripts do not belong at
the root. They stay ignored, live under an existing owned folder, or remain
outside the repository.

## Reversible migration rule

Restructure one seam per pull request:

1. Name the old public path and its consumers.
2. Add the destination or compatibility adapter without deleting the old door.
3. Run the same-door tests and rebuild checks relevant to that seam.
4. Move consumers in a separate, reviewable step.
5. Remove the adapter only after repository-wide search proves no live reader.

Do not combine structural work with balance changes, generated content,
player-facing UI changes, or release artifacts. Never mass-move `src/`: its
existing four-layer organization is already the desired architecture, and
moving it would create import churn without improving ownership.

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
