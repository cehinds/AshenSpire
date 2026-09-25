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
`release` from `dev`, merging `release` into `main`, creating the `vX.Y.Z` tag and
publishing any build or storefront listing are the owner's steps alone (see
CONTRIBUTING.md, *Coordination and release boundary*).

## How to run

Start from a clean checkout of the RC SHA with LFS content pulled
(`git lfs pull`) and the promotion target fetched
(`git fetch --no-tags origin test:refs/remotes/origin/test`). Run each command from the repository root exactly as the
table gives it. A gate wrapped in `node tools/verdict.mjs -- …` runs as CI runs
it: a silent exit 0 or a zero-count green is then refused (DEVELOPER.md, *The CI
door*). A gate listed bare prints a result line the door does not accept, so
wrapping it would read as silence; judge it by its exit code. Exit codes from the door:
`0` green, `1` a real failure, `2` the harness could not run, `3` silence,
`4` killed by a signal. A `2` is not a pass. Fix the harness and run again.

Gates G1–G10 need only Node. G11 and G12 need a headless Chromium (Playwright
or a local Edge/Chrome). G13 is a GitHub Actions run, not a local command.
G14–G20 gate the docs/FINISH.md release criteria that G1–G13 do not cover (see
*Criterion map*). G14 and G16 need only Node. G15, G17, G18 and G19 have no
command yet, and G20 is read from docs/FINISH.md.

## Gates

| Gate | Command | Expected result | Where CI runs it |
|------|---------|-----------------|------------------|
| G1 | `node tools/verdict.mjs -- node tests/run-node.mjs` | Exit 0. The whole suite runs (engine suite, every `*.test.mjs`, tool verdicts and each tool's `--selftest`) and reports 0 failures. | `tests.yml` (as two halves), `ci.yml` |
| G2 | `node tools/verdict.mjs -- node tools/buildversion.mjs --check` | Exit 0. The build version is derived and matches the tree, and nobody typed it by hand. | `ci.yml` |
| G3 | `node tools/verdict.mjs -- node tools/receipts.mjs --check --since origin/test` | Exit 0. Every PR merged in `origin/test..HEAD` has a CHANGELOG.md receipt. The range is pinned: without `--since` a checkout that lacks `origin/test` silently falls back to the last 40 merges. Exit 2 means `origin/test` was not fetched, or CHANGELOG.md yielded no PR references at all. | `receipts.yml` (push to `dev`) |
| G4 | `node tools/release-series.mjs` | Exit 0. The version series in the tree is the one the owner approved (docs/versioning.md). | `ci.yml` |
| G5 | `node tools/config-build.mjs --check` | Exit 0. The generated UI config is current with `content/config/`. Run it bare: its "is current with N source file(s)" line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. | `tests/run-node.mjs` |
| G6 | `node tools/balance.mjs --check` | Exit 0. docs/BALANCE.md matches a fresh run. | `tests/balance-doc.test.mjs` |
| G7 | `node tools/verdict.mjs -- node tools/workflow-lint.mjs` | Exit 0. No workflow step is missing `run:`/`uses:` and no key is duplicated. | `ci.yml` |
| G8 | `node tools/bundle.test.mjs` | Exit 0. The bundler's parse-gate fixtures pass (this takes several minutes). | `tests.yml` `bundler parse gate` job, `ci.yml` |
| G9 | `node tools/verdict.mjs -- node tools/launch.mjs --build-only` | Exit 0. The standalone builds are regenerated from the RC source. | `ci.yml` |
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
| G14 | `node tools/runsim.mjs 5` | **RED: not yet in the suite.** Exit 0, ending "No crashes across all simulated runs": fixed seeds, 5 whole headless runs for every class (FINISH.md §3, *A headless full run in CI*). The criterion asks for `tests/run-node.mjs` to run it, and it does not yet, so a hand run on the RC is not enough. Run it bare: its closing line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. It exits 1 on any crash. | not yet: `tests/run-node.mjs` does not run it |
| G15 | none yet | **RED: not yet runnable.** A browser run on a fixed seed goes Title → Class Select → map → at least 1 combat → boss → Victory or Death → Title → a new run starts, with 0 console errors (FINISH.md §3, *A browser full run*). No tool in `tools/` plays a full run in a browser. | none |
| G16 | `node tools/runsim.mjs 100` | **RED: no verdict yet.** Every class's full-run win rate is inside the accepted band, and best minus worst is 20 points or less (FINISH.md §4, *A2–A4: bring the classes into the target band*). The band is owner decision D1 (FINISH.md, *Owner decisions*), whose proposal is a bot band of 35–65% at 40 or more seeded runs per class. The command prints each class's wins but exits 0 whatever they are, so read the rates. G16 stays red until that FINISH.md line is ticked `[x]`. | none |
| G17 | none yet | **RED: not yet runnable.** The Mana-aware A/B run, `node tools/runsim.mjs 50 --mana-ab`, prints each class's win rate and Mana spent with Mana on and off, and the result lands in docs/BALANCE.md (FINISH.md §4, *The Mana-aware A/B balance run*; SPEC §5.5.1 calls it a release gate). `tools/runsim.mjs` has no `--mana-ab` flag yet. | none |
| G18 | none yet | **RED: not yet runnable.** Save and resume hold in a browser, as three separate cases (FINISH.md §3, *Save/resume holds in the browser*; SPEC §9 M2, §3.12): (a) a reload on the map gives a run deep-equal to the one before, minus timestamps; (b) **Save Game** or **Save and Quit** mid-combat, then a reload, gives back exactly the hand, the piles, the enemies with their intents and the resources, through the `CombatSnapshotService` record; (c) a plain reload or abandon mid-combat, with no explicit save, restarts that encounter from its entry checkpoint. No tool in `tools/` drives these in a browser. | none |
| G19 | none yet | **RED: not yet runnable.** docs/BALANCE.md states the seat-tier tolerance, and the 300-seed per-tier runsim results fall within it (FINISH.md §4, *Seat-tier tolerance is stated*; SPEC §13). BALANCE.md states no tolerance yet, and no tool reports win rates per seat tier. G16 checks only each class's overall rate, so one badly tuned tier can hide inside it. | none |
| G20 | read docs/FINISH.md | **RED** while any criterion the *Criterion map* assigns to G20 is `[ ]` or `[~]` in docs/FINISH.md. Green when every one of them is `[x]` on the RC SHA, each tick checked against the code, a test or a command as FINISH.md requires. A criterion the owner rules out of 1.0 moves to a waiver row in the map, with the reason, in a pull request into `dev`. | none: the map is pinned by `tests/release-checklist.test.mjs` |

## Criterion map

Every release criterion in docs/FINISH.md §1–§13 (each `- [ ]`, `- [~]` or `- [x]`
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
| §1 | COMBAT-EQUIPMENT-RULES prototype gate, and each class pool from 36 to 50 cards | G20 |
| §2 | Counts meet SPEC | G20 |
| §2 | Stale content validators are fixed and gated | G20 |
| §2 | More than one elite per seat | G20 |
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
| §11 | DEVELOPER.md has no stale counts | G20 |
| §12 | The receipts gate is green on `dev` | G3 |
| §12 | `codex/` and squash merges land with a receipt | G20 |
| §12 | The CHANGELOG ordering gate runs on PRs | G20 |
| §12 | Push runs of `tests.yml` on `dev` are not cancelled | G20 |
| §12 | PR wall time is under 10 minutes | G20 |
| §12 | The slowest `tests.yml` job fits the <10 min target | G20 |
| §12 | A browser-gate run of `ci.yml` exists on the release candidate | G13 |
| §13 | A written release gate | waived: this checklist is that gate. It is met when this file merges and the owner signs off under it, so it cannot gate itself. |
| §13 | A release-heading format in CHANGELOG | G20 |
| §13 | The save-migration test covers the 1.0 schema | G20 |
| §13 | #1304 follow-up: an in-run Load on a newer-build slot keeps the live run | G20 |
| §13 | LICENSE and docs use the current name and version | G20 |
| §13 | Web and store metadata | G20 |
| §13 | Release notes, store listing and post-launch roadmap drafted | waived: an owner step. Drafted release notes are a *Before the owner signs* box; the store listing, roadmap, cut, tag and publish come after sign-off. |

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

The owner signs by commenting on the release pull request (`release` ← `dev`), or
on a release issue. The comment names:

- the version,
- the tested RC SHA,
- the dispatched `ci.yml` run URL (G13),
- the result of each gate G1–G12 and G14–G20, with a link to its output.

After sign-off the owner cuts `release` from that RC SHA, merges it into `main`,
tags `vX.Y.Z` on `main`, and publishes.
