# Final mobile target input fix — packaged QA

Captured 2026-10-21T06:50:53.008Z from the actual light single-file application `/workspace/AshenSpire/build/download/AshenSpire.html`. Functional source: `e0884843b718f3e97c3eeb4695c9bd93c7481bb0` (includes the final stage-observer repair and the narrow status/intent reading-surface exclusion). Embedded build: **0.7.1.1757**, digest **67b1dd1b32**, built 2026-10-21, edition light. Artifact size: 132,050,016 bytes. SHA-256: `9be49cf731b87e9e8fe5a087efccded1bd282e4b086ddbb67c7c6aad52681116`.

Native packaged QA exited **0** at mobile **375×667**, desktop **1280×800**, wide **1920×1080**, and tablet **768×1024**. Every view was visually inspected: all three target names and HP bars are readable, panels remain separate, and combat controls stay inside the viewport. The frames show an actually armed authored Strike and its live legal targets. This is Chromium touch emulation/keyboard/mouse QA, not a physical-phone test or performance measurement.

| Capture | Native input verified |
| --- | --- |
| `mobile.png` | Touch name→e2; after playback, HP→e1; hold and explicit Info inspect without play; repeated tap commits once; stationary HUD-name drag/drop. |
| `desktop.png` | Number hotkey selects Strike, mouse name→e2; after playback, next Strike hotkey and focused target Enter→e1. |
| `wide.png` | Same native keyboard/mouse sequence at wide size. |
| `tablet.png` | Same native keyboard/mouse sequence at tablet size. |

Each main flow records exactly two `cardPlayed` events, targeting e2 then e1, each paying 1 SP, with two actual engine `cardResolved` receipts. All visible target names have the correct native hit owner. Each panel measures at least 44 CSS pixels high and no two target panels overlap.

Hosted feature preview: [Play the verified feature build](https://cehinds.github.io/AshenSpire/branches/fix/MobileTargetInput/latest/). [Pages run 39557342673](https://github.com/cehinds/AshenSpire/actions/runs/39557342673) assembled exact source `e0884843b718f3e97c3eeb4695c9bd93c7481bb0`, then deployed it and passed public HTTP checks at 07:20:55 UTC. The delivery manifest names that exact source. Local gameplay checks and public delivery checks are separate. The separate release gallery remains unchanged at 0.7.1.1517 / digest `a5b5079cb1`, verified against the release branch and Pages assembly.

## Fixture and provenance

Actual local fixture URL used for the capture (ephemeral QA server is now closed):

```text
http://127.0.0.1:34959/AshenSpire.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3&shotHand=5&shotSettings=%7B%22oneTapPlay%22%3Afalse%2C%22holdConfirm%22%3A%22off%22%2C%22animSpeed%22%3A%22instant%22%2C%22combatSpeed%22%3A8%2C%22seenTutorial%22%3Atrue%7D
```


The built application's supported screenshot entry is `shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3&shotHand=5`. Settings choose two-step play, hold confirmation off, instant animations, combat speed 8, and tutorial already seen. This is a screenshot encounter, not a campaign playthrough. No combat state is mutated after boot. The page imports no source module, and no controller, handler, or renderer is replaced/remounted. All actions use actual native controls. The first phone action is followed by actual playback before the HP target is activated; the drag/drop case reloads the same supported fixture.

There are **zero page exceptions, zero unexpected HTTP failures, and zero source-module requests**. The complete report retains 75 Chromium pre-gesture AudioContext warnings, five exact optional-vibration policy notices, and 23 console resource errors corresponding to separately recorded optional default music/SFX 404 responses. The existing procedural-score/synthesized-SFX fallbacks remain active. The harness classifies only the exact Chromium vibration-policy error and network messages already checked by the HTTP response assertions; all other console application errors still fail. No application console exception was observed.

Raw local evidence remains outside the repository in `/tmp/mobile-target-final/`: the original `targeting-WIDTHxHEIGHT.png` captures and `report.json`; the archived gallery renames the images as listed above. Harness: `/workspace/scratch/mobile-target-packaged.mjs`; run log: `/workspace/scratch/mobile-target-final.log`. Browser, temporary profile, and local server were closed after completion.

```sh
TARGET_SOURCE=e0884843b718f3e97c3eeb4695c9bd93c7481bb0 \
TARGET_ONLY=375,1280,1920,768 TARGET_QA_OUT=/tmp/mobile-target-final \
CHROME=/usr/bin/chromium node /workspace/scratch/mobile-target-packaged.mjs \
  /workspace/AshenSpire/build/download/AshenSpire.html
```

The four images are intended for the feature preview gallery; the root coordinator owns the public preview link, evidence commit, and mandatory pre-merge feature-gallery cleanup. The capture checks are separate from the timing comparison below.


## Armed detail-reading regression

The checked-in `tests/target-hud-reading-while-armed.browser.mjs` also passed against this exact packaged artifact, exit 0, at **390×844** and **1024×768**. Its supported fixture uses one enemy with `shotEnemyContext=status` so the real Crimson Blight status and full detailed intent are visible. A native status tap opens the Crimson Blight tooltip; a detailed intent tap opens its authored tooltip. Both preserve the selected card, player stamina, hand instance IDs, and card/flask action counts. Escape closes each tooltip while preserving the armed card. A subsequent name tap commits once; after real playback, a newly armed Strike's HP tap commits once. No page exception occurs.

The complete original test output is copied to `/tmp/mobile-target-final/reading-regression.log` (also `/workspace/scratch/mobile-target-final-reading.log`). A Node module-type warning in that log concerns the local test/server module loader; it is not a browser runtime error. This regression and the four-view capture runner were sequential; all owned browsers and servers closed successfully.

```sh
TARGET_GAME_FILE=/workspace/AshenSpire/build/download/AshenSpire.html \
PLAYWRIGHT_MODULE=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
CHROME=/usr/bin/chromium node tests/target-hud-reading-while-armed.browser.mjs
```

## Separate selection timing comparison

Combined source `9d4c4b88c9b803d3d0bb5005b352b5dad1a11791` (0.7.1.1757 / `4fe58790d6`) was measured against original dev source `049e4598a344386c93a3f7ac932e06699a284d31` (0.7.1.1756 / `5bae343a57`) with native touch at 375×667, DPR 3 and Chromium CPU slowdown 4×. Two samples per variant ran in baseline/candidate/candidate/baseline order. Median time to selected state was 1008 → 736 ms (27% reduction); time through two animation frames was 1850 → 1755 ms (5% reduction). Both selection pairs improved; one two-frame pair was slightly slower. No accidental plays or page exceptions occurred. The final source adds the separately tested status/intent click restriction and regression updates; selection layout code is unchanged. This small simulated sample does not establish physical Galaxy A32/iPhone SE performance or improved full attack latency. Raw local evidence: `/workspace/scratch/mobile-performance/final1756-combined-selection.json`.

A separate default-paced native two-step action comparison also exercised this final artifact without the screenshot runner’s Instant/speed-8 settings. Both baseline runs paid/resolved one card and finished with the hand enabled and End Turn enabled. A proposed additional optimization produced mixed timing and was discarded; it is not part of this change. Full attack rendering still has long main-thread stalls. Evidence: `/workspace/scratch/mobile-performance/action-guards-paired-actions.json`.

README channel links and badges were checked against the successful assembled site: Dev/Test 0.7.1.1756 (`5bae343a57`), Release 0.7.1.1517 (`a5b5079cb1`), Main 0.7.1.810 (`2d43fe2e34`). Each listed channel contains its latest page, build badge and HTML download; the release gallery still identifies the published release and was not changed.
