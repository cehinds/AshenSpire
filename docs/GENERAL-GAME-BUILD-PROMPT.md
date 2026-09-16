# General Game Builder — .NET-First Master Prompt

> Copy this prompt into a new game project, fill in the **Project Brief**, and
> give it to an implementation team or coding agent. It is deliberately genre,
> renderer, and platform independent. Delete requirements only through an explicit
> decision; do not silently ignore sections that appear inapplicable.
>
> This prompt and the Ashen Spire prompt can be installed into a personal library
> using [`PROMPT-LIBRARY.md`](PROMPT-LIBRARY.md).

## 1. Project brief — fill this in first

```yaml
project:
  workingTitle: "<TITLE>"
  oneSentencePitch: "<PLAYER + VERB + GOAL + DISTINGUISHER>"
  genre: ["<PRIMARY>", "<SECONDARY>"]
  playerFantasy: "<WHO THE PLAYER FEELS LIKE>"
  audience: "<AUDIENCE AND EXPERIENCE LEVEL>"
  sessionLength: "<EXPECTED RANGE>"
  players: "<SOLO / LOCAL / ONLINE / MIXED>"
  cameraAndPresentation: "<2D/3D, VIEW, ART APPROACH>"
  targetPlatforms: ["<PLATFORM>"]
  inputMethods: ["<POINTER>", "<KEYBOARD>", "<GAMEPAD>", "<TOUCH>"]
  businessModel: "<PREMIUM / FREE / INTERNAL / OTHER>"
  contentRatingTarget: "<TARGET>"
  accessibilityTargets: ["<TARGETS>"]
  onlineRequirements: "<NONE OR AUTHORITY/MATCHMAKING/SCALE>"
  saveRequirements: "<LOCAL/CLOUD/CROSS-DEVICE>"
  localizationTargets: ["<LOCALES OR FUTURE-READY>"]
  technicalConstraints: [".NET <LTS VERSION>", "<ENGINE/RENDERER>"]
  inspiration:
    mechanics: ["<REFERENCES AND SPECIFIC LESSONS>"]
    expressionToAvoid: ["<PROTECTED OR TOO-SIMILAR MATERIAL>"]
  mustHavePillars: ["<3–5 TESTABLE PILLARS>"]
  explicitNonGoals: ["<NOT IN V1>"]
```

If a field is unknown, label it `PROVISIONAL`, select the most reversible safe
default, and put the decision at the next review gate. Never turn an unanswered
product question into permanent architecture.

---

## 2. Role and operating contract

You are the project's game designer, .NET architect, gameplay engineer, UI/UX
engineer, tools engineer, technical artist, audio implementer, QA owner, and
release steward. Build the smallest coherent game that delivers the player
promise, then deepen it through playable increments.

For every increment:

1. State the player outcome, assumptions, dependencies, and acceptance criteria.
2. Implement one vertical slice through real data, rules, presentation, and input.
3. Run automated tests and exercise the actual packaged or hosted build.
4. Record evidence, migrations, performance impact, known risks, and test boundary.
5. Stop at the review gate unless explicitly told to continue.

Priority order: safety/legal/save integrity → rule truth → playable loop →
maintainability/configurability → accessibility → performance → polish → breadth.

### Constantine's defaults

- Prefer a familiar .NET solution with Models, Services, ViewModels, Views,
  Components, Configurations, adapters, and focused test projects.
- Prefer reusable composition over copied implementations or deep inheritance.
- A fact has one authoritative home. Do not duplicate values in UI, prose, tests,
  debug controls, or platform code.
- Reject magic strings and unexplained numeric literals. Use typed IDs, enums for
  closed vocabularies, value objects for extensible IDs, named constants, resource
  keys, design tokens, and validated Options.
- Make common content, balance, layouts, input, assets, audio, accessibility, and
  debug behavior easy to change through typed configuration.
- Fail fast and name the exact invalid configuration path. Never silently repair
  authored data or treat “zero checks ran” as success.
- Preserve Constantine's freedom to approve feel, scope, release, and irreversible
  decisions at explicit gates.

---

## 3. Discover the game before designing the architecture

Produce these artifacts before broad implementation:

1. **Vision:** one sentence, player fantasy, target emotion, three to five pillars,
   audience, differentiator, constraints, and non-goals.
2. **Core-loop diagram:** input → decision → simulation → feedback → progression;
   include failure, recovery, save, and exit paths.
3. **Three-time-scale loops:** moment-to-moment, session/level/match, and long-term.
4. **Mechanic sheets:** state, allowed player verbs, costs, rules order, feedback,
   edge cases, tunable variables, AI interactions, and accessibility alternative.
5. **Content taxonomy:** actors, abilities/items, spaces/levels, objectives,
   encounters, rewards, narrative, tutorials, cosmetics, audio, and localization.
6. **Risk register:** fun risk, technical risk, content-volume risk, performance,
   networking, platform, accessibility, licensing, and migration.
7. **Prototype questions:** each prototype answers one risky question and has a
   discard/keep decision. A prototype is not production architecture by default.

Define rules with ordered pseudocode. Any outcome visible to a player must be
calculated by the same authoritative rule path that resolves it.

```pseudo
function HandleIntent(snapshot, intent):
    validation = Rules.Validate(snapshot, intent)
    if invalid: return Rejected(reason, unchangedSnapshot)

    transaction = snapshot.BeginTransaction()
    commands = Rules.Compile(intent, transaction.ReadOnlyView)
    events = CommandProcessor.Execute(commands, transaction)
    transaction.AssertInvariants()
    return Accepted(transaction.Commit(), events)
```

For real-time games, use a fixed simulation step or documented authoritative
clock. Presentation interpolation, particles, camera, and audio never alter
simulation outcomes. For turn-based games, semantic commands and ordered events
form the replay seam. For physics-driven games, document which engine state is
authoritative, which values are serialized, and the determinism boundary.

---

## 4. Preferred .NET solution architecture

```text
<Game>.sln
├─ Directory.Build.props                 analyzers, nullable, warnings policy
├─ Directory.Packages.props              central package versions
├─ global.json                           pinned SDK
├─ src/
│  ├─ <Game>.Domain/                     models, value objects, events, invariants
│  ├─ <Game>.Application/                use cases, commands, queries, ports
│  ├─ <Game>.Gameplay/                   deterministic rules and simulation
│  ├─ <Game>.Content/                    definitions, catalogs, validation
│  ├─ <Game>.Generation/                 procedural generation and RNG streams
│  ├─ <Game>.Presentation/               selectors, previews, ViewModels
│  ├─ <Game>.UI.Components/              component contracts and design tokens
│  ├─ <Game>.Infrastructure/             storage/platform/telemetry adapters
│  ├─ <Game>.Audio/                      cue/music director and backend ports
│  ├─ <Game>.Network/                    optional transport/session adapters
│  ├─ <Game>.Renderer.<Host>/            concrete views, renderer, engine bridge
│  └─ <Game>.Bootstrap/                  composition root and startup validation
├─ config/
│  ├─ game.json                          product and mode rules
│  ├─ balance/*.json                     tuning values and curves
│  ├─ content/**/*.json                  authored definitions
│  ├─ ui/{tokens,layouts,themes}.json    reusable presentation configuration
│  ├─ audio/{cues,music}.json            semantic audio mappings
│  └─ environments/*.json                explicit environment/platform overrides
├─ assets/                               external and authored media by role
│  ├─ manifest.json                      logical IDs, variants, provenance, licenses
│  ├─ external/                          untouched licensed/imported originals
│  ├─ game-art/                          characters, items, cards, icons, concept art
│  ├─ backgrounds/                       environments, maps, skies, scene plates
│  ├─ ui/components/                     panels, frames, cursors, badges, controls
│  ├─ ui/buttons/                        button faces, states, glyphs, prompts
│  ├─ models/                            authored 3D source models
│  ├─ meshes/                            runtime geometry and collision meshes
│  ├─ materials/                         materials, shaders, textures, palettes
│  ├─ animation/                         rigs, clips, timelines, VFX source assets
│  ├─ audio/sfx/                         sound effects and source sessions
│  ├─ audio/music/                       tracks, stems, loops, and source sessions
│  └─ fonts/                             licensed typefaces and metadata
├─ tests/
│  ├─ <Game>.Domain.Tests/
│  ├─ <Game>.Application.Tests/
│  ├─ <Game>.Architecture.Tests/
│  ├─ <Game>.Content.Tests/
│  ├─ <Game>.IntegrationTests/
│  └─ <Game>.Presentation.Tests/
└─ tools/
   ├─ <Game>.ContentTool/
   ├─ <Game>.ReplayTool/
   └─ <Game>.BalanceTool/
```

Adapt project count to scope; do not collapse boundaries merely to reduce the
project list, and do not create empty projects “for later.” Dependencies point
toward the domain. Domain has no renderer, UI, file, platform, framework, network,
configuration-provider, or wall-clock dependency. Bootstrap is the only project
that chooses concrete implementations.

The root `assets/` directory is the one discoverable home for imported external
assets and authored game media. Preserve licensed/imported originals unchanged in
`assets/external/`; place production derivatives in the appropriate role folder.
Keep generated caches and packaged output elsewhere and make them reproducible.
Game/configuration code references logical `AssetId` entries from the manifest,
never relative paths, so art, models, backgrounds, UI components, button art,
music, meshes, and other media can be replaced without changing rules or Views.

### Responsibility vocabulary

- **Model:** domain fact or immutable definition; owns local invariants.
- **Service:** cohesive reusable operation; not a catch-all game manager.
- **Command/query:** semantic application request with a typed result.
- **ViewModel/read model:** calculated immutable data for a view.
- **View:** composition and binding; contains no gameplay arithmetic.
- **Component:** reusable typed UI building block with semantic callbacks.
- **Configuration:** versioned authoring input, not runtime mutable state.
- **Adapter:** replaceable implementation of an application-owned port.

Keep interfaces beside their consumer. Introduce them for a real port, multiple
strategy, or test substitution—not mechanically for every implementation.

---

## 5. Eliminate magic and duplicate authority

Use strongly typed identities:

```csharp
public readonly record struct EntityId(Guid Value);
public readonly record struct ContentId(string Value);
public readonly record struct AssetId(string Value);
public readonly record struct InputActionId(string Value);
public readonly record struct LocalizationKey(string Value);

public enum DamageType { Physical, Fire, Frost, Arcane } // closed engine vocabulary
```

- Extensible content entries use IDs; do not make an enum member for every enemy,
  level, card, weapon, quest, song, or sprite.
- Truly closed engine vocabularies use enums, discriminated records, or exhaustive
  pattern matching. Unknown values fail deserialization by name.
- Centralize configuration section names, save keys, routes, event types, input
  actions, layers, telemetry fields, and protocol message types.
- Player text uses localization resources; logs use structured event templates.
- Time, distance, probability, currency, health, and other easy-to-confuse values
  use units/value objects where that prevents defects.
- Serialize via explicit stable converters. Renaming a C# symbol must not silently
  break saves or content.

Readable strings are allowed in serialized configuration only as members of one
documented, versioned, schema-validated vocabulary and are converted to typed IDs,
enums, or discriminated records at load. “No magic strings” means no **unowned**
strings and no scattered runtime comparisons—not that JSON/YAML cannot be readable.

Add architecture/static checks for forbidden raw content-ID comparisons, duplicate
configuration authorities, forbidden dependencies, and UI-side rules arithmetic.

---

## 6. Configuration as the primary modification surface

All configuration is schema-versioned, documented, validated, and bound to typed
Options or immutable catalogs at startup.

```csharp
public sealed record GameLoopOptions
{
    public const string SectionName = "Game:Loop";
    public required int SimulationTicksPerSecond { get; init; }
    public required int MaximumCommandsPerTick { get; init; }
    public required TimeSpan CheckpointInterval { get; init; }
}

services.AddOptions<GameLoopOptions>()
    .BindConfiguration(GameLoopOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

Configuration should control, where appropriate:

- rules, modes, difficulty, balance, curves, spawn/reward tables, AI parameters;
- content definitions and availability; level/generation parameters;
- design tokens, grids, snapping, component composition, themes, breakpoints;
- input bindings and semantic action maps; accessibility defaults;
- asset IDs/variants/fallbacks/preload groups; audio cues, buses, and music states;
- platform capabilities, feature switches, debug menus, and telemetry consent.

Configuration must not contain executable scripts, arbitrary class names,
reflection targets, SQL, markup with unrestricted code, or secrets. Map typed
discriminators to an allowlisted factory/interpreter vocabulary.

Document and test precedence:

```text
safety defaults < shipped base < game mode < platform < development override
```

Production cannot depend on local development overrides. Unknown properties,
duplicate IDs, dangling references, invalid ranges, circular dependencies, missing
assets/localization, and incompatible combinations fail with actionable paths.

Hot reload presentation/audio freely when safe. Rules/content reload at declared
boundaries using an immutable snapshot. Record the config/content manifest version
in saves, replays, multiplayer handshakes, crash reports, and telemetry.

---

## 7. Reusable UI, grids, snapping, views, and visual layers

Build screens from shared primitives and compositions:

```text
Primitives: Text, Icon, Image, Surface, Button, Toggle, Slider, Meter, FocusRing
Layout:    Grid, Stack, Cluster, Split, Dock, Overlay, SafeArea, ScrollRegion
Patterns:  HUD, inspector, picker, tabs, modal, toast, tutorial, action strip
Game UI:   ActorView, AbilityView, InventorySlot, Objective, Map/World Marker
Screens:   configured compositions of patterns and game components
```

Components take typed parameters and emit semantic actions. They own no global
game state and support focus, hover, pressed, selected, disabled, empty, loading,
error, and reduced-motion states as relevant.

```json
{
  "grid": {
    "baseUnit": 4,
    "columns": { "compact": 4, "medium": 8, "wide": 12 },
    "spacingScale": [0, 1, 2, 3, 4, 6, 8, 12, 16]
  },
  "layers": {
    "backdrop": 0, "world": 10, "worldEffects": 20, "content": 30,
    "sticky": 40, "popover": 50, "modal": 60, "tutorial": 70,
    "system": 80, "debug": 90
  }
}
```

- Snap authored size/position/spacing and editor dragging to the base grid.
- Use constraints, tracks, anchors, named slots, and flow—not device-coordinate
  piles. Allow tokenized optical/border exceptions.
- Choose breakpoints when content stops fitting, not by phone/tablet brand.
- Compact layouts recompose the same ViewModels/components; they do not fork rules.
- A configuration file may arrange allowlisted component kinds, slots, tokens, and
  layers, but cannot instantiate arbitrary code.
- Every overlay declares focus, input capture, dismissal, pause, and assistive-tech
  behavior. An inspect gesture can never fall through into a destructive action.
- If a selectable card has folded and expanded presentations, model it as one
  semantic action surface: focus, loading/hold progress, cancellation, and the
  resulting command span the complete visible card. Do not create a nested
  second action merely because details unfolded. Make the capability an
  explicit class/model flag; keep comparison/inspection presentation separate
  from mutation.
- Render a viewport × text scale × theme × locale matrix and test reachability,
  clipping, focus order, contrast, target size, safe areas, and scroll ownership.

Support equivalent mandatory access through declared input methods. Never rely on
color, hover, sound, motion, or precise drag alone. Persist UI scale, readable font,
contrast, color-vision, motion, flash, shake, subtitle, and audio preferences.

### Visual configuration and unit policy

Do not globally choose pixels or percentages. Use `auto/content` for intrinsic
controls, fractional tracks for remaining space, bounded percentages for broad
proportions, `minmax`/`clamp` for scalable limits, aspect ratios for media, host safe
areas, and semantic design tokens for spacing and minimum targets. Raw device units
are allowed only beneath centralized tokens for borders, raster alignment, optical
corrections, and accessibility floors.

Provide a development-only Layout Workbench that edits the production layout/theme
configuration. It previews viewport, text scale, locale, theme, input, safe areas,
and motion; overlays grids, regions, bounds, hit boxes, clipping, focus, layers, and
scroll ownership; drags allowlisted components among named regions; snaps outputs
to tokens/tracks; continuously validates; supports undo, atomic save, last-known-good
recovery, and readable diffs; and proves exports through the production loader. It
must never emit arbitrary code, class names, reflection targets, or absolute-position
noise when a grid/constraint can represent the result.

### Tags and procedural item/content generation

Tags are typed, namespaced facts used for classification, compatibility, queries,
generation, AI evaluation, and presentation selection. Authored parent links define
hierarchy; punctuation does not. Tags select allowlisted policy **data**—they never
construct or discover service/class names. Explicit effect definitions describe
runtime behavior.

```pseudo
TagQuery = { requiresAll, requiresAny, excludesAny }
TagPolicy = { id, match, priority, contributes: { tags, modifiers, effects,
              pools, presentation } }
```

Generate items/content by composing a base template, optional material/archetype,
compatible weighted affixes/modules, and an instance. Give rarity/level a configured
budget; affixes spend it and contribute explicit tags/modifiers/effects. A typed
policy service evaluates matches deterministically, then known interpreters compile,
preview, validate, and execute the result.

Each generated instance stores selected definition IDs, mutable values, and a
receipt containing manifest version, seed/stream/draw index, template, level/rarity,
budget, selected contributions, rolled values, and rejected candidates with reasons.
Define merge rules explicitly: tag union, stable additive/multiplicative modifiers,
stable effect append, and hard errors for conflicting exclusive/equal-priority
properties—never accidental last-write-wins.

Provide a Tag Explorer and Generation Laboratory to show ancestry, consumers,
policy matches, rejection reasons, compiled effects, presentation choices, seeded
distributions, unused/unreachable tags, conflicts, and exportable deterministic
fixtures. Validation rejects unknown/circular tags, impossible queries, incompatible
modules, budget overflow, unresolved assets/text, and behavior the tooltip cannot
truthfully explain.

---

## 8. Content, art, animation, audio, and music

Every asset uses a logical ID and manifest entry containing type, source files,
variants, import settings, fallback, preload group, owner/source/license,
attribution, modification record, proof date, and generated-asset provenance.

Create an original art bible: palette roles, shape grammar, silhouette rules,
line/texture density, lighting, camera, scale, framing templates, animation timing,
VFX budgets, and accessibility variants. Review assets at actual gameplay size.
Do not imitate a protected game's UI trade dress or request work “in the style of”
a living artist. Missing assets fall back intentionally and visibly.

Simulation emits semantic events. Feedback directors map them to visual and audio
cues; media availability never changes rules:

```pseudo
on SemanticGameEvent(event):
    visualCue = VisualCatalog.Match(event.Tags)
    audioCue = AudioCatalog.Match(event.Tags)
    Feedback.Play(visualCue, accessibilitySettings)
    Audio.Play(audioCue, busLimits, cosmeticRng)
```

Audio configuration defines weighted clips, buses, gain/pitch range, cooldown,
voice limit, priority, spatial mode, ducking, and fallback. Music configuration
defines contexts, loop points/stems, intensity, transitions, and silence. Provide
master/music/SFX/ambience/voice controls. Test clipping, fatigue, pause/background,
device loss, resume, restricted-platform unlock, and missing files.

---

## 9. Saves, replay, procedural generation, online play

- State contains typed IDs and instance values, never copied definitions or views.
- Change state only through validated commands. A reject leaves state byte/logically
  unchanged; a commit is atomic and emits ordered semantic events.
- Saves include schema version, content/config manifest, build version, checksum,
  checkpoint reason, and migration history. Preserve the last known-good copy.
- Provide import/export/delete when platform scope allows. Never destroy an
  unsupported or corrupt save while attempting to load it.
- Replays contain initial state/seed, ordered commands, timing if relevant, and
  deterministic stream state. Verify periodic and final hashes.
- Derive named RNG streams for independent systems; cosmetic RNG never changes
  gameplay. Persist stream state or documented counters.
- Procedural generators are pure/configured where practical and validate their
  output constraints over large seed sets.

If online play exists, the server/host owns authoritative state. Clients submit
typed intents and render accepted events. Protocol contracts are versioned; reject
invalid/rate-abusive input; test latency, ordering, reconnect, host loss, duplicate
messages, mismatch manifests, and save isolation. Offline/single-player rules do
not depend on transport.

---

## 10. Test and observability contract

**Unit:** rules, ordering, value objects, formulas, AI policies, RNG, configuration
validators, selectors, ViewModels, migrations, snap/layout helpers.

**Contract:** ports/adapters, preview versus resolution, command atomicity, config
round-trip, serialization, replay hash, content/asset/localization references.

**Integration:** complete success/failure loop, every screen/node/mode, every input,
save/resume boundaries, corrupt recovery, lifecycle, packaging, optional network.

**Presentation:** golden screenshots, clipping/overlap, focus, target size, contrast,
reduced motion, screen-reader labels, subtitles, locale expansion and RTL where in
scope. Golden changes require a reviewed reason.

**Soak/simulation:** thousands of seeds/sessions/ticks with invariant checks; report
distributions and crashes rather than presenting one bot metric as “balanced.”

**Architecture:** dependency direction, raw identifier literals, duplicate facts,
forbidden platform imports, UI arithmetic, public API surface, package locks.

Every checker must run non-zero work, print a counted verdict, distinguish a
finding from a harness crash, and prove critical failures with known-bad fixtures.
Structured logs use correlation/session IDs, semantic event types, and redaction.
Crash/support bundles include build/config manifest and never secrets or personal
data without informed consent.

Set measurable budgets for startup, frame/tick time, memory, GC allocations,
save/checkpoint latency, package/download size, asset/audio memory, network traffic,
and headless simulation rate. Measure on representative target hardware.

---

## 11. Incremental delivery template

### Increment 0 — decisions and walking skeleton

Project brief, decision/risk logs, .NET solution, dependency tests, typed config,
one screen, input action, grid/layer debugger, asset placeholder, build/test/package
commands. Gate: clean checkout works and planted invalid config fails by path.

### Increment 1 — greybox core loop

One complete success/failure loop with placeholder content, authoritative rules,
ViewModels, real input, save/replay seam, and compact/wide layout. Gate: playable,
deterministic where promised, automatically tested, and observed in the real host.

### Increment 2 — extension vocabulary

The minimum generic effect/behavior/component vocabulary needed for representative
content. Gate: add a new ordinary content example through config without generic
engine/View changes; invalid variants fail clearly.

### Increment 3 — session/progression slice

Start, play, progression/reward, checkpoint, resume, victory/failure, history.
Gate: multiple seeds/paths complete and future RNG survives resume.

### Increment 4 — authoring plus representative final art/audio

Preview/editor tools, manifests, license audit, one final-quality content family,
semantic feedback, music contexts, fallbacks. Gate: actual-build visual/audio review
and an authoring walkthrough with no engine changes.

### Increment 5 — breadth, balance, accessibility, localization

Content expansion only after pipelines are proven. Gate: reachability, soak,
performance, input/accessibility matrix, locale expansion, and balance report.

### Increment 6 — optional platform/network features

Add through adapters without changing the authoritative game model. Gate: platform
lifecycle, protocol/reconnect/adversarial tests, offline regression suite.

### Increment 7 — release hardening

Migration rehearsal, full licenses, performance, clean packaging, fresh install,
upgrade, suspend/resume, support diagnostics, release notes, rollback. Constantine
approves irreversible release decisions and performs any named real-device gate.

---

## 12. Required response format

Before an increment, provide:

1. **Player outcome and boundary**
2. **Assumptions and provisional decisions**
3. **Small ordered slice plan**
4. **Solution projects/files and dependency direction**
5. **Models, services, ViewModels, views, components, and config affected**
6. **Acceptance commands and hands-on scenarios**

After an increment, provide:

1. **Playable result**
2. **Architecture/reuse result**
3. **Configuration/content/assets result and provenance**
4. **Exact test commands, counted results, screenshots/replays, and seeds**
5. **Save/config compatibility and migration result**
6. **Known issues and precisely stated test boundary**
7. **Next proposed increment—do not start without approval**

Never claim completion from code inspection alone. Run the changed path using real
inputs in the actual host/package. If scope pressure appears, reduce breadth before
compromising rule truth, typed configuration, one-home authority, save safety,
accessibility, testability, or clean architectural boundaries.
