# AI routing: an Opus orchestrator directing Haiku workers

**Status:** These are the owner's operating instructions for AI sessions working in this
repository. They were rewritten on 2026-10-10 at the owner's request. The split itself
is the owner's standing rule: the main session runs on Opus 5.5 and manages Haiku 5.5
subagents, which do the work. Model names here mean the newest model of that tier;
when a new one ships, update the names in this file and CLAUDE.md, and the agent
files' tier aliases pick it up without edits. The details below (brief shape, wave
sizes, escalation) are advisory. It never overrides [SPEC.md](../../SPEC.md)
(mechanics), [CONTRIBUTING.md](../../CONTRIBUTING.md) (branching, review, merge,
promotion) or [DEVELOPER.md](../../DEVELOPER.md) (build and test). Where they disagree,
those files win. Guided-learning work follows
[FORGE-OPERATING-INSTRUCTIONS.md](FORGE-OPERATING-INSTRUCTIONS.md) instead.

The goal is **the most correctly finished work per unit of quota**. The expensive model
spends its tokens on judgement: what to do, whether it was done right, and what to tell
the owner. The cheap model spends its tokens on hands: reading, editing, running and
reporting.

## 1. Roles

| Role | Model | Owns | Never does |
|---|---|---|---|
| **Orchestrator** (the main session) | Opus 5.5 (`claude-opus-5-5`) | Understanding the request; reading SPEC and the contracts; splitting the work; writing worker briefs; choosing models and isolation; verifying every result; deciding review findings; CHANGELOG receipts and `buildordinal.json`; opening, merging and promoting PRs (CONTRIBUTING rule 6); talking to the owner | Bulk reading, broad searches, mechanical edits or long test runs that a worker could do from a brief |
| **Worker** | Haiku 5.5 (`claude-haiku-5-5`), the `ashen-worker` agent | One scoped task in its own worktree and branch: find, edit, test, commit, push, report | Merging, opening or merging PRs, promoting, editing CHANGELOG / `buildordinal.json` / `src/content/changelog.generated.js`, changing SPEC unless the brief says so, widening scope |
| **Reviewer** | Opus 5.5 subagent (`ashen-reviewer`) for risky diffs; Haiku 5.5 for mechanical ones | The independent review CONTRIBUTING requires (*A pull request is not done…*, item 2), from the diff and a list of risks | Re-implementing; reading the whole repo |
| **Escalation worker** | Opus 5.5 subagent | A task that a Haiku worker failed, or one that needs judgement the orchestrator cannot put into a brief | Becoming the default |

Sonnet and the other providers are not part of the default loop (owner preference).

**When the orchestrator does the work itself.** Do it yourself only when writing the
brief would cost more than doing the work: a lookup of one known file, an edit of a few
lines you have already read, or a decision about wording. Anything that sweeps several
files, runs a suite, or repeats an edit goes to a worker.

## 2. The loop

```text
1. Understand   orchestrator: read the request, the SPEC section and the contract; decide what "done" means
2. Split        orchestrator: one task per branch (CONTRIBUTING); disjoint file sets per wave
3. Brief        orchestrator: one brief per task (§3)
4. Execute      workers (Haiku): in parallel, isolation "worktree", in the background
5. Verify       orchestrator: read the diff (not the transcript), re-run the key test, check the acceptance line
6. Review       reviewer (§5); the orchestrator decides each finding against the diff
7. Land         orchestrator: receipt and rebuild, PR, merge into dev, then one promotion to test after the wave
8. Report       orchestrator: to the owner, in CLAUDE.md's question shape when a decision is needed
```

Steps 5–7 are never delegated. A worker's "tests pass" is a claim until the
orchestrator has seen the diff and the test output.

## 3. Writing a worker brief

Haiku does well when it is told exactly where to look and what "done" means, and it
wanders when it is not. Every brief carries the following, in this order:

1. **Setup.** `git fetch origin dev && git checkout -B <branch> origin/dev`.
2. **Read first.** The exact files: CLAUDE.md, the SPEC section with its line range, the
   contract doc.
3. **The defect or goal.** File:line, the failing input and the wrong result, as the
   orchestrator verified it. Never pass on an unverified claim.
4. **The fix's shape.** What to change and what must *not* change. Name the rule when two
   readings are possible; if the worker finds a real conflict, it must stop and report
   rather than guess.
5. **The acceptance test.** The regression to add (file and assertion), the suites to run
   and how to clear environmental failures. Tests that need art fail until
   `node tools/fetch-art.mjs --pack light,common` has run, so run it first rather than
   ignoring them.
6. **Boundaries.** The files it must not touch (CHANGELOG.md, `buildordinal.json`,
   `src/content/changelog.generated.js`, built HTML), no PR, no merge.
7. **Commit and push.** The subject rule (imperative, at most 72 characters), the
   attribution trailer lines in force for the session, and `git push -u origin <branch>`
   with a 2/4/8/16 s retry.
8. **Report format** (§4) and a word cap.

Give paths and line numbers, not a tour of the repo. One brief is one task: if a brief
needs "and also", it is two briefs.

## 4. What a worker reports

Workers return conclusions, never file dumps. The orchestrator never reads a worker's
transcript.

```text
Branch / SHA:
Files changed:
What the fix does (2–4 lines):
Tests: <command> → <pass/fail counts>; failures named, with "environmental" or "real"
Unverified:
Changelog line (player's words, 1–2 sentences):
Stopped because (only if it stopped):
```

## 5. Review (CONTRIBUTING, *A pull request is not done…*, item 2)

| Diff touches | Reviewer |
|---|---|
| `src/engine/`, saves and run schema, co-op parity, progression or XP, SPEC contracts | `ashen-reviewer` (Opus 5.5) |
| UI layout, CSS, docs, tools, tests only, mechanical renames | Haiku 5.5 reviewer |
| Security, destructive git, CI permissions | `ashen-reviewer`, and the orchestrator reads the diff line by line |

Give the reviewer the PR number (CONTRIBUTING requires it), the task, the constraints, the diff (`git diff origin/dev...<branch>`),
the affected files and the specific risks. Do not give it the repo. Every finding is a
claim the orchestrator verifies. Fix what stands (with a worker or directly), and record
in the PR who reviewed, what changed, and what was declined and why.

## 6. Escalation

```text
Haiku worker
  → fails or reports a conflict: the orchestrator sharpens the brief (usually a missing file or rule) and runs Haiku once more
  → fails again, or the failure came from judgement and not context: an Opus 5.5 subagent with the same brief and the Haiku report
  → still blocked: the orchestrator works it directly, or asks the owner (CLAUDE.md question shape)
```

Skip Haiku and brief an Opus subagent from the start when the task is mainly:

- interpreting an ambiguous SPEC or contract;
- designing a save or schema migration;
- an engine change where solo and co-op must stay in step and the brief cannot pin the
  rule;
- tracing a behaviour across several subsystems whose cause is still unknown;
- security-sensitive.

Raise effort only when the failure came from too little reasoning. When the failure came
from a missing file, a vague brief or the wrong model, fix that cause. The Agent tool's
`effort` field is set only when the owner or a skill asks for it.

## 7. Parallelism and shared files

- A wave is up to **6 workers** with **disjoint file sets**. Two tasks that edit the same
  file run in different waves, or as one task.
- Shared, derived files are serialized by the orchestrator at landing: CHANGELOG.md
  receipts, `buildordinal.json`, the generated changelog module, and any `generated/`
  module. Land one PR, merge `dev` into the next branch, rebuild, re-point its receipt,
  then land that one.
- Promote `dev` to `test` once, after the wave's last merge (CONTRIBUTING rule 6).
- Large, independent fan-outs (ten or more agents) use the `Workflow` tool only when the
  owner opts in (for example `/finish`). Its agents take `model: 'haiku'` for workers and
  Opus for review, as above.

## 8. Mechanics in Claude Code

- **Workers:** `Agent({ subagent_type: "ashen-worker", isolation: "worktree", run_in_background: true, prompt: <brief> })`.
  The agent file pins `model: haiku`. With a generic agent type, pass `model: "haiku"`.
  Agent files load when the session starts; if `ashen-worker` is not found (the session
  started on a branch without it), use `general-purpose` with `model: "haiku"` and point
  the brief at `.claude/agents/ashen-worker.md`.
- **Worktree cleanup:** worker worktrees cost disk. At session start and end run `git fetch --prune origin` and `git worktree prune`, then `git worktree remove <path>` and `git branch -d <branch>` (never `-D`) for each worktree that is clean (`git status --porcelain` empty) and whose branch is merged into `origin/dev` (`git merge-base --is-ancestor <branch> origin/dev`). Keep every other worktree; ask the owner before discarding unmerged work.
- **Reviewer:** `Agent({ subagent_type: "ashen-reviewer", prompt: <PR number + diff + risks> })`,
  pinned to `model: opus` and to read-only tools (no Edit/Write). For a mechanical diff, use
  `Agent({ subagent_type: "general-purpose", model: "haiku", prompt: <read-only review brief: PR number + diff + risks + "do not edit"> })`.
- **Escalation:** `Agent({ subagent_type: "general-purpose", model: "opus", ... })` with
  the original brief.
- **Searches only:** the built-in `Explore` agent with `model: "haiku"`, for "where is X"
  sweeps whose result is a list of paths.
- Agent definitions live in `.claude/agents/`. The main session's model is the owner's
  choice of session model (Opus 5.5).
- **Other tools the owner uses outside Claude Code.** For example, GPT/Codex agents or
  Copilot in the IDE. They keep their own routing. This file governs Claude sessions.
  Pick a non-Claude route only when it clearly beats this loop on cost to a finished,
  correct result, not on a benchmark.

## 9. Context economy

- One task per worker, and one feature per session. Start a fresh session when the
  subject changes.
- The orchestrator holds the plan, the briefs and the reports, never raw file contents
  it did not need.
- No two agents rediscover the same architecture. A worker's report, or the
  orchestrator's own diagnosis, is handed to the next agent instead of a repo tour.
- Stable rules stay in files (CLAUDE.md, CONTRIBUTING.md, this file) and are cited by
  path in briefs, not pasted.
- Diffs over whole files, both in briefs and in replies.

## 10. Talking to the owner

- Answer directly, tersely, with no preamble or closing summary (owner preference).
- Questions use CLAUDE.md's shape: one bullet per question, ending in the answer needed,
  plus one sub-bullet saying why it matters.
- Say what was verified and what was not. A worker's claim is not verified until the
  orchestrator has checked it.
- An optional final routing tag, when a different route would materially help:
  `<!-- AI ROUTE | Best: <route> | Review: <reviewer> | Fit: High/Medium/Low | Improve: <one action> -->`.
