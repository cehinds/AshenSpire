# Mobile Action Layout — bounded packaged candidate QA

This record covers the exact candidate below, captured 2026-10-21. It is not a publication/final combined-PR gallery: a separate smoothness PR was under review when this run finished. Local Chromium/Playwright provided native touch, mouse and keyboard input; this is not a physical-phone or Safari claim. Functional observations below are not performance measurements.

## Artifact and protocol

| Field | Value |
| --- | --- |
| Full source commit | `b550bf93a153b7f87386a6ecb973e3dfa7de848f` |
| Full version | `0.7.1.1765` |
| Embedded digest | `d64c4b8cf9` |
| Frozen pack HTML | `/workspace/scratch/mobile-performance/pack-1765-tap-tools/AshenSpire.html` |
| HTML SHA-256 | `88850ce0ef2371437d463fec9373bd6cb01dce34bc7a1b9cb26edea734c28d01` |
| HTML bytes | `14910837` |
| Asset root | `/workspace/scratch/mobile-performance/pack-1765-tap-tools/` |

The HTML hash was verified against the coordinator's supplied hash before execution. The same frozen directory served its own `asset-base.json`, `cards/`, `objects/`, and `packs/`. No standalone artifact fallback was used. Browser code imported no game source, never remounted the screen, and never replaced handlers/controllers. The QA runner only imports the local browser launcher in Node.

The main native five-view fixture URL was:

`http://127.0.0.1:35867/AshenSpire.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3&shotHand=5&shotSettings=%7B%22oneTapPlay%22%3Afalse%2C%22holdConfirm%22%3A%22off%22%2C%22animSpeed%22%3A%22instant%22%2C%22combatSpeed%22%3A8%2C%22seenTutorial%22%3Atrue%7D`

This is the supported Core combat screenshot entry: seed 3, three enemies and five authored hand cards. It poses the starting view, not a completed campaign. Main gameplay, cancellation, reorder and inspection checks did not mutate combat data. The negative-offset spot-check changed only the established `--hud-tools-dy` presentation token to -10px and -10000px, dispatched the normal resize listener and waited for two animation frames; it then removed the override and verified restoration. The supplemental native tools/drag/inspection fixtures use Normal animation at combat speed 1. All actual payments and damage came through the bundled native game handlers.

## Results

All five viewport runs passed: 375 × 667, 412 × 915, 1280 × 800, 1920 × 1080 and 768 × 1024. Each committed exactly two real Strikes, first to `e2` by its visible name and then to `e1` through HP touch or focused Enter after playback/hand rearrangement. Each card spent 1 SP and dealt actual HP damage (9 and 11 respectively); both actions resolved. Compact target hit owners remained distinct and their CSS boxes did not overlap. Desktop/wide/tablet used native card hotkeys, target mouse and native Enter; each recorded a target click with `detail: 0`.

At 375 × 667, native Escape cancelled the first selected Strike, a fresh touch selected a different instance without playing, and the armed 375 → 412 → 375 resize preserved the target owner. Final tools corner insets and on-screen bounds passed at every viewport:

| Viewport | Effective zoom | Final inset, local px | Tools top, screen px | Desktop split |
| --- | --- | --- | --- | --- |
| 375 × 667 | 0.930023 | 16.000000 | 564.6875 | false |
| 412 × 915 | 0.949309 | 16.000000 | 805.3125 | false |
| 1280 × 800 | 1.070234 | 16.622222 | 666.9531 | true |
| 1920 × 1080 | 1.480339 | 14.591250 | 918.4219 | true |
| 768 × 1024 | 0.640000 | 16.000000 | 831.9062 | false |

Actual Log behavior passed: tap opened the compact body modal while the legacy `#combat-log` remained hidden; upward native touch drag reached Large; cancelling a downward gesture restored its prior closed/Large state; completed downward drag reached Small. Native ArrowUp, End and Home opened Medium, Large and Small respectively. No action was played by these read-only controls. The existing body modal is independent of the size state; the run verifies preserved state/interaction semantics, not a new modal-height behavior.

The -10px and -10000px offset spot-checks raised or retained the dock on-screen and did not newly overlap an existing card/control. Removing the override restored the original top within 1px. Native resize to desktop switched to the authored desktop footer at non-unit zoom, with tools inside the combat bounds.

A real touch drag cancellation left the exact DOM card order, SP, Block, action count and all exposed RNG counters unchanged. A completed touch drop over the hand moved the dragged Strike from the first slot to the last while leaving gameplay state unchanged. A subsequent native selection of Defend `gp7` and native player-glyph tap paid that exact card once for 1 SP and gained 14 Block; no trailing click paid another card.

Held target inspection consumed its original release without an action. After native Escape, fresh name and HP touches started 510.9ms and 386.5ms after inspection opened (both inside the old 700ms window). Both were accepted exactly once for the intended `e2`, with no unwanted inspection reopening.

Counter was unchanged by these two narrow UI changes, and no target/payment concern arose; its existing accepted functional evidence was not repeated or claimed as a new result. Unaffected settings/save/full-motion suites were also not repeated.

## Screenshots and inherited visual limit

All four required fresh screenshots and the additional 412px phone capture were inspected. Desktop, wide, tablet and tall-phone artwork is loaded and visible, with reachable controls. The 375 × 667 view retains the inherited short-screen limitation: odds/intent and target overlays substantially obscure very small fitted enemy bodies. This is not labelled a new visual-quality pass. The earlier exact accepted-1762/candidate comparison proved the same loaded-image geometry on both builds; see `/workspace/scratch/combat-responsiveness-qa-capture-record.md` and its retained `art-accepted`/`art-candidate` diagnostic folders. This run made no graphics/fixture change to conceal that limitation.

| Viewport | Candidate screenshot | SHA-256 |
| --- | --- | --- |
| 375 × 667 | `mobile.png` | `dd40833e57c52b37fe74c17253e759d88b7fba3a7b1f30a6ce8633382c69aa94` |
| 1280 × 800 | `desktop.png` | `a9496d179502c7129ee027e3687ce72b2162e05669c08b0e78fbab45402dec69` |
| 1920 × 1080 | `wide.png` | `107db5850c97d07310f4a37dd1dea98a6b73590261b68c42db915639d2196749` |
| 768 × 1024 | `tablet.png` | `a151ca6ec5db39de852b8e779c01f4b405711456e13f9b7f2849ef70ca9809d0` |
| 412 × 915 | `/tmp/mobile-action-layout-qa/five-views/targeting-412x915.png` | `7660778561817fb6fd6191d6f58a9a8f28ede804c3b842cd33433765699a8ee7` |

## Runtime, network and cleanup

All four runners exited 0 with no runtime page errors or unexpected HTTP failures. The pack target report recorded no game-source requests. Console logs are retained rather than claimed empty: Chromium emitted pre-gesture Web Audio warnings and the exact optional vibration policy diagnostic. Optional 404 classification remains restricted to `/music/manifest.json` (documented procedural score fallback) and `/assets/sfx/<id>.ogg` (documented synthesis fallback); no blanket network-error suppression was introduced.

Raw JSON: `/tmp/mobile-action-layout-qa/{five-views,tools,drag-self,rapid-inspection}/report.json`.

Scratch runners: `/workspace/scratch/mobile-action-layout-qa-targets.mjs` and `/workspace/scratch/mobile-action-layout-qa-input.mjs`.

Logs: `/workspace/scratch/mobile-action-layout-qa-targets.log`, `mobile-action-layout-qa-tools.log`, `mobile-action-layout-qa-drag-self.log`, and `mobile-action-layout-qa-rapid.log`.

Each runner closed its browser, CDP launcher and loopback server in `finally`. All owned processes were checked closed before releasing the lease. No tracked source edits, build, branch publication or screenshot archive were made during QA. Public delivery has not been verified by this local record.

## Publication evidence and temporary fallback

The intended playable URL is https://cehinds.github.io/AshenSpire/branches/fix/MobileActionLayout/latest/ . It is **not verified live** in this record. Publisher [39645988237](https://github.com/cehinds/AshenSpire/actions/runs/39645988237) collected exact PR head `0deba3561f390905f484bb58c3cddf4fa7f5e547`, assembled its branch preview and passed 91 site checks, but deploy job 119394427158 timed out at 18:16:25 UTC before public HTTP verification. Only that failed deployment job was retried. Direct Pages navigation is blocked by this execution environment.

The successful exact-head [feature build download](https://github.com/cehinds/AshenSpire/actions/runs/39646219049/artifacts/12368361121) is the temporary preview fallback. Its workflow head is `0deba3561f390905f484bb58c3cddf4fa7f5e547`; artifact ZIP SHA-256 `1821ae06d32c0f0937a885065accd06acecb1d3c0971bdf18b5ff6d45bdf58a2`, expires 2026-11-04. Local screenshots execute b550bf93a with identical UI source; the later commit changes only the receipt/generated changelog. Neither the CI archive nor the local captures are represented as a successful public deployment.

The README's existing Release gallery remains unchanged: its recorded source d310c277fffaaec6ec7a58a87de846577f12312d still matches the remote Release branch, with box 0.7.1.1517/a5b5079cb1. Public badge/link verification is blocked along with direct Pages access.

`PERFORMANCE.md` covers this PR alone. `stalls-combined-odds-pack-findings.md` and `COMBINED-QA.md` separately identify the final private union with PR #2241. No combined-run result is attributed to this PR alone.
