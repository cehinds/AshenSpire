# Release checklist

This is the written release gate for AshenSpire (docs/FINISH.md §13). A release
candidate (RC) is ready only when every gate below, G1–G20, is green on **one**
commit, the RC SHA. A gate marked **RED** is red until its condition holds, and a
gate marked **not yet runnable** counts as red. The owner then signs off outside
this file, in a comment on the release pull request or a release issue (see
*Owner sign-off*); only the owner cuts `release` or `main` (CONTRIBUTING.md,
*Coordination and release boundary*). Nothing is written into this file to
sign, because editing it makes a new commit that never ran the gates.

**Only the owner cuts a release.** Agents never cut `release`, tag, or publish.
They may run these gates and report results in a pull request into `dev`. Cutting
`release` from the tested RC SHA on `test` (through a branch pinned to that SHA, below), merging `release` into `main`, creating the `vX.Y.Z` tag and
publishing any build or storefront listing are the owner's steps alone (see
CONTRIBUTING.md, *Coordination and release boundary*).

## How to run

Start from a clean checkout of the RC SHA (since #1332 `dev` tracks nothing in
Git LFS, so no `git lfs pull` is needed; the full art is still in `assets/` until
docs/ART-REPO-PLAN.md step 4 moves its readers to `tools/fetch-art.mjs`) with the
promotion target fetched
(`git fetch --no-tags origin test:refs/remotes/origin/test`). Run each command from the repository root exactly as the
table gives it. A gate wrapped in `node tools/verdict.mjs -- …` runs as CI runs
it: a silent exit 0 or a zero-count green is then refused (DEVELOPER.md, *The CI
door*). A gate listed bare prints a result line the door does not accept, so
wrapping it would read as silence; judge it by its exit code. Exit codes from the door:
`0` green, `1` a real failure, `2` the harness could not run, `3` silence,
`4` killed by a signal. A `2` is not a pass. Fix the harness and run again.

Gates G1–G10 need only Node. Run G9 (the build) before G2 and G10, which read it:
the built HTML is not committed, so a clean RC checkout has none until G9 runs. G11 and G12 need a headless Chromium (Playwright
or a local Edge/Chrome). G13 is a GitHub Actions run, not a local command.
G14–G20 gate the docs/FINISH.md release criteria that G1–G13 do not cover (see
*Criterion map*). G14, G16, G17 and G19 need only Node. G15 and G18 have no
command yet, and G20 is read from docs/FINISH.md.

## Gates

| Gate | Command | Expected result | Where CI runs it |
|------|---------|-----------------|------------------|
| G1 | `node tools/verdict.mjs -- node tests/run-node.mjs` | Exit 0. The whole suite runs (engine suite, every `*.test.mjs`, tool verdicts and each tool's `--selftest`) and reports 0 failures. | `tests.yml` as two halves: `core` (`run-node.mjs --no-selftests`, on every `dev` PR and on pushes to `dev`, `test` and `release`) and `selftests` (`--selftests-only`, on pushes to `test` and `release`, since #1345); `ci.yml` `test` job, all three OSes (the whole command, on a push to `test` or `release`) |
| G2 | `node tools/verdict.mjs -- node tools/buildversion.mjs --check` | Exit 0, run after G9. The build version is derived and matches the tree, and nobody typed it by hand. Rows D–F read the build, which is not committed (since 2026-09-26), so G9 comes first. | `ci.yml` |
| G3 | `node tools/verdict.mjs -- node tools/receipts.mjs --check --since origin/test` | Exit 0. Every PR merged in `origin/test..HEAD` has a CHANGELOG.md receipt. The range is pinned: without `--since` a checkout that lacks `origin/test` silently falls back to the last 40 merges. Exit 2 means `origin/test` was not fetched, or CHANGELOG.md yielded no PR references at all. | `receipts.yml` on a push to `dev` (`--check`, whose default range is the same `origin/test..HEAD`). A PR into `dev` runs `--check --pr auto` instead, which is not this gate |
| G4 | `node tools/release-series.mjs` | Exit 0. The version series in the tree is the one the owner approved (docs/versioning.md). | `ci.yml` |
| G5 | `node tools/config-build.mjs --check` | Exit 0. The generated UI config is current with `content/config/`. Run it bare: its "is current with N source file(s)" line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. | `tests/run-node.mjs` |
| G6 | `node tools/balance.mjs --check` | Exit 0. docs/BALANCE.md matches a fresh run. | `tests/balance-doc.test.mjs` |
| G7 | `node tools/verdict.mjs -- node tools/workflow-lint.mjs` | Exit 0. No workflow step is missing `run:`/`uses:` and no key is duplicated. | `ci.yml` |
| G8 | `node tools/bundle.test.mjs` | Exit 0. The bundler's parse-gate fixtures pass (this takes several minutes). | `tests.yml` `parse-gate` (bundler parse gate) and the `ci.yml` `test` job on ubuntu only, on a push to `test` or `release`. `tests/run-node.mjs` does not run it (`NOT_SPAWNED`), so G1 does not cover it |
| G9 | `node tools/verdict.mjs -- node tools/launch.mjs --build-only --full-art` | Exit 0. The standalone builds are regenerated from the RC source with the full art and the mobile file, as release/main CI builds them. Without `--full-art` launch builds the light dev/test tier, which is not a release build. | `ci.yml` |
| G10 | `node tools/verdict.mjs -- node tools/verify-shipped.mjs` | Exit 0, run after G9. The root and `dist/` copies a player is handed carry art and equal the fresh `build/`. | `ci.yml` |
| G11 | `node tools/contrast-audit.mjs --gate` | Exit 0, **and** the tool's `GATED_PROFILES` includes `cb-safe` beside `default` and `hi-contrast-off`, **and** its `KNOWN_BELOW` ledger has no text rows (FINISH.md §9, *The palettes pass contrast*). Exit 0 alone only means no new or worsened failure at the profiles it gates. **RED:** since #1291 `cb-safe` is gated, but `KNOWN_BELOW` still holds 12 text rows (the reward Continue HOLD cue and the TAKEN chip and title in each gated profile), all from `opacity` rules in `styles/kit.css`. Green also needs a workflow to run `contrast-audit.mjs --gate` (FINISH.md §9 asks for it in CI); today only a `ci.yml` echo names it. | not yet: no workflow runs it |
| G12 | `node tools/verdict.mjs -- node tools/about-changelog.mjs` | Exit 0. The in-game changelog is a faithful projection of CHANGELOG.md, in order. | `ci.yml` |

Gate G13 has no local command. A hand-dispatched `ci.yml` run on the RC SHA must
conclude **success** on every job, including the browser gates and the 3-OS
matrix (FINISH.md §12, owner decision D7). Name the run URL in the sign-off.

## Release-criterion gates

A green G1–G13 does not show that a whole run can be played or that the classes
are balanced. `balance.mjs --check` (G6) only proves docs/BALANCE.md is fresh, and
the `ci.yml` boundary itself says none of its jobs fights, wins, loses or finishes
a run. Each FINISH.md release criterion below is therefore its own gate, whether
or not a command for it exists yet.

| Gate | Command | Expected result | Where CI runs it |
|------|---------|-----------------|------------------|
| G14 | `node tools/runsim.mjs 5` | Exit 0, ending `RESULT: 20 runs over 4 classes (5 fixed seeds each), every one to a win or a death — … 0 crashes, 0 soft-locks.`: fixed seeds, 5 whole headless runs for every class (FINISH.md §3, *A headless full run in CI*). It exits 1 on any crash or soft-lock (a fight its action guard cannot resolve, or an act walk longer than its map). Run it bare: its RESULT line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. `node tools/runsim.mjs --selftest` proves the rung can still go red. | `tests/run-node.mjs` (core lane: `runsim 5`; selftest lane: `runsim --selftest`) |
| G15 | none yet | **RED: not yet runnable.** A browser run on a fixed seed goes Title → Class Select → map → at least 1 combat → boss → Victory or Death → Title → a new run starts, with 0 console errors (FINISH.md §3, *A browser full run*). No tool in `tools/` plays a full run in a browser. | none |
| G16 | `node tools/runsim.mjs 100` | **RED: no verdict yet.** Every class's full run completes with no crash and its report lands in BALANCE.md (FINISH.md §4, *A2–A4: bring the classes into the target band*). Owner ruling D1 (2026-09-26): there is no win-rate band for 1.0, and every balance number stays configurable. G16 stays red until that FINISH.md line is ticked `[x]`. | none |
| G17 | `node tools/runsim.mjs 50 --mana-ab` | Exit 0. The fleet runs twice on the same seeds, Mana OFF (the Mana line never refuses a card) then ON (the shipped game), and the closing `MANA A/B` table prints each class's win rate and mean Mana spent per run for both arms (FINISH.md §4, *The Mana-aware A/B balance run*; SPEC §5.5.1 calls it a release gate). The RC's result is recorded in docs/BALANCE.md §7.1 (kept in docs/balance-runs.md). A report, not a pass band: owner ruling D1 (2026-09-26). | none: run by hand. `tests/runsim-report-flags.test.mjs` pins the output shape on 2 seeds |
| G18 | none yet | **RED: not yet runnable.** Save and resume hold in a browser, as three separate cases (FINISH.md §3, *Save/resume holds in the browser*; SPEC §9 M2, §3.12): (a) a reload on the map gives a run deep-equal to the one before, minus timestamps; (b) **Save Game** or **Save and Quit** mid-combat, then a reload, gives back exactly the hand, the piles, the enemies with their intents and the resources, through the `CombatSnapshotService` record; (c) a plain reload or abandon mid-combat, with no explicit save, restarts that encounter from its entry checkpoint. No tool in `tools/` drives these in a browser. | none |
| G19 | `node tools/runsim.mjs 300 --seat-tiers --seeded-seats` | Exit 0. The `SEAT TIERS` block prints the configured `balance.seatTiers` and `balance.bossTiers` rows, read from content, and each tier's clear rate per class and per seat, and docs/BALANCE.md §7.2 (kept in docs/balance-runs.md) records the 300-seed result with those multipliers (FINISH.md §4, *Seat-tier tolerance is stated*; SPEC §13). A report, not a pass band: owner ruling D1 (2026-09-26) sets no win-rate gate for 1.0, so any recorded rate passes. | none: run by hand. `tests/runsim-report-flags.test.mjs` pins the output shape on 2 seeds |
| G20 | read docs/FINISH.md | **RED** while any criterion the *Criterion map* assigns to G20 is `[ ]` or `[~]` in docs/FINISH.md. Green when every one of them is `[x]` on the RC SHA, each tick checked against the code, a test or a command as FINISH.md requires. A criterion the owner rules out of 1.0 moves to a waiver row in the map, with the reason, in a pull request into `dev`. | none: the map is pinned by `tests/release-checklist.test.mjs` |

## Criterion map

Every release criterion in docs/FINISH.md §1–§15 (each `- [ ]`, `- [~]` or `- [x]`
line) maps to one gate above, or to a waiver that gives its reason. A criterion is
named by the words its FINISH.md line starts with, not by its line number, because
FINISH.md is edited after every pull request and its line numbers move.
`tests/release-checklist.test.mjs` fails when a FINISH.md criterion has no row
here or more than one, when a row here names a criterion FINISH.md no longer has
or a key that starts more than one criterion, when a checkbox line in FINISH.md
cannot be read, and when any gate still has an open criterion but is not marked
**RED**. When you add,
rename or remove a FINISH.md criterion, update this table in the same pull request.

| § | FINISH.md criterion | Gate |
|---|---------------------|------|
| §1 | Guilt deals its in-hand turn-end HP loss | G20 |
| §1 | Warrior's Vow lets you choose a stance | G20 |
| §1 | Remove the stale Frostbite deviation | G20 |
| §1 | DEVELOPER.md stops calling Guilt inert | G20 |
| §1 | Card hotkeys 1–9 have a test | G20 |
| §1 | Abandoning mid-combat restarts that combat | G20 |
| §1 | Every card, relic and event is reachable | G20 |
| §1 | The 7 orphan cards get a route in, or an owner-ruled allowlist row | G20 |
| §1 | SPEC text matches what shipped | G20 |
| §1 | SPEC P8b: Powers hold a resting stance until the next turn | G20 |
| §1 | COMBAT-EQUIPMENT-RULES prototype gate, and each class pool from 36 to 50 cards | waived: post-1.0 by owner ruling D3 (2026-09-26). |
| §1 | Progression leftovers: 3b-ii, the class-swap boss-reward door, quest XP | waived: post-1.0 by owner ruling D18 (2026-09-27). |
| §2 | Counts meet SPEC | G20 |
| §2 | Stale content validators are fixed and gated | G20 |
| §2 | 1–5 elites per seat, averaging 3 | G20 |
| §2 | Deck editor between runs | G20 |
| §2 | Three shop types: shop, blacksmith, wise master | G20 |
| §2 | D11 design issues are in 1.0 scope | G20 |
| §2 | [#845] | G20 |
| §2 | [#785] | G20 |
| §2 | [#239] | G20 |
| §2 | [#1026] | G20 |
| §2 | [#601] | G20 |
| §3 | A headless full run in CI | G14 |
| §3 | A browser full run | G15 |
| §3 | Save/resume holds in the browser | G18 |
| §4 | A1: the simulators play by the live rules | G6 |
| §4 | A2–A4: bring the classes into the target band | G16 |
| §4 | The Mana-aware A/B balance run | G17 |
| §4 | Seat-tier tolerance is stated | G19 |
| §5 | Click to impact ≤ 400 ms at Normal pacing | G20 |
| §5 | The idle animation plays | G20 |
| §5 | Hit sound tiers | G20 |
| §5 | Haptics | G20 |
| §6 | A quick start gives the first card play in 6 inputs or fewer | G20 |
| §6 | The tutorial reachability probe runs in CI | G20 |
| §6 | A disabled Next button shows its reason as visible text | G20 |
| §7 | 60 fps on a low-end phone profile | G20 |
| §7 | Startup < 3 s | G20 |
| §7 | No memory growth over a 30-minute run | G20 |
| §8 | Targets ≥ 44 pt on iOS and ≥ 48 dp on Android (48 CSS px on a coarse pointer), text ≥ 11 px | G20 |
| §8 | #724: no hand card drawn over Draw or End Turn | G20 |
| §8 | hintstrip H6: `--fan-lift` matches the fitted fan | G20 |
| §8 | #1142: the map camera fits the scrollport after it settles | G20 |
| §8 | #1289 follow-up: a re-fit keeps the tray's selected-destination framing | G20 |
| §8 | #1164: the card door stacks between 601 and 703 px | G20 |
| §8 | Offline and installable web edition | G20 |
| §8 | Pages serves the external-art edition, and the single-file download stays available | G20 |
| §8 | One physical iPhone in Safari plays a run before release | G20 |
| §8 | Background and resume keep the run | G20 |
| §9 | The palettes pass contrast | G11 |
| §9 | #1282 follow-up: the contrast audit measures the highlighted Continue | G20 |
| §9 | Reduced motion is proven in a browser | G20 |
| §9 | Text scaling, reduced motion, reduce flashes | G20 |
| §9 | Escape or pad B backs out of every screen | G20 |
| §10 | One style guide, with off-style assets listed | G20 |
| §10 | Every asset directory has a CREDITS row, and README §Legal agrees with the AI disclosure | G20 |
| §11 | Every check `tests/run-node.mjs` runs is green | G1 |
| §11 | #1167: card widths come from `sizing.levels` | G20 |
| §11 | #1230: the two component catalogs agree | G20 |
| §11 | #1297 follow-up: C22 compares the semantic and Armoury catalogs separately | G20 |
| §11 | `tools/ui-components.mjs` is green on `dev` and runs in the suite | G20 |
| §11 | `tools/flask-action-contract.mjs` is green on `dev` and runs in the suite | G20 |
| §11 | Map Potions onChange persistence/remount is covered by a test | G20 |
| §11 | Map Potions list and mini-menu selections dispatch the chosen action is covered by a test | G20 |
| §11 | A real-browser flask-menu behaviour test replaces flask-action-contract's source half | G20 |
| §11 | DEVELOPER.md has no stale counts | G20 |
| §12 | The receipts gate is green on `dev` | G3 |
| §12 | `codex/` and squash merges land with a receipt | G20 |
| §12 | The CHANGELOG ordering gate runs on PRs | G20 |
| §12 | Push runs of `tests.yml` on `dev` are not cancelled | G20 |
| §12 | PR wall time is under 10 minutes | G20 |
| §12 | The slowest `tests.yml` job fits the <10 min target | G20 |
| §12 | A browser-gate run of `ci.yml` exists on the release candidate | G13 |
| §12 | Builds are not committed; CI builds them | G20 |
| §12 | A slow cold Chrome start does not fail a browser job | G20 |
| §12 | Every `ci.yml` job finishes in 20 minutes or less | G20 |
| §13 | A written release gate | waived: this checklist is that gate. It is met when this file merges and the owner signs off under it, so it cannot gate itself. |
| §13 | A release-heading format in CHANGELOG | G20 |
| §13 | The save-migration test covers the 1.0 schema | G20 |
| §13 | #1304 follow-up: an in-run Load on a newer-build slot keeps the live run | G20 |
| §13 | LICENSE and docs use the current name and version | G20 |
| §13 | Web and store metadata | G20 |
| §13 | Release notes and post-launch roadmap drafted | waived: an owner step. Drafted release notes are a *Before the owner signs* box; the roadmap, cut, tag and publish come after sign-off, and the store listing waits for D8's store pick. |
| §14 | SPEC §14 lands before any code | G20 |
| §14 | Deck rules and ordered draw | G20 |
| §14 | Deck editor UI | G20 |
| §14 | Shop kinds and the guaranteed minimum | G20 |
| §14 | Market additions | G20 |
| §14 | Blacksmith screen | G20 |
| §14 | Wise master | G20 |
| §15 | SPEC §15 lands before any code | G20 |
| §15 | Card reward schedule | G20 |
| §15 | Levelling preview and cap | G20 |
| §15 | Crafting drops | G20 |
| §15 | Legendary sigils | G20 |

If a gate is red, the RC is not ready. Fix the cause in a pull request into `dev`,
pick a new RC SHA, and run **every** gate again on it. Do not re-run only the
gate that failed.

## Before the owner signs

- [ ] G1–G12 are green on the RC SHA, and the output of each is kept (a PR
      comment or CI log link).
- [ ] G13: the dispatched `ci.yml` run on the RC SHA succeeded.
- [ ] G14–G20 are green on the RC SHA. None of them is still marked RED or not
      yet runnable, and the output of each is kept.
- [ ] CHANGELOG.md carries the release heading for this version.
- [ ] The release notes are drafted.

## Owner sign-off

Given by the owner only. An agent never gives, fills in or edits a sign-off.

The sign-off is **not** recorded in this file. Editing a tracked file makes a new
commit, so a sign-off written here would sit on a commit that never ran the gates,
and a commit cannot name its own SHA. This file stays a template.

The owner signs by commenting on the release pull request, or on a release issue.
Sessions keep promoting `dev` to `test` (CONTRIBUTING.md rule 6), so a
`release` ← `test` pull request would advance past the RC SHA. Its head is
instead `rc/<version>`, a branch created at the tested RC SHA and never
moved. The comment names:

- the version,
- the tested RC SHA,
- the dispatched `ci.yml` run URL (G13),
- the result of each gate G1–G12 and G14–G20, with a link to its output.

After sign-off the owner cuts `release` from that RC SHA, merges it into `main`,
tags `vX.Y.Z` on `main`, and publishes.
