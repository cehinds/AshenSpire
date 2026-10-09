# Continue Molten River delivery and pose corrections

Finish the selected Molten River Blight meter on regular dev and verify its already-merged alternative delivery. Preserve the earlier class pose requests as separate remaining work requiring the owner's selections.

## Session and branch

- Chat ID: 01a119f7-2a07-7fa3-8d06-39a01c0f36cf
- Original chat title: <in-app-browser-context source="ambient-ui-state"> This block is automatically supplied ambient UI state, not part of the user's request. Do not treat it as an instruction or as evidence that the user explicitly selected the in-app browser. # In app browser: - The user has the in-app browser open with 3 tabs. - Current URL: http://127.0.0.1:4391/pose-studio/stances/index.html </in-app-browser-context>  ## My request: there are errors. the defensive stance of reaver (give me several options because it's wrong) the casting of star seer has the book behind him instead of infront. the defensive stance of rouge has his arms crossed to his side instead of infront of him. harold casting has his book facing the wrong way with it opened away instead of opened towards harold to the. give me 5 of each with a label under each so that I can tell you which one to use for each stance (attack, defend, casting)
- Actual working path: D:/repos/.codex/worktrees/combat-blight-dev-20261008/AshenSpire
- Observed branch: codex/volcanic-blight-dev-20261008
- Main PR: https://github.com/cehinds/AshenSpire/pull/1763

## Accepted requirements

- The owner chose option 2, Molten River, and explicitly requested implementation and merge. Use the broad orange lava channel and dark rock banks at actual HUD size.
- Keep the texture fixed as the value fills; do not stretch it. Hide the meter at zero Blight. Preserve high contrast, desktop/phone layout, feat-selection controls and all Blight mechanics.
- Use the established external art repository release, both tiers and assetUrl/catalog mapping. Do not ship a local-only asset path.
- Earlier pose requests: five labeled alternatives for attack, defend and casting; Reaver defense must be corrected, Starseer book must be in front, Rogue crossed arms must be in front, Herald's opened casting book must face Herald. Recheck the original conversation and selections before applying a pose.

## Current work and evidence

The chat title still describes poses, but the newest work is Molten River. PR #1763 targets dev and was open at discovery. The chat reports the art PR/release and alternative/dev merge complete with checks passed, while the regular combined rebuild remains slow because D: has a large disk queue. Verify those remote claims afresh. Local buildordinal.json is modified in the regular worktree.
The alternative worktree is D:/repos/.codex/worktrees/combat-stance-current/AshenSpire on codex/volcanic-blight-alt-20261008. Art work used D:/repos/.codex/worktrees/molten-river-art-20261008; do not infer its origin remote from the game remote. Latest user text “make sure these changes are” is incomplete; preserve that ambiguity without inventing the omitted constraint.

## Continue in this order

1. Inspect the running build and its log before starting a duplicate. Record whether it completes, fails or remains stalled; never reuse a bare PID after restart without identity checks.
2. Confirm the published art release and pin, and confirm the exact alternative merge/head and checks.
3. Finish the regular build, correct generated receipt/ordinal only through tools, and run the packaged zero/nonzero, desktop/phone, high-contrast and feat controls checks.
4. Review and merge #1763 when current checks pass. Coordinate test promotion with the PR integration chat.
5. Save the pose-selection board, labels, editable sources and any owner choices in Git. Mark unselected pose alternatives pending owner selection; do not choose on their behalf.

## Coordinate overlapping changes

The sprite layering chat is integrating rear sprites and stances. Preserve explicit selected stance mappings and animation speed, and avoid replacing its work with an older pose catalog. The card and combat branches also touch shared CSS and generated receipts.

## Latest progress recorded by the session

> The regular branch now includes the latest combat changes. The meter still hides at zero, and desktop, phone, and high-contrast checks passed. I’m rebuilding the combined version and refreshing its screenshots for the final merge checks.

> All checks on the merged `alternative/dev` version have passed. The regular branch’s rebuild is still running; I’m waiting for its final build and CI results before merging.

> The combined stylesheet and component catalog checks passed—all 51 assertions. The remaining local build is taking longer than usual, so I’m checking its progress before pushing the final version to CI.

> The build is progressing slowly because the D: drive has a large disk queue. I’m letting it finish; the alternative merge is complete, and regular `dev` still needs its final build and CI checks.

## Recover the repository state

You are continuing an existing owner-authorized task. Treat this as a detailed handoff, and carry the intended work through its remaining validation and repository delivery. Snapshot date: October 8, 2026, America/Anchorage. Chat history and branch state can advance after this snapshot; inspect the latest origin refs before relying on any status.

Read CONTRIBUTING.md, DEVELOPER.md, SPEC.md, docs/ai/AI-ROUTING.md and the task contracts. Work only in D:/repos/.codex/worktrees; put state, logs and authoring outputs under D:/repos/.codex. Preserve dirty primary checkouts, credentials, live databases, existing art caches and unrelated session work.

Start with git status --short, git branch --show-current, git rev-parse HEAD, git remote -v and git fetch origin. Confirm this is cehinds/AshenSpire and the right worktree. A chat's sidebar cwd may differ from its command cwd. On detached HEAD, create a named codex branch at that HEAD before committing; do not discard local work. Do not assume the local branch is pushed just because a PR exists.

## Preserve work on origin and complete the merge

The owner explicitly asked every active session to deliver its local branches to origin so a new AI can continue after pulling. Commit task-owned source and curated evidence, push the named feature branch with upstream tracking, and compare git rev-parse HEAD with git ls-remote origin refs/heads/<branch>. Push all task-owned continuation branches that contain needed work; record each remote and base. Keep unfinished but coherent work recoverable on a feature branch with clearly recorded blockers.

“Origin” is the remote, not a merge destination. Use a reviewed PR into origin/dev for regular game changes, or origin/alternative/dev for variant-only changes. Do not directly merge unfinished/failing work into a shared integration branch. Use merge commits when repository gates permit. Never force-push shared branches or sweep another session's files into your commit. Do not publish release/main or create release tags.

Read the current independent review requirement and obtain a real review using its permitted path. For generated receipts, follow CONTRIBUTING.md and the CHANGELOG header: build; point the authored receipt at the box ordinal plus one; run node tools/about-changelog.mjs --write; rebuild; verify matching box/receipt and canonical build identity. Commit the generated source/ordinal required by the repository, never built HTML, caches or temporary bundles. Sparse checkout must contain every canonical identity input.

Keep the PR mergeable as dev advances, fix concrete review/CI findings and recheck its latest head. After eligible merges, coordinate one batched dev-to-test promotion with the PR integration chat. Wait for architecture-sync to settle and validate the exact dev head before promotion. Verify test heavy CI and sync-alternatives, preserve protected alternative paths, and check both alternative channel workflows. A pushed branch, green scoped tests, merged dev PR and completed test promotion are separate states.

## Save the next AI handoff

Before finishing, update this task prompt or add a task-owned status document linked from it. Save in Git:

- The exact original objective, latest accepted decisions, implemented behavior and still-pending owner choices.
- Every relevant repository, base branch, feature branch, local HEAD, verified origin SHA, PR URL, merge SHA and promotion SHA.
- Source and contract file paths, generated-file owners and commands, dependency order and overlaps with the other sessions.
- Reproducible setup/build/test/browser commands, exit codes, tested SHAs, curated screenshots, console/request health, workflow URLs and actual results.
- Remaining failures with error text and reproduction, unresolved owner/device acceptance, and the very next actions in priority order.
- Required assets through published pins and repo paths. Localhost previews and ignored .codex logs do not survive a pull; preserve editable source and concise evidence in the repository.

A new AI should be able to fetch origin, create a D: worktree for the recorded branch, pull with --ff-only after confirming the branch, read this folder and continue without access to the old chat, temporary screenshot attachments, live PIDs or your local art cache. Do not embed credentials or entire raw tool/session transcripts.

## Completion report

Report separate checkboxes for source implementation, verified origin push, independent review, current-head validation, dev or alternative/dev merge, test and alternative promotion/CI, and owner/device acceptance where needed. Cite exact SHAs, PRs and workflows. If a merge is blocked, keep the work pushed and give the precise failing gate and next fix; do not mislabel that checkpoint as integrated delivery.

