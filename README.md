# AshenSpire — Ashen Spire

A single-player roguelike deckbuilder for the browser. Mechanically faithful to **Slay the Spire**, thematically inspired by (but legally distinct from) **Elden Ring**. Built with vanilla ES-module JavaScript, HTML, and CSS — no framework, no build step.

> **Status: feature-complete core loop.** Three classes, three acts, three bosses, seeded and save-resumable end to end. See [DEVELOPER.md](DEVELOPER.md) to run and extend it.

## Preview

![Combat](docs/preview/combat.png)

![Act map](docs/preview/map.png)

More: the [title screen](docs/preview/title.png) and the three
[class sprites](docs/preview/class-sprites.svg). Regenerate the screenshots any
time with `node tools/screenshot.mjs` (uses your local Chrome/Edge headlessly).

## Playing

**One-click (recommended):** double-click **`run.bat`** (Windows) or run **`./run.sh`**
(macOS/Linux). This builds the standalone into `dist/`, serves the live app on
`http://localhost:8080`, and opens it in your browser. Requires
[Node.js](https://nodejs.org) (used only as a tiny static server + bundler — no
packages to install).

**Standalone file:** grab **[`dist/AshenSpire.html`](dist/AshenSpire.html)** — the
entire game compiled into one self-contained HTML file. Double-click to play,
no server needed. (External music folders need http; see [dist/README.md](dist/README.md).)

**Manually:** open `index.html` via any static server:

```
node tools/serve.mjs      # zero-dependency, opens the browser
# or
npx serve .
# or
python -m http.server
```

No install, no framework, no build step for the source.

## What is this?

- **A run:** pick a class → traverse a branching map across 3 acts → fight enemies with a deck of cards → collect relics, flasks, and cinders → beat the final boss or die trying (seeded, reproducible runs).
- **Faithful StS mechanics:** 3 energy / draw 5 turns, block that expires, telegraphed enemy intents, exhaust/ethereal/retain keywords, exact StS damage-order math.
- **Elden Ring flavor with real mechanics:** Bleed as a build-up meter that bursts for %-max-HP damage, Crimson Blight as a non-decaying timed DoT, and a Poise/Stagger system that skips enemy turns and opens damage windows.

Full design: **[SPEC.md](SPEC.md)** (rules, schemas, numbers) and **[docs/GDD.md](docs/GDD.md)** (design intent, UI mockups, art direction). The original brief: **[PROMPT.md](PROMPT.md)**.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Combat vertical slice — Reaver class, 24 cards, Act 1 enemies + elite + boss, full combat UI | **shipped** |
| **M2** | The run — map generation, rewards, relics, flasks, shops, events, save/continue, seeds | **shipped** |
| **M3** | Content — Starseer & Herald classes, Acts 2–3, full relic/event pools, balance pass | **core content shipped**: 3 classes, 3 acts, 40 relics, 10 events, ~30 cards/class + colorless, first balance pass ([BALANCE.md](docs/BALANCE.md)). Deeper pools (~50) & win-rate tuning await playtest telemetry (M4) |
| **M4** | Polish — fx, run history, keyboard shortcuts, asset pass | **shipped**: fx, customization, run-history + win-rate telemetry, keyboard shortcuts (1–9 / E / Esc), first-run tutorial, sfx hooks, DEVELOPER.md walkthroughs + perf notes, placeholder art tuned across all acts. Bundling real external art/audio is a deliberate v1 deferral (SPEC §11 non-goal) — the generated-placeholder system is the shipped visual style |

Acceptance criteria per milestone are in [SPEC.md §9](SPEC.md).

## Repository layout

```
PROMPT.md        the build brief
SPEC.md          the full design + technical specification (source of truth)
index.html       game entry point (lands with M1)
styles/          CSS
src/model/       schemas, registries, formula evaluator, validation
src/engine/      generic interpreters + procedural generators — no DOM access
src/content/     ALL game data: cards, statuses, enemies, relics, events, tuning
src/ui/          rendering and input
tests/           headless engine tests (open tests/index.html, expect all green)
DEVELOPER.md     how to add a card/relic/enemy/event (lands with M1)
CREDITS.md       every asset's source and license
```

Design rule: adding a new card touches exactly **one** file in `src/content/`.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable, playable. Only receives merges from `release`. |
| `release` | Release staging — final checks before merging to `main`. |
| `dev` | Integration branch. Feature branches merge here. |
| `test` | Balance/playtest experiments that may never ship. Branched from `dev`. |
| `feature/*` | One branch per unit of work (e.g. `feature/m1-combat-slice`), branched from `dev`, merged back via PR. |

Flow: `feature/* → dev → release → main`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Legal

Code is MIT ([LICENSE](LICENSE)). This is a fan-inspired original work: it contains **no** FromSoftware assets, music, or proper nouns, and is not affiliated with or endorsed by FromSoftware or Bandai Namco. All art assets are CC0/CC-BY/OFL and attributed in [CREDITS.md](CREDITS.md).
