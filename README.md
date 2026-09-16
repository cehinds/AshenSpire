# AshenSpire — Ashen Spire

A roguelike deckbuilder for the browser. Vanilla ES modules, HTML and CSS — no framework, no build step. Mechanically faithful to **Slay the Spire**, thematically inspired by (but legally distinct from) **Elden Ring**.

**[▶ Play AshenSpire](https://cehinds.github.io/AshenSpire/AshenSpire.html)** (stable, from `main`) · **[Every build, by branch](https://cehinds.github.io/AshenSpire/)** · **[Changelog](CHANGELOG.md)** · **[Developer guide](DEVELOPER.md)** · **[Spec](SPEC.md)**

> Single-player with optional LAN co-op. Four classes, three acts, 20 regular enemies, three elites, ten bosses. Seeded, resumable runs. Enemy moves and destinations: [enemy roster](docs/ENEMY-ROSTER.md).

**This is a development preview** — not a release, tag, or production approval. Release status is governed separately and is currently **RED**.

## Playable builds

| Branch | Role | Build | Play | Changelog |
|---|---|---|---|---|
| `main` | stable — the Play link above | [![main build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Fmain%2Fbuildordinal.json&query=%24.ordinal&label=main%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/main/) | [latest](https://cehinds.github.io/AshenSpire/main/latest/) · [all](https://cehinds.github.io/AshenSpire/main/) | [log](https://github.com/cehinds/AshenSpire/blob/main/CHANGELOG.md) |
| `release` | release candidate | [![release build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Frelease%2Fbuildordinal.json&query=%24.ordinal&label=release%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/release/) | [latest](https://cehinds.github.io/AshenSpire/release/latest/) · [all](https://cehinds.github.io/AshenSpire/release/) | [log](https://github.com/cehinds/AshenSpire/blob/release/CHANGELOG.md) |
| `test` | QA | [![test build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Ftest%2Fbuildordinal.json&query=%24.ordinal&label=test%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/test/) | [latest](https://cehinds.github.io/AshenSpire/test/latest/) · [all](https://cehinds.github.io/AshenSpire/test/) | [log](https://github.com/cehinds/AshenSpire/blob/test/CHANGELOG.md) |
| `dev` | integration — unreviewed | [![dev build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Fdev%2Fbuildordinal.json&query=%24.ordinal&label=dev%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/dev/) | [latest](https://cehinds.github.io/AshenSpire/dev/latest/) · [all](https://cehinds.github.io/AshenSpire/dev/) | [log](https://github.com/cehinds/AshenSpire/blob/dev/CHANGELOG.md) |

- **Read each badge down its own column, not across.** The ordinal counts builds *within the current candidate* and restarts when the candidate advances — the four numbers are not a ranking. `main` predates the restart (it is on the `0.4.0` line, still counting globally), hence the thousands.
- **The number is never typed here.** Each badge reads that branch's committed `buildordinal.json` — the same fact the title screen paints as `BUILD <version>.<ordinal> · src <digest>`.
- **Addresses:** `…/<branch>/<ordinal>/` is that exact build, byte-identical to the `AshenSpire.html` of the commit that produced it. `…/<branch>/latest/` is the branch's newest. Each index entry links the `CHANGELOG.md` at that build's commit.
- **Publication:** pushes to `dev`, `test` and `release` publish themselves. A push to **`main` publishes nothing** — the stable Play link moves only on the owner's own workflow dispatch with `publish` spelling PUBLISH. Merging to `main` is owner-only.
- The site is assembled from git history by `node tools/pages-site.mjs`; nothing on it is hand-edited.
- **Weight:** one self-contained file, art and all, at **~58 MB** on the `0.6.0` line — down from 93 MB before the sprite sheets were re-encoded as WebP (#908). It is a single download with no second request, which is why the number is worth stating: on a phone it is the whole cost of starting.

### Offline

Download **[`AshenSpire.html`](AshenSpire.html)** from the repository root and double-click it — one self-contained file, no installation. It is an alias for [`dist/AshenSpire.html`](dist/AshenSpire.html); both are generated from [`build/AshenSpire.html`](build/AshenSpire.html) by `node tools/launch.mjs --build-only`, and `node tools/verify-shipped.mjs` fails if either copy differs. External music folders need http — see [dist/README.md](dist/README.md).

## Running it

- **One click:** double-click **`run.bat`** (Windows) or run **`./run.sh`** (macOS/Linux) — builds into `dist/`, serves on `http://localhost:8080`, opens your browser. Needs [Node.js](https://nodejs.org) only as a static server + bundler; no packages to install.
- **Manually:** serve `index.html` with `node tools/serve.mjs`, `npx serve .`, or `python -m http.server`.

## What is this?

- **A run:** pick a class → traverse a branching map across 3 acts → fight with a deck of cards → collect relics, flasks and cinders → beat the final boss or die trying. Seeded and reproducible.
- **Four classes:** Reaver (strike damage), Rogue (defense and actions), Starseer (magic), Herald (balanced martial-support). Starting attributes and equipment are data-owned.
- **Faithful StS mechanics:** 3 energy / draw 5, block that expires, telegraphed intents, exhaust/ethereal/retain, exact StS damage-order math.
- **Elden Ring flavour with real mechanics:** Bleed as a build-up meter bursting for %-max-HP damage, Crimson Blight as a non-decaying timed DoT, and Poise/Stagger that skips enemy turns and opens damage windows.
- **Equip load and Weight Class:** hands and armour weigh against a capacity from Constitution and Strength; the percentage lands you in Light, Medium or Heavy. Comparing a piece shows the load and class the swap would leave you at.
- **Stamina, and hands that fight empty:** spend no Stamina in a turn and you recover some. The Dodge Roll checks Dexterity against a d20 for a temporary guard, priced by Weight Class (Light 1 Stamina; Medium 2 + 1 action; Heavy 3 + 2 actions). Empty hands bring the Dodge Roll to your deck; a shield counts as a full hand.
- **One component kit, one run HUD built from it:** every screen draws from one kit — one meter, one swatch, one page door, one modal chrome with the same way out in the same corner. Map and Combat compose the same header, vitals, Quick Access, relic and potion components.
- **One data-driven Armoury:** Character, Inventory and Hybrid are presentations of the same equipment owner, using the shared Folding Tray grammar. Authored attack slots rebind to the active weapon package — a lone weapon owns all of them, dual wield splits them right-first without deck growth, and the comparison receipt shows exact before/after counts.
- **Re-arm during a fight:** equip, move or remove carried weapons and armour on your turn. Costs the same Energy as switching a prepared set; equipment cards, HP/MP/SP limits, Poise and positions update inside the current fight and persist after it. A change you cannot afford is refused without spending anything.
- **Every card has an owner, and a smith can change it:** cards lent by equipment leave with the item and return with it — mid-fight and across a save. At a Shrine or a smith-rolled merchant, **Extract a Card** makes one yours for good and **Seat a Card** fills an open mount. An emptied mount shows a fallback (Dodge Roll for weapon-art mounts). No shipped weapon authors a card package yet, so the smith will say there is nothing to work on.
- **The deck cap is a creation rule:** it governs the basic strikes and defends dealt at creation and nothing else. Equipment cards are dealt first, never capped; after creation the cap does not apply.
- **Painted class figures, in the builder and in the fight:** the figure you pick is the one you fight as — animated when you attack, turned to face its target, tinted on the garment so the painting keeps its own light. Each of the twelve alternative armour sets has its own painted figure, falling back to the class figure when it has none. Made with AI image-generation models; disclosed in-game and in [CREDITS.md](CREDITS.md).
- **The battlefield answers what you point at:** hover, focus or tap a status effect for what it does and how far its build-up or countdown has run. Hover or tap either fighter for HP, Poise and effects, with **I** for the full read. When a card is armed, a tap on a target is still a play.
- **Quests that remember what you did:** event choices are written into your run's history, and a step your history has not earned stays out of the pool. Earn it and later maps may roll it at Unknown nodes; an answered step never returns. The Grave of the Nameless is the first chain.
- **Forsaken Together — LAN co-op:** a party shares one map, votes on the fork and fights one shared combat, each seat playing its own deck, relics and flasks. A seat that drops out returns to a catch-up queue. Served by the launcher's Node server, so a `file://` build stays single-player.
- **Character creation, one panel at a time:** six folded picks — class, kit, keepsake, sigil, tint, sprite — each opening the next, with your choices read back in words. Starting armour and stat points sit open as rows of their own. Mouse, keyboard and pad walk the same flow.
- **Rewards you open before you collect:** post-fight spoils are a menu; nothing joins your run until you take it. A reward you have no room for says so and is the only row offering Skip. Settings → Advanced → Reward collection decides whether Continue sweeps up the rest.
- **A merchant who buys back:** five collapsing bars — cards, relics, flasks, remove-a-card, Sell — one open at a time. He buys relics and flasks back at half his cheapest price; the Sell bar can be switched off in Settings.
- **An in-game changelog:** Settings → Changelog reads the repository changelog as expandable rows, with build stamps linking back to the exact source.
- **Responsive browser play:** portrait and short-wide landscape stay playable down to 340 CSS pixels high; smaller viewports show a recoverable short-screen warning instead of a clipped board. Fullscreen is one toggle, first under Settings → Display.

Full design: **[SPEC.md](SPEC.md)** (rules, schemas, numbers) and **[docs/GDD.md](docs/GDD.md)** (design intent, mockups, art direction). Original brief: **[PROMPT.md](PROMPT.md)**.

## Recent additions

- **Combat:** act maps offer named boss destinations beyond the guaranteed rest; enemy inspectors show each move's damage, effects, windup and phase unlocks. Twelve enemies use the painted sprites from the Unity fork.
- **Combat row:** Actions, Draw, centered End Turn, Discard (with separate Discard/Exhaust tabs), Potions at the far right. Potion rows show artwork and counts and expand inline; selecting or expanding one never consumes it. Weapon arts play from the hand.
- **Traders:** armaments and mountable weapon arts alongside the usual stock. Inspect before buying, or sell an unequipped armament from storage; equipped items explain why they cannot be sold. Weapon arts install through the Armoury's card-mounting controls.
- **Character creation:** attached foldout cards, folded by default, closing siblings as you open a choice. Text keeps readable minimums on phones.
- **Armoury:** Character, Equipment, Inventory and Cards tabs, one natural page scroll each. Stats live in Character beside the figure; Cards shows the deck as large separate faces. Change on equipped gear browses compatible inventory; Show all items clears the filter.
- **Motion:** card arrivals and actions respect Reduced motion (in-game setting *and* OS preference), and the Piles control retains the latest discard or exhaust outcome when animations are skipped.

**Dodge feedback:** after a roll, select **Dodge succeeded** / **Dodge failed** beside your character for the roll, check, difficulty and base guard. Dodge grants Block on success — it does not guarantee avoiding the next attack.

See [CHANGELOG.md](CHANGELOG.md) for the PR and build behind each.

## Screenshots

Captured from the exact `dev` tree by `node tools/screenshot.mjs`; the visible build stamp ties each image to the tree that drew it.

| Title | Act map | Combat |
|---|---|---|
| [![Current development title screen](docs/preview/title.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) | [![Current development act map](docs/preview/map.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) | [![Current development combat](docs/preview/combat.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) |

> **Look at any image you regenerate before you commit it.** `tools/screenshot.mjs` sizes the *window*, not the viewport, so under Chromium 141 it writes a picture with a blank bottom band and still **exits 0**. Measured 2026-08-21 at `456b8ea`: 87 blank rows on a 1440x860 capture where CDP produced 0. A green exit is not a good picture.

More captures — Armoury: [Equipment](docs/preview/armoury-simple-equipment-1440.png), [Character](docs/preview/armoury-simple-character-1440.png), [Inventory](docs/preview/armoury-simple-inventory-1440.png), [Cards](docs/preview/armoury-simple-cards-1440.png), [phone cards](docs/preview/armoury-simple-cards-390.png). Title flow: [folded wide](docs/preview/startup-folded-wide-1440x900.png), [folded phone](docs/preview/startup-folded-mobile-390x844.png), [title wide](docs/preview/title-menu-wide-1440x900.png), [Load phone](docs/preview/title-load-mobile-390x844.png). Catalog QA: [title family](docs/preview/component-catalog-title-wide-1440x900.png), [startup family](docs/preview/component-catalog-startup-mobile-390x844.png). Also the [class sprites](docs/preview/class-sprites.svg) and the [menu control audit](docs/preview/menu-control-audit.md).

## UI component library

- **[Component catalog](https://cehinds.github.io/AshenSpire/docs/component-catalog.html)** ([source](docs/component-catalog.html)) — stable component IDs, model/renderer names, reuse surfaces and a visual miniature per component. Select a card for its detail drawer.
- **[Markdown catalog](docs/COMPONENT-CATALOG.md)** — the chat-friendly reference.
- **[Folding Tray gallery](docs/tray-gallery.html)** — every top/right/bottom/left folded and unfolded state; the [Folding Tray contract](docs/TRAY-COMPONENTS.md) defines the grammar.
- **[Component model architecture](docs/COMPONENT-MODEL-ARCHITECTURE.md)** — model, renderer, host, behavior, service and infrastructure boundaries.
- **[Armoury layout contract](docs/ARMOURY-LAYOUT-BRIEF.md)** and **[asset-component index](docs/ASSET-COMPONENTS.md)** — the exact Character, Armaments, Inventory, Cards, Stats, card-hold, comparison and resizing surfaces.
- The catalog decomposes the title flow as `startup-gate` (folded mark, deterministic ash, wordmark, subtitle, divider, input-family prompt), `title-menu` (six centered actions and their selection ornament) and `title-menu-modal` (Load/New heading, slot list, receipts and states, hold-to-delete, Back/Continue).

**Rule:** any merge or PR that changes a UI element must update both catalogs in the same origin-bound change and include `Changed catalog components: <id...>` plus the catalog link in its summary. If the surface has no stable ID, add one first.

## Contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — working rules: one task per branch, draft PRs into `dev`, only the owner merges to `main`.
- **[DEVELOPER.md](DEVELOPER.md)** — build and test commands; how to add a card, relic, enemy or event.
- **[Architecture map](docs/ARCHITECTURE-MAP.md)** — the stable composition/component contract. The [current-`dev` snapshot](docs/ARCHITECTURE-CURRENT-DEV.md) refreshes automatically after every push to `dev`.
- **[QA testing](docs/QA-TESTING.md)** and the **[feature delivery loop](docs/FEATURE-DELIVERY-LOOP.md)** — the design → build → responsive playtest → evidence → documentation process. Latest write-up: [Smith modal design](docs/qa/2026-08-25-smith-modal-design.md).
- **[Project #4](https://github.com/users/cehinds/projects/4)** owns workflow status; **[Status & Daily Briefs](https://github.com/cehinds/AshenSpire/issues/183)** is the readable projection.

### Branches

`feature/* → dev → release → main`

| Branch | Purpose |
|---|---|
| `main` | Stable, playable. Only receives merges from `release`. |
| `release` | Release staging — final checks before `main`. |
| `test` | QA / balance experiments that may never ship. Branched from `dev`. |
| `dev` | Integration. Feature branches merge here. |
| `feature/*` | One branch per unit of work, branched from `dev`, merged back via PR. |

### Repository layout

```
PROMPT.md        the build brief
SPEC.md          the full design + technical specification (source of truth)
AshenSpire.html  current standalone development build (root convenience copy)
index.html       game entry point
styles/          CSS
src/model/       schemas, registries, formula evaluator, validation
src/engine/      generic interpreters + procedural generators — no DOM access
src/content/     ALL game data: cards, statuses, enemies, relics, events, tuning
src/ui/          rendering and input
tests/           headless engine tests (open tests/index.html, expect all green)
DEVELOPER.md     how to add a card/relic/enemy/event
docs/            design, component, and development-coordination documentation
CREDITS.md       every asset's source and license
```

Design rule: adding a new card touches exactly **one** file in `src/content/`.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Combat vertical slice — Reaver, 24 cards, Act 1 enemies + elite + boss, full combat UI | **shipped** |
| **M2** | The run — map generation, rewards, relics, flasks, shops, events, save/continue, seeds | **shipped** |
| **M3** | Content — Rogue, Starseer & Herald, Acts 2–3, full relic/event pools, balance pass | **core shipped**: 4 classes, 3 acts, 40 relics, 10 events, ~30 cards/class + colorless, first balance pass ([BALANCE.md](docs/BALANCE.md)). Deeper pools (~50) and win-rate tuning await M4 telemetry |
| **M4** | Polish — fx, run history, keyboard shortcuts, asset pass | **shipped**: fx, customization, run-history + win-rate telemetry, shortcuts (1–9 / E / Esc), first-run tutorial, sfx hooks, walkthroughs + perf notes, placeholder art tuned across all acts. Bundling external art/audio is a deliberate v1 deferral (SPEC §11) |

Acceptance criteria per milestone: [SPEC.md §9](SPEC.md).

## Legal

Code is MIT ([LICENSE](LICENSE)). A fan-inspired original work: **no** FromSoftware assets, music or proper nouns; not affiliated with or endorsed by FromSoftware or Bandai Namco. All art assets are CC0/CC-BY/OFL and attributed in [CREDITS.md](CREDITS.md).
