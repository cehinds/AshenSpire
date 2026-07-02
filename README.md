# EldenSpire — Spire of the Erdtree

A single-player roguelike deckbuilder for the browser. Mechanically faithful to **Slay the Spire**, thematically inspired by (but legally distinct from) **Elden Ring**. Built with vanilla ES-module JavaScript, HTML, and CSS — no framework, no build step.

> **Status: M1 in review.** The combat vertical slice is playable — Vagabond vs. a 4-fight gauntlet ending at The Watchful Omen. See [DEVELOPER.md](DEVELOPER.md) to run and extend it.

## Playing

Once M1 lands: open `index.html` in any modern browser, or serve the folder with any static server:

```
npx serve .
# or
python -m http.server
```

No install, no build, no dependencies.

## What is this?

- **A run:** pick a class → traverse a branching map across 3 acts → fight enemies with a deck of cards → collect relics, flasks, and runes → beat the final boss or die trying (seeded, reproducible runs).
- **Faithful StS mechanics:** 3 energy / draw 5 turns, block that expires, telegraphed enemy intents, exhaust/ethereal/retain keywords, exact StS damage-order math.
- **Elden Ring flavor with real mechanics:** Bleed as a build-up meter that bursts for %-max-HP damage, Scarlet Rot as a non-decaying timed DoT, and a Poise/Stagger system that skips enemy turns and opens damage windows.

Full design: **[SPEC.md](SPEC.md)** (rules, schemas, numbers) and **[docs/GDD.md](docs/GDD.md)** (design intent, UI mockups, art direction). The original brief: **[PROMPT.md](PROMPT.md)**.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Combat vertical slice — Vagabond class, 24 cards, Act 1 enemies + elite + boss, full combat UI | **in review** |
| **M2** | The run — map generation, rewards, relics, flasks, shops, events, save/continue, seeds | not started |
| **M3** | Content — Astrologer & Prophet classes, Acts 2–3, full relic/event pools, balance pass | not started |
| **M4** | Polish — fx, run history, keyboard shortcuts, asset pass | not started |

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
