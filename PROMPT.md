# Build prompt — AshenedSpire (Unity WebGL)

Paste everything below the line into a fresh agent session opened on this
repository. It is self-contained: it assumes nothing from the original
AshenSpire codebase, only the files in this repository.

---

## Role and goal

You are the lead engineer building **AshenedSpire**, a single-player
dark-fantasy **deckbuilding roguelike** delivered as a **Unity WebGL web app**
that plays in desktop and mobile browsers. The repository you are in contains
only art, animation frames, scenes, music, wireframes, lore, and a
design-intent document for tags and normalized content. There is no code and
no gameplay data. You will create both.

Your first obligation is the **core infrastructure**: a fully data-driven,
tag-driven, headless rules core with a validated content pipeline. Gameplay
breadth comes second and must arrive as data on top of that core. When
infrastructure and a feature compete for time, the infrastructure wins.

## Inputs — read these before writing code

| Path | Use it for |
|---|---|
| `design-intent/TAGS-AND-3NF.md` | **Binding.** The tag model and 3NF content contract. Your schema must satisfy every rule in its §0 |
| `lore/LORE.md`, `LORE-CAST.md`, `LORE-WORLD.md`, `LORE-EMBER.md` | Setting, factions, the four classes, enemies, places, voice. All names and flavour come from here |
| `lore/in-game-text.json` | Existing prose keyed by id: cards, relics, events, quests, classes, gear, places. Seed your content tables' text from it; invent mechanics, never rewrite settled lore |
| `wireframes/` | Screen hierarchy (W0 master shell → W1 workspace/modal → W2 confirmation → W3 main menu → W4 gameplay), component sizing, colour/interaction contract, card anatomy (5:8 card, four bands, left cost rail), responsive wireframes. Open `wireframes/*.html` in a browser |
| `assets/` | Runtime art. `*.manifest.json` files describe frames, anchors and provenance; read every manifest |
| `assets-mobile/` | Downscaled variants of the same art |
| `art/` | Masters, scene layers (`art/webp-maps-*/scene-layers`), prompts and provenance. Import only what `assets/` lacks |
| `music/` | Tracks plus `manifest.json` |
| `ASSETS.md` | Inventory by folder |

Treat every path mentioned *inside* those documents that does not exist here
(e.g. `src/…`, `tools/…`, `content/source/…`) as history. Do not recreate the
old JavaScript architecture; recreate its **intent** in C#.

## The game (derive details from lore and art; numbers are yours, as data)

- **Premise.** The three citadel flames are cold and the cities are ash. You
  are a Forsaken climbing the three Seats' towers to take the cinders from the
  corrupted and relight the flames — or keep the Ember.
- **Classes (4):** Reaver (blood and steel; two stances, bleed, stagger),
  Rogue (ash and opportunism; poison, speed), Starseer (starstone; sequenced
  casting, fragile), Herald (gold and rot; pays health to act, blight). Each has
  a portrait, outfits, readiness poses, defeated poses and full animation sets
  under `assets/`.
- **Run loop:** title → character creation (class, outfit, starting kit,
  keepsake) → map of nodes (combat, elite, event, rest, shop/smith, boss) across
  acts/regions → reward choices → boss → next tower. Permadeath with a durable
  meta profile (unlocks).
- **Combat:** turn-based cards. Energy, draw, hand, discard, exhaust. Enemies
  telegraph intents. Block, HP, statuses (bleed, poison, burn, frost, weak,
  vulnerable, …), a poise meter that fills to **Stagger**, stances, relics,
  flasks. Equipment (main hand, off hand, armour) changes which cards you have
  and how attacks resolve (weapon / spell / unarmed source; slashing, piercing,
  blunt, arcane damage types).
- **World:** region maps and local maps (`assets/environments`, `assets/map`,
  scene layers), legacy dungeons, towns with services and survey quests,
  dialogue with speakers.

Scope v1 as one complete tower (one class fully playable, the other three
selectable with their starter decks), then widen by adding data.

## Non-negotiable architecture

### Layers (assembly definitions enforce direction; dependencies point down)

```
AshenedSpire.Presentation   Unity MonoBehaviours, UI Toolkit, animation, audio, input
AshenedSpire.Application    use-cases, run/scene flow, save/load, view-model projection
AshenedSpire.Rules          engine: effect/trigger/status interpreters, combat, map gen, RNG
AshenedSpire.Content        schemas, loaders, validator, compiled registries (immutable)
AshenedSpire.Core           ids, Result types, deterministic math, tag tree primitives
```

- `Core`, `Content`, `Rules` and `Application` set `noEngineReferences: true`
  in their `.asmdef`. They must compile and run under plain .NET (NUnit, no
  Unity player). A whole combat and a whole run must be simulatable headless
  from a test.
- Presentation never mutates rules state. It dispatches a **closed set of
  player intents** (`PlayCard`, `EndTurn`, `UseFlask`, `ChooseMapNode`,
  `ChooseReward`, `ChooseEventOption`, `ShopBuy`, `RestAction`, `Equip`, …) and
  renders immutable view models plus an ordered event stream.

### Design laws

1. **Schema-first.** Every content family has a typed schema. All content is
   validated at import and in CI; unknown fields, bad enums, dangling ids and
   duplicate keys fail with a message naming the table, row key and column.
2. **No entity-specific code.** Nothing like `if (statusId == "bleed")`. The
   rules layer implements closed primitive sets — effect opcodes, formula ops,
   trigger events, predicates, a generic status/meter model — and every card,
   relic, status, stance, enemy move, event and flask is data composing them.
   Adding one is adding rows.
3. **All tuning is data.** Energy, draw, hand size, odds tables, prices, map
   shape, enemy HP ranges: rows in a balance table. Code holds no gameplay
   constants.
4. **Procedural stays procedural, parameterized by data.** Map generation,
   encounter rolls, reward rolls and enemy move selection are seeded algorithms
   whose knobs are rows.
5. **Budgeted escape hatch.** A registry of named custom behaviours for what
   the DSL cannot express, each justified in a comment, target <5% of content.
   A pattern used twice becomes a primitive.
6. **Deterministic.** One seeded RNG per stream (map, combat, rewards,
   presentation). Presentation randomness never consumes gameplay RNG. Same
   seed + same intents ⇒ identical run; test it.
7. **Definitions vs instances.** Saves store instances (`{instanceId,
   cardId, upgrades}`) and RNG state plus the content revision hash, never
   definitions.

### Tag system (implement exactly the model in `design-intent/TAGS-AND-3NF.md`)

- One tag tree (`nodes`), roots are vocabularies; parent is `parentId` only.
- One association table `tagging(family, scope, objectId, tagId)` is the only
  place any object gets a tag. No `tags` column anywhere, no list in a cell.
- `tagFamilies` / `familyNodes` declare what can be tagged and from which
  subtrees; typed edges in `nodeRelations` (`INHERITS, PERMITS, REQUIRES,
  CONFLICTS_WITH, SUPPRESSES, REPLACES`).
- Conferring (`property`) nodes carry effects that name variables
  (`nodeVariables`); values come from `variableBindings` resolved
  `instance › upgrade › class › default` into balance rows.
- Tags **classify and select**: card pools, reward pools, starting-deck
  composition, shop stock, equipment compatibility, enemy resistances, sprite
  selection (presentation root, which never affects mechanics), SFX/music
  selection, tooltip chips. Numbers stay in typed columns.
- Provide a compiled `TagIndex` (bitsets per family keyed by dense node index)
  with `HasAll`, `HasAny`, `Descends(node, ancestor)` and subtree queries;
  build it at load time, never edit it.

### Content pipeline (3NF, adapter-agnostic)

- Author content as **normalized relations** in `Content/Source/` as CSV (one
  file per relation, comment header stating purpose, key, foreign keys and
  functional dependencies) with JSON allowed for nested DSL payloads such as
  effect lists. Ordered relationships use an ordinal column; many-to-many use
  junction tables; scoped ids keep their scope in the key.
- An editor-time **importer** (plus a CLI entry usable in CI) parses, types,
  validates, then compiles all relations into immutable runtime registries and
  a single versioned, hashed content bundle (`StreamingAssets/content.bin` or
  ScriptableObject set). The same validator runs in tests.
- Validation fails **atomically**: duplicate keys, unknown references,
  illegal tag/family pairs, unused declared variables, literal numbers where a
  balance path is required, cycles in `REQUIRES`, unreachable map nodes.
- Derived indexes, joined view models and compiled bundles may denormalize;
  they are regenerated, never hand-edited.
- Editor tooling: a Content window listing families, row counts, validation
  errors (click to open the CSV row), and a hot-reload button that rebuilds
  registries in Play Mode.

### Assets are data too

- An `assets` relation maps stable **asset ids** to Addressables keys; content
  rows reference asset ids, never file paths. Import every folder under
  `assets/` with an editor script that reads its `manifest.json`, creates
  Addressables entries, sprite import settings, pivots/anchors and
  `animationClips(clipId, frameOrdinal, assetId, durationMs)` rows.
- Frame naming in `assets/animations/<set>/<outfit>/` (`ATK-01…07`, `BUFF`,
  `CAST`, `DEFEND`, `HURT`, `STANCE-*`, `PORTRAIT`, `CONVERSATION`) and in
  `assets/poses`, `assets/enemy-states` (`<enemy>_<state>`),
  `assets/combat-effects` (`<effect><n>`) is the source of clip rows. Which clip
  plays for an action is chosen by **tags** (card classification, weapon
  item type, presentation tags), with a data fallback chain, never by
  hard-coded names.
- Scenes (combat backdrops, map layers, prologue paintings) are chosen by
  `locationProfiles` × time × weather tables with weights; scene choice uses the
  presentation RNG.
- A missing asset renders a visible placeholder and logs once; it never crashes.

### Presentation

- **UI Toolkit** (UXML/USS) with design tokens in one USS variables file
  (surfaces, text, gold accent, positive green, danger red; spacing scale;
  motion durations). Build screens from the wireframe hierarchy: one master
  shell (title top-left, exit top-right, back bottom-left, primary action
  bottom-right, single-row footer), modal and confirmation parents, children
  supply view-model data only.
- Responsive: wide desktop, compact landscape (844×390), and portrait phone
  (375×667, 360×780) layouts from the responsive wireframes; safe areas; touch
  targets ≥ 44 px; no hover-only information.
- Card faces follow the card anatomy wireframe; text renders from templates with
  `{variable}` tokens resolved from live rule values (upgrades, statuses) so a
  tuning change updates tooltips automatically.
- Juice as data: hit flashes, floating numbers, bounded screen shake, stagger
  and bleed bursts. No animation blocks input; a click always skips.
- Accessibility: reduced motion, text scale, colour-safe status glyphs,
  keyboard and gamepad navigation with visible focus.

### WebGL delivery

- Unity 6 LTS, URP 2D renderer, WebGL target, Brotli compression, texture
  compression chosen per platform (ASTC for mobile browsers, DXT/BC desktop),
  sprite atlases per screen, Addressables groups per act so the first load is
  small; show a branded loading screen with progress.
- No threads, no synchronous file IO, no reflection-heavy serializers that break
  under IL2CPP stripping (add `link.xml` where needed). Saves go to IndexedDB
  via `Application.persistentDataPath` + `FS.syncfs` flush on write; the save
  envelope is versioned, migratable and checksum-verified.
- Audio unlock on first user gesture; music crossfades chosen by location
  tags.
- Performance budget: 60 fps on a mid-range laptop, ≥30 fps on a 2021 phone,
  initial download ≤ 25 MB before first interaction.

## Deliverables, in order (each ends green before the next begins)

1. **Skeleton.** Unity project, assemblies above, NUnit test assemblies for
   each engine-free layer, a CI workflow (GitHub Actions with GameCI) that runs
   tests and produces a WebGL build artifact. README with build and run steps.
2. **Content core.** Schemas, CSV/JSON readers, validator, compiler, registries,
   tag tree and `TagIndex`, balance table, variable bindings. Seed the tag tree
   roots and families from `design-intent/TAGS-AND-3NF.md`. Tests prove each
   validator refusal named in that document.
3. **Rules core.** Effect DSL, formulas, triggers/predicates, status and meter
   model (poise → stagger), action queue, event bus, seeded RNG streams, combat
   state machine, enemy intent selection. A headless test plays a scripted
   combat to victory and to defeat; a fuzz test plays 1,000 seeded random
   combats without exceptions.
4. **Asset import.** Manifest-driven importer, Addressables, animation clip
   rows, tag-driven clip resolver with fallback, placeholder handling. A test
   asserts every asset id referenced by content resolves.
5. **Vertical slice.** Title, creation, one act map, combat, rewards, rest,
   shop/smith, one event, boss, victory/defeat, save/resume — one class fully
   playable, UI from the wireframes, running in a browser from the CI artifact.
6. **Breadth as data.** All four classes, three towers/regions, relics, flasks,
   events, equipment and armoury, towns, survey quests, dialogue, meta unlocks —
   each added by rows plus, only where unavoidable, a new primitive with tests.
7. **Polish and ship.** Accessibility pass, mobile layouts, performance budget,
   loading, audio, settings, credits screen from `CREDITS.md`.

## Definition of done for any change

- Tests for every new primitive and every new validator rule; all green headless.
- Content validates with zero errors; bundle hash recorded in the save.
- No gameplay constant, entity id or asset path in C# outside test fixtures —
  enforce with an analyzer or a grep test.
- WebGL build succeeds in CI and the slice is playable in Chrome, Firefox,
  Safari desktop and iOS/Android browsers.
- New content families declare their relation keys and functional dependencies
  in the CSV header.

## Working rules

- Ask before inventing lore that contradicts `lore/`; invent numbers freely but
  put them in the balance table.
- Keep a `docs/DECISIONS.md` log: one entry per architectural decision with the
  alternative rejected.
- Prefer small, reviewable commits: one relation, one primitive, one screen.
