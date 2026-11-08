# Sandbox QA before the PR

`node tools/qa-sandbox.mjs <acceptance.json> [--out <dir>] [--base <ref>]` (or `npm run qa:sandbox -- <acceptance.json>`)
opens your change in a real browser, compares it to the request and writes `report.md`, `report.json` and PNGs.

- When to run it
  - Before opening any PR with a visible or behavioural change (UI, layout, combat feel, tools, Workbench).
  - Not needed for docs-only or pure-data changes with no on-screen effect.
  - Use `--base origin/dev` to get before/after screenshots; the base tree is a throwaway `git worktree`, removed afterwards.
- Writing the acceptance criteria from the request
  - Copy the owner's request word for word into `request`; it heads the report.
  - Success = the request's observable outcomes, one check each ("Block shield is left of the HP bar", "bars are the same width").
  - Success also holds the "good state" guards, which pass when things are right: `noOverlap` (no overlap), `within` (no clipping), `consoleErrors` (no errors). Never put these under failure: there a good tree reads FAIL.
  - Failure = the likely regressions, each written as the bad state, so a failure check that holds is a FAIL:
    - wrong state (`text`, `style`, `count`);
    - old UI still present (`visible` on the old selector).
  - A `text`, `style`, `within` or `noOverlap` check whose selector matches nothing reports "check broken" and FAILs in either group, so a typo can't pass silently.
  - Run each scene at desktop 1280x800 and phone 390x844 at least.
  - Scenes reuse the `?shot=...` dev hooks (e.g. `?shot=combat&shotSeed=4`); `ready` is a selector to wait for, `actions` are `click`, `tap`, `hold {selector, ms}`, `key`, `wait {ms}`.
    A hold may add `position: {x: 0.5, y: 0.6}` to reproduce an overlap at a specific body point. Coordinates are fractions of the selected element's box, from 0 to 1; omitted means its center.
  - Check kinds: `visible`, `hidden`, `count {min,max,eq}`, `text {includes|matches}`, `within {selector, container}`, `noOverlap {a, b}`, `style {selector, prop, equals}`, `consoleErrors {max, ignore}`.
  - Worked example: `docs/qa/acceptance.example.json` (the mini-HUD request). On `dev` today its "HP and Poise bars are both present" check FAILS at both viewports, because the player mini HUD has one bar; that is the change the request asks for. Everything else passes.
- The PR body section (pasted into every PR; also in `.github/pull_request_template.md`)

```markdown
## Acceptance criteria

Request: <the owner's exact words>

Success looks like:
- <observable outcome>

Failure looks like:
- <likely regression: overlap, clipping, wrong state, console error, old UI still present>

Sandbox result: <N> PASS / <M> FAIL (<link to report.md or the CI artifact>)

Screenshots (before / after, desktop + 390px):
- <links or images>
```

- Rules
  - Exit code 1 means at least one check failed: fix it, or say in the PR why the check is wrong and edit the spec.
  - Never commit `qa-sandbox-out/` or its PNG/JSON (CONTRIBUTING.md, *QA evidence goes to CI artifacts, not the tree*); link a published page or CI artifact instead.
  - Kill stale Chromium (`pkill -f chromium`) before a run on a shared machine.
