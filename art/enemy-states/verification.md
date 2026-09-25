# Verification

- `node art/enemy-states/check.mjs`: all 33 enemies have seven distinct transparent sprites; dimensions, safe edges, registration scale, resting-state priority, buildup exclusion, stacked aura colors and empty aura behavior pass.
- `node art/enemy-states/browser-check.cjs`: all 231 pose swaps render through the game stage. Checks cover active buff combinations, expiration, cancellation, reduced motion, missing frames, fully guarded damage, partial guard and unguarded hurt reactions.
- `node art/enemy-states/game-check.cjs`: real enemy spell attacks select the projectile pose in served and standalone builds at 1440px and 390px. The combat renderer selects wounded and guard poses and adds/removes buff auras from displayed state.
- Visual review: all 33 source sheets and six roster contact sheets were inspected. The gallery and buff controls were checked on desktop and phone. Local screenshots and execution logs are under ignored `frames/`.

The Node suite, build, shipping checks and final Git revision are reported in the pull request. The browser scripts use Playwright with Microsoft Edge; set `NODE_PATH` to the installed Playwright package directory and optionally `ENEMY_PREVIEW_ORIGIN` to the local server origin.
