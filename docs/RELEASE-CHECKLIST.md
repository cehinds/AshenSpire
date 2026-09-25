# Release checklist

This is the written release gate for AshenSpire (docs/FINISH.md §13). A release
candidate (RC) is ready only when every gate below, G1–G17, is green on **one**
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
G14–G17 are the release criteria of docs/FINISH.md that the gates above do not
cover; G14 and G15 need only Node.

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
| G8 | `node tools/bundle.test.mjs` | Exit 0. The bundler's parse-gate fixtures pass (this takes several minutes). | `tests.yml` self-test job, `ci.yml` |
| G9 | `node tools/verdict.mjs -- node tools/launch.mjs --build-only` | Exit 0. The standalone builds are regenerated from the RC source. | `ci.yml` |
| G10 | `node tools/verdict.mjs -- node tools/verify-shipped.mjs` | Exit 0, run after G9. The root and `dist/` copies a player is handed carry art and equal the fresh `build/`. | `ci.yml` |
| G11 | `node tools/contrast-audit.mjs --gate` | Exit 0, **and** the tool's `GATED_PROFILES` includes `cb-safe` beside `default` and `hi-contrast-off`, **and** its `KNOWN_BELOW` ledger has no text rows (FINISH.md §9, #1291). Exit 0 alone only means no new or worsened failure at the profiles it gates today; until both conditions hold, G11 is red. | local only; run it before the RC |
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
| G14 | `node tools/runsim.mjs 5` | Exit 0, ending "No crashes across all simulated runs". Fixed seeds, 5 whole headless runs for every class (FINISH.md §3, line 46). Run it bare: its closing line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. It exits 1 on any crash. | not yet: FINISH.md line 46 asks for `tests/run-node.mjs` to run it |
| G15 | none yet | **RED: not yet runnable.** A browser run on a fixed seed goes Title → Class Select → map → at least 1 combat → boss → Victory or Death → Title → a new run starts, with 0 console errors (FINISH.md §3, line 47). No tool in `tools/` plays a full run in a browser. | none |
| G16 | `node tools/runsim.mjs 100` | **RED: no verdict yet.** Every class's full-run win rate is inside the accepted band, and best minus worst is 20 points or less (FINISH.md §4, line 53). The band is owner decision D1 (FINISH.md line 125), whose proposal is a bot band of 35–65% at 40 or more seeded runs per class. The command prints each class's wins but exits 0 whatever they are, so read the rates. G16 stays red until FINISH.md line 53 is ticked. | none |
| G17 | none yet | **RED: not yet runnable.** The Mana-aware A/B run, `node tools/runsim.mjs 50 --mana-ab`, prints each class's win rate and Mana spent with Mana on and off, and the result lands in docs/BALANCE.md (FINISH.md §4, line 54; SPEC §5.5.1 calls it a release gate). `tools/runsim.mjs` has no `--mana-ab` flag yet. | none |

If a gate is red, the RC is not ready. Fix the cause in a pull request into `dev`,
pick a new RC SHA, and run **every** gate again on it. Do not re-run only the
gate that failed.

## Before the owner signs

- [ ] G1–G12 are green on the RC SHA, and the output of each is kept (a PR
      comment or CI log link).
- [ ] G13: the dispatched `ci.yml` run on the RC SHA succeeded.
- [ ] G14–G17 are green on the RC SHA. None of them is still marked RED or not
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
- the result of each gate G1–G12 and G14–G17, with a link to its output.

After sign-off the owner cuts `release` from that RC SHA, merges it into `main`,
tags `vX.Y.Z` on `main`, and publishes.
