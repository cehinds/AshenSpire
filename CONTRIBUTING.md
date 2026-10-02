# Contributing to AshenSpire

## Ground rules

1. **[SPEC.md](SPEC.md) is the source of truth.** Formulas, orderings, and state shapes marked contractual there don't change in a feature PR — change the spec first, in its own PR, then implement.
2. **No FromSoftware assets or proper nouns.** Every new asset gets a line in [CREDITS.md](CREDITS.md) with source URL + license (CC0 / CC-BY / OFL only), and enters through its established path: runtime art under `assets/` resolves through `assetUrl()` (`src/ui/assetmap.js`) and is listed in `art-manifest.json` (`node tools/art-manifest.mjs --write`); sound effects are `assets/sfx/<id>.ogg` (or `SFX_MANIFEST` in `src/content/sfx.js`); music lives under `music/` and loads through `music/manifest.json`; fonts under `assets/fonts/` are referenced from CSS (`styles/kit.css`).
3. **Engine stays headless.** Nothing under `src/engine/` may reference `document`, `window`, `localStorage`, or timers. If a change can't be tested headlessly (`node tests/run-node.mjs`, or `tests/index.html` in a browser), it doesn't belong in the engine.
4. **Content is data.** A new card, relic, **status**, enemy, or event is a data object in one `src/content/` file, validated against its schema (spec §3.14). If you find yourself writing imperative per-entity code, extend the effect/formula/trigger DSL instead (spec §3.4–3.7) — or, as a last resort, use the budgeted `scripts.js` escape hatch (<5% of content, justified in a comment).
5. **Tests green before merge.** `node tests/run-node.mjs` exits 0 (DEVELOPER.md, *Run & test*; `tests/index.html` runs the engine suite in a browser). New mechanics ship with new assertions.

## Coordination and release boundary

How work is branched, reviewed, and merged is the [Branch model](#branch-model)
below.
Every session merges its own PRs into `dev` and promotes `dev` to `test`
(rule 6 below, owner, 2026-09-26); only the owner merges to `release` or
`main`, creates a release tag, or publishes a release.

## Branch model

```
feature/* ──► dev ──► test ──► release ──► main
                      (heavy CI runs on every push to test and release)
```

| Branch | Rules |
|---|---|
| `main` | Always playable. Merge-only from `release`. Tag releases here (`v0.1.0` = M1, `v0.2.0` = M2, …). |
| `release` | Staging. Promoted from `test` (owner only), through an `rc/<version>` branch pinned at the tested RC SHA (docs/RELEASE-CHECKLIST.md), when a milestone's acceptance criteria (spec §9) are met; only fixes land here before merging to `main`. |
| `dev` | Default integration branch. All feature PRs target `dev`, and each session merges its own once the fast checks pass. |
| `test` | Where the heavy CI runs: every push to `test` runs the long suites. Sessions promote `dev` here with a `dev` → `test` PR they merge themselves (rule 6). Only `dev` promotions land here, and `release` is promoted from `test` (owner only, through a pinned `rc/<version>` branch). If `test` is ever deleted, `restore-test-branch.yml` recreates it from `release`, so a fix that landed only on `release` must be merged back into `dev` (a `release` → `dev` PR) before the next promotion; then every heavy run tests what `dev` holds; balance experiments go on their own `experiment/<topic>` branch cut from `dev` (cherry-pick winners back), never on `test`. Force-pushes allowed only on a `feature/*` branch only you have pushed to (a rebase onto `dev`); nowhere else. |
| `feature/<topic>` | One unit of work, branched from `dev`. Prefix milestone work with it, e.g. `feature/m1-combat-slice`, `feature/m2-map-gen`. |

## Commits & PRs

- Small, focused commits; imperative subject line ≤ 72 chars (`Add Bleed burst threshold scaling`), body explains *why* when it isn't obvious.
- PRs into `dev` include: what changed, how it was verified (which tests / manual steps), and a screenshot or GIF for UI changes.
- UI changes also include the [component catalog](docs/component-catalog.html) in the PR/merge summary. Update the catalog and its visual miniature when a component ID, model, renderer, composition, or reuse surface changes.
- Balance number changes cite the reasoning. There is no win-rate target (owner rulings D1 and D16 in docs/FINISH.md), and every balance number stays configurable.

### A pull request is not done until it is merged and promoted

Owner's rule, 2026-09-18 (merging handed to sessions 2026-09-26), for every
session and agent working here. The session that opens a PR takes it all the
way: into `dev`, then promoted to `test` (rule 6). The owner merges only to
`release` and `main`.

1. **Open it ready for review, never as a draft.** Say in the body what is
   unverified rather than hiding it behind draft status.
2. **Have it reviewed before you call it done.** Spawn a review agent, or
   message another live session, with the PR number; verify each finding
   against the diff, fix what stands, push, and note the review's outcome in
   the PR (who reviewed, what changed, what was declined and why).
3. **Keep it mergeable.** Whenever anything else lands on the base branch,
   merge the base into your branch (or rebase, on a branch only you have
   pushed to), resolve every conflict yourself, and regenerate the derived
   files with the tooling, never by hand, in the order the CHANGELOG.md
   header gives. The *receipt* is the PR's CHANGELOG.md entry, which names
   the build it shipped in; the *box* is `buildordinal.json`, which the
   rebuild writes. So: `node tools/launch.mjs --build-only`, re-point the
   receipt to the box's ordinal plus one, `node tools/about-changelog.mjs
   --write`, rebuild again — the box and the receipt now agree — and push.
   Commit `buildordinal.json` and the generated changelog module, **never
   the built HTML**: it is ignored on `dev`, CI builds it and publishes it as
   the `dev-standalone-<commit>` workflow artifact, and CI fails the PR if its
   own rebuild would move `buildordinal.json`. The owner never resolves a
   conflict.
4. **Keep it green.** A failing test or gate is yours to root-cause and fix;
   "flake" is not a diagnosis. Never skip or quarantine a test to get green.
   A PR into `dev` is gated by the fast checks only (about five minutes or
   less); the heavy suites — `tests.yml`'s self-tests and parse gate, `ci.yml`'s
   jobs (3-OS, real-browser and Fullscreen-first), and `dev-preview.yml`'s
   reachability gates — run
   on every push to `test` and `release` (owner, 2026-09-26). DEVELOPER.md
   (*Which checks gate a pull request*) lists each check. To read a heavy suite
   on your PR before promotion, dispatch that workflow on your branch by hand; a
   red at `test` or `release` is yours to fix like any other.
5. **Keep checking after you open it.** Until it is merged or closed, re-check
   it after every merge to the base branch and on a check-in you schedule
   yourself (an hour apart is enough);
   if two open PRs touch the same code, message the other session and agree
   who lands first and who rebases.
6. **Merge to `dev` yourself, then promote to `test`** (owner, 2026-09-26).
   `dev` takes every change whose fast checks pass; the long suites run at
   `test`.
   - Once rules 1–4 hold (reviewed, mergeable, fast checks green), merge
     your PR into `dev` yourself. Use a merge commit.
   - Wait for `architecture-sync` to settle: every push to `dev` starts a
     run that commits a refreshed `docs/ARCHITECTURE-CURRENT-DEV.md` back to
     `dev`, and a newer push cancels the older run. Promote only when the
     latest run on `dev` has succeeded and `dev`'s tip is the commit it
     covered or its own bot commit. Then open a PR from `dev` into `test` and
     merge it yourself, with a merge commit. Immediately before merging,
     check again: the PR's head must still be the `dev` tip and that tip's
     latest `architecture-sync` run must have succeeded. If `dev` moved,
     wait for its sync to settle and check again. That push to `test` runs the heavy suites. If one is
     already open, merge that one rather than opening another. Each
     promotion runs the full 3-OS matrix, so when several of your PRs land
     together, promote once after the last.
   - A promotion does not advance the release candidate (the third
     component of `contentBundle.version`); only the owner names a new
     candidate ([docs/versioning.md](docs/versioning.md)).
   - Watch the `test` run. A red there is yours to fix with a new PR into
     `dev`, which you then promote again.
   - Never merge to `release` or `main` (see
     [Coordination and release boundary](#coordination-and-release-boundary)).

### Builds are built by CI, not committed

Owner's rule, 2026-09-26. The standalone HTML (`AshenSpire.html`,
`AshenSpire-mobile.html` and their `build/` and `dist/` copies) is never
committed: a pull request carries source, `buildordinal.json`, the
regenerated `src/content/changelog.generated.js` and its CHANGELOG receipt,
and regenerated source modules when their authoritative data changes. Built
HTML remains ignored. CI builds every pull request into `dev` and every
push to `dev`, `test`, `release` and `main`, runs the gates that read a build,
and uploads the result as the `<branch>-standalone-<commit>` workflow
artifact; a push to `test` is the playtest build. Where the ordinal comes
from, what each branch keeps and how Pages gets its builds are in
[docs/versioning.md](docs/versioning.md#builds-are-not-committed-2026-09-26).

## Adding content (quick reference)

Full walkthroughs live in [DEVELOPER.md](DEVELOPER.md). Short version:

- **Card:** add one object to `src/content/cards/<class>.js` — id, name, cost, type, rarity, effect opcodes, text template, upgrade override.
- **Relic:** add to `src/content/relics.js` — id, rarity, `{on, if?, do}` triggers.
- **Status:** add to `src/content/statuses.js` — stack mode, decay, optional meter/modifiers/hooks. No engine code.
- **Enemy:** add to `src/content/enemies/act<N>.js` — hp range, poiseMax, weighted move table with `maxConsecutive`.
- **Event:** add to `src/content/events.js` — text + choices, each choice a list of run-level effects.

Then add the id to the relevant reward/encounter pool and, for anything with new mechanics, an assertion in `tests/engine.test.js`.
