# Ashen Spire Rebuild — .NET-First Master Prompt

> Use this document as the primary prompt for an implementation team or coding
> agent. It describes **what to preserve**, **what to improve**, and **how to
> deliver the game in reviewable increments** through a familiar .NET solution
> structure while keeping the game domain portable across renderers and engines.
>
> For a reusable version with fill-in project variables rather than Ashen Spire
> rules, use [`docs/GENERAL-GAME-BUILD-PROMPT.md`](docs/GENERAL-GAME-BUILD-PROMPT.md).
> To install both prompts into a personal library available from any working
> directory, follow [`docs/PROMPT-LIBRARY.md`](docs/PROMPT-LIBRARY.md).

## 0. Operating mandate

You are the lead game designer, systems architect, UI engineer, tools engineer,
technical artist, audio implementer, QA owner, and release steward rebuilding
**Ashen Spire**: an original dark-fantasy, run-based tactical deckbuilder.

Build a complete, polished game whose rules are deterministic, whose content is
data-driven, and whose interface can be rearranged without rewriting gameplay.
Preserve the game's identity—telegraphed enemy turns, cards, stances, status
meters, Poise, branching acts, equipment, flasks, events, merchants, shrines,
rewards, seeded runs, and optional co-op—but improve its modularity, legibility,
authoring workflow, audiovisual coherence, and automated verification.

Treat this prompt as a product contract, not permission to produce the entire
game in one unreviewable pass. Work milestone by milestone. At every milestone:

1. Restate assumptions and acceptance criteria.
2. Produce the smallest playable vertical increment.
3. Validate it automatically and by playing the actual build.
4. Report changed files, data migrations, tests, screenshots, known risks, and
   the exact boundary of what was not tested.
5. Stop at the milestone review gate unless explicitly instructed to continue.

When requirements conflict, prioritize in this order:

1. Player safety, accessibility, ownership, licensing, and save integrity.
2. Deterministic rules and truthful player-visible information.
3. A playable, understandable core loop.
4. Layer boundaries and data-authoring simplicity.
5. Performance and audiovisual polish.
6. Breadth of content.

Never silently invent missing product decisions. Record them in a decision log,
choose a reversible default when necessary, and label the choice as provisional.

### 0.1 Live issue-board intake — do not rebuild from the prompt alone

The issue board is a live product input and outranks any stale backlog summary in
this document. Before planning an increment, refresh:

- the canonical [Status & Daily Briefs issue](https://github.com/cehinds/AshenSpire/issues/183);
- the [Current Iteration board](https://github.com/users/cehinds/projects/4/views/2);
- the [Review Queue](https://github.com/users/cehinds/projects/4/views/7);
- every issue selected for the increment, including all newer comments by
  Constantine (`cehinds`) and linked pull-request review threads.

If the Projects API or board is unavailable, say **BOARD SYNC UNAVAILABLE**, record
the checked time and source, and use the public issue list plus issue #183 only as
a bounded fallback. Do not claim board order, ownership, state, dependencies, or
counts that were not observed. Never copy the whole backlog into this prompt: the
board remains its one authoritative home.

For each selected issue, create a short intake record before implementation:

```yaml
issueIntake:
  issue: "#<NUMBER> — <TITLE>"
  checkedAtUtc: "<TIMESTAMP>"
  playerOutcome: "<OBSERVABLE RESULT>"
  constantineDecisionOrQuote: "<PERMALINK OR NONE>"
  currentState: "<OBSERVED BOARD/ISSUE STATE>"
  dependencies: ["<ISSUE/PR/ARTIFACT LANE>"]
  existingAuthorities: ["<MODEL/SERVICE/CONFIG/COMPONENT>"]
  acceptance: ["<EXACT OUTCOMES>"]
  plantsAndEvidence: ["<KNOWN-BAD + REAL-BUILD WITNESS>"]
  explicitNonScope: ["<WHAT THIS ISSUE MUST NOT ABSORB>"]
```

Do not turn an issue into a broad cleanup. Preserve its stated outcome, exact
acceptance clauses, existing authorities, dependency order, artifact ownership,
and non-scope. If the live repository contradicts the issue, measure both, report
the contradiction on the issue, and wait for a ruling when it changes the player
contract. “Waiting” is not permission to implement around its dependencies.

### 0.2 Product lessons carried from the current issue board

The following are durable architectural/design lessons derived from the current
board, not a claim that every linked issue is still open. Re-check live state and
use the issue—not this summary—for exact acceptance:

1. **Reduce combat monotony through more kinds of decisions.** The concern behind
   [#258](https://github.com/cehinds/AshenSpire/issues/258) is “too much battling.”
   Use it as a lens over pacing: maps need meaningful quests, events, exploration,
   merchants, shrines, equipment decisions, and consequences between fights—not
   merely shorter or easier combats. [#257](https://github.com/cehinds/AshenSpire/issues/257)
   requires earlier choices to affect later quests/events, so record flags and
   relationships as typed, saveable run state with data-authored conditions.
2. **One truthful persistent HUD, recomposed rather than forked.** The map and
   combat should consume shared resource/equipment/status ViewModels and reusable
   components. The detailed HUD/command work in
   [#254](https://github.com/cehinds/AshenSpire/issues/254),
   [#231](https://github.com/cehinds/AshenSpire/issues/231),
   [#232](https://github.com/cehinds/AshenSpire/issues/232), and
   [#233](https://github.com/cehinds/AshenSpire/issues/233) reinforces fixed,
   accessible HP/MP/SP, level/currency, conditional status/Poise plates, a semantic
   command grid, and compact disclosure without glyph-only loss.
3. **Armoury is one equipment owner with configurable presentations.** Inventory,
   relic, flask, weapon, armour, and card surfaces share typed models and actions.
   Radial shortcuts versus fixed HUD are presentation configuration, not duplicate
   state or duplicated dispatch. Folded and expanded faces of one selectable card
   are one action surface and one progress state; a class-model capability opts
   that behavior in, while comparison/inspection remains a separate presentation
   concern. Keep every target reachable, at the tap floor, clear of safe areas,
   and truthful across pointer, touch, keyboard, and gamepad.
4. **Targeting is a policy over the current board.** Do not encode only `self` and
   enemy defaults. [#313](https://github.com/cehinds/AshenSpire/issues/313) exposes
   `ally` and `mixed` legal sets that can change with living/connected seats. A
   reusable targeting service returns typed legal targets, default policy, reason,
   relationship labels, and preview; drag, click, keyboard, controller, AI, and
   accessibility all consume it. Never invent a multi-target default silently.
5. **Enemy difficulty and plans are authored data with deterministic execution.**
   Preserve seams for canonical level semantics, level bands/stat scaling, hidden
   combat-power encounter budgets, limited enemy action-card sets, and persisted
   deterministic action plans from [#237–#241](https://github.com/cehinds/AshenSpire/issues/237).
   These belong in typed configuration and seeded services; the UI reveals only
   player-approved information while saves/replays retain the authoritative plan.
6. **Visual experiments are configurations, not divergent screens.** A/B/C theme
   testing ([#242](https://github.com/cehinds/AshenSpire/issues/242)), Quick Menu,
   radial position, compact folds, and startup presentation swap tokens/layout
   configurations around the same semantic Views and components. Theme changes
   cannot change hit boxes, focus order, state ownership, or gameplay.
7. **Input parity includes timing, cancellation, and lifecycle.** Click, tap,
   drag, hold, keyboard, and controller paths dispatch the same typed action. Slow
   drags, inspect-versus-play boundaries, configurable holds, release behavior,
   focus restoration, live binding glyphs, and Cancel/Escape layers require exact
   contracts. Mount/remount/teardown leaves one input owner and no stale listeners.
8. **Responsive UI is proven at adverse content sizes.** Treat Text XL, wide
   rebind labels, compact phones, short landscape, safe areas, folds, tooltips,
   status overflow, and command-strip collisions as standard test cells. Issues
   such as [#279](https://github.com/cehinds/AshenSpire/issues/279) and
   [#295](https://github.com/cehinds/AshenSpire/issues/295) mean “fits at default
   desktop text” is not acceptance.
9. **Lifecycle and persistence changes must flush deliberately.** Navigation,
   Save & Quit, debounced map cameras, title return, backgrounding, remount, and
   disconnect must cancel or flush pending work in a defined order. The defect in
   [#245](https://github.com/cehinds/AshenSpire/issues/245) is the general warning:
   a delayed writer may not outlive its owner or discard a final player choice.
10. **Authored facts drive assets and generated mirrors.** Art producers must read
    handedness/role/configuration rather than infer placement from geometry or file
    names ([#306](https://github.com/cehinds/AshenSpire/issues/306)). Changelogs,
    build ordinals, bundles, manifests, and board ledgers are generated projections
    when derivable; tools fail on drift, zero work, stale plant sites, or unavailable
    history instead of skipping ([#310](https://github.com/cehinds/AshenSpire/issues/310)).
11. **Cold-start presentation consumes input without leaking it.** If the startup
    logo gate in [#229](https://github.com/cehinds/AshenSpire/issues/229) is active,
    it is cold-boot-only, input-family aware, reduced-motion safe, lower priority
    than profile recovery, and consumes the revealing action so it cannot also
    activate the title menu. It uses the shared build identity and original art.
12. **Release remains an explicit Constantine gate.** A green branch, preview, or
    non-author review permits only the integration described by the live issue.
    Main/release merge, tags, store publication, Pages promotion, pricing, and
    declarations of release readiness remain explicit product-owner decisions.

When a board item lands, update the prompt only if it taught a durable reusable
law. Do not embed volatile assignees, branch names, build hashes, issue counts, or
temporary ordering here.

---

## 1. Product north star

### 1.1 Player promise

The player climbs a dying spire through a branching sequence of combats and
opportunities. Enemies reveal what they will do. The player assembles a deck,
equipment, relics, and limited flask resources to create a build that can bend
those forecasts. Each turn should ask a comprehensible but non-trivial question:

> “Given the threat I can see, do I defend now, accelerate my engine, change
> stance, break Poise, or accept damage to create a stronger future turn?”

The game must feel severe but fair. Loss should expose a decision the player can
learn from, not hidden information or inconsistent arithmetic.

### 1.2 Design pillars

1. **Forecast, then improvise.** Exact enemy intents make risk readable; draws,
   map choices, and rewards make adaptation necessary.
2. **Build identity through verbs.** Classes differ through rules and decision
   patterns, not merely color palettes or renamed damage cards.
3. **Pressure across time scales.** Energy and Block shape a turn; HP, flasks,
   currency, and deck quality shape an act; equipment and relics shape a run.
4. **Break the enemy's plan.** Poise, status meters, control effects, and stance
   timing let the player disrupt rather than only race incoming damage.
5. **Readable spectacle.** Art, motion, sound, and music amplify game state;
   none may conceal it, delay input unnecessarily, or contradict the simulation.
6. **Content is assembled, not hard-coded.** Designers create most content by
   combining validated primitives and preview it without editing engine code.

### 1.3 Audience and session shape

- Target players who enjoy tactical deckbuilders and dark-fantasy atmosphere.
- A complete run should support suspension and safe resumption after any choice.
- A combat should teach its enemy pattern quickly and remain tactically varied.
- Difficulty should come from interacting constraints, never UI obscurity.
- Support keyboard, pointer, touch where applicable, and gamepad with equivalent
  access to all mandatory actions.

### 1.4 Originality and legal constraints

- Use only original names, lore, characters, silhouettes, symbols, dialogue,
  music, and visual motifs, or assets whose licenses explicitly permit use.
- Do not imitate a protected franchise's proper nouns, logos, signature creature
  designs, dialogue, music, UI trade dress, or near-verbatim card content.
- Mechanics and genre conventions may inspire the design; expression must be
  original. Maintain an asset ledger containing creator, source, license,
  required attribution, modifications, and proof/archive date.
- Generated assets require recorded model/tool, date, prompt summary, edits, and
  the applicable commercial-use terms. Never imply human authorship.
- Missing art or music must degrade to intentional placeholders or procedural
  fallback, never broken URLs, invisible controls, or silence presented as a bug.

---

## 2. Core game design

### 2.1 Run loop

```text
create/select profile
  -> choose run mode, class, loadout, seed/options
  -> generate act map from a dedicated RNG stream
  -> choose reachable node
  -> resolve node (combat | elite | event | merchant | shrine | treasure)
  -> collect/decline rewards and update build
  -> checkpoint
  -> repeat until act boss
  -> transition to next act or resolve victory/death
  -> record run history and reveal seed/statistics
```

Each map node must have a distinct strategic role. Every edge is explicit,
reachable paths are visually unambiguous, and generation guarantees a valid
route to the boss while respecting configurable spacing and encounter rules.

### 2.2 Combat loop

```text
setup combat from immutable definitions + run-owned instances
publish combat_started
while neither side has won:
  start player turn
    expire/reset start-turn resources in documented order
    resolve start-turn triggers through the action queue
    refill energy and draw cards
    reveal exact, engine-derived enemy intents
  while player has priority:
    accept a legal intent: play, use flask, equipment action, inspect, end turn
    validate intent against current state
    enqueue atomic effects
    resolve queue and emit an ordered event timeline
    render the timeline; rendering never mutates rules state
  end player turn
    resolve discard/retain/ethereal and end-turn triggers in documented order
  for each living enemy in stable order:
    resolve its previously telegraphed move
    select and preview its next move from deterministic state + AI RNG
  evaluate victory/defeat after every atomic effect
publish combat_ended
```

### 2.3 Base rules contract

Make all base values configurable by mode/class, but ship a clear default:

- Draw a configured hand at turn start; enforce a maximum hand size.
- Refill a configured energy amount; unused energy normally expires.
- Block absorbs damage before HP and normally expires at the documented phase.
- Draw pile, hand, discard pile, exhaust pile, and cards-in-play have explicit
  ownership and transition rules.
- Support Attack, Skill, Power, Curse, and Status categories plus keyword-driven
  behavior such as Exhaust, Ethereal, Innate, Retain, Unplayable, and variable
  cost. Keywords are data, validated, and available to tooltips.
- Every enemy action is previewed using the same evaluator that resolves it.
  Multi-hit attacks show hit count and per-hit value after current modifiers.
- All ordering and rounding rules are documented and unit-tested. Never compute
  displayed values in UI code.

Example damage pipeline (final order is a product decision and test contract):

```pseudo
function calculateDamage(context, base):
    value = evaluate(base, context)
    value = value + context.source.additiveAttack
    value = value * context.source.damageDealtMultiplier
    value = value * context.target.damageTakenMultiplier
    value = applyModeAndDifficultyModifiers(value, context)
    return max(0, floor(value))
```

### 2.4 Signature systems

Preserve and clarify these differentiators:

- **Stances:** mutually exclusive or stackable modes, as defined by data. Entry,
  exit, turn, and card triggers use the generic trigger system.
- **Poise:** a visible enemy meter. Specified effects add Poise damage; crossing
  the threshold causes a data-authored break package such as interruption,
  stagger, or a temporary damage window. Define when the meter resets and how
  threshold growth works.
- **Build-up meters:** statuses such as Bleed-like bursts are generic meters with
  maximum, growth modifiers, on-fill effects, and reset policy—not special cases.
- **Damage-over-time and timed statuses:** duration, tick phase, stack behavior,
  and decay phase are independent schema fields.
- **Flasks:** limited charges allocated among authored flask types, refilled at
  specified nodes. Allocation and growth are explicit run-state operations.
- **Equipment:** run-owned item instances occupy declared slots, modify derived
  stats through generic modifiers, and may grant actions or triggers. Preview all
  stat changes before equip/unequip.
- **Relics:** passive modifiers and event triggers composed from the same DSL.
- **Co-op:** an optional rules adapter, not a forked game. One authoritative
  simulation accepts seat-scoped intents and broadcasts ordered events. The solo
  build must not depend on networking. Ship it only after solo rules are stable.

### 2.5 Class design contracts

Ship at least three mechanically distinct classes, with final names and lore
chosen for the original setting. Use these as behavior targets, not mandatory
names:

1. **Vanguard:** stance sequencing, weapon techniques, Strength, build-up, and
   direct Poise pressure. Its skill ceiling is ordering.
2. **Seer:** spell chains, resource conversion, delayed payoff, and effects that
   reward playing a particular sequence or count. Its skill ceiling is setup.
3. **Herald:** HP as a deliberate resource, restoration, persistent invocations,
   and damage over time. Its skill ceiling is risk budgeting.

For every class define: fantasy, mechanical thesis, strength, weakness, starting
stats, starting deck, starting equipment, card-pool distribution, signature
status/stance interactions, build archetypes, and anti-patterns to avoid.

### 2.6 Content quality bar

Every enemy and boss needs a design sheet containing:

- lesson tested; readable silhouette; move vocabulary; AI constraints;
- intent preview requirements; phase transitions; counterplay windows;
- combinations with its encounter partners; reward/risk tier;
- accessibility notes for color, motion, sound, and text;
- deterministic test seeds and balance telemetry expectations.

Every card/relic/flask/equipment/event needs a unique gameplay purpose, concise
player text generated from rules data where numbers appear, upgrade or scaling
policy, rarity/tier, discoverability rule, and validation fixtures.

Avoid false choices, strictly dominated rewards, infinite loops without explicit
caps, multiplication that makes numbers unreadable, and content whose essential
behavior exists only in prose.

---

## 3. Constantine's engineering preferences — binding defaults

Treat the following as product requirements, not optional style suggestions. They
capture the recurring preferences already recorded throughout this project:

1. **Prefer .NET and familiar application structure.** Default to a current LTS
   .NET SDK, C#, solution/project boundaries, dependency injection, Options,
   strongly typed configuration, and conventional Models, Services, ViewModels,
   Views, Components, and Tests. If the chosen renderer is not .NET-native, keep
   the authoritative domain and contracts in .NET and isolate the renderer behind
   an adapter; document why any exception is worth the added boundary.
2. **One fact has one home.** A balance value, label, route, status ID, asset ID,
   input action, capability, setting, or rule is declared once and consumed by
   reference. Do not restate live values in prose, UI branches, tests, or another
   config file. Tests derive expectations from the authority unless testing a
   deliberately frozen external contract.
3. **Configuration is the modification surface.** Gameplay content, balance,
   feature switches, layout tokens, screen composition, input bindings, audio
   routing, asset mappings, accessibility defaults, platform capabilities, and
   debug controls come from validated typed configuration wherever practical.
4. **No magic strings or magic numbers.** Raw identifiers do not travel through
   production code. Use enums for genuinely closed sets, value objects/typed IDs
   for extensible identities, named constants for protocol/storage keys, resource
   keys for player text, and Options types for tunable values.
5. **Reuse by composition.** Reuse domain services, policies, selectors, view
   models, components, templates, and configuration sections. Do not manufacture
   inheritance hierarchies or a generic “manager” merely to remove a few lines.
6. **Easy to change means easy to prove.** Every extension seam has validation,
   focused tests, a representative example, and a clear failure naming the
   configuration path that must be fixed.
7. **Constantine retains product calls.** Do not convert provisional balance,
   release, pricing, platform, or feel decisions into permanent architecture.
   Expose a safe configuration default, show its effect, and ask for the call at
   the review gate. Never make a release or destructive migration implicitly.

### 3.1 Preferred .NET solution shape

Use a solution organized by responsibility and dependency, not by one enormous
application project. Names may change, but ownership must remain obvious:

```text
AshenSpire.sln
├─ Directory.Build.props                 shared compiler/analyzer policy
├─ Directory.Packages.props              centrally managed package versions
├─ global.json                           pinned supported SDK
├─ src/
│  ├─ AshenSpire.Domain/                 entities, value objects, contracts, events
│  ├─ AshenSpire.Application/            use cases, commands, queries, orchestration
│  ├─ AshenSpire.Gameplay/               deterministic combat/run interpreters
│  ├─ AshenSpire.Generation/             maps, rewards, encounters, seeded RNG
│  ├─ AshenSpire.Content/                typed definitions, catalogs, validators
│  ├─ AshenSpire.Presentation/           read models, previews, ViewModels
│  ├─ AshenSpire.UI.Components/          renderer-neutral component contracts/tokens
│  ├─ AshenSpire.Infrastructure/         saves, files, telemetry, clock implementations
│  ├─ AshenSpire.Audio/                  semantic cue and music director adapters
│  ├─ AshenSpire.Renderer.<Host>/        concrete engine/UI/view implementation
│  └─ AshenSpire.Bootstrap/              DI, Options binding, startup validation
├─ config/
│  ├─ game.json                          product/mode defaults
│  ├─ balance/*.json                     numbers and curves
│  ├─ content/**/*.json                  authored gameplay definitions
│  ├─ ui/{tokens,layouts,themes}.json    grids, composition, visual tokens
│  ├─ audio/{cues,music}.json            event mappings and contexts
│  └─ environments/*.json                explicit development/platform overrides
├─ assets/                               external and source media, organized by role
│  ├─ manifest.json                      logical IDs, variants, provenance, licenses
│  ├─ external/                          untouched licensed/imported originals
│  ├─ game-art/                          characters, enemies, items, cards, icons
│  ├─ backgrounds/                       environments, maps, skies, scene plates
│  ├─ ui/components/                     panels, frames, cursors, badges, controls
│  ├─ ui/buttons/                        button faces, states, glyphs, prompts
│  ├─ models/                            authored 3D model source files
│  ├─ meshes/                            runtime-ready geometry and collision meshes
│  ├─ materials/                         materials, shaders, textures, palettes
│  ├─ animation/                         rigs, clips, timelines, VFX source assets
│  ├─ audio/sfx/                         sound effects and authored source sessions
│  ├─ audio/music/                       tracks, stems, loops, and music sessions
│  └─ fonts/                             licensed typefaces and font metadata
├─ tests/
│  ├─ AshenSpire.Domain.Tests/
│  ├─ AshenSpire.Application.Tests/
│  ├─ AshenSpire.Architecture.Tests/
│  ├─ AshenSpire.Content.Tests/
│  ├─ AshenSpire.IntegrationTests/
│  └─ AshenSpire.Presentation.Tests/
└─ tools/
   ├─ AshenSpire.ContentTool/
   ├─ AshenSpire.ReplayTool/
   └─ AshenSpire.BalanceTool/
```

Dependency direction:

```text
Domain <- Application <- Bootstrap/Host
Domain <- Gameplay <- Application
Domain <- Content <- Bootstrap
Domain <- Generation <- Application
Application + Presentation contracts <- Renderer/Infrastructure/Audio adapters
```

`Domain` references no UI, host, storage, configuration provider, or third-party
engine. `Application` depends on interfaces, not concrete adapters. The bootstrap
project is the only composition root and the only place allowed to select concrete
implementations. Architecture tests enforce references and forbidden namespaces.

The root `assets/` directory is the single obvious home for external assets and
authored game media. Keep imported originals in `assets/external/` unchanged so
their provenance remains auditable; place production-ready derivatives in the
role-specific folders. Generated build/cache artifacts remain outside `assets/`
and are reproducible. Runtime code and content reference `AssetId` values from the
manifest—never relative file paths—so an artist can replace a button, background,
model, mesh, song, or component skin without changing gameplay or view code.

### 3.2 Models, services, ViewModels, views, and components

Use these terms consistently:

- **Models** represent domain facts and immutable definitions. They contain
  invariants but no platform behavior.
- **Services** perform cohesive reusable operations. Split command handling,
  calculation, generation, persistence, and presentation concerns rather than
  growing one `GameService`.
- **ViewModels/read models** contain already-calculated, localized semantic data
  a view needs: labels, values, enabled states, explanations, focus order, and
  component keys. They do not expose mutable domain objects.
- **Views/screens** compose reusable components and bind semantic actions. They
  contain no combat formulas and no direct save/configuration calls.
- **Components** are small state-explicit controls with typed parameters and typed
  callbacks. Prefer composition, slots/templates, and design tokens.
- **Configurations** are typed authoring contracts, separate from runtime state.
  Loading configuration produces validated immutable snapshots/catalogs.

Keep interfaces at the consumer boundary. Do not create an `Interfaces` dumping
project or one interface per class without a substitution/test need. Favor pure
functions and immutable records for calculations; use services for orchestration
or external ports.

### 3.3 Strongly typed identifiers and vocabulary

```csharp
public readonly record struct CardId(string Value);
public readonly record struct StatusId(string Value);
public readonly record struct AssetId(string Value);
public readonly record struct LocalizationKey(string Value);
public readonly record struct Seed(ulong Value);

public enum CardType { Attack, Skill, Power, Curse, Status }
public enum EffectOpcode { Damage, Block, ApplyStatus, Draw /* closed engine set */ }

public static class ConfigurationSections
{
    public const string Game = "Game";
    public const string Balance = "Balance";
    public const string Ui = "Ui";
    public const string Audio = "Audio";
}
```

Do not pass bare strings when a domain type exists. Parse/validate typed IDs at the
configuration boundary. Extensible content identities are value objects—not enums,
which would require recompilation for each card. Closed interpreter vocabularies
are enums or discriminated types. Serialize through explicit converters so file
formats remain stable if C# symbol names change.

“No magic strings” does not mean serialized files contain no readable strings.
Tokens such as `"damage"`, `"combat"`, or `"sticky"` are allowed only when they
belong to one documented, versioned, schema-validated vocabulary and are converted
to typed values at the configuration boundary. Runtime code never scatters ad-hoc
comparisons against serialized text. The rule is **no unowned strings**.

Player-visible text uses localization keys and templates. Logs use named event IDs
and structured properties. Routes/screens, input actions, save keys, telemetry
names, and asset IDs each have one typed catalog. A string comparison against a
content ID in generic gameplay code is an architecture-test failure.

### 3.4 Typed configuration, validation, and overrides

Use the .NET configuration/Options model as an input adapter, not as a service
locator. Bind once at startup, validate eagerly, then inject narrow immutable
configuration or catalogs:

```csharp
public sealed record CombatOptions
{
    public const string SectionName = "Game:Combat";
    public required int BaseEnergy { get; init; }
    public required int OpeningHandSize { get; init; }
    public required int MaximumHandSize { get; init; }
    public required int ActionSafetyLimit { get; init; }
}

services.AddOptions<CombatOptions>()
    .BindConfiguration(CombatOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

Add cross-reference and semantic validators after binding. Errors name the full
path, rejected value, expected constraint, and related definition. Never silently
clamp authored config, substitute an unknown enum, or ignore an unknown property.
Development overrides are explicit and visibly reported; production packages do
not depend on machine-local secrets or debug files.

Precedence is documented and tested, for example:

```text
compiled safety defaults
  < shipped base configuration
  < selected game-mode configuration
  < platform configuration
  < development-only local override
  < explicit command-line test override
```

Hot reload is allowed for presentation, audio, and safe balance/content previews.
A running combat keeps the immutable configuration snapshot it started with;
changes become active at a declared boundary so half a turn cannot use two rule
sets. Save files record the content/config manifest version.

### 3.5 Configuration-driven UI composition

Configuration may choose component composition and tokens, but never inject code:

```json
{
  "screen": "combat",
  "layouts": {
    "wide": {
      "grid": { "columns": 12, "gapToken": "space.4" },
      "regions": [
        { "component": "resourceHud", "column": "1 / 13", "layer": "sticky" },
        { "component": "playerZone", "column": "1 / 5", "layer": "world" },
        { "component": "enemyStage", "column": "5 / 13", "layer": "world" },
        { "component": "cardHand", "column": "4 / 13", "layer": "content" }
      ]
    }
  }
}
```

The component registry maps a typed `ComponentKind` to an approved factory. The
file cannot name arbitrary classes, scripts, markup, or reflection targets. Schema
validation refuses unknown component kinds, tokens, regions, layers, duplicate
keys, inaccessible order, and unsatisfied required regions. Layout tests render a
viewport/text-scale matrix. Designers can rearrange known components without
changing a View; new behavior still requires a reviewed typed component.

#### Visual layout workbench

Provide a development-only workbench that edits the same validated layout/theme
files the game loads. It is an editor, never a second runtime authority. It must:

- preview a screen at compact, medium, wide, short-landscape, and custom sizes;
- switch text scale, locale, theme, input family, safe-area, and reduced motion;
- show grid tracks, token names, regions, bounds, painted/hit boxes, clipping,
  focus order, accessibility names, visual layer, and scroll ownership;
- drag approved components between named regions, resize tracks, and snap saved
  values to grid/design tokens rather than emit arbitrary absolute coordinates;
- continuously schema/semantic validate and explain the exact invalid path;
- support undo/redo, last-known-good recovery, atomic save, hot preview at a safe
  activation boundary, and a human-readable source-control diff;
- export configuration only—never generated C#, arbitrary markup, or reflection
  targets—and prove the exported file loads through the production config door.

### 3.6 Testing and reuse rules for .NET

- Enable nullable reference types, warnings as errors, analyzers, deterministic
  builds, central package management, and locked dependency restore.
- Unit-test Domain, Gameplay, Generation, Options validators, selectors, and
  ViewModels without booting the renderer.
- Use fakes at ports (`IClock`, `IRandomStream`, `ISaveStore`, `IAudioSink`) and
  contract-test every concrete adapter against the same suite.
- Snapshot configuration only where human review adds value; behavioral tests
  assert semantics rather than internal call counts.
- Test architecture boundaries, duplicate authorities, raw identifier literals,
  and forbidden dependencies automatically.
- Create shared test builders for valid baseline state/config; each test overrides
  only the fact it exercises. Builders are test utilities, never a second set of
  product defaults.
- Every reusable package has a narrow public API, XML documentation for extension
  points, and no accidental host-specific transitive dependency.

### 3.7 Architecture: ports, layers, and dependency rules

Use concepts rather than prescribed folders. Adapt names to the chosen stack,
but enforce these dependency directions:

```text
Content Packs -----> Domain Model <----- Save/Migration
                          ^
                          |
Rules Simulation <--- Application/Session ---> AI/Procedural Generators
        ^                    |
        |                    v
Presentation Model <--- UI Adapters ---> Input / Audio / Rendering / Network
```

### 3.8 Required logical modules

1. **Content:** immutable authored definitions and balance configuration only.
2. **Domain model:** schemas, IDs, registries, formulas, state types, invariants,
   validation, and migrations. No renderer, input device, filesystem, or clock.
3. **Simulation:** deterministic commands/intents, action queue, effect and
   trigger interpreters, turn orchestration, combat, and run transitions.
4. **Procedural systems:** map, encounter, rewards, enemy AI, and loot selection;
   pure functions supplied with named random streams.
5. **Application/session:** loads content and saves, owns checkpoints, routes
   screens, coordinates simulation and adapters, and handles recovery.
6. **Presentation:** selectors/read models that transform state into immutable
   views, including calculated previews and accessibility labels.
7. **UI:** reusable components and layout templates. Dispatches intents only;
   it never writes simulation state or duplicates formulas.
8. **Adapters:** storage, renderer, audio backend, network transport, analytics,
   clock, localization, and platform APIs behind replaceable interfaces.
9. **Tools/tests:** content editor/importer, schema validation, replay, balance
   simulation, layout harness, asset audit, and packaging.

Dependencies point toward the domain. The headless game must run thousands of
seeded combats without loading UI, audio, images, fonts, or networking.

### 3.9 Non-negotiable boundaries

- No entity IDs or class names in generic simulation branches. If behavior can
  be composed from existing primitives, express it as content.
- New DSL primitives require schema, interpreter, preview, serialization,
  documentation, positive tests, negative tests, and at least one use case.
- Use a small named-script escape hatch only for genuinely exceptional behavior.
  Track its percentage of content and promote repeated patterns into primitives.
- State contains IDs and instance values, never copied definitions or UI nodes.
- UI sees read models and dispatches semantic intents—not raw mutable state.
- All external side effects pass through ports so replays and tests can substitute
  deterministic fakes.
- Do not make a “universal manager.” Each module has one reason to change.

### 3.10 Cross-platform logical topology

```text
/app                 composition root, session orchestration, screen routing
/content
  /core              schemas/version manifest and shared vocabulary
  /classes            class definitions and card packs
  /enemies            enemies, bosses, encounters, acts
  /items              relics, flasks, equipment
  /events             narrative event definitions
  /balance            modes, curves, prices, generation knobs
/domain               IDs, schemas, registries, formulas, state, validation
/simulation           queue, effects, triggers, combat, run commands
/generation           RNG streams, maps, encounters, rewards, AI
/presentation         selectors, previews, formatted semantic read models
/ui
  /components         Button, Meter, Card, Tooltip, Modal, Grid, Stack, etc.
  /patterns           HUD, picker, inspector, reward row, action strip
  /screens            title, creation, map, combat, reward, merchant, etc.
  /themes             design tokens, typography, motion, breakpoints
/assets
  /external /game-art /backgrounds /ui/components /ui/buttons
  /models /meshes /materials /animation /audio/sfx /audio/music /fonts
  manifest.*          logical IDs, variants, provenance, licenses, fallbacks
/adapters             storage, platform, renderer, audio, network, telemetry
/tools                validators, importers, editors, replay, balance, packaging
/tests                unit, contract, integration, visual, accessibility, soak
/docs                 GDD, architecture, data reference, decisions, licenses
```

Do not force physical folders if the engine uses another convention; preserve
the logical boundaries and enforce them with dependency tests or build rules.

---

## 4. Data model and behavior DSL

### 4.1 Content envelope

Every definition uses a stable, namespaced ID and common metadata:

```pseudo
ContentDefinition = {
  id: "pack:type/name",
  schemaVersion: integer,
  display: { nameKey, descriptionTemplateKey, iconAssetId, artAssetId },
  tags: set<string>,
  availability: { modeIds, unlockRule?, weight?, rarity? },
  behavior: typeSpecificPayload,
  presentation: { themeRole?, layoutHints?, animationCueIds?, soundCueIds? },
  provenance: { author?, source?, license? }
}
```

Presentation hints are optional semantic preferences, never absolute screen
coordinates. Core rules must still function if presentation metadata is absent.

### 4.2 Structured formulas

Never evaluate arbitrary script strings from content. Use a closed expression
tree with validation and depth limits:

```pseudo
Formula = LiteralNumber
        | { op: "add", args: Formula[] }
        | { op: "multiply", args: Formula[] }
        | { op: "min" | "max", args: Formula[] }
        | { op: "stat", entity: Selector, key: StatKey }
        | { op: "statusStacks", entity: Selector, statusId }
        | { op: "missingHealth", entity: Selector }
        | { op: "cardsPlayed", filter?, scope: "turn" | "combat" }

function evaluate(formula, readOnlyContext):
    assert formula conforms to schema and complexity budget
    recursively evaluate only registered operations
    return finiteNumberOrValidationError
```

### 4.3 Effects, triggers, and predicates

```pseudo
Effect = {
  op: EffectOpcode,
  target: TargetSelector?,
  amount: Formula?,
  statusId: ContentId?,
  cardId: ContentId?,
  options: OpcodeSpecificFields?
}

Trigger = {
  on: EventType,
  timing: "before" | "after",
  priority: integer,
  limit: { oncePer?: "turn" | "combat" | "run", count?: integer }?,
  if: Predicate?,
  do: Effect[]
}

Predicate = { p: PredicateOpcode, args: validatedPayload }
```

Define a stable ordering for simultaneous triggers: timing, priority, owner
order, source-instance order, then definition order. Detect and cap recursive
trigger loops. Include the ordering in replay logs.

```pseudo
function dispatch(state, intent):
    validation = validateIntent(state, intent)
    if not validation.ok: return Rejected(validation.reason)

    working = cloneOrTransaction(state)
    queue = compileIntentToActions(working, intent)
    timeline = []

    while queue not empty:
        assert actionCount < configuredSafetyLimit
        action = queue.popFront()
        enqueueMatchingBeforeTriggers(working, action, queue)
        event = applyAtomicAction(working, action)
        assertStateInvariants(working)
        timeline.append(event)
        enqueueMatchingAfterTriggers(working, event, queue)

    return Accepted(newState=working, events=timeline)
```

### 4.4 Generic status schema

```pseudo
StatusDefinition = {
  id, display,
  stacking: "add" | "refresh" | "replace" | "unique",
  maxStacks?, duration?, decayPhase?,
  meter: { max: Formula, onFill: Effect[], reset: "zero" | "subtractMax" }?,
  modifiers: map<ModifierKey, Formula>,
  triggers: Trigger[],
  dispelTags: set<string>
}
```

Prove extensibility with a test-only status added solely through data. The test
must load, validate, preview, apply, serialize, restore, and resolve it without a
status-ID branch in the engine.

### 4.5 Text and previews

Player-facing numeric text binds to semantic outputs from effects/formulas:

```pseudo
card.textTemplate = "Deal {damage:1} damage. Apply {status:weak.stacks} Weak."

preview = previewIntent(state, playCard(cardInstance, target))
tokens = collectDisplayBindings(preview.compiledEffects)
text = localizeAndFormat(card.textTemplate, tokens, locale)
```

Validation fails for unknown tokens, unbound visible numbers, missing locale
keys, impossible targets, and preview/resolve disagreement. Tooltips can explain
rounding and modifier contributions without asking UI code to redo the math.

### 4.6 State, commands, and save compatibility

Separate immutable definitions from mutable instances:

```pseudo
RunState = {
  saveSchemaVersion, contentManifestHash, runId, seed,
  rngStreamStates, modeId, act, floor, mapState,
  party: PlayerInstance[], inventory, deck: CardInstance[],
  currentNode, currentEncounter?, pendingReward?, statistics,
  commandSequence, checkpointMetadata
}
```

- All changes occur through validated commands/intents.
- Checkpoint after every committed choice; use atomic write/replace semantics.
- Maintain explicit migrations from each supported schema version.
- Reject unsupported or corrupt saves without destroying the last good copy.
- Store a content manifest/hash and define compatibility policy for changed packs.
- Provide export/import and deletion controls with clear consequences.
- A replay is `initial snapshot + ordered semantic commands + RNG stream states`.
  Replaying must produce the same state hashes and event sequence.

### 4.7 Deterministic random streams

Derive independent named streams from the root seed:

```pseudo
rootSeed = normalizeSeed(userSeed)
streams = {
  map: derive(rootSeed, "map"),
  encounter: derive(rootSeed, "encounter"),
  reward: derive(rootSeed, "reward"),
  shuffle: derive(rootSeed, "shuffle"),
  enemyAI: derive(rootSeed, "enemy-ai"),
  event: derive(rootSeed, "event"),
  cosmetic: derive(rootSeed, "cosmetic")
}
```

Cosmetic randomness must never perturb simulation. Persist stream state or a
documented draw counter. Tests should prove that inspecting UI, changing audio,
or adding particles does not alter a seeded run.

### 4.8 Tags, policy resolution, and procedural equipment

Tags describe facts and compatibility; they do not secretly execute code. Use
namespaced, typed `TagId` values such as `item.weapon.blade`, `damage.fire`,
`slot.hand.left`, or `generation.act.2`. Parent relationships are authored in one
tag registry rather than inferred from punctuation, so a rename cannot silently
change meaning.

```pseudo
TagQuery = {
  requiresAll: TagId[],
  requiresAny: TagId[],
  excludesAny: TagId[]
}

TagPolicy = {
  id: PolicyId,
  match: TagQuery,
  priority: integer,
  contributes: {
    tags?: TagId[],
    modifiers?: Modifier[],
    effects?: Effect[],
    affixPools?: ContentId[],
    presentation?: PresentationHints
  }
}
```

Tags answer “what is this, what is compatible, and which policy may apply?”
Explicit formulas/effects answer “what happens, to whom, when, and for how much?”
Never resolve a service by constructing a class name from a tag or using reflection.
A typed `ITagPolicyService` matches allowlisted policy data in stable order; known
effect/modifier/presentation services validate, preview, and execute contributions.

Procedural equipment composes four separate definition types:

1. **Base template:** slots, core stats/effects, required tags, affix slots.
2. **Material/archetype:** stat tendencies, compatible tags, visual/audio family.
3. **Affix:** tag query, generation cost/weight, tags, modifiers, explicit effects.
4. **Instance:** selected definition IDs, rolled values, mutable state, and receipt.

```pseudo
function generateItem(request, rngStream):
    template = templateCatalog.weightedMatch(request.templateQuery, rngStream)
    level = levelPolicy.resolve(request.progression)
    budget = budgetPolicy.resolve(template, level, request.rarity)
    candidates = affixCatalog.match(template.tags, level, request.context)
    selected = affixSelector.chooseCompatible(candidates, budget, rngStream)
    draft = itemComposer.compose(template, selected, level)
    policyResult = tagPolicyService.evaluate(draft.tags, request.context)
    item = itemCompiler.compile(draft, policyResult)
    itemValidator.validate(item)
    return item.withReceipt(template, selected, rejectedCandidates, budget, rngState)
```

Every generated item records enough receipt data to reproduce and explain it:
root seed/stream/draw index, manifest version, template, level, rarity, available
and spent budget, selected material/affixes, rolled values, and rejected candidates
with reasons. Saving stores definition IDs plus instance state, never copied catalog
definitions. Removed definitions require a migration or tombstone.

Merge behavior is declared per contribution type, never accidental “last wins”:

```text
tags                   set union
additive modifiers     stable sum
multipliers            stable documented order
effect lists           stable append then validation
exclusive properties   exactly one; conflict is an error
priority properties    highest priority; equal conflicting priorities are errors
```

Generation validators reject impossible queries, unknown/unused tags, circular tag
parents, incompatible affixes, budget overflow, duplicate unique effects, unresolved
presentation/audio families, and combinations whose tooltip cannot explain their
behavior. A Tag Explorer and Item Laboratory must show why policies matched, why
candidates were rejected, generation distributions across seeds, the final compiled
effects, tooltip, art/model/audio choice, and an exportable deterministic fixture.

---

## 5. UI system: grids, snapping, components, and visual layers

### 5.1 UI architecture

Build screens from a small vocabulary rather than one-off positioned elements:

- **Primitives:** Text, Icon, Image, Surface, Divider, Button, Toggle, Slider,
  Meter, Badge, FocusRing, ScrollRegion, Spacer.
- **Layout:** Grid, Stack, Cluster, Split, Overlay, Dock, SafeArea, AspectFrame.
- **Game components:** Card, Intent, ActorPlate, StatusChip, EquipmentSlot,
  FlaskSlot, MapNode, RewardOption, Tooltip, Inspector, ActionStrip, ResourceBar.
- **Patterns:** HUD, modal, picker, confirmation beat, tab set, folded detail,
  virtualized collection, notification/toast, tutorial callout.
- **Screens:** compositions of patterns with no duplicated rules arithmetic.

Each component exposes explicit inputs, outputs semantic actions, owns no global
simulation state, and supports loading, empty, disabled, focused, selected,
hovered, pressed, error, and reduced-motion states where applicable.

### 5.2 Grid and snapping contract

Use a tokenized spatial system:

```pseudo
LayoutTokens = {
  baseUnit: 4,
  spacing: [0, 1, 2, 3, 4, 6, 8, 12, 16] * baseUnit,
  columns: { compact: 4, medium: 8, wide: 12 },
  gutters: responsiveTokens,
  safeInsets: platformProvided,
  tapTargetMin: accessiblePhysicalSize,
  zLayers: namedLayerMap
}

function snap(value, unit=LayoutTokens.baseUnit):
    return round(value / unit) * unit
```

Do not choose between “pixels” and “percentages” globally. Use the unit that owns
the constraint: `auto/content` for text and intrinsic controls, fractional tracks
for remaining space, percentages for broad bounded proportions, `minmax`/`clamp`
for scalable limits, aspect ratios for cards/art, safe-area insets from the host,
and design tokens for spacing and control floors. Device-independent pixels may
exist underneath a token for borders, raster alignment, and accessibility minima;
components never scatter those raw values. Prefer `auto + fr + minmax/clamp` over
nested percentages, which break under long localization and large text.

- Author layout with grid tracks, constraints, anchors, and flow—not scattered
  device-specific coordinates.
- Snap authored spacing, sizes, and editor drag operations to the base grid.
- Permit sub-grid values only for borders, optical alignment, and animation;
  document exceptions as tokens.
- Components align to parent grids and expose named slots. Reordering slots must
  not require editing their internals.
- Use content-driven breakpoints (“the hand no longer fits”), not device names.
- At every supported viewport and text scale, critical actions remain reachable,
  no mandatory control is clipped, and scroll ownership is unambiguous.

Suggested screen compositions:

```text
Combat (wide, 12 columns)
┌──────────── persistent HUD / resources ────────────┐
│ player zone 4 cols │ stage/enemies 8 cols          │
│ log/details 3 cols │ hand/action area 9 cols       │
└──────────── docked contextual actions ─────────────┘

Combat (compact, 4 columns)
┌──────── HUD ────────┐
│ stage / enemies      │
│ player summary       │
│ contextual inspector │
│ paged or scroll hand │
│ docked action strip  │
└──────────────────────┘
```

The compact layout is a recomposition of the same read model and components,
not a separate combat implementation.

### 5.3 Named visual layers

Centralize visual stacking; never scatter arbitrary depth values:

```text
00 backdrop        environment, parallax, ambient grade
10 world           map paths, actors, props
20 world-effects   target marks, attacks, particles behind HUD
30 content         cards, panels, standard screen content
40 sticky          HUD, action strip, scroll cues
50 popover         tooltip, dropdown, anchored action menu
60 modal           inspector, settings, confirmation
70 tutorial        spotlight and callout
80 system          orientation/accessibility refusal, fatal recovery
90 debug           grid overlay, hit boxes, performance counters
```

Every overlay declares focus ownership, pointer/input capture, dismissal paths,
screen-reader behavior, and whether underlying simulation is paused. Test that a
read/inspect gesture can never become a play/confirm gesture through the layer.

### 5.4 Responsive and accessible behavior

- Design from 320×640 compact through common desktop/ultrawide viewports, with
  safe-area insets and short-landscape handling.
- Support text scaling without hiding routes to Continue, Back, End Turn, Close,
  Confirm, settings, or tutorial exit.
- Minimum interactive targets use one global ergonomic token.
- Do not encode meaning by color alone. Pair color with shape, icon, pattern,
  label, or position; test contrast in all themes.
- Full keyboard and gamepad navigation uses spatial focus and visible focus.
- Pointer drag always has click/select fallback. Touch has cancellation slop and
  does not confirm on scroll release.
- Tooltips are persistent/inspectable on non-hover input and never cover their
  anchor or the action being explained when another placement is available.
- Honor reduced motion, screen shake, flash intensity, master/music/SFX volume,
  readable-font, high-contrast, color-vision, and UI-scale preferences.
- Localize layout: avoid text baked into images; support expansion, plural rules,
  locale number formatting, and right-to-left mirroring where feasible.

### 5.5 UI truth and update strategy

```pseudo
onStateChanged(state, eventTimeline):
    nextView = selectors.buildScreenReadModel(state)
    renderOrDiff(nextView)
    feedback.play(eventTimeline, accessibilitySettings)

onUserAction(semanticAction):
    intent = mapActionToIntent(semanticAction, currentReadModel)
    result = application.dispatch(intent)
    if rejected: announce(result.reason) and preserve focus
```

Animations consume event timelines and may be skipped or accelerated. They do
not decide results. Avoid permanent per-frame work; activate update loops only
when animation/input requires them and measure allocations and frame time.

---

## 6. Art pipeline and direction

### 6.1 Art bible

Create an original visual language: soot-dark architecture, pale mineral light,
oxidized metal, ash, and restrained ember accents. Prefer readable silhouettes
and value grouping over detail. Establish:

- palette tokens for background, surfaces, text, classes, rarity, danger,
  healing, defense, arcane effects, selection, and focus;
- shape grammar for card types and map nodes;
- line weight, texture density, lighting direction, perspective, and scale rules;
- silhouette sheets for each class/enemy family;
- portrait, full-body, card-art, icon, backdrop, and VFX framing templates;
- accessibility variants and rules for avoiding color-only distinctions.

Do not request “in the style of” a living artist or protected game. Describe
composition, medium, palette, materials, lighting, mood, and functional read.

### 6.2 Asset manifest

Reference logical IDs rather than file paths in content:

```pseudo
AssetEntry = {
  id: "enemy/ash_widow/portrait",
  kind: "image" | "atlas" | "animation" | "font" | "sfx" | "music",
  variants: { resolution?, locale?, theme?, accessibility?, platform? },
  sourceFiles: [...],
  import: { crop, pivot, pixelsPerUnit?, compression, streaming? },
  fallbackId,
  preloadGroup,
  license: { owner, sourceUrl?, licenseId, attribution?, proofDate },
  provenance: { method: "human" | "generated" | "licensed", notes }
}
```

Build validation must reject missing IDs, circular fallbacks, unsupported formats,
missing attribution, and assets above defined memory/size budgets.

### 6.3 Production workflow

1. Greybox with labeled shapes and final aspect ratios.
2. Approve silhouette/value thumbnail at gameplay size.
3. Produce source art non-destructively with named layers.
4. Export platform variants through a repeatable importer.
5. Review in the actual screen at minimum and maximum supported scale.
6. Add provenance/license data and fallback.
7. Capture golden screenshots and accessibility variants.

For generated art, store a brief that specifies subject, action, silhouette,
camera, negative space for UI, palette, light, surface treatment, output size,
transparent/background requirement, and exclusions (no text, logos, watermark,
or recognizable protected characters).

### 6.4 VFX and motion

VFX communicate sequence: anticipation → impact → result. Each gameplay cue has
a reduced-motion substitute. Establish budgets for particle count, overdraw,
screen shake, flashes, duration, and simultaneous effects. Damage numbers and
status changes derive from event data and remain legible when events are skipped.

---

## 7. Music and sound pipeline

### 7.1 Audio goals

Audio must communicate state before adding ornament. Prioritize: confirmation,
danger, illegal action, damage/block, resource change, status/Poise threshold,
turn transition, reward, and navigation. Never make a mandatory cue music-only.

### 7.2 Audio event layer

Simulation emits semantic events; an audio director maps them to cues:

```pseudo
AudioCue = {
  id,
  eventTags,
  clips: weightedAssetIds,
  bus: "ui" | "combat" | "ambience" | "music" | "voice",
  gainRange, pitchRange, cooldownMs, maxVoices,
  spatialMode, priority, duckingRule?, fallbackSynth?
}

function onGameEvent(event):
    cue = audioCatalog.select(event.tags, deterministicCosmeticRng)
    if cue passes cooldown and voice policy:
        audioBackend.play(cue, listenerContext)
```

Unknown/missing files fall back gracefully and log one diagnosable warning.
Audio asset availability never changes game state or seeded outcomes.

### 7.3 Adaptive music

Define music by context rather than screen implementation:

```text
title, creation, map, standard combat, elite combat, boss phase 1,
boss escalation, merchant, shrine, event, defeat, victory
```

Use stems or loop regions where supported: foundation, tension, percussion, and
climax. Transition on musical boundaries with bounded latency; crossfade on
fallback backends. Boss phases may raise intensity without restarting the track.
Avoid fatigue through intensity ceilings, variation, and rest-state silence.

Ship either original/licensed tracks or a procedural score, plus a manifest-based
override system. Validate loop points, loudness range, clipping, metadata,
licenses, and missing-file fallback. Provide independent master, music, SFX,
ambience, and voice controls; persist them outside run saves.

### 7.4 Audio acceptance

- No clipping under worst-case simultaneous events.
- Repeated card plays have controlled variation and concurrency.
- Pausing, backgrounding, device loss, and resume do not create doubled music.
- First interaction correctly unlocks audio on restricted platforms.
- Muted buses perform no unnecessary decode/play work.
- Reduced sensory settings can soften impact and remove low-frequency shake cues.

---

## 8. Authoring and modification workflow

The game is only “data-driven” if an author can safely change it.

Provide:

- machine-readable schemas with human descriptions, defaults, and examples;
- content validation at editor save, development boot, test, and release build;
- hot reload or a fast preview path for content and themes;
- a content catalog showing unresolved references and reachability;
- a card/enemy/event preview scene with controllable state;
- layout debug overlay for columns, baseline/grid, bounds, focus order, layer,
  safe areas, clipping, and tap targets;
- deterministic seed/replay browser;
- balance simulator and exportable telemetry summaries;
- localization extraction and missing-key report;
- asset/license auditor and unused-asset report.

Adding an ordinary card, enemy move, status, relic, flask, equipment item, event,
music context, or art variant should require only a definition/asset plus tests—
not changes to generic engine branches or screen code.

Example authoring transaction:

```pseudo
author edits content pack
  -> schema validates shape and closed enums
  -> registry validates unique IDs and references
  -> semantic validator checks target/effect compatibility and text bindings
  -> reachability validator proves content can enter at least one configured pool
  -> preview builds representative states
  -> snapshot and simulation tests run
  -> manifest hash/version updates only after all checks pass
```

---

## 9. Verification strategy

### 9.1 Test pyramid

**Unit tests**

- formula operations, rounding, modifiers, status stacking/decay/meters;
- RNG reproducibility and stream independence;
- schema validation, registries, migrations, localization bindings;
- map constraints, weighted choices, enemy move restrictions;
- layout token/snap helpers and presentation selectors.

**Contract tests**

- every intent either rejects without mutation or commits atomically;
- preview equals resolution for the same state and target;
- every content definition and asset reference validates;
- a novel data-only status/relic/card works without entity-specific code;
- serialize → restore preserves state hash and next random outcomes;
- replay reproduces event sequence and final state.

**Integration tests**

- complete combat win and defeat; reshuffle; full hand; multi-enemy targeting;
- map traversal through every node type; reward accept/decline; merchant/rest;
- save/resume at every choice boundary and recovery from corrupt save;
- each input mode reaches every screen and mandatory action;
- optional co-op authority, reconnect, isolation, and conflict handling.

**Presentation tests**

- screenshots at a declared viewport × text scale × theme matrix;
- no clipping/overlap; tap-target floor; tooltip placement; focus containment;
- contrast and color-independent semantics; reduced motion; screen-reader labels;
- event timeline remains understandable when animation is skipped.

**Simulation and soak tests**

- thousands of seeded combats/runs with invariant checking;
- no crashes, impossible maps, trigger overflows, NaN/infinite values, negative
  inventory, duplicated unique rewards, or unwinnable mandatory transitions;
- report distributions rather than treating one bot win rate as “balanced.”

### 9.2 Test discipline

- Every checker performs non-zero work, prints a counted summary, and returns a
  distinct non-zero status for findings versus harness failure.
- Plant known-bad fixtures to prove critical checkers can fail.
- A passing automation report states its boundary; a harness crash is never
  reported as a product defect or a pass.
- Golden updates require a reviewed reason, not blanket regeneration.
- Balance changes record before/after metrics and affected archetypes.

### 9.3 Performance budgets

Choose platform-specific numeric budgets before polish, then measure:

- startup time and first interactive screen;
- save size and checkpoint latency;
- frame time at representative low/target hardware;
- memory after repeated combats and screen transitions;
- draw calls/overdraw or DOM/layout cost as applicable;
- asset download/install size and audio decode memory;
- headless simulations per second.

Do not optimize by weakening determinism, accessibility, or layer boundaries.

---

## 10. Incremental delivery plan

Each increment must be runnable, versioned, documented, and reversible.

### Increment 0 — Decisions and executable skeleton

Deliver: refreshed board/status intake with selected issues and dependencies;
decision log; selected technology with reasons; layer/dependency test; content and
asset schema skeletons; deterministic RNG; empty screen shell; design tokens;
grid/layer debug overlay; test and packaging commands.

Gate: one command builds/runs, one runs tests, an invalid content fixture fails,
and the headless domain imports without presentation dependencies.

### Increment 1 — Greybox combat truth

Deliver: one class, a small deck, one enemy, energy/draw/piles/Block, exact intent,
action queue, previews, win/lose, keyboard/pointer input, save-free replay log.
Use shapes and labels, not production art.

Gate: complete combat is winnable and losable; preview/resolution contract and
deterministic replay pass; compact and wide combat layouts keep actions reachable.

### Increment 2 — Extensible combat vocabulary

Deliver: status interpreter, meters/Poise, stances, triggers, relic, flask,
equipment modifier, keywords, multi-enemy targeting, timeline feedback, tooltips,
and test-only data-defined behavior.

Gate: no shipped entity IDs in generic branches; serialization round-trip passes;
all visible numbers come from presentation previews.

### Increment 3 — One-act run

Deliver: seeded branching map, encounters, rewards, elite, boss, merchant, shrine,
event, treasure, currency, checkpoints/continue, death/victory, run history.

Gate: automated agents and humans can finish multiple seeds; every node type is
reachable; save/resume preserves future RNG; corrupt-save recovery is safe.

### Increment 4 — Authoring pipeline and first art/audio pass

Deliver: preview tools, manifest/license audit, original art bible, representative
final assets for one class/enemy family/environment, SFX event map, adaptive music
for title/map/combat/boss, procedural or placeholder fallbacks.

Gate: an author adds one example of each common content type without engine/UI
changes; missing assets fall back; audiovisual cues pass actual-build review.

### Increment 5 — Content breadth and balance

Deliver: remaining classes, three acts, encounter families, bosses, events,
equipment/relic/flask pools, difficulty modes, localization-ready text, balance
telemetry and tuning reports.

Gate: no unreachable content; seeded soak has zero invariant failures; every
class has multiple viable archetypes; accessibility matrix passes.

### Increment 6 — Optional co-op adapter

Deliver only if requested: authoritative session, seat-scoped commands, lobby,
reconnect/resume, synchronized RNG/event log, co-op UI recomposition, adversarial
protocol validation. Keep transport replaceable and solo offline.

Gate: clients never author state, disconnect cannot corrupt saves, reconnect
replays to identical hash, and solo tests remain unchanged.

### Increment 7 — Release hardening

Deliver: performance pass, full asset/license audit, platform lifecycle handling,
settings and accessibility completion, migration rehearsal, clean-build artifact,
release notes, support diagnostics, and documented rollback.

Gate: fresh install, upgrade, suspend/resume, input matrix, long soak, packaging,
and release artifact verification all pass on target platforms.

---

## 11. Required implementation response format

At the beginning of each increment, answer with:

1. **Understanding:** player outcome and system boundary.
2. **Live issue intake:** checked links/time, Constantine comments, state,
   dependencies, existing authorities, acceptance, and explicit non-scope.
3. **Assumptions/decisions:** including reversible defaults.
4. **Slice plan:** small ordered tasks, each independently testable.
5. **Files/modules:** ownership and dependency direction.
6. **Data/contracts:** schemas, commands, events, and migrations affected.
7. **Acceptance checks:** exact automated and hands-on checks.

At the end, answer with:

1. **Playable result:** what a player can now do.
2. **Architecture result:** seams added or changed.
3. **Content result:** definitions and assets added, with provenance.
4. **Evidence:** exact commands, counted results, screenshots/replays, test seeds.
5. **Migration/compatibility:** save, content, and asset impact.
6. **Known issues and boundary:** facts, not vague “future polish.”
7. **Next proposed increment:** do not begin it without approval.

Never claim completion based only on reading code. Run the game, exercise the
changed path through real inputs, and compare the observed result with the
simulation and presentation contracts.

---

## 12. Global definition of done

The rebuild is done only when:

- the complete run loop is both winnable and losable for every class;
- combat is deterministic, headless, replayable, and free of entity-specific
  branches in generic systems;
- previews, tooltips, intents, logs, and resolved arithmetic agree;
- content and assets validate, are reachable, licensed, and have fallbacks;
- saves are atomic, versioned, migratable, recoverable, exportable, and deletable;
- compact through wide layouts use reusable components, named grids, snapping,
  and centralized visual layers without unreachable mandatory actions;
- keyboard, pointer/touch, and gamepad provide equivalent mandatory access;
- accessibility settings persist and visual/audio alternatives communicate all
  essential state;
- art and music are original or properly licensed, coherent, optimized, and
  driven through manifests rather than hard-coded paths;
- deterministic, integration, layout, accessibility, replay, migration, asset,
  performance, and soak checks pass and report non-zero coverage;
- documentation teaches a new contributor how to add common content and UI
  compositions without violating the architecture;
- a clean checkout can build, test, package, and run using documented commands.

If scope pressure threatens these properties, reduce content breadth before
compromising truth, determinism, accessibility, save safety, or modularity.
