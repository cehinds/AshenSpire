# Contributing to EldenSpire

## Ground rules

1. **[SPEC.md](SPEC.md) is the source of truth.** Formulas, orderings, and state shapes marked contractual there don't change in a feature PR — change the spec first, in its own PR, then implement.
2. **No FromSoftware assets or proper nouns.** Every new asset goes through `src/ui/assets.js` and gets a line in [CREDITS.md](CREDITS.md) with source URL + license (CC0 / CC-BY / OFL only).
3. **Engine stays headless.** Nothing under `src/engine/` may reference `document`, `window`, `localStorage`, or timers. If a change can't be tested from `tests/index.html`, it doesn't belong in the engine.
4. **Content is data.** A new card, relic, **status**, enemy, or event is a data object in one `src/content/` file, validated against its schema (spec §3.14). If you find yourself writing imperative per-entity code, extend the effect/formula/trigger DSL instead (spec §3.4–3.7) — or, as a last resort, use the budgeted `scripts.js` escape hatch (<5% of content, justified in a comment).
5. **Tests green before merge.** Open `tests/index.html` — all assertions pass, zero console errors. New mechanics ship with new assertions.

## Branch model

```
feature/* ──► dev ──► release ──► main
                └──► test (playtest experiments; may never merge back)
```

| Branch | Rules |
|---|---|
| `main` | Always playable. Merge-only from `release`. Tag releases here (`v0.1.0` = M1, `v0.2.0` = M2, …). |
| `release` | Staging. Cut from `dev` when a milestone's acceptance criteria (spec §9) are met; only fixes land here before merging to `main`. |
| `dev` | Default integration branch. All feature PRs target `dev`. |
| `test` | Sandbox for balance experiments and playtest builds. Branch from `dev`, cherry-pick winners back. Force-pushes allowed here and nowhere else. |
| `feature/<topic>` | One unit of work, branched from `dev`. Prefix milestone work with it, e.g. `feature/m1-combat-slice`, `feature/m2-map-gen`. |

## Commits & PRs

- Small, focused commits; imperative subject line ≤ 72 chars (`Add Bleed burst threshold scaling`), body explains *why* when it isn't obvious.
- PRs into `dev` include: what changed, how it was verified (which tests / manual steps), and a screenshot or GIF for UI changes.
- UI changes also include the [component catalog](docs/component-catalog.html) in the PR/merge summary. Update the catalog and its visual miniature when a component ID, model, renderer, composition, or reuse surface changes.
- Balance number changes cite the reasoning (spec §9 M3 targets: ~35–50% experienced-player win rate).

## Adding content (quick reference)

Full walkthroughs live in `DEVELOPER.md` (lands with M1). Short version:

- **Card:** add one object to `src/content/cards/<class>.js` — id, name, cost, type, rarity, effect opcodes, text template, upgrade override.
- **Relic:** add to `src/content/relics.js` — id, rarity, `{on, if?, do}` triggers.
- **Status:** add to `src/content/statuses.js` — stack mode, decay, optional meter/modifiers/hooks. No engine code.
- **Enemy:** add to `src/content/enemies/act<N>.js` — hp range, poiseMax, weighted move table with `maxConsecutive`.
- **Event:** add to `src/content/events.js` — text + choices, each choice a list of run-level effects.

Then add the id to the relevant reward/encounter pool and, for anything with new mechanics, an assertion in `tests/engine.test.js`.
