# Combat sprite reactions — continuation

Updated: October 10, 2026 (America/Anchorage).

## Start here

Continue on **`Fix/CombatspriteReactions`** in `cehinds/AshenSpire`.
The user requested this exact spelling after initially requesting
`Fix/CombatSprite-reactions`. The remote branch has been renamed; use the new
name. Do not open another chat or send messages to other chats without the
user's authorization.

The next task is to investigate the user's report: **“I'm not seeing all the
frames play out.”** No playback repair has been made for this report yet.
The user does not know whether frames are actually omitted or simply too fast
to distinguish. The affected surface is also unconfirmed: live Dev gameplay,
local selected-animation preview, or both. Do not treat “skipping” as a confirmed
diagnosis, and do not call the problem fixed from source inspection alone.

The latest instruction was to merge the existing work into this branch and
leave a Markdown handoff. That branch preparation is complete. Keep subsequent
investigation and fixes on this branch; the user has not requested another
merge of new fixes into `dev` in this follow-up.

## Exact branch state

- Before this documentation commit, branch HEAD was
  `21078bb61cbfcd86221e816f4220a0c751b0b3c7`, the Dev tip observed when the branch
  was created. It identifies build **0.7.1.1280**, digest `0b1580cd22`.
- The selected animation work ends at
  `411bf81b94079ee01a80f4780fbd8550a71ab423` (local original branch
  `codex/selected-counter-sweep`). It is already an ancestor of this branch:
  GitHub compare returned `behind_by: 0`, `ahead_by: 203` before this document.
- A GitHub merge request using that exact source SHA returned **204 No Content**,
  confirming it is already included. No duplicate merge commit was necessary.
- The old source branch name was unavailable remotely, so use its SHA for
  ancestry checks rather than assuming that branch still exists.
- Remote branch spelling is exactly `Fix/CombatspriteReactions`. Windows local
  refs may enumerate the prefix as `fix/` because an existing directory differs
  only by case. Use an explicit destination ref when pushing.
- Current art pin remains **`hd-assets-v19`**.

## What the user selected

Keep the original idle, attack, defend and casting artwork. The user requested
additional counter and sweep stances and their attack-to-idle animations for
the four default characters, initially five labeled choices per action.
“Hit” means taking damage, not dealing damage; taking-damage work is separate
and was not implemented by the selected counter/sweep change.

Selections from `D:/Downloads/counter-sweep-favorites.json`:

| Character | Default weapon | Counter | Sweep |
| --- | --- | --- | --- |
| Reaver | Greatsword | `reaver-counter-03` | `reaver-sweep-01` |
| Starseer | Staff | `starseer-counter-01` | `starseer-sweep-01` |
| Herald | Unarmed | `herald-counter-01` | `herald-sweep-03` |
| Rogue | Twin daggers | `rogue-counter-03` | `rogue-sweep-05` |

The approved clips have four phases: stance, contact, recovery, original ready.
Their authored durations are `[55, 60, 65, 80]` ms, totaling 260 ms before speed
scaling. There are separate steel slash, arcane staff, golden palm and dagger
effects. Body and effect images must remain separate so effects do not alter
body bounds or HUD placement. Preserve sweep forward travel.

## Delivered implementation and navigation

Read current files on the target branch; Dev has advanced substantially since
the original animation PR. Do not overwrite later changes with old copies.

- `src/content/playerCounterSweepSprites.js`: selected frames, effects, sequences
  and stance bindings. Final phase references the original ready frame.
- `src/ui/alternativeCardStage.js`: body/effect painting, RAF playback clock,
  `actionTiming`, `play`, `hold`, `settle`, `setRestPose` and saved presentation.
  Counter preparation is a held single frame; the triggered counter is the
  full retaliatory clip. Sweeps retain forward movement.
- `src/model/alternativeCardAnimation.js`: `durationFor` and `sampleSequence`.
  Sampling is based on elapsed wall time. A delayed frame can therefore sample
  a later phase. That is a possible explanation, not a reproduced defect.
- `src/model/combatAnimation.js`: shared `counterPrepare` routing for a played
  counter card; `counterTriggered` selects the full counter and clears rest.
- `src/ui/screens/combat.js`: solo action timing, hit-stop, cancellation and
  stage settling. Inspect the full beat lifecycle, not only the stage timer.
- `src/ui/screens/coop.js`: both paced reactions and queued snapshot animations.
  Both must distinguish preparation from triggered retaliation.
- `src/ui/components/deckCardAnimationPreview.js`: previews show the full counter
  rather than the held preparation action.
- `src/model/alternativeStance.js`: selected held counter/sweep stances; retain
  original stance behavior and enemy-intent restrictions.
- `src/ui/fx.js` and presentation configuration: speed/reduced-motion settings.
  Determine the user's actual settings before changing timing defaults.
- `docs/preview/counter-sweep-20261009/`: runtime component browser harness,
  screenshots and validation record. This is component evidence, not a complete
  gameplay or physical-device test.
- `docs/component-catalog.md` and `docs/component-catalog.html`: UI catalog.

Existing tests include cold-aura preparation and saved-action clock behavior.
In particular, a stale saved action may expire during restoration; do not
remove that contract casually while trying to expose every frame.

## Merge and validation history

- Art PR #21: https://github.com/cehinds/AshenSpire-art/pull/21 — merged at
  `15777590a45d5a5696f944d28b84afcb304a6992`; published `hd-assets-v19`.
  Editable sources, selections and export provenance live in the art repository.
- Game PR #1800: https://github.com/cehinds/AshenSpire/pull/1800 — merged into Dev
  at `893caee72b05f4265b74d14bc4395ae00fde6a76`, original receipt 0.7.1.1244.
  Required PR checks passed on `411bf81b94079ee01a80f4780fbd8550a71ab423`.
  Automated review findings for the art pin, lost sweep travel and queued co-op
  preparation were fixed and resolved; final review had no new findings.
- All 52 tests importing `resolveCombatAnimation` passed locally on that source
  commit. The eight clips passed high/light browser component checks for effects,
  preparation, sweep travel, original idle, defeat priority and reduced settings.
- Promotion PR #1801: https://github.com/cehinds/AshenSpire/pull/1801 — merged into
  Test at `082f559adbb39c0f7511930b714253c28189a95d` after successful Dev architecture
  sync. A later status check found **CI and dev preview failed** on that historical
  Test commit. Tests, tutorial reach, map camera, quick start, co-op HUD, installer,
  Pages and alternative sync succeeded. Do not report all heavy CI as green.
  Runs: CI `38040475155`, preview `38040475137`, tests `38040475136`.
  A pre-existing retry-gate problem was tracked by PR #1799, but these two run
  failures were not root-caused in this follow-up. Recheck logs and current status
  before attributing them or assuming later Dev still has the same failure.
- No runtime files were changed by the branch rename or this handoff. Historical
  validation is not new evidence for every later change in build 0.7.1.1280.

## Local resources and safe setup

- Primary repository: `D:/repos/AshenSpire`. It contains unrelated work; preserve it.
- Prior isolated game checkout:
  `D:/repos/.codex/worktrees/selected-counter-sweep/AshenSpire`.
  Its checked-out branch remained `codex/selected-counter-sweep` at `411bf81b940`
  during this handoff, not the new target branch. It has a history of partial
  hydration/skip-worktree bits. Verify files against Git; do not assume an empty
  status means every file represents the desired branch.
- Prior art checkout: `D:/repos/.codex/worktrees/selected-counter-sweep-art`.
- Authoring outputs and logs:
  `D:/repos/.codex/outputs/sprite-expansion-2026-10-09/`.
  Original stances are under `player-stances`; QA logs are under `integration`.
- The prior preview was `http://127.0.0.1:8797/options/selected/?revision=effects-applied`.
  This was an authoring preview; its current process availability is unverified.
- New worktrees, state, logs and outputs belong under `D:/repos/.codex`, never C:.
  Use a fresh isolated worktree or verify a suitable existing one. Preserve dirty
  checkouts and other sessions. Do not bulk reset or delete their files.

Suggested startup (adapt the worktree path if it already exists):

```powershell
git fetch origin refs/heads/Fix/CombatspriteReactions
git worktree add --detach D:/repos/.codex/worktrees/combat-sprite-reactions/AshenSpire FETCH_HEAD
git -C D:/repos/.codex/worktrees/combat-sprite-reactions/AshenSpire switch -c codex/combat-sprite-reactions-work
```

The local working branch name can differ from the destination. For this user
request, push reviewed work explicitly to `HEAD:refs/heads/Fix/CombatspriteReactions`.
Before pushing, fetch and incorporate any changes that landed there; never force
push. Read applicable `AGENTS.md`, `CONTRIBUTING.md` and specs before editing.

## Next actions

1. Verify the new branch, build identity and actual page being tested. If the user
   cannot distinguish missing frames from fast playback, instrument playback and
   provide a slowed, labeled reproduction rather than requiring that diagnosis.
2. Reproduce one counter and one sweep in actual gameplay, then all four classes.
   Record frame/pose transitions and real paint timestamps through preparation,
   contact, recovery and idle. Compare the standalone component preview with the
   solo/co-op beat lifecycle and current animation settings.
3. Check whether long rendering work, saved-state restoration, cancellation,
   stage recreation or beat settling consumes the recovery frames. Distinguish
   a timing fault from deliberately instant/reduced-motion settings. Preserve
   combat impact synchronization and hit-stop when designing a repair.
4. Add a focused regression for the reproduced mechanism and verify actual
   browser playback. Do not simply lengthen every action or clamp elapsed time
   without considering gameplay timing and existing restoration tests.
5. Run relevant animation/stage/counter/preview tests, update component docs if
   behavior changes, and record what was visually verified. Follow the repository's
   generated receipt/build process for production changes; never hand-edit derived
   metadata or commit built HTML. A documentation-only handoff needs no new build.
6. Commit and push the repair to the requested branch. Report what changed and
   what remains unverified; do not claim live deployment or physical-device
   acceptance from component tests alone.

Useful existing focused test command:

```powershell
node --test tests/alternative-card-stage.test.mjs tests/alternative-card-animation.test.mjs tests/combat-counter-animation.test.mjs tests/player-counter-sweep.test.mjs tests/player-attack-sprites.test.mjs tests/rear-combat-art.test.mjs
```

The prior browser harness is `docs/preview/counter-sweep-20261009/verify.cjs`.
Inspect its dependencies and arguments before running; it takes the game path,
art path, output directory and `hd` or `light`. Its passing seek/timing assertions
alone do not establish that all frames are visibly painted during live combat.
