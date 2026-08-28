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
- Portable build: `dist/AshenSpire.html`

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
| Domain models and contracts | `src/model/` | Schemas, state, formulas, validation, and read models; no DOM |
| Headless simulation/services | `src/engine/` | Game operations, orchestration, RNG, and persistence; no browser host |
| Transport adapter | `src/net/lan.js` | Browser-side LAN discovery, hosting requests, and lobby WebSocket adapter; no game rules |
| Screen hosts / presenters | `src/ui/screens/` | Projects snapshots, chooses composition, and binds semantic commands |
| Presentation projections | `src/ui/viewModels/` | Domain-to-screen projection and composition of reusable models |
| Component models and behaviors | `src/ui/models/` | Immutable serializable presentation and interaction records |
| DOM components / observers | `src/ui/components/` | Markup, DOM ownership, lifecycle/event adapters, and rendering |
| Configuration and domain data | `src/content/`, `content/source/` | Pure definitions, balance, JSON, and CSV; no runtime orchestration |
| Assets | `assets/`, `styles/`, `music/` | Player-facing media and presentation resources |
| Composition root | `src/main.js` | Wires the layers together; contains no reusable domain owner |
| Verification | `tests/`, `tools/` | Headless behavior checks, browser witnesses, build and support tools |

Dependencies continue to point from presenters/components to engine, model,
content, and transport; from engine to model/content; and from model to content
where definitions are required. The composition root may also query transport
availability. Transport does not belong to the engine and does not own game
rules. Shared contracts belong in `src/model/`; creating parallel
`application/`, `infrastructure/`, or `interfaces/` trees without a concrete
seam would split one source of truth.

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
3. Run the same-door tests and rebuild checks relevant to that seam. If the seam
   changes bundled source, regenerate and verify the affected tracked
   `build/`/`dist/` twins in the same integration act; do not leave derived
   artifacts stale.
4. Move consumers in a separate, reviewable step.
5. Remove the adapter only after repository-wide search proves no live reader.

Do not combine structural work with balance changes, generated content, or
player-facing UI changes. Derived `build/`/`dist/` twins are carried only when
the existing provenance rules say the changed seam affects them; carrying them
does not authorize independent release work, a release branch, a tag, or a
release. Never mass-move `src/`: its existing layers are already the desired
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
