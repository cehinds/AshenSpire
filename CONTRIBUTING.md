# Contributing to AshenSpire

## Ground rules

1. **[SPEC.md](SPEC.md) is the source of truth.** Formulas, orderings, and state shapes marked contractual there don't change in a feature PR — change the spec first, in its own PR, then implement.
2. **No FromSoftware assets or proper nouns.** Every new asset gets a line in [CREDITS.md](CREDITS.md) with source URL + license (CC0 / CC-BY / OFL only), and enters through its established path. Since docs/EXTERNAL-ASSETS-PLAN.md step 13 every asset file — the art (`assets/…` ids, both tiers), sound effects (`assets/sfx/<id>.ogg`), the score's renders (`music/…`, loaded through `music/manifest.json`), the map tiles and the fonts (`assets/fonts/`, referenced from `styles/kit.css`) — enters through a PR to [`cehinds/AshenSpire-art`](https://github.com/cehinds/AshenSpire-art) and its release, then a PR here that bumps `art-release.json` and rewrites `art-manifest.json` (`node tools/art-manifest.mjs --write`). Game code names an asset by its id and resolves it through `assetUrl()` (`src/ui/assetmap.js`), or `SFX_MANIFEST` in `src/content/sfx.js` for a sound. The score's source, `music/score/*.mjs`, stays here.
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

### README screenshots

Keep the README concise: play/download table, release screenshots, feature
checkboxes, essential guides and a prominent AI acknowledgement. Detailed setup,
authoring and QA links belong in `docs/PROJECT-GUIDE.md`.

Every listed playable channel, including primary Dev/Test/Release/Main and all
alternatives, carries its published build badge beside its play/download links.
Use that channel's `latest/build.svg`, linked to its history. Verify every listed
badge and play/download target whenever the README changes. Installer build
records identify installer payloads separately from hosted game builds; a build
chooser must name the selected game version. Pinned examples name the full version.

Check only implemented features; release acceptance stays open until its own
evidence is complete. Describe AI authorship of original project work alongside
third-party fonts/software and unresolved provenance. Never infer an asset licence.

Whenever the root README is updated, verify its screenshot gallery against the
latest published build in the [Release history](https://cehinds.github.io/AshenSpire/release/).
If that release changed, replace the gallery with real captures from that
published build in the same PR. If it has not changed, verify that the existing
gallery still identifies that build; identical images do not need recapturing.

- Embed representative gameplay images with short captions and useful alt text:
  character creation, exploration, card combat, and a shop or progression screen.
  Include a phone view when the released game supports that layout.
- Identify the channel, full version, source commit, capture date, viewport, and
  pinned playable URL in the gallery's capture record. Keep each release's images
  in `docs/preview/releases/<full-version>/` and update the README image paths.
  New files under "docs/preview/" are ignored by default; explicitly stage only
  the intended gallery files with "git add -f -- <paths>".
- Wait for the actual screen and its artwork to finish loading. Inspect every
  image for readability, missing artwork, cropped controls, and loading screens
  before committing it. Use the game's existing screenshot states where useful
  and record them; do not present posed captures as completed playthroughs.
- Use the Release channel's published version, not a newer Dev/Test snapshot or
  an installer's publication timestamp. Label release candidates accurately and
  keep alternative previews and older QA evidence clearly identified.
- In the PR verification notes, name the release checked and whether the gallery
  was refreshed or verified unchanged. Screenshot maintenance does not authorize
  advancing `release` or `main` or publishing a release.

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
   - Every `dev` → `test` promotion also starts `sync-alternatives.yml`.
     Existing `alternative/dev` → `alternative/test` pairs (including named
     variants such as `alternative/art/dev` → `alternative/art/test`) receive
     the promoted snapshot, then the alternative dev result is merged into its
     test branch. No missing branch is created. Both updates are pushed
     atomically, without force. Alternative-specific source paths, including
     deletions, are protected: overlapping upstream edits stop the whole sync
     for review, even if Git could merge them. Only the generated build ordinal
     and architecture snapshot are regenerated. Reconcile a blocked sync while
     preserving the variant, then rerun it from `dev` or `test`.
   - Alternative dev/test use the same stage-specific checks and build tiers as
     primary dev/test. The sync explicitly dispatches those workflows because
     bot pushes do not trigger them. Check the sync and alternative runs as well
     as primary test; a blocked sync or red alternative check is not a completed
     promotion. Alternative previews have their own Pages section and README
     build badges; successful preview runs refresh Pages through the default
     branch, without changing the Pages environment's allowed branches.
   - Watch the `test` run. A red there is yours to fix with a new PR into
     `dev`, which you then promote again.
   - Never merge to `release` or `main` (see
     [Coordination and release boundary](#coordination-and-release-boundary)).

### Builds are built by CI, not committed

Owner's rule, 2026-09-26. The built HTML (the root `AshenSpire.html`, and
every HTML under `build/` and `dist/`, with the `packs/` and `objects/` the
pack-shaped build writes beside it; docs/EXTERNAL-ASSETS-PLAN.md step 8e) is
never committed: a pull request carries source, `buildordinal.json`, the
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
