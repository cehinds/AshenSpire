# Continue combat mechanics and formula delivery

Finish the remaining combat expansion delivery, correct all card formula displays and complete compiled-browser and dev/test validation in both editions.

Read [the task-owned verified status](combat-mechanics-and-formulas-status.md) first. The earlier snapshot below is historical; the linked status supersedes it for source, build, validation and origin checkpoints.

## Session and branch

- Chat ID: 01a117e5-7a97-7170-bed5-62561c5ee7b8
- Original chat title: Expand combat card mechanics
- Actual working path: D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire
- Observed branch: codex/combat-promotion-polish-20261008
- Main PR: No current task PR discovered; inspect origin before creating one.

## Accepted requirements

- Keep physical/spell card families, damage tags, stances, counters, status effects and canonical mechanics consistent with SPEC and the combat expansion contracts.
- Power plays once, exhausts and lasts for the combat; Skill is reusable utility/buff; Status enters the deck and is usually a debuff.
- Action labels remain at the bottom for Attack, Defend, Smash, Counter, Sweep, Ranged, Spell, Power, Skill and Status. Keep damage wording readable and expose full tags through inspection.
- Fixed values show real numbers outside combat; state-dependent effects show an accurate explanation of their formula. Live combat preview values take precedence over static substitutions.
- Reject overflowing constants and invalid symbolic entity references; do not guess current combat state or silently change effect arithmetic.

## Earlier snapshot and evidence

The latest local head observed was 2934beab9d2e517f9d9ff031299bc3cc9c40a62c on codex/combat-promotion-polish-20261008. The chat reports 35 focused checks and six static-formula regression tests passed, with independent formula review complete. The broader engine suite failed the full-run simulator time limit; that remains unresolved.
The all-card scan had found 86 variants with unresolved formula placeholders outside combat. A prior review caught static values overriding live values and that precedence was corrected. A compiled prelude build is in progress. Earlier mechanics PRs have landed over multiple turns; do not reopen completed changes merely because they appear in the old context.
Alternative continuation includes open #1740 on codex/combat-expansion-alternative-20261007. Verify exact head and remaining delta before further integration.

## Continue in this order

1. Read docs/combat-expansion-contract.md, docs/combat-cards-design.md, docs/combat-cards-expansion-proposal.md and the current source/spec; inventory implemented, local-only and still-missing mechanics.
2. Inspect tests/static-card-formulas.test.mjs and the actual display/model implementation; verify live override, static constants, symbolic formulas, invalid refs and high-rank effects.
3. Root-cause the runsim timeout using the recorded logs under D:/repos/.codex/outputs/combat-card-stances. Preserve the test policy, required assertions and watchdogs; investigate workload/determinism before proposing timeout changes.
4. Finish the compiled regular and alternative builds. Run mobile target reach, counters, upcast, corruption and actual interactions with error/request checks enabled.
5. Reconcile overlapping player tap-area and hand-anchor fixes with the sprite and PR integration chats. Preserve all existing card readability and reaction semantics.
6. Push a recoverable feature branch even if the simulator blocker remains. Open/update the appropriate ready PR with precise unverified checks; merge only when required gates pass.

## Coordinate overlapping changes

PR #1749 owns simulator self-test work; compare its changes before duplicating policy fixes. #1766 owns final card layout/rank. #1767 owns reaction timing. #1757 and the rear-sprite task own overlapping target/anchor fixes. Leave protected alternative presentation intact.

## Latest progress recorded by the session

> The alternative build’s test drivers are ready as well. They retain the full mobile, counter, upcast, and corrupted-card checks, including checks that fail on unexpected browser errors. I’m waiting for the formula-display review before rebuilding either edition.

> The review caught a preview bug before the build: a newly resolved fixed value could override the value calculated for a live combat preview. I’m fixing that precedence and adding a regression check so the card shows what will actually happen.

> The formula fix passed independent review and all six new regression tests. Every authored card variant now resolves its supported placeholders, and live preview values take priority. I’m moving to the compiled build and browser checks next.

> The broader suite failed on the full-run simulator’s time limit. The focused mechanics and card checks passed, but this remains a delivery blocker. I’m investigating the simulator failure while keeping its existing timeout and assertions intact.

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


## Task-owned live checkpoint

Read [the verified task status](combat-mechanics-and-formulas-status.md) before acting; it supersedes the earlier snapshot for source, evidence, blockers and next actions.
