# Continue card layers and rank placement

Finish the approved B + B card design, implement the eight-layer structure and ninth rank layer, show illustrations, merge the implementation, and preserve complete readable effects and inspection details.

## Session and branch

- Chat ID: 01a119c6-1767-7901-a04f-a4ffd8fbc26e
- Original chat title: Make sure smash attack counter ranged spell defend are shown at the bottom. Also make sure card effect text can be seen with being truncated. Rework the text so that the main effect is clear and said plainly but word efficient. Take advantage of tags and let them handle the rest o the details. Keep only the main 3 tags but show the rest on inspection. Main tags are the card type the damage type/element status effects if present and main skill. Reframe
- Actual working path: D:/repos/.codex/worktrees/card-solid-bb/AshenSpire
- Observed branch: feature/card-solid-bb
- Main PR: https://github.com/cehinds/AshenSpire/pull/1766

## Accepted requirements

- Bottom action labels include Smash, Attack, Counter, Ranged, Spell and Defend. Preserve the approved warm-gold symbols, thick symbol shadows, dark outlined names, full-width title fade and inline centered footer integrated into the original textured base.
- Keep up to three primary symbols on the face; expose the full tag vocabulary in inspection. Preserve action, damage or element, relevant status and skill identities without changing mechanics.
- Apply the approved stack from bottom to top: 1 card background; 2 art; 3 heading and footer background; 4 footer trim; 5 banner and effect background; 6 effect box and card trim; 7 icons; 8 text. Layer 9 is the rank text.
- Write the rank as “Rank X”, centered immediately above the effect text. Hide it at rank 0 and show it at every rank >= 1. Follow the expanding effect panel without collisions with the title, symbol rail, borders or footer.
- Preserve cost previews, actual live formula values, keyboard focus return, tap inspection and affordable state styling.

## Current work and evidence

PR #1766 was open at discovery. The local branch has uncommitted changes in playingCard, card renderers, symbol modules, fitter, CSS, tests and the QA tool. Earlier desktop/phone scans covered 2,186 variants, but that evidence predates the newest rank change. The branch previously corrected a sparse-checkout build identity mismatch; preserve the complete canonical build inputs.
The latest turn requested implementation and merge, plus examples of rank placement. Wireframes under docs/qa/card-layers were preview-only before this turn. A prior independent-review authorization question appears in the history; current CONTRIBUTING.md explicitly requests independent review. Read the current instructions and use an allowed independent review path rather than treating an old question as an automatic permanent block.

## Continue in this order

1. Inspect src/content/card-layout.json and the shared component compiler, src/model/playingCard.js, src/ui/components/{card,illustratedCard,illustratedCardFitter,cardTagSymbols,combatSigilView}.js, styles/illustrated-cards.css and tools/card-sigils-qa.mjs.
2. Finish the layer and rank implementation; verify both ranked abilities and other ranked cards follow the same visible rule.
3. Run relevant identity/sigil tests and the all-variant desktop/phone scan against the final branch. Add rank >= 1, rank 0, dense effect and resize coverage where the existing harness supports it.
4. Keep editable wireframes and several actual rank examples under docs/qa/card-rank-layers; capture real game rendering and interaction.
5. Reconcile #1766 with current dev, independently review the latest diff, regenerate receipts if required, push and merge when current gates pass.

## Coordinate overlapping changes

Coordinate with combat mechanics on formula-display precedence and with sprite layering on card/selection stacking. Do not overwrite either with older renderer copies. The PR integration chat owns batched promotion, not your card design decisions.

## Latest progress recorded by the session

> I’ll implement the layer structure and add “Rank X” centered just above the effect text, visible only at Rank 1 or higher. I’ll show several rank examples, then take the changes through validation and merge.

> May I start an independent review agent for this merge? CONTRIBUTING.md requires an independent review, and this session requires your explicit authorization to start that agent.
> - Yes, use a review agent
> - Waive the independent review

> I’m adding the rank label as **layer 9**, above the existing eight layers. It will follow the effect panel when longer text expands upward, so it stays centered above the panel without colliding with the right-side icons.

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

