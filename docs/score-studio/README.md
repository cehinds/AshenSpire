# Score Studio implementation reference

Use this directory as the shared reference for the approved planning sequence and the next bounded story. Requested capabilities and proposed budgets are not claims of implementation. Current user instructions determine the task being delivered; this reference does not itself authorize a release or unrelated work.

## Start here

- [First story SS-001: persistent library preview and inspector](stories/SS-001-persistent-workspace.md) — user story, twelve acceptance criteria and implementation tasks written before code changes.
- [Claude execution prompt for SS-001](stories/SS-001-claude-execution-prompt.md) — copyable implementation handoff using the story's scope and acceptance reference.
- [Feature checklist](FEATURE-CHECKLIST.md) — tool features first, followed by the complete 180-item requested scope.
- [Prioritized implementation plan](IMPLEMENTATION-PLAN.md) — eight milestones, 33 work packages, reuse boundaries and 27 future local-game acceptance tests.
- [Use cases and proposed UI paths](USE-CASES.md) — all 64 researched cases, interaction targets and package mapping.
- [Structured plan](implementation-plan.json) — the same packages, dependencies, tests and 180-item coverage for tooling.

## First delivery

Complete a supported card edit, actual starter assignment, candidate-revision load, normal local-game play and reversible project handoff. Reuse the current native editor and approved art. A separate combat simulator, a mock preview or a source-only test does not prove this loop works.

SS-001 is the first selected UI task, not the entire first-delivery milestone. Implement only its bounded workspace connection after identifying the actual served source. New presets, drag/drop, mechanic registries and the game bridge retain their own packages and acceptance.

## Status and evidence

This directory records planning as of 26 November 2026. No implementation or future acceptance is marked passed by adding these documents. Earlier local UI checks found working generation, custom decks and bulk removal, but missing sort/tradition controls, inconsistent operation memory and a blocked actual-game starter handoff. Those observations must be rechecked against the current served revision.

The user-supplied 20261125 Starseer card-list JSON was not found at its supplied checkout path during planning. Recover the original fixture before calling the exact ten-card import test passed. Required composition is Arcane Strike x4, Mana Rite x1, Ward x4 and Arcane Bolt x1; resolve stable IDs from the fixture. Temporary Starseer test availability and the explicitly permitted Reaver QA fallback must not alter ordinary progression or silently reclassify original cards.

Keep raw screenshots, browser dumps and run evidence outside this reference directory or in CI artifacts. Update story status only with actual evidence, and leave unrelated drafts, edits, worktrees and archives intact.
