# Proposed automatic Art Design Integration Policy

Status: **local proposal; not approved, pushed, merged, or published**.

## Outcome

When an art suggestion is explicitly approved, its integration package becomes
mandatory automatically. Approval does not itself authorize runtime
implementation, changes to shared paths, a push, merge, release, publication,
board mutation, or product-scope expansion. Main records the approval, assigns
one owner per path, and routes each part through the existing authority gates.

An art suggestion is not integration-ready until the package below is complete,
internally consistent, and traceable to the approved suggestion. Missing items
remain visible as blockers; they are not waived by a mockup, binary asset, or
green screenshot alone.

## Trigger and routing

1. Help Desk records the suggestion, evidence, affected surfaces, exact
   build/SHA when known, status, dependencies, and smallest next action.
2. Main performs technical triage and routes every question, ambiguity,
   approval request, design selection, scope decision, and blocker. Teams do
   not ask Constantine directly or create a second decision channel.
3. Before approval, Art may prepare bounded proposals and comparison evidence.
   No proposal may claim new mechanics, lore, component ownership, or delivery
   authority.
4. After explicit approval, Main records the approved option and scope. That
   approval triggers the required integration package, with named owners and
   exact paths, but grants no unrecorded implementation or remote-mutation
   authority.
5. Help Desk tracks the package and handoffs. It records status and ownership
   but does not implement, approve, sequence, or mutate delivery state.

When a decision is needed, the owning lead sends Main the exact evidence, two
or three materially different options when applicable, a recommendation and
trade-off, the smallest next action, and the exact authority needed or `No new
authority`.

## Required integration package

Every approved art suggestion must produce all of the following. Use `Not
applicable` only with a short reason and Main's recorded acceptance.

### 1. Stable model and component IDs

- Name every affected model, component, state, and variant with stable semantic
  IDs rather than filenames, screen positions, or visual descriptions.
- Record existing IDs that remain authoritative and proposed IDs that must be
  added. Do not silently rename a public or saved identifier.
- Use one canonical vocabulary across the registry, catalog, UI copy, tests,
  screenshots, issue/PR summary, and changelog.

### 2. Shared-component and reuse matrix

List each visual need, its approved shared component or primitive, all intended
consumers, the owning source, and whether the change extends or only configures
that component.

| Visual need | Stable ID | Shared source | Consumers | Reuse action |
|---|---|---|---|---|
| _required_ | _required_ | _path or registry entry_ | _screens/states_ | _reuse / configure / approved extension_ |

Similar models must reference shared components. A new one-off component needs
an explicit reason that an existing component cannot express the approved
result and Main's recorded architecture decision.

### 3. Binary asset manifest

Inventory every added, changed, replaced, or removed binary asset.

| Asset ID | Repository path | Format | Dimensions or duration | Size | Variants | Source/provenance | Licence | Consumers |
|---|---|---|---|---|---|---|---|---|
| _required_ | _required_ | _PNG/WebP/SVG/audio/etc._ | _required_ | _required_ | _required or none_ | _required_ | _required_ | _stable IDs_ |

The manifest must identify source files and derived/exported files, supported
formats, naming rules, optimization expectations, and replacement/removal
effects. Binary files may not become the only record of design intent.

### 4. Config and model reference contract

- Define the data/config keys that map stable model/component IDs to asset IDs,
  variants, presentation tokens, accessibility text, and fallbacks.
- Name the authoritative source path and any generated projections. Renderers
  consume references; they do not embed asset choices or game rules.
- Specify missing, invalid, and unavailable-asset behavior. The fallback must
  remain usable, testable, and visible to QA.
- Record compatibility or migration behavior for renamed/replaced IDs and any
  save-data impact.

### 5. Service and architecture decision

Reuse existing loaders, registries, renderers, component models, behaviors, and
services. Do not create a screen-specific asset loader, registry, caching layer,
or other one-off service when an existing boundary can own the work.

If no existing service fits, send Main an architecture packet naming the gap,
the alternatives considered, the recommended shared boundary, its consumers,
tests, and migration cost. A new service requires its own recorded scope and
implementation authority.

### 6. Catalog entries and accurate previews

- Add or update the machine-readable component registry and every canonical
  human-facing catalog in the same origin-bound implementation change.
- Each entry names the stable ID, model/factory, renderer, source owner,
  selectors or host contract, variants/states, reuse surfaces, and asset IDs.
- Provide labelled previews from the exact reviewed head for every material
  state. Include the viewport, text-size setting, build/SHA, and input mode when
  they affect the result.
- A preview must use the actual proposed or integrated asset. Placeholders,
  stale captures, and conceptual mockups must be labelled as such and cannot be
  presented as runtime evidence.

### 7. Game Design contract when behavior is affected

If the art communicates or changes an unlock, state, affordance, targeting
rule, timing, reward, availability, or other player behavior, Game Design must
provide the authoritative unlock/behavior contract and acceptance conditions.
Art and Writing may clarify that contract but must not invent a mechanic to
complete the package. The App Team implements only the approved contract.

Purely presentational work records `No behavior change` and cites the current
engine/content behavior it preserves.

### 8. App integration handoff

Substantial runtime wiring is routed by Main to an App Team. The handoff names:

- the approved suggestion and owning Help Desk ticket or issue;
- exact base/head and claimed source, config, test, evidence, and generated
  paths;
- stable IDs, reuse matrix, asset manifest, and reference contract;
- required states, fallbacks, migrations, and Game Design contract;
- unresolved decisions and the exact authority already granted; and
- the expected return receipt and QA entry condition.

The handoff does not transfer Art's visual-source ownership or silently expand
the App Team's product scope.

### 9. QA plan and evidence

The plan must identify functional checks, discriminating negative/RED evidence,
asset failure/fallback checks, and exact-head visual review. QA verifies that
the intended asset is reachable through the real player flow and that the
runtime behavior matches the approved contract; screenshots prove pixels, not
behavior.

Visible changes require representative desktop and approximately `390x844`
phone evidence unless the approved scope records a different target matrix.
Test variants and states named by the catalog, plus affected keyboard, pointer,
touch, and gamepad paths.

### 10. Accessibility and responsive notes

- Record semantic purpose, accessible name or decorative status, reading and
  focus implications, contrast, motion/reduced-motion behavior, and non-color
  state cues.
- Record crop/contain rules, aspect-ratio behavior, density/scale variants,
  reflow, text-size interaction, touch targets, and viewport extremes.
- Player-facing text belongs in data/config where the current architecture
  supports it and must remain concise, localization-ready, and mechanically
  accurate. Do not bake essential words into raster art without an approved
  accessible/localizable equivalent.

### 11. Provenance and licensing

For every source and derived asset, record the creator or source, creation or
acquisition method, licence and attribution requirements, modification history,
and any usage restrictions. AI-assisted material must retain the available
generation/source record and review status. Unknown or incompatible provenance
blocks integration; it is not repaired by moving or renaming the file.

The current repository contract permits CC0, CC BY 3.0/4.0, and SIL OFL assets
only. Every shipped asset is routed through `src/ui/assets.js` and receives its
required source URL, author, and licence entry in `CREDITS.md`.

### 12. Documentation and changelog obligations

Update all authoritative documents affected by the change: README discovery
links when relevant, SPEC/GDD decisions, architecture/reference contracts,
asset and component registries, human-facing catalogs, preview evidence, QA
receipts, credits/licensing, and status or handoff records.

For an origin-bound player-visible change, add concise changelog prose and
refresh any generated in-game changelog projection through its established
tooling. The entry states the player-visible outcome without claiming approval,
merge, deployment, or release before those states are independently verified.

## Completion receipt

The owning lead returns one package receipt to Help Desk and Main containing:

1. approved suggestion, scope, owner, ticket/issue, and decision reference;
2. exact base and reviewed head;
3. stable IDs and reuse matrix;
4. binary manifest and config/model reference contract;
5. service decision and any approved exception;
6. catalog paths and labelled preview evidence;
7. Game Design contract or `No behavior change` evidence;
8. App integration handoff and acknowledgement state;
9. QA results, including negative and desktop/mobile evidence;
10. accessibility, responsive, provenance, and licensing results;
11. documentation and changelog paths; and
12. unresolved blockers, smallest next action, and exact authority needed.

`READY FOR QA`, `READY FOR MAIN`, a local commit, a pushed branch, a merged PR,
a deployed preview, and a release are separate states. Only Main sequences the
handoffs and decisions. Existing repository review, generated-artifact,
publication, board, and Constantine-only release gates remain unchanged.
