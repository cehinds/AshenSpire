# Active AshenSpire session continuation prompts

Six active local AshenSpire chats were reviewed on October 8, 2026 (America/Anchorage). Each prompt preserves its latest work, remaining validation, ownership overlaps and the instructions to push local work to origin and complete reviewed integration. These are detailed snapshots; verify current branches and checks when continuing.

## Continue each active task

| Task | Prompt | Chat | Observed feature branch | Main PR |
|---|---|---|---|---|
| Continue card layers and rank placement | [Open prompt](card-layers-and-rank.md) | 01a119c6-1767-7901-a04f-a4ffd8fbc26e | feature/card-solid-bb | [#1766](https://github.com/cehinds/AshenSpire/pull/1766) |
| Continue Molten River delivery and pose corrections | [Open prompt](molten-river-and-pose-work.md) | 01a119f7-2a07-7fa3-8d06-39a01c0f36cf | codex/volcanic-blight-dev-20261008 | [#1763](https://github.com/cehinds/AshenSpire/pull/1763) |
| Continue rear sprites and stable combat layers | [Open prompt](rear-sprites-and-layering.md) | 01a11e4f-637a-78d0-8106-f9963acc640c | DETACHED at discovery; create codex branch before delivery | Create after preserving detached work |
| Continue combat mechanics and formula delivery | [Open prompt](combat-mechanics-and-formulas.md) | 01a117e5-7a97-7170-bed5-62561c5ee7b8 | codex/combat-promotion-polish-20261008 | Create after preserving detached work |
| Continue defensive reactions and implementation checklist | [Open prompt](reactions-and-implementation-checklist.md) | 01a119ef-560f-75a3-b785-c472683863b0 | codex/combat-reaction-runtime | [#1767](https://github.com/cehinds/AshenSpire/pull/1767) |
| Continue PR integration and channel promotion | [Open prompt](pr-integration-and-promotion.md) | 01a11843-0b3a-79d2-b6f1-166891a487f6 | codex/readme-player-guide-20261008 | [#1757](https://github.com/cehinds/AshenSpire/pull/1757) |

## Scope and selection

The selection uses the app's active status, excludes this coordination chat, and includes the active PR integration chat because it is delivering repository work. Idle and notLoaded chats were excluded; notLoaded does not prove running work. The latest 8 turn records were read for each target, together with their actual command paths, current local status and GitHub's open PR inventory. Some turn records contained no older messages, so the prompts use available latest evidence and repository contracts without claiming complete historical coverage.

The pose-titled chat is currently finishing Molten River delivery. The checklist-titled chat is currently implementing reactions. Their prompts preserve the original obligations and latest scope. Original chat titles remain in each task prompt for reliable identification.

## Merge coordination

Each feature owner pushes and verifies its own branch, resolves its own changes, and completes review/gates before merging. The PR integration chat coordinates landing order and batched test promotion. Compare overlapping sprite anchors/targets across rear-sprite work and #1757, card display across #1766 and mechanics, reaction timing across #1767 and sprite animation, and generated receipts across all branches.

The documentation branch is codex/session-continuations-20261008. Its documentation PR should land in dev before a replacement AI relies on pulling dev alone. The prompts are also recoverable by fetching that branch. Each session updates its own prompt with final origin SHAs, merge/promotion evidence and remaining work.

## Replacement AI startup

1. Fetch origin in the correct repository and confirm its URL.
2. Read this index and the assigned task prompt from dev, or fetch codex/session-continuations-20261008 if the documentation PR is still pending.
3. Locate the task owner's latest status and verified remote branch. Create or reuse an appropriate worktree under D:/repos/.codex/worktrees; preserve dirty primary checkouts.
4. Pull the confirmed branch with --ff-only or reconcile its origin history explicitly. Inspect actual source, PR and workflow head before reusing any snapshot claim.
5. Continue the task's ordered actions and update its Git-tracked handoff before ending.

