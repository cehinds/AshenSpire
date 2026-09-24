---
name: finish
description: Drive the game from its current state to a shippable 1.0 in ultracode mode (multi-agent Workflow). Trigger on "/finish", "FINISH", "finish the game", or "continue FINISH" — not on a bare "finish" about a sentence, task or PR. Keeps a resumable checklist in docs/FINISH.md, fans work out to parallel agents, lands one reviewed PR per task.
---

# FINISH — ultracode: take the game to a shippable 1.0

**ultracode.** Invoking this skill is the user's opt-in to multi-agent
orchestration: load the `workflow-authoring` skill, then run the phases below
with the `Workflow` tool, fanning independent work out to parallel agents.
Keep going until every line of `docs/FINISH.md` is `[x]` or the session ends;
"continue FINISH" resumes from that file.

Role: game director + tech lead + QA lead + release engineer. The repo's own
rules win over this prompt — SPEC for game rules, CONTRIBUTING for branching,
review, receipts and merging, DEVELOPER for build/test.

## Phase 0 — Recon (read-only, parallel)
Fan out read-only agents, one per area: spec, content data, engine/UI, tests
and CI, open issues/PRs, changelog/versioning. Run the game and the full test
suite. Record a baseline: test pass rate, FPS on a mid-range phone profile,
load time, build size, console errors.
If `docs/FINISH.md` exists, skip to Phase 3 and resume.

## Phase 1 — Define done → `docs/FINISH.md`
A checklist; every line has a measurable acceptance test:
1. **Spec coverage** — every SPEC mechanic implemented and tested; gaps listed by §.
2. **Content** — every act, enemy, card, relic, event and boss the spec requires exists as validated data.
3. **Full run** — new game → win/lose → next run: zero errors, no soft-locks, save/resume works mid-run.
4. **Balance** — win rates within spec targets (simulated runs if the sim supports it).
5. **Feel & feedback** — every action has visual + audio + haptic response; input <100 ms.
6. **Onboarding** — first fight in <30 s; no text walls.
7. **Performance** — 60 fps on a low-end phone, startup <3 s, no memory growth over a 30-min run.
8. **Mobile** — targets ≥44 pt iOS / 48 dp Android, safe areas, portrait, background/resume, offline.
9. **Accessibility** — color-blind safe, text scaling, reduced motion, remappable input.
10. **Art & audio** — one style guide applied everywhere; off-style assets listed.
11. **Code health** — lint/typecheck clean, no dead code, new content needs zero code.
12. **CI** — PR checks <10 min and green on the release candidate.
13. **Release readiness** — version, changelog, save migrations, store/web metadata drafted (owner tags and publishes).
Mark each line `[ ]` / `[~]` / `[x]` with its PR link. Add an **Owner decisions** section.
Land FINISH.md itself as the first PR.

## Phase 2 — Plan
Order the gaps: blockers (crashes, soft-locks, save loss) → spec gaps →
content → feel/flow → performance/mobile → polish → release prep.
Split them into PR-sized tasks (≤1 day each, one concern per branch). Tag each
with the files it touches, and group tasks into **waves** whose file sets do
not overlap.

## Phase 3 — Execute (Workflow, wave by wave)
For each wave, run a pipeline with one agent per task, in parallel:
a. Branch from the integration branch (`dev`).
b. Write a failing test or reproduction first, when one applies.
c. Make the smallest change that fixes it; content goes in data, not code.
d. Run the repo's checks: lint, typecheck, tests, content validation, and a play of the affected flow.
e. Add the repo's required receipts and derived files (e.g. CHANGELOG entry, rebuilt bundles) with its tooling, never by hand.
f. Open a PR, ready for review.
Then, per PR:
g. A separate **reviewer agent** verifies findings against the diff.
h. The author agent fixes what stands and notes the review outcome in the PR.
Serialize anything that touches shared systems or generated files. After each
wave: merge dev into any open branch that conflicts, re-green it, and update
FINISH.md.
Every 2 waves, a **QA agent** plays full runs end-to-end and files new bugs
into FINISH.md as blockers.
Merge to `dev` only if the owner has asked you to land work; otherwise leave
finished, green PRs for the owner.

## Phase 4 — Release candidate
Freeze features. Run 3 full runs per class, the soft-lock sweep, perf and
mobile checks, and the save-migration test.
Draft release notes, a store listing, and a post-launch roadmap:
- patches every 1–2 weeks
- content drops every 4–6 weeks
- balance tuned from live data
Hand the release to the owner, who tags, merges to main and publishes.

## Guardrails
- Never change contractual SPEC rules in a feature PR: the spec change goes first, in its own PR. Balance-number changes cite their reasoning.
- Never skip or disable tests, never force-push shared branches, never delete CI workflows, never tag, release or publish.
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
