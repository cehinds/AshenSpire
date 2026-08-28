# Build "Spire of the Erdtree" — an Elden Ring–themed Slay the Spire–like in HTML/JS

## Goal

Build a complete, playable, single-player roguelike deckbuilder in the browser, mechanically faithful to Slay the Spire, thematically inspired by Elden Ring. It must run by opening `index.html` (or via a trivial static server) with no build step required, while still being cleanly modularized so it's easy to extend.

## Legal / asset ground rules (important)

- Do NOT use ripped or fan-made Elden Ring sprites, logos, music, or exact character names — that's FromSoftware's IP. Use **Elden Ring–inspired** original names (e.g. "The Grafted King" instead of Godrick, "Sites of Grace" is fine as a generic phrase but prefer "Shrine of Grace").
- Source art only from genuinely free/libre sources, and record every asset's origin and license in `CREDITS.md`:
  - **game-icons.net** — thousands of fantasy icons, CC BY 3.0 (perfect for card art, relics, status icons)
  - **Kenney.nl** — CC0 UI packs, borders, buttons
  - **OpenGameArt.org** — filter by CC0/CC-BY; dark fantasy portraits and backgrounds
  - **itch.io free asset packs** — check each license
- Where no suitable asset exists, use inline SVG or CSS-drawn placeholders behind a single `assets.js` lookup so art can be swapped later without touching game code.
- If open-source deckbuilder code exists (e.g. StS modding docs for mechanics reference, small MIT-licensed card-game engines), you may borrow *patterns* from them, but only copy code whose license permits it, and attribute it in `CREDITS.md`.

## Core mechanics — be faithful to Slay the Spire

Implement these rules exactly as StS does; do not simplify them away:

- **Turn structure:** draw 5 cards at turn start, 3 energy per turn (base), unspent energy is lost, hand discards at end of turn. Draw pile reshuffles from discard when empty. Max hand size 10.
- **Block:** expires at the start of your next turn unless a relic/power says otherwise. Damage hits block first.
- **Card types:** Attack / Skill / Power / Curse / Status. Powers leave play when used; Statuses and Curses clog the deck. **Exhaust**, **Ethereal**, **Innate**, **Retain**, **Unplayable**, and **X-cost** keywords all work correctly.
- **Enemy intents:** every enemy telegraphs next action (attack with exact damage numbers × hits, block, buff, debuff) via an icon + tooltip. Intents resolve deterministically from each enemy's move-pattern state machine (with the same "no move 3× in a row" style constraints StS uses).
- **Buffs/debuffs:** Strength, Dexterity, Weak (25% less damage dealt), Vulnerable (50% more damage taken), Frail (25% less block), Poison-style DoT — with correct order of operations: (base + Strength) × Weak × Vulnerable, floored.
- **Map:** procedurally generated branching node map per act — Monster, Elite, Rest, Merchant, Treasure, Unknown(?), Boss. Paths must be walkable only along drawn edges. 3 acts + escalating elites and a final boss per act.
- **Meta-progression within a run:** card rewards (pick 1 of 3), card upgrades at rest sites (rest = heal 30% max HP, smith = upgrade), card removal at merchant, relics from elites/bosses/chests, potions (3 slots).
- **Seeded RNG:** the entire run is reproducible from a seed shown on the death/victory screen. Separate RNG streams for map gen, card rewards, shuffles, and enemy AI (so one choice doesn't perturb everything else — same as StS).

## Elden Ring theming — reskin, don't just rename

- **Currency:** Runes (gold). Dying should feel thematic — show "YOU DIED" screen with run stats and seed.
- **Potions → Flasks:** Crimson Flask (heal), Cerulean Flask (energy), plus craftable Wondrous Physick–style combos as rare drops.
- **Character classes (pick at run start, each with a distinct ~75-card pool):**
  1. **Vagabond** — weapon-arts melee: stance system (cards tagged Stance chain into follow-ups), Strength scaling, Bleed build-up.
  2. **Astrologer** — sorceries: FP-style scaling power cards, glintstone combo (casting 2 spells in a turn triggers bonuses).
  3. **Prophet** — incantations: HP-as-resource cards, Scarlet Rot (stacking DoT that doesn't tick down like Poison — be explicit about how it differs), healing synergies.
- **Elden Ring status effects as the debuff layer:** Bleed (build-up meter → burst damage at threshold), Scarlet Rot (DoT), Frostbite (Vulnerable-like), Madness (self-damage + energy), Poise (enemy stagger meter — filling it skips the enemy's turn and doubles next damage taken, echoing stance-breaks).
- **Bosses with mechanics that echo their inspiration** (original names): a Margit-like boss with delayed-attack intents that swap timing; a Godrick-like boss with a phase 2 that adds a new attack pattern at 50% HP; a Malenia-like final boss that heals when she hits you.
- **Shrine of Grace = rest site.** **Merchant = wandering trader with dialogue flavor.** Unknown nodes roll Elden Ring–flavored events (e.g., "Erdtree Avatar offers a blessing…" choose-one events with real trade-offs).

## Architecture requirements — data- and model-driven, procedural where it counts

- **Vanilla JS (ES modules), HTML, CSS. No framework, no bundler.** Target modern evergreen browsers.
- **Four layers, dependencies pointing downward only:**
  - `src/content/` — **pure data packs**: every card, relic, status, stance, enemy, encounter table, event, flask, class, map config, and *every balance constant*. No logic.
  - `src/model/` — schemas for every entity type, typed id→definition registries, a structured formula evaluator, state factories, and content validation.
  - `src/engine/` — **generic interpreters** (action queue, trigger wiring, status-model interpreter) plus the **seeded procedural generators** (map, encounters, rewards, enemy AI). Zero DOM access; a combat runs headless.
  - `src/ui/` — rendering + input only. Renders from model state, dispatches a closed set of player intents.
- **Schema-first.** All content is validated against schemas at boot (dev mode) and in tests: unknown fields, bad enums, and dangling id references fail loudly.
- **The engine contains no entity-specific code.** No `if (status === 'bleed')` anywhere. The engine implements a closed set of primitives — effect opcodes, structured formula ops (JSON objects, not parsed strings), trigger events, predicates, and a generic status model (stack modes, meters, timers, stat modifiers) — and all game behavior is data composing those primitives. Adding a card, relic, **or even a new status effect** means adding data, not engine code.
- **Procedural content stays procedural.** Map generation, encounter rolls, reward rolls, and enemy move selection remain seeded algorithms — but every knob they consume (type weights, floor constraints, encounter pools, rarity odds, prices) lives in content data. Generators are pure functions of `(config, rngStream, runState)` so they're snapshot-testable.
- **Event-driven combat resolution:** a single action queue (like StS's GameActionManager); relics, powers, statuses, and boss phases all hook in through one declarative trigger form (`{on, if, do}`), never scattered if-statements.
- **Card text is templated** (`"Deal {damage}."`) with tokens bound to effect values computed by the same formula evaluator the engine executes — displayed numbers cannot drift from actual math.
- **A budgeted escape hatch:** a `scripts.js` registry for the rare behavior the DSL can't express (<5% of content, each entry justified in a comment). If a script pattern appears twice, promote it to a DSL primitive.
- **Save/continue:** serialize run state (ids + instance data only, never definitions) to `localStorage` after every choice, with schema and content versioning; offer Continue on the title screen. Abandoning mid-combat restarts that combat (StS behavior).
- **A `DEVELOPER.md`** documenting: the layer rules, state shape, every opcode/formula op/event/predicate, and how to add a card / relic / status / enemy / event in under 10 lines each.
- **Basic tests:** a headless assertion page covering damage math and ordering, block expiry, exhaust, reshuffle, the status model, content validation (every object passes its schema, every id resolves), and text-token binding. No test framework dependency.

## UX requirements — fun and easy to play

- Playable entirely with mouse; hover any card/relic/status/intent for a tooltip explaining exact numbers. Keyword tooltips (Exhaust, Ethereal…) nested inside card tooltips.
- Drag-to-play or click-card-then-click-target — support both. End Turn button with energy-remaining warning.
- Clear layout: enemy row with intents + HP bars + status icons; player HP/block/energy; hand fanned at bottom; draw/discard/exhaust pile counters that open inspectable pile views.
- Fast, readable feedback: damage numbers float, screen-shake on big hits, but every animation ≤ 300ms and skippable. No animation may block input longer than that.
- Dark-fantasy palette (gold on near-black, Erdtree glow accents), serif display font for titles (free Google Font), readable sans for body/tooltips.
- A first-run tooltip overlay (3–4 callouts max) instead of a tutorial level.

## Scope and milestones (build in this order, each independently playable)

1. **M1 — Combat vertical slice:** 1 class (Vagabond), ~20 cards, 3 enemy types + 1 boss, full turn loop, intents, buffs/debuffs, win/lose.
2. **M2 — The run:** map gen, card rewards, rest/merchant/treasure/unknown nodes, relics (~15), flasks, runes, save/continue, seeded runs.
3. **M3 — Content pass:** remaining 2 classes, 3 acts, elites, boss roster, events (~10), relic pool (~40), balance pass.
4. **M4 — Polish:** animations, sound hooks (stubbed, assets optional), death/victory screens with run history.

Deliver M1 first and stop for review before continuing.

## Non-goals (explicitly out of scope)

- No multiplayer, no accounts, no server, no monetization.
- No Ascension/meta-unlock system in v1 (leave a documented hook).
- No mobile-first layout in v1 (don't break at 1280×720+, that's enough).

## Definition of done (per milestone)

- Loads from `index.html` with zero console errors.
- A full combat (M1) / full run (M2+) is winnable and losable.
- All numbers shown to the player match the engine's actual math.
- `DEVELOPER.md` and `CREDITS.md` are current.
- Adding a new vanilla-effect card requires editing exactly one content file.
