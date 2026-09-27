# AshenSpire — Ashen Spire

A roguelike deckbuilder for the browser. Vanilla ES modules, HTML and CSS — no framework, no build step. Mechanically faithful to **Slay the Spire**, thematically inspired by (but legally distinct from) **Elden Ring**.

**[▶ Play AshenSpire](https://cehinds.github.io/AshenSpire/AshenSpire.html)** (stable, from `main`) · **[Every build, by branch](https://cehinds.github.io/AshenSpire/)** · **[Changelog](CHANGELOG.md)** · **[Developer guide](DEVELOPER.md)** · **[Spec](SPEC.md)**

> Single-player with optional LAN co-op. Four classes, three acts, 20 regular enemies, three elites, ten bosses. Seeded, resumable runs. Enemy moves and destinations: [enemy roster](docs/ENEMY-ROSTER.md).

**This is a development preview** — not a release, tag, or production approval. Release status is governed separately and is currently **RED**.

## Test the game now

- **Stable:** the [Play link](https://cehinds.github.io/AshenSpire/AshenSpire.html) above. It serves `main`, which is on the older `0.6.0` line and has no mobile edition yet.
- **Latest `dev` build** (the built HTML is not committed on `dev`; CI uploads it):
  1. Sign in to GitHub and open the [dev preview workflow, filtered to `dev`](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Adev).
  2. Click the newest run.
  3. Under **Artifacts** at the bottom of the run summary, click **`dev-standalone-<commit>`** to download a zip.
  4. Unzip it and open `AshenSpire-dev-preview.html` in a browser. One ~29 MB file, no install. Artifacts expire after 14 days.

  A pull request's run offers the same artifact for that PR's build.
- **Run from source:** install [Node.js](https://nodejs.org) (22 is what CI uses; there is no `package.json` and nothing to `npm install`), clone, then `node tools/launch.mjs` — or `./run.sh` (macOS/Linux) / `run.bat` (Windows), which call it. It builds, serves on `http://localhost:8080` and opens your browser. `--no-open`, `--port <n>`, and `--build-only` (write the files, don't serve) are the options.

## Playable builds

| Branch | Role | Build | Play | Changelog |
|---|---|---|---|---|
| `main` | stable — the Play link above | [![main build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Fmain%2Fbuildordinal.json&query=%24.ordinal&label=main%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/main/) | [latest](https://cehinds.github.io/AshenSpire/main/latest/) · [all](https://cehinds.github.io/AshenSpire/main/) | [log](https://github.com/cehinds/AshenSpire/blob/main/CHANGELOG.md) |
| `release` | release candidate | [![release build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Frelease%2Fbuildordinal.json&query=%24.ordinal&label=release%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/release/) | [latest](https://cehinds.github.io/AshenSpire/release/latest/) · [all](https://cehinds.github.io/AshenSpire/release/) | [log](https://github.com/cehinds/AshenSpire/blob/release/CHANGELOG.md) |
| `test` | QA | [![test build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Ftest%2Fbuildordinal.json&query=%24.ordinal&label=test%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/test/) | [latest](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Atest) · [all](https://cehinds.github.io/AshenSpire/test/) | [log](https://github.com/cehinds/AshenSpire/blob/test/CHANGELOG.md) |
| `dev` | integration — unreviewed | [![dev build](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcehinds%2FAshenSpire%2Fdev%2Fbuildordinal.json&query=%24.ordinal&label=dev%20build&color=8a4b1f&cacheSeconds=600)](https://cehinds.github.io/AshenSpire/dev/) | [latest](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml?query=branch%3Adev) · [all](https://cehinds.github.io/AshenSpire/dev/) | [log](https://github.com/cehinds/AshenSpire/blob/dev/CHANGELOG.md) |

- **Read each badge down its own column, not across.** The ordinal counts builds *within the current candidate* and restarts when the candidate advances, so the four numbers are not a ranking. `main` is on the `0.6.0` line; the others are on `0.7.1`.
- **The number is never typed here.** Each badge reads that branch's committed `buildordinal.json` — the same fact the title screen paints as `BUILD <version>.<ordinal> · src <digest>`.
- **Where a build lives.** `main` and `release` still commit their build, so the site's `…/<branch>/latest/` is their newest and `…/<branch>/<ordinal>/` is that exact build. `dev` (since 2026-09-26) and `test` no longer commit it: the site's sections for them stop at the last committed build, and every newer build is the `<branch>-standalone-<commit>` artifact of the [dev preview workflow](https://github.com/cehinds/AshenSpire/actions/workflows/dev-preview.yml) (kept 14 days on `dev`, 30 on `test`, 90 on `release`/`main`).
- **Publication:** the site is assembled from git history by `node tools/pages-site.mjs` (`.github/workflows/pages-builds.yml`); nothing on it is hand-edited. A push to `dev` republishes it; a push to `main` publishes nothing — the stable Play link moves only on the owner's own workflow dispatch with `publish` spelling PUBLISH. Merging to `main` is owner-only.
- **Art tiers and size:** `dev` and `test` build the **light** tier — one ~29 MB file whose art comes from the committed `assets-mobile/` twins. `release` and `main` build the **full** art: `AshenSpire.html` (~255 MB on `0.7.1`) plus `AshenSpire-mobile.html`, the same build with images shrunk and held **under 30 MB** by `tools/verify-shipped.mjs`. Saves are compatible between them.
- **High-res art** lives in the private repo `cehinds/AshenSpire-art`. `art-release.json` pins the release (`hd-assets-v1`), and `node tools/fetch-art.mjs` downloads and verifies it (needs `ART_REPO_TOKEN`). To play a light build with it, unpack the release and pick its folder in **Settings → Display → Art quality → Local high-res**; anything the folder lacks keeps the built-in art, and the choice stays on that device.
- **Offline:** any single `.html` above plays by double-click from disk, no server. External music folders need http — see [dist/README.md](dist/README.md). `node tools/verify-shipped.mjs` checks that the local copies (`build/`, the root aliases, `dist/`) agree.

## What is this?

- **A run:** pick a class → traverse a branching map across 3 acts → fight with a deck of cards → collect relics, flasks and cinders → beat the final boss or die trying. Seeded and reproducible.
- **Four classes:** Reaver (strike damage), Rogue (defense and actions), Starseer (magic), Herald (balanced martial-support). Starting attributes and equipment are data-owned.
- **Faithful StS mechanics:** 3 energy / draw 5, block that expires, telegraphed intents, exhaust/ethereal/retain, exact StS damage-order math.
- **Elden Ring flavour with real mechanics:** Bleed as a build-up meter bursting for %-max-HP damage, Crimson Blight as a non-decaying timed DoT, and Poise/Stagger that skips enemy turns and opens damage windows.
- **Equip load and Weight Class:** hands and armour weigh against a capacity from Constitution and Strength; the percentage lands you in Light, Medium or Heavy. Comparing a piece shows the load and class the swap would leave you at.
- **Stamina and the Dodge Roll:** every fight opens with full Stamina; Mana carries between fights. Every deck carries exactly one Dodge Roll, whatever you hold. It checks Dexterity against a d20 and, on success, grants Block (not guaranteed avoidance), priced by Weight Class (Light 1 Stamina; Medium 1 + 1 action; Heavy 2 + 1 action). Afterwards, **Dodge succeeded** / **Dodge failed** beside your character shows the roll, check, difficulty and guard.
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
- **Responsive browser play:** portrait and short-wide landscape stay playable down to 340 CSS pixels high; smaller viewports show a recoverable short-screen warning instead of a clipped board. Fullscreen is one toggle, first under Settings → General → Display.

Full design: **[SPEC.md](SPEC.md)** (rules, schemas, numbers) and **[docs/GDD.md](docs/GDD.md)** (design intent, mockups, art direction). Original brief: **[PROMPT.md](PROMPT.md)**.

## Recent additions

From the last two weeks of [CHANGELOG.md](CHANGELOG.md), which names the PR and build behind each.

- **Art quality** (#1339): Settings → Display → Art quality → *Local high-res* plays with full-resolution art from a folder on your device.
- **A recorded score** (#1328): hosted builds play thirteen tracks — title, shop, rest, combat, elite, boss, victory and one map track per region — composed as code. A build opened from disk keeps the synthesized score.
- **Settings** (#1277): Advanced opens one topic at a time, Find searches every section, every number has − · slider · field · +, and changed values show a dot and their own Reset.
- **Dodge and Stamina** (#1309, #1284): a landed Dodge Roll gives real Block; each fight opens with full Stamina; bosses scale with the order you meet them in.
- **Quest boards** (#1261): every town's inn lists its quests; taking and turning one in is a conversation with the Road Warden.
- **Character creation** (#1238, #1273): every attribute starts at 1 with three points to assign; new players start on the owner's tuned defaults.
- **Progression** (#1192, #1228): each class level buys a node in a class tree whose top tier names your subclass; the Armoury shows bars for your level and every skill you train.
- **The opening** (#1211): after creation, six painted scenes lead to your starting place; Advanced → Opening sequence edits them.

## Screenshots

Captured from the exact `dev` tree by `node tools/screenshot.mjs`; the visible build stamp ties each image to the tree that drew it.

| Title | Act map | Combat |
|---|---|---|
| [![Current development title screen](docs/preview/title.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) | [![Current development act map](docs/preview/map.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) | [![Current development combat](docs/preview/combat.png)](https://cehinds.github.io/AshenSpire/AshenSpire.html) |

> **Look at any image you regenerate before you commit it.** `tools/screenshot.mjs` sizes the *window*, not the viewport, so under Chromium 141 it can write a picture with a blank bottom band and still exit 0.

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

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — working rules: one task per branch, PRs into `dev` opened ready for review, only the owner merges to `main`.
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
AshenSpire.html  standalone build (root alias; built locally or by CI, not committed on dev/test)
art-release.json pins the high-res art release in cehinds/AshenSpire-art
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
| **M3** | Content — Rogue, Starseer & Herald, Acts 2–3, full relic/event pools, balance pass | **core shipped**: 4 classes, 3 acts, 63 relics, 25 events, 40 cards per class + 35 colorless, first balance pass ([BALANCE.md](docs/BALANCE.md)). Deeper pools (~50) and win-rate tuning await M4 telemetry |
| **M4** | Polish — fx, run history, keyboard shortcuts, asset pass | **shipped**: fx, customization, run-history + win-rate telemetry, shortcuts (1–9 / E / Esc), first-run tutorial, sfx hooks, walkthroughs + perf notes, placeholder art tuned across all acts. Since then: painted art, a recorded score for hosted builds (#1328), and high-res art in its own release (#1353) |

Acceptance criteria per milestone: [SPEC.md §9](SPEC.md).

## Legal

Code is MIT ([LICENSE](LICENSE)). A fan-inspired original work: **no** FromSoftware assets, music or proper nouns; not affiliated with or endorsed by FromSoftware or Bandai Namco.

The [AI disclosure](src/content/aiDisclosure.js) sums it up: "Ashen Spire was built by AI under human direction." AI assistants (Anthropic's Claude) wrote the code, design and writing, an OpenAI image-generation model (ChatGPT Codex) was used for art, and the music was composed as code: written as notes in `music/score/` and rendered by an AI-written synthesizer, with no samples and no AI music model. What each tool made, and how much, is stated in that disclosure, which is the authoritative account: Settings → About, or `node tools/ai-disclosure.mjs --full`. The bundled lore fonts are SIL OFL. [CREDITS.md](CREDITS.md) lists every asset directory with its source and rights, and marks the files whose provenance is not yet recorded.
