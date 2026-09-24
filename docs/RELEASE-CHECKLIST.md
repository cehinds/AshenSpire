# Release checklist

This is the written release gate for AshenSpire (docs/FINISH.md §13). A release
candidate (RC) is ready only when every gate below is green on **one** commit, the
RC SHA, and the owner has signed off at the bottom of this file.

**Only the owner cuts a release.** Agents never cut `release`, tag, or publish.
They may run these gates and report results in a pull request into `dev`. Cutting
`release` from `dev`, merging `release` into `main`, creating the `vX.Y.Z` tag and
publishing any build or storefront listing are the owner's steps alone (see
CONTRIBUTING.md, *Coordination and release boundary*).

## How to run

Start from a clean checkout of the RC SHA with LFS content pulled
(`git lfs pull`). Run each command from the repository root exactly as the
table gives it. A gate wrapped in `node tools/verdict.mjs -- …` runs as CI runs
it: a silent exit 0 or a zero-count green is then refused (DEVELOPER.md, *The CI
door*). A gate listed bare prints a result line the door does not accept, so
wrapping it would read as silence; judge it by its exit code. Exit codes from the door:
`0` green, `1` a real failure, `2` the harness could not run, `3` silence,
`4` killed by a signal. A `2` is not a pass. Fix the harness and run again.

Gates G1–G10 need only Node. G11 and G12 need a headless Chromium (Playwright
or a local Edge/Chrome). G13 is a GitHub Actions run, not a local command.

## Gates

| Gate | Command | Expected result | Where CI runs it |
|------|---------|-----------------|------------------|
| G1 | `node tools/verdict.mjs -- node tests/run-node.mjs` | Exit 0. The whole suite runs (engine suite, every `*.test.mjs`, tool verdicts and each tool's `--selftest`) and reports 0 failures. | `tests.yml` (as two halves), `ci.yml` |
| G2 | `node tools/verdict.mjs -- node tools/buildversion.mjs --check` | Exit 0. The build version is derived and matches the tree, and nobody typed it by hand. | `ci.yml` |
| G3 | `node tools/verdict.mjs -- node tools/receipts.mjs --check` | Exit 0. Every PR merged in `origin/test..HEAD` has a CHANGELOG.md receipt. Exit 2 means CHANGELOG.md yielded no PR references at all. | `receipts.yml` (push to `dev`) |
| G4 | `node tools/release-series.mjs` | Exit 0. The version series in the tree is the one the owner approved (docs/versioning.md). | `ci.yml` |
| G5 | `node tools/config-build.mjs --check` | Exit 0. The generated UI config is current with `content/config/`. Run it bare: its "is current with N source file(s)" line is not a form the verdict door accepts, so wrapped it exits 3 on a green tree. | `tests/run-node.mjs` |
| G6 | `node tools/balance.mjs --check` | Exit 0. docs/BALANCE.md matches a fresh run. | `tests/balance-doc.test.mjs` |
| G7 | `node tools/verdict.mjs -- node tools/workflow-lint.mjs` | Exit 0. No workflow step is missing `run:`/`uses:` and no key is duplicated. | `ci.yml` |
| G8 | `node tools/bundle.test.mjs` | Exit 0. The bundler's parse-gate fixtures pass (this takes several minutes). | `tests.yml` self-test job, `ci.yml` |
| G9 | `node tools/verdict.mjs -- node tools/launch.mjs --build-only` | Exit 0. The standalone builds are regenerated from the RC source. | `ci.yml` |
| G10 | `node tools/verdict.mjs -- node tools/verify-shipped.mjs` | Exit 0, run after G9. The root and `dist/` copies a player is handed carry art and equal the fresh `build/`. | `ci.yml` |
| G11 | `node tools/contrast-audit.mjs --gate` | Exit 0. No new or worsened WCAG AA contrast failure at any gated profile. | local only; run it before the RC |
| G12 | `node tools/verdict.mjs -- node tools/about-changelog.mjs` | Exit 0. The in-game changelog is a faithful projection of CHANGELOG.md, in order. | `ci.yml` |

Gate G13 has no local command. A hand-dispatched `ci.yml` run on the RC SHA must
conclude **success** on every job, including the browser gates and the 3-OS
matrix (FINISH.md §12, owner decision D7). Record the run URL in the sign-off.

If a gate is red, the RC is not ready. Fix the cause in a pull request into `dev`,
pick a new RC SHA, and run **every** gate again on it. Do not re-run only the
gate that failed.

## Before the owner signs

- [ ] G1–G12 are green on the RC SHA, and the output of each is kept (a PR
      comment or CI log link).
- [ ] G13: the dispatched `ci.yml` run on the RC SHA succeeded.
- [ ] CHANGELOG.md carries the release heading for this version.
- [ ] The release notes are drafted.

## Owner sign-off

Filled in by the owner only. An agent never fills in or edits this section.

| Field | Value |
|-------|-------|
| Version | |
| RC SHA | |
| `ci.yml` run (G13) | |
| Gates G1–G12 green | yes / no |
| Signed off by | |
| Date | |

After sign-off the owner cuts `release` from the RC SHA, merges it into `main`,
tags `vX.Y.Z` on `main`, and publishes.
