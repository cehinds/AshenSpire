---
name: finish
description: Drive the game from its current state to a shippable 1.0 in ultracode mode (multi-agent Workflow). Trigger on "/finish", "FINISH", "finish the game", or "continue FINISH" — not on a bare "finish" about a sentence, task or PR. Keeps a resumable checklist in docs/FINISH.md, fans work out to parallel agents, lands one reviewed PR per task.
---

# FINISH — ultracode: take the game to a shippable 1.0

**ultracode.** Invoking this skill is the user's opt-in to multi-agent
orchestration: load the `workflow-authoring` skill, then run the phases below
with the `Workflow` tool, fanning independent work out to parallel agents.
Keep going until every line of `docs/FINISH.md` is `[x]`, with these limits:
- at most 4 task agents per wave
- stop after 3 waves in one session, or after 2 waves in a row that fail
- report at the end of every wave
"continue FINISH" resumes from the file.

Role: game director + tech lead + QA lead + release engineer. The repo's own
rules win over this prompt — SPEC for game rules, CONTRIBUTING for branching,
review, receipts and merging, DEVELOPER for build/test.

## Phase 0 — Recon (read-only, parallel)
Fan out read-only agents, one per area: spec, content data, engine/UI, tests
and CI, open issues/PRs, changelog/versioning. Run the game and the full test
suite the way DEVELOPER.md says. Record a baseline: test pass rate, FPS on a mid-range phone profile,
load time, build size, console errors.
If `docs/FINISH.md` exists, resume: run a light recon (baseline plus the status of open
PRs), re-plan the remaining `[ ]` lines (Phase 2), then continue with Phase 3.

## Phase 1 — Define done → `docs/FINISH.md`
A checklist; every line has a measurable acceptance test. The spec's own acceptance
criteria come first (e.g. its milestone targets). A target below that the spec
does not set goes under **Owner decisions** as a proposal until the owner
accepts it. An accepted target that changes a contract lands as a spec PR first.
1. **Spec coverage** — every SPEC mechanic implemented and tested; gaps listed by §.
2. **Content** — every act, enemy, card, relic, event and boss the spec requires exists as validated data.
3. **Full run** — new game → win/lose → next run: zero errors, no soft-locks, save/resume works mid-run.
4. **Balance** — win rates within the spec targets, measured with the repo's run simulator if it has one.
5. **Feel & feedback** — every action has visual + audio + haptic response; input <100 ms.
6. **Onboarding** — first fight in <30 s; no text walls.
7. **Performance** — 60 fps on a low-end phone, startup <3 s, no memory growth over a 30-min run.
8. **Mobile** — targets ≥44 pt iOS / 48 dp Android, safe areas, portrait, background/resume, offline.
9. **Accessibility** — color-blind safe, text scaling, reduced motion, remappable input.
10. **Art & audio** — one style guide applied everywhere; off-style assets listed.
11. **Code health** — every check DEVELOPER.md names is green, no dead code, new content needs zero code.
12. **CI** — PR checks <10 min and green on the release candidate.
13. **Release readiness** — version, changelog, save migrations, store/web metadata drafted (owner tags and publishes).
Mark each line `[ ]` / `[~]` / `[x]` with its PR link. Add an **Owner decisions** section.
Open FINISH.md itself as the first PR, ready for review; the owner merges it.

## Phase 2 — Plan
Order the gaps: blockers (crashes, soft-locks, save loss) → spec gaps →
content → feel/flow → performance/mobile → polish → release prep.
Split them into PR-sized tasks (≤1 day each, one concern per branch). Tag each
with the files it touches, and group tasks into **waves** whose file sets do
not overlap.

## Phase 3 — Execute (Workflow, wave by wave)
For each wave, run a pipeline with one agent per task, in parallel:
a. Branch `feature/<topic>` from `dev`; the PR targets `dev`.
b. Write a failing test or reproduction first, when one applies.
c. Make the smallest change that fixes it; content goes in data, not code.
d. Run only the checks DEVELOPER.md names (e.g. the `node --test` suites, content
   validation, the receipts gate) and play the affected flow. Never invent or add a
   toolchain the repo doesn't use.
e. Write receipts and derived files with the repo's tooling, in the order the
   CHANGELOG.md header gives, never by hand. In this repo that means:
   1. `node tools/launch.mjs --build-only`
   2. set the CHANGELOG receipt to `buildordinal.json` + 1
   3. `node tools/about-changelog.mjs --write`
   4. rebuild
   Parallel PRs all claim the same ordinal, so leave receipts until a PR is next
   to merge, or re-point each one after every merge to `dev`.
f. Open a PR, ready for review. The body says what changed and how it was
   verified, and names anything unverified. UI changes add a screenshot or GIF
   and the component catalog per CONTRIBUTING.
Then, per PR:
g. A separate **reviewer agent** verifies findings against the diff.
h. The author agent fixes what stands and notes the outcome in the PR: who
   reviewed, what changed, and what was declined and why.
Serialize anything that touches shared systems or generated files.
After **every** merge to `dev`, for each open FINISH branch:
- merge `dev` in and resolve conflicts
- re-point the receipt and rebuild per (e)
- re-green and push
While PRs stay open, schedule an hourly re-check. If two PRs touch the same
code, agree which lands first. Update FINISH.md.
Every 2 waves, a **QA agent** plays full runs end-to-end and files new bugs
into FINISH.md as blockers.
Merge to `dev` only if the owner has asked you to land work; otherwise leave
finished, green PRs for the owner. Never merge to `release` or `main`.

## Phase 4 — Release candidate
Freeze features (the owner cuts `release`; agents don't). Run 3 full runs per class, the soft-lock sweep, perf and
mobile checks, and the save-migration test.
Draft release notes, a store listing, and a post-launch roadmap:
- patches every 1–2 weeks
- content drops every 4–6 weeks
- balance tuned from live data
Hand the release to the owner, who cuts `release`, tags, merges to `main` and publishes.

## Guardrails
- Never change contractual SPEC rules in a feature PR: the spec change goes first, in its own PR. Balance-number changes cite their reasoning.
- Never skip, disable or quarantine a test. "Flake" is not a diagnosis: root-cause every red gate.
- Force-push only on `test` or on a `feature/*` branch only you have pushed to.
- Never delete CI workflows; never tag, release or publish.
- No metric claim without a number; mark anything unverified as unverified.
- Ask only on real design forks (e.g. a mechanic the spec doesn't define): batch them under **Owner decisions** and keep working on everything else.
- Keep FINISH.md current after every PR, so any new session can resume.
- Cost: fan out only across independent tasks. Stop a wave that keeps failing and record why in FINISH.md.

## Output per session (terse)
- the checklist delta
- the PRs opened or merged
- before/after metrics
- blockers and owner decisions
- the next 3 tasks
