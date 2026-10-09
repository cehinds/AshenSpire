# Continue rear sprites and stable combat layers

**Updated checkpoint:** See [the task status and reproducible QA](../../../qa/rear-sprites-layering-20261008/README.md). It supersedes the discovery-time status below. The source is now on `codex/rear-sprites-layering-20261008`; the package build completed at `0.7.1.1151`, source digest `e4095c5de9`. The original marked screenshot is preserved alongside that status.

Finish and deliver the combat layer order, rear player sprites, enemy spacing, lower footer fade and stable sprite size/anchor during card play.

## Session and branch

- Chat ID: 01a11e4f-637a-78d0-8106-f9963acc640c
- Original chat title: Fix sprite shifts and layer order
- Actual working path: D:/repos/.codex/worktrees/9628/AshenSpire
- Observed branch: DETACHED at discovery; create codex branch before delivery
- Main PR: No current task PR discovered; inspect origin before creating one.

## Accepted requirements

- Original stack from top down: HUD/footer controls, cards, selection/inspection/intent/target buttons, UI fade, player sprite, enemy sprite, shadows, floor and nearby scenery, foreground structures, sky.
- The latest screenshot correction supersedes the footer fade placement: move that background fade behind and below the player; keep selection and cards above it. Preserve other HUD fades unless requested. State this distinction explicitly in QA.
- Move enemies farther back toward the owner-marked right position. Use the player's back-view stance and attack frames and the corrected foreground placement; compare the supplied screenshot rather than guessing coordinates.
- Sprite size and resting position stay fixed when cards leave the hand or inspection/intent controls resize. Only melee translates characters; always return exactly to their original anchor. Do not scale the body for other animation families.
- Decorative shadows have separate IDs so targeting, focus restoration and co-op lookups still resolve actual combatants.

## Current work and evidence

The worktree was detached at 74fbff9a26e4fd6d7f3c6e5d12a928fe133fd138 and contains substantial uncommitted implementation and new modules. No current task PR was discovered. Do not lose this work by switching to dev or copying another checkout wholesale.
Latest evidence reported desktop/phone/landscape/co-op checks, 32 actions and 12 held stances across four classes, exact desktop anchor return and phone drift below 0.12 px. The package build is still writing assets. Earlier evidence had audio 404s; a recent co-op result had none, while one other case still recorded holdTick. Resolve and record the final package health rather than claiming all requests passed.

## Continue in this order

1. Create a named codex branch on the existing detached HEAD, preserving the entire dirty worktree. Inspect all changed/untracked files; commit source and curated evidence, exclude local caches and packaged artifacts.
2. Inspect src/model/combatAnimation.js, src/ui/{fx,assets,alternativeCardStage,animationPace}.js, the combat/coop screens, battlefieldStage, illustratedBackground, CombatCompositionModel, combatGroundShadows and styles/combat-layers.css.
3. Finish the ongoing package build and rerun tools/combat-layer-qa.mjs and tools/rear-player-qa.mjs on the final package, plus relevant composition, animation, asset and rear-art tests.
4. Check desktop, phone, short landscape and co-op; real card plays, all classes/action families/held stances, ground anchors, fade placement, click/target access, missing art, console and requests.
5. Verify any alternative art dependency through its published pin. Record pending branch-choice scope explicitly; regular delivery does not authorize overwriting protected alternative artwork.
6. Review, push, open a ready PR into dev, attach it, and merge under current repository gates.

## Coordinate overlapping changes

This branch overlaps PR #1757 on alternative-default appearance, sprite anchors and screenreach fixtures, #1767 on reaction/Counter animation ordering, and #1766 on cards. Prefer one canonical anchor/movement fix after comparing diffs; preserve the newer requirements from each.

## Latest progress recorded by the session

> Desktop, phone, landscape and co-op layout checks pass. I’m finishing the all-class animation check and package check; the missing shared art dependency has now been fetched and verified.

> All four classes passed checks for 32 actions and 12 held stances. Only melee actions translate the sprite, and each returns to its starting anchor. The package build is the last check still running.

> The gameplay and animation checks are complete. I also switched the foreground player to the full-size sprite frames so it stays sharp on phones. The full package build is taking longer while reading the art cache; the shared-pack integrity tests have passed.

> The latest responsive pass has no missing sprite assets or page errors. Desktop card play showed zero position or size drift; phone measurements varied by less than 0.12 pixels. The package build is now writing the verified assets.

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
