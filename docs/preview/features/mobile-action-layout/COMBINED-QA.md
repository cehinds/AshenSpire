# Final odds-only union — narrow packaged functional QA

Captured 2026-10-21. The coordinator authorized only affected mobile actions, inspection and route/upcast preview checks after the aura-filter optimization was rolled back. This record does not claim new broad captures or performance improvement. It is local Chromium/Playwright QA, not a physical phone or Safari test.

## Exact final artifact

| Field | Value |
| --- | --- |
| Full source commit | `f52ae5a63f694dd47fbe5efe0cd70c3f78a65bca` |
| Full build version | `0.7.1.1765` |
| Embedded digest | `cd9938a7ec` |
| Frozen pack HTML | `/workspace/scratch/mobile-performance/pack-1765-combined-odds-probe/AshenSpire.html` |
| HTML SHA-256 | `e980b12b70e8801ffceac266993cf56b820591174753d37d74536b80d5d8e548` |
| HTML bytes | `14911837` |
| Asset root | `/workspace/scratch/mobile-performance/pack-1765-combined-odds-probe/` |

The artifact hash matched before launch. Its own adjacent asset-base, cards, objects and packs were served by the loopback server; there was no standalone fallback. Native packaged controllers and handlers were retained throughout. Browser code imported no game source and did not remount the screen.

## Final shipped-default mobile evidence

The 375 × 667 Core seed-3 fixture used the supported shot entry with three enemies and five hand cards. **The only shot setting override was `{"seenTutorial":true}`.** Input, confirmation, animation and combat-speed settings therefore used the build's shipped defaults; no instant/8×/hold-off override was used for these mobile or rapid-inspection checks.

Actual local fixture URL:

`http://127.0.0.1:42915/AshenSpire.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3&shotHand=5&shotSettings=%7B%22seenTutorial%22%3Atrue%7D`

Native card touch selected Strike `gp3`; a visible `e2` name touch paid that card exactly once for 1 SP and dealt 9 HP. After real playback unlocked the hand, native touch selected Defend `gp7`; native player-action-glyph touch paid that exact card once for 1 SP and gained 14 Block. Final SP was 1 from an initial 3. No unwanted combatant inspector opened.

A separate fresh default-settings fixture held a target to inspect it. The original release played no action. Native Escape closed inspection; fresh name and HP touches began 369.6 ms and 449.9 ms after inspection opened, both within the old 700 ms suppression window. Both committed exactly one intended action to `e2`, without reopening inspection. These elapsed values assert gesture ownership correctness; they are not latency/performance measurements.

## Final route and Upcast freshness evidence

These separate 1280 × 800 preview fixtures deliberately used fast settings for bounded preview/payment checks: `{"oneTapPlay":false,"autoCombat":false,"animSpeed":"instant","combatSpeed":8,"holdConfirm":"off","seenTutorial":true}`. They are not included in the shipped-default mobile claim above.

The approved Core range fixture assigned the actual authored Dagger to the active loadout, cleared the other hand, and moved an existing authored starter Strike into hand. It posed SP to 1, player/enemy HP and max HP to 100, and canonical typed enemy-pair distances to Reach and Ranged. It did not invent card definitions, effects or handlers. Native hover between the two enemies refreshed the current target quote from Advance +1 SP / Total 2 SP to +2 SP / Total 3 SP. Hovering back and explicitly choosing Throw refreshed the selected route and after-route caption. The unmodified/current chance stayed Out of range · 0%, distinct from after-route 95%; the explicit -1 Precision penalty remained visible even though this fixture's chance caps at 95%. The selected card and target each had one matching current odds row. Route choice changed no resources, RNG or engagement distance. Actual native target activation then spent exactly 1 SP and did not move the pair.

The authored Current/Starseer seedB `rc6` Starstone Pebble was moved from its actual starting draw pile into hand, retaining its instance metadata and authored `potency=+2` modifier. Native touch selected the card. Its real Upcast button opened the actual HTML rank select; Playwright's standard `selectOption('1')` invoked the production form change handler. The UI changed from tier 0 to Upcast +1 while keeping rc6 selected, resources/RNG/action receipts unchanged, and both card and target odds correctly at 85%. This is a real form-control action, not a claim of native keyboard rank input. No controller/function/definition was replaced.

Both final supplemental images were inspected:

- `/tmp/mobile-odds-only-final-qa/odds/native-range-throw-1280x800.png`
- `/tmp/mobile-odds-only-final-qa/odds/native-current-starseer-upcast-1280x800.png`

## Scope, errors and preserved attempts

The three final gameplay runners exited 0 with no runtime page errors or unexpected HTTP failures. The odds runner's source-request guard recorded no game-source loads. Optional HTTP classification remains restricted to default `/music/manifest.json` procedural-score fallback and `/assets/sfx/<id>.ogg` synthesized-effect fallback. This narrow run collects page exceptions and HTTP failures; it does not claim an empty browser console or repeat the earlier full console census.

The first scratch mobile attempt failed **before game navigation** because an inline comment accidentally hid the scratch URL declaration. The comment was corrected; no game assertion or deadline changed. Its Node `ReferenceError: url is not defined` log/report remain in `/workspace/scratch/mobile-odds-only-final-qa-normal-harness-attempt.log` and `/tmp/mobile-odds-only-final-qa/normal-mobile-harness-attempt/report.json`. No product failure is inferred from that harness-only attempt.

Earlier setup attempts involving the default Current opening hand and ArrowDown-only select commit belong to the prior private union; they remain documented under `/workspace/scratch/mobile-combined-probe-qa-capture-record.md` and are not silently overwritten.

No five-view gallery, Log drag/offset, save, Counter or full motion suite was repeated. Earlier fast five-view screenshots remain honestly labelled source `df8e12ef79f12f9bc6f94ea6c7cde8b0ffb10c3d`, build `1765/93f0756a63`, HTML SHA `aa55863c498dc8225aa433a3f5af74ff9508377957d503a1204df1b20ed1591f`; they are not relabelled as fresh captures of this final source. The known inherited 375 × 667 enemy-art obscuration remains documented in those records and is not claimed fixed.

Reports: `/tmp/mobile-odds-only-final-qa/{normal-mobile,rapid-inspection,odds}/report.json`.

Runners: `/workspace/scratch/mobile-odds-only-final-input.mjs` and `/workspace/scratch/mobile-odds-only-final-odds.mjs`.

Logs: `/workspace/scratch/mobile-odds-only-final-qa-normal.log`, `/workspace/scratch/mobile-odds-only-final-qa-rapid.log`, `/workspace/scratch/mobile-odds-only-final-qa-odds.log`.

All runners closed browsers, CDP launchers and loopback servers in `finally`. Process cleanup was checked and the exclusive browser/CPU lease explicitly released before the coordinator's performance run. No source edits, build, push or screenshot archive occurred during QA. This local record does not verify public delivery.
