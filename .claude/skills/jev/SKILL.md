---
name: jev
description: "Deterministic-first gate: triage CI/test failures, run fast checks, regenerate generated files, restamp receipts and merge dev into a PR branch with zero model tokens; use before handing any failure or merge to a model"
---

# jev: the deterministic gate

`tools/jev.mjs` (Node, no dependencies) applies fixed rules first and spends model tokens only when no rule fits. Rules are data in `tools/jev.rules.json`.

## When to use

- Every CI red: save the log and run `node tools/jev.mjs triage <log>` (or pipe it to `triage -`) before anyone reads it.
- Every dev merge into a PR branch: `node tools/jev.mjs devmerge`.
- Before every push: `node tools/jev.mjs checks`.

## Commands

Each prints one JSON line (add `--human` for text).

- `triage [file|-]`: match a log against the rule table; reports each match with category, action, command and the evidence line.
- `checks [--fast]`: the fast-check list in order (style-lint, content-build, config-build, game-config, framework-data-build, build-game, bundle-cycles, mechanics-generate, uistrings, run-node core, runsim 5), each failure triaged. `--fast` skips the slow checks (run-node core, runsim). `--only a,b` runs a subset.
- `regen`: about-changelog `--write`, config-build and framework-data-build (before content-build, which refuses config whose hashes do not match `src/config/generated/ui.js` and framework JSON with no `src/framework/data` mirror), content-build, game-config build, build-game.
- `restamp [--pr N]`: orchestrator only (it writes CHANGELOG.md). Sets this PR's receipt to the current `buildordinal.json` stamp, drops duplicate receipt lines, projects the changelog and checks order.
- `devmerge [--base dev] [--pr N]`: clean tree required; merges `origin/<base>` without committing, takes dev's side of generated files, merges CHANGELOG receipts (ours first), regenerates, restamps, runs the check tools, commits the merge. It never pushes (it prints the push command), rebases or forces. Any other conflict aborts the merge and exits 2.

## Exit codes

- 0: pass, or every match has a safe auto-fix (`regen`, `restamp`, `rerun-once`, `ignore-local`). Run the named command; no model.
- 1: a rule explains the failure but there is no safe auto-fix. Follow the rule's note.
- 2: needs a model: no rule matched, a rule says judgement is needed (golden hashes, census counts, uistrings, mechanics-generate), or devmerge hit a conflict it will not guess at.

Only exit 2 goes to a model, with the JSON line as the brief.

## Adding a rule

Append an object to `tools/jev.rules.json` (`id`, `regex`, `flags`, `category`, `deterministic`, `action`, `command`, `note`; order is match order, each rule reports once) and add one fixture log line for it to `FIXTURES` in `tests/jev.test.mjs`; a test fails if a rule has no fixture. `deterministic: false` forces exit 2.
