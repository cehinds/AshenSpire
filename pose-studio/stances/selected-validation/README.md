# Selected stance integration evidence

`pack-qa.json` records the packaged game check at 1440×1000 and fresh 390×844
phone viewports. All twelve selected poses follow real card input through the
combat controller. Phone checks additionally verify each class requests its
Lite casting frame. Co-op checks feed the existing screenshot socket with
confirmed host receipts, verify independent seats and clear only the seat
whose next turn starts. These are controlled combat fixtures, not full runs
or physical-phone acceptance.

The screenshots show the selected Starseer casting pose, Rogue casting on a
phone viewport, and different held poses on the co-op board. The tested game
content was build 0.7.1.1141; 1142 adds the PR's generated changelog receipt.

No unexpected request or JavaScript errors occurred. The report retains the
known optional audio-sample probes (the existing procedural audio fallback)
and Chromium's vibration notices before pointer activation.

Reproduce with a running source or packaged game:

```powershell
$env:STANCE_GAME_URL='http://127.0.0.1:4393/build/AshenSpire.html'
node tools/alternative-selected-stances-qa.mjs
```

`PLAYWRIGHT_MODULE`, `CHROME` and `STANCE_QA_OUT` configure the installed
browser tooling and evidence destination. The original source-game results
are retained in `game-qa.json` and `coop-qa.json`.

The four focused stance/action test files pass 19 tests, including selection
hashes, Full/Lite pack inclusion, action completion, defeat/revival, reduced
motion, existing counter presentation and load retry. Counter artwork and
additional armour/enemy variants remain separate work.

The Blight HUD follow-up removes the standalone Block / Barrier / Ward summary.
`blight-qa.json` covers packaged build 0.7.1.1143 at 1440, 994 and 390 pixels wide;
`blight-coop-qa.json` covers two-seat co-op in build 0.7.1.1144 at 1440 and 390 pixels. Positive
Blight is centered and wide, phones reserve a separate header row, and the
meter disappears at zero. The shared renderer also passes values -1, 0, 1,
35 and 100. The phone also shows Stand up when prone and opens the pending
Blight feat chooser. No page errors or horizontal overflow occurred. The accompanying
`blight-*.png` captures show positive and zero solo states and phone co-op.

After reconciling alternative/dev through 3df7b3ec4e, the 19 focused stance
tests still pass. `merged-source-qa.json` repeats all twelve selected card
poses, four fresh-phone Lite loads, independent co-op seats and own-turn
reset against the merged source. No unexpected page or request errors occur.
The browser sequence waits for combat input to unlock before injecting its
next card, since a held pose may paint before the last effect finishes.
